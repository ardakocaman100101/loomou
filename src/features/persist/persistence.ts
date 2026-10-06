import type { Bpm, Song, SongConfig, SongMeasure, SongMetadata, SongNote, Tracks } from '@/types'
import * as idb from 'idb-keyval'
import * as jotai from 'jotai'
import { parseMidi } from '../parsers'
import * as storageKeys from './constants'
import Storage from './storage'

interface LocalDir {
  id: string
  addedAt: number
  handle: FileSystemDirectoryHandle
}

// Clean up deprecated localStorage keys
if (globalThis.localStorage?.length > 0) {
  for (const key of storageKeys.DEPRECATED_LOCAL_STORAGE_KEYS) {
    localStorage.removeItem(key)
  }
}

type LocalDirKey = string

export const localDirsAtom = jotai.atom<LocalDir[]>([])
export const requiresPermissionAtom = jotai.atom<boolean>(false)
export const localSongsAtom = jotai.atom<Map<string, SongMetadata[]>>(new Map())
export const uploadedSongsAtom = jotai.atom<SongMetadata[]>([])
export const uploadedFilesAtom = jotai.atom<Map<string, File>>(new Map())
export const isInitializedAtom = jotai.atom<boolean>(false)

const store = jotai.getDefaultStore()

export async function initialize() {
  if (store.get(isInitializedAtom)) {
    return Promise.resolve()
  }
  try {
    const dirs: LocalDir[] = (await idb.get(storageKeys.OBSERVED_DIRECTORIES)) ?? []
    store.set(localDirsAtom, dirs)

    const uploaded: SongMetadata[] = (await idb.get('UPLOADED_SONGS')) ?? []
    store.set(uploadedSongsAtom, uploaded)

    const hasPermission = await Promise.all(dirs.map((dir) => checkPermission(dir.handle)))
    if (!hasPermission.every((p) => p)) {
      store.set(requiresPermissionAtom, true)
      return
    }
    await scanFolders()
  } catch (e) {
    console.error('persistence init failed', e)
  } finally {
    store.set(isInitializedAtom, true)
  }
}

async function checkPermission(handle: FileSystemDirectoryHandle) {
  const permission = await handle.queryPermission({ mode: 'read' })
  return permission === 'granted'
}

// Check if File System Access API is supported
export function isFileSystemAccessSupported(): boolean {
  return 'showDirectoryPicker' in window
}

export async function addFolder(): Promise<void> {
  if (!isFileSystemAccessSupported()) {
    throw new Error('File System Access API is not supported in this browser')
  }
  await initialize()

  try {
    const newHandle = await window.showDirectoryPicker({
      mode: 'read',
      startIn: 'music',
    })

    // Add directory if it isn't already in the set
    const dirs = store.get(localDirsAtom)
    const alreadyExists = (
      await Promise.all(dirs.map((d) => d.handle.isSameEntry(newHandle)))
    ).find((d) => d)
    if (!alreadyExists) {
      dirs.push({ id: crypto.randomUUID(), handle: newHandle, addedAt: Date.now() })
      store.set(localDirsAtom, dirs)
      await idb.set(storageKeys.OBSERVED_DIRECTORIES, dirs)
      await scanFolders()
    }

    return
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      return
    }
    throw error
  }
}

export function extractCommonTitle(fileNames: string[]): string {
  const cleanNames = fileNames.map((f) => f.replace(/\.[^/.]+$/, ''))
  if (cleanNames.length === 0) return 'Untitled Song'
  if (cleanNames.length === 1) return cleanNames[0]

  let prefix = cleanNames[0]
  for (let i = 1; i < cleanNames.length; i++) {
    while (!cleanNames[i].toLowerCase().startsWith(prefix.toLowerCase())) {
      prefix = prefix.substring(0, prefix.length - 1)
      if (!prefix) break
    }
  }

  // Clean trailing delimiters and track suffixes like _Track, -part, etc.
  const stripped = prefix
    .replace(/[_\-\s]+(track|tr|part|pt)?[0-9_\-\s]*$/i, '')
    .replace(/[_\-\s]+$/, '')
    .trim()

  return stripped || cleanNames[0]
}

