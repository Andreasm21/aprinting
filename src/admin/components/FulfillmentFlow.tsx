import {
  Archive,
  ClipboardList,
  FileText,
  Inbox,
  Printer,
  Receipt,
  Truck,
  Wrench,
} from 'lucide-react'
import {
  FLOW_KIND_LABEL,
  FLOW_KIND_SHORT_LABEL,
  FLOW_LANES,
  STAGE_DETAIL,
  STAGE_LABEL,
  type FulfillmentFlowKind,
  type FulfillmentPosition,
  type FulfillmentStage,
} from '@/lib/fulfillmentFlow'

const STAGE_ICONS: Record<FulfillmentStage, typeof Inbox> = {
  request: Inbox,
  quotation: FileText,
  order: ClipboardList,
  print: Printer,
  payment: Receipt,
  delivery: Truck,
  archive: Archive,
}

const STAGE_TINT: Record<FulfillmentStage, string> = {
  request: 'text-accent-blue bg-accent-blue/10 border-accent-blue/30',
  quotation: 'text-accent-amber bg-accent-amber/10 border-accent-amber/30',
  order: 'text-text-primary bg-bg-tertiary border-border',
  print: 'text-accent-blue bg-accent-blue/10 border-accent-blue/30',
  payment: 'text-accent-amber bg-accent-amber/10 border-accent-amber/30',
  delivery: 'text-accent-green bg-accent-green/10 border-accent-green/30',
  archive: 'text-text-muted bg-bg-tertiary border-border',
}

export function FlowPositionBadge({
  position,
  compact = false,
}: {
  position: FulfillmentPosition
  compact?: boolean
}) {
  const Icon = STAGE_ICONS[position.stage]

  return (
    <span
      title={position.detail || STAGE_DETAIL[position.stage]}
      className={`inline-flex items-center gap-1.5 rounded-full border font-mono uppercase whitespace-nowrap ${STAGE_TINT[position.stage]} ${
        compact ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]'
      }`}
    >
      <Icon size={compact ? 10 : 12} />
      {compact ? STAGE_LABEL[position.stage] : position.label}
    </span>
  )
}

export function FlowStageChip({
  stage,
  active,
  count,
}: {
  stage: FulfillmentStage
  active?: boolean
  count?: number
}) {
  const Icon = STAGE_ICONS[stage]

  return (
    <div
      title={STAGE_DETAIL[stage]}
      className={`min-w-[98px] flex-1 rounded-lg border px-3 py-2 transition-all ${
        active
          ? `${STAGE_TINT[stage]} ring-1 ring-accent-amber/50`
          : 'bg-bg-primary border-border text-text-muted'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <Icon size={14} className={active ? '' : 'text-text-muted'} />
        {typeof count === 'number' && (
          <span className="font-mono text-[10px] text-text-muted">{count}</span>
        )}
      </div>
      <p className={`mt-1 font-mono text-[10px] uppercase ${active ? 'text-current' : 'text-text-muted'}`}>
        {STAGE_LABEL[stage]}
      </p>
    </div>
  )
}

export function FulfillmentFlowMap({
  active,
  counts,
  compact = false,
}: {
  active?: FulfillmentPosition
  counts?: Partial<Record<FulfillmentStage, number>>
  compact?: boolean
}) {
  return (
    <div className={`card-base ${compact ? 'p-4' : 'p-5'}`}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Wrench size={16} className="text-accent-amber" />
            <h2 className="font-mono text-sm font-bold text-text-primary uppercase tracking-wider">
              Fulfillment Flow
            </h2>
          </div>
          {!compact && (
            <p className="text-text-muted text-xs mt-1">
              Every admin item is located on one of these two routes.
            </p>
          )}
        </div>
        {active && <FlowPositionBadge position={active} />}
      </div>

      <div className="grid xl:grid-cols-2 gap-4">
        {(Object.keys(FLOW_LANES) as FulfillmentFlowKind[]).map((kind) => (
          <div key={kind} className="rounded-lg border border-border bg-bg-tertiary/30 p-3">
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="font-mono text-xs font-bold text-text-primary">{FLOW_KIND_LABEL[kind]}</p>
              <span className="text-[10px] font-mono uppercase text-text-muted">{FLOW_KIND_SHORT_LABEL[kind]}</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {FLOW_LANES[kind].map((stage) => {
                const isActive = active?.kind === kind && active.stage === stage
                return (
                  <FlowStageChip
                    key={`${kind}-${stage}`}
                    stage={stage}
                    active={isActive}
                    count={counts?.[stage]}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
