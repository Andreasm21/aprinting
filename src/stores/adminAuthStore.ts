import { create } from 'zustand'
import bcrypt from 'bcryptjs'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

const SESSION_KEY = 'axiom_admin_session'
const BOOTSTRAP_USERNAME = 'owner'
const BOOTSTRAP_PASSWORD = '15583712'

export interface AdminUser {
  id: string
  username: string
  displayName: string
  email?: string
  passwordHash: string
  mustChangePassword?: boolean
  createdAt: string
  lastLoginAt?: string
}

// Generate a memorable but secure random password (10 chars, no ambiguous letters)
export function generateRandomPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let pw = ''
  for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)]
  return pw
}

interface AdminAuthState {
  users: AdminUser[]
  currentUser: AdminUser | null
  loading: boolean
  bootstrap: () => Promise<void>
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  restoreSession: () => Promise<void>
  addAdmin: (data: { username: string; displayName: string; email?: string; password?: string }) => Promise<{ success: boolean; error?: string; generatedPassword?: string }>
  updateAdmin: (id: string, updates: { displayName?: string; email?: string }) => Promise<void>
  changePassword: (id: string, newPassword: string, clearMustChange?: boolean) => Promise<void>
  resetPassword: (id: string) => Promise<{ success: boolean; password?: string }>
  deleteAdmin: (id: string) => { success: boolean; error?: string }
}

// ──────────────────────── Supabase converters ────────────────────────

interface SbRow {
  id: string
  username: string
  display_name: string
  email: string | null
  password_hash: string
  must_change_password: boolean | null
  created_at: string
  last_login_at: string | null
}

function toRow(u: AdminUser): SbRow {
  return {
    id: u.id,
    username: u.username,
    display_name: u.displayName,
    email: u.email ?? null,
    password_hash: u.passwordHash,
    must_change_password: u.mustChangePassword ?? false,
    created_at: u.createdAt,
    last_login_at: u.lastLoginAt ?? null,
  }
}

function fromRow(r: SbRow): AdminUser {
  return {
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    email: r.email ?? undefined,
    passwordHash: r.password_hash,
    mustChangePassword: r.must_change_password ?? false,
    createdAt: r.created_at,
    lastLoginAt: r.last_login_at ?? undefined,
  }
}

// ──────────────────────── Supabase ops ────────────────────────

async function sbUpsert(user: AdminUser) {
  if (!isSupabaseConfigured) return
  try {
    const { error } = await supabase.from('admin_users').upsert(toRow(user), { onConflict: 'id' })
    if (error) console.error('[admin] upsert error:', error)
  } catch (err) { console.error('[admin]', err) }
}

async function sbDelete(id: string) {
  if (!isSupabaseConfigured) return
  try {
    const { error } = await supabase.from('admin_users').delete().eq('id', id)
    if (error) console.error('[admin] delete error:', error)
  } catch (err) { console.error('[admin]', err) }
}

async function sbFetch(): Promise<AdminUser[]> {
  if (!isSupabaseConfigured) return []
  try {
    const { data, error } = await supabase.from('admin_users').select('*').order('created_at', { ascending: true })
    if (error) {
      console.error('[admin] fetch error:', error)
      return []
    }
    return (data as SbRow[]).map(fromRow)
  } catch (err) {
    console.error('[admin]', err)
    return []
  }
}

// ──────────────────────── Store ────────────────────────

