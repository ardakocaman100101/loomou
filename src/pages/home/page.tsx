import { UploadMidi } from '@/components'
import { Logo } from '@/icons'
import {
  Activity,
  AudioWaveform,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Home as HomeIcon,
  Info,
  Layers,
  Library,
  Moon,
  Music,
  Piano,
  Play,
  Sliders,
  Sparkles,
  Sun,
  Upload,
  Users,
  X,
} from '@/icons'
import { AnimatePresence, motion } from 'motion/react'
import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useTheme } from '@/hooks'

export default function Home() {
  const [isDarkMode, setIsDarkMode] = useTheme()

  return (
    <div
      className={`min-h-screen overflow-x-hidden transition-colors duration-500 ${isDarkMode
          ? 'bg-[#101223] text-[#F4F5F8] selection:bg-[#7569EC]/40'
          : 'bg-[#F6F7FB] text-[#24273A] selection:bg-[#6E61EA]/25'
        }`}
    >
      {/* 1. Header Navigation */}
      <Navbar isDarkMode={isDarkMode} onToggleTheme={(dark) => setIsDarkMode(dark)} />

      <main className="relative flex min-h-screen flex-col items-center overflow-visible px-4 pt-36 pb-24 sm:px-6 md:pt-44">
        {/* Volumetric Radial Ambient Lighting */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* Top subtle radial light source reaching down through the hero and showcase */}
          <div
            className={`absolute top-0 left-1/2 w-full -translate-x-1/2 transition-all duration-700 ${isDarkMode
                ? 'h-[750px] bg-[radial-gradient(ellipse_at_top,rgba(110,97,234,0.18)_0%,transparent_70%)]'
                : 'h-[1150px] md:h-[1350px] bg-[radial-gradient(ellipse_at_top,rgba(110,97,234,0.38)_0%,rgba(139,128,249,0.2)_38%,rgba(175,166,255,0.08)_62%,transparent_85%)]'
              }`}
          />
          {/* Main expanded indigo glow */}
          <div
            className={`absolute left-1/2 -translate-x-1/2 rounded-full transition-all duration-700 ${isDarkMode
                ? 'top-[-90px] h-[900px] w-[1400px] bg-[#7569EC]/12 blur-[140px]'
                : 'top-[-80px] h-[1200px] w-[1500px] bg-[#6E61EA]/24 blur-[160px]'
              }`}
          />
          {/* Inner soft secondary vibrant glow */}
          <div
            className={`absolute left-1/2 -translate-x-1/2 rounded-full transition-all duration-700 ${isDarkMode
                ? 'top-[30px] h-[550px] w-[900px] bg-[#9ba4ff]/8 blur-[110px]'
                : 'top-[100px] h-[800px] w-[1100px] bg-[#8F84FB]/18 blur-[125px]'
              }`}
          />
          {/* Light mode smooth base transition to pure white */}
          {!isDarkMode && (
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#F6F7FB]/30 to-[#FFFFFF]" />
          )}
        </div>
        {/* 2. Hero Section */}
        <Hero isDarkMode={isDarkMode} />

        {/* 3. Hero App Showcase Card */}
        <HeroShowcase isDarkMode={isDarkMode} />

        {/* 4. Interactive Feature Carousel */}
        <FeatureCarousel isDarkMode={isDarkMode} />
      </main>

      {/* 5. Mobile / Tablet Responsive Navigation Bar (Appears earlier on < 1100px screens) */}
      <MobileNav isDarkMode={isDarkMode} />
    </div>
  )
}

