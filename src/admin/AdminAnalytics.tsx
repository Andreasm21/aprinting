import { useState, useMemo } from 'react'
import {
  BarChart3, TrendingUp, Users, ShoppingCart, Package, DollarSign,
  Calendar, ArrowUpRight, ArrowDownRight, Minus, PieChart, Activity,
  Eye, MousePointer, Clock, Monitor, Smartphone, Tablet, Globe, Zap,
  UserCheck, UserPlus, ArrowRightLeft, Layers,
} from 'lucide-react'
import { useNotificationsStore, type OrderNotification, type PartRequestNotification } from '@/stores/notificationsStore'
import { useCustomersStore } from '@/stores/customersStore'
import { useInvoicesStore } from '@/stores/invoicesStore'
import { useContentStore } from '@/stores/contentStore'
import { useVisitorStore } from '@/stores/visitorStore'

type TimeRange = '7d' | '30d' | '90d' | 'all'
type Tab = 'visitors' | 'business'

function getDateRange(range: TimeRange): Date {
  const d = new Date()
  if (range === '7d') d.setDate(d.getDate() - 7)
  else if (range === '30d') d.setDate(d.getDate() - 30)
  else if (range === '90d') d.setDate(d.getDate() - 90)
  else d.setFullYear(2020)
  return d
}

