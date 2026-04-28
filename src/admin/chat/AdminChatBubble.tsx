// Floating admin-chat bubble — fixed bottom-right of every admin page.
//
// Layout:
//   Closed → small amber circle with unread-count badge
//   Open   → 380×560 panel: header (room switcher + people + close)
//                           body (chat OR people roster)
//                           composer
//
// Subscribes to:
//   useAdminPresence       → online roster
//   useGlobalChatRealtime  → message INSERTs (drives the unread badge even
//                            when the panel is closed)
//   useRoomRealtime        → live messages + reads for the active room
//
// Phase 4 adds RoomList rail; for now the rail is a header dropdown.

import { useEffect, useMemo, useRef, useState } from 'react'
import { MessageCircle, X, Users, Hash, ChevronDown, Plus, Bell, BellOff, MessageSquare, ListChecks, Copy, Send, Phone, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { useAdminChatStore } from '@/stores/adminChatStore'
import { useAdminVoiceStore } from '@/stores/adminVoiceStore'
import { useAdminClientChatStore } from '@/stores/adminClientChatStore'
import { useAdminPresence } from '@/hooks/useAdminPresence'
import { useGlobalChatRealtime, useRoomRealtime } from '@/hooks/useChatRealtime'
import { useReadReceipts } from '@/hooks/useReadReceipts'
import { useTypingIndicator } from '@/hooks/useTypingIndicator'
import { useBrowserNotifications } from '@/hooks/useBrowserNotifications'
import { useVoiceRoom } from '@/hooks/useVoiceRoom'
import MessageList from './MessageList'
import MessageComposer from './MessageComposer'
import PresenceDot from './PresenceDot'
import TypingIndicator from './TypingIndicator'
import CreateRoomModal from './CreateRoomModal'
import DMStarterModal from './DMStarterModal'
import AssignTaskModal from './AssignTaskModal'
import VoiceRoomBar from './VoiceRoomBar'
import ContextMenu, { type ContextMenuItem } from '@/components/ui/ContextMenu'

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).filter(Boolean).join('').toUpperCase().slice(0, 2)
}

type View = 'chat' | 'people' | 'clients'

