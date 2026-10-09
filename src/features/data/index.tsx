import { parseMidi } from '@/features/parsers'
import { Song, SongSource } from '@/types'
import { base64ToBytes, peek } from '@/utils'
import * as idb from 'idb-keyval'
import type { SWRResponse } from 'swr'
import { mutate } from 'swr'
import useSWRImmutable from 'swr/immutable'
import Storage from '../persist/storage'
import * as persistence from '../persist/persistence'
import { predictSongFingerings } from '../theory/fingering'

function applyCustomTrackNames(id: string, song: Song): Song {
  const customTrackNames = Storage.get<Record<string, Record<number, string>>>('loomo_custom_track_names') || {}
  if (customTrackNames[id] && song.tracks) {
    Object.entries(customTrackNames[id]).forEach(([tid, name]) => {
      const trackNum = Number(tid)
      if (song.tracks[trackNum] && name) {
        song.tracks[trackNum] = {
          ...song.tracks[trackNum],
          name,
        }
      }
    })
  }
  return song
}

async function handleSong(response: Response): Promise<Song> {
  return response.arrayBuffer().then((buf) => parseMidi(new Uint8Array(buf)))
}

function getBuiltinSongUrl(id: string) {
  return `/music/songs/${id}`
}

function getBase64Song(data: string): Song {
  const binaryMidi = base64ToBytes(data)
  return parseMidi(binaryMidi)
}

export function ensureSongFunctions(song: Song): Song {
  const sort = <T extends { time: number }>(arr: T[]): T[] => {
    return [...arr].sort((a, b) => a.time - b.time)
  }

  const items = sort([...(song.measures ?? []), ...(song.notes ?? [])])

  if (typeof song.secondsToTicks === 'function' && typeof song.ticksToSeconds === 'function') {
    return {
      ...song,
      items,
    }
  }

  const ppq = song.ppq ?? 480
  const bpms = song.bpms && song.bpms.length > 0 ? song.bpms : [{ time: 0, bpm: 120 }]

  const secondsToTicks = (seconds: number): number => {
    const sorted = [...bpms].sort((a, b) => a.time - b.time)
    let ticks = 0
    let lastTime = 0
    let lastBpm = sorted[0].bpm

    for (let i = 1; i < sorted.length; i++) {
      const event = sorted[i]
      if (seconds <= event.time) {
        break
      }
      const duration = event.time - lastTime
      ticks += duration * (lastBpm / 60) * ppq
      lastTime = event.time
      lastBpm = event.bpm
    }

    const remaining = Math.max(0, seconds - lastTime)
    ticks += remaining * (lastBpm / 60) * ppq
    return Math.round(ticks)
  }

  const ticksToSeconds = (ticks: number): number => {
    const sorted = [...bpms].sort((a, b) => a.time - b.time)
    let currentTicks = 0
    let currentTime = 0
    let lastBpm = sorted[0].bpm

    for (let i = 1; i < sorted.length; i++) {
      const event = sorted[i]
      const nextTicks = currentTicks + (event.time - currentTime) * (lastBpm / 60) * ppq
      if (ticks <= nextTicks) {
        break
      }
      currentTicks = nextTicks
      currentTime = event.time
      lastBpm = event.bpm
    }

    const remainingTicks = Math.max(0, ticks - currentTicks)
    currentTime += remainingTicks / ((lastBpm / 60) * ppq)
    return currentTime
  }

  return {
    ...song,
    items,
    secondsToTicks,
    ticksToSeconds,
  }
}

async function fetchSong(id: string, source: SongSource): Promise<Song> {
  // 1. Check IndexedDB/Storage first to load previously computed fingerings or sketch edits
  const cached = await persistence.getUploadedSong(id)
  if (cached) {
    applyCustomTrackNames(id, cached)
    const songWithFunctions = ensureSongFunctions(cached)
    // Run quiet check/prediction if it's missing fingerings (e.g. from early sketches/uploads)
    triggerFingeringPrediction(id, source, songWithFunctions)
    return songWithFunctions
  }

  let song: Song
  const editedMidi = persistence.getEditedMidi(id)
  if (editedMidi) {
    song = getBase64Song(editedMidi)
  } else if (source === 'builtin') {
    const url = getBuiltinSongUrl(id)
    song = await fetch(url).then(handleSong)
  } else if (source === 'base64') {
    song = getBase64Song(id)
  } else if (source === 'local') {
    await persistence.initialize()
    const handle = await persistence.getSongHandle(id)
    const file = await handle?.getFile()
    if (!file) {
      throw new Error(`Could not get song for ${id}, ${source}`)
    }
    const buffer = await file.arrayBuffer()
    song = parseMidi(new Uint8Array(buffer))
  } else if (source === 'upload') {
    const file = persistence.getUploadedFile(id)
    if (!file) {
      throw new Error(`Could not find uploaded file for ${id}`)
    }
    const buffer = await file.arrayBuffer()
    song = parseMidi(new Uint8Array(buffer))
  } else {
    return Promise.reject(new Error(`Could not get song for ${id}, ${source}`))
  }

  applyCustomTrackNames(id, song)
  const songWithFunctions = ensureSongFunctions(song)
  // 2. Trigger fingering prediction quietly in parallel
  triggerFingeringPrediction(id, source, songWithFunctions)

  return songWithFunctions
}

function triggerFingeringPrediction(id: string, source: SongSource, song: Song) {
  // If the song already has fingerings calculated (at least one note has a finger assignment), skip prediction
  const hasFingerings = song.notes.some((n) => typeof n.finger === 'number')
  if (hasFingerings) {
    return
  }

  ;(async () => {
    try {
      const predictedSong = await predictSongFingerings(song)
      // Save predicted song back to IndexedDB so it's cached next time (strip functions to prevent DataCloneError)
      const songToSave = {
        ...predictedSong,
        secondsToTicks: undefined,
        ticksToSeconds: undefined,
      }
      await idb.set(`SONG_DATA_${id}`, songToSave)

      const songWithFunctions = ensureSongFunctions(predictedSong)
      // Quietly update SWR cache to display fingerings in the UI without a page reload
      mutate([id, source], songWithFunctions, false)
      console.log(`Fingerings predicted and saved quietly for: ${id}`)
    } catch (err) {
      console.error(`Quiet background fingering prediction failed for ${id}:`, err)
    }
  })()
}

export function useSong(id?: string, source?: SongSource): SWRResponse<Song, any, any> {
  const shouldFetch =
    typeof id === 'string' && id.length > 0 && typeof source === 'string' && source.length > 0
  return useSWRImmutable(shouldFetch ? [id, source] : null, ([id, source]) => fetchSong(id, source))
}
