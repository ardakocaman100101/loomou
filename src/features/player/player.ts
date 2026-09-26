import { getSynthStub, InstrumentName, trackAudioEngine } from '@/features/synth'
import { MidiStateEvent, Song, SongConfig, SongMeasure, SongNote, TrackSetting } from '@/types'
import { getHands, round } from '@/utils'
import { atom, Atom, getDefaultStore, PrimitiveAtom } from 'jotai'
import midi from '../midi'
import { getSynth, Synth } from '../synth'
import { getAudioContext, playCountdownClick } from '../synth/utils'
import {
  calculateNoteDurationScore,
  evaluateFirstPressScore,
  sessionScoreHistory,
} from './scoring'

function increment(x: number) {
  return x + 1
}

type JotaiStore = ReturnType<typeof getDefaultStore>

export interface Score {
  perfect: PrimitiveAtom<number>
  early: PrimitiveAtom<number>
  late: PrimitiveAtom<number>
  good: Atom<number>
  missed: PrimitiveAtom<number>
  miss: Atom<number>
  durationHeld: PrimitiveAtom<number>
  error: PrimitiveAtom<number>
  combined: Atom<number>
  accuracy: Atom<number>
  streak: PrimitiveAtom<number>
}

function getInitialScore(): Score {
  const perfect = atom(0)
  const early = atom(0)
  const late = atom(0)
  const missed = atom(0)
  const error = atom(0)
  const durationHeld = atom(0)
  const streak = atom(0)

  const good = atom((get) => get(early) + get(late))
  const miss = atom((get) => get(missed) + get(error))

  const combined = atom((get) => {
    const rawScore = get(perfect) * 100 + get(good) * 50 - get(error) * 25 + get(durationHeld)
    return Math.max(0, rawScore)
  })

  const accuracy = atom((get) => {
    const total = get(perfect) + get(early) + get(late) + get(miss)
    const points = get(perfect) + 0.5 * (get(early) + get(late))

    return total === 0 ? 100 : Math.round((100 * points) / total)
  })

  const hit = atom((get) => {
    return get(perfect) + get(good)
  })

  return {
    perfect,
    early,
    late,
    good,
    missed,
    miss,
    error,
    durationHeld,
    combined,
    accuracy,
    streak,
  }
}

export type PlayerState = 'CannotPlay' | 'Playing' | 'Paused'

export class Player {
  store: JotaiStore
  state: PrimitiveAtom<PlayerState> = atom<PlayerState>('CannotPlay')
  score: Score = getInitialScore()
  song: PrimitiveAtom<Song | null> = atom<Song | null>(null)
  playInterval: any = null
  trackConfigs: { [id: number]: TrackSetting } = {}
  currentSongTime = 0
  volume = atom(0.3)
  instrumentVolume = atom(1)
  backgroundVolume = atom(0.8)
  lastNonZeroVolume = 0.3
  lastNonZeroInstrumentVolume = 1
  lastNonZeroBackgroundVolume = 0.8
  songLoop = atom(false)

  // TODO: Determine if MIDI always assumes BPM means quarter notes per minute.
  // Add link to documentation if so.
  bpmModifier = atom(1)
  currentBpmIndex = atom(0)
  currentBpm: Atom<number> = atom((get) => {
    const currSongBpm = get(this.song)?.bpms[get(this.currentBpmIndex)]?.bpm ?? 120
    return currSongBpm * get(this.bpmModifier)
  })

  metronomeVolume = atom(0)
  metronomeSpeed = atom(1)
  metronomeEmphasizeFirst = atom(false)
  metronomeLastPlayedTick: null | number = null
  metronomeSynth = getSynthStub('woodblock')
  metronomeAccentedSynth = getSynthStub('agogo')

  countdown = atom<number | null>(null)
  countdownTimers: any[] = []

  currentIndex: number = 0
  lastIntervalFiredTime = 0
  playing: Array<SongNote> = []
  synths: Array<Synth> = []
  handlers: any = {}
  range: PrimitiveAtom<null | [number, number]> = atom<null | [number, number]>(null)
  hand = 'both'
  wait = false
  songHands: { left?: number; right?: number } = {}

