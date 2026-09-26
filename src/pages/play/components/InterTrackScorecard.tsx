import { getTrackColorPalette } from '@/features/SongVisualization/renderer/trackColors'
import { formatInstrumentName } from '@/utils'
import clsx from 'clsx'
import { ArrowRight, Check, Flame, RotateCcw, Trophy, X } from 'lucide-react'
import React from 'react'

export interface TrackPerformanceMetrics {
  accuracy: number
  perfect: number
  early: number
  late: number
  good: number
  miss: number
  streak: number
  totalNotes: number
  hits: number
}

interface InterTrackScorecardProps {
  isOpen: boolean
  onClose?: () => void
  currentTrackNumber: number // 1-based index
  totalTracks: number
  trackName: string
  trackId: number
  metrics: TrackPerformanceMetrics
  isFinalTrack: boolean
  onPlayAgain: () => void
  onNextTrack?: () => void
  onFinish?: () => void
  onSelectTrack: (trackIndex: number) => void
  availableTracks: number[]
  tracksMap: Record<number | string, any>
  currentTrackIndex: number
}

export default function InterTrackScorecard({
  isOpen,
  onClose,
  currentTrackNumber,
  totalTracks,
  trackName,
  trackId,
  metrics,
  isFinalTrack,
  onPlayAgain,
  onNextTrack,
  onFinish,
  onSelectTrack,
  availableTracks,
  tracksMap,
  currentTrackIndex,
}: InterTrackScorecardProps) {
  if (!isOpen) return null

  const { accuracy, perfect, good, miss, streak, totalNotes, hits } = metrics
  const palette = getTrackColorPalette(trackId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-md animate-in fade-in duration-250 select-none">
      <div className="glass-shell relative flex w-full max-w-[420px] flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#171717]/95 p-5 text-white shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <header className="relative mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="flex size-7.5 items-center justify-center rounded-xl text-white shadow-md"
              style={{ backgroundColor: palette.base }}
            >
              <Trophy className="size-4" strokeWidth={2.2} />
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="rounded-full bg-[#6c79f0]/25 px-2 py-0.5 text-[10px] font-extrabold text-[#9ba4ff] uppercase tracking-wider">
                  Track {currentTrackNumber} of {totalTracks}
                </span>
                {isFinalTrack && (
                  <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-extrabold text-amber-300 uppercase tracking-wider">
                    Final Track
                  </span>
                )}
              </div>
              <h2 className="font-display text-lg font-black tracking-tight text-white mt-0.5">
                {trackName}
              </h2>
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Dismiss scorecard"
              className="flex size-7 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white/60 transition-colors hover:bg-white/20 hover:text-white"
            >
              <X className="size-3.5" />
            </button>
          )}
        </header>

        {/* Track Performance Metrics */}
        <div className="space-y-3">
          {/* Main Accuracy & Streak Card */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-[10px] font-black tracking-widest text-[#9ba4ff] uppercase">
                  Track Accuracy
                </p>
                <p className="font-display text-4xl font-black leading-none tracking-tight text-white mt-1">
                  {accuracy}
                  <span className="text-xl font-bold text-white/40 ml-0.5">%</span>
                </p>
              </div>

              <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1">
                <Flame className="size-3.5 fill-amber-400 text-amber-400" />
                <span className="text-xs font-black text-amber-300">
                  {streak} Streak
                </span>
              </div>
            </div>

            {/* Note Breakdown Pills */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-white/5 px-2 py-2 text-center border border-white/5">
                <p className="text-[9px] font-extrabold tracking-wider text-white/50 uppercase">
                  Perfect
                </p>
                <p className="text-base font-black text-emerald-400 mt-0.5">
                  {perfect}
                </p>
              </div>

              <div className="rounded-xl bg-white/5 px-2 py-2 text-center border border-white/5">
                <p className="text-[9px] font-extrabold tracking-wider text-white/50 uppercase">
                  Good
                </p>
                <p className="text-base font-black text-purple-300 mt-0.5">
                  {good}
                </p>
              </div>

              <div className="rounded-xl bg-white/5 px-2 py-2 text-center border border-white/5">
                <p className="text-[9px] font-extrabold tracking-wider text-white/50 uppercase">
                  Missed
                </p>
                <p className="text-base font-black text-rose-400 mt-0.5">
                  {miss}
                </p>
              </div>
            </div>
          </div>

          {/* Track Progression Sequence & Jump Navigator */}
          <div>
            <div className="flex items-center justify-between mb-1.5 px-0.5">
              <span className="text-[10px] font-extrabold tracking-wider text-white/50 uppercase">
                Practice Sequence
              </span>
              <span className="text-[10px] text-white/40">
                Click to jump
              </span>
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {availableTracks.map((tId, idx) => {
                const isCurrent = idx === currentTrackIndex
                const isCompleted = idx < currentTrackIndex
                const tObj = tracksMap[tId]
                const tName =
                  tObj?.name ||
                  (tObj?.instrument !== undefined
                    ? formatInstrumentName(tObj.instrument)
                    : `Track ${idx + 1}`)

                return (
                  <button
                    key={tId}
                    type="button"
                    onClick={() => onSelectTrack(idx)}
                    className={clsx(
                      'flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0',
                      isCurrent
                        ? 'border border-[#6c79f0] bg-[#6c79f0]/30 text-white shadow-sm'
                        : isCompleted
                          ? 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                          : 'border border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white',
                    )}
                    title={`Jump to Track ${idx + 1}: ${tName}`}
                  >
                    {isCompleted && <Check className="size-3 text-emerald-400" />}
                    <span>{idx + 1}. {tName}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <footer className="mt-5 flex items-center gap-2">
          {!isFinalTrack ? (
            <>
              <button
                type="button"
                onClick={onPlayAgain}
                className="flex h-11 items-center justify-center gap-1.5 rounded-2xl border border-white/15 bg-white/10 px-4 text-xs font-bold text-white transition-all hover:bg-white/15 active:scale-95 cursor-pointer"
              >
                <RotateCcw className="size-3.5" />
                <span>Play Again</span>
              </button>

              <button
                type="button"
                onClick={onNextTrack}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#6c79f0] text-xs font-extrabold text-white shadow-lg shadow-[#6c79f0]/30 transition-all hover:bg-[#8591ff] active:scale-95 cursor-pointer"
              >
                <span>Next Track</span>
                <ArrowRight className="size-4" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onPlayAgain}
                className="flex h-11 items-center justify-center gap-1.5 rounded-2xl border border-white/15 bg-white/10 px-4 text-xs font-bold text-white transition-all hover:bg-white/15 active:scale-95 cursor-pointer"
              >
                <RotateCcw className="size-3.5" />
                <span>Play Last Track Again</span>
              </button>

              <button
                type="button"
                onClick={onFinish}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#6c79f0] text-xs font-extrabold text-white shadow-lg shadow-[#6c79f0]/30 transition-all hover:bg-[#8591ff] active:scale-95 cursor-pointer"
              >
                <Trophy className="size-4" />
                <span>Finish</span>
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  )
}

