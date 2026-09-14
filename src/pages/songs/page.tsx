import { UploadMidi } from '@/components'
import { useSongManifest } from '@/features/data/library'
import { getUploadedSong } from '@/features/persist/persistence'
import Storage from '@/features/persist/storage'
import { Logo } from '@/icons'
import { SongMetadata, Tracks } from '@/types'
import { formatTime } from '@/utils'
import * as idb from 'idb-keyval'
import {
  ArrowRight,
  AudioWaveform,
  Check,
  ChevronDown,
  ChevronRight,
  Filter,
  Home as HomeIcon,
  Library as LibraryIcon,
  Moon,
  Music,
  Piano,
  Play,
  Search,
  Sliders,
  Sparkles,
  Sun,
  Upload,
  Users,
  X,
} from '@/icons'
import { AnimatePresence, motion } from 'motion/react'
import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useTheme } from '@/hooks'

const PRESET_FILTERS = [
  'Beginner friendly',
  'Under 1 min',
  'Covers',
  'Classical',
  'Electronic',
  'Jazz',
  'Pop',
  'Chiptune',
] as const

type PresetFilter = (typeof PRESET_FILTERS)[number]

interface TrackInfo {
  id: number
  name: string
}

function getSongGenre(song: SongMetadata): string {
  if (song.tags && song.tags.length > 0) {
    if (song.tags.includes('Electronic')) return 'Electronic'
    if (song.tags.includes('Pop')) return 'Pop'
    if (song.tags.includes('Jazz')) return 'Jazz'
    if (song.tags.includes('Classical') || song.tags.includes('Traditional')) return 'Classical'
    if (song.tags.includes('Chiptune')) return 'Chiptune'
  }
  const t = (song.title || '').toLowerCase()
  if (t.includes('chiptune') || t.includes('8-bit') || t.includes('mario') || t.includes('zelda') || t.includes('tetris')) {
    return 'Chiptune'
  }
  if (t.includes('jazz') || t.includes('swing') || t.includes('blues')) {
    return 'Jazz'
  }
  if (t.includes('electronic') || t.includes('synth') || t.includes('dance') || t.includes('techno') || t.includes('toujours')) {
    return 'Electronic'
  }
  if (t.includes('pop') || t.includes('rock') || t.includes('hallelujah') || t.includes('rivers')) {
    return 'Pop'
  }
  if (t.includes('beethoven') || t.includes('bach') || t.includes('mozart') || t.includes('chopin') || t.includes('elise') || t.includes('sonata') || t.includes('canon') || t.includes('waltz') || t.includes('minuet') || t.includes('petzold') || t.includes('birthday') || t.includes('twinkle')) {
    return 'Classical'
  }
  if (t.includes('cover')) {
    return 'Covers'
  }
  return 'Classical'
}

function getSongDetails(song: SongMetadata, customTitle?: string) {
  const effectiveTitle = customTitle || song.title || 'Untitled Song'
  const parts = effectiveTitle.split(' - ')
  if (parts.length >= 2) {
    return {
      title: parts[0].trim(),
      artist: parts.slice(1).join(' - ').trim(),
      genre: getSongGenre(song),
    }
  }
  return {
    title: effectiveTitle,
    artist: song.source === 'upload' ? 'User Upload' : 'loomou library',
    genre: getSongGenre(song),
  }
}

