import { Github, Logo } from '@/icons'
import clsx from 'clsx'
import { Piano, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'

function NavLink({
  href,
  children,
  active = false,
}: {
  href: string
  children: React.ReactNode
  active?: boolean
}) {
  return (
    <Link
      to={href}
      className={`py-1 font-medium transition-all ${active ? 'border-b-2 border-[#d0bcff] text-[#d0bcff]' : 'text-[#e5e2e1]/60 hover:text-[#d0bcff]'}`}
    >
      {children}
    </Link>
  )
}

export default function AppBar() {
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav className="fixed top-0 z-50 flex h-24 w-full flex-col justify-center border-b border-white/[0.03] bg-[#16182c]/85 shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] backdrop-blur-xl transition-all duration-300">
      <div className="relative mx-auto flex w-full max-w-7xl items-center justify-between px-6">
        {/* Empty left side to balance */}
        <div className="h-10 w-10" />

        {/* Centered Logo + Title */}
        <div className="absolute left-1/2 flex -translate-x-1/2 items-center justify-center">
          <Link to="/" className="flex items-center gap-1.5 transition hover:opacity-80">
            <Logo
              height={45}
              width={75}
              className="h-11 w-auto aspect-[5/3] drop-shadow-[0_0_15px_rgba(160,120,255,0.4)]"
            />
            <span className="font-brand text-3xl font-semibold tracking-tight text-[#e5e2e1]">loomou</span>
          </Link>
        </div>

        {/* Right Side Controls */}
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/ardakocaman100101/loophesia"
            target="_blank"
            rel="noreferrer"
            className="rounded-full p-2 text-[#cbc3d7] transition-all duration-300 hover:bg-[#3a3939] hover:text-[#d0bcff] active:scale-95"
            title="GitHub Repository"
          >
            <Github size={24} />
          </a>
        </div>
      </div>
    </nav>
  )
}
