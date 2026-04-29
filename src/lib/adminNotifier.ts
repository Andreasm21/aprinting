// Generic admin email notifier — every visitor-side intake event (live
// chat, B2B part request, normal order, contact form) calls into here so
// the studio team gets pinged via Resend.
//
// All emails go through the existing /api/send-email Vercel function
// which holds the RESEND_API_KEY server-side. Recipients are pulled from
// admin_users.email — every admin with a non-null email gets the alert.

import { supabase } from './supabase'
import type { ClientChatThread } from '@/stores/clientChatStore'
import type {
  OrderNotification,
  PartRequestNotification,
  ContactNotification,
  AdminAlertNotification,
} from '@/stores/notificationsStore'

const CHAT_DEBOUNCE_MS = 2 * 60_000

// ─── Recipient discovery ───────────────────────────────────

/** Pull every admin with a usable email address from the DB.
 *  Returns [] if none configured (we silently skip rather than throw). */
async function getAdminEmails(): Promise<string[]> {
  const { data, error } = await supabase
    .from('admin_users')
    .select('email')
    .not('email', 'is', null)
  if (error) {
    console.warn("[adminNotifier] couldn't fetch admin emails:", error.message)
    return []
  }
  return (data ?? [])
    .map((a) => (a as { email: string | null }).email)
    .filter((e): e is string => Boolean(e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))
}

// ─── Low-level send ──────────────────────────────────────

interface SendOpts {
  subject: string
  html: string
  text: string
}

async function sendAdminEmail(opts: SendOpts): Promise<boolean> {
  const recipients = await getAdminEmails()
  if (recipients.length === 0) {
    console.warn('[adminNotifier] no admin emails configured — skipping')
    return false
  }
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: recipients[0],
        bcc: recipients.length > 1 ? recipients.slice(1) : undefined,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.warn('[adminNotifier] send failed:', res.status, errText)
      return false
    }
    return true
  } catch (err) {
    console.warn('[adminNotifier] send threw:', err)
    return false
  }
}

// ─── HTML helpers ────────────────────────────────────────

const adminUrl = () => (typeof window !== 'undefined' ? window.location.origin : '')

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function shellHtml(opts: {
  badge: string
  title: string
  bodyHtml: string
  ctaLabel: string
  ctaHref: string
  footer?: string
}): string {
  return `
<!doctype html>
<html>
<body style="margin:0;padding:24px;background:#0F0F0F;color:#F5F5F5;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">
  <div style="max-width:560px;margin:0 auto;background:#1A1A1A;border:1px solid #2A2A2A;border-radius:12px;padding:24px;">
    <p style="margin:0 0 4px;color:#F59E0B;font-size:11px;letter-spacing:1px;text-transform:uppercase;">
      ${escapeHtml(opts.badge)}
    </p>
    <h2 style="margin:0 0 16px;font-size:18px;color:#FFFFFF;">${opts.title}</h2>
    ${opts.bodyHtml}
    <a href="${escapeHtml(opts.ctaHref)}" style="display:inline-block;margin-top:18px;background:#F59E0B;color:#0F0F0F;font-weight:700;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:13px;">
      ${escapeHtml(opts.ctaLabel)} →
    </a>
    ${opts.footer ? `<p style="margin:24px 0 0;color:#666;font-size:11px;">${escapeHtml(opts.footer)}</p>` : ''}
  </div>
</body>
</html>
`.trim()
}

// ─── Public: live chat ────────────────────────────────────

