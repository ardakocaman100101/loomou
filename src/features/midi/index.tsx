import { getAudioEffectsBus } from '@/features/synth/effects-bus'
import { getNote, isBlack, isWhite } from '@/features/theory'
import { MidiStateEvent } from '@/types'
import { isBrowser } from '@/utils'
import * as tonejs from '@tonejs/midi'
import { useRef, useState } from 'react'
import * as Tone from 'tone'

let globalMidiAccess: MIDIAccess | null = null

export async function getMidiInputs(): Promise<MIDIInputMap> {
  if (!isBrowser() || !window.navigator.requestMIDIAccess) {
    return new Map()
  }

  try {
    if (!globalMidiAccess) {
      globalMidiAccess = await window.navigator.requestMIDIAccess()
      globalMidiAccess.onstatechange = (e) => {
        if (e.port && e.port.type === 'input' && e.port.state === 'connected') {
          const device = e.port as MIDIInput
          if (
            !device.name?.toLowerCase().includes('through') &&
            !isInputMidiDeviceEnabled(device)
          ) {
            enableInputMidiDevice(device)
          }
        }
      }
    }
    return globalMidiAccess.inputs
  } catch (error) {
    console.error('Error accessing MIDI devices: ' + error)
    return new Map()
  }
}

export async function getMidiOutputs(): Promise<MIDIOutputMap> {
  if (!isBrowser() || !window.navigator.requestMIDIAccess) {
    return new Map()
  }

  try {
    if (!globalMidiAccess) {
      globalMidiAccess = await window.navigator.requestMIDIAccess()
      globalMidiAccess.onstatechange = (e) => {
        if (e.port && e.port.type === 'input' && e.port.state === 'connected') {
          const device = e.port as MIDIInput
          if (
            !device.name?.toLowerCase().includes('through') &&
            !isInputMidiDeviceEnabled(device)
          ) {
            enableInputMidiDevice(device)
          }
        }
      }
    }
    return globalMidiAccess.outputs
  } catch (error) {
    console.error('Error accessing MIDI devices: ' + error)
    return new Map()
  }
}

const enabledInputDevices: Map<string, MIDIInput> = new Map()
const enabledOutputDevices: Map<string, MIDIOutput> = new Map()

export function isInputMidiDeviceEnabled(device: MIDIInput) {
  return enabledInputDevices.has(device.id)
}
export function isOutputMidiDeviceEnabled(device: MIDIOutput) {
  return enabledOutputDevices.has(device.id)
}

export function enableInputMidiDevice(device: MIDIInput) {
  device.open()
  device.onmidimessage = onMidiMessage
  device.addEventListener('midimessage', onMidiMessage)
  enabledInputDevices.set(device.id, device)
  midiState.updateDetectedRange()
}
export function enableOutputMidiDevice(device: MIDIOutput) {
  device.open()
  enabledOutputDevices.set(device.id, device)
}

export function disableInputMidiDevice(deviceParam: MIDIInput) {
  const device = enabledInputDevices.get(deviceParam.id)
  if (!device) {
    return
  }
  device.removeEventListener('midimessage', onMidiMessage as any)
  device.close()
  enabledInputDevices.delete(device.id)
  midiState.updateDetectedRange()
}

export function disableOutputMidiDevice(deviceParam: MIDIOutput) {
  const device = enabledOutputDevices.get(deviceParam.id)
  if (!device) {
    return
  }
  device.removeEventListener('midimessage', onMidiMessage as any)
  device.close()
  enabledOutputDevices.delete(device.id)
}

export async function initializeMidi() {
  const inputs = await getMidiInputs()
  for (const device of inputs.values()) {
    if (device.name?.toLowerCase().includes('through')) {
      continue
    }
    if (!isInputMidiDeviceEnabled(device)) {
      enableInputMidiDevice(device)
    }
  }
  midiState.updateDetectedRange()
}

