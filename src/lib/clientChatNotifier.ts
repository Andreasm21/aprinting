// Send the admin-notification email when a visitor posts a new message.
//
// Debounce: if the thread received an email in the last DEBOUNCE_MS, we
// skip — the admin already got pinged recently. Reset starts on every send.
//
// Recipients: every admin user with a non-null email column. We BCC them to
// keep individual addresses out of the visible recipient list.
//
// This runs from the visitor's browser. The /api/send-email endpoint
// holds the Resend API key server-side.

import { supabase } from './supabase'
import type { ClientChatThread } from '@/stores/clientChatStore'

const DEBOUNCE_MS = 2 * 60_000  // 2 min

export async function notifyAdminsOfNewMessage(
  thread: ClientChatThread,
  messageBody: string,
  isFirstMessage: boolean,
): Promise<void> {
  // Always notify on first message; debounce subsequent ones.
  if (!isFirstMessage) {
    if (thread.lastEmailSentAt) {
      const sentMs = new Date(thread.lastEmailSentAt).getTime()
      if (Date.now() - sentMs < DEBOUNCE_MS) return
    }
  }

  // Pull admin emails. If none configured, silently skip (no point sending
  // to nobody — we still record the message in the DB).
  const { data: admins, error } = await supabase
    .from('admin_users')
    .select('email')
    .not('email', 'is', null)
  if (error) {
    console.warn('[client_chat] couldn\'t fetch admin emails:', error.message)
    return
  }
  const recipients = (admins ?? [])
    .map((a) => (a as { email: string | null }).email)
    .filter((e): e is string => Boolean(e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))

  if (recipients.length === 0) {
    console.warn('[client_chat] no admin emails configured — skipping notification')
    return
  }

  // Build a tasteful HTML body
  const adminUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/admin/conversations`
  const preview = messageBody.length > 400 ? `${messageBody.slice(0, 400)}…` : messageBody
  const subject = isFirstMessage
    ? `New chat from ${thread.visitorName} — Axiom`
    : `${thread.visitorName} replied — Axiom chat`

  const html = `
<!doctype html>
<html>
<body style="margin:0;padding:24px;background:#0F0F0F;color:#F5F5F5;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">
  <div style="max-width:560px;margin:0 auto;background:#1A1A1A;border:1px solid #2A2A2A;border-radius:12px;padding:24px;">
    <p style="margin:0 0 4px;color:#F59E0B;font-size:11px;letter-spacing:1px;text-transform:uppercase;">
      ${isFirstMessage ? 'New live chat' : 'New reply'}
    </p>
    <h2 style="margin:0 0 16px;font-size:18px;color:#FFFFFF;">
      ${escapeHtml(thread.visitorName)} <span style="color:#888;font-weight:400;font-size:13px;">&lt;${escapeHtml(thread.visitorEmail)}&gt;</span>
    </h2>
    <div style="background:#0F0F0F;border-left:3px solid #F59E0B;padding:12px 16px;border-radius:4px;margin-bottom:20px;">
      <p style="margin:0;white-space:pre-wrap;color:#D4D4D4;line-height:1.5;font-size:13px;">${escapeHtml(preview)}</p>
    </div>
    <a href="${adminUrl}" style="display:inline-block;background:#F59E0B;color:#0F0F0F;font-weight:700;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:13px;">
      Open conversation →
    </a>
    <p style="margin:24px 0 0;color:#666;font-size:11px;">
      Sent by Axiom live chat. Subsequent messages from the same visitor are batched (1 email per ${Math.round(DEBOUNCE_MS / 60_000)} min) so this won't spam your inbox.
    </p>
  </div>
</body>
</html>
`.trim()

  const text = `${isFirstMessage ? 'New live chat' : 'New reply'} from ${thread.visitorName} <${thread.visitorEmail}>:\n\n${preview}\n\nOpen: ${adminUrl}`

  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: recipients[0],
        bcc: recipients.length > 1 ? recipients.slice(1) : undefined,
        subject,
        html,
        text,
      }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.warn('[client_chat] email send failed:', res.status, errText)
      return
    }

    // Success — bump last_email_sent_at on the thread for the debounce window
    await supabase.from('client_chat_threads')
      .update({ last_email_sent_at: new Date().toISOString() })
      .eq('id', thread.id)
  } catch (err) {
    console.warn('[client_chat] email send threw:', err)
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
