-- ============================================================
-- Chat extras + admin tasks + voice rooms
-- Apply via Supabase Management API or paste into the SQL Editor.
-- ============================================================

-- ─── A. Attachments on chat messages ───
alter table admin_chat_messages
  add column if not exists attachments jsonb not null default '[]'::jsonb;

-- Storage bucket for chat files / images / voice notes
insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', true)
on conflict do nothing;

drop policy if exists "anon all on chat-attachments" on storage.objects;
create policy "anon all on chat-attachments"
  on storage.objects for all
  using (bucket_id = 'chat-attachments')
  with check (bucket_id = 'chat-attachments');

-- ─── C. Admin tasks ───
create table if not exists admin_tasks (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  description       text,
  assigned_to       text not null references admin_users(id) on delete cascade,
  assigned_by       text not null references admin_users(id),
  status            text not null default 'open' check (status in ('open','in_progress','done')),
  priority          text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  due_at            timestamptz,
  created_at        timestamptz not null default now(),
  completed_at      timestamptz,
  source_room_id    uuid references admin_chat_rooms(id) on delete set null,
  source_message_id uuid references admin_chat_messages(id) on delete set null
);

create index if not exists idx_admin_tasks_assignee on admin_tasks(assigned_to, status);
create index if not exists idx_admin_tasks_status on admin_tasks(status, created_at desc);

alter table admin_tasks enable row level security;
drop policy if exists "anon_all" on admin_tasks;
create policy "anon_all" on admin_tasks for all using (true) with check (true);

alter publication supabase_realtime add table admin_tasks;

-- ─── D. Voice room state (who's currently in voice for each chat room) ───
create table if not exists admin_voice_room_state (
  room_id    uuid not null references admin_chat_rooms(id) on delete cascade,
  user_id    text not null references admin_users(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  muted      boolean not null default false,
  primary key (room_id, user_id)
);

create index if not exists idx_voice_room_state_room on admin_voice_room_state(room_id);

alter table admin_voice_room_state enable row level security;
drop policy if exists "anon_all" on admin_voice_room_state;
create policy "anon_all" on admin_voice_room_state for all using (true) with check (true);

alter publication supabase_realtime add table admin_voice_room_state;