  hitNotes: Set<SongNote> = new Set()
  missedNotes: Set<SongNote> = new Set()
  midiPressedNotes: Set<number> = new Set()
  keyPressTimes: Map<number, number> = new Map()
  pressFeedback: Map<number, string> = new Map()
  lateNotes: Map<number, SongNote[]> = new Map()
  skipMissedNotes = false
  progressiveMode = atom(false)
  completedTracks = atom<Set<number>>(new Set<number>())

  perfectRange = 60
  goodRange = 300

  constructor(store: JotaiStore) {
    this.store = store
    trackAudioEngine.setMasterVolume(0.3)
    midi.subscribe((midiEvent) => this.processMidiEvent(midiEvent))
  }

  setTolerance(perfect: number, good: number) {
    this.perfectRange = perfect
    this.goodRange = good
  }

  getSong() {
    return this.store.get(this.song)
  }

  clearMissedNotes_() {
    let missedNotes = 0
    for (const [midiNote, list] of this.lateNotes.entries()) {
      const remaining = list.filter((missedNote) => {
        if (this.hitNotes.has(missedNote) || missedNote.feedbackColor !== undefined) {
          return false
        }
        const diff = this.calcDiff(this.currentSongTime, missedNote.time)
        if (diff > this.goodRange) {
          missedNotes++
          missedNote.durationScore = 0
          this.missedNotes.add(missedNote)
          return false
        }
        return true
      })
      if (remaining.length === 0) {
        this.lateNotes.delete(midiNote)
      } else {
        this.lateNotes.set(midiNote, remaining)
      }
    }
    if (missedNotes > 0) {
      this.store.set(this.score.streak, 0)
    }
    this.store.set(this.score.missed, (count) => count + missedNotes)

    // Silently update continuous duration score for finished hit notes
    for (const hitNote of this.hitNotes) {
      if (hitNote.durationScore === undefined && this.currentSongTime >= hitNote.time + hitNote.duration) {
        hitNote.durationScore = calculateNoteDurationScore(hitNote, this.currentSongTime)
      }
    }
  }

  processMidiEvent(midiEvent: MidiStateEvent) {
    const song = this.getSong()
    if (!song) {
      return
    }

    const midiNote = midiEvent.note
    if (midiNote === undefined) {
      return
    }

    if (midiEvent.type === 'up') {
      this.midiPressedNotes.delete(midiNote)
      this.keyPressTimes.delete(midiNote)
      this.pressFeedback.delete(midiNote)
      for (const note of this.hitNotes) {
        if (
          note.midiNote === midiNote &&
          note.userPressStart !== undefined &&
          note.userPressEnd === undefined
        ) {
          note.userPressEnd = this.currentSongTime
          note.durationScore = calculateNoteDurationScore(note, this.currentSongTime)
        }
      }
      return
    } else {
      if (this.midiPressedNotes.has(midiNote)) {
        return
      }
      this.midiPressedNotes.add(midiNote)
      this.keyPressTimes.set(midiNote, this.currentSongTime)
    }

    if (this.isPlaying()) {
      this.processScoreData(midiNote)
    } else {
      this.pressFeedback.set(midiNote, 'grey')
    }
  }

