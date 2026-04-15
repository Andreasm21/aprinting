-- ============================================================
-- Axiom 3D Printing — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. CUSTOMERS
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

-- 2. DOCUMENTS (invoices + quotations)
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

-- 3. NOTIFICATIONS (orders, part requests, contacts)
create table if not exists notifications (
  id text primary key,
  type text not null,  -- 'order', 'part_request', 'contact'
  date timestamptz default now(),
  read boolean default false,
  data jsonb not null default '{}'::jsonb
);

-- Indexes for common queries
create index if not exists idx_documents_type on documents(type);
create index if not exists idx_documents_status on documents(status);
create index if not exists idx_notifications_type on notifications(type);
create index if not exists idx_notifications_read on notifications(read);
create index if not exists idx_customers_email on customers(email);

-- Enable Row Level Security (but allow all for now via anon key)
alter table customers enable row level security;
alter table documents enable row level security;
alter table notifications enable row level security;

-- Policies: allow full access for authenticated/anon users
-- (In production you'd restrict this, but for a single-admin app this is fine)
create policy "Allow all on customers" on customers for all using (true) with check (true);
create policy "Allow all on documents" on documents for all using (true) with check (true);
create policy "Allow all on notifications" on notifications for all using (true) with check (true);
