-- Migración 007: categoría de gasto "Frigorífico y carne".
-- Correr en el SQL Editor de Supabase. Es idempotente: se puede correr dos veces.

-- La carnicería le compra al frigorífico aparte del resto de la mercadería.
-- La lista de categorías vive en src/pages/Expenses.jsx; este check tiene que
-- aceptar las mismas o el alta del gasto falla.
alter table expenses drop constraint if exists expenses_category_check;
alter table expenses add constraint expenses_category_check
  check (category in ('mercaderia', 'frigorifico', 'alquiler', 'servicios', 'sueldos', 'impuestos', 'otros'));
