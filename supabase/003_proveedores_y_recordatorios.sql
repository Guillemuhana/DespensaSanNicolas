-- Migración 003: proveedores y recordatorios.
-- Correr en el SQL Editor de Supabase. Es idempotente: se puede correr dos veces.

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text,              -- con quién se habla
  phone text,
  email text,
  delivery_days text,        -- "Lunes y jueves", "1er martes del mes"...
  notes text,
  created_at timestamptz not null default now()
);

-- De quién se compra cada producto. On delete set null: si se borra el
-- proveedor no se pierden los productos, sólo quedan sin asignar.
alter table products
  add column if not exists supplier_id uuid references suppliers(id) on delete set null;

create index if not exists idx_products_supplier on products (supplier_id);

create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes text,
  kind text not null default 'otro'
    check (kind in ('pedido', 'pago', 'vencimiento', 'otro')),
  due_on date not null default current_date,
  done boolean not null default false,
  supplier_id uuid references suppliers(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_reminders_due on reminders (done, due_on);

alter table suppliers enable row level security;
alter table reminders enable row level security;

-- Misma política abierta que el resto de las tablas (demo de un solo local).
drop policy if exists "allow all suppliers" on suppliers;
create policy "allow all suppliers" on suppliers for all using (true) with check (true);

drop policy if exists "allow all reminders" on reminders;
create policy "allow all reminders" on reminders for all using (true) with check (true);
