-- Migración 002: costos de compra y gastos del negocio.
-- Correr en el SQL Editor de Supabase. Es idempotente: se puede correr dos veces.

-- Precio al que SE COMPRA el producto. La ganancia es precio - costo.
alter table products
  add column if not exists cost numeric(12,2) not null default 0;

-- Congelamos el costo en el momento de la venta: si mañana cambia el costo de
-- compra, la ganancia histórica no se tiene que reescribir sola.
alter table sale_items
  add column if not exists unit_cost numeric(12,2) not null default 0;

-- Costo total de la venta, desnormalizado a propósito: permite calcular la
-- ganancia de un año entero con una consulta liviana, sin bajar al navegador
-- los miles de renglones de sale_items.
alter table sales
  add column if not exists cost_total numeric(12,2) not null default 0;

create index if not exists idx_sales_created_at on sales (created_at desc);

-- Gastos del negocio (alquiler, luz, proveedores, sueldos...).
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  category text not null default 'otros'
    check (category in ('mercaderia', 'alquiler', 'servicios', 'sueldos', 'impuestos', 'otros')),
  amount numeric(12,2) not null,
  spent_on date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists idx_expenses_spent_on on expenses (spent_on desc);

alter table expenses enable row level security;

-- Misma política abierta que el resto de las tablas (demo de un solo local).
drop policy if exists "allow all expenses" on expenses;
create policy "allow all expenses" on expenses for all using (true) with check (true);
