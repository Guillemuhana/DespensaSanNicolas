/**
 * Rubros de mercadería de la tienda.
 *
 * Van acá y no en una tabla porque son pocos, cambian poco, y es el mismo
 * criterio que las categorías de gastos en Expenses.jsx. Lo que se guarda en
 * products.category es el `id`; el `label` y el `group` son sólo para mostrar,
 * así que renombrar una etiqueta o mover un rubro de grupo no toca los datos.
 *
 * El `group` existe porque con 32 rubros un desplegable plano no se lee: los
 * selectores los muestran en <optgroup>. No es una segunda columna en la base
 * —el producto guarda el rubro y nada más—, así que reagrupar es editar este
 * archivo y listo.
 *
 * Agregar un rubro es sumar una línea. Borrar uno que ya tenga productos los
 * deja sin rubro, no los rompe: labelOf devuelve el id crudo si no lo encuentra.
 */

const BAZAR = 'Bazar y marroquinería'
const DEPORTIVA = 'Ropa deportiva'

export const CATEGORIES = [
  { id: 'termos', label: 'Termos', group: BAZAR },
  { id: 'vasos-termicos', label: 'Vasos térmicos', group: BAZAR },
  { id: 'mates', label: 'Mates', group: BAZAR },
  { id: 'equipos-mate', label: 'Equipos de mate por tres', group: BAZAR },
  { id: 'lentes', label: 'Lentes', group: BAZAR },
  { id: 'chau-latas', label: 'Chau latas', group: BAZAR },
  { id: 'billeteras', label: 'Billeteras', group: BAZAR },
  { id: 'sobres-fiesta', label: 'Sobres de fiesta', group: BAZAR },
  { id: 'carteras', label: 'Carteras', group: BAZAR },
  { id: 'bolsos', label: 'Bolsos', group: BAZAR },
  { id: 'rinoneras', label: 'Riñoneras', group: BAZAR },
  { id: 'mochilas', label: 'Mochilas', group: BAZAR },
  { id: 'porta-celulares', label: 'Porta celulares', group: BAZAR },
  { id: 'portacosmeticos', label: 'Portacosméticos', group: BAZAR },
  { id: 'mini-bags', label: 'Mini bags', group: BAZAR },

  { id: 'tops', label: 'Tops', group: DEPORTIVA },
  { id: 'conjuntos', label: 'Conjuntos', group: DEPORTIVA },
  { id: 'calzas-largas', label: 'Calzas largas', group: DEPORTIVA },
  { id: 'calzas-cortas', label: 'Calzas cortas', group: DEPORTIVA },
  { id: 'remeras', label: 'Remeras', group: DEPORTIVA },
  { id: 'medias', label: 'Medias', group: DEPORTIVA },
  { id: 'vestidos-deportivos', label: 'Vestidos deportivos', group: DEPORTIVA },
  { id: 'camperas', label: 'Camperas', group: DEPORTIVA },
  { id: 'camisetas', label: 'Camisetas', group: DEPORTIVA },
  { id: 'catsuits', label: 'Catsuits', group: DEPORTIVA },
  { id: 'zapatillas', label: 'Zapatillas', group: DEPORTIVA },
  { id: 'bombachas', label: 'Bombachas', group: DEPORTIVA },
  { id: 'sudaderas', label: 'Sudaderas', group: DEPORTIVA },
  { id: 'musculosas', label: 'Musculosas', group: DEPORTIVA },
  { id: 'outlet', label: 'Outlet', group: DEPORTIVA },
  { id: 'accesorios', label: 'Accesorios', group: DEPORTIVA },
  { id: 'complementos', label: 'Complementos', group: DEPORTIVA },
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
