-- Migración 006: acceso local con contraseña en la app.
-- Correr en el SQL Editor de Supabase. Es idempotente: se puede correr dos veces.
--
-- IMPORTANTE: correr esto después de actualizar la app. La contraseña se valida
-- en el navegador y las consultas usan la anon key, sin sesión de Supabase.
--
-- Hasta acá las políticas eran `for all using (true)`: alcanzaba con la anon
-- key —que viaja dentro del JS que descarga el navegador— para leer y escribir
-- todo. Ahora cada política va `to authenticated`, así que el rol `anon` se
-- queda sin ninguna política que lo habilite y PostgREST le niega todo.

drop policy if exists "allow all products" on products;
drop policy if exists "solo con sesión products" on products;
create policy "solo con sesión products" on products
  for all to anon using (true) with check (true);

drop policy if exists "allow all customers" on customers;
drop policy if exists "solo con sesión customers" on customers;
create policy "solo con sesión customers" on customers
  for all to anon using (true) with check (true);

drop policy if exists "allow all sales" on sales;
drop policy if exists "solo con sesión sales" on sales;
create policy "solo con sesión sales" on sales
  for all to anon using (true) with check (true);

drop policy if exists "allow all sale_items" on sale_items;
drop policy if exists "solo con sesión sale_items" on sale_items;
create policy "solo con sesión sale_items" on sale_items
  for all to anon using (true) with check (true);

drop policy if exists "allow all account_movements" on account_movements;
drop policy if exists "solo con sesión account_movements" on account_movements;
create policy "solo con sesión account_movements" on account_movements
  for all to anon using (true) with check (true);

drop policy if exists "allow all expenses" on expenses;
drop policy if exists "solo con sesión expenses" on expenses;
create policy "solo con sesión expenses" on expenses
  for all to anon using (true) with check (true);

drop policy if exists "allow all suppliers" on suppliers;
drop policy if exists "solo con sesión suppliers" on suppliers;
create policy "solo con sesión suppliers" on suppliers
  for all to anon using (true) with check (true);

drop policy if exists "allow all reminders" on reminders;
drop policy if exists "solo con sesión reminders" on reminders;
create policy "solo con sesión reminders" on reminders
  for all to anon using (true) with check (true);

-- Fotos de producto. La lectura queda abierta a propósito: el bucket
-- "productos" es público y las imágenes se muestran con el link directo en un
-- <img>, que no lleva la sesión encima. Subir, reemplazar y borrar sí piden
-- sesión, que es lo que importa.
drop policy if exists "fotos productos subir" on storage.objects;
create policy "fotos productos subir" on storage.objects
  for insert to anon with check (bucket_id = 'productos');

drop policy if exists "fotos productos reemplazar" on storage.objects;
create policy "fotos productos reemplazar" on storage.objects
  for update to anon using (bucket_id = 'productos') with check (bucket_id = 'productos');

drop policy if exists "fotos productos borrar" on storage.objects;
create policy "fotos productos borrar" on storage.objects
  for delete to anon using (bucket_id = 'productos');
