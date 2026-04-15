import { create } from 'zustand'

const STORAGE_KEY = 'axiom_visitor_analytics'
const VISITOR_ID_KEY = 'axiom_visitor_id'
const SESSION_TIMEOUT = 30 * 60 * 1000 // 30 min inactivity = new session

// ── Types ──────────────────────────────────

export interface PageView {
  path: string
  timestamp: string
  scrollDepth: number // 0-100 percentage
  timeOnPage: number  // seconds
}

export interface VisitorSession {
  id: string
  visitorId: string
  startedAt: string
  lastActiveAt: string
  pages: PageView[]
  entryPage: string
  exitPage: string
  referrer: string
  device: 'mobile' | 'tablet' | 'desktop'
  browser: string
  os: string
  screenWidth: number
  screenHeight: number
  language: string
  isBounce: boolean
  duration: number // total seconds
}

export interface LiveVisitor {
  visitorId: string
  currentPage: string
  lastSeen: string
  device: 'mobile' | 'tablet' | 'desktop'
}

interface VisitorState {
  sessions: VisitorSession[]
  currentSessionId: string | null
  visitorId: string
  currentPageEnteredAt: number | null
  currentPagePath: string | null

  // Actions
  startSession: () => void
  trackPageView: (path: string) => void
  updateScrollDepth: (depth: number) => void
  endCurrentPage: () => void
  heartbeat: () => void

  // Computed helpers
  getSessionsInRange: (since: Date) => VisitorSession[]
  getUniqueVisitors: (since: Date) => number
  getTotalPageViews: (since: Date) => number
  getBounceRate: (since: Date) => number
  getAvgSessionDuration: (since: Date) => number
  getPagesPerSession: (since: Date) => number
  getTopPages: (since: Date) => { path: string; views: number; avgTime: number }[]
  getDeviceBreakdown: (since: Date) => { mobile: number; tablet: number; desktop: number }
  getBrowserBreakdown: (since: Date) => Record<string, number>
  getOsBreakdown: (since: Date) => Record<string, number>
  getReferrerBreakdown: (since: Date) => Record<string, number>
  getHourlyVisitors: (since: Date) => number[]
  getDailyVisitors: (since: Date) => { date: string; unique: number; views: number }[]
  getNewVsReturning: (since: Date) => { new: number; returning: number }
  getLiveVisitors: () => LiveVisitor[]
  getRealtimeCount: () => number
  getPageViewsByDay: (since: Date) => { date: string; count: number }[]
}

// ── Helpers ──────────────────────────────────

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function getOrCreateVisitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_ID_KEY)
    if (!id) {
      id = 'v_' + generateId()
      localStorage.setItem(VISITOR_ID_KEY, id)
    }
    return id
  } catch {
    return 'v_' + generateId()
  }
}

function detectDevice(): 'mobile' | 'tablet' | 'desktop' {
  const w = window.innerWidth
  if (w < 768) return 'mobile'
  if (w < 1024) return 'tablet'
  return 'desktop'
}

function detectBrowser(): string {
  const ua = navigator.userAgent
  if (ua.includes('Firefox')) return 'Firefox'
  if (ua.includes('Edg')) return 'Edge'
  if (ua.includes('OPR') || ua.includes('Opera')) return 'Opera'
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome'
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari'
  return 'Other'
}

function detectOS(): string {
  const ua = navigator.userAgent
  if (ua.includes('Windows')) return 'Windows'
  if (ua.includes('Mac OS')) return 'macOS'
  if (ua.includes('Linux') && !ua.includes('Android')) return 'Linux'
  if (ua.includes('Android')) return 'Android'
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS'
  return 'Other'
}

function loadSessions(): VisitorSession[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveSessions(sessions: VisitorSession[]) {
  try {
    // Keep last 500 sessions max to avoid bloat
    const trimmed = sessions.slice(-500)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // localStorage full — purge old entries
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(-100)))
    } catch { /* give up */ }
  }
}

// ── Store ──────────────────────────────────

