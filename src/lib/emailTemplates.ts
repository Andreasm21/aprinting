// HTML email templates — styled to match the Axiom site (dark bg, amber
// accent, mono headers). Inlined CSS because email clients don't honor
// external stylesheets and most strip <style> tags.

import type { Invoice } from '@/stores/invoicesStore'
import type { Customer } from '@/stores/customersStore'

const COLORS = {
  bg: '#0a0a0a',
  bgCard: '#171717',
  bgRow: '#1f1f1f',
  border: '#262626',
  text: '#e5e5e5',
  textMuted: '#a3a3a3',
  amber: '#F59E0B',
  green: '#10B981',
  blue: '#3B82F6',
}

const fontStack = "'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace"
const sansStack = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"

/** Wraps email body content in the standard Axiom shell (dark, amber accents). */
function shell(opts: {
  preheader?: string
  title: string
  body: string
  ctaLabel?: string
  ctaUrl?: string
}): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(opts.title)}</title>
</head>
<body style="margin:0; padding:0; background:${COLORS.bg}; font-family:${sansStack}; color:${COLORS.text};">
${opts.preheader ? `<div style="display:none; max-height:0; overflow:hidden; opacity:0;">${escape(opts.preheader)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.bg};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%;">
      <!-- Header -->
      <tr><td style="padding:0 0 24px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="left" style="font-family:${fontStack}; font-size:28px; font-weight:bold; letter-spacing:-0.02em; color:${COLORS.text};">
              <span style="color:${COLORS.amber};">A</span>xiom
            </td>
            <td align="right" style="font-family:${fontStack}; font-size:11px; color:${COLORS.textMuted}; text-transform:uppercase; letter-spacing:0.1em;">
              3D Printing &middot; Cyprus
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Card -->
      <tr><td style="background:${COLORS.bgCard}; border:1px solid ${COLORS.border}; border-radius:8px; padding:32px;">
        <h1 style="margin:0 0 8px 0; font-family:${fontStack}; font-size:20px; font-weight:bold; color:${COLORS.text}; line-height:1.3;">
          ${opts.title}
        </h1>
        <div style="height:2px; width:48px; background:${COLORS.amber}; margin:12px 0 24px 0;"></div>
        <div style="font-size:14px; line-height:1.6; color:${COLORS.text};">
          ${opts.body}
        </div>
        ${opts.ctaLabel && opts.ctaUrl ? `
        <div style="margin-top:32px;">
          <a href="${escape(opts.ctaUrl)}" style="display:inline-block; background:${COLORS.amber}; color:${COLORS.bg}; padding:12px 24px; border-radius:6px; font-family:${fontStack}; font-size:13px; font-weight:bold; text-transform:uppercase; letter-spacing:0.05em; text-decoration:none;">
            ${escape(opts.ctaLabel)}
          </a>
        </div>` : ''}
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding:24px 0 0 0; text-align:center; font-family:${fontStack}; font-size:11px; color:${COLORS.textMuted}; line-height:1.6;">
        <div>Axiom &middot; 3D Printing Studio &middot; Cyprus 🇨🇾</div>
        <div style="margin-top:6px;"><a href="mailto:team@axiomcreate.com" style="color:${COLORS.textMuted}; text-decoration:underline;">team@axiomcreate.com</a></div>
        <div style="margin-top:12px; font-size:10px;">This email was sent because you have an active engagement with Axiom.</div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}

/** Quotation email body. Customer-facing summary of the quote.
 *  If `portalUrl` is provided, the email mentions that the customer can
 *  sign in to track this order — otherwise it just shows the public
 *  accept link without pushing portal sign-up. */
export function quotationEmail(
  doc: Invoice,
  customer?: Customer,
  viewUrl?: string,
  portalUrl?: string,
): { subject: string; html: string; text: string } {
  const total = (doc.totalOverride ?? doc.total).toFixed(2)
  const validLine = doc.validUntil
    ? `Valid until <strong style="color:${COLORS.amber};">${new Date(doc.validUntil).toLocaleDateString('en-GB')}</strong>.`
    : ''

  // Existing portal account? Tell them where to sign in.
  // No portal account? Don't push them to make one — that's a separate flow.
  const portalLine = portalUrl
    ? `<p style="margin:16px 0 0 0; padding:12px; background:${COLORS.bgRow}; border-left:3px solid ${COLORS.amber}; border-radius:4px;">
         You already have a Customer Portal account — once accepted you can <a href="${escape(portalUrl)}" style="color:${COLORS.amber}; text-decoration:underline;">sign in to track this order</a> alongside your other quotes and invoices.
       </p>`
    : ''

  const summary = `
    <p style="margin:0 0 16px 0;">Hello${customer?.name ? ' ' + escape(customer.name.split(' ')[0]) : ''},</p>
    <p style="margin:0 0 16px 0;">Thank you for your interest in our 3D printing services. Please find your quotation attached as a PDF — or click the button below to review and accept it online.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.bgRow}; border:1px solid ${COLORS.border}; border-radius:6px; margin:16px 0;">
      <tr><td style="padding:16px;">
        <div style="font-family:${fontStack}; font-size:11px; color:${COLORS.textMuted}; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:6px;">Quotation</div>
        <div style="font-family:${fontStack}; font-size:18px; color:${COLORS.text}; font-weight:bold;">${escape(doc.documentNumber)}</div>
        <div style="margin-top:12px; font-size:13px; color:${COLORS.textMuted};">Total: <span style="color:${COLORS.amber}; font-family:${fontStack}; font-weight:bold; font-size:18px;">€${total}</span></div>
        ${doc.vatRate > 0
          ? `<div style="font-size:11px; color:${COLORS.textMuted}; margin-top:4px;">Inclusive of Cyprus VAT ${(doc.vatRate * 100).toFixed(0)}%</div>`
          : `<div style="font-size:11px; color:${COLORS.textMuted}; margin-top:4px;">VAT not included</div>`}
      </td></tr>
    </table>
    <p style="margin:16px 0 0 0;">${validLine}</p>
    ${portalLine}
    <p style="margin:16px 0 0 0;">If you'd like to proceed or have any questions, simply reply to this email.</p>
  `

  return {
    subject: `Quotation ${doc.documentNumber} from Axiom`,
    html: shell({
      preheader: `Your quotation ${doc.documentNumber} for €${total}`,
      title: `Quotation ${doc.documentNumber}`,
      body: summary,
      ctaLabel: viewUrl ? 'Review & Accept Online' : undefined,
      ctaUrl: viewUrl,
    }),
    text: `Hello${customer?.name ? ' ' + customer.name.split(' ')[0] : ''},\n\nYour quotation ${doc.documentNumber} for €${total} is attached.${doc.validUntil ? ` Valid until ${new Date(doc.validUntil).toLocaleDateString('en-GB')}.` : ''}${viewUrl ? `\n\nReview and accept online: ${viewUrl}` : ''}${portalUrl ? `\n\nSign in to your Customer Portal to track this order: ${portalUrl}` : ''}\n\nReply to this email if you'd like to proceed.\n\nAxiom — team@axiomcreate.com`,
  }
}