export default function AdminChatBubble() {
  const currentUser = useAdminAuthStore((s) => s.currentUser)
  const allUsers = useAdminAuthStore((s) => s.users)

  // Light up the realtime channels for the lifetime of the bubble. The hooks
  // self-noop when there's no current user / no Supabase config.
  useAdminPresence()
  useGlobalChatRealtime()
  useBrowserNotifications()

  const presence = useAdminChatStore((s) => s.presence)
  const rooms = useAdminChatStore((s) => s.rooms)
  const membersByRoom = useAdminChatStore((s) => s.membersByRoom)
  const messagesByRoom = useAdminChatStore((s) => s.messagesByRoom)
  const lastReadByRoom = useAdminChatStore((s) => s.lastReadByRoom)
  const mutedByRoom = useAdminChatStore((s) => s.mutedByRoom)
  const schemaMissing = useAdminChatStore((s) => s.schemaMissing)
  const bubbleOpen = useAdminChatStore((s) => s.bubbleOpen)
  const toggleBubble = useAdminChatStore((s) => s.toggleBubble)
  const activeRoomId = useAdminChatStore((s) => s.activeRoomId)
  const setActiveRoom = useAdminChatStore((s) => s.setActiveRoom)
  const loadRooms = useAdminChatStore((s) => s.loadRooms)
  const loadMessages = useAdminChatStore((s) => s.loadMessages)
  const loadReads = useAdminChatStore((s) => s.loadReads)
  const hasLoadedRooms = useAdminChatStore((s) => s.hasLoadedRooms)
  const muteRoom = useAdminChatStore((s) => s.muteRoom)
  const leaveRoom = useAdminChatStore((s) => s.leaveRoom)

  // Compute unread counts from primitives — Map-of-arrays comparisons are
  // deep-equal-by-identity; we rely on _onMessageInserted creating new
  // Map+array references when something actually changes.
  const unreadCounts = useMemo(() => {
    const out = new Map<string, number>()
    for (const r of rooms) {
      const msgs = messagesByRoom.get(r.id) ?? []
      if (msgs.length === 0) { out.set(r.id, 0); continue }
      const lastReadId = lastReadByRoom.get(r.id)
      if (!lastReadId) { out.set(r.id, msgs.length); continue }
      const idx = msgs.findIndex((m) => m.id === lastReadId)
      if (idx === -1) { out.set(r.id, msgs.length); continue }
      out.set(r.id, Math.max(0, msgs.length - 1 - idx))
    }
    return out
  }, [rooms, messagesByRoom, lastReadByRoom])

  const totalUnread = useMemo(() => {
    let total = 0
    for (const n of unreadCounts.values()) total += n
    return total
  }, [unreadCounts])

  const isRoomMuted = (roomId: string): boolean => {
    const until = mutedByRoom.get(roomId)
    if (!until) return false
    return new Date(until).getTime() > Date.now()
  }
  const getUnreadCount = (roomId: string): number => unreadCounts.get(roomId) ?? 0

  // Sub-views
  const [view, setView] = useState<View>('chat')
  const [showRoomMenu, setShowRoomMenu] = useState(false)
  const [showCreateRoom, setShowCreateRoom] = useState(false)
  const [showStartDM, setShowStartDM] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null)
  const [assignTaskFor, setAssignTaskFor] = useState<string | null>(null)

  // Bootstrap rooms once on first sign-in
  useEffect(() => {
    if (currentUser && !hasLoadedRooms) void loadRooms(currentUser.id)
  }, [currentUser, hasLoadedRooms, loadRooms])

  // Auto-select #general (or the first room) once rooms arrive
  useEffect(() => {
    if (!activeRoomId && rooms.length > 0) {
      const general = rooms.find((r) => r.kind === 'channel' && r.name === 'general')
      setActiveRoom(general?.id ?? rooms[0].id)
    }
  }, [rooms, activeRoomId, setActiveRoom])

  // Load messages + reads when the active room changes
  useEffect(() => {
    if (!activeRoomId) return
    void loadMessages(activeRoomId).then(() => loadReads(activeRoomId))
  }, [activeRoomId, loadMessages, loadReads])

  // Subscribe to message + read inserts for the active room
  useRoomRealtime(activeRoomId)

  // Typing indicator (broadcast channel) — receive on the bubble, send via composer
  const { notifyTyping } = useTypingIndicator(activeRoomId)

  // Read-receipt observer — only marks while panel is open + chat view
  useReadReceipts(activeRoomId, bubbleOpen && view === 'chat')

  // ─── Customer chats (visitor live chat) ───
  const clientThreads = useAdminClientChatStore((s) => s.threads)
  const clientMessagesByThread = useAdminClientChatStore((s) => s.messagesByThread)
  const loadClientChats = useAdminClientChatStore((s) => s.load)
  const hasLoadedClientChats = useAdminClientChatStore((s) => s.hasLoaded)
  const setActiveClientThread = useAdminClientChatStore((s) => s.setActiveThread)
  const activeClientThreadId = useAdminClientChatStore((s) => s.activeThreadId)
  const sendClientReply = useAdminClientChatStore((s) => s.sendReply)
  const clientUnread = useMemo(() => {
    let total = 0
    for (const t of clientThreads) {
      const msgs = clientMessagesByThread.get(t.id) ?? []
      for (const m of msgs) {
        if (m.authorKind === 'visitor' && !m.readAt) total += 1
      }
    }
    return total
  }, [clientThreads, clientMessagesByThread])
  useEffect(() => {
    if (!hasLoadedClientChats) void loadClientChats()
  }, [hasLoadedClientChats, loadClientChats])
  const [clientReplyDraft, setClientReplyDraft] = useState('')

  // ─── Voice room (Phase D) ───
  const loadVoice = useAdminVoiceStore((s) => s.load)
  const voiceJoin = useAdminVoiceStore((s) => s.join)
  const voiceLeave = useAdminVoiceStore((s) => s.leave)
  const voiceCount = useAdminVoiceStore((s) =>
    activeRoomId ? s.byRoom.get(activeRoomId)?.size ?? 0 : 0,
  )
  const iAmInVoice = useAdminVoiceStore((s) =>
    Boolean(activeRoomId && currentUser && s.byRoom.get(activeRoomId)?.has(currentUser.id)),
  )
  useEffect(() => { void loadVoice() }, [loadVoice])

  const voiceRoom = useVoiceRoom(activeRoomId, iAmInVoice)

  const joinVoice = async () => {
    if (!activeRoomId || !currentUser) return
    await voiceJoin(activeRoomId, currentUser.id)
  }
  const leaveVoice = async () => {
    if (!activeRoomId || !currentUser) return
    await voiceLeave(activeRoomId, currentUser.id)
  }

  // ─── Computed ───
  const activeRoom = useMemo(
    () => rooms.find((r) => r.id === activeRoomId) ?? null,
    [rooms, activeRoomId],
  )
  const usersById = useMemo(() => new Map(allUsers.map((u) => [u.id, u])), [allUsers])

  const onlineCount = Array.from(presence.values()).filter((p) => p.online).length

  const roster = useMemo(() => {
    if (!currentUser) return []
    return Array.from(presence.values()).sort((a, b) => {
      if (a.userId === currentUser.id) return -1
      if (b.userId === currentUser.id) return 1
      if (a.online !== b.online) return a.online ? -1 : 1
      return a.displayName.localeCompare(b.displayName)
    })
  }, [presence, currentUser])

  /** Render a room label: '#general' for channels, 'Sarah' for DMs. */
  const labelFor = useMemo(
    () => (roomId: string): string => {
      const r = rooms.find((x) => x.id === roomId)
      if (!r) return ''
      if (r.kind === 'channel') return `#${r.name ?? 'channel'}`
      const members = membersByRoom.get(r.id) ?? []
      const otherId = members.find((id) => id !== currentUser?.id)
      const other = otherId ? usersById.get(otherId) : undefined
      return other?.displayName ?? 'Direct message'
    },
    [rooms, membersByRoom, usersById, currentUser],
  )

  if (!currentUser) return null

  const muted = activeRoomId ? isRoomMuted(activeRoomId) : false

  return (
    <>
      <div className="fixed bottom-5 right-5 z-50 font-mono text-xs">
        {/* Expanded panel */}
        {bubbleOpen && (
          <div className="mb-3 w-[380px] h-[560px] flex flex-col rounded-2xl bg-bg-secondary border border-border shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-3 py-2.5 border-b border-border bg-bg-tertiary/50 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => { setShowRoomMenu((v) => !v); setView('chat') }}
                disabled={rooms.length === 0}
                className="flex items-center gap-1.5 min-w-0 hover:text-accent-amber transition-colors disabled:opacity-50"
              >
                {activeRoom?.kind === 'dm'
                  ? <MessageSquare size={13} className="text-accent-amber flex-shrink-0" />
                  : <Hash size={13} className="text-accent-amber flex-shrink-0" />
                }
                <span className="text-text-primary font-bold truncate">
                  {activeRoom ? labelFor(activeRoom.id) : 'Studio'}
                </span>
                {rooms.length > 0 && <ChevronDown size={12} className="text-text-muted flex-shrink-0" />}
              </button>

              <div className="flex items-center gap-1.5">
                {activeRoomId && (
                  <button
                    type="button"
                    onClick={() => { if (iAmInVoice) void leaveVoice(); else void joinVoice() }}
                    aria-label={iAmInVoice ? 'Leave voice' : voiceCount > 0 ? `Join voice (${voiceCount})` : 'Start voice'}
                    title={iAmInVoice ? 'Leave voice' : voiceCount > 0 ? `Join voice · ${voiceCount} in call` : 'Start voice'}
                    className={`relative p-1 rounded transition-colors ${
                      iAmInVoice ? 'text-emerald-400 bg-emerald-500/10'
                        : voiceCount > 0 ? 'text-emerald-400 hover:bg-bg-tertiary'
                        : 'text-text-secondary hover:text-accent-amber'
                    }`}
                  >
                    <Phone size={12} />
                    {voiceCount > 0 && !iAmInVoice && (
                      <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    )}
                  </button>
                )}
                {activeRoomId && (
                  <button
                    type="button"
                    onClick={() => muteRoom(activeRoomId, currentUser.id, muted ? null : new Date(Date.now() + 8 * 3600_000).toISOString())}
                    aria-label={muted ? 'Unmute room' : 'Mute room for 8h'}
                    className={`p-1 rounded transition-colors ${muted ? 'text-text-muted' : 'text-text-secondary hover:text-accent-amber'}`}
                    title={muted ? 'Unmute' : 'Mute notifications for 8h'}
                  >
                    {muted ? <BellOff size={12} /> : <Bell size={12} />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setView(view === 'people' ? 'chat' : 'people')}
                  aria-label="Toggle people roster"
                  className={`p-1 rounded transition-colors ${
                    view === 'people' ? 'text-accent-amber bg-accent-amber/10' : 'text-text-secondary hover:text-accent-amber'
                  }`}
                  title="Show online roster"
                >
                  <Users size={12} />
                  <span className="sr-only">{onlineCount} online</span>
                </button>
                <button
                  type="button"
                  onClick={() => setView(view === 'clients' ? 'chat' : 'clients')}
                  aria-label="Customer chats"
                  className={`relative p-1 rounded transition-colors ${
                    view === 'clients' ? 'text-accent-amber bg-accent-amber/10' : 'text-text-secondary hover:text-accent-amber'
                  }`}
                  title="Live chats from visitors"
                >
                  <MessageSquare size={12} />
                  {clientUnread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[12px] h-3 px-0.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">
                      {clientUnread > 9 ? '9+' : clientUnread}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={toggleBubble}
                  aria-label="Close chat"
                  className="text-text-muted hover:text-text-primary transition-colors p-1"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Room dropdown menu */}
            {showRoomMenu && rooms.length > 0 && (
              <div className="border-b border-border bg-bg-secondary max-h-72 overflow-y-auto">
                <div className="py-1">
                  {/* Channels */}
                  {rooms.filter((r) => r.kind === 'channel').length > 0 && (
                    <div className="px-3 pt-1.5 pb-0.5 text-[9px] uppercase text-text-muted tracking-wider">Channels</div>
                  )}
                  {rooms.filter((r) => r.kind === 'channel').map((r) => {
                    const unread = getUnreadCount(r.id)
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => { setActiveRoom(r.id); setShowRoomMenu(false); setView('chat') }}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-bg-tertiary/60 ${
                          r.id === activeRoomId ? 'bg-bg-tertiary/40 text-accent-amber' : 'text-text-secondary'
                        }`}
                      >
                        <Hash size={11} />
                        <span className="flex-1 text-left truncate">{r.name}</span>
                        {unread > 0 && (
                          <span className="bg-accent-amber text-bg-primary text-[9px] font-bold px-1.5 py-0.5 rounded-full">{unread}</span>
                        )}
                      </button>
                    )
                  })}

                  {/* DMs */}
                  {rooms.filter((r) => r.kind === 'dm').length > 0 && (
                    <div className="px-3 pt-2 pb-0.5 text-[9px] uppercase text-text-muted tracking-wider">Direct messages</div>
                  )}
                  {rooms.filter((r) => r.kind === 'dm').map((r) => {
                    const unread = getUnreadCount(r.id)
                    const otherId = (membersByRoom.get(r.id) ?? []).find((id) => id !== currentUser.id)
                    const other = otherId ? usersById.get(otherId) : undefined
                    const isOnline = otherId ? presence.get(otherId)?.online ?? false : false
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => { setActiveRoom(r.id); setShowRoomMenu(false); setView('chat') }}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-bg-tertiary/60 ${
                          r.id === activeRoomId ? 'bg-bg-tertiary/40 text-accent-amber' : 'text-text-secondary'
                        }`}
                      >
                        <PresenceDot online={isOnline} size={7} />
                        <span className="flex-1 text-left truncate">{other?.displayName ?? 'Unknown'}</span>
                        {unread > 0 && (
                          <span className="bg-accent-amber text-bg-primary text-[9px] font-bold px-1.5 py-0.5 rounded-full">{unread}</span>
                        )}
                      </button>
                    )
                  })}

                  {/* Create / new DM */}
                  <div className="border-t border-border mt-1.5 pt-1.5 px-2 pb-1.5 flex gap-1">
                    <button
                      type="button"
                      disabled={schemaMissing}
                      onClick={() => { setShowCreateRoom(true); setShowRoomMenu(false) }}
                      className="flex-1 flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-text-muted hover:text-accent-amber py-1.5 rounded border border-dashed border-border hover:border-accent-amber transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-text-muted disabled:hover:border-border"
                    >
                      <Plus size={10} /> Channel
                    </button>
                    <button
                      type="button"
                      disabled={schemaMissing}
                      onClick={() => { setShowStartDM(true); setShowRoomMenu(false) }}
                      className="flex-1 flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-text-muted hover:text-accent-amber py-1.5 rounded border border-dashed border-border hover:border-accent-amber transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-text-muted disabled:hover:border-border"
                    >
                      <Plus size={10} /> DM
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Body */}
            {view === 'chat' && activeRoomId && (
              <>
                <MessageList roomId={activeRoomId} />
                <TypingIndicator roomId={activeRoomId} />
                {iAmInVoice && (
                  <VoiceRoomBar
                    roomId={activeRoomId}
                    localMuted={voiceRoom.localMuted}
                    onToggleMute={voiceRoom.toggleMute}
                    onLeave={() => void leaveVoice()}
                    levels={voiceRoom.levels}
                  />
                )}
                <MessageComposer roomId={activeRoomId} onType={notifyTyping} />
              </>
            )}
            {view === 'chat' && !activeRoomId && (
              <div className="flex-1 flex flex-col items-center justify-center text-text-muted p-6 text-center">
                {schemaMissing ? (
                  <>
                    <p className="text-text-secondary text-xs font-bold mb-2">Chat schema not installed</p>
                    <p className="text-[11px] leading-relaxed opacity-80 mb-3">
                      Open the Supabase SQL Editor and run:
                    </p>
                    <code className="bg-bg-tertiary border border-border rounded px-2 py-1 text-[10px] text-accent-amber select-all break-all">
                      supabase/migrations/20260428_admin_chat.sql
                    </code>
                    <p className="text-[10px] opacity-60 mt-3">Refresh this page once the migration is applied.</p>
                  </>
                ) : (
                  <>
                    <p>No rooms yet.</p>
                    <div className="mt-4 flex gap-2">
                      <button type="button" onClick={() => setShowCreateRoom(true)} className="px-3 py-1.5 rounded border border-border hover:border-accent-amber text-text-secondary hover:text-accent-amber text-[10px] uppercase tracking-wider">+ Channel</button>
                      <button type="button" onClick={() => setShowStartDM(true)} className="px-3 py-1.5 rounded border border-border hover:border-accent-amber text-text-secondary hover:text-accent-amber text-[10px] uppercase tracking-wider">+ DM</button>
                    </div>
                  </>
                )}
              </div>
            )}

            {view === 'clients' && (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Sub-header */}
                <div className="px-3 py-2 border-b border-border bg-bg-tertiary/30 flex items-center justify-between">
                  <span className="text-[10px] uppercase text-text-muted tracking-wider">
                    Customer chats · {clientThreads.filter((t) => t.status === 'open').length} open
                  </span>
                  <Link
                    to="/admin/conversations"
                    onClick={() => useAdminChatStore.getState().setBubbleOpen(false)}
                    className="text-[10px] text-text-muted hover:text-accent-amber flex items-center gap-1"
                  >
                    Open page <ExternalLink size={9} />
                  </Link>
                </div>

                {/* Thread list (compact) */}
                {!activeClientThreadId ? (
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {clientThreads.length === 0 && (
                      <div className="px-3 py-8 text-center text-text-muted text-xs">
                        <p>No customer chats yet.</p>
                        <p className="mt-1 text-[10px] opacity-70">When visitors open the live chat on the storefront, threads appear here.</p>
                      </div>
                    )}
                    {clientThreads.slice(0, 20).map((t) => {
                      const msgs = clientMessagesByThread.get(t.id) ?? []
                      const last = msgs[msgs.length - 1]
                      const unread = msgs.filter((m) => m.authorKind === 'visitor' && !m.readAt).length
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setActiveClientThread(t.id)}
                          className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg hover:bg-bg-tertiary/60 text-left"
                        >
                          <div className="w-7 h-7 rounded-full bg-accent-amber/10 flex items-center justify-center text-accent-amber font-bold text-[10px] flex-shrink-0">
                            {initials(t.visitorName)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1.5">
                              <p className="text-text-primary text-xs font-bold truncate">{t.visitorName}</p>
                              {unread > 0 && (
                                <span className="bg-accent-amber text-bg-primary text-[9px] font-bold px-1.5 py-0.5 rounded-full">{unread}</span>
                              )}
                            </div>
                            <p className="text-text-muted text-[10px] truncate">{last?.body ?? '—'}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <ClientThreadView
                    threadId={activeClientThreadId}
                    onBack={() => setActiveClientThread(null)}
                    onSend={async (body) => {
                      if (!body.trim() || !currentUser) return
                      await sendClientReply(activeClientThreadId, currentUser.id, body)
                      setClientReplyDraft('')
                    }}
                    draft={clientReplyDraft}
                    setDraft={setClientReplyDraft}
                  />
                )}
              </div>
            )}

            {view === 'people' && (
              <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                <div className="px-2 py-1.5 text-[10px] uppercase text-text-muted tracking-wider">
                  Studio · {onlineCount} online
                </div>
                {roster.map((member) => {
                  const isMe = member.userId === currentUser.id
                  const username = allUsers.find((u) => u.id === member.userId)?.username
                  const openDM = async () => {
                    const id = await useAdminChatStore.getState().openOrCreateDM(member.userId, currentUser.id)
                    if (id) { setActiveRoom(id); setView('chat') }
                  }
                  const handleContextMenu = (e: React.MouseEvent) => {
                    e.preventDefault()
                    const items: ContextMenuItem[] = [
                      { label: 'Assign task', icon: ListChecks, onClick: () => setAssignTaskFor(member.userId) },
                    ]
                    if (!isMe) {
                      items.push({ label: 'Send DM', icon: Send, onClick: () => void openDM() })
                    }
                    if (username) {
                      items.push({
                        label: 'Copy username',
                        icon: Copy,
                        onClick: () => { void navigator.clipboard.writeText(`@${username}`) },
                      })
                    }
                    setContextMenu({ x: e.clientX, y: e.clientY, items })
                  }
                  return (
                    <button
                      key={member.userId}
                      type="button"
                      disabled={isMe}
                      onClick={() => { if (!isMe) void openDM() }}
                      onContextMenu={handleContextMenu}
                      className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-bg-tertiary/60 disabled:hover:bg-transparent disabled:cursor-default"
                    >
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-accent-amber/10 flex items-center justify-center text-accent-amber font-bold text-[11px]">
                          {initials(member.displayName)}
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 ring-2 ring-bg-secondary rounded-full">
                          <PresenceDot online={member.online} size={9} />
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 text-left">
                        <div className="flex items-center gap-1.5">
                          <p className="text-text-primary truncate">{member.displayName}</p>
                          {isMe && <span className="text-[9px] uppercase text-text-muted tracking-wider">you</span>}
                        </div>
                        <p className="text-[10px] text-text-muted">{member.online ? 'Active now' : 'Offline'}</p>
                      </div>
                      {!isMe && <span className="text-[10px] text-text-muted opacity-60">Message →</span>}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Footer (channel only) */}
            {view === 'chat' && activeRoom?.kind === 'channel' && activeRoom.name !== 'general' && (
              <div className="px-3 py-1.5 border-t border-border bg-bg-tertiary/30 flex items-center justify-between text-[10px] text-text-muted">
                <span>{(membersByRoom.get(activeRoom.id) ?? []).length} member{(membersByRoom.get(activeRoom.id) ?? []).length === 1 ? '' : 's'}</span>
                <button
                  type="button"
                  onClick={() => leaveRoom(activeRoom.id, currentUser.id)}
                  className="hover:text-red-400 transition-colors uppercase tracking-wider"
                >
                  Leave
                </button>
              </div>
            )}
          </div>
        )}

        {/* Bubble button */}
        <button
          type="button"
          onClick={toggleBubble}
          aria-label={bubbleOpen ? 'Close chat' : 'Open chat'}
          className="relative w-12 h-12 rounded-full bg-accent-amber text-bg-primary shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
        >
          <MessageCircle size={20} />
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-bg-primary">
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </button>
      </div>

      {/* Modals */}
      {showCreateRoom && <CreateRoomModal onClose={() => setShowCreateRoom(false)} />}
      {showStartDM && <DMStarterModal onClose={() => setShowStartDM(false)} />}
      {assignTaskFor && (
        <AssignTaskModal
          assigneeId={assignTaskFor}
          sourceRoomId={activeRoomId ?? undefined}
          onClose={() => setAssignTaskFor(null)}
        />
      )}

      {/* Right-click context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  )
}

/** Compact reader + reply for one client chat inside the bubble. */
function ClientThreadView({
  threadId,
  onBack,
  onSend,
  draft,
  setDraft,
}: {
  threadId: string
  onBack: () => void
  onSend: (body: string) => Promise<void>
  draft: string
  setDraft: (v: string) => void
}) {
  const thread = useAdminClientChatStore((s) => s.threads.find((t) => t.id === threadId))
  const messages = useAdminClientChatStore((s) => s.messagesByThread.get(threadId) ?? [])
  const allUsers = useAdminAuthStore((s) => s.users)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  if (!thread) return null

  return (
    <>
      <div className="px-3 py-2 border-b border-border bg-bg-tertiary/30 flex items-center justify-between gap-2">
        <button type="button" onClick={onBack} className="text-text-muted hover:text-text-primary text-[10px] uppercase tracking-wider">
          ← All
        </button>
        <div className="text-right min-w-0 flex-1">
          <p className="text-text-primary text-xs font-bold truncate">{thread.visitorName}</p>
          <p className="text-[9px] text-text-muted truncate">{thread.visitorEmail}</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 font-mono">
        {messages.map((m) => {
          const isAdmin = m.authorKind === 'admin'
          const isSystem = m.authorKind === 'system'
          if (isSystem) return <div key={m.id} className="text-center text-text-muted text-[9px] italic">{m.body}</div>
          const author = isAdmin ? allUsers.find((u) => u.id === m.authorId) : null
          return (
            <div key={m.id} className={`flex gap-2 ${isAdmin ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`max-w-[230px] min-w-0 ${isAdmin ? 'text-right' : 'text-left'}`}>
                <div className={`inline-block px-2.5 py-1.5 rounded-2xl text-[11px] leading-relaxed break-words whitespace-pre-wrap ${
                  isAdmin
                    ? 'bg-accent-amber/15 text-text-primary rounded-tr-sm'
                    : 'bg-bg-tertiary text-text-primary rounded-tl-sm'
                }`}>
                  {m.body}
                </div>
                <p className="text-[9px] text-text-muted mt-0.5 px-1">
                  {isAdmin ? (author?.displayName ?? 'Admin') : thread.visitorName} · {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="border-t border-border p-2 bg-bg-tertiary/30">
        <div className="flex items-end gap-1.5 bg-bg-tertiary rounded-lg border border-border focus-within:border-accent-amber transition-colors px-2 py-1.5">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void onSend(draft)
              }
            }}
            rows={1}
            placeholder="Quick reply…  (Enter to send)"
            className="flex-1 bg-transparent resize-none outline-none text-text-primary text-xs leading-relaxed font-mono placeholder:text-text-muted/60 max-h-24 py-1"
          />
          <button
            type="button"
            onClick={() => void onSend(draft)}
            disabled={!draft.trim()}
            aria-label="Send reply"
            className="text-accent-amber disabled:text-text-muted/40 disabled:cursor-not-allowed hover:scale-110 transition-transform p-1"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </>
  )
}