  processScoreData(midiNote: number) {
    this.clearMissedNotes_()
    const currentTime = this.currentSongTime
    const pressTime = this.keyPressTimes.get(midiNote) ?? currentTime

    // 1. Check if the note is in lateNotes
    const list = this.lateNotes.get(midiNote)
    if (list && list.length > 0) {
      const lateNote = list.find((n) => {
        if (this.hitNotes.has(n) || n.feedbackColor !== undefined) return false
        const attackDiffMs = Math.abs(this.calcDiff(n.time, pressTime))
        return attackDiffMs <= this.goodRange
      })
      if (lateNote) {
        const diff = Math.abs(this.calcDiff(currentTime, lateNote.time))
        if (diff <= this.goodRange) {
          const color = diff <= this.perfectRange ? 'green' : 'purple'
          if (diff <= this.perfectRange) {
            this.store.set(this.score.perfect, increment)
          } else {
            this.store.set(this.score.late, increment)
          }

          // Evaluate all unison notes at this exact timestamp
          const unisonNotes = list.filter(
            (n) => !this.hitNotes.has(n) && Math.abs(this.calcDiff(n.time, lateNote.time)) < 5,
          )
          const notesToHit = unisonNotes.length > 0 ? unisonNotes : [lateNote]

          notesToHit.forEach((n) => {
            n.feedbackColor = color
            n.userPressStart = currentTime
            this.hitNotes.add(n)
            this.missedNotes.delete(n)
          })

          const remaining = list.filter((n) => !notesToHit.includes(n))
          if (remaining.length === 0) {
            this.lateNotes.delete(midiNote)
          } else {
            this.lateNotes.set(midiNote, remaining)
          }

          this.pressFeedback.set(midiNote, color)
          this.store.set(this.score.streak, increment)
          if (this.skipMissedNotes) {
            this.playNote(lateNote)
          }
          return
        }
      }
    }

    // 2. Check upcoming notes on active practice tracks
    const song = this.getSong()
    if (song && song.notes) {
      const maxMarginSec = ((this.goodRange * 1.5) / 1000) * this.store.get(this.bpmModifier)

      const candidateNotes = song.notes
        .filter((n) => {
          if (
            n.midiNote !== midiNote ||
            !this.isActiveHand(n) ||
            this.hitNotes.has(n) ||
            n.feedbackColor !== undefined
          ) {
            return false
          }
          const diffMs = Math.abs(this.calcDiff(n.time, currentTime))
          const attackDiffMs = Math.abs(this.calcDiff(n.time, pressTime))
          return (
            diffMs <= this.goodRange &&
            attackDiffMs <= this.goodRange &&
            n.time >= currentTime - maxMarginSec
          )
        })
        .sort((a, b) => Math.abs(a.time - currentTime) - Math.abs(b.time - currentTime))

      const nextNote = candidateNotes[0]

      if (nextNote) {
        const diff = Math.abs(this.calcDiff(nextNote.time, currentTime))
        const color = diff <= this.perfectRange ? 'green' : 'yellow'

        if (diff <= this.perfectRange) {
          this.store.set(this.score.perfect, increment)
        } else {
          this.store.set(this.score.early, increment)
        }

        // Evaluate all unison notes at this exact timestamp (same pitch, same time)
        const unisonNotes = candidateNotes.filter(
          (n) => Math.abs(this.calcDiff(n.time, nextNote.time)) < 5,
        )
        const notesToHit = unisonNotes.length > 0 ? unisonNotes : [nextNote]

        notesToHit.forEach((n) => {
          n.feedbackColor = color
          n.userPressStart = currentTime
          this.hitNotes.add(n)
          this.missedNotes.delete(n)
        })

        this.pressFeedback.set(midiNote, color)
        this.store.set(this.score.streak, increment)
        return
      }
    }

    this.store.set(this.score.error, increment)
    this.store.set(this.score.streak, 0)
    this.pressFeedback.set(midiNote, 'red')
  }

  // Given two song timestamps, return their difference in milliseconds after adjusting for the bpm modifier
  calcDiff(to: number, from: number) {
    return ((to - from) * 1000) / this.store.get(this.bpmModifier)
  }

  /* Return all notes that are valid to hit */
  getUpcomingNotes() {
    const song = this.getSong()
    const firstUpcomingNote = song?.notes[this.currentIndex]
    if (!firstUpcomingNote) return []

    const upcomingNotes: SongNote[] = []
    for (
      let i = this.currentIndex;
      i < song.notes.length && song.notes[i].time === firstUpcomingNote.time;
      i++
    ) {
      upcomingNotes.push(song.notes[i])
    }

    return upcomingNotes
  }

  setWait(wait: boolean) {
    this.wait = wait
  }

  isPlaying() {
    return this.store.get(this.state) === 'Playing'
  }

  async setSong(song: Song, songConfig: SongConfig) {
    this.stop()
    this.resetMetronome()
    this.store.set(this.song, song)
    this.trackConfigs = songConfig.tracks
    this.songHands = getHands(songConfig)
    this.store.set(this.state, 'CannotPlay')

    await trackAudioEngine.setSongTracks(song.tracks, songConfig.tracks)
    this.store.set(this.state, 'Paused')
    this.wait = songConfig.waiting
  }

  setVolume(vol: number) {
    if (vol > 0) {
      this.lastNonZeroVolume = vol
    }
    this.store.set(this.volume, vol)
    trackAudioEngine.setMasterVolume(vol)
    const backingTrack = this.getSong()?.backing
    if (backingTrack) {
      backingTrack.volume = 0.15 * vol
    }
  }