export async function notifyAdminsOfChatMessage(
  thread: ClientChatThread,
  messageBody: string,
  isFirstMessage: boolean,
): Promise<void> {
  // Debounce subsequent messages so heavy-typing visitors don't flood inbox
  if (!isFirstMessage && thread.lastEmailSentAt) {
    const sentMs = new Date(thread.lastEmailSentAt).getTime()
    if (Date.now() - sentMs < CHAT_DEBOUNCE_MS) return
  }

  const preview = messageBody.length > 400 ? `${messageBody.slice(0, 400)}…` : messageBody
  const subject = isFirstMessage
    ? `New chat from ${thread.visitorName} — Axiom`
    : `${thread.visitorName} replied — Axiom chat`

  const bodyHtml = `
    <p style="margin:0 0 12px;color:#D4D4D4;font-size:13px;">
      <strong style="color:#FFFFFF;">${escapeHtml(thread.visitorName)}</strong>
      <span style="color:#888;">&lt;${escapeHtml(thread.visitorEmail)}&gt;</span>
    </p>
    <div style="background:#0F0F0F;border-left:3px solid #F59E0B;padding:12px 16px;border-radius:4px;">
      <p style="margin:0;white-space:pre-wrap;color:#D4D4D4;line-height:1.5;font-size:13px;">${escapeHtml(preview)}</p>
    </div>`

  const ok = await sendAdminEmail({
    subject,
    html: shellHtml({
      badge: isFirstMessage ? 'New live chat' : 'New reply',
      title: 'Customer is on the live chat',
      bodyHtml,
      ctaLabel: 'Open conversation',
      ctaHref: `${adminUrl()}/admin/conversations`,
      footer: `Subsequent messages are batched (1 email per ${Math.round(CHAT_DEBOUNCE_MS / 60_000)} min) so this won't spam your inbox.`,
    }),
    text: `${isFirstMessage ? 'New live chat' : 'New reply'} from ${thread.visitorName} <${thread.visitorEmail}>:\n\n${preview}\n\nOpen: ${adminUrl()}/admin/conversations`,
  })

  if (ok) {
    await supabase.from('client_chat_threads')
      .update({ last_email_sent_at: new Date().toISOString() })
      .eq('id', thread.id)
  }
}

// ─── Public: storefront order ─────────────────────────────

export async function notifyAdminsOfOrder(o: OrderNotification): Promise<void> {
  const itemsHtml = o.items
    .map((it) => `<tr>
      <td style="padding:6px 8px;color:#D4D4D4;">${escapeHtml(it.name)}</td>
      <td style="padding:6px 8px;color:#888;text-align:center;">×${it.quantity}</td>
      <td style="padding:6px 8px;color:#FFFFFF;text-align:right;">€${(it.price * it.quantity).toFixed(2)}</td>
    </tr>`)
    .join('')

  const deliveryHtml = o.customer.deliveryType === 'delivery'
    ? `<p style="margin:0 0 4px;color:#D4D4D4;font-size:12px;">📦 ${escapeHtml(o.customer.address ?? '')}, ${escapeHtml(o.customer.city ?? '')} ${escapeHtml(o.customer.postalCode ?? '')}</p>`
    : `<p style="margin:0 0 4px;color:#D4D4D4;font-size:12px;">🏬 Pickup at studio</p>`

  const bodyHtml = `
    <p style="margin:0 0 8px;color:#D4D4D4;font-size:13px;">
      <strong style="color:#FFFFFF;">${escapeHtml(o.customer.name)}</strong>
      <span style="color:#888;">&lt;${escapeHtml(o.customer.email)}&gt; · ${escapeHtml(o.customer.phone)}</span>
    </p>
    ${deliveryHtml}
    <table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:12px;background:#0F0F0F;border-radius:4px;">
      ${itemsHtml}
      <tr><td colspan="2" style="padding:6px 8px;color:#888;border-top:1px solid #2A2A2A;">Subtotal</td><td style="padding:6px 8px;color:#D4D4D4;text-align:right;border-top:1px solid #2A2A2A;">€${o.subtotal.toFixed(2)}</td></tr>
      ${o.deliveryFee > 0 ? `<tr><td colspan="2" style="padding:6px 8px;color:#888;">Delivery</td><td style="padding:6px 8px;color:#D4D4D4;text-align:right;">€${o.deliveryFee.toFixed(2)}</td></tr>` : ''}
      <tr><td colspan="2" style="padding:8px;color:#F59E0B;font-weight:700;border-top:1px solid #2A2A2A;">Total</td><td style="padding:8px;color:#F59E0B;font-weight:700;text-align:right;border-top:1px solid #2A2A2A;">€${o.total.toFixed(2)}</td></tr>
    </table>`

  await sendAdminEmail({
    subject: `New order — €${o.total.toFixed(2)} from ${o.customer.name}`,
    html: shellHtml({
      badge: 'New order',
      title: `${o.items.length} item${o.items.length === 1 ? '' : 's'} · €${o.total.toFixed(2)}`,
      bodyHtml,
      ctaLabel: 'Open in admin',
      ctaHref: `${adminUrl()}/admin/notifications`,
    }),
    text: `New order from ${o.customer.name} <${o.customer.email}>\nTotal: €${o.total.toFixed(2)}\n${o.items.map((i) => `- ${i.name} ×${i.quantity}`).join('\n')}\n\nOpen: ${adminUrl()}/admin/notifications`,
  })
}

