/**
 * falling-notes.ts — Orchestrator
 *
 * This file is intentionally thin: it handles state derivation and
 * coordinates the sub-renderers. All drawing logic lives in `./renderer/`.
 *
 * Sub-renderer map:
 *   background.ts  — dark gradient + noise pattern
 *   lanes.ts       — black-key lane strips, horizon fade, hit-line
 *   overlays.ts    — measure labels, practice-range selection
 *   note-renderer.ts — note capsule shape, gradient fill, labels, piano
 *   state.ts       — State type, projectPoint, getItemStartEnd
 *   colors.ts      — colour constants, memoised getRgbaColor
 */

import {
  getPianoRollMeasurements,
  type PianoRollMeasurements,
} from '@/features/drawing/piano'
import { isBlack } from '@/features/theory'
import type { SongNote } from '@/types'
import midiState from '../midi'
import type { GivenState } from './canvas-renderer'
import {
  type CanvasItem,
  getItemsInView,
  getSongRange,
  isMatchingHand,
  type Viewport,
} from './utils'
import { renderBackground } from './renderer/background'
import { renderHitLine, renderHorizonFade, renderLanes } from './renderer/lanes'
import { renderMeasure, renderRange } from './renderer/overlays'
import { renderFallingNote, renderPiano } from './renderer/note-renderer'
import { getItemStartEnd, type State } from './renderer/state'
import { computeTrackPitchRanges } from './renderer/trackColors'

// ---------------------------------------------------------------------------
// Viewport
// ---------------------------------------------------------------------------

function getViewport(state: Readonly<GivenState>): Viewport {
  return {
    start: state.time * state.pps,
    end: state.time * state.pps + state.height,
  }
}

// ---------------------------------------------------------------------------
// State derivation
// ---------------------------------------------------------------------------

// Track last BPM-derived tolerance values so we only call setTolerance when
// the effective BPM actually changes — not 60 times per second.
let lastPerfectRangeMs = -1
let lastGoodRangeMs = -1

// Retained reference used by intersectsWithPiano (exported for touchscroll.ts)
let lastState: State | null = null

function deriveState(givenState: GivenState): State {
  let items = givenState.constrictView ? givenState.items : undefined
  let startNote: number
  let endNote: number

  if (givenState.visualization === 'reverse-waterfall') {
    const range = midiState.detectedRange
    if (range) {
      startNote = range.start
      endNote = range.end
    } else {
      // Automatic 3 octaves (C3 to C6: MIDI 48 to 84) when no MIDI device is connected
      startNote = 48
      endNote = 84
    }
    midiState.midiOctaveDiff = 0
  } else {
    const matchingNotes: SongNote[] = items
      ? (items.filter(
          (i) => i.type === 'note' && isMatchingHand(i, givenState),
        ) as SongNote[])
      : []

    const notesForRange =
      matchingNotes.length > 0
        ? matchingNotes
        : items
          ? (items.filter((i) => i.type === 'note') as SongNote[])
          : ([{ midiNote: 21 }, { midiNote: 108 }] as SongNote[])

    const activePracticeTracks = Object.values(givenState.hands || {}).filter(
      (t) => t.practice,
    )
    const isSingleTrackSelected =
      activePracticeTracks.length === 1 ||
      (givenState.hands && Object.keys(givenState.hands).length === 1)

    let minNotes = givenState.zoomMode ?? 0
    if (givenState.zoomMode === undefined) {
      if (isSingleTrackSelected) {
        minNotes = 12
      } else if (givenState.height > givenState.windowWidth) {
        if (givenState.height > 800) minNotes = 48
        else if (givenState.height > 600) minNotes = 36
        else minNotes = 24
      } else {
        minNotes = Math.min(36, Math.max(16, Math.floor(givenState.windowWidth / 28)))
      }
    }

    const { startNote: songStart, endNote: songEnd } = getSongRange(
      { notes: notesForRange },
      minNotes,
    )
    const instrumentRange = midiState.detectedRange
    const range = getKeyboardRange(songStart, songEnd, instrumentRange)
    startNote = range.startNote
    endNote = range.endNote
  }

  const pianoMeasurements = getPianoRollMeasurements(givenState.windowWidth, {
    startNote,
    endNote,
  })
  const pianoTopY = Math.max(
    0,
    givenState.height - pianoMeasurements.whiteHeight - 65,
  )
  const pianoWidth = pianoMeasurements.pianoWidth
  const noteHitY = pianoTopY - 120

  // Adaptive timing tolerance — only update when effective BPM changes
  const song = givenState.player.getSong()
  const currentBpm =
    song?.bpms?.[givenState.player.store.get(givenState.player.currentBpmIndex)]?.bpm || 120
  const bpmModifier = givenState.player.store.get(givenState.player.bpmModifier) || 1
  const effectiveBpm = currentBpm * bpmModifier
  const beatDurationMs = (60 / Math.max(20, effectiveBpm)) * 1000
  const perfectRangeMs = Math.min(90, Math.max(40, beatDurationMs * 0.22))
  const goodRangeMs = Math.min(350, Math.max(120, beatDurationMs * 0.5))

  if (perfectRangeMs !== lastPerfectRangeMs || goodRangeMs !== lastGoodRangeMs) {
    lastPerfectRangeMs = perfectRangeMs
    lastGoodRangeMs = goodRangeMs
    givenState.player.setTolerance(perfectRangeMs, goodRangeMs)
  }

  const allSongNotes: SongNote[] = givenState.items
    ? (givenState.items.filter((i) => i.type === 'note') as SongNote[])
    : []
  const trackPitchRanges = computeTrackPitchRanges(allSongNotes)

  lastState = {
    ...givenState,
    pianoMeasurements,
    viewport: getViewport(givenState),
    pianoTopY,
    pianoWidth,
    noteHitY,
    trackPitchRanges,
  }
  return lastState
}

