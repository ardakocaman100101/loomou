import { VolumeSliderButton } from '@/features/controls'
import { Logo, Midi } from '@/icons'
import { ButtonWithTooltip } from '@/pages/play/components/TopBar'
import { ArrowLeft } from 'lucide-react'
import { MouseEvent } from 'react'
import { Link } from 'react-router'

type TopBarProps = {
  onClickBack: () => void
  onClickHome?: () => void
  onClickMidi: (e: MouseEvent<any>) => void
}

export default function TopBar({ onClickBack, onClickHome, onClickMidi }: TopBarProps) {
  return (
    <div className="fixed top-0 left-0 z-40 flex h-[78px] w-full items-center border-b border-white/5 bg-[#131313]/20 px-4 shadow-[0_8px_32px_rgba(0,0,0,0.37)] backdrop-blur-3xl select-none sm:px-6">
      {/* Left side: Back button */}
      <div className="flex items-center">
        <ButtonWithTooltip tooltip="Back" onClick={onClickBack}>
          <ArrowLeft size={28} className="cursor-pointer text-white/70 hover:text-white sm:h-8 sm:w-8" />
        </ButtonWithTooltip>
      </div>

      {/* Center: Absolute centered loomo Identity */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <Link to="/" onClick={onClickHome} className="group flex items-center gap-1.5">
          <Logo
            height={54}
            width={90}
            className="h-[54px] w-auto aspect-[5/3] cursor-pointer drop-shadow-[0_0_15px_rgba(160,120,255,0.3)] transition-all group-hover:scale-105 sm:h-[60px]"
          />
          <span className="font-brand cursor-pointer text-2xl font-bold tracking-tight text-[#e5e2e1] transition-all group-hover:text-[#d0bcff] sm:text-4xl">
            loomou
          </span>
        </Link>
      </div>

      {/* Right side: Volume */}
      <div className="ml-auto flex items-center gap-3 sm:gap-6">
        <VolumeSliderButton />
      </div>
    </div>
  )
}