// ─── Public: B2B / custom part request ────────────────────

export async function notifyAdminsOfPartRequest(p: PartRequestNotification): Promise<void> {
  const d = p.details
  const b = p.business

  const detailsRows = [
    ['Vehicle', `${d.vehicleMake} ${d.vehicleModel} ${d.vehicleYear}`],
    ['Part', d.partName],
    ['Description', d.partDescription],
    ['Dimensions', d.dimensions],
    ['Material', d.material],
    ['Quantity', String(d.quantity)],
    ['Finish', d.finish],
    ['Urgency', d.urgency],
  ].filter(([, v]) => v && v.trim())
    .map(([k, v]) => `<tr>
      <td style="padding:4px 8px;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;width:100px;vertical-align:top;">${escapeHtml(k)}</td>
      <td style="padding:4px 8px;color:#D4D4D4;font-size:13px;">${escapeHtml(v)}</td>
    </tr>`)
    .join('')

  const bodyHtml = `
    <p style="margin:0 0 8px;color:#D4D4D4;font-size:13px;">
      <strong style="color:#FFFFFF;">${escapeHtml(b.contactName)}</strong>${b.companyName ? ` <span style="color:#888;">at ${escapeHtml(b.companyName)}</span>` : ''}
    </p>
    <p style="margin:0 0 12px;color:#888;font-size:12px;">
      &lt;${escapeHtml(b.contactEmail)}&gt;${b.contactPhone ? ` · ${escapeHtml(b.contactPhone)}` : ''}${b.vatNumber ? ` · VAT ${escapeHtml(b.vatNumber)}` : ''}
    </p>
    <p style="margin:0 0 12px;color:#888;font-size:11px;">Reference: ${escapeHtml(p.reference)}${p.images > 0 ? ` · ${p.images} image${p.images === 1 ? '' : 's'} attached` : ''}</p>
    <table style="width:100%;border-collapse:collapse;background:#0F0F0F;border-radius:4px;">
      ${detailsRows}
    </table>
    ${b.notes ? `<p style="margin:14px 0 0;color:#D4D4D4;font-size:12px;font-style:italic;border-left:3px solid #F59E0B;padding-left:12px;">${escapeHtml(b.notes)}</p>` : ''}`

  await sendAdminEmail({
    subject: `New part request — ${d.partName} (${b.contactName})`,
    html: shellHtml({
      badge: 'New B2B part request',
      title: 'Custom part inquiry',
      bodyHtml,
      ctaLabel: 'Open in admin',
      ctaHref: `${adminUrl()}/admin/notifications`,
    }),
    text: `New part request from ${b.contactName} <${b.contactEmail}>\nPart: ${d.partName}\nVehicle: ${d.vehicleMake} ${d.vehicleModel} ${d.vehicleYear}\nQuantity: ${d.quantity}\nUrgency: ${d.urgency}\n${b.notes ? `\nNotes: ${b.notes}` : ''}\n\nOpen: ${adminUrl()}/admin/notifications`,
  })
}

