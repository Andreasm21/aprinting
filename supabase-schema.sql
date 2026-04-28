-- ============================================================
-- Axiom 3D Printing — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- Idempotent: safe to re-run.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. CUSTOMERS  (backs src/stores/customersStore.ts)
-- ────────────────────────────────────────────────────────────
create table if not exists customers (
  id text primary key,
  account_type text not null default 'individual',
  name text not null,
  email text not null,
  phone text not null default '',
  company text,
  vat_number text,
  address text,
  city text,
  postal_code text,
  billing_address text,
  billing_city text,
  billing_postal_code text,
  payment_terms text default 'immediate',
  discount_tier text default 'none',
  notes text,
  tags jsonb default '[]'::jsonb,
  total_orders integer default 0,
  total_spent numeric(10,2) default 0,
  created_at timestamptz default now(),
  last_order_at timestamptz
);

-- ────────────────────────────────────────────────────────────
-- 2. DOCUMENTS — invoices + quotations  (backs src/stores/invoicesStore.ts)
-- ────────────────────────────────────────────────────────────
create table if not exists documents (
  id text primary key,
  type text not null,  -- 'invoice' or 'quotation'
  document_number text not null,
  date timestamptz not null,
  valid_until timestamptz,
  customer_id text references customers(id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  customer_company text,
  customer_vat_number text,
  billing_address text default '',
  billing_city text,
  billing_postal_code text,
  line_items jsonb not null default '[]'::jsonb,
  subtotal numeric(10,2) not null default 0,
  vat_rate numeric(5,4) not null default 0.19,
  vat_amount numeric(10,2) not null default 0,
  delivery_fee numeric(10,2) not null default 0,
  discount_percent numeric(5,2) not null default 0,
  discount_amount numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  payment_terms text,
  notes text,
  terms_and_conditions text,
  status text not null default 'draft',
  locked boolean default false,
  created_at timestamptz default now(),
  source_order_id text,
  source_part_request_id text
);

-- ────────────────────────────────────────────────────────────
-- 3. NOTIFICATIONS — orders, part requests, contacts
--    (backs src/stores/notificationsStore.ts)
-- ────────────────────────────────────────────────────────────
create table if not exists notifications (
  id text primary key,
  type text not null,  -- 'order', 'part_request', 'contact'
  date timestamptz default now(),
  read boolean default false,
  data jsonb not null default '{}'::jsonb
);

-- ────────────────────────────────────────────────────────────
-- 4. INVENTORY_PRODUCTS  (backs src/stores/inventoryStore.ts)
-- ────────────────────────────────────────────────────────────
create table if not exists inventory_products (
  id text primary key,
  part_number text not null,
  name text not null,
  category text not null,
  brand text,
  cost numeric(12,2) not null default 0,
  price numeric(12,2) not null default 0,
  reorder_level numeric(12,2) not null default 0,
  bin text,
  barcode text,
  supplier text,
  unit_weight_grams numeric(12,2),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- 5. STOCK_MOVEMENTS  (backs src/stores/inventoryStore.ts)
-- ────────────────────────────────────────────────────────────
create table if not exists stock_movements (
  id text primary key,
  product_id text not null,
  type text not null,  -- 'IN' | 'OUT' | 'ADJUST'
  qty numeric(12,2) not null default 0,
  unit_cost numeric(12,2) not null default 0,
  reference text,
  notes text,
  created_at timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- 6. PURCHASE_ORDERS  (backs src/stores/purchaseOrdersStore.ts)
--    Items embedded as JSONB — no separate po_items table.
-- ────────────────────────────────────────────────────────────
create table if not exists purchase_orders (
  id text primary key,
  po_number text not null,
  supplier text,
  tracking_number text,
  carrier text,
  status text not null default 'ordered',  -- 'ordered' | 'shipped' | 'received' | 'cancelled'
  items jsonb not null default '[]'::jsonb,
  ordered_at timestamptz not null,
  expected_at timestamptz,
  received_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- 7. CUSTOMER_ACTIVITIES  (backs src/stores/activitiesStore.ts)
-- ────────────────────────────────────────────────────────────
create table if not exists customer_activities (
  id text primary key,
  customer_id text not null,
  type text not null,  -- 'note' | 'call' | 'email' | 'meeting' | 'order' | 'invoice' | 'quotation' | 'status_change'
  title text not null,
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- 8. AUDIT_LOG  (backs src/stores/auditLogStore.ts)
-- ────────────────────────────────────────────────────────────
create table if not exists audit_log (
  id text primary key,
  action text not null,    -- 'create' | 'update' | 'delete' | 'status_change' | 'convert' | 'lock' | 'login' | 'reset'
  category text not null,  -- 'customer' | 'invoice' | 'quotation' | 'notification' | 'product' | 'content' | 'system'
  label text not null,
  detail text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  actor text,
  created_at timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- 9. ADMIN_USERS  (backs src/stores/adminAuthStore.ts)
-- ────────────────────────────────────────────────────────────
create table if not exists admin_users (
  id text primary key,
  username text not null unique,
  display_name text not null,
  email text,
  password_hash text not null,
  must_change_password boolean default false,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

-- ────────────────────────────────────────────────────────────
-- 10. PRINT_JOBS  (backs src/stores/printJobsStore.ts)
-- ────────────────────────────────────────────────────────────
create table if not exists print_jobs (
  id text primary key,
  customer_id text,
  document_id text,
  source text not null default 'manual',  -- 'manual' | 'quotation' | 'invoice' | 'order'
  description text not null,
  material text,
  weight_grams numeric(12,2),
  estimated_hours numeric(10,2),
  quantity integer not null default 1,
  priority text not null default 'normal',  -- 'low' | 'normal' | 'high' | 'urgent'
  position integer not null default 0,
  status text not null default 'queued',    -- 'queued' | 'printing' | 'paused' | 'completed' | 'failed' | 'cancelled'
  progress integer not null default 0,      -- 0-100
  started_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- 11. SITE_CONTENT — JSONB singleton (id = 'singleton')
--     (backs src/stores/contentStore.ts — site copy/pricing)
-- ────────────────────────────────────────────────────────────
create table if not exists site_content (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- 12. STOREFRONT_PRODUCTS  (backs src/stores/contentStore.ts — public catalog)
--     NB: integer id (not text) — comes from src/data/products.ts.
-- ────────────────────────────────────────────────────────────
create table if not exists storefront_products (
  id integer primary key,
  name text not null,
  name_gr text,
  category text not null,
  material text,
  price numeric(10,2) not null default 0,
  description text,
  description_gr text,
  badge text,
  in_stock boolean not null default true,
  model_url text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES — common lookup paths
-- ============================================================
create index if not exists idx_customers_email on customers(email);

create index if not exists idx_documents_type on documents(type);
create index if not exists idx_documents_status on documents(status);
create index if not exists idx_documents_customer_id on documents(customer_id);

create index if not exists idx_notifications_type on notifications(type);
create index if not exists idx_notifications_read on notifications(read);

create index if not exists idx_inventory_products_part_number on inventory_products(part_number);
create index if not exists idx_inventory_products_barcode on inventory_products(barcode);
create index if not exists idx_inventory_products_category on inventory_products(category);

create index if not exists idx_stock_movements_product_id on stock_movements(product_id);
create index if not exists idx_stock_movements_created_at on stock_movements(created_at desc);

create index if not exists idx_purchase_orders_status on purchase_orders(status);
create index if not exists idx_purchase_orders_ordered_at on purchase_orders(ordered_at desc);

create index if not exists idx_customer_activities_customer_id on customer_activities(customer_id);
create index if not exists idx_customer_activities_created_at on customer_activities(created_at desc);

create index if not exists idx_audit_log_category on audit_log(category);
create index if not exists idx_audit_log_action on audit_log(action);
create index if not exists idx_audit_log_created_at on audit_log(created_at desc);

create index if not exists idx_admin_users_username on admin_users(username);

create index if not exists idx_print_jobs_status on print_jobs(status);
create index if not exists idx_print_jobs_priority on print_jobs(priority);
create index if not exists idx_print_jobs_customer_id on print_jobs(customer_id);
create index if not exists idx_print_jobs_document_id on print_jobs(document_id);

create index if not exists idx_storefront_products_category on storefront_products(category);

-- ============================================================
-- ROW LEVEL SECURITY
-- App uses the anon key for everything → policies are open.
-- ============================================================
alter table customers              enable row level security;
alter table documents              enable row level security;
alter table notifications          enable row level security;
alter table inventory_products     enable row level security;
alter table stock_movements        enable row level security;
alter table purchase_orders        enable row level security;
alter table customer_activities    enable row level security;
alter table audit_log              enable row level security;
alter table admin_users            enable row level security;
alter table print_jobs             enable row level security;
alter table site_content           enable row level security;
alter table storefront_products    enable row level security;

-- Drop-then-create so the script is re-runnable without "policy already exists" errors.
drop policy if exists "anon_all" on customers;
create policy "anon_all" on customers for all using (true) with check (true);

drop policy if exists "anon_all" on documents;
create policy "anon_all" on documents for all using (true) with check (true);

drop policy if exists "anon_all" on notifications;
create policy "anon_all" on notifications for all using (true) with check (true);

drop policy if exists "anon_all" on inventory_products;
create policy "anon_all" on inventory_products for all using (true) with check (true);

drop policy if exists "anon_all" on stock_movements;
create policy "anon_all" on stock_movements for all using (true) with check (true);

drop policy if exists "anon_all" on purchase_orders;
create policy "anon_all" on purchase_orders for all using (true) with check (true);

drop policy if exists "anon_all" on customer_activities;
create policy "anon_all" on customer_activities for all using (true) with check (true);

drop policy if exists "anon_all" on audit_log;
create policy "anon_all" on audit_log for all using (true) with check (true);

drop policy if exists "anon_all" on admin_users;
create policy "anon_all" on admin_users for all using (true) with check (true);

drop policy if exists "anon_all" on print_jobs;
create policy "anon_all" on print_jobs for all using (true) with check (true);

drop policy if exists "anon_all" on site_content;
create policy "anon_all" on site_content for all using (true) with check (true);

drop policy if exists "anon_all" on storefront_products;
create policy "anon_all" on storefront_products for all using (true) with check (true);

-- ============================================================
-- 13. ADMIN_CHAT_*  (backs src/stores/adminChatStore.ts)
-- Channels + DMs, per-message read receipts, presence, typing, mentions.
-- Apply via supabase/migrations/20260428_admin_chat.sql in the SQL editor.
-- ============================================================
create table if not exists admin_chat_rooms (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('channel','dm')),
  name        text,
  topic       text,
  created_by  text not null references admin_users(id),
  created_at  timestamptz not null default now()
);

create table if not exists admin_chat_room_members (
  room_id     uuid references admin_chat_rooms(id) on delete cascade,
  user_id     text references admin_users(id)     on delete cascade,
  joined_at   timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists admin_chat_messages (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references admin_chat_rooms(id) on delete cascade,
  author_id   text not null references admin_users(id),
  body        text not null,
  mentions    text[] not null default '{}',
  reply_to_id uuid references admin_chat_messages(id),
  created_at  timestamptz not null default now()
);

create table if not exists admin_chat_message_reads (
  message_id  uuid references admin_chat_messages(id) on delete cascade,
  user_id     text references admin_users(id)         on delete cascade,
  read_at     timestamptz not null default now(),
  primary key (message_id, user_id)
);

create table if not exists admin_chat_room_state (
  room_id              uuid references admin_chat_rooms(id) on delete cascade,
  user_id              text references admin_users(id)     on delete cascade,
  last_read_message_id uuid references admin_chat_messages(id),
  muted_until          timestamptz,
  primary key (room_id, user_id)
);

create index if not exists idx_chat_messages_room_time on admin_chat_messages(room_id, created_at desc);
create index if not exists idx_chat_message_reads_user on admin_chat_message_reads(user_id);
create index if not exists idx_chat_room_members_user  on admin_chat_room_members(user_id);

alter table admin_chat_rooms          enable row level security;
alter table admin_chat_room_members   enable row level security;
alter table admin_chat_messages       enable row level security;
alter table admin_chat_message_reads  enable row level security;
alter table admin_chat_room_state     enable row level security;

drop policy if exists "anon_all" on admin_chat_rooms;
create policy "anon_all" on admin_chat_rooms          for all using (true) with check (true);
drop policy if exists "anon_all" on admin_chat_room_members;
create policy "anon_all" on admin_chat_room_members   for all using (true) with check (true);
drop policy if exists "anon_all" on admin_chat_messages;
create policy "anon_all" on admin_chat_messages       for all using (true) with check (true);
drop policy if exists "anon_all" on admin_chat_message_reads;
create policy "anon_all" on admin_chat_message_reads  for all using (true) with check (true);
drop policy if exists "anon_all" on admin_chat_room_state;
create policy "anon_all" on admin_chat_room_state     for all using (true) with check (true);
