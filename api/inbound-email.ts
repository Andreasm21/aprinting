// Vercel serverless function — receives webhook POSTs from Resend's
// inbound email service. Verifies Svix-style signatures (Resend uses
// Svix under the hood), normalises the email.received payload, threads
// the message via In-Reply-To, auto-links the sender to existing CRM
// records, and writes everything to the email_threads / email_messages
// tables.
//
// Required env vars on Vercel:
//   RESEND_WEBHOOK_SECRET   — `whsec_…` from Resend → Webhooks → your
//                              webhook → Signing Secret
//   VITE_SUPABASE_URL       — same one the frontend uses
//   SUPABASE_SERVICE_ROLE   — Supabase service-role key for cross-table
//                              writes (falls back to anon if absent —
//                              fine in this project since RLS is open)
//
// Svix signature verification spec:
//   1. Concatenate `${svix-id}.${svix-timestamp}.${raw_body}`
//   2. HMAC-SHA256 with the secret key (whsec_<base64> → base64-decode
//      → raw bytes)
//   3. Compare base64-encoded HMAC to any `v1,<sig>` entry in the
//      `svix-signature` header (it's a space-separated list to support
//      key rotation)
//   4. Reject if timestamp is older than 5 minutes (replay defence)

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'

const TOLERANCE_MS = 5 * 60_000   // 5 min replay window
const ATTACHMENTS_BUCKET = 'chat-attachments'  // reuse existing bucket

interface VercelHandlerReq {
  method?: string
  body: unknown
  headers: Record<string, string | string[] | undefined>
}

interface VercelHandlerRes {
  status: (code: number) => { json: (body: unknown) => void; end: () => void }
  setHeader: (name: string, value: string) => void
}

// What Resend's email.received payload looks like (best-effort — Resend's
// docs are thin on body field names, so we accept several aliases).
interface ResendInboundPayload {
  type: 'email.received'
  created_at?: string
  data: {
    email_id?: string
    created_at?: string
    from?: string
    from_name?: string
    to?: string[] | string
    cc?: string[] | string
    bcc?: string[] | string
    subject?: string
    message_id?: string
    in_reply_to?: string
    references?: string[] | string
    // Body — try multiple field names because Resend's docs aren't explicit
    text?: string
    html?: string
    body_text?: string
    body_html?: string
    body?: string
    attachments?: Array<{
      filename?: string
      content_type?: string
      content_id?: string
      content?: string  // base64, if present
      url?: string      // if Resend hosts the attachment
      size?: number
    }>
  }
}

