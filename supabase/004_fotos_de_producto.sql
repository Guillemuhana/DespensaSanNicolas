-- Migración 004: foto del producto.
-- Correr en el SQL Editor de Supabase. Es idempotente: se puede correr dos veces.

-- La foto se guarda en Storage; en la tabla queda sólo el link.
alter table products
  add column if not exists image_url text;

-- Bucket público para las fotos de producto. Público significa que la imagen
-- se ve con el link directo, que es justo lo que necesita la app.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'productos',
  'productos',
  true,
  5242880, -- 5 MB: la app ya achica las fotos antes de subirlas
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Mismo criterio que el resto del esquema: acceso abierto con la anon key,
-- porque es un solo local con un solo usuario. Acotado a este bucket.
drop policy if exists "fotos productos ver" on storage.objects;
create policy "fotos productos ver" on storage.objects
  for select using (bucket_id = 'productos');

drop policy if exists "fotos productos subir" on storage.objects;
create policy "fotos productos subir" on storage.objects
  for insert with check (bucket_id = 'productos');

drop policy if exists "fotos productos reemplazar" on storage.objects;
create policy "fotos productos reemplazar" on storage.objects
  for update using (bucket_id = 'productos') with check (bucket_id = 'productos');

drop policy if exists "fotos productos borrar" on storage.objects;
create policy "fotos productos borrar" on storage.objects
  for delete using (bucket_id = 'productos');
