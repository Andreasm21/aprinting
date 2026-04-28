// Admin shared file manager — backed by `admin_files` table + the
// `admin-files` Supabase Storage bucket.
//
// Folders and files are unified rows (folders have is_folder=true and no
// storage_path). Hierarchy is via parent_id. The store keeps a flat list
// of all rows and the page filters by current parent.

import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { uploadAdminFile, deleteAdminFile, publicUrl } from '@/lib/adminFilesStorage'

export interface AdminFile {
  id: string
  name: string
  storagePath?: string
  size: number
  mime: string
  parentId?: string
  isFolder: boolean
  uploadedBy: string
  uploadedAt: string
}

interface FileRow {
  id: string
  name: string
  storage_path: string | null
  size: number | string  // bigint can come back as string from PostgREST
  mime: string
  parent_id: string | null
  is_folder: boolean
  uploaded_by: string
  uploaded_at: string
}

function fromRow(r: FileRow): AdminFile {
  return {
    id: r.id,
    name: r.name,
    storagePath: r.storage_path ?? undefined,
    size: typeof r.size === 'string' ? parseInt(r.size, 10) || 0 : r.size,
    mime: r.mime ?? '',
    parentId: r.parent_id ?? undefined,
    isFolder: Boolean(r.is_folder),
    uploadedBy: r.uploaded_by,
    uploadedAt: r.uploaded_at,
  }
}

let _warned = false
let _realtimeStarted = false

export interface UploadProgress {
  id: string             // local id for tracking
  name: string
  loaded: number
  total: number
  error?: string
}

interface FilesState {
  items: AdminFile[]
  loading: boolean
  hasLoaded: boolean
  schemaMissing: boolean
  uploads: UploadProgress[]      // in-flight uploads

  load: () => Promise<void>
  createFolder: (name: string, parentId: string | undefined, currentUserId: string) => Promise<AdminFile | null>
  uploadFiles: (files: File[], parentId: string | undefined, currentUserId: string) => Promise<void>
  rename: (id: string, newName: string) => Promise<void>
  remove: (id: string) => Promise<void>

  // selectors
  childrenOf: (parentId: string | undefined) => AdminFile[]
  pathTo: (folderId: string | undefined) => AdminFile[]   // breadcrumb chain (root → ... → folderId)
  byId: (id: string) => AdminFile | undefined

  _onInsert: (f: AdminFile) => void
  _onUpdate: (f: AdminFile) => void
  _onDelete: (id: string) => void
}