// ─── Public: contact form ─────────────────────────────────

export async function notifyAdminsOfContact(c: ContactNotification): Promise<void> {
  const bodyHtml = `
    <p style="margin:0 0 8px;color:#D4D4D4;font-size:13px;">
      <strong style="color:#FFFFFF;">${escapeHtml(c.name)}</strong>
      <span style="color:#888;">&lt;${escapeHtml(c.email)}&gt;</span>
    </p>
    <p style="margin:0 0 12px;color:#888;font-size:12px;">Service: ${escapeHtml(c.service || 'general')}</p>
    <div style="background:#0F0F0F;border-left:3px solid #F59E0B;padding:12px 16px;border-radius:4px;">
      <p style="margin:0;white-space:pre-wrap;color:#D4D4D4;line-height:1.5;font-size:13px;">${escapeHtml(c.message)}</p>
    </div>`

  await sendAdminEmail({
    subject: `New message from ${c.name} — Axiom`,
    html: shellHtml({
      badge: 'New contact message',
      title: c.service ? `Re: ${c.service}` : 'Website contact form',
      bodyHtml,
      ctaLabel: 'Open in admin',
      ctaHref: `${adminUrl()}/admin/notifications`,
    }),
    text: `New message from ${c.name} <${c.email}> (${c.service}):\n\n${c.message}\n\nOpen: ${adminUrl()}/admin/notifications`,
  })
}

// ─── Public: admin alert (quote accepted, account requested, etc) ────

export async function notifyAdminsOfAlert(a: AdminAlertNotification): Promise<void> {
  const ctx = a.context ?? {}
  const subjectPrefix = {
    quote_accepted: 'Quote accepted',
    quote_changes_requested: 'Quote changes requested',
    account_requested: 'Account requested',
    invoice_paid_cleanup: 'Invoice paid',
    other: 'Notification',
  }[a.kind] ?? 'Notification'

  const ctxLines: string[] = []
  if (ctx.customerName) ctxLines.push(`<p style="margin:0 0 4px;color:#888;font-size:12px;">Customer: <span style="color:#D4D4D4;">${escapeHtml(ctx.customerName)}${ctx.customerEmail ? ` &lt;${escapeHtml(ctx.customerEmail)}&gt;` : ''}</span></p>`)
  if (ctx.quoteNumber) ctxLines.push(`<p style="margin:0 0 4px;color:#888;font-size:12px;">Quote: <span style="color:#D4D4D4;">${escapeHtml(ctx.quoteNumber)}</span></p>`)
  if (ctx.invoiceNumber) ctxLines.push(`<p style="margin:0 0 4px;color:#888;font-size:12px;">Invoice: <span style="color:#D4D4D4;">${escapeHtml(ctx.invoiceNumber)}</span></p>`)
  if (ctx.orderNumber) ctxLines.push(`<p style="margin:0 0 4px;color:#888;font-size:12px;">Order: <span style="color:#D4D4D4;">${escapeHtml(ctx.orderNumber)}</span></p>`)

  const bodyHtml = `
    <p style="margin:0 0 12px;color:#D4D4D4;font-size:13px;line-height:1.5;">${escapeHtml(a.message)}</p>
    ${ctxLines.join('')}`

  await sendAdminEmail({
    subject: `${subjectPrefix} — ${a.title}`,
    html: shellHtml({
      badge: subjectPrefix,
      title: a.title,
      bodyHtml,
      ctaLabel: 'Open in admin',
      ctaHref: `${adminUrl()}/admin/notifications`,
    }),
    text: `${a.title}\n\n${a.message}\n\nOpen: ${adminUrl()}/admin/notifications`,
  })
}
