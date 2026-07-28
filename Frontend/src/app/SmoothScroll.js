import { useEffect } from 'react'
import Lenis from 'lenis'

const shouldPreventLenis = (node) => {
  if (!node?.closest) return false
  return Boolean(
    node.closest(
      [
        '[data-lenis-prevent]',
        '[role="dialog"]',
        '.overflow-auto',
        '.overflow-y-auto',
        '.custom-scrollbar',
        '.scrollbar-hide',
        '.pac-container',
      ].join(','),
    ),
  )
}

export default function SmoothScroll() {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return undefined
    }

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      syncTouch: false,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.2,
      anchors: true,
      stopInertiaOnNavigate: true,
      prevent: shouldPreventLenis,
    })

    window.lenis = lenis

    let frameId = 0
    const raf = (time) => {
      lenis.raf(time)
      frameId = requestAnimationFrame(raf)
    }
    frameId = requestAnimationFrame(raf)

    return () => {
      cancelAnimationFrame(frameId)
      lenis.destroy()
      if (window.lenis === lenis) {
        delete window.lenis
      }
    }
  }, [])

  return null
}
