// Admin presence — joins a single Supabase Realtime presence channel and
// streams the live online roster into useAdminChatStore.
//
// One channel per admin tab. Auto-cleans on disconnect, no heartbeat code
// needed. Mounted by AdminChatBubble while the user is signed in.

import { useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { useAdminChatStore, type PresenceEntry } from '@/stores/adminChatStore'

/** Shape of the metadata each tab broadcasts via `track()`. */
interface PresenceMeta {
  user_id: string
  display_name: string
  online_at: string
}

export function useAdminPresence() {
  const currentUser = useAdminAuthStore((s) => s.currentUser)
  const allUsers = useAdminAuthStore((s) => s.users)
  const setPresence = useAdminChatStore((s) => s._setPresence)

  useEffect(() => {
    if (!currentUser || !isSupabaseConfigured) {
      setPresence([])
      return
    }

    const channel = supabase.channel('admin-presence', {
      config: { presence: { key: currentUser.id } },
    })

    const syncRoster = () => {
      // Supabase returns presenceState as { [key]: Presence[] }
      // Each `Presence` carries whatever we passed to track().
      const state = channel.presenceState() as Record<string, PresenceMeta[]>
      const onlineIds = new Set<string>()
      for (const metas of Object.values(state)) {
        for (const meta of metas) onlineIds.add(meta.user_id)
      }

      // Build a roster of every known admin, marking online vs offline
      const entries: PresenceEntry[] = allUsers.map((u) => ({
        userId: u.id,
        displayName: u.displayName,
        online: onlineIds.has(u.id),
        lastSeen: onlineIds.has(u.id) ? undefined : u.lastLoginAt,
      }))
      setPresence(entries)
    }

    channel
      .on('presence', { event: 'sync' }, syncRoster)
      .on('presence', { event: 'join' }, syncRoster)
      .on('presence', { event: 'leave' }, syncRoster)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: currentUser.id,
            display_name: currentUser.displayName,
            online_at: new Date().toISOString(),
          } satisfies PresenceMeta)
        }
      })

    return () => {
      void channel.untrack().catch(() => {})
      void supabase.removeChannel(channel).catch(() => {})
    }
  }, [currentUser, allUsers, setPresence])
}
