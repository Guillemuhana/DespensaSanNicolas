-- Migración 008: carga de facturas de proveedor (foto o PDF).
-- Correr en el SQL Editor de Supabase. Es idempotente: se puede correr dos veces.

-- El CUIT es lo que identifica al proveedor en la factura, aunque el nombre
-- de fantasía no coincida con la razón social.
alter table suppliers
  add column if not exists cuit text;

create index if not exists idx_suppliers_cuit on suppliers (cuit);

-- Lo que la app aprende al confirmar una factura: "este renglón de este
-- proveedor es este producto". `match_key` es el código del proveedor si
-- figura, o la descripción normalizada. La próxima factura sale sola.
create table if not exists supplier_products (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  match_key text not null,
  description text,
  units_per_pack numeric(12,3) not null default 1,
  updated_at timestamptz not null default now(),
  unique (supplier_id, match_key)
);

create index if not exists idx_supplier_products_supplier on supplier_products (supplier_id);

-- Historial de facturas cargadas: sirve para ver qué entró y para avisar si
-- la misma factura se quiere cargar dos veces.
create table if not exists purchase_invoices (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references suppliers(id) on delete set null,
  invoice_number text,
  invoice_date date,
  total numeric(12,2),
  lines jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_purchase_invoices_supplier
  on purchase_invoices (supplier_id, invoice_number);

alter table supplier_products enable row level security;
alter table purchase_invoices enable row level security;

-- Misma política que el resto de las tablas (ver 006).
drop policy if exists "solo con sesión supplier_products" on supplier_products;
create policy "solo con sesión supplier_products" on supplier_products
  for all to public using (true) with check (true);

drop policy if exists "solo con sesión purchase_invoices" on purchase_invoices;
create policy "solo con sesión purchase_invoices" on purchase_invoices
  for all to public using (true) with check (true);
