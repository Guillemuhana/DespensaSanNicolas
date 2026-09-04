-- Esquema para la app de despensa
-- Ejecutar como migración en el proyecto Supabase cuando esté creado.
-- Es idempotente: se puede correr dos veces sin romper nada.

create extension if not exists "pgcrypto";

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  barcode text unique,
  sale_type text not null default 'unit' check (sale_type in ('unit', 'weight')),
  -- 'unit': price is per unit, stock is a count
  -- 'weight': price is per kg, stock is in kg (grams internally not required, we use kg as float)
  price numeric(12,2) not null default 0,
  stock numeric(12,3) not null default 0,
  min_stock numeric(12,3) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  payment_method text not null check (payment_method in ('cash', 'account')),
  total numeric(12,2) not null default 0,
  paid_amount numeric(12,2),
  change_due numeric(12,2),
  created_at timestamptz not null default now()
);

create table if not exists sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  product_id uuid references products(id),
  product_name text not null,
  quantity numeric(12,3) not null,
  unit_price numeric(12,2) not null,
  subtotal numeric(12,2) not null
);

create table if not exists account_movements (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  type text not null check (type in ('charge', 'payment')),
  amount numeric(12,2) not null,
  note text,
  sale_id uuid references sales(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_products_barcode on products(barcode);
create index if not exists idx_sale_items_sale on sale_items(sale_id);
create index if not exists idx_movements_customer on account_movements(customer_id);

alter table products enable row level security;
alter table customers enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table account_movements enable row level security;

-- Política simple: acceso abierto con la anon key (app de un solo local / un solo usuario).
-- Si mañana hay varios locales o usuarios, reemplazar por políticas con auth.uid().
drop policy if exists "allow all products" on products;
create policy "allow all products" on products for all using (true) with check (true);
drop policy if exists "allow all customers" on customers;
create policy "allow all customers" on customers for all using (true) with check (true);
drop policy if exists "allow all sales" on sales;
create policy "allow all sales" on sales for all using (true) with check (true);
drop policy if exists "allow all sale_items" on sale_items;
create policy "allow all sale_items" on sale_items for all using (true) with check (true);
drop policy if exists "allow all account_movements" on account_movements;
create policy "allow all account_movements" on account_movements for all using (true) with check (true);

