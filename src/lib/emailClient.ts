// Frontend email client — POSTs to the Vercel serverless function at
// /api/send-email. Handles PDF attachment generation from a DOM element.

export interface EmailAttachment {
  filename: string
  content: string // base64
  contentType?: string
}

export interface SendEmailOptions {
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  subject: string
  html: string
  text?: string
  attachments?: EmailAttachment[]
}

export interface SendEmailResult {
  success: boolean
  id?: string
  error?: string
}

/** Call the serverless email endpoint. */
export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  // Log what we're about to send so we can spot bad inputs in the browser console.
  console.log('[sendEmail] →', {
    to: opts.to,
    cc: opts.cc,
    subject: opts.subject,
    htmlBytes: opts.html?.length,
    textBytes: opts.text?.length,
    attachments: opts.attachments?.map((a) => ({ filename: a.filename, contentBytes: a.content.length })),
  })
  let body: string
  try {
    body = JSON.stringify(opts)
  } catch (err) {
    console.error('[sendEmail] JSON.stringify failed:', err)
    return { success: false, error: 'Could not serialize email payload — ' + (err instanceof Error ? err.message : 'unknown') }
  }
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    let json: { id?: string; error?: string; details?: unknown } = {}
    try { json = await res.json() } catch { /* tolerate empty body */ }
    if (!res.ok) {
      console.error('[sendEmail] server error:', res.status, json)
      return { success: false, error: json.error || `HTTP ${res.status}` }
    }
    console.log('[sendEmail] ✓ id', json.id)
    return { success: true, id: json.id }
  } catch (err) {
    console.error('[sendEmail] fetch threw:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}

/** Render a DOM element to a PDF and return the file as base64 (no data URL prefix). */
export async function elementToPdfBase64(element: HTMLElement, filename: string): Promise<EmailAttachment> {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  })

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const imgWidth = 210 // A4 width in mm
  const pageHeight = 297 // A4 height in mm
  const imgHeight = (canvas.height * imgWidth) / canvas.width
  let heightLeft = imgHeight
  let position = 0

  pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, position, imgWidth, imgHeight)
  heightLeft -= pageHeight

  while (heightLeft > 0) {
    position = heightLeft - imgHeight
    pdf.addPage()
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight
  }

  // jsPDF datauristring → strip the "data:application/pdf;filename=...;base64," prefix
  const dataUri = pdf.output('datauristring')
  const base64 = dataUri.split(',')[1] || ''

  return {
    filename: filename.endsWith('.pdf') ? filename : `${filename}.pdf`,
    content: base64,
    contentType: 'application/pdf',
  }
}
