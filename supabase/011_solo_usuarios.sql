-- Migración 011: la base sólo responde a usuarios que iniciaron sesión.
-- Correr DESPUÉS de publicar la versión de la app con usuarios (010) y de
-- haber entrado con alguno: desde acá, sin sesión no se lee ni se escribe nada.
-- Es idempotente: se puede correr dos veces.
--
-- Hasta acá las políticas eran `to public using (true)`: con la anon key, que
-- viaja dentro del JS publicado, cualquiera podía leer y escribir todo.

do $$
declare
  t text;
begin
  foreach t in array array[
    'products', 'customers', 'sales', 'sale_items', 'account_movements',
    'expenses', 'suppliers', 'reminders', 'supplier_products', 'purchase_invoices'
  ] loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "allow all %s" on %I', t, t);
    execute format('drop policy if exists "solo con sesión %s" on %I', t, t);
    execute format('drop policy if exists "usuarios %s" on %I', t, t);
    execute format(
      'create policy "usuarios %s" on %I for all to authenticated using (true) with check (true)',
      t, t
    );
  end loop;
end $$;

-- Fotos de producto: se siguen viendo con el link (el bucket es público),
-- pero subir, reemplazar y borrar pide sesión.
drop policy if exists "fotos productos subir" on storage.objects;
create policy "fotos productos subir" on storage.objects
  for insert to authenticated with check (bucket_id = 'productos');

drop policy if exists "fotos productos reemplazar" on storage.objects;
create policy "fotos productos reemplazar" on storage.objects
  for update to authenticated using (bucket_id = 'productos') with check (bucket_id = 'productos');

drop policy if exists "fotos productos borrar" on storage.objects;
create policy "fotos productos borrar" on storage.objects
  for delete to authenticated using (bucket_id = 'productos');