  setInstrumentVolume(vol: number) {
    if (vol > 0) {
      this.lastNonZeroInstrumentVolume = vol
    }
    this.store.set(this.instrumentVolume, vol)
    trackAudioEngine.setKeyboardVolume(vol)
  }

  setBackgroundVolume(vol: number) {
    if (vol > 0) {
      this.lastNonZeroBackgroundVolume = vol
    }
    this.store.set(this.backgroundVolume, vol)
    trackAudioEngine.setBackgroundVolume(vol)
  }

  setBackgroundTracks(trackIds: number[]) {
    trackAudioEngine.setBackgroundTracks(trackIds)
  }

  toggleMute() {
    const currentVol = this.store.get(this.volume)
    const currentInstVol = this.store.get(this.instrumentVolume)
    const currentBgVol = this.store.get(this.backgroundVolume)
    if (currentVol === 0 && currentInstVol === 0 && currentBgVol === 0) {
      this.setVolume(this.lastNonZeroVolume || 0.3)
      this.setInstrumentVolume(this.lastNonZeroInstrumentVolume || 1)
      this.setBackgroundVolume(this.lastNonZeroBackgroundVolume || 0.8)
    } else {
      this.setVolume(0)
      this.setInstrumentVolume(0)
      this.setBackgroundVolume(0)
    }
  }

  setTrackVolume(track: number | string, vol: number) {
    trackAudioEngine.setTrackVolume(+track, vol)
  }

  async setTrackInstrument(track: number | string, instrument: InstrumentName) {
    await trackAudioEngine.setTrackInstrument(+track, instrument)
  }

  isActiveHand(note: SongNote) {
    const config = this.trackConfigs[note.track]
    if (!config || !config.practice) {
      return false
    }

    if (this.hand === 'both') {
      return true
    }

    return config.hand === this.hand
  }

  getTime() {
    const offset = 0 // getAudioContext().outputLatency
    const song = this.getSong()
    if (!song) {
      return 0
    }

    if (song?.backing) {
      return song.backing.currentTime
    }

    if (!this.isPlaying()) {
      return Math.max(0, this.currentSongTime - offset)
    }

    if (this.wait && !isHitNote(this, song.notes[this.currentIndex])) {
      return this.currentSongTime - offset
    }

    const now = performance.now()
    const dt = now - this.lastIntervalFiredTime
    return Math.max(0, this.currentSongTime + dt / 1000 - offset)
  }

  getBpm() {
    return this.currentBpm
  }

  increaseBpm() {
    const delta = 0.05
    this.store.set(this.bpmModifier, round(this.store.get(this.bpmModifier) + delta, 2))
    const backingTrack = this.getSong()?.backing
    if (backingTrack) {
      backingTrack.playbackRate = this.store.get(this.bpmModifier)
    }
  }

  decreaseBpm() {
    const delta = 0.05
    this.store.set(this.bpmModifier, round(this.store.get(this.bpmModifier) - delta, 2))
    const backingTrack = this.getSong()?.backing
    if (backingTrack) {
      backingTrack.playbackRate = this.store.get(this.bpmModifier)
    }
  }

  getBpmModifier() {
    return this.bpmModifier
  }

  setHand(hand: any) {
    this.hand = hand
  }

  getBpmIndexForTime(time: number) {
    const song = this.getSong()
    if (!song) {
      return 0
    }

    const index = song.bpms.findIndex((m) => m.time > time) - 1
    if (index < 0) {
      return song.bpms.length - 1
    }
    return index
  }

  getMeasureForTime(time: number): SongMeasure {
    const song = this.getSong()
    if (!song) {
      return { type: 'measure', number: 0, duration: 0, time: 0 }
    }

    let index = song.measures.findIndex((m) => m.time > time) - 1
    if (index < 0) {
      index = song.measures.length - 1
    }
    return song.measures[index]
  }

  isCountingDown() {
    return this.store.get(this.countdown) !== null
  }

  cancelCountdown() {
    this.countdownTimers.forEach((timer) => clearTimeout(timer))
    this.countdownTimers = []
    this.store.set(this.countdown, null)
  }

  skipCountdown() {
    this.cancelCountdown()
    this.startPlayback_()
  }

