// Thin adapters that turn each intake-event shape into a lead row via
// useLeadsStore.upsertFromIntake. Centralising the mapping here keeps the
// intake-side stores from importing field-name knowledge they don't need.
//
// Every helper is fire-and-forget: the underlying Supabase write is
// awaited, but errors are logged not thrown — the intake event still
// succeeds even if lead creation fails for any reason.

import { useLeadsStore } from '@/stores/leadsStore'
import type {
  ContactNotification,
  PartRequestNotification,
} from '@/stores/notificationsStore'
import type { ClientChatThread } from '@/stores/clientChatStore'

/** Visitor opened a live chat. The first message becomes the source label
 *  so admins see "what they came in for" without opening the thread. */
export async function createLeadFromChat(
  thread: ClientChatThread,
  firstMessage: string,
): Promise<void> {
  const preview = firstMessage.length > 120
    ? `${firstMessage.slice(0, 120)}…`
    : firstMessage
  await useLeadsStore.getState().upsertFromIntake({
    name: thread.visitorName,
    email: thread.visitorEmail,
    source: 'chat',
    sourceId: thread.id,
    sourceLabel: `“${preview}”`,
  })
}

/** B2B / custom part request submitted from the public site. Carries
 *  business contact info — high-intent so we can pre-tag it later. */
export async function createLeadFromPartRequest(
  n: PartRequestNotification,
): Promise<void> {
  const b = n.business
  const d = n.details
  const summary = [d.partName, d.vehicleMake, d.vehicleModel].filter(Boolean).join(' · ')
  await useLeadsStore.getState().upsertFromIntake({
    name: b.contactName || b.companyName || 'B2B inquiry',
    email: b.contactEmail,
    phone: b.contactPhone,
    company: b.companyName,
    source: 'part_request',
    sourceId: n.id,
    sourceLabel: summary || `Reference ${n.reference}`,
  })
}

/** Public contact form submission. Service field maps into the source label. */
export async function createLeadFromContact(n: ContactNotification): Promise<void> {
  const preview = n.message.length > 100 ? `${n.message.slice(0, 100)}…` : n.message
  await useLeadsStore.getState().upsertFromIntake({
    name: n.name,
    email: n.email,
    source: 'contact',
    sourceId: n.id,
    sourceLabel: n.service ? `${n.service} — ${preview}` : preview,
  })
}
