// /admin/mail — three-pane shared team inbox.
//
//   ┌──────────┬─────────────────────────┬──────────────────────────┐
//   │ Threads  │ Conversation            │ CRM context              │
//   │ (left)   │ (center)                │ (right rail)             │
//   └──────────┴─────────────────────────┴──────────────────────────┘
//
// Phase 2 ships the read view + filtering + auto-linked context. Compose
// + reply lands in Phase 3.

import { useEffect } from 'react'
import { Mail } from 'lucide-react'
import { useEmailsStore } from '@/stores/emailsStore'
import { useLeadsStore } from '@/stores/leadsStore'
import ThreadList from './mail/ThreadList'
import ThreadView from './mail/ThreadView'
import ContextRail from './mail/ContextRail'

export default function AdminMail() {
  const load = useEmailsStore((s) => s.load)
  const hasLoaded = useEmailsStore((s) => s.hasLoaded)
  const schemaMissing = useEmailsStore((s) => s.schemaMissing)
  const activeThreadId = useEmailsStore((s) => s.activeThreadId)
  const setActiveThread = useEmailsStore((s) => s.setActiveThread)
  const threads = useEmailsStore((s) => s.threads)

  // Leads feed ContextRail. customersStore auto-loads on module import,
  // so nothing to trigger there.
  const loadLeads = useLeadsStore((s) => s.load)
  useEffect(() => { void loadLeads?.() }, [loadLeads])

  useEffect(() => { if (!hasLoaded) void load() }, [hasLoaded, load])

  // Auto-select the first thread if nothing is selected
  useEffect(() => {
    if (activeThreadId) return
    const first = threads.find((t) => !t.archived)
    if (first) setActiveThread(first.id)
  }, [threads, activeThreadId, setActiveThread])

  if (schemaMissing) {
    return (
      <div className="card-base p-6 max-w-xl">
        <h1 className="font-mono text-lg font-bold text-text-primary mb-2 flex items-center gap-2">
          <Mail size={18} className="text-accent-amber" /> Mail
        </h1>
        <p className="text-text-secondary text-sm mb-3">The mail-client schema isn't installed yet.</p>
        <code className="block bg-bg-tertiary border border-border rounded px-3 py-2 text-xs text-accent-amber select-all">
          supabase/migrations/20260429_mail_client.sql
        </code>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h1 className="font-mono text-2xl font-bold text-text-primary flex items-center gap-2">
            <Mail size={24} className="text-accent-amber" /> Mail
          </h1>
          <p className="text-text-secondary text-sm">Shared team inbox · {threads.length} thread{threads.length === 1 ? '' : 's'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] lg:grid-cols-[280px_1fr_280px] gap-3 flex-1 min-h-0">
        <ThreadList activeThreadId={activeThreadId} onSelect={setActiveThread} />
        {activeThreadId ? (
          <ThreadView threadId={activeThreadId} />
        ) : (
          <div className="card-base flex items-center justify-center text-text-muted text-xs font-mono">
            Select a thread on the left to read it.
          </div>
        )}
        {/* Context rail hidden on mobile, shown on lg+ */}
        <div className="hidden lg:block">
          {activeThreadId && <ContextRail threadId={activeThreadId} />}
        </div>
      </div>
    </div>
  )
}
