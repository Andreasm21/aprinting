// Vercel serverless function — proxies email-send requests to Resend.
// Frontend (Vite SPA) cannot call Resend directly because it would expose
// the API key in the browser bundle. This route runs on the server, reads
// the key from env, and forwards the request.
//
// Required Vercel env vars:
//   RESEND_API_KEY  — re_...  (https://resend.com/api-keys)
//   EMAIL_FROM      — verified sender, e.g. "Axiom <team@axiomcreate.com>"
//                     (or "onboarding@resend.dev" for testing only)
//
// Trust model: this endpoint has no auth — it sits behind the admin login
// and is intended to be called only from the admin UI. Don't expose other
// surfaces that hit it without an admin session.

import { Resend } from 'resend'

interface SendEmailBody {
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  subject: string
  html: string
  text?: string
  // Each attachment: { filename, content (base64), contentType }
  attachments?: Array<{
    filename: string
    content: string // base64-encoded
    contentType?: string
  }>
}

// Vercel infers the runtime from the export — Node by default for /api/*.ts.
export default async function handler(
  req: { method?: string; body: unknown; headers: Record<string, string | string[] | undefined> },
  res: {
    status: (code: number) => {
      json: (body: unknown) => void
      end: () => void
    }
    setHeader: (name: string, value: string) => void
  }
) {
  // CORS — same-origin in practice (Vercel serves both), but cheap to allow.
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed — use POST' })
    return
  }

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey) {
    res.status(500).json({ error: 'RESEND_API_KEY is not set on the server' })
    return
  }
  if (!from) {
    res.status(500).json({ error: 'EMAIL_FROM is not set on the server' })
    return
  }

  let body: SendEmailBody
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as SendEmailBody
  } catch {
    res.status(400).json({ error: 'Invalid JSON body' })
    return
  }

  if (!body.to || !body.subject || !body.html) {
    res.status(400).json({ error: 'Missing required fields: to, subject, html' })
    return
  }

  const resend = new Resend(apiKey)

  try {
    const result = await resend.emails.send({
      from,
      to: body.to,
      cc: body.cc,
      bcc: body.bcc,
      subject: body.subject,
      html: body.html,
      text: body.text,
      attachments: body.attachments?.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content, 'base64'),
      })),
    })

    if (result.error) {
      console.error('[send-email] Resend error:', result.error)
      res.status(502).json({ error: result.error.message || 'Resend rejected the request', details: result.error })
      return
    }

    res.status(200).json({ id: result.data?.id, success: true })
  } catch (err) {
    console.error('[send-email] exception:', err)
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown server error' })
  }
}
