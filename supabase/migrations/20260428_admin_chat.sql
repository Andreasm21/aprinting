-- ============================================================
-- Admin chat (channels + DMs)
-- Apply this in the Supabase SQL Editor for project uohmzjdcrwwnzsoevbpf.
-- It is also documented at the bottom of supabase-schema.sql.
-- ============================================================

-- ROOMS ------------------------------------------------------
create table if not exists admin_chat_rooms (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('channel','dm')),
  name        text,                                    -- channels only
  topic       text,                                    -- channels only
  created_by  text not null references admin_users(id),
  created_at  timestamptz not null default now()
);

-- ROOM MEMBERSHIP --------------------------------------------
create table if not exists admin_chat_room_members (
  room_id     uuid references admin_chat_rooms(id) on delete cascade,
  user_id     text references admin_users(id)     on delete cascade,
  joined_at   timestamptz not null default now(),
  primary key (room_id, user_id)
);

-- MESSAGES ---------------------------------------------------
create table if not exists admin_chat_messages (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references admin_chat_rooms(id) on delete cascade,
  author_id   text not null references admin_users(id),
  body        text not null,
  mentions    text[] not null default '{}',           -- array of admin_user IDs
  reply_to_id uuid references admin_chat_messages(id),
  created_at  timestamptz not null default now()
);

-- READ RECEIPTS (per-message, per-user) ----------------------
create table if not exists admin_chat_message_reads (
  message_id  uuid references admin_chat_messages(id) on delete cascade,
  user_id     text references admin_users(id)         on delete cascade,
  read_at     timestamptz not null default now(),
  primary key (message_id, user_id)
);

-- PER-USER ROOM STATE (last-read pointer + mute) -------------
create table if not exists admin_chat_room_state (
  room_id              uuid references admin_chat_rooms(id) on delete cascade,
  user_id              text references admin_users(id)     on delete cascade,
  last_read_message_id uuid references admin_chat_messages(id),
  muted_until          timestamptz,
  primary key (room_id, user_id)
);

-- INDEXES ----------------------------------------------------
create index if not exists idx_chat_messages_room_time
  on admin_chat_messages(room_id, created_at desc);
create index if not exists idx_chat_message_reads_user
  on admin_chat_message_reads(user_id);
create index if not exists idx_chat_room_members_user
  on admin_chat_room_members(user_id);

-- SEED -------------------------------------------------------
-- One #general channel that every existing admin auto-joins.
-- Safe to re-run: skips if a 'general' channel already exists.
insert into admin_chat_rooms (kind, name, topic, created_by)
select 'channel', 'general', 'Studio-wide chat', id
from admin_users
where not exists (
  select 1 from admin_chat_rooms where kind = 'channel' and name = 'general'
)
limit 1;

insert into admin_chat_room_members (room_id, user_id)
select r.id, u.id
from admin_chat_rooms r
cross join admin_users u
where r.kind = 'channel' and r.name = 'general'
on conflict do nothing;

-- REALTIME ---------------------------------------------------
-- Make sure these tables broadcast postgres_changes on the realtime channel.
alter publication supabase_realtime add table admin_chat_messages;
alter publication supabase_realtime add table admin_chat_message_reads;
alter publication supabase_realtime add table admin_chat_room_members;

-- RLS (matches the rest of the admin tables: app gates auth via bcrypt session) --
alter table admin_chat_rooms          enable row level security;
alter table admin_chat_room_members   enable row level security;
alter table admin_chat_messages       enable row level security;
alter table admin_chat_message_reads  enable row level security;
alter table admin_chat_room_state     enable row level security;

create policy "anon all on admin_chat_rooms"          on admin_chat_rooms          for all using (true) with check (true);
create policy "anon all on admin_chat_room_members"   on admin_chat_room_members   for all using (true) with check (true);
create policy "anon all on admin_chat_messages"       on admin_chat_messages       for all using (true) with check (true);
create policy "anon all on admin_chat_message_reads"  on admin_chat_message_reads  for all using (true) with check (true);
create policy "anon all on admin_chat_room_state"     on admin_chat_room_state     for all using (true) with check (true);
