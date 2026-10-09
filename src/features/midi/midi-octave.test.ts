// @ts-nocheck
import { describe, expect, it, beforeEach } from 'bun:test'
import midiState, { MidiState, onMidiMessage, parseMidiMessage } from './index'
import { getKeyboardRange } from '../SongVisualization/falling-notes'

describe('BUG-31: External MIDI Keyboards Octave Transposition & Dynamic Adaptation', () => {
  beforeEach(() => {
    // Reset state
    midiState.pressedNotes.clear()
    midiState.keyPressedNotes.clear()
    midiState.observedRange = null
    midiState.detectedRange = null
    midiState.detectedKeySpan = null
    midiState.midiOctaveDiff = 0
  })

  it('TC-01: 1:1 True Pitch Input - onMidiMessage preserves exact hardware pitch without artificial octave shift', () => {
    const receivedEvents: Array<{ note?: number; velocity?: number; type: string }> = []
    const listener = (e: any) => receivedEvents.push(e)
    midiState.subscribe(listener)

    try {
      // Simulate hardware MIDI event: physical C2 (note 36, velocity 90) on channel 1
      const midiEventOnC2 = {
        data: new Uint8Array([0x90, 36, 90]),
        timeStamp: 1000,
      } as unknown as MIDIMessageEvent

      onMidiMessage(midiEventOnC2)

      // Verify that pressed note is exactly 36 (not shifted to 48)
      expect(midiState.getPressedNotes().has(36)).toBe(true)
      expect(midiState.getPressedNotes().has(48)).toBe(false)
      expect(receivedEvents.length).toBe(1)
      expect(receivedEvents[0].note).toBe(36)
      expect(receivedEvents[0].type).toBe('down')

      // Simulate Note Off for C2
      const midiEventOffC2 = {
        data: new Uint8Array([0x80, 36, 0]),
        timeStamp: 1050,
      } as unknown as MIDIMessageEvent

      onMidiMessage(midiEventOffC2)
      expect(midiState.getPressedNotes().has(36)).toBe(false)
      expect(receivedEvents.length).toBe(2)
      expect(receivedEvents[1].note).toBe(36)
      expect(receivedEvents[1].type).toBe('up')
    } finally {
      midiState.unsubscribe(listener)
    }
  })

  it('TC-02: Hardware Octave Navigation - dynamic active octave shifts by exact 12-semitone steps', () => {
    // Set up a 25-key controller (span 24: C3 [48] to C5 [72])
    midiState.detectedRange = { start: 48, end: 72 }
    midiState.detectedKeySpan = 24

    // 1. Play note in current range (G4 = 67)
    midiState.press(67, 100)
    expect(midiState.detectedRange).toEqual({ start: 48, end: 72 })

    // 2. Musician shifts Octave Down on hardware and plays physical C2 (36)
    midiState.press(36, 100)
    // Range must adapt down by exactly 12 semitones to [36, 60] (C2 to C4)
    expect(midiState.detectedRange).toEqual({ start: 36, end: 60 })

    // 3. Musician plays another note in the lower octave (E2 = 40)
    midiState.press(40, 100)
    expect(midiState.detectedRange).toEqual({ start: 36, end: 60 })

    // 4. Musician shifts Octave Up on hardware twice and plays E5 (76)
    midiState.press(76, 100)
    // Range must adapt up by 12 semitones to [60, 84] (C4 to C6)
    expect(midiState.detectedRange).toEqual({ start: 60, end: 84 })

    // 5. Musician shifts Octave Up further and plays C#6 (85)
    midiState.press(85, 100)
    // Range must adapt up to [72, 96]
    expect(midiState.detectedRange).toEqual({ start: 72, end: 96 })
  })

  it('TC-03: Keyboard View Range - getKeyboardRange follows song range without user range overrides', () => {
    // Song notes are in octave C4 to C5 (60 to 72)
    const songStart = 60
    const songEnd = 72

    // Hardware controller starts at C3 to C5 (48 to 72)
    const instrumentRange = { start: 48, end: 72 }
    let range = getKeyboardRange(songStart, songEnd, instrumentRange)

    // Keyboard displays according to song range
    expect(range.startNote).toBe(60)
    expect(range.endNote).toBe(72)
    expect(midiState.midiOctaveDiff).toBe(0)
  })

  it('TC-04: parseMidiMessage handles raw Note On/Off bytes with 1:1 fidelity', () => {
    const noteOnEvent = {
      data: new Uint8Array([0x90, 48, 127]), // Channel 1, Note 48 (C3), velocity 127
      timeStamp: 1234,
    } as unknown as MIDIMessageEvent

    const parsedOn = parseMidiMessage(noteOnEvent)
    expect(parsedOn).not.toBeNull()
    expect(parsedOn?.type).toBe('on')
    expect(parsedOn?.note).toBe(48)
    expect(parsedOn?.velocity).toBe(127)

    const noteOffEvent = {
      data: new Uint8Array([0x80, 48, 64]), // Note off
      timeStamp: 1250,
    } as unknown as MIDIMessageEvent

    const parsedOff = parseMidiMessage(noteOffEvent)
    expect(parsedOff).not.toBeNull()
    expect(parsedOff?.type).toBe('off')
    expect(parsedOff?.note).toBe(48)
  })
})