export const useAdminAuthStore = create<AdminAuthState>((set, get) => ({
  users: [],
  currentUser: null,
  loading: true,

  bootstrap: async () => {
    set({ loading: true })

    // Fetch from Supabase
    const remote = await sbFetch()
    let users: AdminUser[] = []

    if (remote.length > 0) {
      users = remote
    } else {
      // Seed bootstrap owner in Supabase
      console.log('[admin] Seeding bootstrap owner account')
      const hash = await bcrypt.hash(BOOTSTRAP_PASSWORD, 10)
      const owner: AdminUser = {
        id: `admin-${Date.now()}-owner`,
        username: BOOTSTRAP_USERNAME,
        displayName: 'Owner',
        passwordHash: hash,
        createdAt: new Date().toISOString(),
      }
      users = [owner]
      await sbUpsert(owner)
    }

    set({ users, loading: false })
  },

  login: async (username, password) => {
    const u = get().users.find((x) => x.username.toLowerCase() === username.trim().toLowerCase())
    if (!u) return { success: false, error: 'Invalid username or password' }
    const valid = await bcrypt.compare(password, u.passwordHash)
    if (!valid) return { success: false, error: 'Invalid username or password' }

    const updated: AdminUser = { ...u, lastLoginAt: new Date().toISOString() }
    set((state) => ({
      users: state.users.map((x) => (x.id === u.id ? updated : x)),
      currentUser: updated,
    }))
    await sbUpsert(updated)

    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: u.id, username: u.username }))
      ;(window as unknown as { __axiomAdminAuth?: { username: string } }).__axiomAdminAuth = { username: u.username }
    } catch { /* ignore */ }

    return { success: true }
  },

  logout: () => {
    try {
      sessionStorage.removeItem(SESSION_KEY)
      ;(window as unknown as { __axiomAdminAuth?: unknown }).__axiomAdminAuth = undefined
    } catch {}
    set({ currentUser: null })
  },

  restoreSession: async () => {
    if (get().users.length === 0 && get().loading) {
      // Wait for bootstrap to populate users
      await get().bootstrap()
    }
    try {
      const raw = sessionStorage.getItem(SESSION_KEY)
      if (!raw) return
      const { id } = JSON.parse(raw)
      const u = get().users.find((x) => x.id === id)
      if (u) {
        set({ currentUser: u })
        ;(window as unknown as { __axiomAdminAuth?: { username: string } }).__axiomAdminAuth = { username: u.username }
      }
    } catch { /* ignore */ }
  },

  addAdmin: async ({ username, displayName, email, password }) => {
    const trimmed = username.trim().toLowerCase()
    if (trimmed.length < 3) return { success: false, error: 'Username must be at least 3 characters' }
    if (get().users.find((u) => u.username.toLowerCase() === trimmed)) {
      return { success: false, error: 'Username already taken' }
    }
    // Auto-generate password if none provided
    const finalPassword = password && password.length > 0 ? password : generateRandomPassword()
    if (finalPassword.length < 6) return { success: false, error: 'Password must be at least 6 characters' }
    const hash = await bcrypt.hash(finalPassword, 10)
    const user: AdminUser = {
      id: `admin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      username: trimmed,
      displayName: displayName.trim(),
      email: email?.trim() || undefined,
      passwordHash: hash,
      // Force password change on first login (always for new accounts)
      mustChangePassword: true,
      createdAt: new Date().toISOString(),
    }
    set((state) => ({ users: [...state.users, user] }))
    await sbUpsert(user)
    return { success: true, generatedPassword: finalPassword }
  },

  updateAdmin: async (id, updates) => {
    let updated: AdminUser | undefined
    set((state) => {
      const users = state.users.map((u) => {
        if (u.id !== id) return u
        updated = {
          ...u,
          displayName: updates.displayName?.trim() ?? u.displayName,
          email: updates.email?.trim() || undefined,
        }
        return updated
      })
      return { users, currentUser: state.currentUser?.id === id ? (updated || state.currentUser) : state.currentUser }
    })
    if (updated) await sbUpsert(updated)
  },

  changePassword: async (id, newPassword, clearMustChange = false) => {
    const hash = await bcrypt.hash(newPassword, 10)
    let updated: AdminUser | undefined
    set((state) => {
      const users = state.users.map((u) => {
        if (u.id !== id) return u
        updated = { ...u, passwordHash: hash, mustChangePassword: clearMustChange ? false : u.mustChangePassword }
        return updated
      })
      return { users, currentUser: state.currentUser?.id === id ? (updated || state.currentUser) : state.currentUser }
    })
    if (updated) await sbUpsert(updated)
  },

  resetPassword: async (id) => {
    // Admin generates a new random password for an existing admin and forces a change
    const newPw = generateRandomPassword()
    const hash = await bcrypt.hash(newPw, 10)
    let updated: AdminUser | undefined
    set((state) => {
      const users = state.users.map((u) => {
        if (u.id !== id) return u
        updated = { ...u, passwordHash: hash, mustChangePassword: true }
        return updated
      })
      return { users, currentUser: state.currentUser?.id === id ? (updated || state.currentUser) : state.currentUser }
    })
    if (updated) await sbUpsert(updated)
    return { success: true, password: newPw }
  },

  deleteAdmin: (id) => {
    const state = get()
    if (state.users.length <= 1) {
      return { success: false, error: 'Cannot delete the last admin account' }
    }
    if (state.currentUser?.id === id) {
      return { success: false, error: 'Cannot delete your own account' }
    }
    set((s) => ({ users: s.users.filter((u) => u.id !== id) }))
    void sbDelete(id)
    return { success: true }
  },
}))
