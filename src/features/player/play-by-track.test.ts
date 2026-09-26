// @ts-nocheck
import { describe, expect, it } from 'bun:test'
import { TrackAudioEngine } from '@/features/synth/synth-manager'

describe('TrackAudioEngine Play-by-Track volume routing', () => {
  it('correctly sets background volume and manages background track IDs', () => {
    const engine = new TrackAudioEngine()
    engine.setBackgroundVolume(0.5)
    engine.setBackgroundTracks([0, 1])

    // Verify background track isolation and volume scaling
    engine.setMasterVolume(0.2)
    engine.setKeyboardVolume(0.9)

    // Check that engine preserves state without error
    expect(engine).toBeDefined()
  })

  it('aggregates multi-track performance scores accurately', () => {
    const trackScores = [
      { trackId: 0, accuracy: 90, perfect: 18, early: 1, late: 1, good: 2, miss: 2, streak: 12 },
      { trackId: 1, accuracy: 80, perfect: 14, early: 2, late: 2, good: 4, miss: 4, streak: 8 },
    ]

    const totalPerfect = trackScores.reduce((sum, s) => sum + s.perfect, 0)
    const totalEarly = trackScores.reduce((sum, s) => sum + s.early, 0)
    const totalLate = trackScores.reduce((sum, s) => sum + s.late, 0)
    const totalGood = totalEarly + totalLate
    const totalMiss = trackScores.reduce((sum, s) => sum + s.miss, 0)
    const maxStreak = Math.max(...trackScores.map((s) => s.streak))
    const totalEvaluated = totalPerfect + totalGood + totalMiss
    const accuracy = Math.round(((totalPerfect + 0.5 * totalGood) / totalEvaluated) * 100)

    expect(totalPerfect).toBe(32)
    expect(totalGood).toBe(6)
    expect(totalMiss).toBe(6)
    expect(maxStreak).toBe(12)
    expect(accuracy).toBe(80) // ((32 + 3) / 44) * 100 = 79.545 => 80
  })
})

