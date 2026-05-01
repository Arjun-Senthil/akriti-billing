// paymentModel.js — Ledger-style payment recording
//
// Core principle: NEVER delete or edit payment rows.
// If a payment was entered wrong, record a correcting entry.
// Balance due = orders.grand_total - SUM(payments.amount)
// This is the same pattern banks use — every transaction is immutable.

const pool = require('../config/database')

// ── Add a payment against an order ──────────────────────────────
const createPayment = async (orderId, { amount, paymentMethod, paymentType, paymentDate, reference, notes }) => {
  const res = await pool.query(
    `INSERT INTO payments
       (order_id, amount, payment_method, payment_type, payment_date, reference, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      orderId,
      parseFloat(amount),
      paymentMethod  || 'cash',
      paymentType    || 'advance',
      paymentDate    || new Date().toISOString().slice(0, 10),
      reference      || null,
      notes          || null,
    ]
  )
  return res.rows[0]
}

// ── Get all payments for an order ───────────────────────────────
const findByOrderId = async (orderId) => {
  const res = await pool.query(
    `SELECT * FROM payments WHERE order_id = $1 ORDER BY payment_date, created_at`,
    [orderId]
  )
  return res.rows
}

// ── Get current balance due for an order ────────────────────────
// Used for validation — prevent recording more than what's owed.
const getBalanceDue = async (orderId) => {
  const res = await pool.query(
    `SELECT
       o.grand_total,
       COALESCE(SUM(p.amount), 0) AS amount_paid
     FROM orders o
     LEFT JOIN payments p ON p.order_id = o.id
     WHERE o.id = $1 AND o.deleted_at IS NULL
     GROUP BY o.grand_total`,
    [orderId]
  )
  if (!res.rows.length) return null
  const { grand_total, amount_paid } = res.rows[0]
  return parseFloat(grand_total) - parseFloat(amount_paid)
}

module.exports = { createPayment, findByOrderId, getBalanceDue }
