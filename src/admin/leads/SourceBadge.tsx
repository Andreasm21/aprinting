// Small chip showing where a lead came from. Same icon language used in
// the kanban card and the detail panel header.

import { MessageSquare, Mail, Factory, FileText, Phone, Users, Calendar, Edit3, HelpCircle } from 'lucide-react'
import type { LeadSource } from '@/stores/leadsStore'

const SOURCE_META: Record<LeadSource, { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; tone: string }> = {
  chat:         { icon: MessageSquare, label: 'Live chat',     tone: 'bg-emerald-500/10 text-emerald-400' },
  part_request: { icon: Factory,       label: 'B2B request',   tone: 'bg-amber-500/10 text-amber-400' },
  contact:      { icon: Mail,          label: 'Contact form',  tone: 'bg-sky-500/10 text-sky-400' },
  quote:        { icon: FileText,      label: 'Quote',         tone: 'bg-violet-500/10 text-violet-400' },
  manual:       { icon: Edit3,         label: 'Manual',        tone: 'bg-text-muted/15 text-text-secondary' },
  phone:        { icon: Phone,         label: 'Phone',         tone: 'bg-text-muted/15 text-text-secondary' },
  email:        { icon: Mail,          label: 'Email',         tone: 'bg-text-muted/15 text-text-secondary' },
  meeting:      { icon: Users,         label: 'Meeting',       tone: 'bg-text-muted/15 text-text-secondary' },
  other:        { icon: HelpCircle,    label: 'Other',         tone: 'bg-text-muted/15 text-text-secondary' },
}

export const SOURCE_LABEL: Record<LeadSource, string> = Object.fromEntries(
  Object.entries(SOURCE_META).map(([k, v]) => [k, v.label]),
) as Record<LeadSource, string>

export const SOURCE_ICON = Object.fromEntries(
  Object.entries(SOURCE_META).map(([k, v]) => [k, v.icon]),
) as Record<LeadSource, React.ComponentType<{ size?: number; className?: string }>>

interface Props {
  source: LeadSource
  size?: 'sm' | 'md'
}

export default function SourceBadge({ source, size = 'sm' }: Props) {
  const meta = SOURCE_META[source] ?? SOURCE_META.other
  const Icon = meta.icon
  const px = size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-1'
  const text = size === 'sm' ? 'text-[9px]' : 'text-[10px]'
  const iconSize = size === 'sm' ? 9 : 11
  const calendarUnused = Calendar  // suppress unused import lint
  void calendarUnused
  return (
    <span className={`inline-flex items-center gap-1 rounded ${px} ${text} ${meta.tone} uppercase tracking-wider font-mono`}>
      <Icon size={iconSize} />
      {meta.label}
    </span>
  )
}
