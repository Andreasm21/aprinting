import type { Invoice } from '@/stores/invoicesStore'
import type { Notification, AdminAlertNotification } from '@/stores/notificationsStore'
import type { Order, OrderStatus } from '@/stores/ordersStore'
import type { PrintJob, JobStatus } from '@/stores/printJobsStore'
import type { EmailLogEntry } from '@/stores/emailLogStore'

export type FulfillmentFlowKind = 'custom' | 'off_the_shelf'

export type FulfillmentStage =
  | 'request'
  | 'quotation'
  | 'order'
  | 'print'
  | 'payment'
  | 'delivery'
  | 'archive'

export interface FulfillmentPosition {
  kind: FulfillmentFlowKind
  stage: FulfillmentStage
  label: string
  detail?: string
}

export const FLOW_KIND_LABEL: Record<FulfillmentFlowKind, string> = {
  custom: 'Custom / Made-to-Order',
  off_the_shelf: 'Off-the-Shelf / Pre-Made',
}

export const FLOW_KIND_SHORT_LABEL: Record<FulfillmentFlowKind, string> = {
  custom: 'Custom',
  off_the_shelf: 'Off-the-Shelf',
}

export const STAGE_LABEL: Record<FulfillmentStage, string> = {
  request: 'Request',
  quotation: 'Quotation',
  order: 'Order',
  print: 'Print',
  payment: 'Payment',
  delivery: 'Delivery',
  archive: 'Archive',
}

export const STAGE_DETAIL: Record<FulfillmentStage, string> = {
  request: 'Incoming part requests, contact messages, and intake context.',
  quotation: 'Pricing, quote edits, customer review, and acceptance decision.',
  order: 'Confirmed order, order confirmation emails, and tracking setup.',
  print: 'Print Job Manager, queued prints, active production, and completed prints.',
  payment: 'Invoices, payment state, payment terms, and paid-invoice cleanup.',
  delivery: 'Ready, shipped, pickup, delivery, and customer handoff.',
  archive: 'Closed, cancelled, completed, or archived records.',
}

export const FLOW_LANES: Record<FulfillmentFlowKind, FulfillmentStage[]> = {
  custom: ['request', 'quotation', 'order', 'print', 'payment', 'delivery', 'archive'],
  off_the_shelf: ['order', 'print', 'payment', 'delivery', 'archive'],
}

const ORDER_STAGE_BY_STATUS: Record<OrderStatus, FulfillmentStage> = {
  pending: 'order',
  in_production: 'print',
  ready: 'delivery',
  shipped: 'delivery',
  delivered: 'delivery',
  closed: 'archive',
  cancelled: 'archive',
}

const ORDER_STATUS_DETAIL: Record<OrderStatus, string> = {
  pending: 'Confirmed; waiting for print and payment work.',
  in_production: 'In production through the Print Job Manager.',
  ready: 'Ready for pickup or delivery.',
  shipped: 'Out for delivery.',
  delivered: 'Delivered to the customer.',
  closed: 'Archived order.',
  cancelled: 'Cancelled order.',
}

const JOB_STATUS_DETAIL: Record<JobStatus, string> = {
  queued: 'Queued in the Print Job Manager.',
  printing: 'Currently printing.',
  paused: 'Paused in the Print Job Manager.',
  completed: 'Print complete; ready for delivery handoff.',
  failed: 'Print failed; needs review or reprint.',
  cancelled: 'Print cancelled and archived from production.',
}

export function getOrderFlowKind(order?: Pick<Order, 'quotationId'>): FulfillmentFlowKind {
  return order?.quotationId ? 'custom' : 'off_the_shelf'
}

export function getDocumentFlowKind(
  doc: Pick<Invoice, 'type' | 'sourceOrderId' | 'sourcePartRequestId'>,
  linkedOrder?: Pick<Order, 'quotationId'>,
): FulfillmentFlowKind {
  if (doc.type === 'quotation' || doc.sourcePartRequestId || linkedOrder?.quotationId) return 'custom'
  if (doc.sourceOrderId) return 'off_the_shelf'
  return 'custom'
}

export function positionForOrder(
  order: Pick<Order, 'quotationId' | 'status'>,
  invoice?: Pick<Invoice, 'status'>,
): FulfillmentPosition {
  const stage = ORDER_STAGE_BY_STATUS[order.status]
  const kind = getOrderFlowKind(order)
  const paymentNote = invoice ? ` Invoice is ${invoice.status}.` : ''
  return {
    kind,
    stage,
    label: `${FLOW_KIND_SHORT_LABEL[kind]} · ${STAGE_LABEL[stage]}`,
    detail: `${ORDER_STATUS_DETAIL[order.status]}${paymentNote}`,
  }
}

