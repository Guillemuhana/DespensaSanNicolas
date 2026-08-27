import { supabase } from './supabaseClient'

// ---------- Productos / stock ----------

export async function fetchProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
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
    .insert(product)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateProduct(id, patch) {
  const { data, error } = await supabase
    .from('products')
    .update(patch)
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
  const { data: sale, error: saleErr } = await supabase
    .from('sales')
    .insert({
      customer_id: customerId || null,
      payment_method: paymentMethod,
      total,
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
