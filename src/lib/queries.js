import { supabase } from './supabaseClient'

/**
 * La migración 002 agrega costos de compra y gastos. Mientras no se haya
 * corrido, las columnas no existen y PostgREST rechaza cualquier escritura
 * que las mencione. Detectamos si ya está aplicada mirando lo que devuelve
 * `products` y adaptamos las escrituras; cuando se corra la migración, todo
 * se activa solo sin tocar código.
 */
export const schema = { costs: false, suppliers: false }

/** Saca del payload las columnas que la base todavía no tiene. */
function knownColumns(payload) {
  const out = { ...payload }
  if (!schema.costs) delete out.cost
  if (!schema.suppliers) delete out.supplier_id
  return out
}

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
  }
  return data
}

export async function findProductByBarcode(barcode) {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('barcode', barcode)
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

export async function fetchAccountMovements(customerId) {
  const { data, error } = await supabase
    .from('account_movements')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
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

export async function createExpense(expense) {
  const { data, error } = await supabase.from('expenses').insert(expense).select().single()
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
