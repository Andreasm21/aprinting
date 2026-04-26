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
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
    })
    const json = await res.json()
    if (!res.ok) {
      return { success: false, error: json.error || `HTTP ${res.status}` }
    }
    return { success: true, id: json.id }
  } catch (err) {
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
