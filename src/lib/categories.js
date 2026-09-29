/**
 * Rubros de mercadería del minimercado y la carnicería.
 *
 * Van acá y no en una tabla porque son pocos, cambian poco, y es el mismo
 * criterio que las categorías de gastos en Expenses.jsx. Lo que se guarda en
 * products.category es el `id`; el `label` y el `group` son sólo para mostrar,
 * así que renombrar una etiqueta o mover un rubro de grupo no toca los datos.
 *
 * El `group` existe porque con 28 rubros un desplegable plano no se lee: los
 * selectores los muestran en <optgroup>. No es una segunda columna en la base
 * —el producto guarda el rubro y nada más—, así que reagrupar es editar este
 * archivo y listo.
 *
 * Agregar un rubro es sumar una línea. Borrar uno que ya tenga productos los
 * deja sin rubro, no los rompe: labelOf devuelve el id crudo si no lo encuentra.
 */

const ALMACEN = 'Almacén'
const BEBIDAS = 'Bebidas'
const FRESCOS = 'Frescos'
const CARNICERIA = 'Carnicería'
const LIMPIEZA = 'Limpieza y perfumería'

export const CATEGORIES = [
  { id: 'almacen', label: 'Almacén seco', group: ALMACEN },
  { id: 'fideos-arroz', label: 'Fideos, arroz y legumbres', group: ALMACEN },
  { id: 'yerba-infusiones', label: 'Yerba, café e infusiones', group: ALMACEN },
  { id: 'aceites-condimentos', label: 'Aceites y condimentos', group: ALMACEN },
  { id: 'conservas', label: 'Conservas y enlatados', group: ALMACEN },
  { id: 'galletitas-golosinas', label: 'Galletitas y golosinas', group: ALMACEN },
  { id: 'snacks', label: 'Snacks', group: ALMACEN },
  { id: 'panificados', label: 'Panificados', group: ALMACEN },

  { id: 'gaseosas', label: 'Gaseosas y aguas', group: BEBIDAS },
  { id: 'jugos', label: 'Jugos', group: BEBIDAS },
  { id: 'cervezas', label: 'Cervezas', group: BEBIDAS },
  { id: 'vinos', label: 'Vinos y aperitivos', group: BEBIDAS },

  { id: 'lacteos', label: 'Lácteos', group: FRESCOS },
  { id: 'fiambres', label: 'Fiambres', group: FRESCOS },
  { id: 'quesos', label: 'Quesos', group: FRESCOS },
  { id: 'verduleria', label: 'Frutas y verduras', group: FRESCOS },
  { id: 'huevos', label: 'Huevos', group: FRESCOS },
  { id: 'congelados', label: 'Congelados', group: FRESCOS },

  { id: 'vacuno', label: 'Vacuno', group: CARNICERIA },
  { id: 'cerdo', label: 'Cerdo', group: CARNICERIA },
  { id: 'pollo', label: 'Pollo', group: CARNICERIA },
  { id: 'achuras', label: 'Achuras', group: CARNICERIA },
  { id: 'embutidos', label: 'Chorizos y embutidos', group: CARNICERIA },
  { id: 'elaborados', label: 'Milanesas y elaborados', group: CARNICERIA },
  { id: 'picadas', label: 'Carne picada', group: CARNICERIA },

  { id: 'limpieza', label: 'Limpieza', group: LIMPIEZA },
  { id: 'perfumeria', label: 'Higiene y perfumería', group: LIMPIEZA },
  { id: 'descartables', label: 'Descartables y bazar', group: LIMPIEZA },
]

/** Los grupos en el orden en que aparecen arriba, con sus rubros adentro. */
export const GROUPED = CATEGORIES.reduce((acc, c) => {
  const g = acc.find((x) => x.group === c.group)
  if (g) g.items.push(c)
  else acc.push({ group: c.group, items: [c] })
  return acc
}, [])

/** Etiqueta para mostrar. Si el rubro ya no está en la lista, cae al id. */
export const labelOf = (id) => CATEGORIES.find((c) => c.id === id)?.label ?? id

/** Los rubros de la carnicería, que tiene su propia sección en el menú. */
export const BUTCHER_CATEGORIES = CATEGORIES.filter((c) => c.group === CARNICERIA)

export const BUTCHER_FILTER = 'group:carniceria'
export const isButcherCategory = (id) =>
  CATEGORIES.some((c) => c.id === id && c.group === CARNICERIA)

export const matchesCategory = (category, filter) =>
  !filter || (filter === BUTCHER_FILTER ? isButcherCategory(category) : category === filter)
