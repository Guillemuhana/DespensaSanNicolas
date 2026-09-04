-- Migración 005: categoría del producto.
-- Correr en el SQL Editor de Supabase. Es idempotente: se puede correr dos veces.

-- El rubro al que pertenece cada producto (termos, carteras, mochilas...).
-- Es texto libre y no una tabla aparte: la lista la fija la app en
-- src/lib/categories.js, igual que las categorías de gastos. Queda nullable
-- para que un producto viejo o cargado al vuelo no obligue a elegir.
alter table products
  add column if not exists category text;

-- El listado de stock filtra por rubro, y es la consulta más frecuente
-- después de la búsqueda por nombre.
create index if not exists idx_products_category on products(category);
