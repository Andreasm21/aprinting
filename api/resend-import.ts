// Admin-only utility: imports recent Resend emails into the mail-client
// `email_threads` + `email_messages` tables. Useful for seeding the inbox
// with historical sends, or as a "sync from Resend" button in the UI.
//
// GET /api/resend-import?to=team@axiomcreate.com&limit=10
// Authorization: Bearer <INBOUND_EMAIL_SECRET>
//
// Env vars required (Vercel project settings):
//   RESEND_API_KEY          — your re_... key
//   INBOUND_EMAIL_SECRET    — shared secret used as bearer token here
//                              (same one used by /api/inbound-email)
//   SUPABASE_SERVICE_ROLE   — for cross-table writes
//   VITE_SUPABASE_URL       — same one the frontend uses

import { createClient } from '@supabase/supabase-js'

interface ResendListItem {
  id: string
  from: string
  to: string[]
  created_at: string
  subject: string
  last_event?: string
}

interface ResendDetail {
  id: string
  from: string
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  text?: string
  html?: string
  created_at: string
}

interface VercelHandlerReq {
  method?: string
  url?: string
  headers: Record<string, string | string[] | undefined>
}

interface VercelHandlerRes {
  status: (code: number) => { json: (body: unknown) => void; end: () => void }
  setHeader: (name: string, value: string) => void
}

export default async function handler(req: VercelHandlerReq, res: VercelHandlerRes) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') { res.status(204).end(); return }
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  // ─── Bearer auth ───
  const auth = pickHeader(req.headers, 'authorization')
  const secret = process.env.INBOUND_EMAIL_SECRET
  if (!secret) { res.status(500).json({ error: 'INBOUND_EMAIL_SECRET not configured' }); return }
  if (!auth || auth !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) { res.status(500).json({ error: 'RESEND_API_KEY not configured' }); return }

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE ?? process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !serviceRole) {
    res.status(500).json({ error: 'Supabase credentials missing' })
    return
  }
  const supabase = createClient(supabaseUrl, serviceRole)

  // ─── Parse query ───
  const url = new URL(req.url ?? '/', 'http://localhost')
  const filterTo = url.searchParams.get('to')?.toLowerCase().trim() || null
  const limitRaw = parseInt(url.searchParams.get('limit') ?? '10', 10)
  const limit = Math.min(Math.max(isNaN(limitRaw) ? 10 : limitRaw, 1), 100)

  // ─── List emails from Resend ───
  // Resend's list endpoint returns the most recent first. We over-fetch
  // when filtering since the list isn't filterable server-side.
  const fetchSize = filterTo ? 100 : limit
  let listing: ResendListItem[] = []
  try {
    const r = await fetch(`https://api.resend.com/emails?limit=${fetchSize}`, {
      headers: { Authorization: `Bearer ${resendKey}` },
    })
    if (!r.ok) {
      const txt = await r.text().catch(() => '')
      res.status(502).json({ error: `Resend list failed: ${r.status}`, details: txt })
      return
    }
    const json = (await r.json()) as { data?: ResendListItem[]; error?: { message?: string } }
    if (json.error) { res.status(502).json({ error: json.error.message }); return }
    listing = json.data ?? []
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Resend fetch failed' })
    return
  }

  // ─── Filter by recipient ───
  const matched = filterTo
    ? listing.filter((e) => (e.to ?? []).some((addr) => addr.toLowerCase() === filterTo))
    : listing
  const subset = matched.slice(0, limit)

  if (subset.length === 0) {
    res.status(200).json({ ok: true, listed: listing.length, matched: 0, imported: 0 })
    return
  }

  // ─── Detail fetch + insert ───
  let imported = 0
  let deduped = 0
  const errors: string[] = []
  for (const item of subset) {
    try {
      // Skip if we've already imported this one (Resend id used as message_id)
      const stableMessageId = `<resend-${item.id}@axiomcreate.com>`
      const { data: existing } = await supabase
        .from('email_messages')
        .select('id')
        .eq('message_id', stableMessageId)
        .maybeSingle()
      if (existing) { deduped += 1; continue }

      // Fetch full detail (body)
      const detailRes = await fetch(`https://api.resend.com/emails/${item.id}`, {
        headers: { Authorization: `Bearer ${resendKey}` },
      })
      if (!detailRes.ok) { errors.push(`detail ${item.id}: ${detailRes.status}`); continue }
      const detail = (await detailRes.json()) as ResendDetail

      // Build participant info — for OUTBOUND emails (which is what Resend
      // logs are), the "external" participant is the recipient.
      const recipientEmail = (detail.to ?? [])[0] ?? item.to[0] ?? 'unknown@unknown'
      const subject = detail.subject || item.subject || '(no subject)'

      // Find or create thread keyed on the recipient (so multiple sends
      // to the same person collapse into one conversation).
      let threadId: string | null = null
      const { data: existingThread } = await supabase
        .from('email_threads')
        .select('id')
        .ilike('participant_email', recipientEmail)
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (existingThread) {
        threadId = existingThread.id
      } else {
        const { data: newThread, error: tErr } = await supabase
          .from('email_threads')
          .insert({
            subject: subject.replace(/^(re|fw|fwd):\s*/gi, '').trim() || '(no subject)',
            participant_email: recipientEmail,
            participant_name: null,
            message_count: 0,
            unread_count: 0,
            last_message_at: detail.created_at ?? item.created_at,
          })
          .select()
          .single()
        if (tErr || !newThread) { errors.push(`thread for ${recipientEmail}: ${tErr?.message}`); continue }
        threadId = newThread.id
      }

      // Insert the message itself
      const { error: mErr } = await supabase.from('email_messages').insert({
        thread_id: threadId,
        direction: 'outbound',
        message_id: stableMessageId,
        from_email: detail.from || item.from,
        from_name: null,
        to_emails: detail.to ?? item.to ?? [],
        cc_emails: detail.cc ?? [],
        bcc_emails: detail.bcc ?? [],
        subject,
        body_text: detail.text ?? null,
        body_html: detail.html ?? null,
        created_at: detail.created_at ?? item.created_at,
      })
      if (mErr) { errors.push(`message ${item.id}: ${mErr.message}`); continue }

      // Bump thread counters
      const { data: thr } = await supabase
        .from('email_threads')
        .select('message_count, last_message_at')
        .eq('id', threadId)
        .single()
      if (thr) {
        await supabase.from('email_threads').update({
          message_count: (thr.message_count ?? 0) + 1,
          last_message_at: detail.created_at ?? item.created_at ?? thr.last_message_at,
        }).eq('id', threadId)
      }

      imported += 1
    } catch (err) {
      errors.push(`${item.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  res.status(200).json({
    ok: true,
    listed: listing.length,
    matched: subset.length,
    imported,
    deduped,
    errors,
  })
}

function pickHeader(headers: VercelHandlerReq['headers'], name: string): string | null {
  const v = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()]
  if (Array.isArray(v)) return v[0] ?? null
  return v ?? null
}