function formatCurrency(n: number) { return `€${n.toFixed(2)}` }

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}m ${s}s`
}

export default function AdminAnalytics() {
  const { notifications } = useNotificationsStore()
  const customers = useCustomersStore((s) => s.customers)
  const invoices = useInvoicesStore((s) => s.invoices)
  const products = useContentStore((s) => s.products)
  const visitorStore = useVisitorStore()
  const [range, setRange] = useState<TimeRange>('30d')
  const [tab, setTab] = useState<Tab>('visitors')

  const orders = notifications.filter((n): n is OrderNotification => n.type === 'order')
  const partRequests = notifications.filter((n): n is PartRequestNotification => n.type === 'part_request')
  const cutoff = getDateRange(range)

  // ── Visitor Metrics ──
  const uniqueVisitors = visitorStore.getUniqueVisitors(cutoff)
  const totalPageViews = visitorStore.getTotalPageViews(cutoff)
  const bounceRate = visitorStore.getBounceRate(cutoff)
  const avgSessionDuration = visitorStore.getAvgSessionDuration(cutoff)
  const pagesPerSession = visitorStore.getPagesPerSession(cutoff)
  const topPages = visitorStore.getTopPages(cutoff)
  const deviceBreakdown = visitorStore.getDeviceBreakdown(cutoff)
  const browserBreakdown = visitorStore.getBrowserBreakdown(cutoff)
  const osBreakdown = visitorStore.getOsBreakdown(cutoff)
  const referrerBreakdown = visitorStore.getReferrerBreakdown(cutoff)
  const hourlyVisitors = visitorStore.getHourlyVisitors(cutoff)
  const dailyVisitors = visitorStore.getDailyVisitors(cutoff)
  const newVsReturning = visitorStore.getNewVsReturning(cutoff)
  const liveVisitors = visitorStore.getLiveVisitors()
  const totalSessions = visitorStore.getSessionsInRange(cutoff).length

  // ── Previous period visitor comparison ──
  const prevCutoff = new Date(cutoff)
  const diff = Date.now() - cutoff.getTime()
  prevCutoff.setTime(cutoff.getTime() - diff)
  const prevUniqueVisitors = visitorStore.getUniqueVisitors(prevCutoff) - uniqueVisitors
  const prevPageViews = visitorStore.getTotalPageViews(prevCutoff) - totalPageViews
  const visitorDelta = prevUniqueVisitors > 0 ? ((uniqueVisitors - prevUniqueVisitors) / prevUniqueVisitors * 100) : (uniqueVisitors > 0 ? 100 : 0)
  const pageViewDelta = prevPageViews > 0 ? ((totalPageViews - prevPageViews) / prevPageViews * 100) : (totalPageViews > 0 ? 100 : 0)

  // ── Visitors per day (fill empty days) ──
  const visitorsByDay = useMemo(() => {
    const numDays = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 180
    const dayMap: Record<string, { unique: number; views: number }> = {}
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      dayMap[d.toISOString().split('T')[0]] = { unique: 0, views: 0 }
    }
    dailyVisitors.forEach((dv) => {
      if (dayMap[dv.date] !== undefined) {
        dayMap[dv.date] = { unique: dv.unique, views: dv.views }
      }
    })
    return Object.entries(dayMap).map(([date, data]) => ({ date, ...data }))
  }, [dailyVisitors, range])

  // ── Scroll depth distribution ──
  const scrollDepthDist = useMemo(() => {
    const sessions = visitorStore.getSessionsInRange(cutoff)
    const buckets = [0, 0, 0, 0, 0] // 0-20, 20-40, 40-60, 60-80, 80-100
    sessions.forEach((s) => {
      s.pages.forEach((p) => {
        const idx = Math.min(Math.floor(p.scrollDepth / 20), 4)
        buckets[idx]++
      })
    })
    return buckets
  }, [visitorStore, cutoff])

  // ── Business Metrics ──
  const filteredOrders = useMemo(() => orders.filter((o) => new Date(o.date) >= cutoff), [orders, cutoff])
  const filteredInvoices = useMemo(() => invoices.filter((i) => new Date(i.date) >= cutoff), [invoices, cutoff])
  const filteredCustomers = useMemo(() => customers.filter((c) => new Date(c.createdAt) >= cutoff), [customers, cutoff])

  const totalRevenue = filteredOrders.reduce((s, o) => s + o.total, 0)
  const invoiceRevenue = filteredInvoices.filter((i) => i.type === 'invoice' && i.status === 'paid').reduce((s, i) => s + i.total, 0)
  const avgOrderValue = filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0
  const totalOrders = filteredOrders.length
  const totalPartRequests = partRequests.filter((p) => new Date(p.date) >= cutoff).length
  const newCustomers = filteredCustomers.length
  const b2bCustomers = filteredCustomers.filter((c) => c.accountType === 'business').length
  const conversionRate = orders.length > 0 ? ((customers.length / (orders.length + partRequests.length)) * 100) : 0

  const prevOrders = orders.filter((o) => { const d = new Date(o.date); return d >= prevCutoff && d < cutoff })
  const prevRevenue = prevOrders.reduce((s, o) => s + o.total, 0)
  const revenueDelta = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue * 100) : (totalRevenue > 0 ? 100 : 0)
  const ordersDelta = prevOrders.length > 0 ? ((totalOrders - prevOrders.length) / prevOrders.length * 100) : (totalOrders > 0 ? 100 : 0)

  const revenueByDay = useMemo(() => {
    const days: Record<string, number> = {}
    const numDays = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 180
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      days[d.toISOString().split('T')[0]] = 0
    }
    filteredOrders.forEach((o) => {
      const key = new Date(o.date).toISOString().split('T')[0]
      if (days[key] !== undefined) days[key] += o.total
    })
    return Object.entries(days).map(([date, revenue]) => ({ date, revenue }))
  }, [filteredOrders, range])

  const ordersByDay = useMemo(() => {
    const days: Record<string, number> = {}
    const numDays = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 180
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      days[d.toISOString().split('T')[0]] = 0
    }
    filteredOrders.forEach((o) => {
      const key = new Date(o.date).toISOString().split('T')[0]
      if (days[key] !== undefined) days[key]++
    })
    return Object.entries(days).map(([date, count]) => ({ date, count }))
  }, [filteredOrders, range])

  const productStats = useMemo(() => {
    const stats: Record<string, { name: string; quantity: number; revenue: number }> = {}
    filteredOrders.forEach((o) => {
      o.items.forEach((item) => {
        if (!stats[item.name]) stats[item.name] = { name: item.name, quantity: 0, revenue: 0 }
        stats[item.name].quantity += item.quantity
        stats[item.name].revenue += item.price * item.quantity
      })
    })
    return Object.values(stats).sort((a, b) => b.revenue - a.revenue)
  }, [filteredOrders])

  const deliveryStats = useMemo(() => {
    const pickup = filteredOrders.filter((o) => o.customer.deliveryType === 'pickup').length
    const delivery = filteredOrders.filter((o) => o.customer.deliveryType === 'delivery').length
    return { pickup, delivery, total: pickup + delivery }
  }, [filteredOrders])

  const tierStats = useMemo(() => {
    const tiers = { none: 0, silver: 0, gold: 0, platinum: 0 }
    customers.forEach((c) => {
      const tier = c.discountTier || 'none'
      if (tier in tiers) tiers[tier as keyof typeof tiers]++
    })
    return tiers
  }, [customers])

  const invoiceStats = useMemo(() => {
    const inv = invoices.filter((i) => i.type === 'invoice')
    return {
      draft: inv.filter((i) => i.status === 'draft').length,
      sent: inv.filter((i) => i.status === 'sent').length,
      paid: inv.filter((i) => i.status === 'paid').length,
      cancelled: inv.filter((i) => i.status === 'cancelled').length,
      total: inv.length,
      paidAmount: inv.filter((i) => i.status === 'paid').reduce((s, i) => s + i.total, 0),
      outstandingAmount: inv.filter((i) => i.status === 'sent').reduce((s, i) => s + i.total, 0),
    }
  }, [invoices])

  const topCustomers = useMemo(() => {
    return [...customers].filter((c) => c.totalSpent > 0).sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5)
  }, [customers])

  const materialStats = useMemo(() => {
    const stats: Record<string, number> = {}
    partRequests.forEach((p) => {
      if (new Date(p.date) >= cutoff) {
        const mat = p.details.material || 'Unknown'
        stats[mat] = (stats[mat] || 0) + 1
      }
    })
    return Object.entries(stats).sort((a, b) => b[1] - a[1])
  }, [partRequests, cutoff])

  const hourlyOrders = useMemo(() => {
    const hours = Array(24).fill(0)
    filteredOrders.forEach((o) => { hours[new Date(o.date).getHours()]++ })
    return hours
  }, [filteredOrders])

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-mono text-2xl font-bold text-text-primary flex items-center gap-2">
            <BarChart3 size={24} className="text-accent-amber" /> Analytics
          </h1>
          <p className="text-text-secondary text-sm mt-1">Visitor insights & business performance.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Tab Switcher */}
          <div className="flex bg-bg-secondary rounded-lg border border-border p-0.5">
            <button
              onClick={() => setTab('visitors')}
              className={`text-xs font-mono px-3 py-1.5 rounded-md transition-all ${
                tab === 'visitors' ? 'bg-accent-amber/10 text-accent-amber border border-accent-amber/20' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <Eye size={12} className="inline mr-1" /> Visitors
            </button>
            <button
              onClick={() => setTab('business')}
              className={`text-xs font-mono px-3 py-1.5 rounded-md transition-all ${
                tab === 'business' ? 'bg-accent-blue/10 text-accent-blue border border-accent-blue/20' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <DollarSign size={12} className="inline mr-1" /> Business
            </button>
          </div>
          {/* Time Range */}
          <div className="flex gap-1">
            {(['7d', '30d', '90d', 'all'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition-all ${
                  range === r ? 'border-accent-amber text-accent-amber bg-accent-amber/5' : 'border-border text-text-muted hover:text-text-secondary'
                }`}
              >
                {r === 'all' ? 'All' : r === '7d' ? '7D' : r === '30d' ? '30D' : '90D'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Live Indicator ── */}
      {tab === 'visitors' && (
        <div className="card-base p-3 mb-4 flex items-center gap-3">
          <div className="relative flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-accent-green" />
            </span>
            <span className="text-sm font-mono font-bold text-accent-green">{liveVisitors.length}</span>
            <span className="text-xs font-mono text-text-muted">active now</span>
          </div>
          {liveVisitors.length > 0 && (
            <div className="flex gap-2 ml-auto">
              {liveVisitors.slice(0, 5).map((v) => (
                <span key={v.visitorId} className="text-[10px] font-mono text-text-secondary bg-bg-tertiary px-2 py-0.5 rounded-full flex items-center gap-1">
                  {v.device === 'mobile' ? <Smartphone size={10} /> : v.device === 'tablet' ? <Tablet size={10} /> : <Monitor size={10} />}
                  {v.currentPage}
                </span>
              ))}
              {liveVisitors.length > 5 && (
                <span className="text-[10px] font-mono text-text-muted">+{liveVisitors.length - 5} more</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════════ VISITOR TAB ══════════════ */}
      {tab === 'visitors' && (
        <>
          {/* Visitor KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <KpiCard label="Unique Visitors" value={String(uniqueVisitors)} delta={visitorDelta} icon={<Users size={18} />} color="amber" />
            <KpiCard label="Page Views" value={String(totalPageViews)} delta={pageViewDelta} icon={<Eye size={18} />} color="blue" />
            <KpiCard label="Bounce Rate" value={`${bounceRate.toFixed(1)}%`} icon={<MousePointer size={18} />} color={bounceRate > 60 ? 'amber' : 'green'} />
            <KpiCard label="Avg Session" value={formatDuration(avgSessionDuration)} subtitle={`${pagesPerSession.toFixed(1)} pages/session`} icon={<Clock size={18} />} color="blue" />
          </div>

          {/* Secondary visitor KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <MiniStat label="Total Sessions" value={String(totalSessions)} icon={<Layers size={14} />} />
            <MiniStat label="New Visitors" value={String(newVsReturning.new)} icon={<UserPlus size={14} />} />
            <MiniStat label="Returning" value={String(newVsReturning.returning)} icon={<UserCheck size={14} />} />
            <MiniStat label="Pages / Session" value={pagesPerSession.toFixed(1)} icon={<ArrowRightLeft size={14} />} />
          </div>

          {/* Visitors Over Time */}
          <div className="grid lg:grid-cols-3 gap-4 mb-4">
            <div className="lg:col-span-2 card-base p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-mono text-sm font-bold text-text-primary flex items-center gap-1.5">
                  <TrendingUp size={14} className="text-accent-amber" /> Visitors Over Time
                </h3>
                <span className="text-[10px] font-mono text-text-muted">{uniqueVisitors} unique total</span>
              </div>
              <BarChart data={visitorsByDay.map((d) => d.unique)} labels={visitorsByDay.map((d) => d.date)} color="amber" height={160} />
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono text-text-muted uppercase">Page Views</span>
                </div>
                <BarChart data={visitorsByDay.map((d) => d.views)} labels={visitorsByDay.map((d) => d.date)} color="blue" height={60} />
              </div>
            </div>

            {/* New vs Returning */}
            <div className="card-base p-5">
              <h3 className="font-mono text-sm font-bold text-text-primary flex items-center gap-1.5 mb-4">
                <Users size={14} className="text-accent-blue" /> New vs Returning
              </h3>
              <DonutChart
                segments={[
                  { label: 'New', value: newVsReturning.new, color: '#F59E0B' },
                  { label: 'Returning', value: newVsReturning.returning, color: '#3B82F6' },
                ]}
              />
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-accent-amber" /> New Visitors</span>
                  <span className="text-text-primary">{newVsReturning.new}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-accent-blue" /> Returning</span>
                  <span className="text-text-primary">{newVsReturning.returning}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Top Pages + Visitor Hours */}
          <div className="grid lg:grid-cols-2 gap-4 mb-4">
            <div className="card-base p-5">
              <h3 className="font-mono text-sm font-bold text-text-primary flex items-center gap-1.5 mb-4">
                <Eye size={14} className="text-accent-green" /> Top Pages
              </h3>
              {topPages.length === 0 ? (
                <EmptyState text="No page views yet" />
              ) : (
                <div className="space-y-2.5">
                  {topPages.slice(0, 8).map((page, i) => {
                    const maxViews = topPages[0]?.views || 1
                    return (
                      <div key={page.path}>
                        <div className="flex items-center justify-between text-[11px] font-mono mb-0.5">
                          <span className="text-text-primary truncate max-w-[55%]">{i + 1}. {page.path}</span>
                          <span className="text-text-muted">{page.views} views · avg {formatDuration(page.avgTime)}</span>
                        </div>
                        <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                          <div className="h-full bg-accent-green rounded-full transition-all" style={{ width: `${(page.views / maxViews) * 100}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="card-base p-5">
              <h3 className="font-mono text-sm font-bold text-text-primary flex items-center gap-1.5 mb-4">
                <Calendar size={14} className="text-accent-amber" /> Visitor Times (Hour of Day)
              </h3>
              <div className="flex items-end gap-[2px] h-[100px]">
                {hourlyVisitors.map((count, hour) => {
                  const max = Math.max(...hourlyVisitors, 1)
                  return (
                    <div key={hour} className="flex-1 flex flex-col items-center" title={`${hour}:00 — ${count} sessions`}>
                      <div className="w-full bg-bg-tertiary rounded-t-sm overflow-hidden flex-1 flex items-end">
                        <div
                          className="w-full bg-accent-amber/60 rounded-t-sm transition-all hover:bg-accent-amber"
                          style={{ height: `${(count / max) * 100}%`, minHeight: count > 0 ? '2px' : '0' }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-between mt-1 text-[9px] font-mono text-text-muted">
                <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span>
              </div>
            </div>
          </div>

          {/* Device + Browser + OS + Referrers */}
          <div className="grid lg:grid-cols-4 gap-4 mb-4">
            {/* Devices */}
            <div className="card-base p-5">
              <h3 className="font-mono text-sm font-bold text-text-primary flex items-center gap-1.5 mb-4">
                <Monitor size={14} className="text-accent-amber" /> Devices
              </h3>
              <DonutChart
                segments={[
                  { label: 'Desktop', value: deviceBreakdown.desktop, color: '#F59E0B' },
                  { label: 'Mobile', value: deviceBreakdown.mobile, color: '#3B82F6' },
                  { label: 'Tablet', value: deviceBreakdown.tablet, color: '#10B981' },
                ]}
              />
              <div className="mt-3 space-y-1.5">
                {[
                  { label: 'Desktop', value: deviceBreakdown.desktop, icon: <Monitor size={11} />, color: 'bg-accent-amber' },
                  { label: 'Mobile', value: deviceBreakdown.mobile, icon: <Smartphone size={11} />, color: 'bg-accent-blue' },
                  { label: 'Tablet', value: deviceBreakdown.tablet, icon: <Tablet size={11} />, color: 'bg-accent-green' },
                ].map((d) => (
                  <div key={d.label} className="flex items-center justify-between text-[11px] font-mono">
                    <span className="flex items-center gap-1.5 text-text-secondary">
                      <span className={`w-2 h-2 rounded-full ${d.color}`} />
                      {d.icon} {d.label}
                    </span>
                    <span className="text-text-primary">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Browsers */}
            <div className="card-base p-5">
              <h3 className="font-mono text-sm font-bold text-text-primary flex items-center gap-1.5 mb-4">
                <Globe size={14} className="text-accent-blue" /> Browsers
              </h3>
              {Object.keys(browserBreakdown).length === 0 ? (
                <EmptyState text="No data yet" />
              ) : (
                <div className="space-y-2">
                  {Object.entries(browserBreakdown).sort((a, b) => b[1] - a[1]).map(([browser, count]) => {
                    const total = Object.values(browserBreakdown).reduce((s, v) => s + v, 0)
                    const pct = total > 0 ? (count / total * 100).toFixed(0) : '0'
                    return (
                      <div key={browser}>
                        <div className="flex items-center justify-between text-[11px] font-mono mb-0.5">
                          <span className="text-text-primary">{browser}</span>
                          <span className="text-text-muted">{count} ({pct}%)</span>
                        </div>
                        <div className="h-1 bg-bg-tertiary rounded-full overflow-hidden">
                          <div className="h-full bg-accent-blue/50 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* OS */}
            <div className="card-base p-5">
              <h3 className="font-mono text-sm font-bold text-text-primary flex items-center gap-1.5 mb-4">
                <Zap size={14} className="text-accent-green" /> Operating System
              </h3>
              {Object.keys(osBreakdown).length === 0 ? (
                <EmptyState text="No data yet" />
              ) : (
                <div className="space-y-2">
                  {Object.entries(osBreakdown).sort((a, b) => b[1] - a[1]).map(([os, count]) => {
                    const total = Object.values(osBreakdown).reduce((s, v) => s + v, 0)
                    const pct = total > 0 ? (count / total * 100).toFixed(0) : '0'
                    return (
                      <div key={os}>
                        <div className="flex items-center justify-between text-[11px] font-mono mb-0.5">
                          <span className="text-text-primary">{os}</span>
                          <span className="text-text-muted">{count} ({pct}%)</span>
                        </div>
                        <div className="h-1 bg-bg-tertiary rounded-full overflow-hidden">
                          <div className="h-full bg-accent-green/50 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Referrers */}
            <div className="card-base p-5">
              <h3 className="font-mono text-sm font-bold text-text-primary flex items-center gap-1.5 mb-4">
                <ArrowRightLeft size={14} className="text-accent-amber" /> Traffic Sources
              </h3>
              {Object.keys(referrerBreakdown).length === 0 ? (
                <EmptyState text="No referrer data" />
              ) : (
                <div className="space-y-2">
                  {Object.entries(referrerBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([ref, count]) => {
                    const total = Object.values(referrerBreakdown).reduce((s, v) => s + v, 0)
                    const pct = total > 0 ? (count / total * 100).toFixed(0) : '0'
                    return (
                      <div key={ref}>
                        <div className="flex items-center justify-between text-[11px] font-mono mb-0.5">
                          <span className="text-text-primary truncate max-w-[60%]">{ref}</span>
                          <span className="text-text-muted">{count} ({pct}%)</span>
                        </div>
                        <div className="h-1 bg-bg-tertiary rounded-full overflow-hidden">
                          <div className="h-full bg-accent-amber/50 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Scroll Depth + Engagement */}
          <div className="grid lg:grid-cols-2 gap-4 mb-4">
            <div className="card-base p-5">
              <h3 className="font-mono text-sm font-bold text-text-primary flex items-center gap-1.5 mb-4">
                <MousePointer size={14} className="text-accent-blue" /> Scroll Depth Distribution
              </h3>
              <div className="space-y-2.5">
                {['0-20%', '20-40%', '40-60%', '60-80%', '80-100%'].map((label, i) => {
                  const total = scrollDepthDist.reduce((s, v) => s + v, 0) || 1
                  const max = Math.max(...scrollDepthDist, 1)
                  return (
                    <div key={label}>
                      <div className="flex items-center justify-between text-[11px] font-mono mb-0.5">
                        <span className="text-text-primary">{label}</span>
                        <span className="text-text-muted">{scrollDepthDist[i]} ({(scrollDepthDist[i] / total * 100).toFixed(0)}%)</span>
                      </div>
                      <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent-blue/50 rounded-full transition-all"
                          style={{ width: `${(scrollDepthDist[i] / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="card-base p-5">
              <h3 className="font-mono text-sm font-bold text-text-primary flex items-center gap-1.5 mb-4">
                <Activity size={14} className="text-accent-green" /> Engagement Summary
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-bg-tertiary rounded-lg">
                  <div className="text-xl font-mono font-bold text-text-primary">{uniqueVisitors}</div>
                  <div className="text-[9px] font-mono text-text-muted uppercase mt-0.5">Unique Visitors</div>
                </div>
                <div className="text-center p-3 bg-bg-tertiary rounded-lg">
                  <div className="text-xl font-mono font-bold text-text-primary">{totalSessions}</div>
                  <div className="text-[9px] font-mono text-text-muted uppercase mt-0.5">Sessions</div>
                </div>
                <div className="text-center p-3 bg-bg-tertiary rounded-lg">
                  <div className="text-xl font-mono font-bold text-text-primary">{totalPageViews}</div>
                  <div className="text-[9px] font-mono text-text-muted uppercase mt-0.5">Page Views</div>
                </div>
                <div className="text-center p-3 bg-bg-tertiary rounded-lg">
                  <div className="text-xl font-mono font-bold text-accent-amber">{formatDuration(avgSessionDuration)}</div>
                  <div className="text-[9px] font-mono text-text-muted uppercase mt-0.5">Avg Duration</div>
                </div>
                <div className="text-center p-3 bg-bg-tertiary rounded-lg">
                  <div className="text-xl font-mono font-bold text-text-primary">{pagesPerSession.toFixed(1)}</div>
                  <div className="text-[9px] font-mono text-text-muted uppercase mt-0.5">Pages / Session</div>
                </div>
                <div className="text-center p-3 bg-bg-tertiary rounded-lg">
                  <div className={`text-xl font-mono font-bold ${bounceRate > 60 ? 'text-red-400' : bounceRate > 40 ? 'text-accent-amber' : 'text-accent-green'}`}>
                    {bounceRate.toFixed(1)}%
                  </div>
                  <div className="text-[9px] font-mono text-text-muted uppercase mt-0.5">Bounce Rate</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══════════════ BUSINESS TAB ══════════════ */}
      {tab === 'business' && (
        <>
          {/* Business KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <KpiCard label="Revenue" value={formatCurrency(totalRevenue)} delta={revenueDelta} icon={<DollarSign size={18} />} color="amber" />
            <KpiCard label="Orders" value={String(totalOrders)} delta={ordersDelta} icon={<ShoppingCart size={18} />} color="blue" />
            <KpiCard label="Avg Order Value" value={formatCurrency(avgOrderValue)} icon={<TrendingUp size={18} />} color="green" />
            <KpiCard label="New Customers" value={String(newCustomers)} subtitle={`${b2bCustomers} B2B`} icon={<Users size={18} />} color="blue" />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <MiniStat label="Part Requests" value={String(totalPartRequests)} icon={<Package size={14} />} />
            <MiniStat label="Invoice Revenue" value={formatCurrency(invoiceRevenue)} icon={<DollarSign size={14} />} />
            <MiniStat label="Outstanding" value={formatCurrency(invoiceStats.outstandingAmount)} icon={<Activity size={14} />} />
            <MiniStat label="Conversion Rate" value={`${conversionRate.toFixed(1)}%`} icon={<TrendingUp size={14} />} />
          </div>

          {/* Revenue Chart */}
          <div className="grid lg:grid-cols-3 gap-4 mb-4">
            <div className="lg:col-span-2 card-base p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-mono text-sm font-bold text-text-primary flex items-center gap-1.5">
                  <TrendingUp size={14} className="text-accent-amber" /> Revenue Over Time
                </h3>
                <span className="text-[10px] font-mono text-text-muted">{formatCurrency(totalRevenue)} total</span>
              </div>
              <BarChart data={revenueByDay.map((d) => d.revenue)} labels={revenueByDay.map((d) => d.date)} color="amber" height={160} formatValue={formatCurrency} />
            </div>
            <div className="card-base p-5">
              <h3 className="font-mono text-sm font-bold text-text-primary flex items-center gap-1.5 mb-4">
                <PieChart size={14} className="text-accent-blue" /> Delivery Split
              </h3>
              <DonutChart
                segments={[
                  { label: 'Pickup', value: deliveryStats.pickup, color: '#F59E0B' },
                  { label: 'Delivery', value: deliveryStats.delivery, color: '#3B82F6' },
                ]}
              />
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-accent-amber" /> Pickup</span>
                  <span className="text-text-primary">{deliveryStats.pickup} ({deliveryStats.total > 0 ? (deliveryStats.pickup / deliveryStats.total * 100).toFixed(0) : 0}%)</span>
                </div>
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-accent-blue" /> Delivery</span>
                  <span className="text-text-primary">{deliveryStats.delivery} ({deliveryStats.total > 0 ? (deliveryStats.delivery / deliveryStats.total * 100).toFixed(0) : 0}%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Orders + Top Products */}
          <div className="grid lg:grid-cols-2 gap-4 mb-4">
            <div className="card-base p-5">
              <h3 className="font-mono text-sm font-bold text-text-primary flex items-center gap-1.5 mb-4">
                <ShoppingCart size={14} className="text-accent-blue" /> Orders Over Time
              </h3>
              <BarChart data={ordersByDay.map((d) => d.count)} labels={ordersByDay.map((d) => d.date)} color="blue" height={120} />
            </div>
            <div className="card-base p-5">
              <h3 className="font-mono text-sm font-bold text-text-primary flex items-center gap-1.5 mb-4">
                <Package size={14} className="text-accent-green" /> Top Products
              </h3>
              {productStats.length === 0 ? (
                <EmptyState text="No product data yet" />
              ) : (
                <div className="space-y-3">
                  {productStats.slice(0, 5).map((p, i) => {
                    const maxRev = productStats[0]?.revenue || 1
                    return (
                      <div key={p.name}>
                        <div className="flex items-center justify-between text-xs font-mono mb-1">
                          <span className="text-text-primary truncate max-w-[60%]">{i + 1}. {p.name}</span>
                          <span className="text-text-muted">{p.quantity} sold · {formatCurrency(p.revenue)}</span>
                        </div>
                        <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                          <div className="h-full bg-accent-green rounded-full transition-all" style={{ width: `${(p.revenue / maxRev) * 100}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Hourly + Invoice Pipeline */}
          <div className="grid lg:grid-cols-2 gap-4 mb-4">
            <div className="card-base p-5">
              <h3 className="font-mono text-sm font-bold text-text-primary flex items-center gap-1.5 mb-4">
                <Calendar size={14} className="text-accent-amber" /> Order Times (Hour of Day)
              </h3>
              <div className="flex items-end gap-[2px] h-[100px]">
                {hourlyOrders.map((count, hour) => {
                  const max = Math.max(...hourlyOrders, 1)
                  return (
                    <div key={hour} className="flex-1 flex flex-col items-center" title={`${hour}:00 — ${count} orders`}>
                      <div className="w-full bg-bg-tertiary rounded-t-sm overflow-hidden flex-1 flex items-end">
                        <div className="w-full bg-accent-amber/60 rounded-t-sm transition-all hover:bg-accent-amber" style={{ height: `${(count / max) * 100}%`, minHeight: count > 0 ? '2px' : '0' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-between mt-1 text-[9px] font-mono text-text-muted">
                <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span>
              </div>
            </div>
            <div className="card-base p-5">
              <h3 className="font-mono text-sm font-bold text-text-primary flex items-center gap-1.5 mb-4">
                <Activity size={14} className="text-accent-blue" /> Invoice Pipeline
              </h3>
              {invoiceStats.total === 0 ? (
                <EmptyState text="No invoices yet" />
              ) : (
                <div className="space-y-3">
                  <FunnelRow label="Draft" count={invoiceStats.draft} total={invoiceStats.total} color="text-text-muted" barColor="bg-text-muted/30" />
                  <FunnelRow label="Sent" count={invoiceStats.sent} total={invoiceStats.total} color="text-accent-blue" barColor="bg-accent-blue/30" />
                  <FunnelRow label="Paid" count={invoiceStats.paid} total={invoiceStats.total} color="text-accent-green" barColor="bg-accent-green/30" />
                  <FunnelRow label="Cancelled" count={invoiceStats.cancelled} total={invoiceStats.total} color="text-red-400" barColor="bg-red-400/30" />
                  <div className="pt-3 border-t border-border grid grid-cols-2 gap-3">
                    <div className="text-center">
                      <div className="text-lg font-mono font-bold text-accent-green">{formatCurrency(invoiceStats.paidAmount)}</div>
                      <div className="text-[10px] font-mono text-text-muted uppercase">Collected</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-mono font-bold text-accent-amber">{formatCurrency(invoiceStats.outstandingAmount)}</div>
                      <div className="text-[10px] font-mono text-text-muted uppercase">Outstanding</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Customer Tiers + Top Customers + Material Requests */}
          <div className="grid lg:grid-cols-3 gap-4 mb-4">
            <div className="card-base p-5">
              <h3 className="font-mono text-sm font-bold text-text-primary flex items-center gap-1.5 mb-4">
                <Users size={14} className="text-accent-amber" /> Customer Tiers
              </h3>
              <DonutChart
                segments={[
                  { label: 'Standard', value: tierStats.none, color: '#6B7280' },
                  { label: 'Silver', value: tierStats.silver, color: '#9CA3AF' },
                  { label: 'Gold', value: tierStats.gold, color: '#F59E0B' },
                  { label: 'Platinum', value: tierStats.platinum, color: '#3B82F6' },
                ]}
              />
              <div className="mt-3 space-y-1.5">
                {[
                  { label: 'Standard', value: tierStats.none, color: 'bg-gray-500' },
                  { label: 'Silver (5%)', value: tierStats.silver, color: 'bg-gray-400' },
                  { label: 'Gold (10%)', value: tierStats.gold, color: 'bg-accent-amber' },
                  { label: 'Platinum (15%)', value: tierStats.platinum, color: 'bg-accent-blue' },
                ].map((t) => (
                  <div key={t.label} className="flex items-center justify-between text-[11px] font-mono">
                    <span className="flex items-center gap-1.5 text-text-secondary"><span className={`w-2 h-2 rounded-full ${t.color}`} />{t.label}</span>
                    <span className="text-text-primary">{t.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card-base p-5">
              <h3 className="font-mono text-sm font-bold text-text-primary flex items-center gap-1.5 mb-4">
                <DollarSign size={14} className="text-accent-green" /> Top Customers
              </h3>
              {topCustomers.length === 0 ? (
                <EmptyState text="No customer revenue yet" />
              ) : (
                <div className="space-y-2.5">
                  {topCustomers.map((c, i) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-text-muted w-4">{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-mono text-text-primary truncate">{c.name}</div>
                        <div className="text-[10px] text-text-muted">{c.totalOrders} orders</div>
                      </div>
                      <span className="text-xs font-mono text-accent-green font-bold">{formatCurrency(c.totalSpent)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="card-base p-5">
              <h3 className="font-mono text-sm font-bold text-text-primary flex items-center gap-1.5 mb-4">
                <Package size={14} className="text-accent-blue" /> Material Requests
              </h3>
              {materialStats.length === 0 ? (
                <EmptyState text="No part requests yet" />
              ) : (
                <div className="space-y-2.5">
                  {materialStats.slice(0, 8).map(([material, count]) => {
                    const max = materialStats[0]?.[1] || 1
                    return (
                      <div key={material}>
                        <div className="flex items-center justify-between text-[11px] font-mono mb-0.5">
                          <span className="text-text-primary">{material}</span>
                          <span className="text-text-muted">{count}</span>
                        </div>
                        <div className="h-1 bg-bg-tertiary rounded-full overflow-hidden">
                          <div className="h-full bg-accent-blue/60 rounded-full" style={{ width: `${(count / max) * 100}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Product Catalog Overview */}
          <div className="card-base p-5">
            <h3 className="font-mono text-sm font-bold text-text-primary flex items-center gap-1.5 mb-4">
              <Package size={14} className="text-accent-amber" /> Product Catalog Overview
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-mono font-bold text-text-primary">{products.length}</div>
                <div className="text-[10px] font-mono text-text-muted uppercase">Total Products</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-mono font-bold text-accent-green">{products.filter((p) => p.inStock).length}</div>
                <div className="text-[10px] font-mono text-text-muted uppercase">In Stock</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-mono font-bold text-red-400">{products.filter((p) => !p.inStock).length}</div>
                <div className="text-[10px] font-mono text-text-muted uppercase">Out of Stock</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-mono font-bold text-accent-amber">{formatCurrency(products.reduce((s, p) => s + p.price, 0) / (products.length || 1))}</div>
                <div className="text-[10px] font-mono text-text-muted uppercase">Avg Price</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ── KPI Card ───────────────────────────── */

function KpiCard({ label, value, delta, subtitle, icon, color }: {
  label: string; value: string; delta?: number; subtitle?: string; icon: React.ReactNode; color: 'amber' | 'blue' | 'green'
}) {
  const colorClasses = {
    amber: 'bg-accent-amber/10 text-accent-amber',
    blue: 'bg-accent-blue/10 text-accent-blue',
    green: 'bg-accent-green/10 text-accent-green',
  }
  return (
    <div className="card-base p-4">
      <div className="flex items-center justify-between mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>{icon}</div>
        {delta !== undefined && (
          <span className={`flex items-center gap-0.5 text-[11px] font-mono ${delta > 0 ? 'text-accent-green' : delta < 0 ? 'text-red-400' : 'text-text-muted'}`}>
            {delta > 0 ? <ArrowUpRight size={12} /> : delta < 0 ? <ArrowDownRight size={12} /> : <Minus size={10} />}
            {Math.abs(delta).toFixed(0)}%
          </span>
        )}
      </div>
      <div className="font-mono text-xl font-bold text-text-primary">{value}</div>
      <div className="text-[10px] font-mono text-text-muted uppercase mt-0.5">{label}</div>
      {subtitle && <div className="text-[10px] font-mono text-accent-blue mt-0.5">{subtitle}</div>}
    </div>
  )
}

function MiniStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="card-base p-3 flex items-center gap-3">
      <div className="text-text-muted">{icon}</div>
      <div>
        <div className="text-sm font-mono font-bold text-text-primary">{value}</div>
        <div className="text-[9px] font-mono text-text-muted uppercase">{label}</div>
      </div>
    </div>
  )
}

/* ── Bar Chart ───────────────────────────── */

function BarChart({ data, labels, color, height = 120, formatValue }: {
  data: number[]; labels: string[]; color: 'amber' | 'blue' | 'green'; height?: number; formatValue?: (n: number) => string
}) {
  const max = Math.max(...data, 1)
  const barColor = color === 'amber' ? 'bg-accent-amber' : color === 'blue' ? 'bg-accent-blue' : 'bg-accent-green'
  const barColorHover = color === 'amber' ? 'hover:bg-accent-amber' : color === 'blue' ? 'hover:bg-accent-blue' : 'hover:bg-accent-green'

  const maxBars = 30
  const grouped = data.length > maxBars
    ? (() => {
        const step = Math.ceil(data.length / maxBars)
        const result: { value: number; label: string }[] = []
        for (let i = 0; i < data.length; i += step) {
          const slice = data.slice(i, i + step)
          result.push({ value: slice.reduce((a, b) => a + b, 0), label: labels[i] || '' })
        }
        return result
      })()
    : data.map((v, i) => ({ value: v, label: labels[i] || '' }))

  return (
    <div>
      <div className="flex items-end gap-[1px]" style={{ height }}>
        {grouped.map((bar, i) => (
          <div key={i} className="flex-1 flex items-end group relative" title={`${bar.label}: ${formatValue ? formatValue(bar.value) : bar.value}`}>
            <div
              className={`w-full ${barColor}/50 ${barColorHover} rounded-t-sm transition-all cursor-default`}
              style={{ height: `${Math.max((bar.value / max) * 100, bar.value > 0 ? 2 : 0)}%` }}
            />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
              <div className="bg-bg-primary border border-border rounded px-1.5 py-0.5 text-[9px] font-mono text-text-primary whitespace-nowrap shadow-lg">
                {formatValue ? formatValue(bar.value) : bar.value}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1 text-[9px] font-mono text-text-muted">
        <span>{grouped[0]?.label.slice(5) || ''}</span>
        <span>{grouped[grouped.length - 1]?.label.slice(5) || ''}</span>
      </div>
    </div>
  )
}

/* ── Donut Chart ───────────────────────────── */

function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-[100px]">
        <div className="w-20 h-20 rounded-full border-4 border-border flex items-center justify-center">
          <span className="text-[10px] font-mono text-text-muted">0</span>
        </div>
      </div>
    )
  }
  let cumulativePercent = 0
  const stops = segments.map((seg) => {
    const start = cumulativePercent
    cumulativePercent += (seg.value / total) * 100
    return `${seg.color} ${start}% ${cumulativePercent}%`
  })
  return (
    <div className="flex items-center justify-center h-[100px]">
      <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: `conic-gradient(${stops.join(', ')})` }}>
        <div className="w-12 h-12 rounded-full bg-bg-secondary flex items-center justify-center">
          <span className="text-xs font-mono font-bold text-text-primary">{total}</span>
        </div>
      </div>
    </div>
  )
}

/* ── Funnel Row ───────────────────────────── */

function FunnelRow({ label, count, total, color, barColor }: { label: string; count: number; total: number; color: string; barColor: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] font-mono mb-0.5">
        <span className={color}>{label}</span>
        <span className="text-text-primary">{count} ({pct.toFixed(0)}%)</span>
      </div>
      <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

/* ── Empty State ───────────────────────────── */

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center h-24">
      <p className="text-text-muted text-xs font-mono">{text}</p>
    </div>
  )
}