  startCountdown_() {
    this.cancelCountdown()
    trackAudioEngine.ensureAudioContextRunning()

    const currentBpm = this.store.get(this.currentBpm) || 120
    const beatIntervalMs = (60 / currentBpm) * 1000

    // Beat 3 (Immediately upon trigger)
    this.store.set(this.countdown, 3)
    playCountdownClick(true)

    // Beat 2 (at 1 * beatIntervalMs)
    const t1 = setTimeout(() => {
      this.store.set(this.countdown, 2)
      playCountdownClick(false)
    }, beatIntervalMs)
    this.countdownTimers.push(t1)

    // Beat 1 (at 2 * beatIntervalMs)
    const t2 = setTimeout(() => {
      this.store.set(this.countdown, 1)
      playCountdownClick(false)
    }, beatIntervalMs * 2)
    this.countdownTimers.push(t2)

    // Beat 0 (Launch playback at 3 * beatIntervalMs at exact downbeat)
    const t3 = setTimeout(() => {
      this.store.set(this.countdown, null)
      this.countdownTimers = []
      this.startPlayback_()
    }, beatIntervalMs * 3)
    this.countdownTimers.push(t3)
  }

  play(options?: { forceCountIn?: boolean; skipCountIn?: boolean }) {
    if (this.isCountingDown()) {
      this.skipCountdown()
      return
    }

    if (this.isPlaying() || this.store.get(this.state) === 'CannotPlay') {
      return
    }

    // If at the end of the song, restart it
    if (this.currentSongTime >= this.getDuration()) {
      this.seek(0)
    }

    const range = this.store.get(this.range)
    const atStartOfSong = this.currentSongTime <= 0.05
    const atStartOfRange = range ? Math.abs(this.currentSongTime - range[0]) <= 0.05 : false

    const shouldCountIn =
      !options?.skipCountIn && (options?.forceCountIn || atStartOfSong || atStartOfRange)

    if (shouldCountIn) {
      this.startCountdown_()
    } else {
      this.startPlayback_()
    }
  }

  startPlayback_() {
    if (this.isPlaying() || this.store.get(this.state) === 'CannotPlay') {
      return
    }

    trackAudioEngine.ensureAudioContextRunning()

    if (this.currentSongTime >= this.getDuration()) {
      this.seek(0)
    }

    const backingTrack = this.getSong()?.backing
    if (backingTrack) {
      backingTrack.volume = 0.15 * this.store.get(this.volume)
      backingTrack.play()
    }
    this.store.set(this.state, 'Playing')

    this.lastIntervalFiredTime = performance.now()
    this.playInterval = setInterval(() => this.playLoop_(), 1)
    // continue playing everything we were in the middle of, but at a lower vol
    this.playing.forEach((note) => this.playNote(note))
  }

  playNote(note: SongNote) {
    trackAudioEngine.playTrackNote(note.track, note.midiNote, note.velocity ?? 80)
  }

  playUserNote(midiNote: number, velocity = 127 / 2) {
    const keysVol = this.store.get(this.instrumentVolume)
    trackAudioEngine.setKeyboardVolume(keysVol)
    trackAudioEngine.playUserNote(midiNote, velocity)
  }

  stopUserNote(midiNote: number) {
    trackAudioEngine.stopUserNote(midiNote)
  }

  stopNote(note: SongNote) {
    trackAudioEngine.stopTrackNote(note.track, note.midiNote)
  }

  stopNotes(notes: Array<SongNote>) {
    notes.forEach((note) => this.stopNote(note))
  }

  updateTime_() {
    const backingTrack = this.getSong()?.backing
    if (backingTrack) {
      const audioCtx = getAudioContext() as any
      const outputLatency = audioCtx?.outputLatency || 0
      const newTime = backingTrack.currentTime + outputLatency
      this.currentSongTime = newTime
    }

    let dt = 0
    if (this.isPlaying()) {
      const now = performance.now()
      dt = (now - this.lastIntervalFiredTime) * this.store.get(this.bpmModifier)
      this.lastIntervalFiredTime = now
      this.currentSongTime += dt / 1000
    }

    return this.currentSongTime
  }

