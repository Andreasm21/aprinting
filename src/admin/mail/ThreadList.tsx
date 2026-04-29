// Left pane of the mail client — filter chips + search + thread cards.

import { useMemo, useState } from 'react'
import { Search, Inbox, Mail, Archive, X } from 'lucide-react'
import { useEmailsStore, type EmailThread } from '@/stores/emailsStore'

type Filter = 'all' | 'unread' | 'archived'

interface Props {
  activeThreadId: string | null
  onSelect: (threadId: string) => void
}

function initials(name: string | undefined, email: string): string {
  const source = name?.trim() || email
  return source
    .split(/[\s@.]/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function ThreadList({ activeThreadId, onSelect }: Props) {
  const filtered = useEmailsStore((s) => s.filtered)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')

  const threads = useMemo(() => {
    const list = filtered(filter)
    if (!search.trim()) return list
    const q = search.trim().toLowerCase()
    return list.filter((t) =>
      t.subject.toLowerCase().includes(q) ||
      t.participantEmail.toLowerCase().includes(q) ||
      (t.participantName?.toLowerCase().includes(q) ?? false),
    )
  }, [filtered, filter, search])

  return (
    <div className="card-base flex flex-col h-full overflow-hidden">
      {/* Filter chips */}
      <div className="flex items-center gap-1 p-1 m-1 bg-bg-tertiary rounded-lg font-mono text-xs">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} icon={Inbox}>
          All
        </FilterChip>
        <FilterChip active={filter === 'unread'} onClick={() => setFilter('unread')} icon={Mail}>
          Unread
        </FilterChip>
        <FilterChip active={filter === 'archived'} onClick={() => setFilter('archived')} icon={Archive}>
          Archived
        </FilterChip>
      </div>

      {/* Search */}
      <div className="px-2 pb-2">
        <div className="relative">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subject, sender…"
            className="input-field text-xs pl-7 pr-7"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Thread cards */}
      <div className="flex-1 overflow-y-auto px-1 pb-1 space-y-0.5">
        {threads.length === 0 ? (
          <div className="px-3 py-8 text-center text-text-muted text-xs font-mono">
            {search ? 'No threads match your search.' : 'Inbox is empty.'}
          </div>
        ) : (
          threads.map((t) => (
            <ThreadCard
              key={t.id}
              thread={t}
              active={t.id === activeThreadId}
              onClick={() => onSelect(t.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}

function FilterChip({
  active, icon: Icon, onClick, children,
}: { active: boolean; icon: React.ComponentType<{ size?: number }>; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1 rounded transition-colors ${
        active
          ? 'bg-accent-amber text-bg-primary font-bold'
          : 'text-text-secondary hover:text-text-primary'
      }`}
    >
      <Icon size={11} /> {children}
    </button>
  )
}

function ThreadCard({ thread, active, onClick }: { thread: EmailThread; active: boolean; onClick: () => void }) {
  const isUnread = thread.unreadCount > 0
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-lg border transition-colors p-2.5 font-mono ${
        active
          ? 'bg-accent-amber/10 border-accent-amber/30'
          : 'border-transparent hover:bg-bg-tertiary/60 border-bg-tertiary/40'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-bold ${
          isUnread ? 'bg-accent-amber/20 text-accent-amber' : 'bg-bg-tertiary text-text-secondary'
        }`}>
          {initials(thread.participantName, thread.participantEmail)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className={`text-xs truncate ${isUnread ? 'text-text-primary font-bold' : 'text-text-secondary'}`}>
              {thread.participantName || thread.participantEmail.split('@')[0]}
            </p>
            <span className="text-[9px] text-text-muted flex-shrink-0">{relTime(thread.lastMessageAt)}</span>
          </div>
          <p className={`text-[11px] truncate mt-0.5 ${isUnread ? 'text-text-primary font-medium' : 'text-text-muted'}`}>
            {thread.subject}
          </p>
          <div className="flex items-center gap-2 mt-1">
            {isUnread && (
              <span className="bg-accent-amber text-bg-primary text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                {thread.unreadCount}
              </span>
            )}
            {thread.messageCount > 1 && (
              <span className="text-[9px] text-text-muted">· {thread.messageCount} msgs</span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}
