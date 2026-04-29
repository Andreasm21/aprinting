// Vercel serverless function — receives webhook POSTs from the inbound
// email provider (Resend Inbound, Cloudflare Email Worker, SendGrid Inbound
// Parse, etc.). Authenticates via HMAC, normalises the payload, threads the
// message into an existing email_threads row when possible, auto-links the
// sender against customers/leads/documents, and writes everything to the DB.
//
// Required env vars on Vercel:
//   INBOUND_EMAIL_SECRET    — 32+ char HMAC shared secret. The provider
//                              must include it as `X-Webhook-Signature: sha256=<hex>`
//                              over the raw request body.
//   VITE_SUPABASE_URL       — same one the frontend uses
//   SUPABASE_SERVICE_ROLE   — service role key. RLS is permissive in this
//                              project but using the service role makes
//                              cross-table writes more reliable.
//
// Provider payload shape we accept (provider-agnostic):
//   {
//     from:       "alice@example.com",
//     fromName?:  "Alice Smith",
//     to:         ["hello@axiomcreate.com"],
//     cc?:        [],
//     subject:    "Need a quote",
//     text?:      "Hi…",
//     html?:      "<p>Hi…</p>",
//     messageId:  "<abc@example.com>",
//     inReplyTo?: "<prev@axiomcreate.com>",
//     references?:["<root@axiomcreate.com>", "<prev@axiomcreate.com>"],
//     attachments?: [{filename, contentType, contentBase64}],
//     receivedAt?:"2026-04-29T12:34:56Z"
//   }

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'

interface InboundPayload {
  from: string
  fromName?: string
  to: string | string[]
  cc?: string | string[]
  subject?: string
  text?: string
  html?: string
  messageId?: string
  inReplyTo?: string
  references?: string[] | string
  attachments?: Array<{ filename: string; contentType?: string; contentBase64: string }>
  receivedAt?: string
}

const ATTACHMENTS_BUCKET = 'chat-attachments'  // reuse the existing public bucket

interface VercelHandlerReq {
  method?: string
  body: unknown
  headers: Record<string, string | string[] | undefined>
  rawBody?: string | Buffer
}

interface VercelHandlerRes {
  status: (code: number) => {
    json: (body: unknown) => void
    end: () => void
  }
  setHeader: (name: string, value: string) => void
}