export default function LibraryPage() {
  const navigate = useNavigate()
  const rawSongs: SongMetadata[] = useSongManifest()
  const [isDarkMode, setIsDarkMode] = useTheme()
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<Set<PresetFilter>>(new Set())

  // Track Unpacking & Persistent Custom Names State
  const [expandedSongIds, setExpandedSongIds] = useState<Set<string>>(new Set())
  const [songTracksMap, setSongTracksMap] = useState<Map<string, TrackInfo[]>>(new Map())
  const [customTitles, setCustomTitles] = useState<Record<string, string>>(() => {
    return Storage.get<Record<string, string>>('loomo_custom_titles') || {}
  })
  const [customTrackNames, setCustomTrackNames] = useState<Record<string, Record<number, string>>>(() => {
    return Storage.get<Record<string, Record<number, string>>>('loomo_custom_track_names') || {}
  })
  const [customTagsMap, setCustomTagsMap] = useState<Record<string, string[]>>(() => {
    return Storage.get<Record<string, string[]>>('loomo_custom_tags') || {}
  })

  // Inline Renaming State
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null)
  const [editingTitleText, setEditingTitleText] = useState('')
  const [editingTrack, setEditingTrack] = useState<{ songId: string; trackId: number } | null>(null)
  const [editingTrackText, setEditingTrackText] = useState('')

  // Load track info for songs to determine if multi-track (unpackable)
  useEffect(() => {
    let isMounted = true
    async function loadTracks() {
      const map = new Map<string, TrackInfo[]>()
      for (const song of rawSongs) {
        try {
          const cached = await getUploadedSong(song.id)
          if (cached && cached.tracks) {
            const tracks: TrackInfo[] = Object.entries(cached.tracks).map(([tid, t]) => ({
              id: Number(tid),
              name: t.name || `Track ${tid}`,
            }))
            map.set(song.id, tracks)
          }
        } catch (_) {}
      }
      if (isMounted) {
        setSongTracksMap(map)
      }
    }
    loadTracks()
    return () => {
      isMounted = false
    }
  }, [rawSongs])

  const toggleFilter = (filter: PresetFilter) => {
    setActiveFilters((prev) => {
      const next = new Set(prev)
      if (next.has(filter)) {
        next.delete(filter)
      } else {
        next.add(filter)
      }
      return next
    })
  }

  const toggleExpand = (songId: string, isMultiTrack: boolean) => {
    if (!isMultiTrack) return
    setExpandedSongIds((prev) => {
      const next = new Set(prev)
      if (next.has(songId)) {
        next.delete(songId)
      } else {
        next.add(songId)
      }
      return next
    })
  }

  // Double-Click Title Renaming Handlers
  const handleStartEditingTitle = (songId: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingTitleId(songId)
    setEditingTitleText(currentTitle)
  }

  const handleSaveTitle = async (songId: string) => {
    const trimmed = editingTitleText.trim()
    if (trimmed) {
      const updated = { ...customTitles, [songId]: trimmed }
      setCustomTitles(updated)
      Storage.set('loomo_custom_titles', updated)
    }
    setEditingTitleId(null)
  }

  // Double-Click Track Renaming Handlers
  const handleStartEditingTrack = (
    songId: string,
    trackId: number,
    currentName: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation()
    setEditingTrack({ songId, trackId })
    setEditingTrackText(currentName)
  }

  const handleSaveTrack = async (songId: string, trackId: number) => {
    const trimmed = editingTrackText.trim()
    if (trimmed) {
      const songCustomTracks = { ...(customTrackNames[songId] || {}), [trackId]: trimmed }
      const updated = { ...customTrackNames, [songId]: songCustomTracks }
      setCustomTrackNames(updated)
      Storage.set('loomo_custom_track_names', updated)

      // Also persist back to SONG_DATA in IndexedDB if available
      try {
        const cached = await getUploadedSong(songId)
        if (cached && cached.tracks && cached.tracks[trackId]) {
          cached.tracks[trackId].name = trimmed
          await idb.set(`SONG_DATA_${songId}`, cached)
          Storage.set(songId, cached)
        }
      } catch (_) {}
    }
    setEditingTrack(null)
  }

  // Filter songs based on search query and active preset chips
  const filteredSongs = useMemo(() => {
    return rawSongs.filter((song) => {
      const customTitle = customTitles[song.id]
      const effectiveTags = customTagsMap[song.id] || song.tags || []
      const songTags = effectiveTags.map((t) => t.toLowerCase())
      const { title, artist, genre } = getSongDetails(song, customTitle)
      const q = search.trim().toLowerCase()

      // Search matching (Title, Artist, Genre, Tags)
      if (q) {
        const matchesTitle = title.toLowerCase().includes(q)
        const matchesArtist = artist.toLowerCase().includes(q)
        const matchesGenre = genre.toLowerCase().includes(q)
        const matchesTag = songTags.some((t) => t.includes(q))
        if (!matchesTitle && !matchesArtist && !matchesGenre && !matchesTag) {
          return false
        }
      }

      // Filter chips matching
      if (activeFilters.size > 0) {
        for (const filter of activeFilters) {
          const filterLower = filter.toLowerCase()
          const hasTag = songTags.includes(filterLower)

          if (filter === 'Under 1 min') {
            if (!hasTag && (song.duration || 0) > 60) return false
          } else if (filter === 'Beginner friendly') {
            const isBeginner = (song.difficulty && song.difficulty <= 2) || (song.duration || 0) <= 150
            if (!hasTag && !isBeginner) return false
          } else if (filter === 'Covers') {
            const isCover = (song.title || '').toLowerCase().includes('cover')
            if (!hasTag && !isCover) return false
          } else {
            // Genre / preset filters
            if (!hasTag && genre.toLowerCase() !== filterLower) {
              return false
            }
          }
        }
      }

      return true
    })
  }, [rawSongs, search, activeFilters, customTitles, customTagsMap])

  return (
    <div
      className={`min-h-screen overflow-x-hidden transition-colors duration-500 ${
        isDarkMode
          ? 'bg-[#101223] text-[#F4F5F8] selection:bg-[#7569EC]/40'
          : 'bg-[#F6F7FB] text-[#24273A] selection:bg-[#6E61EA]/25'
      }`}
    >
      {/* 1. Header Navigation matching Homepage style */}
      <Navbar isDarkMode={isDarkMode} onToggleTheme={(dark) => setIsDarkMode(dark)} />

      {/* 2. Main Content Area */}
      <main className="relative flex min-h-screen flex-col items-center overflow-visible px-4 pt-32 pb-28 sm:px-6 md:pt-40">
        {/* Volumetric Radial Ambient Lighting */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className={`absolute top-0 left-1/2 w-full -translate-x-1/2 transition-all duration-700 ${
              isDarkMode
                ? 'h-[850px] bg-[radial-gradient(ellipse_at_top,rgba(117,105,236,0.22)_0%,transparent_70%)]'
                : 'h-[1200px] bg-[radial-gradient(ellipse_at_top,rgba(110,97,234,0.40)_0%,rgba(139,128,249,0.20)_38%,rgba(175,166,255,0.1)_62%,transparent_85%)]'
            }`}
          />
          <div
            className={`absolute left-1/2 -translate-x-1/2 rounded-full transition-all duration-700 ${
              isDarkMode
                ? 'top-[-90px] h-[900px] w-[1400px] bg-[#7569EC]/15 blur-[140px]'
                : 'top-[-80px] h-[1100px] w-[1400px] bg-[#6E61EA]/25 blur-[150px]'
            }`}
          />
          {!isDarkMode && (
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#F6F7FB]/30 to-[#FFFFFF]" />
          )}
        </div>

        {/* Hero Title Section */}
        <div className="relative z-10 mx-auto w-full max-w-5xl space-y-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-3"
          >
            {/* Page Title */}

            <h1
              className={`font-display bg-clip-text text-5xl leading-tight font-black tracking-[-0.035em] text-transparent transition-all sm:text-6xl md:text-7xl ${
                isDarkMode
                  ? 'bg-gradient-to-b from-[#FFFFFF] via-[#F4F5F8] to-[#888A95]'
                  : 'bg-gradient-to-b from-[#181028] via-[#331559] to-[#633BB9]'
              }`}
            >
              Library
            </h1>

            <p
              className={`mx-auto max-w-2xl text-base leading-relaxed transition-colors md:text-lg ${
                isDarkMode ? 'text-[#A2A3B1]' : 'text-[#5E637D]'
              }`}
            >
              Select a sample song from loomou’s library or import your own MIDI files to start practicing.
            </p>
          </motion.div>
        </div>

        {/* 3. Search, Upload & Filter Chips Toolbar */}
        <div className="relative z-10 mx-auto mt-10 w-full max-w-5xl space-y-5">
          {/* Top Search & Upload Row */}
          <div className="flex flex-col items-center gap-3.5 sm:flex-row">
            {/* Search Input Bar */}
            <div
              className={`relative flex h-[55px] flex-1 items-center rounded-full border px-5 backdrop-blur-2xl transition-all duration-300 ${
                isDarkMode
                  ? 'border-white/[0.1] bg-[#1F1936]/70 shadow-[0_4px_25px_rgba(0,0,0,0.3)] focus-within:border-[#8C49F4]'
                  : 'border-[#1B1630]/[0.1] bg-white/80 shadow-[0_4px_20px_rgba(27,22,48,0.05)] focus-within:border-[#843EEA]'
              }`}
            >
              <Search
                className={`h-5 w-5 shrink-0 ${isDarkMode ? 'text-[#9D9CB1]' : 'text-[#636073]'}`}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search songs, artists, genres..."
                className={`h-full w-full bg-transparent px-3.5 text-base font-medium outline-none placeholder:text-sm ${
                  isDarkMode
                    ? 'text-[#F5F5F8] placeholder-[#9D9CB1]'
                    : 'text-[#1B1630] placeholder-[#636073]'
                }`}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className={`cursor-pointer rounded-full p-1 transition hover:bg-white/10 ${
                    isDarkMode ? 'text-[#9D9CB1]' : 'text-[#636073]'
                  }`}
                  title="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Upload MIDI Button */}
            <UploadMidi
              onUpload={(id) => navigate(`/studio?id=${id}&source=upload`)}
              className="flex h-[55px] cursor-pointer items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-[#6E61EA] to-[#8C49F4] px-7 text-sm font-bold text-white shadow-[0_8px_24px_-4px_rgba(140,73,244,0.45),inset_0_1px_1px_rgba(255,255,255,0.3)] transition-all hover:from-[#7B6EF6] hover:to-[#9B5CF6] hover:shadow-[0_12px_28px_-4px_rgba(140,73,244,0.6)] active:scale-95 sm:text-base shrink-0"
            >
              <Upload className="h-4.5 w-4.5" />
              <span>Upload MIDI</span>
            </UploadMidi>
          </div>

          {/* Filter Preset Chips (No 'All' Pill, Multi-Selectable) */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {PRESET_FILTERS.map((filter) => {
              const isActive = activeFilters.has(filter)
              return (
                <button
                  key={filter}
                  onClick={() => toggleFilter(filter)}
                  className={`cursor-pointer rounded-full px-4 py-2 text-xs font-semibold tracking-wide transition-all duration-200 sm:text-sm active:scale-95 ${
                    isActive
                      ? isDarkMode
                        ? 'border border-[#8C49F4] bg-[#8C49F4] text-white shadow-[0_0_20px_rgba(140,73,244,0.5)]'
                        : 'border border-[#843EEA] bg-[#843EEA] text-white shadow-[0_0_18px_rgba(132,62,234,0.35)]'
                      : isDarkMode
                      ? 'border border-white/[0.08] bg-[#1F1936]/70 text-[#9D9CB1] hover:border-white/20 hover:text-[#F5F5F8]'
                      : 'border border-[#1B1630]/[0.08] bg-white/75 text-[#636073] hover:border-[#1B1630]/[0.2] hover:text-[#1B1630]'
                  }`}
                >
                  {filter}
                </button>
              )
            })}

            {activeFilters.size > 0 && (
              <button
                onClick={() => setActiveFilters(new Set())}
                className="cursor-pointer text-xs font-medium text-[#6E61EA] hover:underline pl-2"
              >
                Reset filters
              </button>
            )}
          </div>
        </div>

        {/* 4. Modern Card-Based Song List with Track Unpacking */}
        <div className="relative z-10 mx-auto mt-8 w-full max-w-5xl space-y-4">
          <AnimatePresence mode="popLayout">
            {filteredSongs.length > 0 ? (
              filteredSongs.map((song, index) => {
                const customTitle = customTitles[song.id]
                const { title, artist, genre } = getSongDetails(song, customTitle)
                const durationFormatted = song.duration ? formatTime(song.duration) : '--:--'

                const tracks = songTracksMap.get(song.id) || []
                const isMultiTrack = tracks.length > 1
                const isExpanded = expandedSongIds.has(song.id)

                return (
                  <motion.div
                    key={song.id || index}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.3) }}
                    onClick={() => toggleExpand(song.id, isMultiTrack)}
                    className={`group relative flex flex-col rounded-[26px] p-5 transition-all duration-300 md:px-8 md:py-5.5 ${
                      isMultiTrack ? 'cursor-pointer' : ''
                    } ${
                      isDarkMode
                        ? 'border border-white/[0.08] bg-[#1F1936]/70 shadow-[0px_24px_60px_-30px_rgba(0,0,0,0.9)] hover:border-[#8C49F4]/40 hover:bg-[#251E42]/80'
                        : 'border border-[#1B1630]/[0.08] bg-white/75 backdrop-blur-2xl shadow-[0_12px_40px_rgba(27,22,48,0.04)] hover:border-[#843EEA]/30 hover:bg-white/95'
                    }`}
                  >
                    {/* Top Row: Song Header */}
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                      {/* Left: Icon + Title & Artist Attribution */}
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors ${
                            isDarkMode
                              ? 'bg-[#8C49F4]/15 text-[#8C49F4] group-hover:bg-[#8C49F4]/25'
                              : 'bg-[#843EEA]/10 text-[#843EEA] group-hover:bg-[#843EEA]/15'
                          }`}
                        >
                          <Music className="h-6 w-6" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {editingTitleId === song.id ? (
                              <input
                                autoFocus
                                type="text"
                                value={editingTitleText}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => setEditingTitleText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveTitle(song.id)
                                  if (e.key === 'Escape') setEditingTitleId(null)
                                }}
                                onBlur={() => handleSaveTitle(song.id)}
                                className={`rounded-lg border px-2 py-0.5 text-base font-bold outline-none sm:text-lg ${
                                  isDarkMode
                                    ? 'border-[#8C49F4] bg-[#120D24] text-white'
                                    : 'border-[#843EEA] bg-white text-[#1B1630]'
                                }`}
                              />
                            ) : (
                              <h3
                                onDoubleClick={(e) => handleStartEditingTitle(song.id, title, e)}
                                title="Double-click to rename song"
                                className={`font-display text-lg font-bold tracking-tight truncate transition-colors sm:text-xl select-none ${
                                  isDarkMode ? 'text-[#F5F5F8]' : 'text-[#1B1630]'
                                }`}
                              >
                                {title}
                              </h3>
                            )}

                            {/* Multi-Track Indicator Arrow */}
                            {isMultiTrack && (
                              <span
                                className={`inline-flex items-center text-xs font-semibold ${
                                  isDarkMode ? 'text-[#AE8DFC]' : 'text-[#6E61EA]'
                                }`}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 transition-transform duration-200" />
                                )}
                              </span>
                            )}
                          </div>

                          <p
                            className={`text-sm truncate transition-colors ${
                              isDarkMode ? 'text-[#9D9CB1]' : 'text-[#636073]'
                            }`}
                          >
                            {artist}
                          </p>
                        </div>
                      </div>

                      {/* Middle & Right: Song Tags / Genre Badges, Duration & Actions */}
                      <div className="flex items-center gap-4 sm:gap-6 shrink-0 justify-between sm:justify-end">
                        {/* Attached Song Tags or Fallback Genre Tag Pill */}
                        {(customTagsMap[song.id] || song.tags || []).length > 0 ? (
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            {(customTagsMap[song.id] || song.tags || []).map((tag) => (
                              <span
                                key={tag}
                                className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide whitespace-nowrap ${
                                  isDarkMode
                                    ? 'border-[#AE8DFC]/30 bg-[#AE8DFC]/10 text-[#AE8DFC]'
                                    : 'border-[#8C49F4]/30 bg-[#8C49F4]/10 text-[#8C49F4]'
                                }`}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span
                            className={`rounded-full border px-3.5 py-1 text-xs font-semibold tracking-wide ${
                              genre === 'Chiptune'
                                ? isDarkMode
                                  ? 'border-[#AE8DFC]/30 bg-[#AE8DFC]/10 text-[#AE8DFC]'
                                  : 'border-[#8C49F4]/30 bg-[#8C49F4]/10 text-[#8C49F4]'
                                : genre === 'Jazz'
                                ? isDarkMode
                                  ? 'border-amber-400/30 bg-amber-400/10 text-amber-300'
                                  : 'border-amber-600/30 bg-amber-600/10 text-amber-700'
                                : genre === 'Electronic'
                                ? isDarkMode
                                  ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300'
                                  : 'border-cyan-600/30 bg-cyan-600/10 text-cyan-700'
                                : isDarkMode
                                ? 'border-purple-400/30 bg-purple-400/10 text-purple-300'
                                : 'border-purple-600/30 bg-purple-600/10 text-purple-700'
                            }`}
                          >
                            {genre}
                          </span>
                        )}

                        {/* Length / Duration in Monospace */}
                        <span
                          className={`font-mono text-sm font-medium ${
                            isDarkMode ? 'text-[#9D9CB1]' : 'text-[#636073]'
                          }`}
                        >
                          {durationFormatted}
                        </span>

                        {/* Action Buttons: [Play] [Studio] */}
                        <div className="flex items-center gap-2.5">
                          {/* Play Button (50x50px Primary Purple) */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/play?id=${song.id}&source=${song.source || 'local'}`)
                            }}
                            className="flex h-[48px] w-[48px] cursor-pointer items-center justify-center rounded-full bg-[#8C49F4] text-white shadow-[0_0_28px_-6px_rgba(140,73,244,0.65)] transition-all hover:scale-105 hover:bg-[#9B5CF6] hover:shadow-[0_0_35px_-4px_rgba(140,73,244,0.8)] active:scale-95 md:h-[50px] md:w-[50px]"
                            title="Play Song"
                          >
                            <Play className="ml-0.5 h-5 w-5 fill-current text-white" />
                          </button>

                          {/* Studio Button (50x50px Glass Border) */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/studio?id=${song.id}&source=${song.source || 'local'}`)
                            }}
                            className={`flex h-[48px] w-[48px] cursor-pointer items-center justify-center rounded-full border transition-all hover:scale-105 active:scale-95 md:h-[50px] md:w-[50px] ${
                              isDarkMode
                                ? 'border-white/10 bg-[#120D24]/60 text-[#F5F5F8] hover:border-[#8C49F4]/50 hover:bg-[#8C49F4]/15'
                                : 'border-[#1B1630]/[0.1] bg-[#F8F8FE]/80 text-[#1B1630] hover:border-[#843EEA]/40 hover:bg-[#843EEA]/10'
                            }`}
                            title="Open in Studio"
                          >
                            <Sliders className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Unpacked Subtitle Track Rows (Rendered directly under title, indented) */}
                    <AnimatePresence>
                      {isMultiTrack && isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-4 pt-3.5 border-t border-white/[0.06] dark:border-white/[0.06] light:border-[#1B1630]/[0.06] pl-6 sm:pl-16 space-y-2">
                            <div className="text-[11px] font-bold tracking-wider uppercase text-[#6E61EA] mb-2 flex items-center gap-1.5">
                              <AudioWaveform className="h-3.5 w-3.5" />
                              <span>Contained Tracks ({tracks.length})</span>
                            </div>

                            {tracks.map((track) => {
                              const customName = customTrackNames[song.id]?.[track.id]
                              const effectiveTrackName = customName || track.name
                              const isEditing =
                                editingTrack?.songId === song.id && editingTrack?.trackId === track.id

                              return (
                                <div
                                  key={track.id}
                                  onClick={(e) => e.stopPropagation()}
                                  className={`flex items-center justify-between rounded-xl px-3 py-2 transition-colors ${
                                    isDarkMode
                                      ? 'bg-[#120D24]/50 hover:bg-[#120D24]/80'
                                      : 'bg-[#F8F8FE]/60 hover:bg-[#F8F8FE]'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <div className="h-1.5 w-1.5 rounded-full bg-[#6E61EA]" />
                                    {isEditing ? (
                                      <input
                                        autoFocus
                                        type="text"
                                        value={editingTrackText}
                                        onChange={(e) => setEditingTrackText(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleSaveTrack(song.id, track.id)
                                          if (e.key === 'Escape') setEditingTrack(null)
                                        }}
                                        onBlur={() => handleSaveTrack(song.id, track.id)}
                                        className={`rounded px-1.5 py-0.5 text-xs font-semibold outline-none ${
                                          isDarkMode
                                            ? 'border border-[#8C49F4] bg-[#1A1D2D] text-white'
                                            : 'border border-[#843EEA] bg-white text-[#1B1630]'
                                        }`}
                                      />
                                    ) : (
                                      <span
                                        onDoubleClick={(e) =>
                                          handleStartEditingTrack(
                                            song.id,
                                            track.id,
                                            effectiveTrackName,
                                            e,
                                          )
                                        }
                                        title="Double-click to rename track"
                                        className={`text-xs sm:text-sm font-medium tracking-tight truncate select-none cursor-text ${
                                          isDarkMode ? 'text-[#C5C6D0]' : 'text-[#444860]'
                                        }`}
                                      >
                                        {effectiveTrackName}
                                      </span>
                                    )}
                                  </div>

                                  <span className="text-[11px] font-mono text-[#9D9CB1] dark:text-[#9D9CB1] light:text-[#888A95] shrink-0 pl-2">
                                    Track {track.id + 1}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })
            ) : (
              /* Empty Search / Filters State */
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`flex flex-col items-center justify-center rounded-[32px] p-12 text-center border ${
                  isDarkMode
                    ? 'border-white/[0.08] bg-[#1F1936]/40 text-[#9D9CB1]'
                    : 'border-[#1B1630]/[0.08] bg-white/60 text-[#636073]'
                }`}
              >
                <Search className="h-10 w-10 text-[#6E61EA]/60 mb-3" />
                <h4
                  className={`font-display text-xl font-bold ${
                    isDarkMode ? 'text-[#F5F5F8]' : 'text-[#1B1630]'
                  }`}
                >
                  No matching songs found
                </h4>
                <p className="mt-1 text-sm">
                  Try adjusting your search terms or filter presets.
                </p>
                <button
                  onClick={() => {
                    setSearch('')
                    setActiveFilters(new Set())
                  }}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#6E61EA] px-5 py-2 text-sm font-bold text-white shadow-md hover:bg-[#7B6EF6] transition"
                >
                  Clear all filters
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* 5. Mobile / Tablet Navigation */}
      <MobileNav isDarkMode={isDarkMode} />
    </div>
  )
}

/* =========================================================================
   Navbar Component (Identical to Homepage & About with Active Library Tab)
   ========================================================================= */

function Navbar({
  isDarkMode,
  onToggleTheme,
}: {
  isDarkMode: boolean
  onToggleTheme: (dark: boolean) => void
}) {
  return (
    <nav
      className={`fixed top-0 z-50 w-full backdrop-blur-2xl transition-colors duration-500 ${
        isDarkMode
          ? 'border-b border-white/[0.06] bg-[#101223]/85 shadow-[0_8px_32px_0_rgba(0,0,0,0.4)]'
          : 'border-b border-black/[0.05] bg-[#F6F7FB]/85 shadow-[0_8px_30px_0_rgba(36,39,58,0.03)]'
      }`}
    >
      <div className="mx-auto flex h-22 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Left: loomou Logo + Wordmark */}
        <div className="flex items-center">
          <Link to="/" className="group flex items-center gap-1.5 transition-opacity hover:opacity-90">
            <Logo
              height={62}
              width={104}
              className="h-[62px] w-auto aspect-[5/3] drop-shadow-[0_0_22px_rgba(110,97,234,0.5)] transition-transform duration-300 group-hover:scale-105"
            />
            <span
              className={`font-brand text-4xl leading-none font-semibold tracking-tight transition-all sm:text-5xl ${
                isDarkMode
                  ? 'text-[#F4F5F8]'
                  : 'bg-gradient-to-b from-[#181028] via-[#331559] to-[#633BB9] bg-clip-text text-transparent'
              }`}
            >
              loomou
            </span>
          </Link>
        </div>

        {/* Center: Floating Pill Navigation (Library Tab is Active) */}
        <div
          className={`hidden items-center gap-1 rounded-full p-1.5 backdrop-blur-2xl transition-all duration-300 md:flex sm:p-2 ${
            isDarkMode
              ? 'border border-white/[0.08] bg-[#1A1D2D]/90 shadow-[0_4px_25px_rgba(0,0,0,0.3)]'
              : 'border border-[#24273A]/[0.07] bg-white/75 shadow-[0_8px_30px_rgba(36,39,58,0.06),inset_0_1px_1px_rgba(255,255,255,0.9)]'
          }`}
        >
          <Link
            to="/"
            className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-bold transition-all sm:gap-2.5 sm:px-5 sm:py-2.5 sm:text-base ${
              isDarkMode
                ? 'text-[#A2A3B1] hover:bg-[#202333] hover:text-[#F4F5F8]'
                : 'text-[#696E87] hover:bg-white/70 hover:text-[#24273A]'
            }`}
          >
            <HomeIcon className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
            <span>Home</span>
          </Link>

          {/* Library Active Pill */}
          <Link
            to="/songs"
            className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-bold shadow-sm transition-all sm:gap-2.5 sm:px-5 sm:py-2.5 sm:text-base ${
              isDarkMode
                ? 'border border-white/10 bg-[#202333] text-[#F4F5F8]'
                : 'border border-[#24273A]/[0.08] bg-white text-[#24273A] shadow-[0_2px_10px_rgba(36,39,58,0.08)]'
            }`}
          >
            <LibraryIcon className="h-4.5 w-4.5 text-[#6E61EA] sm:h-5 sm:w-5" />
            <span>Library</span>
          </Link>

          <div className={`mx-0.5 h-4 w-px sm:mx-1 sm:h-5 ${isDarkMode ? 'bg-white/10' : 'bg-[#24273A]/10'}`} />

          <Link
            to="/freeplay"
            className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-bold transition-all sm:gap-2.5 sm:px-5 sm:py-2.5 sm:text-base ${
              isDarkMode
                ? 'text-[#A2A3B1] hover:bg-[#202333] hover:text-[#F4F5F8]'
                : 'text-[#696E87] hover:bg-white/70 hover:text-[#24273A]'
            }`}
          >
            <Piano className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
            <span>Practice</span>
          </Link>

          <Link
            to="/about"
            className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-bold transition-all sm:gap-2.5 sm:px-5 sm:py-2.5 sm:text-base ${
              isDarkMode
                ? 'text-[#A2A3B1] hover:bg-[#202333] hover:text-[#F4F5F8]'
                : 'text-[#696E87] hover:bg-white/70 hover:text-[#24273A]'
            }`}
          >
            <Users className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
            <span>About</span>
          </Link>
        </div>

        {/* Right: Dual-State Segmented Theme Toggle Pill */}
        <div className="flex items-center">
          <div
            className={`flex items-center rounded-full p-1.5 shadow-sm backdrop-blur-2xl transition-all ${
              isDarkMode
                ? 'border border-white/[0.08] bg-[#1A1D2D]/90'
                : 'border border-[#24273A]/[0.08] bg-white/80 shadow-[0_2px_8px_rgba(36,39,58,0.04)]'
            }`}
          >
            <button
              onClick={() => onToggleTheme(true)}
              className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition-all ${
                isDarkMode
                  ? 'bg-[#202333] text-[#7569EC] shadow-sm'
                  : 'text-[#696E87] hover:text-[#24273A]'
              }`}
              title="Dark Mode"
            >
              <Moon className="h-5 w-5" />
            </button>
            <button
              onClick={() => onToggleTheme(false)}
              className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition-all ${
                !isDarkMode
                  ? 'bg-[#E5E7F9] text-amber-500 shadow-sm'
                  : 'text-[#A2A3B1] hover:text-[#F4F5F8]'
              }`}
              title="Light Mode"
            >
              <Sun className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}

/* =========================================================================
   Mobile / Tablet Navigation
   ========================================================================= */

function MobileNav({ isDarkMode }: { isDarkMode: boolean }) {
  return (
    <nav
      className={`fixed bottom-0 left-0 z-50 flex w-full items-center justify-around rounded-t-3xl border-t px-4 pt-2 pb-6 backdrop-blur-2xl transition-colors md:hidden ${
        isDarkMode
          ? 'border-white/[0.08] bg-[#101223]/95 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]'
          : 'border-[#24273A]/[0.08] bg-[#F6F7FB]/95 shadow-[0_-10px_40px_rgba(36,39,58,0.06)]'
      }`}
    >
      <MobileNavItem
        icon={<HomeIcon className="h-5 w-5" />}
        label="Home"
        href="/"
        isDarkMode={isDarkMode}
      />
      <MobileNavItem
        icon={<LibraryIcon className="h-5 w-5" />}
        label="Library"
        active
        href="/songs"
        isDarkMode={isDarkMode}
      />
      <MobileNavItem
        icon={<Piano className="h-5 w-5" />}
        label="Practice"
        href="/freeplay"
        isDarkMode={isDarkMode}
      />
      <MobileNavItem
        icon={<Users className="h-5 w-5" />}
        label="About"
        href="/about"
        isDarkMode={isDarkMode}
      />
    </nav>
  )
}

function MobileNavItem({
  icon,
  label,
  active = false,
  href,
  isDarkMode,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  href: string
  isDarkMode: boolean
}) {
  return (
    <Link
      to={href}
      className={`flex flex-col items-center justify-center px-3 py-1.5 transition-all active:scale-90 ${
        active
          ? 'rounded-2xl bg-[#6E61EA]/20 text-[#6E61EA] shadow-[0_0_15px_rgba(110,97,234,0.3)]'
          : isDarkMode
          ? 'text-[#A2A3B1] hover:text-[#6E61EA]'
          : 'text-[#696E87] hover:text-[#6E61EA]'
      }`}
    >
      {icon}
      <span className="mt-1 text-[10px] font-semibold tracking-wider uppercase">{label}</span>
    </Link>
  )
}
