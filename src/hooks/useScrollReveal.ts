import { useEffect, useRef } from 'react'

export function useScrollReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    )

    const children = el.querySelectorAll('.reveal')
    children.forEach((child) => observer.observe(child))
    observer.observe(el)

    // Watch for newly added .reveal children (e.g. mode-toggle remounts
    // mid-page). Without this, dynamically inserted content stays at
    // opacity:0 forever because the observer was set up before they existed.
    const mo = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        m.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return
          if (node.classList?.contains('reveal')) observer.observe(node)
          node.querySelectorAll?.('.reveal').forEach((c) => observer.observe(c))
        })
      })
    })
    mo.observe(el, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      mo.disconnect()
    }
  }, [])

  return ref
}