export type MidiEvent = {
  type: 'on' | 'off' | 'cc' | 'pitchbend'
  velocity?: number
  note?: number
  cc?: number
  value?: number
  timeStamp: number
  channel?: number
}

export function parseMidiMessage(event: MIDIMessageEvent): MidiEvent | null {
  const data = event.data!
  if (!data || data.length < 2) {
    return null
  }

  const status = data[0]
  const command = status >>> 4
  const channel = status & 0x0f

  // 0x8 = Note Off, 0x9 = Note On, 0xB = Control Change, 0xE = Pitch Bend
  if (command === 0x8 || command === 0x9) {
    return {
      type: command === 0x9 ? 'on' : 'off',
      note: data[1],
      velocity: data[2] ?? 0,
      timeStamp: event.timeStamp,
      channel,
    }
  }

  if (command === 0xb) {
    return {
      type: 'cc',
      cc: data[1],
      value: data[2] ?? 0,
      timeStamp: event.timeStamp,
      channel,
    }
  }

  if (command === 0xe) {
    // 14-bit Pitch Bend value (LSB: data[1], MSB: data[2])
    const lsb = data[1] ?? 0
    const msb = data[2] ?? 0
    const bendValue = (msb << 7) | lsb
    return {
      type: 'pitchbend',
      value: bendValue,
      timeStamp: event.timeStamp,
      channel,
    }
  }

  return null
}

// Sequence of all white notes on a standard 88-key piano (A0 = 21 to C8 = 108)
export const ALL_WHITE_MIDI: number[] = Array.from({ length: 88 }, (_, i) => i + 21).filter(isWhite)

// 11 Home row keys mapped to consecutive white keys
export const HOME_ROW_KEYS = [
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyF',
  'KeyG',
  'KeyH',
  'KeyJ',
  'KeyK',
  'KeyL',
  'Semicolon',
  'Quote',
]
export const HOME_ROW_LABELS = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'"]

// 10 Top row gap keys physically situated between the 11 home row keys
export const GAP_KEYS = [
  'KeyW',
  'KeyE',
  'KeyR',
  'KeyT',
  'KeyY',
  'KeyU',
  'KeyI',
  'KeyO',
  'KeyP',
  'BracketLeft',
]
export const GAP_LABELS = ['W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[']

let keyboardLayoutMap: Map<string, string> | null = null
if (isBrowser() && 'keyboard' in navigator && (navigator as any).keyboard?.getLayoutMap) {
  ;(navigator as any).keyboard
    .getLayoutMap()
    .then((map: Map<string, string>) => {
      keyboardLayoutMap = map
    })
    .catch(() => {})
}

export function hasConnectedMidiInputs(): boolean {
  return enabledInputDevices.size > 0
}

export function getKeyboardBadgeForNote(midiNote: number): string | null {
  const entry = midiState.activeMidiToBadge.get(midiNote)
  if (!entry) return null
  if (keyboardLayoutMap && keyboardLayoutMap.has(entry.code)) {
    const val = keyboardLayoutMap.get(entry.code)
    return val ? val.toUpperCase() : entry.defaultLabel
  }
  return entry.defaultLabel
}

export class MidiState {
  startWhiteIndex = 23 // Default index of C4 (60) in ALL_WHITE_MIDI
  activeCodeToMidi = new Map<string, number>()
  activeMidiToBadge = new Map<number, { code: string; defaultLabel: string }>()
  midiOctaveDiff = 0 // Deprecated: preserved at 0 for backward compatibility
  pressedNotes = new Map<number, { time: number; vel: number }>()
  keyPressedNotes = new Set<number>()
  listeners: Array<Function> = []
  detectedRange: { start: number; end: number } | null = null
  detectedKeySpan: number | null = null
  observedRange: { start: number; end: number } | null = null

  constructor() {
    this.rebuildDynamicMap()
  }

