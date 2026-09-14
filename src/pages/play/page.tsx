import { SongScrubBar } from '@/features/controls'
import { useSong } from '@/features/data'
import { useSongMetadata } from '@/features/data/library'
import midiState, { initializeMidi } from '@/features/midi'
import { requiresPermissionAtom, scanFolders } from '@/features/persist/persistence'
import { usePlayer } from '@/features/player'
import { getHandSettings, getSongSettings, SongVisualizer } from '@/features/SongVisualization'
import { predictSongFingerings } from '@/features/theory/fingering'
import {
  useEventListener,
  useLazyStableRef,
  useOnUnmount,
  usePlayerState,
  useRAFLoop,
  useSongSettings,
  useWakeLock,
} from '@/hooks'
import { MidiStateEvent, SongSource } from '@/types'
import { formatTime } from '@/utils'
import clsx from 'clsx'
import { useAtomValue } from 'jotai'
import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Repeat,
  SkipBack,
  SkipForward,
  Target,
  ZoomIn,
  ZoomOut,
} from '@/icons'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { CompletionModal, TopBar, TrackHUD } from './components'
import { MidiModal } from './components/MidiModal'
import { StatsPopup } from './components/StatsPopup'
import { ButtonWithTooltip } from './components/TopBar'
import { AnimatePresence, motion } from 'motion/react'

function RequiresPermissionPrompt({
  onGrantPermission,
  onGoBack,
}: {
  onGrantPermission: () => void
  onGoBack: () => void
}) {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="mx-auto max-w-md rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center gap-3">
          <AlertCircle className="h-6 w-6 text-orange-500" />
          <h2 className="text-lg font-medium text-gray-900">Permission Required</h2>
        </div>
        <p className="mb-6 text-sm text-gray-600">
          We need permission to access your music files. Please grant access to continue playing
          this song.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onGoBack}
            className="flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </button>
          <button
            onClick={onGrantPermission}
            className="flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            <RefreshCw className="h-4 w-4" />
            Grant Permission
          </button>
        </div>
      </div>
    </div>
  )
}

function SongNotFound({ songTitle, onGoBack }: { songTitle?: string; onGoBack: () => void }) {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="mx-auto max-w-md rounded-lg bg-white p-6 text-center shadow-lg">
        <div className="mb-4">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
        </div>
        <h2 className="mb-2 text-lg font-medium text-gray-900">Song Not Found</h2>
        {songTitle && (
          <p className="mb-4 text-sm text-gray-600">
            Could not load "{songTitle}". The file may have been moved or deleted.
          </p>
        )}
        <p className="mb-6 text-sm text-gray-500">
          Please check that the file still exists or try selecting a different song. It may also be
          that loomou lost access to your local files. If that's the case, please re-scan
          directories in the "Manage Folders" menu.
        </p>
        <button
          onClick={onGoBack}
          className="mx-auto flex cursor-pointer items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Go Back to Song List
        </button>
      </div>
    </div>
  )
}