/** Invoice email body. */
export function invoiceEmail(doc: Invoice, customer?: Customer): { subject: string; html: string; text: string } {
  const total = (doc.totalOverride ?? doc.total).toFixed(2)
  const dueLine = 'Payment is due upon receipt unless otherwise agreed.'

  const summary = `
    <p style="margin:0 0 16px 0;">Hello${customer?.name ? ' ' + escape(customer.name.split(' ')[0]) : ''},</p>
    <p style="margin:0 0 16px 0;">Please find invoice <strong>${escape(doc.documentNumber)}</strong> attached as a PDF.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.bgRow}; border:1px solid ${COLORS.border}; border-radius:6px; margin:16px 0;">
      <tr><td style="padding:16px;">
        <div style="font-family:${fontStack}; font-size:11px; color:${COLORS.textMuted}; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:6px;">Amount due</div>
        <div style="font-family:${fontStack}; font-size:24px; color:${COLORS.amber}; font-weight:bold;">€${total}</div>
        ${doc.vatRate > 0
          ? `<div style="font-size:11px; color:${COLORS.textMuted}; margin-top:4px;">Inclusive of Cyprus VAT ${(doc.vatRate * 100).toFixed(0)}%</div>`
          : `<div style="font-size:11px; color:${COLORS.textMuted}; margin-top:4px;">VAT not included</div>`}
      </td></tr>
    </table>
    <p style="margin:16px 0 0 0;">${dueLine}</p>
    <p style="margin:16px 0 0 0;">Reply to this email if you have any questions about this invoice.</p>
  `

  return {
    subject: `Invoice ${doc.documentNumber} from Axiom — €${total}`,
    html: shell({
      preheader: `Invoice ${doc.documentNumber}: €${total} due`,
      title: `Invoice ${doc.documentNumber}`,
      body: summary,
    }),
    text: `Hello${customer?.name ? ' ' + customer.name.split(' ')[0] : ''},\n\nInvoice ${doc.documentNumber} for €${total} is attached.\n\nReply with any questions.\n\nAxiom — team@axiomcreate.com`,
  }
}