export default async function handler(req: VercelHandlerReq, res: VercelHandlerRes) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Signature')

  if (req.method === 'OPTIONS') { res.status(204).end(); return }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed — use POST' })
    return
  }

  const secret = process.env.INBOUND_EMAIL_SECRET
  if (!secret) {
    console.error('[inbound-email] INBOUND_EMAIL_SECRET not set')
    res.status(500).json({ error: 'Server not configured' })
    return
  }

  // ─── HMAC verification ───
  const sigHeader = pickHeader(req.headers, 'x-webhook-signature')
  if (!sigHeader) {
    res.status(401).json({ error: 'Missing X-Webhook-Signature' })
    return
  }
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sigHeader))) {
    res.status(401).json({ error: 'Bad signature' })
    return
  }

  // ─── Parse + validate ───
  let payload: InboundPayload
  try {
    payload = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as InboundPayload
  } catch {
    res.status(400).json({ error: 'Invalid JSON' })
    return
  }
  if (!payload.from || !payload.to) {
    res.status(400).json({ error: 'Missing required fields: from, to' })
    return
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE ?? process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !serviceRole) {
    console.error('[inbound-email] Supabase credentials missing')
    res.status(500).json({ error: 'Server not configured' })
    return
  }
  const supabase = createClient(supabaseUrl, serviceRole)

  // ─── Idempotency: skip if we've already processed this messageId ───
  if (payload.messageId) {
    const { data: existing } = await supabase
      .from('email_messages')
      .select('id')
      .eq('message_id', payload.messageId)
      .maybeSingle()
    if (existing) {
      res.status(200).json({ ok: true, deduped: true, messageId: payload.messageId })
      return
    }
  }

  // ─── Threading: find existing thread by inReplyTo, or create one ───
  const subject = (payload.subject ?? '(no subject)').trim()
  const fromEmail = payload.from.trim().toLowerCase()
  let threadId: string | null = null

  if (payload.inReplyTo) {
    const { data: parent } = await supabase
      .from('email_messages')
      .select('thread_id')
      .eq('message_id', payload.inReplyTo)
      .maybeSingle()
    if (parent?.thread_id) threadId = parent.thread_id
  }

  if (!threadId) {
    // Create a new thread + auto-link CRM in the same write
    const links = await lookupCrmLinks(supabase, fromEmail)
    const { data: thread, error: threadErr } = await supabase
      .from('email_threads')
      .insert({
        subject: stripReplyPrefix(subject),
        participant_email: fromEmail,
        participant_name: payload.fromName ?? null,
        message_count: 0,            // bumped below
        unread_count: 0,             // bumped below
        last_message_at: payload.receivedAt ?? new Date().toISOString(),
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
  const refs = Array.isArray(payload.references)
    ? payload.references
    : payload.references ? [payload.references] : []

  const { data: message, error: msgErr } = await supabase
    .from('email_messages')
    .insert({
      thread_id: threadId,
      direction: 'inbound',
      message_id: payload.messageId ?? null,
      in_reply_to: payload.inReplyTo ?? null,
      reference_chain: refs,
      from_email: fromEmail,
      from_name: payload.fromName ?? null,
      to_emails: arrify(payload.to),
      cc_emails: arrify(payload.cc),
      subject,
      body_text: payload.text ?? null,
      body_html: payload.html ?? null,
      created_at: payload.receivedAt ?? new Date().toISOString(),
    })
    .select()
    .single()
  if (msgErr || !message) {
    console.error('[inbound-email] message insert:', msgErr)
    res.status(500).json({ error: 'Failed to insert message' })
    return
  }

  // ─── Attachments ───
  if (payload.attachments && payload.attachments.length > 0) {
    for (const att of payload.attachments) {
      try {
        const buffer = Buffer.from(att.contentBase64, 'base64')
        const safeName = att.filename.replace(/[^a-zA-Z0-9._-]+/g, '_').toLowerCase()
        const path = `email/${threadId}/${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${safeName}`
        const { error: upErr } = await supabase.storage
          .from(ATTACHMENTS_BUCKET)
          .upload(path, buffer, { contentType: att.contentType ?? 'application/octet-stream', upsert: false })
        if (upErr) {
          console.warn('[inbound-email] attachment upload:', upErr.message)
          continue
        }
        const { data: pub } = supabase.storage.from(ATTACHMENTS_BUCKET).getPublicUrl(path)
        await supabase.from('email_attachments').insert({
          message_id: message.id,
          filename: att.filename,
          content_type: att.contentType ?? 'application/octet-stream',
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
  await supabase.rpc('increment_email_thread', { p_thread_id: threadId }).then(() => {
    /* may not exist; fall back below */
  }, async () => {
    // Manual bump
    const { data: thread } = await supabase
      .from('email_threads')
      .select('message_count, unread_count')
      .eq('id', threadId)
      .single()
    if (thread) {
      await supabase.from('email_threads').update({
        message_count: (thread.message_count ?? 0) + 1,
        unread_count: (thread.unread_count ?? 0) + 1,
        last_message_at: payload.receivedAt ?? new Date().toISOString(),
      }).eq('id', threadId)
    }
  })

  res.status(200).json({ ok: true, threadId, messageId: payload.messageId })
}

// ───────────────────────── Helpers ─────────────────────────

function pickHeader(headers: VercelHandlerReq['headers'], name: string): string | null {
  const v = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()]
  if (Array.isArray(v)) return v[0] ?? null
  return v ?? null
}

function arrify(v: string | string[] | undefined): string[] {
  if (!v) return []
  return Array.isArray(v) ? v : [v]
}

function stripReplyPrefix(subject: string): string {
  // Strip leading "Re:", "Fwd:", "RE:" etc. — keeps thread subjects clean.
  return subject.replace(/^(re|fw|fwd):\s*/gi, '').trim() || '(no subject)'
}

interface CrmLinks {
  customerId: string | null
  leadId: string | null
  documentId: string | null
}

/** Look up the sender's email across our CRM tables to auto-link this thread. */
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