export default async function handler(req: VercelHandlerReq, res: VercelHandlerRes) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, svix-id, svix-timestamp, svix-signature')

  if (req.method === 'OPTIONS') { res.status(204).end(); return }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed — use POST' })
    return
  }

  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    console.error('[inbound-email] RESEND_WEBHOOK_SECRET not set')
    res.status(500).json({ error: 'Server not configured' })
    return
  }

  // ─── Svix signature verification ───
  const svixId = pickHeader(req.headers, 'svix-id')
  const svixTimestamp = pickHeader(req.headers, 'svix-timestamp')
  const svixSignature = pickHeader(req.headers, 'svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    res.status(401).json({ error: 'Missing Svix headers (id/timestamp/signature)' })
    return
  }

  // Replay defence — reject very old timestamps
  const tsMs = parseInt(svixTimestamp, 10) * 1000
  if (Number.isNaN(tsMs) || Math.abs(Date.now() - tsMs) > TOLERANCE_MS) {
    res.status(401).json({ error: 'Timestamp out of tolerance' })
    return
  }

  // The raw body is what gets signed — we MUST stringify before parsing
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)

  if (!verifySvix(svixId, svixTimestamp, rawBody, svixSignature, secret)) {
    console.warn('[inbound-email] Bad signature for svix-id', svixId)
    res.status(401).json({ error: 'Bad signature' })
    return
  }

  // ─── Parse + validate ───
  let payload: ResendInboundPayload
  try {
    payload = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as ResendInboundPayload
  } catch {
    res.status(400).json({ error: 'Invalid JSON' })
    return
  }

  // Sanity: ignore non-receive events (we may also receive delivered/bounced)
  if (payload.type !== 'email.received') {
    res.status(200).json({ ok: true, ignored: payload.type })
    return
  }

  // Log the raw payload so we can see exactly what Resend sent (one-time
  // diagnostic — remove after we've confirmed the field names).
  console.log('[inbound-email] received payload:', JSON.stringify(payload).slice(0, 2000))

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE ?? process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !serviceRole) {
    res.status(500).json({ error: 'Supabase credentials missing' })
    return
  }
  const supabase = createClient(supabaseUrl, serviceRole)

  const d = payload.data ?? {}

  // Resolve sender + recipients (handle both string and string[])
  const fromEmail = (d.from ?? '').trim().toLowerCase()
  const toEmails = arrify(d.to)
  const ccEmails = arrify(d.cc)
  const bccEmails = arrify(d.bcc)
  const subject = (d.subject ?? '(no subject)').trim()
  const messageIdHeader = d.message_id ?? d.email_id  // prefer the MIME id, fall back to Resend's internal
  const inReplyTo = d.in_reply_to
  const refs = arrify(d.references)

  // Body — try every alias Resend might send
  const bodyText = d.text ?? d.body_text ?? null
  const bodyHtml = d.html ?? d.body_html ?? d.body ?? null

  if (!fromEmail) {
    res.status(400).json({ error: 'Missing from address' })
    return
  }

  // ─── Idempotency: skip if we've already processed this messageId ───
  if (messageIdHeader) {
    const { data: existing } = await supabase
      .from('email_messages')
      .select('id')
      .eq('message_id', messageIdHeader)
      .maybeSingle()
    if (existing) {
      res.status(200).json({ ok: true, deduped: true, messageId: messageIdHeader })
      return
    }
  }

  // ─── Threading: find existing thread by inReplyTo, or create new ───
  let threadId: string | null = null

  if (inReplyTo) {
    const { data: parent } = await supabase
      .from('email_messages')
      .select('thread_id')
      .eq('message_id', inReplyTo)
      .maybeSingle()
    if (parent?.thread_id) threadId = parent.thread_id
  }

  if (!threadId) {
    const links = await lookupCrmLinks(supabase, fromEmail)
    const { data: thread, error: threadErr } = await supabase
      .from('email_threads')
      .insert({
        subject: stripReplyPrefix(subject),
        participant_email: fromEmail,
        participant_name: d.from_name ?? null,
        message_count: 0,            // bumped below
        unread_count: 0,             // bumped below
        last_message_at: d.created_at ?? payload.created_at ?? new Date().toISOString(),
        customer_id: links.customerId,
        lead_id: links.leadId,
        document_id: links.documentId,
      })
      .select()
      .single()
    if (threadErr || !thread) {
      console.error('[inbound-email] thread insert:', threadErr)
      res.status(500).json({ error: 'Failed to create thread' })
      return
    }
    threadId = thread.id
  }

  // ─── Message insert ───
  const { data: message, error: msgErr } = await supabase
    .from('email_messages')
    .insert({
      thread_id: threadId,
      direction: 'inbound',
      message_id: messageIdHeader ?? null,
      in_reply_to: inReplyTo ?? null,
      reference_chain: refs,
      from_email: fromEmail,
      from_name: d.from_name ?? null,
      to_emails: toEmails,
      cc_emails: ccEmails,
      bcc_emails: bccEmails,
      subject,
      body_text: bodyText,
      body_html: bodyHtml,
      created_at: d.created_at ?? payload.created_at ?? new Date().toISOString(),
    })
    .select()
    .single()
  if (msgErr || !message) {
    console.error('[inbound-email] message insert:', msgErr)
    res.status(500).json({ error: 'Failed to insert message' })
    return
  }

  // ─── Attachments ───
  if (d.attachments && d.attachments.length > 0) {
    for (const att of d.attachments) {
      try {
        let buffer: Buffer | null = null
        let mime = att.content_type ?? 'application/octet-stream'
        const filename = att.filename ?? 'unnamed'

        if (att.content) {
          // Inline base64 content
          buffer = Buffer.from(att.content, 'base64')
        } else if (att.url) {
          // Resend hosted — fetch + relay to our Storage bucket
          const r = await fetch(att.url)
          if (r.ok) {
            buffer = Buffer.from(await r.arrayBuffer())
            mime = r.headers.get('content-type') ?? mime
          }
        }
        if (!buffer) {
          // Just metadata — nothing to upload
          await supabase.from('email_attachments').insert({
            message_id: message.id,
            filename,
            content_type: mime,
            size: att.size ?? 0,
            storage_path: '',
            url: att.url ?? '',
          })
          continue
        }

        const safeName = filename.replace(/[^a-zA-Z0-9._-]+/g, '_').toLowerCase()
        const path = `email/${threadId}/${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${safeName}`
        const { error: upErr } = await supabase.storage
          .from(ATTACHMENTS_BUCKET)
          .upload(path, buffer, { contentType: mime, upsert: false })
        if (upErr) {
          console.warn('[inbound-email] attachment upload:', upErr.message)
          continue
        }
        const { data: pub } = supabase.storage.from(ATTACHMENTS_BUCKET).getPublicUrl(path)
        await supabase.from('email_attachments').insert({
          message_id: message.id,
          filename,
          content_type: mime,
          size: buffer.byteLength,
          storage_path: path,
          url: pub.publicUrl,
        })
      } catch (err) {
        console.warn('[inbound-email] attachment:', err)
      }
    }
  }

  // ─── Bump thread counters ───
  const { data: thr } = await supabase
    .from('email_threads')
    .select('message_count, unread_count')
    .eq('id', threadId)
    .single()
  if (thr) {
    await supabase.from('email_threads').update({
      message_count: (thr.message_count ?? 0) + 1,
      unread_count: (thr.unread_count ?? 0) + 1,
      last_message_at: d.created_at ?? payload.created_at ?? new Date().toISOString(),
    }).eq('id', threadId)
  }

  res.status(200).json({ ok: true, threadId, messageId: messageIdHeader })
}