export function getUniqueSongTitle(desiredTitle: string, existingTitles: string[]): string {
  const titlesSet = new Set(existingTitles.map((t) => t.trim().toLowerCase()))
  const cleanBase = desiredTitle.trim()

  if (!titlesSet.has(cleanBase.toLowerCase())) {
    return cleanBase
  }

  let suffix = 1
  while (titlesSet.has(`${cleanBase} (${suffix})`.toLowerCase())) {
    suffix++
  }
  return `${cleanBase} (${suffix})`
}

export async function addUploadedSongs(files: File[]): Promise<string> {
  const validFiles = files.filter(
    (f) =>
      !f.name.startsWith('.') &&
      !f.name.startsWith('__MACOSX') &&
      f.name !== 'Thumbs.db' &&
      f.name !== 'desktop.ini',
  )

  if (validFiles.length === 0) throw new Error('No valid MIDI files provided')

  // 1. Folder Validation: Check for subdirectories
  const hasSubfolders = validFiles.some((f) => {
    if (!f.webkitRelativePath) return false
    const parts = f.webkitRelativePath.split('/')
    return parts.length > 2
  })
  if (hasSubfolders) {
    throw new Error('The folder must not contain subfolders. All .mid files must be directly in the root folder.')
  }

  // 2. Folder Validation: Check for non-MIDI files
  const hasNonMidi = validFiles.some((f) => {
    const ext = f.name.toLowerCase()
    return !ext.endsWith('.mid') && !ext.endsWith('.midi')
  })
  if (hasNonMidi) {
    throw new Error('The selected folder contains non-MIDI files. Only .mid and .midi files are permitted.')
  }

  // 3. Determine Candidate Song Title
  const isMultiFile = validFiles.length > 1
  let rawTitle = ''

  if (isMultiFile) {
    const firstFile = validFiles[0]
    if (firstFile.webkitRelativePath) {
      const parts = firstFile.webkitRelativePath.split('/')
      if (parts.length > 1 && parts[0].trim()) {
        rawTitle = parts[0].trim()
      }
    }
    if (!rawTitle) {
      rawTitle = extractCommonTitle(validFiles.map((f) => f.name))
    }
  } else {
    rawTitle = validFiles[0].name.replace(/\.[^/.]+$/, '')
  }

  if (!rawTitle) {
    rawTitle = 'Uploaded Song'
  }

  // 4. Ensure Unique Title (append (1), (2), etc. if duplicate exists)
  const currentUploaded = store.get(uploadedSongsAtom) || []
  const localSongs = Array.from(store.get(localSongsAtom).values()).flatMap((x) => x)
  const allExistingTitles = [...currentUploaded, ...localSongs].map((s) => s.title).filter(Boolean)
  const uniqueTitle = getUniqueSongTitle(rawTitle, allExistingTitles)

  // 5. Parse and merge MIDI files
  const parsedSongs = await Promise.all(
    validFiles.map(async (file) => {
      const buffer = await file.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      return { file, song: parseMidi(bytes) }
    }),
  )

  const id = crypto.randomUUID()

  let mergedDuration = 0
  const mergedNotes: SongNote[] = []
  const mergedTracks: Tracks = {}
  let trackOffset = 0

  parsedSongs.forEach(({ file, song }) => {
    const cleanFileName = file.name.replace(/\.[^/.]+$/, '')
    const trackMapping: { [old: number]: number } = {}
    const trackKeys = Object.keys(song.tracks)

    trackKeys.forEach((oldIdStr) => {
      const oldId = parseInt(oldIdStr)
      const newId = trackOffset++
      trackMapping[oldId] = newId
      mergedTracks[newId] = { ...song.tracks[oldIdStr] }

      // Set clean track name derived from filename without extension
      if (isMultiFile) {
        if (trackKeys.length > 1) {
          const originalName = song.tracks[oldIdStr].name
          mergedTracks[newId].name = originalName ? `${cleanFileName} - ${originalName}` : cleanFileName
        } else {
          mergedTracks[newId].name = cleanFileName
        }
      } else {
        mergedTracks[newId].name = song.tracks[oldIdStr].name || cleanFileName
      }
    })

    song.notes.forEach((note) => {
      mergedNotes.push({
        ...note,
        track: trackMapping[note.track] !== undefined ? trackMapping[note.track] : note.track,
      })
    })

    if (song.duration > mergedDuration) {
      mergedDuration = song.duration
    }
  })

  // Use measures and bpms from longest song to represent timeline
  let maxDurationSong = parsedSongs[0].song
  parsedSongs.forEach(({ song }) => {
    if (song.duration > maxDurationSong.duration) {
      maxDurationSong = song
    }
  })

  const mergedMeasures = maxDurationSong.measures || []
  const mergedBpms = maxDurationSong.bpms || []

  const metadata: SongMetadata = {
    id,
    title: uniqueTitle,
    file: id,
    source: 'upload',
    difficulty: 0,
    duration: mergedDuration,
  }

  const newUploaded = [...currentUploaded, metadata]
  store.set(uploadedSongsAtom, newUploaded)
  await idb.set('UPLOADED_SONGS', newUploaded)

  const currentFiles = store.get(uploadedFilesAtom)
  const newFiles = new Map(currentFiles)
  newFiles.set(id, validFiles[0])
  store.set(uploadedFilesAtom, newFiles)

  const songData: Partial<Song> = {
    tracks: mergedTracks,
    duration: mergedDuration,
    notes: mergedNotes,
    measures: mergedMeasures,
    bpms: mergedBpms,
    ppq: maxDurationSong.ppq || 480,
    timeSignature: maxDurationSong.timeSignature,
    keySignature: maxDurationSong.keySignature,
  }

  Storage.set(id, songData)
  await idb.set(`SONG_DATA_${id}`, songData)

  return id
}