/* =========================================================================
   1. Header Navigation Bar (Theme Adaptive - 2026 NYC Designer Minimal)
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
      className={`fixed top-0 z-50 w-full backdrop-blur-2xl transition-colors duration-500 ${isDarkMode
          ? 'border-b border-white/[0.06] bg-[#101223]/85 shadow-[0_8px_32px_0_rgba(0,0,0,0.4)]'
          : 'border-b border-black/[0.05] bg-[#F6F7FB]/85 shadow-[0_8px_30px_0_rgba(36,39,58,0.03)]'
        }`}
    >
      <div className="mx-auto flex h-22 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Left: loomo Logo + Wordmark (20% bigger, tighter fit) */}
        <div className="flex items-center">
          <Link to="/" className="group flex items-center gap-1.5 transition-opacity hover:opacity-90">
            <Logo
              height={62}
              width={104}
              className="h-[62px] w-auto aspect-[5/3] drop-shadow-[0_0_22px_rgba(110,97,234,0.5)] transition-transform duration-300 group-hover:scale-105"
            />
            <span
              className={`font-brand text-4xl leading-none font-semibold tracking-tight transition-all sm:text-5xl ${isDarkMode
                  ? 'text-[#F4F5F8]'
                  : 'bg-gradient-to-b from-[#181028] via-[#331559] to-[#633BB9] bg-clip-text text-transparent'
                }`}
            >
              loomou
            </span>
          </Link>
        </div>

        {/* Center: Floating Pill Navigation (+20% larger text and icons) */}
        <div
          className={`hidden items-center gap-1 rounded-full p-1.5 backdrop-blur-2xl transition-all duration-300 md:flex sm:p-2 ${isDarkMode
              ? 'border border-white/[0.08] bg-[#1A1D2D]/90 shadow-[0_4px_25px_rgba(0,0,0,0.3)]'
              : 'border border-[#24273A]/[0.07] bg-white/75 shadow-[0_8px_30px_rgba(36,39,58,0.06),inset_0_1px_1px_rgba(255,255,255,0.9)]'
            }`}
        >
          {/* Home Active Pill */}
          <Link
            to="/"
            className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-bold shadow-sm transition-all sm:gap-2.5 sm:px-5 sm:py-2.5 sm:text-base ${isDarkMode
                ? 'border border-white/10 bg-[#202333] text-[#F4F5F8]'
                : 'border border-[#24273A]/[0.08] bg-white text-[#24273A] shadow-[0_2px_10px_rgba(36,39,58,0.08)]'
              }`}
          >
            <HomeIcon className="h-4.5 w-4.5 text-[#6E61EA] sm:h-5 sm:w-5" />
            <span>Home</span>
          </Link>

          <Link
            to="/songs"
            className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-bold transition-all sm:gap-2.5 sm:px-5 sm:py-2.5 sm:text-base ${isDarkMode
                ? 'text-[#A2A3B1] hover:bg-[#202333] hover:text-[#F4F5F8]'
                : 'text-[#696E87] hover:bg-white/70 hover:text-[#24273A]'
              }`}
          >
            <Library className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
            <span>Library</span>
          </Link>

          {/* Subtle separator */}
          <div className={`mx-0.5 h-4 w-px sm:mx-1 sm:h-5 ${isDarkMode ? 'bg-white/10' : 'bg-[#24273A]/10'}`} />

          <Link
            to="/freeplay"
            className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-bold transition-all sm:gap-2.5 sm:px-5 sm:py-2.5 sm:text-base ${isDarkMode
                ? 'text-[#A2A3B1] hover:bg-[#202333] hover:text-[#F4F5F8]'
                : 'text-[#696E87] hover:bg-white/70 hover:text-[#24273A]'
              }`}
          >
            <Piano className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
            <span>Practice</span>
          </Link>

          <Link
            to="/about"
            className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-bold transition-all sm:gap-2.5 sm:px-5 sm:py-2.5 sm:text-base ${isDarkMode
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
            className={`flex items-center rounded-full p-1.5 shadow-sm backdrop-blur-2xl transition-all ${isDarkMode
                ? 'border border-white/[0.08] bg-[#1A1D2D]/90'
                : 'border border-[#24273A]/[0.08] bg-white/80 shadow-[0_2px_8px_rgba(36,39,58,0.04)]'
              }`}
          >
            <button
              onClick={() => onToggleTheme(true)}
              className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition-all ${isDarkMode
                  ? 'bg-[#202333] text-[#7569EC] shadow-sm'
                  : 'text-[#696E87] hover:text-[#24273A]'
                }`}
              title="Dark Mode"
            >
              <Moon className="h-5 w-5" />
            </button>
            <button
              onClick={() => onToggleTheme(false)}
              className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition-all ${!isDarkMode
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
   2. Hero Section (2026 NYC Designer Minimal)
   ========================================================================= */

const VERBS = ['make', 'play', 'learn']

function Hero({ isDarkMode }: { isDarkMode: boolean }) {
  const navigate = useNavigate()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % VERBS.length)
    }, 2200)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative z-10 mx-auto w-full max-w-5xl space-y-7 text-center">
      {/* 3D Rotating Verb Tagline */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="space-y-4"
      >
        <div
          className={`mb-2 flex w-full items-center justify-center gap-[0.35em] font-display text-base font-bold tracking-[0.28em] uppercase select-none transition-colors sm:text-lg md:text-xl ${isDarkMode ? 'text-[#A2A3B1]' : 'text-[#484C66]'
            }`}
        >
          <motion.span layout>just</motion.span>
          <motion.span
            layout
            className="relative inline-flex h-[1.5em] items-center justify-center overflow-visible font-extrabold text-[#6E61EA]"
            style={{ perspective: '1000px' }}
          >
            <span className="pointer-events-none invisible whitespace-nowrap select-none">
              {VERBS[index]}
            </span>

            <AnimatePresence mode="popLayout">
              <motion.span
                key={index}
                initial={{ y: '80%', rotateX: 90, z: -40, opacity: 0 }}
                animate={{ y: '0%', rotateX: 0, z: 0, opacity: 1 }}
                exit={{ y: '-80%', rotateX: -90, z: -40, opacity: 0 }}
                transition={{
                  y: { type: 'spring', stiffness: 220, damping: 20 },
                  rotateX: { type: 'spring', stiffness: 220, damping: 20 },
                  z: { type: 'spring', stiffness: 220, damping: 20 },
                  opacity: { duration: 0.15 },
                }}
                className="absolute flex transform-gpu items-center justify-center whitespace-nowrap"
                style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
              >
                {VERBS[index]}
              </motion.span>
            </AnimatePresence>
          </motion.span>
          <motion.span layout>music</motion.span>
        </div>

        {/* Main loomou Title */}
        <h1
          className={`font-brand bg-clip-text text-7xl leading-none font-semibold tracking-tight text-transparent transition-all sm:text-8xl md:text-9xl ${isDarkMode
              ? 'bg-gradient-to-b from-[#FFFFFF] via-[#F4F5F8] to-[#888A95]'
              : 'bg-gradient-to-b from-[#181028] via-[#331559] to-[#633BB9]'
            }`}
        >
          loomou
        </h1>

        {/* Subtitle (20% bigger & 20% higher contrast studio gray) */}
        <p
          className={`mx-auto max-w-2xl text-lg leading-relaxed font-normal transition-colors sm:text-xl md:text-[22px] ${isDarkMode ? 'text-[#B6B8C6]' : 'text-[#444860]'
            }`}
        >
          Play or remix your favorite songs in just weeks. With loomou AI by your side, you can easily teach yourself without any prior experience
        </p>
      </motion.div>

      {/* Centered Tighter Action Buttons: [Upload MIDI] [Try Now] */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15, duration: 0.7 }}
        className="flex flex-wrap items-center justify-center gap-3.5 pt-4 sm:pt-5"
      >
        {/* 1. Upload MIDI Button */}
        <UploadMidi
          onUpload={(id) => navigate(`/studio?id=${id}&source=upload`)}
          className="group relative flex cursor-pointer items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-[#6E61EA] to-[#7B6EF6] px-7 py-3 text-sm font-bold text-white shadow-[0_10px_25px_-5px_rgba(110,97,234,0.45),inset_0_1px_1px_rgba(255,255,255,0.3)] transition-all hover:from-[#7B6EF6] hover:to-[#887BFC] active:scale-95 sm:text-base"
        >
          <Upload className="h-4.5 w-4.5" />
          <span>Upload MIDI</span>
        </UploadMidi>

        {/* 2. Try Now Button (Navigates to Library with Music Note Icon) */}
        <Link
          to="/songs"
          className={`flex items-center justify-center gap-2.5 rounded-full px-7 py-3 text-sm font-bold shadow-sm transition-all active:scale-95 sm:text-base ${isDarkMode
              ? 'border border-white/[0.08] bg-[#1A1D2D]/90 text-[#F4F5F8] hover:border-white/20 hover:bg-[#202333]'
              : 'border border-[#24273A]/[0.08] bg-white/80 text-[#24273A] backdrop-blur-md hover:border-[#24273A]/[0.18] hover:bg-white shadow-[0_4px_16px_rgba(36,39,58,0.05)]'
            }`}
        >
          <Music className="h-4.5 w-4.5 text-[#6E61EA]" />
          <span>Try Now</span>
        </Link>
      </motion.div>
    </div>
  )
}

