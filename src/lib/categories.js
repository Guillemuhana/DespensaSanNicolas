/**
 * Rubros de mercadería de la tienda.
 *
 * Van acá y no en una tabla porque son pocos y cambian poco, el mismo criterio
 * que las categorías de gastos en Expenses.jsx. Lo que se guarda en
 * products.category es el `id`; el `label` es sólo para mostrar, así que
 * renombrar una etiqueta no toca los datos. Agregar un rubro es sumar una
 * línea acá; borrar uno que ya tenga productos los deja sin rubro, no los
 * rompe (labelOf devuelve el id crudo si no lo encuentra).
 */
export const CATEGORIES = [
  { id: 'termos', label: 'Termos' },
  { id: 'vasos-termicos', label: 'Vasos térmicos' },
  { id: 'mates', label: 'Mates' },
  { id: 'equipos-mate', label: 'Equipos de mate por tres' },
  { id: 'lentes', label: 'Lentes' },
  { id: 'chau-latas', label: 'Chau latas' },
  { id: 'billeteras', label: 'Billeteras' },
  { id: 'sobres-fiesta', label: 'Sobres de fiesta' },
  { id: 'carteras', label: 'Carteras' },
  { id: 'bolsos', label: 'Bolsos' },
  { id: 'rinoneras', label: 'Riñoneras' },
  { id: 'mochilas', label: 'Mochilas' },
  { id: 'porta-celulares', label: 'Porta celulares' },
  { id: 'portacosmeticos', label: 'Portacosméticos' },
  { id: 'mini-bags', label: 'Mini bags' },
]

/** Etiqueta para mostrar. Si el rubro ya no está en la lista, cae al id. */
export const labelOf = (id) => CATEGORIES.find((c) => c.id === id)?.label ?? id