/** Customer portal credentials email. */
export function portalCredentialsEmail(opts: {
  customerName: string
  email: string
  tempPassword: string
  portalUrl: string
}): { subject: string; html: string; text: string } {
  const body = `
    <p style="margin:0 0 16px 0;">Hello ${escape(opts.customerName.split(' ')[0])},</p>
    <p style="margin:0 0 16px 0;">An Axiom Customer Portal account has been created for you. Use the credentials below to sign in and view your quotations, invoices and order history.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.bgRow}; border:1px solid ${COLORS.border}; border-radius:6px; margin:16px 0;">
      <tr><td style="padding:16px;">
        <div style="font-family:${fontStack}; font-size:11px; color:${COLORS.textMuted}; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:6px;">Email</div>
        <div style="font-family:${fontStack}; font-size:14px; color:${COLORS.text}; margin-bottom:12px;">${escape(opts.email)}</div>
        <div style="font-family:${fontStack}; font-size:11px; color:${COLORS.textMuted}; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:6px;">Temporary password</div>
        <div style="font-family:${fontStack}; font-size:14px; color:${COLORS.amber}; font-weight:bold;">${escape(opts.tempPassword)}</div>
      </td></tr>
    </table>
    <p style="margin:16px 0 0 0; font-size:13px; color:${COLORS.textMuted};">For your security, please change your password after signing in.</p>
  `

  return {
    subject: 'Your Axiom Customer Portal access',
    html: shell({
      preheader: 'Sign in to view your Axiom orders and invoices',
      title: 'Welcome to the Customer Portal',
      body,
      ctaLabel: 'Sign in to portal',
      ctaUrl: opts.portalUrl,
    }),
    text: `Hello ${opts.customerName.split(' ')[0]},\n\nYour Axiom Customer Portal access:\nEmail: ${opts.email}\nTemporary password: ${opts.tempPassword}\n\nSign in: ${opts.portalUrl}\n\nPlease change your password after signing in.`,
  }
}

/** Order tracking-link email — sent from the admin's Order Profile so the
 *  customer gets the public /track/:id URL with the current status. */
export function orderTrackingEmail(opts: {
  customerName: string
  orderNumber: string
  statusLabel: string
  total: number
  vatRate: number
  trackingUrl: string
  noteFromAdmin?: string
}): { subject: string; html: string; text: string } {
  const totalStr = opts.total.toFixed(2)
  const body = `
    <p style="margin:0 0 16px 0;">Hello${opts.customerName ? ' ' + escape(opts.customerName.split(' ')[0]) : ''},</p>
    <p style="margin:0 0 16px 0;">Here's the live tracking link for your order — click any time to see where it stands and download your invoice.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.bgRow}; border:1px solid ${COLORS.border}; border-radius:6px; margin:16px 0;">
      <tr><td style="padding:16px;">
        <div style="font-family:${fontStack}; font-size:11px; color:${COLORS.textMuted}; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:6px;">Order</div>
        <div style="font-family:${fontStack}; font-size:18px; color:${COLORS.text}; font-weight:bold;">${escape(opts.orderNumber)}</div>
        <div style="margin-top:12px; font-size:13px; color:${COLORS.textMuted};">Status: <span style="color:${COLORS.amber}; font-family:${fontStack}; font-weight:bold;">${escape(opts.statusLabel)}</span></div>
        <div style="margin-top:6px; font-size:13px; color:${COLORS.textMuted};">Total: <span style="color:${COLORS.amber}; font-family:${fontStack}; font-weight:bold;">€${totalStr}</span></div>
        ${opts.vatRate > 0
          ? `<div style="font-size:11px; color:${COLORS.textMuted}; margin-top:4px;">Inclusive of Cyprus VAT ${(opts.vatRate * 100).toFixed(0)}%</div>`
          : `<div style="font-size:11px; color:${COLORS.textMuted}; margin-top:4px;">VAT not included</div>`}
      </td></tr>
    </table>
    ${opts.noteFromAdmin
      ? `<div style="margin:16px 0; padding:12px; background:${COLORS.bgRow}; border-left:3px solid ${COLORS.amber}; border-radius:4px;">
           <div style="font-family:${fontStack}; font-size:10px; color:${COLORS.textMuted}; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:6px;">Note from Axiom</div>
           <div style="font-size:13px; color:${COLORS.text}; white-space:pre-wrap;">${escape(opts.noteFromAdmin)}</div>
         </div>`
      : ''}
    <p style="margin:16px 0 0 0;">If you have any questions, just reply to this email.</p>
  `

  return {
    subject: `Your order ${opts.orderNumber} — ${opts.statusLabel}`,
    html: shell({
      preheader: `Track ${opts.orderNumber} — currently ${opts.statusLabel.toLowerCase()}`,
      title: `Order ${opts.orderNumber}`,
      body,
      ctaLabel: 'Track Your Order',
      ctaUrl: opts.trackingUrl,
    }),
    text: `Hello${opts.customerName ? ' ' + opts.customerName.split(' ')[0] : ''},\n\nOrder ${opts.orderNumber} status: ${opts.statusLabel}.\nTotal: €${totalStr}.\n\nTrack live: ${opts.trackingUrl}\n${opts.noteFromAdmin ? '\nNote from Axiom: ' + opts.noteFromAdmin + '\n' : ''}\nReply to this email with any questions.\n\nAxiom — team@axiomcreate.com`,
  }
}