  getBaseMidiNote(): number {
    const safeIndex = Math.max(0, Math.min(ALL_WHITE_MIDI.length - 11, this.startWhiteIndex))
    return ALL_WHITE_MIDI[safeIndex] ?? 60
  }

  rebuildDynamicMap() {
    this.activeCodeToMidi.clear()
    this.activeMidiToBadge.clear()

    const maxStart = Math.max(0, ALL_WHITE_MIDI.length - 11)
    const safeStart = Math.max(0, Math.min(maxStart, this.startWhiteIndex))

    for (let i = 0; i < 11; i++) {
      const whiteMidi = ALL_WHITE_MIDI[safeStart + i]
      if (whiteMidi === undefined) continue

      const code = HOME_ROW_KEYS[i]
      const label = HOME_ROW_LABELS[i]
      this.activeCodeToMidi.set(code, whiteMidi)
      this.activeMidiToBadge.set(whiteMidi, { code, defaultLabel: label })

      // Check if there is a black key between white key i and white key i + 1
      if (i < 10) {
        const nextWhiteMidi = ALL_WHITE_MIDI[safeStart + i + 1]
        if (nextWhiteMidi !== undefined && nextWhiteMidi - whiteMidi === 2) {
          const blackMidi = whiteMidi + 1
          const blackCode = GAP_KEYS[i]
          const blackLabel = GAP_LABELS[i]
          this.activeCodeToMidi.set(blackCode, blackMidi)
          this.activeMidiToBadge.set(blackMidi, { code: blackCode, defaultLabel: blackLabel })
        }
      }
    }
  }

  anchorToSong(song: any) {
    if (!song) return
    const notes: Array<{ midiNote?: number; midi?: number }> = song.notes || song.items || []
    if (!Array.isArray(notes) || notes.length === 0) {
      this.rebuildDynamicMap()
      return
    }

    const pitches = notes
      .map((n) => n.midiNote ?? n.midi)
      .filter((p): p is number => typeof p === 'number' && p >= 21 && p <= 108)
      .sort((a, b) => a - b)

    if (pitches.length === 0) {
      this.rebuildDynamicMap()
      return
    }

    const median = pitches[Math.floor(pitches.length / 2)]
    const average = pitches.reduce((sum, p) => sum + p, 0) / pitches.length
    const minPitch = pitches[0]
    const maxPitch = pitches[pitches.length - 1]
    const songMidpoint = (minPitch + maxPitch) / 2

    const maxStart = Math.max(0, ALL_WHITE_MIDI.length - 11)
    let bestStartIndex = 23
    let bestScore = -Infinity

    for (let i = 0; i <= maxStart; i++) {
      const wStart = ALL_WHITE_MIDI[i]
      const wEnd = ALL_WHITE_MIDI[i + 10]
      const spanMin = wStart
      const spanMax = isBlack(wEnd + 1) ? wEnd + 1 : wEnd

      // Number of song notes covered inside this candidate keyboard span
      const coveredNotes = pitches.filter((p) => p >= spanMin && p <= spanMax).length
      const coverageRatio = coveredNotes / pitches.length

      const spanCenter = (spanMin + spanMax) / 2
      const distFromMedian = Math.abs(spanCenter - median)
      const distFromMidpoint = Math.abs(spanCenter - songMidpoint)
      const distFromAverage = Math.abs(spanCenter - average)

      // Score prioritizes covering the maximum amount of song notes, then centering
      const score =
        coverageRatio * 1000 -
        (distFromMedian * 2.0 + distFromMidpoint * 1.5 + distFromAverage * 1.0)

      if (score > bestScore) {
        bestScore = score
        bestStartIndex = i
      }
    }

    this.startWhiteIndex = bestStartIndex
    this.rebuildDynamicMap()
  }

