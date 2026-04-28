-- ============================================================
-- Admin file manager (shared internal drive)
-- Apply via Supabase Management API or paste into the SQL Editor.
-- ============================================================

-- Files + folders are unified — folders are rows with is_folder=true and
-- no storage_path. Hierarchy via parent_id (null = root).
create table if not exists admin_files (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  storage_path  text,                              -- null for folders
  size          bigint not null default 0,
  mime          text not null default '',
  parent_id     uuid references admin_files(id) on delete cascade,
  is_folder     boolean not null default false,
  uploaded_by   text not null references admin_users(id),
  uploaded_at   timestamptz not null default now()
);

create index if not exists idx_admin_files_parent on admin_files(parent_id);
create index if not exists idx_admin_files_uploader on admin_files(uploaded_by);

alter table admin_files enable row level security;
drop policy if exists "anon_all" on admin_files;
create policy "anon_all" on admin_files for all using (true) with check (true);

alter publication supabase_realtime add table admin_files;

-- Storage bucket for actual file bytes
insert into storage.buckets (id, name, public)
values ('admin-files', 'admin-files', true)
on conflict do nothing;

drop policy if exists "anon all on admin-files" on storage.objects;
create policy "anon all on admin-files"
  on storage.objects for all
  using (bucket_id = 'admin-files')
  with check (bucket_id = 'admin-files');
