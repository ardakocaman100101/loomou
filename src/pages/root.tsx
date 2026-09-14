import { GA_TRACKING_ID } from '@/features/analytics'
import styles from '@/styles/global.css?inline'
import { useEffect } from 'react'
import { Outlet, Scripts, ScrollRestoration } from 'react-router'
import { useTheme, useTouchpadNavigation } from '@/hooks'
import { Providers } from './providers'

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark bg-[#101223] text-[#F4F5F8]">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        <title>loomou</title>
        <meta name="author" content="Jake Fried" />
        <meta name="description" content="app for learning piano" />

        {/* Open Graph */}
        <meta property="og:title" content="loomou" />
        <meta property="og:site_name" content="loomou" />
        <meta property="og:description" content="app for learning piano" />
        <meta property="og:image" content="/images/mode_falling_notes_screenshot.png" />
        <meta property="og:image:alt" content="loomou demo displaying falling notes visualization" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:image"
          content="https://loomou.app/images/mode_falling_notes_screenshot.png"
        />
        <meta
          name="twitter:image:alt"
          content="loomou demo displaying falling notes visualization"
        />

        {/* Favicons */}
        <link rel="icon" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/favicon.png" />

        {/* Typography Fonts: Baloo 2, Sora & Manrope */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@400..800&family=Manrope:wght@400;500;600;700;800&family=Sora:wght@600;700;800;900&display=swap"
          rel="stylesheet"
        />

        {/* Global Site Tag (gtag.js) - Google Analytics */}
        <script defer src={`https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${GA_TRACKING_ID}', {
      page_path: window.location.pathname,
    });`,
          }}
        />

        {/* Manually inserted styles */}
        <style dangerouslySetInnerHTML={{ __html: styles }} />
      </head>
      <body className="min-h-screen bg-[#101223] text-[#F4F5F8] overflow-x-hidden">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  useTouchpadNavigation()
  useTheme()

  useEffect(() => {
    let timeouts = new Map<HTMLElement, any>()

    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement
      if (!target || !target.classList) return

      // Add scrolling class
      target.classList.add('is-scrolling')

      // Clear existing timeout for this target
      if (timeouts.has(target)) {
        clearTimeout(timeouts.get(target))
      }

      // Hide scrollbar after 800ms of inactivity
      const t = setTimeout(() => {
        target.classList.remove('is-scrolling')
        timeouts.delete(target)
      }, 800)

      timeouts.set(target, t)
    }

    // Listen to all scroll events in capture phase
    window.addEventListener('scroll', handleScroll, true)

    return () => {
      window.removeEventListener('scroll', handleScroll, true)
      timeouts.forEach((t) => clearTimeout(t))
    }
  }, [])

  return (
    <Providers>
      <Outlet />
    </Providers>
  )
}