// ───────────────────────── Helpers ─────────────────────────

function pickHeader(headers: VercelHandlerReq['headers'], name: string): string | null {
  const v = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()]
  if (Array.isArray(v)) return v[0] ?? null
  return v ?? null
}

function arrify(v: string | string[] | undefined | null): string[] {
  if (!v) return []
  return Array.isArray(v) ? v : [v]
}

function stripReplyPrefix(subject: string): string {
  return subject.replace(/^(re|fw|fwd):\s*/gi, '').trim() || '(no subject)'
}

/**
 * Hand-rolled Svix signature verifier.
 *
 * Spec:
 *   1. Decode secret (whsec_<base64> → raw bytes)
 *   2. Build signed payload: `${svix-id}.${svix-timestamp}.${rawBody}`
 *   3. HMAC-SHA256 with the secret key, base64 encode
 *   4. Compare to any `v1,<sig>` entry in the (space-separated)
 *      svix-signature header (multiple entries supported for rotation)
 */
function verifySvix(
  svixId: string,
  svixTimestamp: string,
  rawBody: string,
  signatureHeader: string,
  secret: string,
): boolean {
  const cleaned = secret.startsWith('whsec_') ? secret.slice(6) : secret
  let key: Buffer
  try {
    key = Buffer.from(cleaned, 'base64')
  } catch {
    return false
  }
  const signedPayload = `${svixId}.${svixTimestamp}.${rawBody}`
  const expected = crypto.createHmac('sha256', key).update(signedPayload).digest('base64')

  // Header is "v1,<sig> v1,<sig> ..." — accept any version-1 sig that matches
  for (const entry of signatureHeader.split(' ')) {
    const [version, sig] = entry.split(',', 2)
    if (version !== 'v1' || !sig) continue
    if (sig.length !== expected.length) continue
    if (crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return true
  }
  return false
}

interface CrmLinks {
  customerId: string | null
  leadId: string | null
  documentId: string | null
}

async function lookupCrmLinks(supabase: SupabaseClient, fromEmail: string): Promise<CrmLinks> {
  const result: CrmLinks = { customerId: null, leadId: null, documentId: null }
  try {
    const [{ data: customer }, { data: lead }, { data: doc }] = await Promise.all([
      supabase.from('customers').select('id').ilike('email', fromEmail).limit(1).maybeSingle(),
      supabase.from('leads').select('id').ilike('email', fromEmail).limit(1).maybeSingle(),
      supabase.from('documents').select('id')
        .ilike('customer_email', fromEmail)
        .order('created_at', { ascending: false })
        .limit(1).maybeSingle(),
    ])
    result.customerId = (customer as { id?: string } | null)?.id ?? null
    result.leadId = (lead as { id?: string } | null)?.id ?? null
    result.documentId = (doc as { id?: string } | null)?.id ?? null
  } catch (err) {
    console.warn('[inbound-email] CRM lookup failed:', err)
  }
  return result
}