export function getUploadedFile(id: string): File | undefined {
  return store.get(uploadedFilesAtom).get(id)
}

export async function deleteUploadedSong(id: string): Promise<void> {
  const currentUploaded = store.get(uploadedSongsAtom)
  const newUploaded = currentUploaded.filter((s) => s.id !== id)
  store.set(uploadedSongsAtom, newUploaded)
  try {
    if (typeof indexedDB !== 'undefined') {
      await idb.set('UPLOADED_SONGS', newUploaded)
    }
  } catch (_) {}

  const currentFiles = store.get(uploadedFilesAtom)
  if (currentFiles.has(id)) {
    const newFiles = new Map(currentFiles)
    newFiles.delete(id)
    store.set(uploadedFilesAtom, newFiles)
  }

  Storage.delete(id)
  Storage.delete(`${id}/settings`)
  Storage.delete(`${id}/edited_midi`)
  try {
    if (typeof indexedDB !== 'undefined') {
      await idb.del(`SONG_DATA_${id}`)
    }
  } catch (_) {}
}

export const isScanningAtom = jotai.atom<false | Promise<void>>(false)

export async function scanFolders() {
  const inProgressScan = store.get(isScanningAtom)
  if (inProgressScan !== false) {
    await inProgressScan
    return
  }
  const { resolve, reject, promise } = Promise.withResolvers()
  store.set(isScanningAtom, promise as Promise<void>)
  try {
    let songs = new Map()
    const dirs = store.get(localDirsAtom)
    if (store.get(requiresPermissionAtom)) {
      for (const dir of dirs) {
        const didGrant = (await dir.handle.requestPermission({ mode: 'read' })) === 'granted'
        if (!didGrant) {
          console.warn('Permission not granted for', dir.handle.name)
          return
        }
      }
      store.set(requiresPermissionAtom, false)
    }
    for (const dir of dirs) {
      const dirSongs = await scanFolder(dir)
      songs.set(dir.id, dirSongs)
    }
    store.set(localSongsAtom, songs)
    resolve(undefined)
  } catch (error) {
    reject(new Error('Error scanning folders:', { cause: error }))
  } finally {
    store.set(isScanningAtom, false)
  }
}