export function positionForDocument(doc: Invoice, linkedOrder?: Pick<Order, 'quotationId'>): FulfillmentPosition {
  const kind = getDocumentFlowKind(doc, linkedOrder)
  if (doc.type === 'quotation') {
    const accepted = doc.status === 'paid'
    return {
      kind: 'custom',
      stage: 'quotation',
      label: `Custom · ${accepted ? 'Quotation accepted' : 'Quotation'}`,
      detail: accepted
        ? 'Accepted quote; the custom flow continues into Order.'
        : `Quote is ${doc.status}; customer decision is still in the quotation step.`,
    }
  }

  return {
    kind,
    stage: 'payment',
    label: `${FLOW_KIND_SHORT_LABEL[kind]} · Payment`,
    detail: `Invoice is ${doc.status}; invoices are handled inside the payment step.`,
  }
}

export function positionForPrintJob(
  job: PrintJob,
  linkedDocument?: Invoice,
  linkedOrder?: Pick<Order, 'quotationId'>,
): FulfillmentPosition {
  const kind = linkedDocument
    ? getDocumentFlowKind(linkedDocument, linkedOrder)
    : job.source === 'order'
      ? 'off_the_shelf'
      : 'custom'

  return {
    kind,
    stage: 'print',
    label: `${FLOW_KIND_SHORT_LABEL[kind]} · Print`,
    detail: JOB_STATUS_DETAIL[job.status],
  }
}

export function positionForNotification(notification: Notification): FulfillmentPosition {
  if (notification.type === 'part_request') {
    return {
      kind: 'custom',
      stage: 'request',
      label: 'Custom · Request',
      detail: 'Incoming made-to-order request. Next step is quotation.',
    }
  }

  if (notification.type === 'order') {
    return {
      kind: 'off_the_shelf',
      stage: 'order',
      label: 'Off-the-Shelf · Order',
      detail: 'Storefront order. Next steps are print and payment.',
    }
  }

  if (notification.type === 'contact') {
    return {
      kind: 'custom',
      stage: 'request',
      label: 'Custom · Request',
      detail: 'General inquiry captured as intake before quotation.',
    }
  }

  return positionForAdminAlert(notification)
}

function positionForAdminAlert(notification: AdminAlertNotification): FulfillmentPosition {
  switch (notification.kind) {
    case 'quote_changes_requested':
      return {
        kind: 'custom',
        stage: 'quotation',
        label: 'Custom · Quotation',
        detail: 'Customer requested quote changes.',
      }
    case 'quote_accepted':
      return {
        kind: 'custom',
        stage: 'order',
        label: 'Custom · Order',
        detail: 'Quote accepted; the order has been confirmed.',
      }
    case 'invoice_paid_cleanup':
      return {
        kind: 'custom',
        stage: 'payment',
        label: 'Custom · Payment',
        detail: 'Invoice paid; cleanup can move the quote link toward archive.',
      }
    case 'account_requested':
      return {
        kind: 'custom',
        stage: 'order',
        label: 'Custom · Order',
        detail: 'Portal account or password request tied to order handling.',
      }
    default:
      return {
        kind: 'custom',
        stage: 'request',
        label: 'Custom · Request',
        detail: 'Administrative alert captured at intake.',
      }
  }
}

export function positionForEmailTemplate(template?: string): FulfillmentPosition {
  if (!template || template === 'custom') {
    return {
      kind: 'custom',
      stage: 'order',
      label: 'Order communication',
      detail: 'Custom emails should be tied to the closest active fulfillment step.',
    }
  }

  if (template === 'quotation' || template === 'quote_ready') {
    return {
      kind: 'custom',
      stage: 'quotation',
      label: 'Custom · Quotation',
      detail: 'Quotation email belongs to the quotation step.',
    }
  }

  if (template === 'invoice') {
    return {
      kind: 'custom',
      stage: 'payment',
      label: 'Payment',
      detail: 'Invoice emails belong to the payment step.',
    }
  }

  if (template === 'order_confirmed' || template === 'portal_credentials' || template === 'welcome') {
    return {
      kind: 'off_the_shelf',
      stage: 'order',
      label: 'Order',
      detail: 'Confirmation and account emails belong to the order step.',
    }
  }

  if (template === 'order_ready' || template === 'shipped') {
    return {
      kind: 'off_the_shelf',
      stage: 'delivery',
      label: 'Delivery',
      detail: 'Ready and shipped emails belong to the delivery step.',
    }
  }

  return {
    kind: 'custom',
    stage: 'order',
    label: 'Order communication',
    detail: 'Email is part of the active order step unless attached to a quote or invoice.',
  }
}

export function positionForEmailLog(entry: EmailLogEntry): FulfillmentPosition {
  return positionForEmailTemplate(entry.template)
}