/* =========================================================================
   3. Hero Showcase Card (Theme Adaptive - Monolith Glass)
   ========================================================================= */

function HeroShowcase({
  isDarkMode,
}: {
  isDarkMode: boolean
}) {
  return (
    <section className="relative z-10 mx-auto mt-20 w-full max-w-5xl md:mt-24">
      <div
        className={`group relative aspect-[1744/966] w-full overflow-hidden rounded-[32px] border transition-all ${
          isDarkMode
            ? 'border-white/[0.08] bg-[#1A1D2D] shadow-[0_25px_70px_rgba(0,0,0,0.6)]'
            : 'border-[#24273A]/[0.08] bg-white/85 backdrop-blur-2xl shadow-[0_30px_80px_-15px_rgba(36,39,58,0.08),0_1px_3px_rgba(36,39,58,0.04)]'
        }`}
      >
        <video
          autoPlay
          loop
          muted
          playsInline
          poster="/assets/home/hero-demo-poster.png"
          className="h-full w-full object-cover object-center"
        >
          <source src="/assets/home/hero-demo-video.mp4" type="video/mp4" />
          <source src="/assets/home/hero-demo-video.webm" type="video/webm" />
          <img
            src="/assets/home/hero-demo-poster.png"
            alt="loomou piano waterfall demo"
            className="h-full w-full object-cover object-center"
          />
        </video>
      </div>
    </section>
  )
}

