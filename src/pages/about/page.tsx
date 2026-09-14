import { Logo } from '@/icons'
import {
  ArrowRight,
  AudioWaveform,
  BookOpen,
  Code2,
  Home as HomeIcon,
  Library,
  MessageSquareHeart,
  Moon,
  Music2,
  Piano,
  Send,
  Sparkles,
  Sun,
  Users,
} from '@/icons'
import { motion } from 'motion/react'
import React, { useState } from 'react'
import { Link } from 'react-router'
import { useTheme } from '@/hooks'

export default function AboutPage() {
  const [isDarkMode, setIsDarkMode] = useTheme()

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

      {/* 2. Main Content Area (No standalone header title, direct chic editorial start) */}
      <main className="relative flex min-h-screen flex-col items-center overflow-visible px-4 pt-32 pb-28 sm:px-6 md:pt-36">
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

        {/* Chic Structured Story Cards */}
        <div className="relative z-10 mx-auto w-full max-w-4xl space-y-7 md:space-y-8">
          {/* Card 1: What is loomou? */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className={`group rounded-[32px] p-8 transition-all duration-300 md:p-10 ${
              isDarkMode
                ? 'border border-white/[0.08] bg-[#1A1D2D] shadow-[0_20px_60px_rgba(0,0,0,0.5)]'
                : 'border border-[#24273A]/[0.07] bg-white/90 backdrop-blur-2xl shadow-[0_25px_65px_-10px_rgba(36,39,58,0.07)]'
            }`}
          >
            <div className="flex items-center gap-3 pb-2">
              <Logo height={32} width={52} className="h-8 w-auto aspect-[5/3]" />
              <h2
                className={`font-display text-2xl font-black tracking-tight transition-colors sm:text-3xl ${
                  isDarkMode ? 'text-[#F4F5F8]' : 'text-[#24273A]'
                }`}
              >
                What is loomou?
              </h2>
            </div>

            <p
              className={`mt-4 text-base leading-relaxed transition-colors md:text-lg ${
                isDarkMode ? 'text-[#A2A3B1]' : 'text-[#5E637D]'
              }`}
            >
              loomou is a music making and learning platform designed for amateur musicians and
              complete beginners. Visually engaging falling notes simplify playing for any skill
              level. loomou AI collects hidden metrics while you play and tailors customized feedback
              for each session, allowing everyone to learn at their own pace without needing an
              instructor. In the native studio, users can edit and mix tracks to give them a creative
              edge.
            </p>

            {/* Feature Pills */}
            <div className="grid grid-cols-1 gap-3.5 pt-7 sm:grid-cols-3">
              <div
                className={`flex items-center gap-3 rounded-2xl p-4 transition-all duration-300 ${
                  isDarkMode
                    ? 'border border-white/[0.06] bg-[#202333]/90 hover:border-white/15'
                    : 'border border-[#24273A]/[0.06] bg-[#EEF1FA]/80 hover:bg-[#EEF1FA]'
                }`}
              >
                <Piano className="h-5 w-5 shrink-0 text-[#6E61EA]" />
                <span className="text-sm font-semibold">Falling Notes Waterfall</span>
              </div>
              <div
                className={`flex items-center gap-3 rounded-2xl p-4 transition-all duration-300 ${
                  isDarkMode
                    ? 'border border-white/[0.06] bg-[#202333]/90 hover:border-white/15'
                    : 'border border-[#24273A]/[0.06] bg-[#EEF1FA]/80 hover:bg-[#EEF1FA]'
                }`}
              >
                <Sparkles className="h-5 w-5 shrink-0 text-[#6E61EA]" />
                <span className="text-sm font-semibold">Real-Time loomou AI</span>
              </div>
              <div
                className={`flex items-center gap-3 rounded-2xl p-4 transition-all duration-300 ${
                  isDarkMode
                    ? 'border border-white/[0.06] bg-[#202333]/90 hover:border-white/15'
                    : 'border border-[#24273A]/[0.06] bg-[#EEF1FA]/80 hover:bg-[#EEF1FA]'
                }`}
              >
                <AudioWaveform className="h-5 w-5 shrink-0 text-[#6E61EA]" />
                <span className="text-sm font-semibold">Native Web Studio</span>
              </div>
            </div>
          </motion.div>

          {/* Card 2: The Backstory */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className={`group rounded-[32px] p-8 transition-all duration-300 md:p-10 ${
              isDarkMode
                ? 'border border-white/[0.08] bg-[#1A1D2D] shadow-[0_20px_60px_rgba(0,0,0,0.5)]'
                : 'border border-[#24273A]/[0.07] bg-white/90 backdrop-blur-2xl shadow-[0_25px_65px_-10px_rgba(36,39,58,0.07)]'
            }`}
          >
            <div className="flex items-center gap-3.5 pb-2">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                  isDarkMode ? 'bg-[#7569EC]/15 text-[#7569EC]' : 'bg-[#6E61EA]/10 text-[#6E61EA]'
                }`}
              >
                <BookOpen className="h-5 w-5" />
              </div>
              <h2
                className={`font-display text-2xl font-black tracking-tight transition-colors sm:text-3xl ${
                  isDarkMode ? 'text-[#F4F5F8]' : 'text-[#24273A]'
                }`}
              >
                The Backstory
              </h2>
            </div>

            <p
              className={`mt-4 text-base leading-relaxed transition-colors md:text-lg ${
                isDarkMode ? 'text-[#A2A3B1]' : 'text-[#5E637D]'
              }`}
            >
              loomou started as a hobby project by a computer scientist who wanted to learn how to play
              keyboard. While there are many software options, none of them provide the freedom of
              uploading or editing music and they are remarkably expensive. This sparked a great
              opportunity to combine coding skills with a passion for music. That is when loomou was
              born and many more features have been added since. The AI integration was a game
              changer, transforming the web app into a unique product without any comparable rival on
              the market. Over time, it slowly became an obsession, up to the point where it felt
              selfish not to share it publicly.
            </p>
          </motion.div>

          {/* Grid 2-Column: Become a Contributor & Feedback */}
          <div className="grid grid-cols-1 gap-7 md:grid-cols-2 md:gap-8">
            {/* Card 3: Become a Contributor */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className={`flex flex-col justify-between rounded-[32px] p-8 transition-all duration-300 md:p-9 ${
                isDarkMode
                  ? 'border border-white/[0.08] bg-[#1A1D2D] shadow-[0_20px_60px_rgba(0,0,0,0.5)]'
                  : 'border border-[#24273A]/[0.07] bg-white/90 backdrop-blur-2xl shadow-[0_25px_65px_-10px_rgba(36,39,58,0.07)]'
              }`}
            >
              <div>
                <div className="flex items-center gap-3 pb-2">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                      isDarkMode ? 'bg-[#7569EC]/15 text-[#7569EC]' : 'bg-[#6E61EA]/10 text-[#6E61EA]'
                    }`}
                  >
                    <Users className="h-4.5 w-4.5" />
                  </div>
                  <h3
                    className={`font-display text-xl font-black tracking-tight sm:text-2xl ${
                      isDarkMode ? 'text-[#F4F5F8]' : 'text-[#24273A]'
                    }`}
                  >
                    Become a Contributor
                  </h3>
                </div>

                <p
                  className={`mt-3 text-base leading-relaxed ${
                    isDarkMode ? 'text-[#A2A3B1]' : 'text-[#5E637D]'
                  }`}
                >
                  The first goal is to create a small community of music learners. We are looking for
                  artists to help populate the library. As the user base grows, contributors will be
                  able to monetize their work. Naturally, early adopters will get the biggest share.
                </p>
              </div>

              <div className="pt-6">
                <Link
                  to="/songs"
                  className="group/link inline-flex items-center gap-2 text-sm font-bold text-[#6E61EA] hover:underline"
                >
                  <span>Explore song library</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover/link:translate-x-1" />
                </Link>
              </div>
            </motion.div>

            {/* Card 4: Feedback */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className={`flex flex-col justify-between rounded-[32px] p-8 transition-all duration-300 md:p-9 ${
                isDarkMode
                  ? 'border border-white/[0.08] bg-[#1A1D2D] shadow-[0_20px_60px_rgba(0,0,0,0.5)]'
                  : 'border border-[#24273A]/[0.07] bg-white/90 backdrop-blur-2xl shadow-[0_25px_65px_-10px_rgba(36,39,58,0.07)]'
              }`}
            >
              <div>
                <div className="flex items-center gap-3 pb-2">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                      isDarkMode ? 'bg-[#7569EC]/15 text-[#7569EC]' : 'bg-[#6E61EA]/10 text-[#6E61EA]'
                    }`}
                  >
                    <MessageSquareHeart className="h-4.5 w-4.5" />
                  </div>
                  <h3
                    className={`font-display text-xl font-black tracking-tight sm:text-2xl ${
                      isDarkMode ? 'text-[#F4F5F8]' : 'text-[#24273A]'
                    }`}
                  >
                    Feedback
                  </h3>
                </div>

                <p
                  className={`mt-3 text-base leading-relaxed ${
                    isDarkMode ? 'text-[#A2A3B1]' : 'text-[#5E637D]'
                  }`}
                >
                  loomou is built by a single developer in (my) free time outside of full-time work. If
                  you would like to share feedback, it is very welcome!
                </p>
              </div>

              <div className="pt-6">
                <a
                  href="mailto:contact@loomou.eu"
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#6E61EA] to-[#7B6EF6] px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_24px_-4px_rgba(110,97,234,0.45),inset_0_1px_1px_rgba(255,255,255,0.3)] transition-all hover:from-[#7B6EF6] hover:to-[#887BFC] active:scale-95"
                >
                  <Send className="h-4 w-4" />
                  <span>Send Feedback</span>
                </a>
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      {/* 3. Mobile Navigation Bar */}
      <MobileNav isDarkMode={isDarkMode} />
    </div>
  )
}

/* =========================================================================
   Navbar Component (Identical to Homepage with Active About Tab)
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

        {/* Center: Floating Pill Navigation (About Tab is Active) */}
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

          <Link
            to="/songs"
            className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-bold transition-all sm:gap-2.5 sm:px-5 sm:py-2.5 sm:text-base ${
              isDarkMode
                ? 'text-[#A2A3B1] hover:bg-[#202333] hover:text-[#F4F5F8]'
                : 'text-[#696E87] hover:bg-white/70 hover:text-[#24273A]'
            }`}
          >
            <Library className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
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

          {/* About Active Pill */}
          <Link
            to="/about"
            className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-bold shadow-sm transition-all sm:gap-2.5 sm:px-5 sm:py-2.5 sm:text-base ${
              isDarkMode
                ? 'border border-white/10 bg-[#202333] text-[#F4F5F8]'
                : 'border border-[#24273A]/[0.08] bg-white text-[#24273A] shadow-[0_2px_10px_rgba(36,39,58,0.08)]'
            }`}
          >
            <Users className="h-4.5 w-4.5 text-[#6E61EA] sm:h-5 sm:w-5" />
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
        active
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