  updateDetectedRange() {
    let min = 21
    let max = 108
    let found = false

    enabledInputDevices.forEach((device) => {
      const name = device.name?.toLowerCase() || ''
      if (name.includes('88') || name.includes('piano')) {
        min = 21 // A0
        max = 108 // C8
        found = true
      } else if (name.includes('61')) {
        min = 36 // C2
        max = 96 // C7
        found = true
      } else if (name.includes('49')) {
        min = 36 // C2
        max = 84 // C6
        found = true
      } else if (name.includes('mini') || name.includes('25')) {
        min = 48 // C3
        max = 72 // C5
        found = true
      }

      const digitMatch = name.match(/(\d+)(?=\D*$)/)
      if (!found && digitMatch) {
        const noteCount = parseInt(digitMatch[1], 10)
        if (noteCount === 25) {
          min = 48
          max = 72
          found = true
        } else if (noteCount === 32) {
          min = 45
          max = 76
          found = true
        } else if (noteCount === 49) {
          min = 36
          max = 84
          found = true
        } else if (noteCount === 61) {
          min = 36
          max = 96
          found = true
        } else if (noteCount === 76) {
          min = 24
          max = 97
          found = true
        } else if (noteCount === 88) {
          min = 21
          max = 108
          found = true
        }
      }
    })

    if (found) {
      this.detectedRange = { start: min, end: max }
      this.detectedKeySpan = max - min
    } else if (enabledInputDevices.size > 0) {
      this.detectedRange = this.observedRange ?? { start: 48, end: 72 }
      this.detectedKeySpan = 24
    } else if (this.observedRange) {
      this.detectedRange = this.observedRange
      this.detectedKeySpan = this.observedRange.end - this.observedRange.start
    } else {
      this.detectedRange = null
      this.detectedKeySpan = null
    }
  }

  handleKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null
    if (
      target &&
      (target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target.isContentEditable ||
        target.closest('input, textarea, select, [contenteditable="true"], dialog, [role="dialog"]'))
    ) {
      return
    }

    let { key, code, metaKey, ctrlKey, altKey } = e

    if (metaKey || ctrlKey || altKey) {
      return
    }

    if (key === 'ArrowUp') {
      e.preventDefault()
      this.startWhiteIndex = Math.min(ALL_WHITE_MIDI.length - 11, this.startWhiteIndex + 7)
      this.rebuildDynamicMap()
      this.keyPressedNotes.forEach((n) => this.release(n))
      this.keyPressedNotes.clear()
      return
    } else if (key === 'ArrowDown') {
      e.preventDefault()
      this.startWhiteIndex = Math.max(0, this.startWhiteIndex - 7)
      this.rebuildDynamicMap()
      this.keyPressedNotes.forEach((n) => this.release(n))
      this.keyPressedNotes.clear()
      return
    }

    const computedNote = this.activeCodeToMidi.get(code)
    if (computedNote === undefined) {
      return
    }

    e.preventDefault()
    e.stopPropagation()

    // Suppress repeated keydown from OS key repeat
    if (e.repeat) {
      return
    }

