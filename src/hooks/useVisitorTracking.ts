import { useEffect, useRef } from 'react'
import { useVisitorStore } from '@/stores/visitorStore'

/**
 * Auto-tracks visitor sessions, page views, scroll depth, and heartbeats.
 * Drop this into any page component to start tracking.
 */
export function useVisitorTracking(pagePath?: string) {
  const startSession = useVisitorStore((s) => s.startSession)
  const trackPageView = useVisitorStore((s) => s.trackPageView)
  const updateScrollDepth = useVisitorStore((s) => s.updateScrollDepth)
  const endCurrentPage = useVisitorStore((s) => s.endCurrentPage)
  const heartbeat = useVisitorStore((s) => s.heartbeat)
  const trackedRef = useRef(false)

  const path = pagePath || (typeof window !== 'undefined' ? window.location.pathname : '/')

  // Start session + track page view
  useEffect(() => {
    if (trackedRef.current) return
    trackedRef.current = true

    startSession()
    trackPageView(path)

    return () => {
      endCurrentPage()
      trackedRef.current = false
    }
  }, [path, startSession, trackPageView, endCurrentPage])

  // Scroll depth tracking (throttled)
  useEffect(() => {
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const scrollTop = window.scrollY
        const docHeight = document.documentElement.scrollHeight - window.innerHeight
        const depth = docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 100
        updateScrollDepth(depth)
        ticking = false
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [updateScrollDepth])

  // Heartbeat every 30 seconds to keep session alive
  useEffect(() => {
    const interval = setInterval(heartbeat, 30_000)
    return () => clearInterval(interval)
  }, [heartbeat])

  // Save on page hide (tab close, navigate away)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        endCurrentPage()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [endCurrentPage])
}

/**
 * Lightweight section-level tracker for SPA sections (Hero, Services, etc.)
 * Uses IntersectionObserver to detect which section the user scrolled into.
 */
export function useSectionTracking() {
  const trackPageView = useVisitorStore((s) => s.trackPageView)

  useEffect(() => {
    const sections = document.querySelectorAll('section[id], div[id]')
    if (sections.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const sectionId = entry.target.id
            if (sectionId) {
              trackPageView(`/#${sectionId}`)
            }
          }
        })
      },
      { threshold: 0.5 }
    )

    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [trackPageView])
}