/* =========================================================================
   4. Feature Section: Interactive Carousel (Theme Adaptive - Monolith Card)
   ========================================================================= */

const SLIDES = [
  {
    id: 'ai',
    badge: 'AI Instructor',
    icon: Sparkles,
    title: 'loomou AI',
    description:
      'Meet loomou AI, your personal music tutor. Just upload or create a song and perform it while loomou studies the track, watches you play and gives you instant feedback to help you improve',
    cta: 'Upload a file →',
    isUpload: true,
    route: '',
    image: '/assets/home/slide-midi.png',
  },
  {
    id: 'studio',
    badge: 'Your Simplified Workspace',
    icon: AudioWaveform,
    title: 'Studio',
    description:
      'Edit or build your own songs right inside loomou using our beginner-friendly digital studio',
    cta: 'Open Studio →',
    isUpload: false,
    route: '/studio',
    image: '/assets/home/slide-studio.png',
  },
  {
    id: 'play',
    badge: 'Just Play Music',
    icon: Piano,
    title: 'Play',
    description:
      'Jump right into playing with loomou, no music background required. Just follow the engaging visuals while loomou collects all the data it needs to guide your progress',
    cta: 'Start a session →',
    isUpload: false,
    route: '/freeplay',
    image: '/assets/home/slide-play.png',
  },
]