// ---------------------------------------------------------------------------
// Keyboard range calculation
// ---------------------------------------------------------------------------

export function getKeyboardRange(
  songStart: number,
  songEnd: number,
  _instrumentRange?: { start: number; end: number } | null,
) {
  midiState.midiOctaveDiff = 0

  let start = Math.floor(songStart / 12) * 12
  let end = Math.ceil(songEnd / 12) * 12

  if (end - start < 12) end = start + 12

  start = Math.max(21, start)
  end = Math.min(108, end)

  return { startNote: start, endNote: end }
}

// ---------------------------------------------------------------------------
// Items in view
// ---------------------------------------------------------------------------

function getFallingNoteItemsInView(state: State): CanvasItem[] {
  if (state.visualization === 'reverse-waterfall') {
    return state.items.filter((item) => {
      if (item.type !== 'note') return false
      const isStarted = item.time <= state.time
      const isVisible = getItemStartEnd(item, state).end >= -state.height
      return isStarted && isVisible
    })
  }
  const startPred = (item: CanvasItem) =>
    getItemStartEnd(item, state).end <= state.height
  const endPred = (item: CanvasItem) =>
    getItemStartEnd(item, state).start < -state.height * 2.5
  return getItemsInView(state, startPred, endPred)
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function renderFallingVis(givenState: GivenState): void {
  const state: State = deriveState(givenState)

  // 1. Background
  renderBackground(state)

  // 2. Items in view
  const items = getFallingNoteItemsInView(state)

  // 3. Environment
  renderLanes(state)
  renderHitLine(state)

  // 4. Measure markers
  for (const i of items) {
    if (i.type === 'measure') renderMeasure(i, state)
  }

  // 5. Determine which notes are active targets (next up to hit)
  const activeTargets = new Set<SongNote>()
  const margin = state.player.goodRange / 1000
  const seenPitches = new Set<number>()
  for (const i of items) {
    if (i.type === 'note' && !seenPitches.has(i.midiNote)) {
      if (state.time <= i.time + i.duration + margin) {
        activeTargets.add(i)
        seenPitches.add(i.midiNote)
      }
    }
  }

  // 6. Notes
  for (const i of items) {
    if (i.type === 'note') renderFallingNote(i, state, activeTargets.has(i))
  }

  // 7. Practice range overlay
  if (state.selectedRange) renderRange(state)

  // 8. Horizon fade (on top of notes, below piano)
  renderHorizonFade(state)

  // 9. Finger guides on active notes
  const activeFingerings = new Map<number, number>()
  const perfectRangeSec = ((Math.min(40 / 2, 250 / 2) / state.pps) * 1000 * 1.5) / 1000
  for (const item of items) {
    if (item.type === 'note' && item.finger !== undefined) {
      const n = item as SongNote
      if (state.time >= n.time - perfectRangeSec && state.time <= n.time + n.duration) {
        activeFingerings.set(n.midiNote, n.finger!)
      }
    }
  }

  // 10. Piano keyboard
  renderPiano(state, activeFingerings)
}

// ---------------------------------------------------------------------------
// Exported utility (used by touchscroll.ts)
// ---------------------------------------------------------------------------

export function intersectsWithPiano(
  point: { x: number; y: number },
  canvasRect: DOMRect,
): boolean {
  if (!lastState) return false
  const relativeY = point.y - canvasRect.top
  return relativeY >= lastState.pianoTopY
}