export const useAdminFilesStore = create<FilesState>((set, get) => ({
  items: [],
  loading: false,
  hasLoaded: false,
  schemaMissing: false,
  uploads: [],

  load: async () => {
    if (!isSupabaseConfigured) { set({ hasLoaded: true }); return }
    if (get().loading || get().hasLoaded) return
    set({ loading: true })
    try {
      const { data, error } = await supabase
        .from('admin_files')
        .select('*')
        .order('is_folder', { ascending: false })
        .order('name', { ascending: true })
      if (error) {
        const code = (error as { code?: string }).code
        const tableMissing = code === '42P01' || code === 'PGRST205' ||
          /Could not find the table/i.test(error.message ?? '') ||
          /relation .* does not exist/i.test(error.message ?? '')
        if (tableMissing) {
          if (!_warned) {
            _warned = true
            console.info('[admin_files] table not found — apply supabase/migrations/20260428_admin_files.sql')
          }
          set({ loading: false, hasLoaded: true, schemaMissing: true })
          return
        }
        console.error('[admin_files] load:', error.message)
        set({ loading: false, hasLoaded: true })
        return
      }
      set({
        items: ((data ?? []) as FileRow[]).map(fromRow),
        loading: false,
        hasLoaded: true,
      })
      if (!_realtimeStarted) {
        _realtimeStarted = true
        startRealtime()
      }
    } catch (err) {
      console.error('[admin_files] load:', err)
      set({ loading: false, hasLoaded: true })
    }
  },

  createFolder: async (name, parentId, currentUserId) => {
    if (!isSupabaseConfigured || get().schemaMissing) return null
    const trimmed = name.trim()
    if (!trimmed) return null
    try {
      const { data, error } = await supabase.from('admin_files')
        .insert({
          name: trimmed,
          parent_id: parentId ?? null,
          is_folder: true,
          uploaded_by: currentUserId,
          mime: 'application/x-folder',
        })
        .select()
        .single()
      if (error || !data) {
        console.error('[admin_files] createFolder:', error?.message)
        return null
      }
      const folder = fromRow(data as FileRow)
      get()._onInsert(folder)
      return folder
    } catch (err) {
      console.error('[admin_files] createFolder:', err)
      return null
    }
  },

  uploadFiles: async (files, parentId, currentUserId) => {
    if (!isSupabaseConfigured || get().schemaMissing) return
    // Queue progress entries for the UI
    const queued: UploadProgress[] = files.map((f) => ({
      id: `up-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: f.name,
      loaded: 0,
      total: f.size,
    }))
    set((s) => ({ uploads: [...s.uploads, ...queued] }))

    await Promise.allSettled(files.map(async (file, i) => {
      const localId = queued[i].id
      try {
        const result = await uploadAdminFile(file, (loaded, total) => {
          set((s) => ({
            uploads: s.uploads.map((u) => u.id === localId ? { ...u, loaded, total } : u),
          }))
        })

        // Insert metadata row
        const { data, error } = await supabase.from('admin_files')
          .insert({
            name: file.name,
            storage_path: result.storagePath,
            size: result.size,
            mime: result.mime,
            parent_id: parentId ?? null,
            is_folder: false,
            uploaded_by: currentUserId,
          })
          .select()
          .single()
        if (error || !data) {
          // Storage is uploaded but row failed; remove the orphan
          await deleteAdminFile(result.storagePath).catch(() => {})
          throw new Error(error?.message ?? 'metadata insert failed')
        }
        get()._onInsert(fromRow(data as FileRow))

        // Drop progress entry on success
        set((s) => ({ uploads: s.uploads.filter((u) => u.id !== localId) }))
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        set((s) => ({
          uploads: s.uploads.map((u) => u.id === localId ? { ...u, error: msg } : u),
        }))
      }
    }))
  },

  rename: async (id, newName) => {
    const trimmed = newName.trim()
    if (!trimmed) return
    if (!isSupabaseConfigured) return
    set((s) => ({ items: s.items.map((it) => it.id === id ? { ...it, name: trimmed } : it) }))
    try {
      const { error } = await supabase.from('admin_files').update({ name: trimmed }).eq('id', id)
      if (error) console.error('[admin_files] rename:', error.message)
    } catch (err) {
      console.error('[admin_files] rename:', err)
    }
  },

  remove: async (id) => {
    const item = get().byId(id)
    if (!item) return
    if (!isSupabaseConfigured) return

    // Collect descendants if it's a folder
    const allDescendants: AdminFile[] = []
    if (item.isFolder) {
      const visit = (parentId: string) => {
        for (const child of get().items.filter((x) => x.parentId === parentId)) {
          allDescendants.push(child)
          if (child.isFolder) visit(child.id)
        }
      }
      visit(id)
    }

    // Optimistic local removal
    const removeIds = new Set([id, ...allDescendants.map((d) => d.id)])
    set((s) => ({ items: s.items.filter((it) => !removeIds.has(it.id)) }))

    try {
      // Delete storage objects for any descendants that have one
      const paths = [item, ...allDescendants]
        .map((x) => x.storagePath)
        .filter((p): p is string => Boolean(p))
      await Promise.all(paths.map((p) => deleteAdminFile(p)))

      // Delete the row (cascade handles children)
      const { error } = await supabase.from('admin_files').delete().eq('id', id)
      if (error) console.error('[admin_files] remove:', error.message)
    } catch (err) {
      console.error('[admin_files] remove:', err)
    }
  },

  // ─── Selectors ───
  childrenOf: (parentId) => {
    const list = get().items.filter((x) => (x.parentId ?? null) === (parentId ?? null))
    // Folders before files, then alphabetical
    list.sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    return list
  },

  pathTo: (folderId) => {
    if (!folderId) return []
    const out: AdminFile[] = []
    let cur = get().items.find((x) => x.id === folderId)
    while (cur) {
      out.unshift(cur)
      const parent = cur.parentId
      cur = parent ? get().items.find((x) => x.id === parent) : undefined
    }
    return out
  },

  byId: (id) => get().items.find((x) => x.id === id),

  _onInsert: (f) => {
    set((s) => {
      if (s.items.some((x) => x.id === f.id)) return {}
      return { items: [...s.items, f] }
    })
  },
  _onUpdate: (f) => {
    set((s) => ({ items: s.items.map((x) => x.id === f.id ? f : x) }))
  },
  _onDelete: (id) => {
    set((s) => ({ items: s.items.filter((x) => x.id !== id) }))
  },
}))

function startRealtime() {
  if (!isSupabaseConfigured) return
  const channel = supabase.channel('admin-files:all')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_files' }, (payload) => {
      useAdminFilesStore.getState()._onInsert(fromRow(payload.new as FileRow))
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'admin_files' }, (payload) => {
      useAdminFilesStore.getState()._onUpdate(fromRow(payload.new as FileRow))
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'admin_files' }, (payload) => {
      const id = (payload.old as { id?: string }).id
      if (id) useAdminFilesStore.getState()._onDelete(id)
    })
    .subscribe()
  void channel
}

export { publicUrl }
