import { LoomouAiCharacter } from '@/components/LoomouAiCharacter'
import { CoachingPayload, generateAICoachingAdvice } from '@/features/ai/coaching'
import { usePlayer } from '@/features/player'
import { sessionScoreHistory } from '@/features/player/scoring'
import { detectPracticeSegmentAsync, PracticeSegment } from '@/features/theory/practice-detector'
import { formatTime } from '@/utils'
import { useAtomValue } from 'jotai'
import { Loader2, RotateCcw, Sparkles, Star, Target, Trophy, X } from 'lucide-react'
import React, { useEffect, useState } from 'react'

type CompletionModalProps = {
  isOpen: boolean
  onClose: () => void
  onReplay: () => void
  onPracticeRecommended?: (segment: PracticeSegment) => void
  aggregatedMetrics?: {
    accuracy: number
    perfect: number
    early: number
    late: number
    good: number
    miss: number
    streak: number
    trackCount: number
  } | null
}

export default function CompletionModal({
  isOpen,
  onClose,
  onReplay,
  onPracticeRecommended,
  aggregatedMetrics,
}: CompletionModalProps) {
  const player = usePlayer()
  const song = player.getSong()

  const [isCalculating, setIsCalculating] = useState(true)
  const [recommendedSegment, setRecommendedSegment] = useState<PracticeSegment | null>(null)

  const [isAiLoading, setIsAiLoading] = useState(true)
  const [aiFeedback, setAiFeedback] = useState<string | null>(null)
  const [displayedAiText, setDisplayedAiText] = useState('')

  // Typewriter effect when aiFeedback arrives
  useEffect(() => {
    if (!aiFeedback) {
      setDisplayedAiText('')
      return
    }

    setDisplayedAiText('')
    let idx = 0
    const timer = setInterval(() => {
      idx++
      setDisplayedAiText(aiFeedback.slice(0, idx))
      if (idx >= aiFeedback.length) {
        clearInterval(timer)
      }
    }, 20)

    return () => clearInterval(timer)
  }, [aiFeedback])

  const atomAccuracy = useAtomValue(player.score.accuracy)
  const atomPerfect = useAtomValue(player.score.perfect)
  const atomEarly = useAtomValue(player.score.early)
  const atomLate = useAtomValue(player.score.late)
  const atomMiss = useAtomValue(player.score.miss)
  const atomStreak = useAtomValue(player.score.streak)

  const accuracy = aggregatedMetrics ? aggregatedMetrics.accuracy : atomAccuracy
  const perfect = aggregatedMetrics ? aggregatedMetrics.perfect : atomPerfect
  const early = aggregatedMetrics ? aggregatedMetrics.early : atomEarly
  const late = aggregatedMetrics ? aggregatedMetrics.late : atomLate
  const miss = aggregatedMetrics ? aggregatedMetrics.miss : atomMiss
  const streak = aggregatedMetrics ? aggregatedMetrics.streak : atomStreak

  // 1. Independent Practice Segment Detection Effect
  useEffect(() => {
    if (!isOpen || !song || !player) {
      setIsCalculating(true)
      setRecommendedSegment(null)
      return
    }

    const abortController = new AbortController()
    setIsCalculating(true)

    const songDuration = player.getDuration()
    detectPracticeSegmentAsync(song.notes, songDuration, abortController.signal)
      .then((segment) => {
        if (!abortController.signal.aborted) {
          setRecommendedSegment(segment)
          setIsCalculating(false)
        }
      })
      .catch((err) => {
        if (!abortController.signal.aborted) {
          console.error('Failed to detect practice segment:', err)
          setIsCalculating(false)
        }
      })

    return () => {
      // Instantly stop background calculation if user closes or dismisses modal
      abortController.abort()
    }
  }, [isOpen, song, player])

  // 2. Independent AI Coaching Generation Effect
  useEffect(() => {
    if (!isOpen || !song || !player) {
      setIsAiLoading(true)
      setAiFeedback(null)
      return
    }

    const aiAbortController = new AbortController()
    setIsAiLoading(true)

    const songId = (song as any).id || (song as any).meta?.id || 'current_song'
    const historyRecords = sessionScoreHistory.getRecordsForSong(songId)

    // Calculate played note duration metrics for payload
    const playedNotes = song.notes.filter((n) => n.durationScore !== undefined)
    const currentDurationScore =
      playedNotes.length > 0
        ? Math.round(
            (playedNotes.reduce((acc, n) => acc + (n.durationScore || 0), 0) / playedNotes.length) *
              100,
          )
        : 0

    let totalTG = 0
    let totalTY = 0
    let totalTP = 0
    let totalTR = 0

    if (playedNotes.length > 0) {
      playedNotes.forEach((n) => {
        if (n.userPressStart !== undefined) {
          const tS = n.time
          const tE = n.time + n.duration
          const t1 = n.userPressStart
          const t2 = n.userPressEnd ?? (n.time + n.duration)

          totalTY += Math.max(0, tS - t1)
          totalTP += Math.max(0, t1 - tS)
          totalTR += Math.abs(t2 - tE)
          totalTG += Math.max(0, Math.min(t2, tE) - Math.max(t1, tS))
        }
      })
    }

    const grandTotalDuration = totalTG + totalTY + totalTP + totalTR
    const totalCount = Math.max(1, perfect + early + late + miss)
    const pctG = grandTotalDuration > 0 ? Math.round((totalTG / grandTotalDuration) * 100) : Math.round((perfect / totalCount) * 100)
    const pctY = grandTotalDuration > 0 ? Math.round((totalTY / grandTotalDuration) * 100) : Math.round((early / totalCount) * 100)
    const pctP = grandTotalDuration > 0 ? Math.round((totalTP / grandTotalDuration) * 100) : Math.round((late / totalCount) * 100)
    const pctR = grandTotalDuration > 0 ? Math.round((totalTR / grandTotalDuration) * 100) : Math.round((miss / totalCount) * 100)

    const payload: CoachingPayload = {
      sessionMeta: {
        songTitle: (song as any).title || (song as any).meta?.title || 'Unknown Song',
        difficulty: (song as any).difficulty || (song as any).meta?.difficulty || 'Medium',
        duration: Math.round(player.getDuration()),
        keySignature: String(song.keySignature || 'C'),
        timeSignature: song.timeSignature || { numerator: 4, denominator: 4 },
        bpm: Math.round(typeof player.currentBpm === 'number' ? player.currentBpm : 120),
        playbackSpeed: (player as any).getPlaybackSpeed ? (player as any).getPlaybackSpeed() : 1.0,
        activeTracks: aggregatedMetrics
          ? `Play by Track Session (${aggregatedMetrics.trackCount} Tracks Aggregated)`
          : Object.keys(song.tracks || {}).length > 1
            ? 'Multiple Tracks'
            : 'Solo Track',
      },
      hitMetrics: {
        accuracy,
        streak,
        perfect,
        early,
        late,
        miss,
      },
      durationBreakdown: {
        durationScore: currentDurationScore,
        pctG,
        pctY,
        pctP,
        pctR,
      },
      history: {
        attemptCount: historyRecords.length + 1,
        durationScoreTrend: [
          ...historyRecords.map((r) => Math.round(r.averageDurationScore * 100)),
          currentDurationScore,
        ].slice(-6),
      },
    }

    generateAICoachingAdvice(payload, aiAbortController.signal)
      .then((advice) => {
        if (!aiAbortController.signal.aborted) {
          setAiFeedback(advice)
          setIsAiLoading(false)
        }
      })
      .catch((err) => {
        if (!aiAbortController.signal.aborted) {
          console.error('Failed generating AI coaching advice:', err)
          setIsAiLoading(false)
        }
      })

    return () => {
      // Instantly cancel AI feedback generation if modal is closed
      aiAbortController.abort()
    }
  }, [isOpen, song, player, accuracy, perfect, early, late, miss, streak, aggregatedMetrics])

  if (!isOpen || !song) return null

  const songId = (song as any).id || (song as any).meta?.id || 'current_song'

  // Get session history records for this song
  const historyRecords = sessionScoreHistory.getRecordsForSong(songId)

  // Calculate average duration score for current run
  const playedNotes = song.notes.filter((n) => n.durationScore !== undefined)
  const currentDurationScore =
    playedNotes.length > 0
      ? Math.round(
          (playedNotes.reduce((acc, n) => acc + (n.durationScore || 0), 0) / playedNotes.length) *
            100,
        )
      : 0

  // Calculate composite duration metrics (tG, tY, tP, tR) across played notes
  let totalTG = 0
  let totalTY = 0
  let totalTP = 0
  let totalTR = 0

  if (playedNotes.length > 0) {
    playedNotes.forEach((n) => {
      if (n.userPressStart !== undefined) {
        const tS = n.time
        const tE = n.time + n.duration
        const t1 = n.userPressStart
        const t2 = n.userPressEnd ?? (n.time + n.duration)

        const tY = Math.max(0, tS - t1)
        const tP = Math.max(0, t1 - tS)
        const tR = Math.abs(t2 - tE)
        const tG = Math.max(0, Math.min(t2, tE) - Math.max(t1, tS))

        totalTG += tG
        totalTY += tY
        totalTP += tP
        totalTR += tR
      }
    })
  }

  const grandTotalDuration = totalTG + totalTY + totalTP + totalTR
  const totalCount = Math.max(1, perfect + early + late + miss)
  const pctG = grandTotalDuration > 0 ? (totalTG / grandTotalDuration) * 100 : (perfect / totalCount) * 100
  const pctY = grandTotalDuration > 0 ? (totalTY / grandTotalDuration) * 100 : (early / totalCount) * 100
  const pctP = grandTotalDuration > 0 ? (totalTP / grandTotalDuration) * 100 : (late / totalCount) * 100
  const pctR = grandTotalDuration > 0 ? (totalTR / grandTotalDuration) * 100 : (miss / totalCount) * 100

  const history = historyRecords.length > 0 ? historyRecords : []
  const maxDurationScore =
    history.length > 0
      ? Math.max(...history.map((h) => Math.round(h.averageDurationScore * 100)), currentDurationScore)
      : currentDurationScore

  // Prepare Session Duration History data points
  const rawHistory = history.length > 0
    ? [...history.map((h) => Math.round(h.averageDurationScore * 100)), currentDurationScore]
    : [currentDurationScore]
  const displayHistory = rawHistory.slice(-8)
  const chartHistory = displayHistory.length === 1 ? [displayHistory[0], displayHistory[0]] : displayHistory

  let minVal = Math.min(...chartHistory) - 4
  let maxVal = Math.max(...chartHistory) + 4
  if (minVal === maxVal) {
    minVal -= 5
    maxVal += 5
  }

  const chartPoints = chartHistory.map((val, idx) => ({
    x: (idx / (chartHistory.length - 1)) * 100,
    y: 100 - ((val - minVal) / (maxVal - minVal)) * 100,
    val,
  }))

  const linePathD = chartPoints.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ')

  const hitMetrics = [
    { label: 'Perfect', value: perfect, tone: 'text-emerald-600' },
    { label: 'Early', value: early, tone: 'text-amber-500' },
    { label: 'Late', value: late, tone: 'text-[#1d4ed8]' },
    { label: 'Miss', value: miss, tone: 'text-rose-500' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-md animate-in fade-in duration-300">
      <div className="glass-shell relative flex w-full max-w-[460px] flex-col overflow-hidden rounded-3xl p-4.5 text-gray-900 animate-in zoom-in-95 duration-200 shadow-2xl">
        
        {/* Header */}
        <header className="relative mb-2.5 flex items-center justify-center">
          <div className="flex items-center gap-2 select-none">
            <span className="flex size-8 items-center justify-center rounded-xl loomo-gradient text-white shadow-sm shadow-[#6c79f0]/20">
              <Trophy className="size-4" strokeWidth={2.2} />
            </span>
            <h1 className="font-display text-lg font-black tracking-tight text-gray-900">
              Scoreboard
            </h1>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close scoreboard"
            className="absolute right-0 flex size-7.5 cursor-pointer items-center justify-center rounded-full bg-[#f0f2ff] text-gray-400 transition-colors hover:bg-indigo-100 hover:text-[#6c79f0]"
            title="Close"
          >
            <X className="size-3.5" />
          </button>
        </header>

        {/* Stacked Cards Body (Rigid & Compact) */}
        <div className="space-y-2">
          
          {/* Section 1: Hit Performance */}
          <section className="glass-panel rounded-2xl p-3">
            <div className="mb-2 flex items-end justify-between">
              <div>
                <p className="label-caps text-[#6c79f0] select-none">Accuracy</p>
                <p className="font-display text-4xl font-black leading-none tracking-tight text-gray-900 mt-0.5">
                  {accuracy}
                  <span className="text-2xl font-bold text-gray-400 ml-0.5">%</span>
                </p>
              </div>
              <p className="label-caps text-gray-400 select-none pb-0.5">Hit Performance</p>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {hitMetrics.map((item) => (
                <div key={item.label} className="rounded-xl bg-[#f0f2ff]/80 px-1 py-1.5 text-center">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 select-none">
                    {item.label}
                  </p>
                  <p className={`text-base font-black leading-tight mt-0.5 ${item.tone}`}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Section 2: Duration Dynamics */}
          <section className="glass-panel rounded-2xl p-3">
            <div className="mb-2 flex items-end justify-between">
              <div>
                <p className="label-caps text-[#6c79f0] select-none">Rhythm</p>
                <p className="font-display text-4xl font-black leading-none tracking-tight text-gray-900 mt-0.5">
                  {currentDurationScore}
                  <span className="text-2xl font-bold text-gray-400 ml-0.5">%</span>
                </p>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-[#f0f2ff] px-2.5 py-0.5 text-[11px] font-bold text-[#6c79f0] select-none mb-0.5 shadow-2xs">
                <Star className="size-3 fill-[#6c79f0] text-[#6c79f0]" />
                Best {maxDurationScore}%
              </span>
            </div>

            <p className="label-caps mb-1 text-gray-400 select-none">Segment Breakdown</p>
            <div className="mb-2.5 flex h-6 gap-1 overflow-hidden rounded-full bg-gray-200/50 p-0.5">
              {pctG > 0 && (
                <div
                  style={{ flexBasis: `${pctG}%` }}
                  className="flex items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white transition-all duration-500"
                  title={`Correct Hold (tG): ${Math.round(pctG)}%`}
                >
                  {pctG >= 14 && `${Math.round(pctG)}%`}
                </div>
              )}
              {pctY > 0 && (
                <div
                  style={{ flexBasis: `${pctY}%` }}
                  className="flex items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-white transition-all duration-500"
                  title={`Early Press (tY): ${Math.round(pctY)}%`}
                >
                  {pctY >= 14 && `${Math.round(pctY)}%`}
                </div>
              )}
              {pctP > 0 && (
                <div
                  style={{ flexBasis: `${pctP}%` }}
                  className="flex items-center justify-center rounded-full bg-[#1d4ed8] text-[10px] font-bold text-white transition-all duration-500 shadow-sm"
                  title={`Late Press (tP): ${Math.round(pctP)}%`}
                >
                  {pctP >= 14 && `${Math.round(pctP)}%`}
                </div>
              )}
              {pctR > 0 && (
                <div
                  style={{ flexBasis: `${pctR}%` }}
                  className="flex items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white transition-all duration-500"
                  title={`Release Error (tR): ${Math.round(pctR)}%`}
                >
                  {pctR >= 14 && `${Math.round(pctR)}%`}
                </div>
              )}
            </div>

            <p className="label-caps mb-0.5 text-gray-400 select-none">Session History</p>
            <div className="relative h-16 w-full">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
                <defs>
                  <linearGradient id="loomoSpark" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="#6c79f0" stopOpacity="0.02" />
                    <stop offset="100%" stopColor="#6c79f0" stopOpacity="0.22" />
                  </linearGradient>
                </defs>
                <path d={`${linePathD} L 100 100 L 0 100 Z`} fill="url(#loomoSpark)" />
                <path
                  d={linePathD}
                  fill="none"
                  stroke="#6c79f0"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                />
                {chartPoints.map((pt, idx) => (
                  <circle
                    key={idx}
                    cx={pt.x}
                    cy={pt.y}
                    r="2"
                    fill="#6c79f0"
                    opacity={idx === 0 || idx === chartPoints.length - 1 ? 1 : 0.35}
                  />
                ))}
              </svg>
              <span className="absolute left-0 top-0 rounded-full bg-[#f0f2ff] px-2 py-0.5 text-[10px] font-bold text-[#6c79f0] select-none shadow-2xs">
                {displayHistory[0]}%
              </span>
              <span className="absolute right-0 top-0 rounded-full bg-[#f0f2ff] px-2 py-0.5 text-[10px] font-bold text-[#6c79f0] select-none shadow-2xs">
                {displayHistory[displayHistory.length - 1]}%
              </span>
            </div>
          </section>

          {/* Section 3: Animated loomou AI Character & Modern Speech Bubble */}
          <section className="pt-0.5">
            <LoomouAiCharacter
              size="md"
              isDarkMode={false}
              message={displayedAiText}
              isLoading={isAiLoading}
            />
          </section>

        </div>

        {/* Footer Actions */}
        <footer className="mt-2.5 flex items-center gap-2">
          <button
            type="button"
            disabled={isCalculating || !recommendedSegment}
            onClick={() => {
              if (recommendedSegment && onPracticeRecommended) {
                onPracticeRecommended(recommendedSegment)
              }
            }}
            className="loomo-gradient flex h-10.5 flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl text-xs sm:text-[13px] font-bold text-white shadow-md shadow-[#6c79f0]/25 transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-75"
          >
            {isCalculating ? (
              <>
                <Loader2 className="size-4 animate-spin text-white" />
                <span>Detecting Practice Part...</span>
              </>
            ) : (
              <span>
                Practice Recommended Part (
                {formatTime(recommendedSegment?.start ?? 0)} –{' '}
                {formatTime(recommendedSegment?.end ?? 0)})
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onReplay}
            aria-label="Replay session"
            className="flex size-10.5 shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-[#f0f2ff] text-[#6c79f0] transition-colors hover:bg-indigo-100 active:scale-95"
            title="Replay Song"
          >
            <RotateCcw className="size-4.5" />
          </button>
        </footer>

      </div>
    </div>
  )
}