    if (computedNote >= 21 && computedNote <= 108) {
      this.keyPressedNotes.add(computedNote)
      this.press(computedNote, 85)
    }
  }

  handleKeyUp(e: KeyboardEvent) {
    const code = e.code
    const computedNote = this.activeCodeToMidi.get(code)
    if (computedNote !== undefined) {
      this.keyPressedNotes.delete(computedNote)
      this.release(computedNote)
    }
  }

  getListenerProps(): {
    onKeyDown: React.KeyboardEventHandler
    onKeyUp: React.KeyboardEventHandler
    tabIndex: number
  } {
    // Deprecated: listeners are now global
    return {
      onKeyDown: () => {},
      onKeyUp: () => {},
      tabIndex: -1,
    }
  }

  getPressedNotes(): ReadonlyMap<number, { time: number; vel: number }> {
    return this.pressedNotes
  }

  press(note: number, velocity: number, channel?: number) {
    const time = Date.now()
    this.pressedNotes.set(note, { time, vel: velocity })
    this.updateObservedRange(note)
    this.updateActiveOctaveRange(note)
    this.notify({ note, velocity, type: 'down', time, channel })
  }

  updateObservedRange(note: number) {
    const observedStart = this.observedRange?.start ?? note
    const observedEnd = this.observedRange?.end ?? note
    this.observedRange = {
      start: Math.min(observedStart, note),
      end: Math.max(observedEnd, note),
    }
  }

  updateActiveOctaveRange(note: number) {
    if (!this.detectedRange) {
      if (hasConnectedMidiInputs()) {
        const octaveStart = Math.floor(note / 12) * 12
        const span = this.detectedKeySpan ?? 24
        this.detectedRange = {
          start: Math.max(0, octaveStart),
          end: Math.min(127, octaveStart + span),
        }
        this.detectedKeySpan = span
      }
      return
    }

    const { start, end } = this.detectedRange
    if (note < start) {
      const octavesDown = Math.ceil((start - note) / 12)
      const shift = octavesDown * 12
      const newStart = Math.max(0, start - shift)
      const span = this.detectedKeySpan ?? (end - start)
      const newEnd = Math.min(127, newStart + span)
      this.detectedRange = { start: newStart, end: newEnd }
    } else if (note > end) {
      const octavesUp = Math.ceil((note - end) / 12)
      const shift = octavesUp * 12
      const newEnd = Math.min(127, end + shift)
      const span = this.detectedKeySpan ?? (end - start)
      const newStart = Math.max(0, newEnd - span)
      this.detectedRange = { start: newStart, end: newEnd }
    }
  }
  pressOutput(note: number, volume: number) {
    for (const output of enabledOutputDevices) {
      const midiNoteOnCh1 = 144
      const velocity = volume * 127
      var data = [midiNoteOnCh1, note, velocity]
      output[1]?.send(data)
    }
  }

  release(note: number, channel?: number) {
    this.pressedNotes.delete(note)
    this.notify({ note, type: 'up', time: Date.now(), channel })
  }

  releaseOutput(note: number) {
    const midiNoteOffCh1 = 128
    for (const output of enabledOutputDevices) {
      var data = [midiNoteOffCh1, note, 127]
      output[1]?.send(data)
    }
  }

  notify(e: MidiStateEvent) {
    this.listeners.forEach((fn) => fn(e))
  }

  subscribe(cb: (e: MidiStateEvent) => void) {
    this.listeners.push(cb)
  }

  unsubscribe(cb: Function) {
    let i = this.listeners.indexOf(cb)
    if (i !== -1) {
      this.listeners.splice(i, 1)
    }
  }
}

const midiState = new MidiState()

// Global PC Keyboard listeners
if (isBrowser()) {
  window.addEventListener('keydown', (e) => midiState.handleKeyDown(e))
  window.addEventListener('keyup', (e) => midiState.handleKeyUp(e))
}