function FeatureCarousel({ isDarkMode }: { isDarkMode: boolean }) {
  const navigate = useNavigate()
  const [current, setCurrent] = useState(0)
  const [direction, setDirection] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  const slideNext = () => {
    setDirection(1)
    setCurrent((prev) => (prev + 1) % SLIDES.length)
  }

  const slidePrev = () => {
    setDirection(-1)
    setCurrent((prev) => (prev - 1 + SLIDES.length) % SLIDES.length)
  }

  // Auto-play interval
  useEffect(() => {
    if (isPaused) return
    const timer = setInterval(slideNext, 6000)
    return () => clearInterval(timer)
  }, [isPaused, current])

  const slide = SLIDES[current]
  const SlideIcon = slide.icon

  return (
    <section
      className="relative z-10 mx-auto mt-20 w-full max-w-5xl"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Carousel Container */}
      <div
        className={`relative min-h-[420px] w-full overflow-hidden rounded-[32px] p-6 transition-all duration-300 md:min-h-[460px] md:p-10 ${isDarkMode
            ? 'border border-white/[0.1] bg-[#222538] shadow-[0_20px_60px_rgba(0,0,0,0.5)]'
            : 'border border-[#24273A]/[0.07] bg-white/90 backdrop-blur-2xl shadow-[0_25px_65px_-10px_rgba(36,39,58,0.07),0_1px_2px_rgba(36,39,58,0.04)]'
          }`}
      >
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={slide.id}
            custom={direction}
            initial={{ opacity: 0, x: direction > 0 ? 60 : -60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction > 0 ? -60 : 60 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="grid h-full grid-cols-1 items-center gap-8 md:grid-cols-2"
          >
            {/* Slide Left: Info & CTAs */}
            <div className="flex flex-col justify-center space-y-5 pb-12 md:pb-8">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${isDarkMode ? 'bg-[#7569EC]/15 text-[#7569EC]' : 'bg-[#6E61EA]/10 text-[#6E61EA]'
                    }`}
                >
                  <SlideIcon className="h-4.5 w-4.5" />
                </div>
                <span className="text-xs font-black tracking-widest text-[#6E61EA] uppercase">
                  {slide.badge}
                </span>
              </div>

              <h3
                className={`font-display text-3xl font-black tracking-tight transition-colors sm:text-4xl md:text-5xl ${isDarkMode ? 'text-[#F4F5F8]' : 'text-[#24273A]'
                  }`}
              >
                {slide.title}
              </h3>

              <p
                className={`text-base leading-relaxed transition-colors md:text-lg ${isDarkMode ? 'text-[#A2A3B1]' : 'text-[#5E637D]'
                  }`}
              >
                {slide.description}
              </p>

              <div className="pt-2">
                {slide.isUpload ? (
                  <UploadMidi
                    onUpload={(id) => navigate(`/studio?id=${id}&source=upload`)}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-gradient-to-r from-[#6E61EA] to-[#7B6EF6] px-6 py-3 text-sm font-bold text-white shadow-[0_8px_24px_-4px_rgba(110,97,234,0.45),inset_0_1px_1px_rgba(255,255,255,0.3)] transition-all hover:from-[#7B6EF6] hover:to-[#887BFC] active:scale-95"
                  >
                    <span>{slide.cta}</span>
                  </UploadMidi>
                ) : (
                  <Link
                    to={slide.route}
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#6E61EA] to-[#7B6EF6] px-6 py-3 text-sm font-bold text-white shadow-[0_8px_24px_-4px_rgba(110,97,234,0.45),inset_0_1px_1px_rgba(255,255,255,0.3)] transition-all hover:from-[#7B6EF6] hover:to-[#887BFC] active:scale-95"
                  >
                    <span>{slide.cta}</span>
                  </Link>
                )}
              </div>
            </div>

            {/* Slide Right: Visual Card Preview / AI Character */}
            <div
              className={`relative aspect-[4/3] w-full overflow-hidden rounded-2xl shadow-inner transition-colors flex items-center justify-center ${
                isDarkMode
                  ? 'border border-white/[0.08] bg-[#161828]'
                  : 'border border-[#24273A]/[0.06] bg-[#EEF1FA]'
              }`}
            >
              {slide.id === 'ai' ? (
                <div className="relative flex h-full w-full flex-col items-center justify-center p-6">
                  {/* Ambient Glow */}
                  <div className="relative flex items-center justify-center">
                    <div
                      className={`absolute inset-0 rounded-full blur-2xl transition-all duration-500 opacity-75 ${
                        isDarkMode ? 'bg-[#6c79f0]/40' : 'bg-[#6c79f0]/25'
                      }`}
                    />
                    <Logo
                      width={120}
                      height={72}
                      className="relative drop-shadow-[0_0_24px_rgba(108,121,240,0.6)] animate-pulse"
                    />
                  </div>
                  <div
                    className={`mt-5 w-full max-w-sm rounded-2xl border p-3.5 text-center shadow-lg transition-all ${
                      isDarkMode
                        ? 'border-white/10 bg-[#101223]/90 text-white'
                        : 'border-[#6c79f0]/20 bg-white/95 text-gray-900'
                    }`}
                  >
                    <p className="text-xs font-black tracking-wider text-[#6c79f0] uppercase">loomou AI Tutor</p>
                    <p className="mt-1 text-xs sm:text-[13px] font-semibold opacity-90 leading-relaxed">
                      "Ready whenever you are! Upload a song or start playing to get personalized guidance."
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <img
                    src={slide.image}
                    alt={slide.title}
                    className="h-full w-full object-cover object-center"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).src = '/images/mode_falling_notes_screenshot.png'
                    }}
                  />
                  <div
                    className={`absolute inset-0 bg-gradient-to-tr via-transparent to-transparent ${
                      isDarkMode ? 'from-[#101223]/80' : 'from-[#F6F7FB]/60'
                    }`}
                  />
                </>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Combined Bottom Controls: Wider Pagination Bars + Navigation Arrows on the Left */}
        <div className="absolute left-6 bottom-6 flex items-center gap-3.5 md:left-10 md:bottom-8">
          {/* Wider Pagination Bars */}
          <div className="flex items-center gap-2">
            {SLIDES.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => {
                  setDirection(idx > current ? 1 : -1)
                  setCurrent(idx)
                }}
                className={`h-2.5 cursor-pointer rounded-full transition-all duration-300 ${idx === current
                    ? 'w-16 bg-[#6E61EA] sm:w-20'
                    : isDarkMode
                      ? 'w-5 bg-[#343852] hover:bg-white/30 sm:w-6'
                      : 'w-5 bg-[#D8DCEB] hover:bg-[#696E87]/40 sm:w-6'
                  }`}
                title={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>

          {/* Navigation Arrows placed immediately to the right */}
          <div className="flex items-center gap-1.5 pl-1">
            <button
              onClick={slidePrev}
              className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-full shadow-md backdrop-blur-md transition-all hover:bg-[#6E61EA] hover:text-white active:scale-90 ${isDarkMode
                  ? 'border border-white/[0.08] bg-[#2d324b] text-[#F4F5F8] hover:border-[#6E61EA]/50'
                  : 'border border-[#24273A]/[0.08] bg-[#EEF1FA] text-[#24273A] hover:border-[#6E61EA]/50'
                }`}
              title="Previous Slide"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={slideNext}
              className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-full shadow-md backdrop-blur-md transition-all hover:bg-[#6E61EA] hover:text-white active:scale-90 ${isDarkMode
                  ? 'border border-white/[0.08] bg-[#2d324b] text-[#F4F5F8] hover:border-[#6E61EA]/50'
                  : 'border border-[#24273A]/[0.08] bg-[#EEF1FA] text-[#24273A] hover:border-[#6E61EA]/50'
                }`}
              title="Next Slide"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}


/* =========================================================================
   6. Mobile / Tablet Navigation (Theme Adaptive)
   ========================================================================= */

function MobileNav({ isDarkMode }: { isDarkMode: boolean }) {
  return (
    <nav
      className={`fixed bottom-0 left-0 z-50 flex w-full items-center justify-around rounded-t-3xl border-t px-4 pt-2 pb-6 backdrop-blur-2xl transition-colors md:hidden ${isDarkMode
          ? 'border-white/[0.08] bg-[#101223]/95 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]'
          : 'border-[#24273A]/[0.08] bg-[#F6F7FB]/95 shadow-[0_-10px_40px_rgba(36,39,58,0.06)]'
        }`}
    >
      <MobileNavItem
        icon={<HomeIcon className="h-5 w-5" />}
        label="Home"
        active
        href="/"
        isDarkMode={isDarkMode}
      />
      <MobileNavItem
        icon={<Library className="h-5 w-5" />}
        label="Library"
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
      className={`flex flex-col items-center justify-center px-3 py-1.5 transition-all active:scale-90 ${active
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
