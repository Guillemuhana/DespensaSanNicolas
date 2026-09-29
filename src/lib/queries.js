import { supabase } from './supabaseClient'
import { barcodeVariants } from './barcode'

/**
 * La migración 002 agrega costos de compra y gastos. Mientras no se haya
 * corrido, las columnas no existen y PostgREST rechaza cualquier escritura
 * que las mencione. Detectamos si ya está aplicada mirando lo que devuelve
 * `products` y adaptamos las escrituras; cuando se corra la migración, todo
 * se activa solo sin tocar código.
 */
export const schema = { costs: false, suppliers: false, photos: false }

/** Saca del payload las columnas que la base todavía no tiene. */
function knownColumns(payload) {
  const out = { ...payload }
  if (!schema.costs) delete out.cost
  if (!schema.suppliers) delete out.supplier_id
  if (!schema.photos) delete out.image_url
  return out
}

// Bucket de Storage donde viven las fotos de producto (migración 004).
const PHOTO_BUCKET = 'productos'

// ---------- Productos / stock ----------

export async function fetchProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  if (data.length > 0) {
    schema.costs = 'cost' in data[0]
    schema.suppliers = 'supplier_id' in data[0]
    schema.photos = 'image_url' in data[0]
  } else {
    // Con la tabla vacía no hay una fila de donde detectar las columnas.
    // Las migraciones instaladas son la fuente de verdad para el formulario.
    schema.photos = true
  }
  return data
}

/** Sube la foto ya achicada y devuelve el link público para guardar. */
export async function uploadProductPhoto(blob) {
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(name, blob, { contentType: 'image/jpeg', cacheControl: '31536000' })
  if (error) throw error
  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(name)
  return data.publicUrl
}

