-- ============================================================
-- Client (visitor) → admin live chat
-- Apply via Supabase Management API or paste into the SQL Editor.
-- ============================================================

-- One thread per visitor session. visitor_id is a UUID kept in the
-- visitor's localStorage so they reconnect to the same thread on reload.
create table if not exists client_chat_threads (
  id                  uuid primary key default gen_random_uuid(),
  visitor_id          text not null,
  visitor_name        text not null,
  visitor_email       text not null,
  status              text not null default 'open' check (status in ('open','closed')),
  assigned_admin_id   text references admin_users(id) on delete set null,
  created_at          timestamptz not null default now(),
  last_message_at     timestamptz not null default now(),
  last_email_sent_at  timestamptz                   -- debounce window
);

create index if not exists idx_client_chat_threads_status_time
  on client_chat_threads(status, last_message_at desc);
create index if not exists idx_client_chat_threads_visitor
  on client_chat_threads(visitor_id);

create table if not exists client_chat_messages (
  id           uuid primary key default gen_random_uuid(),
  thread_id    uuid not null references client_chat_threads(id) on delete cascade,
  author_kind  text not null check (author_kind in ('visitor','admin','system')),
  author_id    text references admin_users(id) on delete set null,
  body         text not null,
  created_at   timestamptz not null default now(),
  read_at      timestamptz                          -- when the OTHER side read it
);

create index if not exists idx_client_chat_messages_thread_time
  on client_chat_messages(thread_id, created_at);

alter table client_chat_threads  enable row level security;
alter table client_chat_messages enable row level security;

drop policy if exists "anon_all" on client_chat_threads;
create policy "anon_all" on client_chat_threads  for all using (true) with check (true);
drop policy if exists "anon_all" on client_chat_messages;
create policy "anon_all" on client_chat_messages for all using (true) with check (true);

alter publication supabase_realtime add table client_chat_threads;
alter publication supabase_realtime add table client_chat_messages;
