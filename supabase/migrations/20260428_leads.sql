-- ============================================================
-- Leads & potential leads — warm pipeline between intake and customers
-- ============================================================

create table if not exists leads (
  id                   uuid primary key default gen_random_uuid(),
  status               text not null default 'potential'
                       check (status in ('potential','working','quoted','won','lost')),

  -- Contact info (denormalised so list views don't need joins)
  name                 text not null,
  email                text,
  phone                text,
  company              text,

  -- Where it came from
  source               text not null
                       check (source in ('chat','part_request','contact','quote',
                                         'manual','phone','email','meeting','other')),
  source_id            text,            -- references the originating row id (varies by source)
  source_label         text,            -- short summary for tooltip ("First message: …")

  -- CRM fields
  assigned_admin_id    text references admin_users(id) on delete set null,
  notes                text,
  tags                 text[] not null default '{}',

  -- Conversion / quotation linkage
  customer_id          text references customers(id) on delete set null,
  document_id          text references documents(id) on delete set null,

  -- Lifecycle
  estimated_value_eur  numeric(10,2),
  next_followup_at     timestamptz,
  created_at           timestamptz not null default now(),
  last_activity_at     timestamptz not null default now(),
  closed_at            timestamptz,
  closed_reason        text
);

create index if not exists idx_leads_status_activity
  on leads(status, last_activity_at desc);
create index if not exists idx_leads_email
  on leads(lower(email));
create index if not exists idx_leads_assigned
  on leads(assigned_admin_id) where assigned_admin_id is not null;
create index if not exists idx_leads_followup
  on leads(next_followup_at) where next_followup_at is not null;

-- Activity timeline — append-only audit log
create table if not exists lead_events (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references leads(id) on delete cascade,
  kind          text not null
                check (kind in ('created','contacted','note','status_change',
                                'quote_sent','quote_accepted','converted',
                                'reassigned','followup_set','tag_added','source_added')),
  by_admin_id   text references admin_users(id) on delete set null,
  body          text,
  data          jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists idx_lead_events_lead
  on lead_events(lead_id, created_at desc);

-- RLS — same permissive policy as other admin tables (app gates auth)
alter table leads        enable row level security;
alter table lead_events  enable row level security;

drop policy if exists "anon_all" on leads;
create policy "anon_all" on leads        for all using (true) with check (true);
drop policy if exists "anon_all" on lead_events;
create policy "anon_all" on lead_events  for all using (true) with check (true);

alter publication supabase_realtime add table leads;
alter publication supabase_realtime add table lead_events;
