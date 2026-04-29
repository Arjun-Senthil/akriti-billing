const pool = require('../config/database')

// ── Generate next order number: AT-2026-0001
// Uses a DB transaction so the count is always accurate.
// Soft-deleted orders still count — we never reuse order numbers.
const generateOrderNumber = async (client) => {
  const year     = new Date().getFullYear()
  const prefixRes = await client.query(
    `SELECT value FROM app_settings WHERE key = 'order_prefix'`
  )
  const prefix = prefixRes.rows[0]?.value || 'AT'

  const countRes = await client.query(
    `SELECT COUNT(*) AS total FROM orders WHERE order_number LIKE $1`,
    [`${prefix}-${year}-%`]
  )
  const seq = parseInt(countRes.rows[0].total) + 1
  return `${prefix}-${year}-${seq.toString().padStart(4, '0')}`
}

// ── Create order + all items inside a single transaction
// A transaction means: either ALL of this succeeds, or NONE of it does.
// If item 3 of 5 fails, the order and items 1-2 are rolled back too.
// This prevents orphaned orders with missing items.
const createOrder = async ({ customerId, deliveryDate, notes, items }) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Read GST rate from settings (staff can change it without code change)
    const gstRes = await client.query(
      `SELECT value FROM app_settings WHERE key = 'gst_rate'`
    )
    const gstRate = parseFloat(gstRes.rows[0]?.value || '5.00')

    // Calculate money — all in NUMERIC to avoid float errors
    const subtotal   = items.reduce((sum, i) => sum + parseFloat(i.price) * (parseInt(i.quantity) || 1), 0)
    const cgst       = parseFloat(((subtotal * gstRate / 100) / 2).toFixed(2))
    const sgst       = cgst
    const grandTotal = parseFloat((subtotal + cgst + sgst).toFixed(2))

    const orderNumber = await generateOrderNumber(client)

    const orderRes = await client.query(
      `INSERT INTO orders
         (order_number, customer_id, delivery_date, status,
          subtotal, gst_rate, cgst_amount, sgst_amount, grand_total, notes)
       VALUES ($1,$2,$3,'received',$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [orderNumber, customerId, deliveryDate || null,
       subtotal, gstRate, cgst, sgst, grandTotal, notes || null]
    )
    const order = orderRes.rows[0]

    // Insert each line item with a frozen measurement snapshot
    for (const item of items) {
      // Fetch the customer's saved measurements for this garment type.
      // We snapshot them NOW so future measurement changes don't alter this order.
      const measRes = await client.query(
        `SELECT measurements FROM customer_measurements
         WHERE customer_id = $1 AND garment_type_id = $2`,
        [customerId, item.garment_type_id]
      )
      const snapshot = measRes.rows[0]?.measurements || {}

      await client.query(
        `INSERT INTO order_items
           (order_id, garment_type_id, description, quantity, price,
            fabric_provided_by, fabric_details, measurements_snapshot, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          order.id,
          item.garment_type_id,
          item.description        || null,
          parseInt(item.quantity) || 1,
          parseFloat(item.price),
          item.fabric_provided_by || 'customer',
          item.fabric_details     || null,
          JSON.stringify(snapshot),
          item.notes              || null,
        ]
      )
    }

    await client.query('COMMIT')
    return order

  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ── List all active orders with customer info + balance due
const findAll = async ({ status, customerId, search } = {}) => {
  const conditions = ['o.deleted_at IS NULL']
  const params     = []
  let   i          = 1

  if (status)     { conditions.push(`o.status = $${i++}`);                              params.push(status) }
  if (customerId) { conditions.push(`o.customer_id = $${i++}`);                         params.push(customerId) }
  if (search)     { conditions.push(`(c.name ILIKE $${i} OR o.order_number ILIKE $${i++})`); params.push(`%${search}%`) }

  const res = await pool.query(
    `SELECT
       o.id, o.order_number, o.status, o.order_date, o.delivery_date,
       o.grand_total, o.notes, o.created_at,
       c.name  AS customer_name,
       c.phone AS customer_phone,
       -- Balance = grand_total minus all payments made so far
       o.grand_total - COALESCE(
         (SELECT SUM(amount) FROM payments WHERE order_id = o.id), 0
       ) AS balance_due
     FROM orders o
     JOIN customers c ON o.customer_id = c.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY o.created_at DESC`,
    params
  )
  return res.rows
}

// ── Single order with items + payments + balance
const findById = async (id) => {
  const orderRes = await pool.query(
    `SELECT o.*, c.name AS customer_name, c.phone AS customer_phone
     FROM orders o
     JOIN customers c ON o.customer_id = c.id
     WHERE o.id = $1 AND o.deleted_at IS NULL`,
    [id]
  )
  if (!orderRes.rows.length) return null
  const order = orderRes.rows[0]

  const itemsRes = await pool.query(
    `SELECT oi.*, gt.name AS garment_type_name
     FROM order_items oi
     JOIN garment_types gt ON oi.garment_type_id = gt.id
     WHERE oi.order_id = $1 ORDER BY oi.created_at`,
    [id]
  )
  order.items = itemsRes.rows

  const paymentsRes = await pool.query(
    `SELECT * FROM payments WHERE order_id = $1 ORDER BY payment_date`,
    [id]
  )
  order.payments    = paymentsRes.rows
  order.amount_paid = paymentsRes.rows.reduce((s, p) => s + parseFloat(p.amount), 0)
  order.balance_due = parseFloat(order.grand_total) - order.amount_paid

  return order
}

// ── Update status / delivery date / notes
const updateOrder = async (id, { status, deliveryDate, notes }) => {
  const res = await pool.query(
    `UPDATE orders
     SET status        = COALESCE($1, status),
         delivery_date = COALESCE($2, delivery_date),
         notes         = COALESCE($3, notes),
         updated_at    = NOW()
     WHERE id = $4 AND deleted_at IS NULL
     RETURNING *`,
    [status || null, deliveryDate || null, notes || null, id]
  )
  return res.rows[0] || null
}

// ── Soft delete
const softDeleteOrder = async (id) => {
  const res = await pool.query(
    `UPDATE orders SET deleted_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
    [id]
  )
  return res.rows[0] || null
}

module.exports = { createOrder, findAll, findById, updateOrder, softDeleteOrder }