export async function findProductByBarcode(barcode) {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .in('barcode', barcodeVariants(barcode))
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createProduct(product) {
  const { data, error } = await supabase
    .from('products')
    .insert(knownColumns(product))
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateProduct(id, patch) {
  const { data, error } = await supabase
    .from('products')
    .update(knownColumns(patch))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteProduct(id) {
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw error
}

export async function adjustStock(productId, delta) {
  // delta negative = descuenta stock (venta), positivo = repone
  const { data: product, error: fetchErr } = await supabase
    .from('products')
    .select('stock')
    .eq('id', productId)
    .single()
  if (fetchErr) throw fetchErr
  const newStock = Number(product.stock) + delta
  const { error } = await supabase
    .from('products')
    .update({ stock: newStock })
    .eq('id', productId)
  if (error) throw error
  return newStock
}

// ---------- Clientes / cuenta corriente ----------

export async function fetchCustomers() {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return data
}

export async function createCustomer(customer) {
  const { data, error } = await supabase
    .from('customers')
    .insert(customer)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCustomer(id, changes) {
  const { data, error } = await supabase
    .from('customers')
    .update(changes)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// Cada cargo trae lo que se llevó en esa venta, para mostrarlo y mandárselo al
// cliente. sale_type viene del producto porque sale_items no lo guarda: sin él
// no se distingue 1 kg de 1 unidad.
export async function fetchAccountMovements(customerId) {
  const { data, error } = await supabase
    .from('account_movements')
    .select('*, sales(sale_items(product_name, quantity, subtotal, products(sale_type)))')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// Todos los movimientos, sin detalle: alcanza para saldos, desde cuándo debe
// cada uno y lo fiado/cobrado del mes.
export async function fetchAllAccountMovements() {
  const { data, error } = await supabase
    .from('account_movements')
    .select('customer_id, type, amount, note, created_at')
  if (error) throw error
  return data
}

export async function fetchAllBalances() {
  const { data, error } = await supabase
    .from('account_movements')
    .select('customer_id, type, amount')
  if (error) throw error
  const balances = {}
  for (const m of data) {
    const sign = m.type === 'charge' ? 1 : -1
    balances[m.customer_id] = (balances[m.customer_id] || 0) + sign * Number(m.amount)
  }
  return balances
}

export async function addAccountMovement(movement) {
  const { data, error } = await supabase
    .from('account_movements')
    .insert(movement)
    .select()
    .single()
  if (error) throw error
  return data
}

// ---------- Ventas ----------

export async function createSale({ items, paymentMethod, customerId, total, paidAmount, changeDue }) {
  const productIds = [...new Set(items.map((item) => item.id).filter(Boolean))]
  const { data: existingProducts, error: productsErr } = await supabase
    .from('products')
    .select('id, name')
    .in('id', productIds)
  if (productsErr) throw productsErr

  const existingIds = new Set(existingProducts.map((product) => product.id))
  const missingItem = items.find((item) => !existingIds.has(item.id))
  if (missingItem) {
    throw new Error(
      `El producto "${missingItem.name}" ya no existe en Stock. Quitalo del ticket y volvelo a cargar.`
    )
  }

  // Lo que costó comprar lo que se vendió: total - costTotal es la ganancia.
  const costTotal = items.reduce((s, it) => s + (Number(it.cost) || 0) * Number(it.quantity), 0)

  const { data: sale, error: saleErr } = await supabase
    .from('sales')
    .insert({
      customer_id: customerId || null,
      payment_method: paymentMethod,
      total,
      ...(schema.costs ? { cost_total: Number(costTotal.toFixed(2)) } : {}),
      paid_amount: paidAmount ?? null,
      change_due: changeDue ?? null,
    })
    .select()
    .single()
  if (saleErr) throw saleErr

  const saleItems = items.map((it) => ({
    sale_id: sale.id,
    product_id: it.id,
    product_name: it.name,
    quantity: it.quantity,
    unit_price: it.price,
    ...(schema.costs ? { unit_cost: Number(it.cost) || 0 } : {}),
    subtotal: it.subtotal,
  }))
  const { error: itemsErr } = await supabase.from('sale_items').insert(saleItems)
  if (itemsErr) throw itemsErr

  // descontar stock de cada producto
  for (const it of items) {
    await adjustStock(it.id, -it.quantity)
  }

  // si es fiado, registrar el movimiento de cuenta corriente
  if (paymentMethod === 'account' && customerId) {
    await addAccountMovement({
      customer_id: customerId,
      type: 'charge',
      amount: total,
      note: 'Venta a cuenta',
      sale_id: sale.id,
    })
  }

  return sale
}

export async function fetchRecentSales(limit = 20) {
  const { data, error } = await supabase
    .from('sales')
    .select('*, customers(name)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

// ---------- Estadísticas ----------

// Supabase corta las respuestas en 1000 filas, así que paginamos a mano.
async function fetchAllPages(build, pageSize = 1000) {
  const rows = []
  for (let page = 0; ; page++) {
    const { data, error } = await build().range(page * pageSize, (page + 1) * pageSize - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < pageSize) return rows
  }
}

export function fetchSalesSince(sinceIso) {
  return fetchAllPages(() =>
    supabase
      .from('sales')
      .select('*')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true })
  )
}

export function fetchSaleItemsSince(sinceIso) {
  return fetchAllPages(() =>
    supabase
      .from('sale_items')
      .select('*, sales!inner(created_at)')
      .gte('sales.created_at', sinceIso)
  )
}

// ---------- Gastos ----------

export async function fetchExpenses(sinceIso) {
  let q = supabase.from('expenses').select('*').order('spent_on', { ascending: false })
  if (sinceIso) q = q.gte('spent_on', sinceIso.slice(0, 10))
  const { data, error } = await q
  if (error) throw error
  return data
}

// Categorías que agrega la migración 009. Si todavía no se corrió, la base las
// rechaza: el gasto se guarda como "servicios" con el nombre adelante, así no
// se pierde nada.
const NEW_EXPENSE_CATEGORIES = { luz: 'Luz', gas: 'Gas', agua: 'Agua', internet: 'Internet' }

export async function createExpense(expense) {
  const { data, error } = await supabase.from('expenses').insert(expense).select().single()
  if (error?.code === '23514' && NEW_EXPENSE_CATEGORIES[expense.category]) {
    const label = NEW_EXPENSE_CATEGORIES[expense.category]
    const description = expense.description.toLowerCase().includes(label.toLowerCase())
      ? expense.description
      : `${label} · ${expense.description}`
    return createExpense({ ...expense, category: 'servicios', description })
  }
  if (error) throw error
  return data
}

export async function deleteExpense(id) {
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) throw error
}

// ---------- Proveedores ----------

export async function fetchSuppliers() {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return data
}

export async function createSupplier(supplier) {
  const { data, error } = await supabase.from('suppliers').insert(supplier).select().single()
  if (error) throw error
  return data
}

export async function updateSupplier(id, patch) {
  const { data, error } = await supabase
    .from('suppliers')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteSupplier(id) {
  const { error } = await supabase.from('suppliers').delete().eq('id', id)
  if (error) throw error
}

// ---------- Facturas de proveedor (migración 008) ----------

// Si la migración 008 todavía no se corrió, estas tablas no existen: la carga
// de facturas igual actualiza el stock, sólo que no aprende ni guarda historial.
function missingTable(error) {
  return error && (error.code === '42P01' || error.code === 'PGRST205' || error.code === '42703')
}

/** Lo aprendido de un proveedor: { match_key → { product_id, units_per_pack } }. */
export async function fetchSupplierProducts(supplierId) {
  if (!supplierId) return []
  const { data, error } = await supabase
    .from('supplier_products')
    .select('*')
    .eq('supplier_id', supplierId)
  if (missingTable(error)) return []
  if (error) throw error
  return data
}

export async function saveSupplierProducts(rows) {
  if (rows.length === 0) return
  const { error } = await supabase
    .from('supplier_products')
    .upsert(
      rows.map((r) => ({ ...r, updated_at: new Date().toISOString() })),
      { onConflict: 'supplier_id,match_key' }
    )
  if (missingTable(error)) return
  if (error) throw error
}

/** Una factura ya cargada con ese número, o null. */
export async function findPurchaseInvoice(supplierId, invoiceNumber) {
  if (!supplierId || !invoiceNumber) return null
  const { data, error } = await supabase
    .from('purchase_invoices')
    .select('id, created_at, total')
    .eq('supplier_id', supplierId)
    .eq('invoice_number', invoiceNumber)
    .limit(1)
    .maybeSingle()
  if (missingTable(error)) return null
  if (error) throw error
  return data
}

export async function createPurchaseInvoice(invoice) {
  const { error } = await supabase.from('purchase_invoices').insert(invoice)
  if (missingTable(error)) return
  if (error) throw error
}

/** Las últimas facturas cargadas, para mostrar en cada proveedor. */
export async function fetchRecentPurchaseInvoices(limit = 300) {
  const { data, error } = await supabase
    .from('purchase_invoices')
    .select('id, supplier_id, invoice_number, invoice_date, total, lines, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (missingTable(error)) return []
  if (error) throw error
  return data
}

/** Actualiza el proveedor sin romper si la columna cuit todavía no existe. */
export async function setSupplierCuit(id, cuit) {
  const { error } = await supabase.from('suppliers').update({ cuit }).eq('id', id)
  if (missingTable(error)) return
  if (error) throw error
}

// ---------- Recordatorios ----------

export async function fetchReminders() {
  const { data, error } = await supabase
    .from('reminders')
    .select('*, suppliers(name)')
    .order('due_on', { ascending: true })
  if (error) throw error
  return data
}

export async function createReminder(reminder) {
  const { data, error } = await supabase.from('reminders').insert(reminder).select().single()
  if (error) throw error
  return data
}

export async function setReminderDone(id, done) {
  const { error } = await supabase.from('reminders').update({ done }).eq('id', id)
  if (error) throw error
}

export async function deleteReminder(id) {
  const { error } = await supabase.from('reminders').delete().eq('id', id)
  if (error) throw error
}