export default function PlaySongPage() {
  const [searchParams, _setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  let { source, id, recording }: { source: SongSource; id: string; recording?: string } =
    Object.fromEntries(searchParams) as any

  // If source or id is messed up, redirect to the homepage
  if (!source || !id) {
    navigate('/', { replace: true })
    return null
  }
  id = decodeURIComponent(id)

  const player = usePlayer()
  const [isMidiModalOpen, setMidiModal] = useState(false)
  const [statsVisible, setStatsVisible] = useState(true)
  const ppsScales = [0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0]
  const [scaleIndex, setScaleIndex] = useState(3)

  const elapsedRef = useRef<HTMLSpanElement>(null)
  useRAFLoop(() => {
    if (elapsedRef.current && song) {
      const time = player.getRealTimeDuration(0, player.getTime())
      const total = player.getRealTimeDuration(0, song.duration)
      elapsedRef.current.innerText = `${formatTime(time)} / ${formatTime(total)}`
    }
  })

  const currentBpm = useAtomValue(player.currentBpm)
  const bpmModifier = useAtomValue(player.bpmModifier)

  const handleDecreaseBpm10 = React.useCallback(() => {
    const newBpm = Math.max(20, currentBpm - 10)
    const newModifier = bpmModifier * (newBpm / currentBpm)
    player.store.set(player.bpmModifier, Math.round(newModifier * 100) / 100)
    const backingTrack = player.getSong()?.backing
    if (backingTrack) {
      backingTrack.playbackRate = newModifier
    }
  }, [currentBpm, bpmModifier, player])

  const handleIncreaseBpm10 = React.useCallback(() => {
    const newBpm = Math.min(300, currentBpm + 10)
    const newModifier = bpmModifier * (newBpm / currentBpm)
    player.store.set(player.bpmModifier, Math.round(newModifier * 100) / 100)
    const backingTrack = player.getSong()?.backing
    if (backingTrack) {
      backingTrack.playbackRate = newModifier
    }
  }, [currentBpm, bpmModifier, player])

  const handleBpmInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value, 10)
      if (!isNaN(val) && val >= 20 && val <= 300) {
        const newModifier = bpmModifier * (val / currentBpm)
        player.store.set(player.bpmModifier, Math.round(newModifier * 100) / 100)
        const backingTrack = player.getSong()?.backing
        if (backingTrack) {
          backingTrack.playbackRate = newModifier
        }
      }
    },
    [currentBpm, bpmModifier, player],
  )

  const handleWheel = React.useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault()
        setScaleIndex((i) =>
          e.deltaY < 0 ? Math.min(ppsScales.length - 1, i + 1) : Math.max(0, i - 1),
        )
      }
    },
    [ppsScales.length],
  )
  const playerState = usePlayerState()
  const countdown = useAtomValue(player.countdown)
  const instrumentVolume = useAtomValue(player.instrumentVolume)
  let { data: song, error, isLoading, mutate } = useSong(id, source)
  let songMeta = useSongMetadata(id, source)
  const range = useAtomValue(player.getRange())
  const selectedRange = useMemo(
    () => (range ? { start: range[0], end: range[1] } : undefined),
    [range],
  )
  const isLooping = !!range
  const requiresPermission = useAtomValue(requiresPermissionAtom)
  const songLoop = useAtomValue(player.songLoop)

  const [songConfig, setSongConfig] = useSongSettings(id)
  const isRecording = !!recording
  useWakeLock()

  // Make sure MIDI is active and initialized on mount
  useEffect(() => {
    initializeMidi()
  }, [])

  const hand =
    songConfig.left && songConfig.right
      ? 'both'
      : songConfig.left
        ? 'left'
        : songConfig.right
          ? 'right'
          : 'none'

  // Hack for updating player when config changes.
  // Maybe move to the onChange? Or is this chill.
  const { waiting, left, right } = songConfig
  useEffect(() => {
    player.setWait(waiting)
    if (left && right) {
      player.setHand('both')
    } else {
      player.setHand(left ? 'left' : 'right')
    }
  }, [waiting, left, right, player])

  useEffect(() => {
    if (!song) return
    midiState.anchorToSong(song)
    player.trackConfigs = songConfig.tracks
    Object.entries(songConfig.tracks).forEach(([id, settings]) => {
      player.setTrackVolume(Number(id), settings.sound ? 1 : 0)
    })
  }, [songConfig.tracks, player, song])

  const [isCompletedModalOpen, setIsCompletedModalOpen] = useState(false)
  const [hasDismissedModal, setHasDismissedModal] = useState(false)

  // Auto-trigger CompletionModal when song reaches completion
  useEffect(() => {
    const checkCompletion = setInterval(() => {
      if (
        player &&
        song &&
        player.getDuration() > 0
      ) {
        if (player.currentSongTime < player.getDuration() - 1 && hasDismissedModal) {
          setHasDismissedModal(false)
        }

        if (
          player.currentSongTime >= player.getDuration() - 0.15 &&
          !isCompletedModalOpen &&
          !hasDismissedModal
        ) {
          setIsCompletedModalOpen(true)
          player.pause()
        }
      }
    }, 250)

    return () => clearInterval(checkCompletion)
  }, [player, song, isCompletedModalOpen, hasDismissedModal])

  const handleCloseCompletionModal = () => {
    setIsCompletedModalOpen(false)
    setHasDismissedModal(true)
    player.pause()
  }

  const handleReplaySong = () => {
    setIsCompletedModalOpen(false)
    setHasDismissedModal(false)
    player.restart()
  }

  const handlePracticeRecommended = (segment: { start: number; end: number }) => {
    setIsCompletedModalOpen(false)
    setHasDismissedModal(true)
    player.pause()
    player.setRange(segment)
    player.seek(segment.start)
    player.resetStats_()
  }

  useOnUnmount(() => player.stop())

  useEffect(() => {
    if (!song) return
    // TODO: handle invalid song. Pipe up not-found midi for 400s etc.
    let config = getSongSettings(id, song)

    // Ensure all tracks default to sound: true so guide notes are never muted on load
    const unmutedTracks = { ...config.tracks }
    Object.keys(unmutedTracks).forEach((trackIdStr) => {
      const trackId = Number(trackIdStr)
      if (unmutedTracks[trackId]) {
        unmutedTracks[trackId] = {
          ...unmutedTracks[trackId],
          sound: true,
        }
      }
    })
    config = { ...config, tracks: unmutedTracks }

    const practiceTrackIdParam = searchParams.get('practiceTrackId')
    if (practiceTrackIdParam !== null) {
      const rawParam = Number(practiceTrackIdParam)
      if (!isNaN(rawParam)) {
        const trackIds = Object.keys(config.tracks).map(Number)
        // If rawParam doesn't exist in trackIds but (rawParam - 1) does, adjust for 1-based UI indexing
        let practiceTrackId = rawParam
        if (!trackIds.includes(practiceTrackId) && trackIds.includes(practiceTrackId - 1)) {
          practiceTrackId = practiceTrackId - 1
        }

        const updatedTracks = { ...config.tracks }
        Object.keys(updatedTracks).forEach((trackIdStr) => {
          const trackId = Number(trackIdStr)
          const isTarget = trackId === practiceTrackId
          const existingHand = updatedTracks[trackId]?.hand
          updatedTracks[trackId] = {
            ...updatedTracks[trackId],
            practice: isTarget,
            sound: true,
            hand: isTarget
              ? existingHand && existingHand !== 'none'
                ? existingHand
                : 'right'
              : 'none',
          }
        })
        config = {
          ...config,
          left: true,
          right: true,
          tracks: updatedTracks,
        }
      }
    }

    setSongConfig(config)
    player.setSong(song, config)

    // Auto-enable progressive learning if the song title indicates it
    if (songMeta?.title?.startsWith('Progressive:')) {
      player.store.set(player.progressiveMode, true)
      player.store.set(player.completedTracks, new Set<number>())

      const tracks = Object.keys(song.tracks)
        .map(Number)
        .sort((a, b) => a - b)
      if (tracks.length > 0) {
        player.setupProgressiveRegion_(tracks[0])
      }
    } else {
      player.store.set(player.progressiveMode, false)
    }
  }, [song, setSongConfig, id, player, songMeta?.title, searchParams])

  const handleCycleNextTrackPractice = React.useCallback(() => {
    if (!song) return
    const availableTracks = Object.keys(song.tracks)
      .map(Number)
      .filter((id) => song.notes.some((n) => n.track === id))
      .sort((a, b) => a - b)

    if (availableTracks.length <= 1) return

    setSongConfig((prev) => {
      const currentPracticeId = availableTracks.find((id) => prev.tracks[id]?.practice)
      const currentIdx = currentPracticeId !== undefined ? availableTracks.indexOf(currentPracticeId) : -1
      const nextIdx = (currentIdx + 1) % availableTracks.length
      const nextTrackId = availableTracks[nextIdx]

      const newTracks = { ...prev.tracks }
      Object.keys(newTracks).forEach((idStr) => {
        const id = Number(idStr)
        const isTarget = id === nextTrackId
        const existingHand = newTracks[id]?.hand
        newTracks[id] = {
          ...newTracks[id],
          practice: isTarget,
          hand: isTarget
            ? existingHand && existingHand !== 'none'
              ? existingHand
              : 'right'
            : 'none',
        }
      })
      return { ...prev, tracks: newTracks }
    })
  }, [song, setSongConfig])

  useEventListener<KeyboardEvent>('keydown', (evt: KeyboardEvent) => {
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
      return
    }

    if (evt.key === 'Shift' || evt.code === 'ShiftLeft' || evt.code === 'ShiftRight') {
      if (!evt.repeat) {
        handleCycleNextTrackPractice()
      }
    } else if (evt.code === 'Space') {
      evt.preventDefault()
      player.toggle()
    } else if (evt.shiftKey && evt.code === 'Comma') {
      player.seekToPreviousMeasure()
    } else if (evt.shiftKey && evt.code === 'Period') {
      player.seekToNextMeasure()
    } else if (evt.code === 'Comma') {
      player.seek(player.currentSongTime - 16 / 1000)
    } else if (evt.code === 'Period') {
      player.seek(player.currentSongTime + 16 / 1000)
    } else if (evt.code === 'ArrowLeft') {
      evt.preventDefault()
      player.restart()
    } else if (evt.code === 'ArrowRight') {
      evt.preventDefault()
      player.seek(player.getDuration())
    }
  })

  const handleToggleMute = React.useCallback(
    (trackId: number) => {
      setSongConfig((prev) => {
        const current = prev.tracks[trackId]
        return {
          ...prev,
          tracks: {
            ...prev.tracks,
            [trackId]: { ...current, sound: !current.sound },
          },
        }
      })
    },
    [setSongConfig],
  )

  const handleSolo = React.useCallback(
    (trackId: number) => {
      setSongConfig((prev) => {
        const newTracks = { ...prev.tracks }
        Object.keys(newTracks).forEach((id) => {
          const numericId = Number(id)
          newTracks[numericId] = {
            ...newTracks[numericId],
            sound: numericId === trackId,
          }
        })
        return { ...prev, tracks: newTracks }
      })
    },
    [setSongConfig],
  )

  const handleTogglePractice = React.useCallback(
    (trackId: number) => {
      setSongConfig((prev) => {
        const current = prev.tracks[trackId]
        return {
          ...prev,
          tracks: {
            ...prev.tracks,
            [trackId]: { ...current, practice: !current.practice },
          },
        }
      })
    },
    [setSongConfig],
  )

  const handleSoloPractice = React.useCallback(
    (trackId: number) => {
      setSongConfig((prev) => {
        const newTracks = { ...prev.tracks }
        Object.keys(newTracks).forEach((idStr) => {
          const id = Number(idStr)
          const isTarget = id === trackId
          const existingHand = newTracks[id]?.hand
          newTracks[id] = {
            ...newTracks[id],
            practice: isTarget,
            hand: isTarget
              ? existingHand && existingHand !== 'none'
                ? existingHand
                : 'right'
              : 'none',
          }
        })
        return { ...prev, tracks: newTracks }
      })
    },
    [setSongConfig],
  )

  const handleSelectHandTrack = React.useCallback(
    async (trackId: number, hand: 'left' | 'right' | 'none') => {
      let updatedConfig: any = null
      setSongConfig((prev) => {
        const current = prev.tracks[trackId]
        const newHand = current?.hand === hand ? 'none' : hand
        updatedConfig = {
          ...prev,
          tracks: {
            ...prev.tracks,
            [trackId]: { ...current, hand: newHand },
          },
        }
        return updatedConfig
      })
      if (song && updatedConfig) {
        try {
          const updatedSong = await predictSongFingerings(song, updatedConfig)
          if (mutate) mutate(updatedSong, false)
        } catch (e) {
          console.error('Failed predicting fingerings for hand update:', e)
        }
      }
    },
    [setSongConfig, song, mutate],
  )

  useOnUnmount(() => player.stop())

  useEffect(() => {
    const handleMidiEvent = ({ type, note, velocity, cc, value }: MidiStateEvent) => {
      console.log('PlayPage handleMidiEvent', type, note, velocity)
      if (type === 'down' && note !== undefined) {
        player.playUserNote(note, velocity!)
      } else if (type === 'up' && note !== undefined) {
        player.stopUserNote(note)
      } else if (type === 'cc') {
        // Knob 1 (CC 74): Volume
        if (cc === 74) {
          player.setVolume(value! / 127)
        }
        // Transport: Stop (CC 113) / Play (CC 115)
        if (cc === 115 && value! > 0) {
          player.toggle()
        }
        if (cc === 113 && value! > 0) {
          player.restart()
        }
        // Custom: Pad 1-8 (mapped to CC 20-27) -> Mute Tracks
        if (cc! >= 20 && cc! <= 27 && value! > 0) {
          const trackIds = Object.keys(songConfig.tracks)
          const targetId = Number(trackIds[cc! - 20])
          if (!isNaN(targetId)) {
            handleToggleMute(targetId)
          }
        }
        // Custom: CC 28 -> Toggle Wait
        if (cc === 28 && value! > 0) {
          setSongConfig((prev) => ({ ...prev, waiting: !prev.waiting }))
        }
      }
    }

    midiState.subscribe(handleMidiEvent)
    return () => midiState.unsubscribe(handleMidiEvent)
  }, [player, handleToggleMute, songConfig.tracks, setSongConfig])

  const handleLoopingToggle = (enable: boolean) => {
    if (!enable) {
      player.setRange(undefined)
      return
    } else {
      const duration = player.getDuration()
      const tenth = duration / 10
      player.setRange({
        start: duration / 2 - tenth,
        end: duration / 2 + tenth,
      })
    }
  }

  // Handle permission required for local files
  if (source === 'local' && requiresPermission) {
    return (
      <RequiresPermissionPrompt
        onGrantPermission={async () => {
          await scanFolders()
          mutate()
        }}
        onGoBack={() => {
          player.stop()
          navigate('/songs')
        }}
      />
    )
  }

  // Handle song not found
  if (error || (source === 'local' && !song && !isLoading)) {
    return (
      <SongNotFound
        songTitle={songMeta?.title}
        onGoBack={() => {
          player.stop()
          navigate('/songs')
        }}
      />
    )
  }

  return (
    <>
      <title>Playing</title>
      <div
        className={clsx(
          // Enable fixed to remove all scrolling.
          'fixed',
          'flex h-screen max-h-screen max-w-screen flex-col outline-none',
        )}
        {...midiState.getListenerProps()}
        autoFocus
      >
        {!isRecording && (
          <>
            <TopBar
              title={songMeta?.title}
              onClickBack={() => {
                player.stop()
                navigate(-1)
              }}
              onClickHome={() => {
                player.stop()
              }}
              onClickMidi={(e) => {
                e.stopPropagation()
                setMidiModal(!isMidiModalOpen)
              }}
              onClickStats={(e) => {
                setStatsVisible(!statsVisible)
              }}
              statsVisible={statsVisible}
            />
            <MidiModal isOpen={isMidiModalOpen} onClose={() => setMidiModal(false)} />

            {/* Relocated Bottom Control Bar (Full Width, Anchored) */}
            <div className="pointer-events-auto fixed bottom-0 left-0 z-40 flex h-[60px] w-full items-center justify-between border-t border-[#6c79f0]/40 bg-[#131313]/70 px-6 shadow-[0_-8px_32px_rgba(0,0,0,0.37),inset_0_1px_0_0_rgba(108,121,240,0.35)] backdrop-blur-xl select-none">
              {/* Scrub Bar at the top edge, spanning full width */}
              <div className="absolute top-0 left-0 w-full -translate-y-1/2 transform">
                <SongScrubBar
                  rangeSelection={selectedRange}
                  setRange={(range: any) => player.setRange(range)}
                />
              </div>

              {/* Left Section: Time display */}
              <div className="flex items-center">
                <span ref={elapsedRef} className="font-mono text-xs tracking-wider text-white/60" />
              </div>

              {/* Center Section: Playback Controls */}
              <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-6">
                <ButtonWithTooltip tooltip="Restart">
                  <SkipBack
                    size={20}
                    className="text-white/70 transition-colors duration-200 hover:text-white"
                    onClick={() => player.restart()}
                  />
                </ButtonWithTooltip>

                <button
                  className="flex items-center justify-center rounded-full bg-[#6c79f0] p-2.5 text-black shadow-[0_0_15px_rgba(108,121,240,0.4)] transition-all hover:bg-[#9ba4ff] active:scale-95"
                  onClick={() => player.toggle()}
                >
                  {!playerState.canPlay ? (
                    <Loader2 className="h-5 w-5 animate-spin text-black" />
                  ) : playerState.playing ? (
                    <Pause className="h-5 w-5 fill-black text-black" />
                  ) : (
                    <Play className="h-5 w-5 translate-x-[1px] fill-black text-black" />
                  )}
                </button>

                <ButtonWithTooltip tooltip="Skip to End">
                  <SkipForward
                    size={20}
                    className="text-white/70 transition-colors duration-200 hover:text-white"
                    onClick={() => player.skipToEnd()}
                  />
                </ButtonWithTooltip>

                <ButtonWithTooltip
                  tooltip={isLooping ? "Loop active (Practice Mode)" : "Toggle Loop"}
                  isActive={songLoop || isLooping}
                  onClick={() => {
                    if (!isLooping) {
                      player.store.set(player.songLoop, !songLoop)
                    }
                  }}
                >
                  <Repeat
                    size={20}
                    className={clsx(
                      'transition-colors duration-200',
                      isLooping && 'cursor-not-allowed opacity-70 text-[#6c79f0]',
                    )}
                  />
                </ButtonWithTooltip>

                <ButtonWithTooltip
                  tooltip="Wait Mode"
                  isActive={waiting}
                  onClick={() => setSongConfig({ ...songConfig, waiting: !waiting })}
                >
                  <Target size={20} className="transition-colors duration-200" />
                </ButtonWithTooltip>
              </div>

              {/* Right Section: Empty / Balancer */}
              <div className="w-20" />
            </div>

            {/* Right: Score Popup (Proportionally scales down and vanishes on micro viewports) */}
            {statsVisible && (
              <div className="hidden transition-all duration-200 md:block md:scale-90 md:origin-top-right lg:scale-95 xl:scale-100 [@media(max-height:520px)]:hidden">
                <StatsPopup />
              </div>
            )}

            {/* Left: Tempo, Zoom & TrackHUD (Proportionally scales down and vanishes on micro viewports) */}
            <div className="pointer-events-auto absolute top-20 left-4 z-30 hidden flex-col gap-2.5 transition-all duration-200 md:flex md:scale-90 md:origin-top-left lg:scale-95 xl:scale-100 xl:gap-4 [@media(max-height:520px)]:hidden">
              <div className="flex items-stretch gap-2 sm:gap-2.5 lg:gap-3">
                {/* BPM Ticket */}
                <div className="flex w-[140px] flex-col justify-between rounded-2xl border border-white/5 bg-black/45 p-2.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15),0_8px_32px_0_rgba(0,0,0,0.37)] backdrop-blur-xl sm:w-[155px] lg:w-[168px] lg:rounded-[20px] lg:p-3">
                  <span className="mb-1 text-center text-[10px] font-black tracking-[0.18em] text-[#6c79f0] uppercase select-none sm:text-[11px] lg:mb-1.5 lg:text-[12px]">
                    TEMPO (BPM)
                  </span>
                  <div className="flex items-center justify-between gap-1">
                    <button
                      className="flex h-7 w-7 cursor-pointer items-center justify-center border-0 bg-transparent text-xl font-light text-white/50 transition select-none hover:text-white sm:h-8 sm:w-8 sm:text-2xl"
                      onClick={handleDecreaseBpm10}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      value={Math.round(currentBpm)}
                      onChange={handleBpmInputChange}
                      className="w-12 [appearance:textfield] border-0 bg-transparent text-center text-base font-bold text-white outline-none focus:ring-0 sm:w-14 sm:text-lg [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <button
                      className="flex h-7 w-7 cursor-pointer items-center justify-center border-0 bg-transparent text-xl font-light text-white/50 transition select-none hover:text-white sm:h-8 sm:w-8 sm:text-2xl"
                      onClick={handleIncreaseBpm10}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Merged Zoom Controls */}
                <div className="flex w-[44px] flex-col justify-between overflow-hidden rounded-2xl border border-white/5 bg-black/45 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15),0_8px_32px_0_rgba(0,0,0,0.37)] backdrop-blur-xl sm:w-[48px] lg:w-[52px] lg:rounded-[20px]">
                  <button
                    className="flex flex-1 cursor-pointer items-center justify-center border-0 bg-transparent p-1.5 text-white/70 transition hover:bg-white/5 hover:text-white sm:p-2"
                    onClick={() => setScaleIndex((i) => Math.min(ppsScales.length - 1, i + 1))}
                    title="Zoom In"
                  >
                    <ZoomIn className="h-4 w-4 sm:h-5 sm:w-5" />
                  </button>
                  <div className="h-[1px] w-full bg-white/10" />
                  <button
                    className="flex flex-1 cursor-pointer items-center justify-center border-0 bg-transparent p-1.5 text-white/70 transition hover:bg-white/5 hover:text-white sm:p-2"
                    onClick={() => setScaleIndex((i) => Math.max(0, i - 1))}
                    title="Zoom Out"
                  >
                    <ZoomOut className="h-4 w-4 sm:h-5 sm:w-5" />
                  </button>
                </div>
              </div>

              {/* Tracks (Instruments) Box */}
              {song && (
                <TrackHUD
                  song={song}
                  config={songConfig}
                  onToggleMute={handleToggleMute}
                  onTogglePractice={handleTogglePractice}
                  onSoloPractice={handleSoloPractice}
                  onSelectHand={handleSelectHandTrack}
                />
              )}
            </div>
          </>
        )}
        <div
          className={clsx(
            'fixed top-0 left-0 -z-10 h-[100vh] w-screen',
            'h-[100dvh]!',
            songConfig.visualization === 'sheet' ? 'bg-white' : 'bg-[#2e2e2e]',
          )}
          onWheel={handleWheel}
        >
          <SongVisualizer
            song={song}
            config={songConfig}
            hand={hand}
            handSettings={getHandSettings(songConfig)}
            selectedRange={selectedRange}
            getTime={() => player.getTime()}
            enableTouchscroll={songConfig.visualization === 'falling-notes'}
            ppsScale={ppsScales[scaleIndex]}
          />
        </div>
      </div>

      {/* Centered Dynamic Countdown Overlay (3 -> 2 -> 1) */}
      <AnimatePresence mode="wait">
        {countdown !== null && (
          <div className="pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center select-none">
            {/* Ambient background glow */}
            <motion.div
              key={`countdown-glow-${countdown}`}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute h-[340px] w-[340px] rounded-full bg-[#7569EC]/25 blur-[100px]"
            />

            {/* Pulsing Countdown Circle */}
            <motion.div
              key={`countdown-circle-${countdown}`}
              initial={{ scale: 0.6, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 1.35, opacity: 0, y: -15 }}
              transition={{ type: 'spring', stiffness: 500, damping: 28 }}
              className="relative flex flex-col items-center justify-center"
            >
              <div className="flex h-36 w-36 items-center justify-center rounded-full border border-white/20 bg-[#1A1D2D]/90 shadow-[0_0_80px_rgba(117,105,236,0.65),inset_0_1px_1px_rgba(255,255,255,0.4)] backdrop-blur-2xl sm:h-40 sm:w-40">
                <span className="font-display text-7xl font-black tracking-tighter text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.8)] sm:text-8xl">
                  {countdown}
                </span>
              </div>

              {/* Space Skip Hint */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-1.5 backdrop-blur-md shadow-lg"
              >
                <kbd className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase shadow-sm">
                  Space
                </kbd>
                <span className="text-xs font-medium text-white/85">Press Space to skip</span>
              </motion.div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <CompletionModal
        isOpen={isCompletedModalOpen}
        onClose={handleCloseCompletionModal}
        onReplay={handleReplaySong}
        onPracticeRecommended={handlePracticeRecommended}
      />
    </>
  )
}