/** Internal low-stock alert sent to admins when an inventory item drops
 *  at-or-below the per-product reorderLevel (or the global low-stock %). */
export function lowStockAlertEmail(opts: {
  items: Array<{
    partNumber: string
    name: string
    category: string
    qtyOnHand: number       // display units (kg for filaments, pcs otherwise)
    threshold: number       // the level we crossed under
    unit?: string           // e.g. 'g' for filaments, 'pcs' otherwise
  }>
  inventoryUrl: string
}): { subject: string; html: string; text: string } {
  const rows = opts.items.map((it) => `
    <tr style="border-top:1px solid ${COLORS.border};">
      <td style="padding:10px 0; font-family:${fontStack}; font-size:12px; color:${COLORS.amber};">${escape(it.partNumber)}</td>
      <td style="padding:10px 12px; font-size:13px; color:${COLORS.text};">${escape(it.name)}<div style="font-size:10px; color:${COLORS.textMuted}; margin-top:2px;">${escape(it.category)}</div></td>
      <td style="padding:10px 0; font-family:${fontStack}; font-size:13px; color:${COLORS.text}; text-align:right; white-space:nowrap;">
        <span style="color:#F87171; font-weight:bold;">${it.qtyOnHand.toFixed(0)}</span> ${escape(it.unit || '')}
        <div style="font-size:10px; color:${COLORS.textMuted}; margin-top:2px;">threshold ${it.threshold.toFixed(0)} ${escape(it.unit || '')}</div>
      </td>
    </tr>
  `).join('')

  const body = `
    <p style="margin:0 0 16px 0;">Hey team,</p>
    <p style="margin:0 0 16px 0;">${opts.items.length === 1 ? 'An inventory item has' : `${opts.items.length} inventory items have`} crossed below the low-stock threshold. Time to reorder.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.bgRow}; border:1px solid ${COLORS.border}; border-radius:6px; margin:16px 0; overflow:hidden;">
      <thead>
        <tr>
          <th style="padding:10px 0; text-align:left; font-family:${fontStack}; font-size:10px; color:${COLORS.textMuted}; text-transform:uppercase; letter-spacing:0.1em;">Part #</th>
          <th style="padding:10px 12px; text-align:left; font-family:${fontStack}; font-size:10px; color:${COLORS.textMuted}; text-transform:uppercase; letter-spacing:0.1em;">Item</th>
          <th style="padding:10px 0; text-align:right; font-family:${fontStack}; font-size:10px; color:${COLORS.textMuted}; text-transform:uppercase; letter-spacing:0.1em;">On hand</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin:16px 0 0 0; font-size:12px; color:${COLORS.textMuted};">This alert fires the moment an item crosses the threshold — not while it's already low.</p>
  `

  return {
    subject: opts.items.length === 1
      ? `[LOW STOCK] ${opts.items[0].partNumber} — ${opts.items[0].name}`
      : `[LOW STOCK] ${opts.items.length} items below threshold`,
    html: shell({
      preheader: `${opts.items.length} item${opts.items.length === 1 ? '' : 's'} need reordering`,
      title: opts.items.length === 1 ? 'Low stock alert' : `Low stock — ${opts.items.length} items`,
      body,
      ctaLabel: 'Open Inventory',
      ctaUrl: opts.inventoryUrl,
    }),
    text: `Low stock alert — ${opts.items.length} item${opts.items.length === 1 ? '' : 's'} below threshold:\n\n` +
      opts.items.map((it) => `  ${it.partNumber} — ${it.name} (${it.category}): ${it.qtyOnHand.toFixed(0)} ${it.unit || ''} on hand, threshold ${it.threshold.toFixed(0)}`).join('\n') +
      `\n\nManage inventory: ${opts.inventoryUrl}`,
  }
}

/** Free-form email composed by the admin. */
export function customEmail(opts: { subject: string; bodyHtml: string }): { subject: string; html: string; text: string } {
  return {
    subject: opts.subject,
    html: shell({
      title: opts.subject,
      body: opts.bodyHtml,
    }),
    text: opts.bodyHtml.replace(/<[^>]+>/g, ''),
  }
}

// Minimal HTML escape for values being interpolated into email bodies.
function escape(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