export const useVisitorStore = create<VisitorState>((set, get) => ({
  sessions: loadSessions(),
  currentSessionId: null,
  visitorId: getOrCreateVisitorId(),
  currentPageEnteredAt: null,
  currentPagePath: null,

  startSession: () => {
    const state = get()
    // Check if existing session is still active (< 30 min idle)
    if (state.currentSessionId) {
      const session = state.sessions.find((s) => s.id === state.currentSessionId)
      if (session && Date.now() - new Date(session.lastActiveAt).getTime() < SESSION_TIMEOUT) {
        return // session still active
      }
    }

    const session: VisitorSession = {
      id: 's_' + generateId(),
      visitorId: state.visitorId,
      startedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      pages: [],
      entryPage: window.location.pathname,
      exitPage: window.location.pathname,
      referrer: document.referrer || 'direct',
      device: detectDevice(),
      browser: detectBrowser(),
      os: detectOS(),
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      language: navigator.language,
      isBounce: true,
      duration: 0,
    }

    const sessions = [...state.sessions, session]
    saveSessions(sessions)
    set({ sessions, currentSessionId: session.id })
  },

  trackPageView: (path: string) => {
    const state = get()
    // End previous page timing
    if (state.currentPageEnteredAt && state.currentPagePath && state.currentSessionId) {
      const timeOnPage = Math.round((Date.now() - state.currentPageEnteredAt) / 1000)
      const sessions = state.sessions.map((s) => {
        if (s.id !== state.currentSessionId) return s
        const pages = s.pages.map((p, i) =>
          i === s.pages.length - 1 && p.path === state.currentPagePath
            ? { ...p, timeOnPage }
            : p
        )
        return { ...s, pages }
      })
      set({ sessions })
    }

    if (!state.currentSessionId) {
      get().startSession()
    }

    const now = new Date().toISOString()
    const pageView: PageView = {
      path,
      timestamp: now,
      scrollDepth: 0,
      timeOnPage: 0,
    }

    const sessions = get().sessions.map((s) => {
      if (s.id !== get().currentSessionId) return s
      const pages = [...s.pages, pageView]
      return {
        ...s,
        pages,
        lastActiveAt: now,
        exitPage: path,
        isBounce: pages.length <= 1,
        duration: Math.round((new Date(now).getTime() - new Date(s.startedAt).getTime()) / 1000),
      }
    })

    saveSessions(sessions)
    set({ sessions, currentPageEnteredAt: Date.now(), currentPagePath: path })
  },

  updateScrollDepth: (depth: number) => {
    const state = get()
    if (!state.currentSessionId || !state.currentPagePath) return
    const sessions = state.sessions.map((s) => {
      if (s.id !== state.currentSessionId) return s
      const pages = s.pages.map((p, i) =>
        i === s.pages.length - 1 ? { ...p, scrollDepth: Math.max(p.scrollDepth, depth) } : p
      )
      return { ...s, pages }
    })
    set({ sessions })
    // Don't save on every scroll — will save on next page view or heartbeat
  },

  endCurrentPage: () => {
    const state = get()
    if (!state.currentPageEnteredAt || !state.currentPagePath || !state.currentSessionId) return
    const timeOnPage = Math.round((Date.now() - state.currentPageEnteredAt) / 1000)
    const now = new Date().toISOString()
    const sessions = state.sessions.map((s) => {
      if (s.id !== state.currentSessionId) return s
      const pages = s.pages.map((p, i) =>
        i === s.pages.length - 1 ? { ...p, timeOnPage } : p
      )
      return {
        ...s,
        pages,
        lastActiveAt: now,
        duration: Math.round((new Date(now).getTime() - new Date(s.startedAt).getTime()) / 1000),
      }
    })
    saveSessions(sessions)
    set({ sessions, currentPageEnteredAt: null, currentPagePath: null })
  },

  heartbeat: () => {
    const state = get()
    if (!state.currentSessionId) return
    const now = new Date().toISOString()
    const sessions = state.sessions.map((s) => {
      if (s.id !== state.currentSessionId) return s
      return {
        ...s,
        lastActiveAt: now,
        duration: Math.round((new Date(now).getTime() - new Date(s.startedAt).getTime()) / 1000),
      }
    })
    saveSessions(sessions)
    set({ sessions })
  },

  // ── Computed Helpers ──

  getSessionsInRange: (since: Date) => {
    return get().sessions.filter((s) => new Date(s.startedAt) >= since)
  },

  getUniqueVisitors: (since: Date) => {
    const sessions = get().getSessionsInRange(since)
    return new Set(sessions.map((s) => s.visitorId)).size
  },

  getTotalPageViews: (since: Date) => {
    const sessions = get().getSessionsInRange(since)
    return sessions.reduce((sum, s) => sum + s.pages.length, 0)
  },

  getBounceRate: (since: Date) => {
    const sessions = get().getSessionsInRange(since)
    if (sessions.length === 0) return 0
    const bounces = sessions.filter((s) => s.isBounce).length
    return (bounces / sessions.length) * 100
  },

  getAvgSessionDuration: (since: Date) => {
    const sessions = get().getSessionsInRange(since).filter((s) => s.duration > 0)
    if (sessions.length === 0) return 0
    return sessions.reduce((sum, s) => sum + s.duration, 0) / sessions.length
  },

  getPagesPerSession: (since: Date) => {
    const sessions = get().getSessionsInRange(since)
    if (sessions.length === 0) return 0
    return sessions.reduce((sum, s) => sum + s.pages.length, 0) / sessions.length
  },

  getTopPages: (since: Date) => {
    const sessions = get().getSessionsInRange(since)
    const pageMap: Record<string, { views: number; totalTime: number }> = {}
    sessions.forEach((s) => {
      s.pages.forEach((p) => {
        if (!pageMap[p.path]) pageMap[p.path] = { views: 0, totalTime: 0 }
        pageMap[p.path].views++
        pageMap[p.path].totalTime += p.timeOnPage
      })
    })
    return Object.entries(pageMap)
      .map(([path, data]) => ({ path, views: data.views, avgTime: data.views > 0 ? data.totalTime / data.views : 0 }))
      .sort((a, b) => b.views - a.views)
  },

  getDeviceBreakdown: (since: Date) => {
    const sessions = get().getSessionsInRange(since)
    return {
      mobile: sessions.filter((s) => s.device === 'mobile').length,
      tablet: sessions.filter((s) => s.device === 'tablet').length,
      desktop: sessions.filter((s) => s.device === 'desktop').length,
    }
  },

  getBrowserBreakdown: (since: Date) => {
    const sessions = get().getSessionsInRange(since)
    const map: Record<string, number> = {}
    sessions.forEach((s) => { map[s.browser] = (map[s.browser] || 0) + 1 })
    return map
  },

  getOsBreakdown: (since: Date) => {
    const sessions = get().getSessionsInRange(since)
    const map: Record<string, number> = {}
    sessions.forEach((s) => { map[s.os] = (map[s.os] || 0) + 1 })
    return map
  },

  getReferrerBreakdown: (since: Date) => {
    const sessions = get().getSessionsInRange(since)
    const map: Record<string, number> = {}
    sessions.forEach((s) => {
      let ref = s.referrer
      try {
        if (ref && ref !== 'direct') ref = new URL(ref).hostname
      } catch { /* keep raw */ }
      map[ref] = (map[ref] || 0) + 1
    })
    return map
  },

  getHourlyVisitors: (since: Date) => {
    const sessions = get().getSessionsInRange(since)
    const hours = Array(24).fill(0)
    sessions.forEach((s) => { hours[new Date(s.startedAt).getHours()]++ })
    return hours
  },

  getDailyVisitors: (since: Date) => {
    const sessions = get().getSessionsInRange(since)
    const dayMap: Record<string, { visitors: Set<string>; views: number }> = {}
    sessions.forEach((s) => {
      const day = s.startedAt.split('T')[0]
      if (!dayMap[day]) dayMap[day] = { visitors: new Set(), views: 0 }
      dayMap[day].visitors.add(s.visitorId)
      dayMap[day].views += s.pages.length
    })
    return Object.entries(dayMap)
      .map(([date, data]) => ({ date, unique: data.visitors.size, views: data.views }))
      .sort((a, b) => a.date.localeCompare(b.date))
  },

  getNewVsReturning: (since: Date) => {
    const sessions = get().getSessionsInRange(since)
    const allSessions = get().sessions
    const result = { new: 0, returning: 0 }
    const counted = new Set<string>()
    sessions.forEach((s) => {
      if (counted.has(s.visitorId)) return
      counted.add(s.visitorId)
      const firstVisit = allSessions.find((as) => as.visitorId === s.visitorId)
      if (firstVisit && new Date(firstVisit.startedAt) >= since) {
        result.new++
      } else {
        result.returning++
      }
    })
    return result
  },

  getLiveVisitors: () => {
    const fiveMinAgo = Date.now() - 5 * 60 * 1000
    const sessions = get().sessions.filter((s) => new Date(s.lastActiveAt).getTime() >= fiveMinAgo)
    const visitors: LiveVisitor[] = []
    const seen = new Set<string>()
    // Most recent sessions first
    ;[...sessions].reverse().forEach((s) => {
      if (seen.has(s.visitorId)) return
      seen.add(s.visitorId)
      visitors.push({
        visitorId: s.visitorId,
        currentPage: s.exitPage,
        lastSeen: s.lastActiveAt,
        device: s.device,
      })
    })
    return visitors
  },

  getRealtimeCount: () => {
    return get().getLiveVisitors().length
  },

  getPageViewsByDay: (since: Date) => {
    const sessions = get().getSessionsInRange(since)
    const dayMap: Record<string, number> = {}
    sessions.forEach((s) => {
      s.pages.forEach((p) => {
        const day = p.timestamp.split('T')[0]
        dayMap[day] = (dayMap[day] || 0) + 1
      })
    })
    return Object.entries(dayMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
  },
}))
