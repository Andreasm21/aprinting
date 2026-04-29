-- ============================================================
-- Admin mail client — shared team inbox
-- ============================================================

-- Per-admin rich-text signature, appended to outbound replies.
alter table admin_users add column if not exists email_signature_html text;

-- A conversation. Identity is the message-id chain (inReplyTo / references).
create table if not exists email_threads (
  id                  uuid primary key default gen_random_uuid(),
  subject             text not null,
  -- The "primary" external participant. We snapshot from the first message
  -- so threads remain identifiable even if the sender renames themselves.
  participant_email   text not null,
  participant_name    text,
  message_count       integer not null default 0,
  last_message_at     timestamptz not null default now(),
  unread_count        integer not null default 0,
  -- CRM auto-links — set on inbound parse, refreshed on each new message
  customer_id         text references customers(id) on delete set null,
  lead_id             uuid references leads(id) on delete set null,
  document_id         text,                 -- soft pointer (no FK, like leads.document_id)
  archived            boolean not null default false,
  created_at          timestamptz not null default now()
);

create index if not exists idx_email_threads_last_msg on email_threads(last_message_at desc);
create index if not exists idx_email_threads_archived on email_threads(archived) where archived = false;
create index if not exists idx_email_threads_email on email_threads(lower(participant_email));

-- One row per email (inbound or outbound).
create table if not exists email_messages (
  id                  uuid primary key default gen_random_uuid(),
  thread_id           uuid not null references email_threads(id) on delete cascade,
  direction           text not null check (direction in ('inbound','outbound')),
  -- For inbound: the customer's MIME message-id; for outbound: ours.
  message_id          text unique,
  in_reply_to         text,
  -- 'references' is a Postgres reserved word, so we postfix.
  reference_chain     text[],
  from_email          text not null,
  from_name           text,
  to_emails           text[] not null default '{}',
  cc_emails           text[] not null default '{}',
  bcc_emails          text[] not null default '{}',
  subject             text not null,
  body_text           text,
  body_html           text,
  -- For outbound: which admin sent it
  sent_by_admin_id    text references admin_users(id) on delete set null,
  read_at             timestamptz,    -- when an admin opened the thread
  created_at          timestamptz not null default now()
);

create index if not exists idx_email_messages_thread on email_messages(thread_id, created_at);
create index if not exists idx_email_messages_message_id on email_messages(message_id) where message_id is not null;

-- Attachments — stored in the existing chat-attachments bucket.
create table if not exists email_attachments (
  id            uuid primary key default gen_random_uuid(),
  message_id    uuid not null references email_messages(id) on delete cascade,
  filename      text not null,
  content_type  text not null,
  size          bigint not null,
  storage_path  text not null,
  url           text not null
);

create index if not exists idx_email_attachments_message on email_attachments(message_id);

-- Saved replies / templates.
create table if not exists email_templates (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  subject         text,                  -- optional override (otherwise reuses thread subject)
  body_html       text not null,
  -- Per-admin templates vs team-wide. NULL = available to everyone.
  scope_admin_id  text references admin_users(id) on delete cascade,
  created_by      text not null references admin_users(id),
  created_at      timestamptz not null default now()
);

create index if not exists idx_email_templates_scope on email_templates(scope_admin_id);

-- RLS — same permissive policy as other admin tables (app gates auth).
alter table email_threads      enable row level security;
alter table email_messages     enable row level security;
alter table email_attachments  enable row level security;
alter table email_templates    enable row level security;

drop policy if exists "anon_all" on email_threads;
create policy "anon_all" on email_threads      for all using (true) with check (true);
drop policy if exists "anon_all" on email_messages;
create policy "anon_all" on email_messages     for all using (true) with check (true);
drop policy if exists "anon_all" on email_attachments;
create policy "anon_all" on email_attachments  for all using (true) with check (true);
drop policy if exists "anon_all" on email_templates;
create policy "anon_all" on email_templates    for all using (true) with check (true);

alter publication supabase_realtime add table email_threads;
alter publication supabase_realtime add table email_messages;