function isMidiFile(file: File): boolean {
  return (
    file.type === 'audio/midi' ||
    file.type === 'audio/mid' ||
    file.name.endsWith('.mid') ||
    file.name.endsWith('.midi')
  )
}

export async function getSongHandle(id: string): Promise<FileSystemFileHandle | undefined> {
  await initialize()
  const [dirId, basename] = id.split('/')

  const dir = store.get(localDirsAtom).find((d) => d.id === dirId)
  if (!dir) {
    console.error('Missing expected directory handle')
    return
  }

  const localSongs = store.get(localSongsAtom)
  const dirSongs = localSongs.get(dir?.id)
  return dirSongs?.find((s) => s.handle?.name === basename)?.handle
}
initialize()

async function scanFolder(dir: LocalDir): Promise<SongMetadata[]> {
  const songs: SongMetadata[] = []

  try {
    for await (const [name, handle] of dir.handle.entries()) {
      if (handle.kind === 'file') {
        const fileHandle = handle as FileSystemFileHandle
        const file = await fileHandle.getFile()

        try {
          if (isMidiFile(file)) {
            const title = name
            const id = title // for now

            let buffer = await file.arrayBuffer()
            let bytes = new Uint8Array(buffer)
            let duration = parseMidi(bytes).duration
            const songMetadata: SongMetadata = {
              id: dir.id + '/' + name,
              title,
              file: id,
              source: 'local',
              difficulty: 0,
              duration,
              handle: fileHandle,
            }

            songs.push(songMetadata)
          }
        } catch (error) {
          console.error(`Error parsing MIDI file ${name}:`, error)
        }
      }
    }
  } catch (error) {
    console.error('Error scanning folder:', error)
    throw new Error(`Failed to scan folder: ${(error as Error).message}`)
  }

  return songs
}

export function removeFolder(id: string) {
  const dirs = store.get(localDirsAtom).filter((d) => d.id !== id)
  store.set(localDirsAtom, dirs)
  idb.set(storageKeys.OBSERVED_DIRECTORIES, dirs)
  scanFolders()
}

export async function getUploadedSong(id: string): Promise<Song | null> {
  // Check localStorage first for backwards compatibility
  const legacy = Storage.get<Song>(id)
  if (legacy) return legacy

  // Check IndexedDB
  const song = await idb.get<Song>(`SONG_DATA_${id}`)
  return song ?? null
}

export function getPersistedSongSettings(file: string) {
  const settings = Storage.get<SongConfig>(`${file}/settings`)
  if (settings && settings.tracks) {
    const allMuted = Object.values(settings.tracks).every((t) => t.sound === false)
    if (allMuted) {
      Object.keys(settings.tracks).forEach((idStr) => {
        const id = Number(idStr)
        if (settings.tracks[id]) {
          settings.tracks[id].sound = true
        }
      })
    }
  }
  return settings
}

export function setPersistedSongSettings(file: string, config: SongConfig) {
  return Storage.set(`${file}/settings`, config)
}

export function clearPersistedSongSettings(file: string) {
  Storage.delete(`${file}/settings`)
}

export function getEditedMidi(id: string): string | null {
  return Storage.get<string>(`${id}/edited_midi`)
}

export function saveEditedMidi(id: string, base64Data: string) {
  Storage.set(`${id}/edited_midi`, base64Data)
}

export function clearEditedMidi(id: string) {
  Storage.delete(`${id}/edited_midi`)
}

export function registerCustomSketch(id: string, title: string, duration: number) {
  const metadata: SongMetadata = {
    id,
    title,
    file: id,
    source: 'upload',
    difficulty: 0,
    duration,
  }
  const currentUploaded = store.get(uploadedSongsAtom)
  const exists = currentUploaded.some((s) => s.id === id)
  const newUploaded = exists
    ? currentUploaded.map((s) => (s.id === id ? { ...s, title, duration } : s))
    : [...currentUploaded, metadata]
  store.set(uploadedSongsAtom, newUploaded)
  idb.set('UPLOADED_SONGS', newUploaded)
}