  playLoop_() {
    const song = this.getSong()
    if (!song) {
      return
    }

    const prevTime = this.currentSongTime
    let time = this.updateTime_()

    // If at the end of the song, stop playing or loop.
    if (this.currentSongTime >= this.getDuration()) {
      if (this.store.get(this.songLoop)) {
        this.pause()
        this.seek(0)
        this.resetStats_()
        this.play({ forceCountIn: true })
        return
      } else {
        this.currentIndex = song.notes.length
        this.pause()
        return
      }
    }

    // If a range is selected and you just got past it then zoom back
    const range = this.store.get(this.range)
    if (range) {
      let [start, stop] = range
      if (prevTime <= stop && stop <= time) {
        // If in progressive mode, check if we should advance instead of just looping
        if (this.store.get(this.progressiveMode)) {
          this.checkProgressiveAdvance_(stop)
        }
        this.pause()
        this.seek(start)
        this.resetStats_()
        this.play({ forceCountIn: true })
        return
      }
    }

    if (song.bpms[this.store.get(this.currentBpmIndex) + 1]?.time < time) {
      this.store.set(this.currentBpmIndex, increment)
    }
    const stillPlaying = (n: SongNote) => n.time + n.duration > time

    // Look ahead: collect track+pitch combos that start this tick so we don't
    // send a note-off that would immediately cut off the incoming note-on for
    // the same pitch (consecutive same-pitch notes audio gap fix).
    const startingNoteKeys = new Set<string>()
    {
      let lookIdx = this.currentIndex
      while (
        lookIdx >= 0 &&
        lookIdx < song.notes.length &&
        song.notes[lookIdx].time < time
      ) {
        const n = song.notes[lookIdx]
        startingNoteKeys.add(`${n.track}:${n.midiNote}`)
        lookIdx++
      }
    }

    this.stopNotes(
      this.playing.filter(
        (n) => !stillPlaying(n) && !startingNoteKeys.has(`${n.track}:${n.midiNote}`),
      ),
    )
    this.playing = this.playing.filter(stillPlaying)

    // Play metronome sounds
    const latestMetronomeTick = this.getLatestMetronomeTick(time)

    if (this.metronomeLastPlayedTick !== latestMetronomeTick) {
      this.metronomeLastPlayedTick = latestMetronomeTick

      this.metronomeSynth.playNote(
        this.isMetronomeTickAccented(latestMetronomeTick) ? 90 : 75,
        this.store.get(this.metronomeVolume) * 127,
      )
    }

    // Update scoring details
    this.clearMissedNotes_()
    const heldNotes = this.playing.filter(
      (n) => this.midiPressedNotes.has(n.midiNote) && this.hitNotes.has(n),
    ).length
    if (heldNotes > 0) {
      this.store.set(this.score.durationHeld, (duration) => duration + heldNotes)
    }

    while (
      this.currentIndex >= 0 &&
      this.currentIndex < song.notes.length &&
      song.notes[this.currentIndex].time < time
    ) {
      const note = song.notes[this.currentIndex]

      if (this.isActiveHand(note)) {
        if (this.wait && !this.hitNotes.has(note)) {
          this.currentSongTime = note.time
          return
        } else if (!this.hitNotes.has(note) && prevTime < note.time) {
          // Only mark as late during the tick in which it is first played.
          const list = this.lateNotes.get(note.midiNote) || []
          if (!list.includes(note)) {
            list.push(note)
            this.lateNotes.set(note.midiNote, list)
          }
        }
      }
      this.playing.push(note)
      if (!this.skipMissedNotes || !this.isActiveHand(note) || isHitNote(this, note)) {
        this.playNote(note)
      }
      this.currentIndex++
    }
  }

  getLatestMetronomeTick(time: number) {
    const song = this.getSong()
    if (!song) {
      return 0
    }

    const ticksPerBeat = song.ppq * (4 / (song.timeSignature?.denominator ?? 4))
    const ticksPerMetronome = ticksPerBeat / this.store.get(this.metronomeSpeed)
    const currentTick = song.secondsToTicks(time)

    return Math.trunc(currentTick / ticksPerMetronome) * ticksPerMetronome
  }

  isMetronomeTickAccented(tick: number) {
    const song = this.getSong()
    if (!song) {
      return false
    }
    const beatsPerMeasure = song.timeSignature?.numerator ?? 4
    const ticksPerBeat = song.ppq * (4 / (song.timeSignature?.denominator ?? 4))

    return (
      this.store.get(this.metronomeEmphasizeFirst) && (tick / ticksPerBeat) % beatsPerMeasure === 0
    )
  }