export function onMidiMessage(e: MIDIMessageEvent) {
  if (isBrowser() && Tone.getContext().state !== 'running') {
    Tone.start()
  }

  const msg: MidiEvent | null = parseMidiMessage(e)
  if (!msg) {
    return
  }

  const { note, velocity, cc, value, type, channel } = msg

  if (type === 'on' && velocity! > 0) {
    midiState.press(note!, velocity!, channel)
  } else if (type === 'off' || (type === 'on' && velocity === 0)) {
    midiState.release(note!, channel)
  } else if (type === 'pitchbend' && value !== undefined) {
    const bus = getAudioEffectsBus()
    // value is 0 to 16383, 8192 is center
    const normalizedBend = (value - 8192) / 8192
    const semitones = normalizedBend * 12 // +/- 12 semitones pitch bend
    bus.setPitchBend(semitones)
  } else if (type === 'cc' && cc !== undefined && value !== undefined) {
    const bus = getAudioEffectsBus()
    // Relative vs Absolute Encoder check for Arturia MiniLab 3
    let isRelative = false
    let delta = 0
    if (value >= 61 && value <= 63) {
      isRelative = true
      delta = -(64 - value) * 0.04
    } else if (value >= 65 && value <= 67) {
      isRelative = true
      delta = (value - 64) * 0.04
    } else if (value === 127) {
      isRelative = true
      delta = -0.04
    } else if (value === 1) {
      isRelative = true
      delta = 0.04
    }

    const valRatio = value / 127
    const state = bus.getState()

    // Arturia MiniLab 3 & Standard Hardware CC mapping matrix:
    switch (cc) {
      // --- KNOB 1 (Top-Left): CUTOFF FREQUENCY (20Hz to 20000Hz) ---
      case 86: // MiniLab 3 Knob 1 (DAW Mode)
      case 74: // Standard Brightness / Cutoff
      case 16: // MiniLab 3 User Knob 1
      case 20: // General Purpose 1
      case 1: // Mod Wheel
        if (isRelative) {
          const curLog = Math.log10(state.cutoff)
          const newLog = Math.max(Math.log10(20), Math.min(Math.log10(20000), curLog + delta * 0.4))
          bus.setCutoff(Math.pow(10, newLog))
        } else {
          bus.setCutoff(20 * Math.pow(1000, valRatio))
        }
        break

      // --- KNOB 2 (Top-Right): DISTORTION AMOUNT (0 to 1) ---
      case 87: // MiniLab 3 Knob 2 (DAW Mode)
      case 71: // Sound Controller 2
      case 17: // MiniLab 3 User Knob 2
      case 21: // General Purpose 2
      case 13:
      case 70:
        if (isRelative) {
          bus.setDistortion(Math.max(0, Math.min(1, state.distortion + delta)))
        } else {
          bus.setDistortion(valRatio)
        }
        break

      // --- KNOB 3 (UI Bottom-Left): BASS BOOST (0 to 12 dB) ---
      // Triggered EXCLUSIVELY by MiniLab 3 Physical Knob 5 (CC 110 / 90 / 80 / 18)
      case 110: // MiniLab 3 Knob 5 (Bottom 1st / Under 1st Knob)
      case 90: // MiniLab 3 Knob 5 Alternate
      case 80: // MiniLab 3 Knob 5 User
      case 18:
      case 22:
        if (isRelative) {
          bus.setBassBoost(Math.max(0, Math.min(12, state.bassBoost + delta * 12)))
        } else {
          bus.setBassBoost(valRatio * 12)
        }
        break

      // --- KNOB 4 (UI Bottom-Right): DELAY TIME (0.01s to 1.0s) ---
      // Triggered EXCLUSIVELY by MiniLab 3 Physical Knob 6 (CC 111 / 93 / 81 / 19)
      case 111: // MiniLab 3 Knob 6 (Bottom 2nd / Under 2nd Knob)
      case 93: // MiniLab 3 Knob 6 Alternate
      case 81: // MiniLab 3 Knob 6 User
      case 19:
      case 23:
      case 12:
        if (isRelative) {
          bus.setDelayTime(Math.max(0.01, Math.min(1.0, state.delayTime + delta)))
        } else {
          bus.setDelayTime(0.01 + valRatio * 0.99)
        }
        break

      // --- FADER 1: VOLUME OUTPUT (0 to 1.2) ---
      case 82: // MiniLab 3 Fader 1 / Slider 1 (DAW Mode)
      case 73: // MiniLab 3 Sound Controller 4
      case 7: // Channel Volume
      case 14:
      case 24:
        if (isRelative) {
          bus.setVolume(Math.max(0, Math.min(1.2, state.volume + delta * 1.2)))
        } else {
          bus.setVolume(valRatio * 1.2)
        }
        break

      // --- FADER 2: REVERB MIX (0 to 1) ---
      case 83: // MiniLab 3 Fader 2 / Slider 2 (DAW Mode)
      case 75: // MiniLab 3 Sound Controller 6
      case 91: // Reverb Depth
      case 15:
      case 25:
        if (isRelative) {
          bus.setReverbMix(Math.max(0, Math.min(1, state.reverbMix + delta)))
        } else {
          bus.setReverbMix(valRatio)
        }
        break

      // --- FADER 3: DELAY MIX (0 to 1) ---
      case 84: // MiniLab 3 Fader 3 / Slider 3 (DAW Mode)
      case 79: // MiniLab 3 Sound Controller 10
      case 92: // Tremolo / Delay Depth
      case 26:
      case 30:
        if (isRelative) {
          bus.setDelayMix(Math.max(0, Math.min(1, state.delayMix + delta)))
        } else {
          bus.setDelayMix(valRatio)
        }
        break

      // --- FADER 4: FILTER RESONANCE (0.1 to 20 Q) ---
      case 85: // MiniLab 3 Fader 4 / Slider 4 (DAW Mode)
      case 72: // Sound Controller 3
      case 27:
      case 31:
        if (isRelative) {
          bus.setResonance(Math.max(0.1, Math.min(20, state.resonance + delta * 10)))
        } else {
          bus.setResonance(0.1 + valRatio * 19.9)
        }
        break

      default:
        break
    }

    midiState.notify({
      type: 'cc',
      cc,
      value,
      time: Date.now(),
      channel,
    })
  }
}

