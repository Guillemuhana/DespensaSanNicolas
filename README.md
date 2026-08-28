# Despensa San Nicolás

App de punto de venta para un negocio de despensa: facturación con código de
barras, control de stock (incluye productos por peso) y cuentas corrientes.

## Cómo funciona lo de "por peso"

Al escanear un producto marcado como "peso", en vez de pedir los kilos la app
pide el monto vendido en pesos. Con el precio por kilo cargado, calcula sola
cuántos kilos fueron y descuenta esa cantidad del stock.

## Configuración

1. Creá un proyecto en supabase.com.
2. Corré el script `supabase/schema.sql` en el SQL Editor de ese proyecto
   (crea las tablas y carga 5 productos de ejemplo) y después las migraciones
   `002`, `003` y `004` del mismo directorio, en ese orden. La `004` agrega la
   foto del producto y crea el bucket de Storage donde se guardan.
3. Copiá `.env.example` a `.env` y completá con los datos de tu proyecto
   (Project Settings → API):
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```
4. npm install
5. npm run dev

## Deploy

Desplegado con Vercel. Las mismas dos variables de entorno
(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) hay que cargarlas en
Project Settings → Environment Variables de Vercel.

## Escaneo de códigos

Un lector de códigos de barras (USB o Bluetooth) se comporta como un teclado:
no hay que configurar nada. La app escucha el lector en toda la pantalla de
Facturación, así que funciona aunque el foco no esté en el buscador — distingue
al lector de una persona por la velocidad entre teclas.

También se puede escanear con la cámara del celular, tanto para vender como
para cargar el código de un producto nuevo en Stock. Donde el navegador ya trae
lector de códigos (Chrome en Android) se usa ese; si no, se carga ZXing recién
al abrir la cámara. Requiere https, o sea la app publicada, no `npm run dev`.

## En el celular

Todas las pantallas son responsive. En mobile el menú es un cajón lateral, el
ticket se ve completo arriba del botón "Cobrar" (que queda fijo al pie), y la
lista de stock se muestra como tarjetas en vez de tabla. En escritorio el menú
lateral se pliega a íconos y recuerda la preferencia.

## Pantallas

- Facturación: escaneo/búsqueda de productos, ticket en vivo, cobro en
  efectivo (con cálculo de vuelto) o a cuenta corriente.
- Stock: alta, edición y baja de productos; foto del producto sacada con la
  cámara, códigos internos para lo que no trae código de barras y aviso de
  stock bajo.
- Cuentas corrientes: saldo por cliente, historial de cargos y pagos.
