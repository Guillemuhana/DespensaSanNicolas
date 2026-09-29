-- Migración 009: luz, gas, agua e internet como categorías de gasto propias.
-- Correr en el SQL Editor de Supabase. Es idempotente: se puede correr dos veces.

-- La lista de categorías vive en src/pages/Expenses.jsx; este check tiene que
-- aceptar las mismas o el alta del gasto falla. 'servicios' queda para lo
-- que no es ninguno de los de arriba (y para los gastos ya cargados).
alter table expenses drop constraint if exists expenses_category_check;
alter table expenses add constraint expenses_category_check
  check (category in (
    'mercaderia', 'frigorifico', 'alquiler', 'luz', 'gas', 'agua', 'internet',
    'impuestos', 'sueldos', 'servicios', 'otros'
  ));