// This function doesn't yet handle notes left open when record was clicked. It
// should close those notes.
function midiEventsToMidi(events: MidiEvent[]) {
  const midi = new tonejs.Midi()
  const track = midi.addTrack()
  const openNotes = new Map<number, MidiEvent>()
  for (const event of events) {
    if (event.type === 'on') {
      openNotes.set(event.note!, event)
    } else if (event.type === 'off') {
      const start = openNotes.get(event.note!)
      if (!start) {
        continue
      }
      openNotes.delete(event.note!)
      const end = event
      track.addNote({
        midi: start.note!,
        time: start.timeStamp / 1000,
        duration: (end.timeStamp - start.timeStamp) / 1000,
        velocity: start.velocity!,
        noteOffVelocity: end.velocity!,
      })
    }
  }

  return midi.toArray()
}

export function record(midiState: MidiState) {
  const recording: MidiEvent[] = []
  // Offset times so first note in the recording occurs at ts=0
  let initialTime: number | null = null
  function listener(midiStateEvent: MidiStateEvent) {
    if (initialTime === null) {
      initialTime = midiStateEvent.time
    }
    const midiEvent: MidiEvent = {
      type: midiStateEvent.type === 'down' ? 'on' : 'off',
      velocity: midiStateEvent.velocity ?? 127,
      note: midiStateEvent.note,
      timeStamp: midiStateEvent.time - initialTime!,
    }
    recording.push(midiEvent)
  }
  midiState.subscribe(listener)
  return () => {
    midiState.unsubscribe(listener)
    if (recording.length > 0) {
      return midiEventsToMidi(recording)
    }
    return null
  }
}

export function useRecordMidi(state = midiState) {
  const [isRecording, setIsRecording] = useState(false)
  const recordCb = useRef<(() => Uint8Array | null) | null>(null)
  function startRecording() {
    setIsRecording(true)
    // Cleanup whatever recording was already happening
    if (recordCb.current) {
      recordCb.current?.()
    }
    recordCb.current = record(state)
  }
  function stopRecording() {
    setIsRecording(false)
    const midiBytes = recordCb.current?.() ?? new Uint8Array()
    recordCb.current = null
    return midiBytes
  }

  return { startRecording, stopRecording, isRecording }
}

// Call setup after midiState has been fully declared and instantiated
setupMidiDeviceListeners()

// Sets up listeners for all non-virtual MIDI input devices.
// Skips "through" ports (often used for routing/echo) to avoid feedback loops.
// Output devices are ignored by default and must be enabled manually.
async function setupMidiDeviceListeners() {
  await initializeMidi()
}

export default midiState
