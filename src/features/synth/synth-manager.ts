import { SongConfig, SongNote, TrackSetting } from '@/types'
import { isBrowser } from '@/utils'
import * as Tone from 'tone'
import midi from '../midi'
import { getSynth, Synth } from './index'
import { InstrumentName } from './types'
import { isAudioContextEnabled } from './utils'

export class TrackAudioEngine {
  private synths: Map<number, Synth> = new Map()
  private trackConfigs: Record<number, TrackSetting> = {}
  private masterVolume = 0.3
  private keyboardVolume = 1.0
  private backgroundVolume = 0.8
  private backgroundTrackIds = new Set<number>()

  public ensureAudioContextRunning() {
    if (isBrowser() && Tone.getContext().state !== 'running') {
      Tone.start()
      Tone.getContext()
        .resume()
        .catch(() => {})
    }
  }

  public async setSongTracks(
    tracks: Record<number | string, any>,
    trackConfigs: Record<number | string, TrackSetting>,
  ): Promise<void> {
    this.stopAllSounds()
    // Dispose old per-track gain nodes before clearing
    this.synths.forEach((synth) => synth.dispose?.())
    this.synths.clear()
    this.trackConfigs = {}
    Object.entries(trackConfigs).forEach(([id, cfg]) => {
      this.trackConfigs[Number(id)] = cfg
    })

    console.log('[AUDIO] setSongTracks trackConfigs:', JSON.stringify(
      Object.fromEntries(Object.entries(this.trackConfigs).map(([k,v]) => [k, { sound: v.sound, practice: v.practice, instrument: v.instrument }]))
    ))

    const trackEntries = Object.entries(tracks)
    const synthPromises: Promise<{ trackId: number; synth: Synth }>[] = trackEntries.map(
      async ([trackIdStr, trackObj]) => {
        const trackId = Number(trackIdStr)
        const cfg = this.trackConfigs[trackId]
        const instrument: InstrumentName =
          cfg?.instrument ?? trackObj.program ?? trackObj.instrument ?? 0
        console.log(`[AUDIO] Loading track ${trackId}, instrument=${instrument}, sound=${cfg?.sound}`)
        const synth = await getSynth(instrument)
        return { trackId, synth }
      },
    )

    const loadedSynths = await Promise.all(synthPromises)
    loadedSynths.forEach(({ trackId, synth }) => {
      this.synths.set(trackId, synth)
      const isMuted = this.trackConfigs[trackId]?.sound === false
      const vol = isMuted ? 0 : 1
      console.log(`[AUDIO] Track ${trackId} loaded, setting vol=${vol}`)
      synth.setMasterVolume(vol)
    })
    console.log('[AUDIO] setSongTracks complete, synth map keys:', Array.from(this.synths.keys()))
  }

  public setMasterVolume(vol: number) {
    this.masterVolume = vol
  }

  public setKeyboardVolume(vol: number) {
    this.keyboardVolume = vol
  }

  public setBackgroundVolume(vol: number) {
    this.backgroundVolume = vol
  }

  public setBackgroundTracks(trackIds: number[]) {
    this.backgroundTrackIds = new Set(trackIds.map(Number))
  }

  public setTrackVolume(trackId: number | string, vol: number) {
    const numId = Number(trackId)
    if (this.trackConfigs[numId]) {
      this.trackConfigs[numId].sound = vol > 0
    }
    const synth = this.synths.get(numId)
    if (synth) {
      synth.setMasterVolume(vol)
    }
  }

  public async setTrackInstrument(trackId: number | string, instrument: InstrumentName): Promise<void> {
    const numId = Number(trackId)
    const synth = await getSynth(instrument)
    this.synths.set(numId, synth)
    const isMuted = this.trackConfigs[numId]?.sound === false
    synth.setMasterVolume(isMuted ? 0 : 1)
  }

  public playTrackNote(trackId: number | string, midiNote: number, velocity = 80) {
    const numId = Number(trackId)
    const config = this.trackConfigs[numId]
    if (config && config.sound === false) {
      return
    }

    const isBackground = this.backgroundTrackIds.has(numId)
    const effectiveVol = isBackground ? this.backgroundVolume : this.masterVolume
    if (effectiveVol <= 0) return

    this.ensureAudioContextRunning()

    const synth = this.synths.get(numId)
    if (synth) {
      const finalVel = velocity * effectiveVol
      synth.playNote(midiNote, finalVel)
    }
  }

  public stopTrackNote(trackId: number | string, midiNote: number) {
    const numId = Number(trackId)
    const synth = this.synths.get(numId)
    synth?.stopNote(midiNote)
  }

  public playUserNote(midiNote: number, velocity = 64) {
    this.ensureAudioContextRunning()

    let activeTrackId = 0
    if (Object.keys(this.trackConfigs).length > 0) {
      const activeEntry =
        Object.entries(this.trackConfigs).find(([_, config]) => config.practice && config.sound) ||
        Object.entries(this.trackConfigs).find(([_, config]) => config.sound) ||
        Object.entries(this.trackConfigs)[0]
      if (activeEntry) {
        activeTrackId = Number(activeEntry[0])
      }
    }

    let synth = this.synths.get(activeTrackId) || Array.from(this.synths.values())[0]
    if (synth) {
      synth.playNote(midiNote, velocity * this.keyboardVolume)
    }
  }

  public stopUserNote(midiNote: number) {
    let activeTrackId = 0
    if (Object.keys(this.trackConfigs).length > 0) {
      const activeEntry =
        Object.entries(this.trackConfigs).find(([_, config]) => config.practice && config.sound) ||
        Object.entries(this.trackConfigs).find(([_, config]) => config.sound) ||
        Object.entries(this.trackConfigs)[0]
      if (activeEntry) {
        activeTrackId = Number(activeEntry[0])
      }
    }

    let synth = this.synths.get(activeTrackId) || Array.from(this.synths.values())[0]
    synth?.stopNote(midiNote)
  }

  public stopAllSounds() {
    this.synths.forEach((synth) => {
      if (typeof (synth as any).stopAllNotes === 'function') {
        ;(synth as any).stopAllNotes()
      } else {
        for (let note = 21; note <= 108; note++) {
          try {
            synth.stopNote(note)
          } catch (_) {}
        }
      }
    })
  }
}

export const trackAudioEngine = new TrackAudioEngine()

