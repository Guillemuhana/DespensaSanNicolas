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
   (crea las tablas y carga 5 productos de ejemplo).
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

## Pantallas

- Facturación: escaneo/búsqueda de productos, ticket en vivo, cobro en
  efectivo (con cálculo de vuelto) o a cuenta corriente.
- Stock: alta, edición y baja de productos; aviso de stock bajo.
- Cuentas corrientes: saldo por cliente, historial de cargos y pagos.