  toggle() {
    if (this.isCountingDown()) {
      this.skipCountdown()
      return
    }
    if (this.isPlaying()) {
      this.pause()
      return
    }
    this.play()
  }

  recordSessionScoreSnapshot() {
    const song = this.getSong()
    if (!song) return

    const songId = (song as any).id || (song as any).meta?.id || 'current_song'
    const songTitle = (song as any).title || (song as any).meta?.title || 'Untitled Song'

    const perfect = this.store.get(this.score.perfect)
    const early = this.store.get(this.score.early)
    const late = this.store.get(this.score.late)
    const missed = this.store.get(this.score.missed)
    const error = this.store.get(this.score.error)
    const accuracy = this.store.get(this.score.accuracy)

    const playedNotes = song.notes.filter((n) => n.durationScore !== undefined)
    const avgDuration =
      playedNotes.length > 0
        ? playedNotes.reduce((acc, n) => acc + (n.durationScore || 0), 0) / playedNotes.length
        : 0

    sessionScoreHistory.addRecord({
      id: `${songId}_${Date.now()}`,
      songId,
      songTitle,
      timestamp: Date.now(),
      perfect,
      early,
      late,
      missed,
      error,
      accuracy,
      averageDurationScore: Math.round(avgDuration * 100) / 100,
      streakMax: this.store.get(this.score.streak),
    })
  }

  pause() {
    if (this.isCountingDown()) {
      this.cancelCountdown()
    }
    if (!this.isPlaying()) {
      return
    }
    this.recordSessionScoreSnapshot()
    this.store.set(this.state, 'Paused')
    clearInterval(this.playInterval)
    this.store.get(this.song)?.backing?.pause()
    this.playInterval = null
    this.stopAllSounds()
  }

  restart() {
    this.cancelCountdown()
    const range = this.store.get(this.range)
    if (range == null) {
      this.stop()
      this.play({ forceCountIn: true })
      return
    }
    const [start, _end] = range
    this.pause()
    this.seek(start)
    this.resetStats_()
    this.play({ forceCountIn: true })
  }

  stop() {
    this.pause()
    this.reset_()
  }

  reset_() {
    this.currentSongTime = 0
    this.currentIndex = 0
    this.playing = []
    this.lateNotes.clear()
    this.store.set(this.range, null)
    this.metronomeLastPlayedTick = null
    const backingTrack = this.store.get(this.song)?.backing
    if (backingTrack) {
      backingTrack.currentTime = 0
    }
    this.resetStats_()
  }

  resetStats_() {
    this.hitNotes.clear()
    this.missedNotes.clear()
    this.keyPressTimes.clear()
    this.lateNotes.clear()
    this.pressFeedback.clear()
    this.metronomeLastPlayedTick = null
    this.store.set(this.score.early, 0)
    this.store.set(this.score.late, 0)
    this.store.set(this.score.missed, 0)
    this.store.set(this.score.perfect, 0)
    this.store.set(this.score.error, 0)
    this.store.set(this.score.durationHeld, 0)
    this.store.set(this.score.streak, 0)
    const song = this.getSong()
    if (song) {
      song.notes.forEach((note) => {
        delete note.userPressStart
        delete note.userPressEnd
        delete note.feedbackColor
        delete note.durationScore
      })
    }
  }

  resetMetronome() {
    this.store.set(this.metronomeVolume, 0)
    this.store.set(this.metronomeSpeed, 1)
    this.store.set(this.metronomeEmphasizeFirst, false)
  }

  stopAllSounds() {
    trackAudioEngine.stopAllSounds()
  }

  seek(time: number) {
    const song = this.getSong()
    if (!song) {
      return
    }

    this.stopAllSounds()
    this.lateNotes.clear()
    this.pressFeedback.clear()
    this.currentSongTime = time
    if (song.backing) {
      song.backing.currentTime = time
    }
    this.playing = song.notes.filter((note) => {
      return note.time < this.currentSongTime && this.currentSongTime < note.time + note.duration
    })
    const idx = song.notes.findIndex((note) => note.time >= this.currentSongTime)
    this.currentIndex = idx === -1 ? song.notes.length : idx
    this.store.set(this.currentBpmIndex, this.getBpmIndexForTime(time))

    this.metronomeLastPlayedTick = this.getLatestMetronomeTick(time)
    if (this.metronomeLastPlayedTick == song.secondsToTicks(time)) {
      this.metronomeLastPlayedTick--
    }

    this.missedNotes.clear()
    this.hitNotes.clear()
    this.lateNotes.clear()
  }

