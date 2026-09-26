import { Tooltip } from '@/components'
import { VolumeSliderButton } from '@/features/controls'
import { getTrackColorPalette } from '@/features/SongVisualization/renderer/trackColors'
import { Logo, Midi } from '@/icons'
import { formatInstrumentName, isMobile } from '@/utils'
import clsx from 'clsx'
import { ArrowLeft, BarChart2, Check, ChevronDown, ListMusic } from '@/icons'
import { MouseEvent, PropsWithChildren, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'

type ButtonProps = PropsWithChildren<{
  tooltip: string
  isActive?: boolean
  onClick?: (e: MouseEvent<any>) => void
  className?: string
}>

export function ButtonWithTooltip({
  tooltip,
  children,
  isActive,
  onClick,
  className,
}: ButtonProps) {
  return (
    <Tooltip label={tooltip}>
      <button
        className={clsx(
          'group flex items-center justify-center rounded-md p-2 transition hover:bg-white/10 active:bg-white/20',
          isActive ? 'text-purple-primary' : 'text-white/70 hover:text-white',
          className,
        )}
        onClick={onClick}
      >
        {children}
      </button>
    </Tooltip>
  )
}

type TopBarProps = {
  title?: string
  onClickBack: () => void
  onClickHome?: () => void
  onClickMidi: (e: MouseEvent<any>) => void
  onClickStats: (e: MouseEvent<any>) => void
  statsVisible: boolean
  hasMultipleTracks?: boolean
  isPlayByTrack?: boolean
  onTogglePlayByTrack?: () => void
  availableTracks?: number[]
  currentTrackIndex?: number
  tracksMap?: Record<number | string, any>
  onSelectTrack?: (trackIndex: number) => void
}

export default function TopBar({
  onClickBack,
  onClickHome,
  onClickMidi,
  onClickStats,
  statsVisible,
  hasMultipleTracks,
  isPlayByTrack,
  onTogglePlayByTrack,
  availableTracks = [],
  currentTrackIndex = 0,
  tracksMap = {},
  onSelectTrack,
}: TopBarProps) {
  const [isTrackSelectorOpen, setIsTrackSelectorOpen] = useState(false)
  const selectorRef = useRef<HTMLDivElement>(null)

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(e: globalThis.MouseEvent) {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        setIsTrackSelectorOpen(false)
      }
    }
    if (isTrackSelectorOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isTrackSelectorOpen])

  return (
    <div className="fixed top-0 left-0 z-[100] flex h-[78px] w-full items-center border-b border-white/5 bg-[#131313]/20 px-4 shadow-[0_8px_32px_rgba(0,0,0,0.37)] backdrop-blur-3xl select-none sm:px-6">
      {/* Left side: Back button and Play by Track */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <ButtonWithTooltip tooltip="Back" onClick={onClickBack}>
          <ArrowLeft size={28} className="cursor-pointer sm:h-8 sm:w-8" />
        </ButtonWithTooltip>

        {hasMultipleTracks && (
          <div className="relative" ref={selectorRef}>
            <Tooltip label="Play by Track">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (!isPlayByTrack && onTogglePlayByTrack) {
                    onTogglePlayByTrack()
                  }
                  setIsTrackSelectorOpen((prev) => !prev)
                }}
                className={clsx(
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all cursor-pointer',
                  isPlayByTrack
                    ? 'border border-[#6c79f0]/40 bg-[#6c79f0]/20 text-[#9ba4ff] shadow-[0_0_12px_rgba(108,121,240,0.3)] hover:bg-[#6c79f0]/30'
                    : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white',
                )}
                title="Play by Track"
              >
                <ListMusic size={18} className="sm:h-5 sm:w-5" />
                <span className="hidden sm:inline">Play by Track</span>
                <ChevronDown size={14} className={clsx('transition-transform', isTrackSelectorOpen && 'rotate-180')} />
              </button>
            </Tooltip>

            {/* Track Selector Popover */}
            {isTrackSelectorOpen && (
              <div className="absolute left-0 top-full mt-2 w-72 overflow-hidden rounded-2xl border border-white/15 bg-[#171717]/95 p-3 shadow-2xl backdrop-blur-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="mb-2 flex items-center justify-between border-b border-white/10 pb-2">
                  <div>
                    <h3 className="text-xs font-black tracking-wider text-white uppercase">
                      Play by Track
                    </h3>
                    <p className="text-[10px] text-white/50">
                      Jump to any track in sequence
                    </p>
                  </div>
                  <span className="rounded bg-[#6c79f0]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#9ba4ff]">
                    Track {currentTrackIndex + 1}/{availableTracks.length}
                  </span>
                </div>

                <div className="flex max-h-60 flex-col gap-1 overflow-y-auto">
                  {availableTracks.map((trackId, idx) => {
                    const trackObj = tracksMap[trackId]
                    const trackName =
                      trackObj?.name ||
                      (trackObj?.instrument !== undefined
                        ? formatInstrumentName(trackObj.instrument)
                        : `Track ${idx + 1}`)
                    const isTarget = isPlayByTrack && idx === currentTrackIndex
                    const isAccompaniment = isPlayByTrack && idx < currentTrackIndex
                    const isUpcoming = isPlayByTrack && idx > currentTrackIndex

                    return (
                      <button
                        key={trackId}
                        onClick={() => {
                          onSelectTrack?.(idx)
                          setIsTrackSelectorOpen(false)
                        }}
                        className={clsx(
                          'flex items-center justify-between rounded-xl px-2.5 py-2 text-left transition-all cursor-pointer',
                          isTarget
                            ? 'border border-[#6c79f0]/50 bg-[#6c79f0]/25 text-white'
                            : 'hover:bg-white/5 text-white/80',
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                          <div
                            className="h-2.5 w-2.5 rounded-full shrink-0 shadow-sm"
                            style={{ backgroundColor: getTrackColorPalette(trackId).base }}
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="truncate text-xs font-bold text-white">
                              {trackName}
                            </span>
                            <span className="text-[10px] text-white/40">
                              Track {idx + 1}
                            </span>
                          </div>
                        </div>

                        <div>
                          {isTarget && (
                            <span className="rounded-full bg-[#6c79f0] px-2 py-0.5 text-[10px] font-extrabold text-white">
                              Practicing
                            </span>
                          )}
                          {isAccompaniment && (
                            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                              Accompaniment
                            </span>
                          )}
                          {isUpcoming && (
                            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/40">
                              Muted
                            </span>
                          )}
                          {!isPlayByTrack && (
                            <span className="text-[11px] text-white/40">
                              Select
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Center: Absolute centered loomo Identity */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <Link to="/" onClick={onClickHome} className="group flex items-center gap-1.5">
          <Logo
            height={54}
            width={90}
            className="h-[54px] w-auto aspect-[5/3] cursor-pointer drop-shadow-[0_0_15px_rgba(160,120,255,0.3)] transition-all group-hover:scale-105 sm:h-[60px]"
          />
          <span className="font-brand cursor-pointer text-2xl font-semibold tracking-tight text-[#e5e2e1] transition-all group-hover:text-[#d0bcff] sm:text-4xl">
            loomou
          </span>
        </Link>
      </div>

      {/* Right side: Volume, Stats Toggles */}
      <div className="ml-auto flex items-center gap-3 sm:gap-6">

        {!isMobile() && (
          <div className="relative z-[100]">
            <VolumeSliderButton />
          </div>
        )}

        <ButtonWithTooltip
          tooltip={statsVisible ? 'Hide Stats' : 'Show Stats'}
          onClick={onClickStats}
        >
          <BarChart2
            size={32}
            className={statsVisible ? 'text-white' : 'text-white/40 hover:text-white'}
          />
        </ButtonWithTooltip>
      </div>
    </div>
  )
}