  /* Convert between songtime and real human time. Includes bpm calculations*/
  getRealTimeDuration(starttime: number, endtime: number) {
    return endtime - starttime
  }

  getDuration() {
    return this.store.get(this.song)?.duration ?? 0
  }

  setRange(range?: { start: number; end: number }) {
    if (!range) {
      this.store.set(this.range, null)
      return
    }

    const { start, end } = range
    this.store.set(this.range, [Math.min(start, end), Math.max(start, end)])
  }

  getRange() {
    return this.range
  }

  skipToEnd() {
    const range = this.store.get(this.range)
    if (range) {
      this.seek(range[1])
    } else {
      this.seek(this.getDuration())
    }
  }

  /**
   * Seeks to previous measure:
   * - If in the middle of a measure, seek to the start of the current measure.
   * - If at the start of a measure, seek to the previous one
   */
  seekToPreviousMeasure() {
    const currMeasure = this.getMeasureForTime(this.getTime())
    if (currMeasure.number > 1) {
      if (currMeasure.time === this.getTime()) {
        // This assumes the measures are always in sorted order by time
        const currMeasureIdx = currMeasure.number - 1
        const prevMeasure = this.getSong()?.measures[currMeasureIdx - 1]
        if (prevMeasure) {
          this.seek(prevMeasure.time)
        }
      } else {
        this.seek(currMeasure.time)
      }
    }
  }

  /**
   * Seeks to the next measure's start if not at the last measure.
   */
  seekToNextMeasure() {
    const song = this.getSong()
    if (!song) {
      return
    }

    const currMeasure = this.getMeasureForTime(this.getTime())
    const currMeasureIdx = currMeasure.number - 1
    if (currMeasureIdx < song.measures.length - 1) {
      const nextMeasure = song.measures[currMeasureIdx + 1]
      this.seek(nextMeasure.time)
    }
  }

  checkProgressiveAdvance_(currentTime: number) {
    const song = this.getSong()
    if (!song) return

    const tracks = Object.keys(song.tracks)
      .map(Number)
      .sort((a, b) => a - b)
    const completed = this.store.get(this.completedTracks)

    // Find current active track (first one not in 'completed')
    const activeTrackId = tracks.find((id) => !completed.has(id))
    if (activeTrackId === undefined) return // All completed

    // Track is completed if we reached the end of its notes
    const trackNotes = song.notes.filter((n) => n.track === activeTrackId)
    const trackEnd = Math.max(...trackNotes.map((n) => n.time + n.duration), 0)

    if (currentTime >= trackEnd - 0.1) {
      const nextCompleted = new Set(completed)
      nextCompleted.add(activeTrackId)
      this.store.set(this.completedTracks, nextCompleted)

      // Update interactive practice to next track
      const nextTrackId = tracks.find((id) => !nextCompleted.has(id))
      if (nextTrackId !== undefined) {
        this.setupProgressiveRegion_(nextTrackId)
      }
    }
  }

  setupProgressiveRegion_(activeTrackId: number) {
    const song = this.getSong()
    if (!song) return

    const completed = this.store.get(this.completedTracks)

    // Set practice only for the active track
    Object.keys(song.tracks).forEach((idStr) => {
      const id = Number(idStr)
      if (this.trackConfigs[id]) {
        this.trackConfigs[id].practice = id === activeTrackId
        this.trackConfigs[id].sound = completed.has(id) || id === activeTrackId
      }
    })

    // Loop range should cover from beginning of first track to end of active track
    const allRelevantNotes = song.notes.filter(
      (n) => completed.has(n.track) || n.track === activeTrackId,
    )
    const start = Math.min(...allRelevantNotes.map((n) => n.time), 0)
    const end = Math.max(...allRelevantNotes.map((n) => n.time + n.duration), song.duration)

    this.setRange({ start, end })
    this.seek(start)
  }
}

export function isHitNote(player: Player, note?: SongNote) {
  if (!note) return false
  return player.hitNotes.has(note)
}

export function isMissedNote(player: Player, note?: SongNote) {
  if (!note) return false
  return player.missedNotes.has(note)
}
