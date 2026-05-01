// paymentController.js — Validate and record payments
//
// Key validations:
//   1. Order must exist and not be cancelled/deleted
//   2. Amount must be > 0
//   3. Amount cannot exceed balance due (no overpayment)
//
// Why no overpayment? Prevents accidental double entries.
// If a customer genuinely overpays, staff records the exact amount
// and handles the refund/credit manually — we don't model that yet.

const { createPayment, getBalanceDue } = require('../models/paymentModel')
const pool = require('../config/database')

const VALID_METHODS = ['cash', 'upi', 'card', 'bank_transfer']
const VALID_TYPES   = ['advance', 'partial', 'balance', 'due_clearance']

const addPayment = async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.orderId)
    const { amount, payment_method, payment_type, payment_date, reference, notes } = req.body

    // ── Validate order exists and is not cancelled ───────────────
    const orderRes = await pool.query(
      `SELECT id, status, grand_total FROM orders WHERE id = $1 AND deleted_at IS NULL`,
      [orderId]
    )
    if (!orderRes.rows.length)
      return res.status(404).json({ success: false, error: 'Order not found.' })

    const order = orderRes.rows[0]
    if (order.status === 'cancelled')
      return res.status(400).json({ success: false, error: 'Cannot record payment on a cancelled order.' })

    // ── Validate amount ──────────────────────────────────────────
    const parsedAmount = parseFloat(amount)
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0)
      return res.status(400).json({ success: false, error: 'Amount must be greater than zero.' })

    // ── Prevent overpayment ──────────────────────────────────────
    const balanceDue = await getBalanceDue(orderId)
    if (parsedAmount > balanceDue + 0.01) // 0.01 tolerance for floating point
      return res.status(400).json({
        success: false,
        error: `Amount ₹${parsedAmount} exceeds balance due ₹${balanceDue.toFixed(2)}.`,
      })

    // ── Validate enums ───────────────────────────────────────────
    if (payment_method && !VALID_METHODS.includes(payment_method))
      return res.status(400).json({ success: false, error: `Invalid payment method. Use: ${VALID_METHODS.join(', ')}` })

    if (payment_type && !VALID_TYPES.includes(payment_type))
      return res.status(400).json({ success: false, error: `Invalid payment type. Use: ${VALID_TYPES.join(', ')}` })

    // ── Record payment ───────────────────────────────────────────
    const payment = await createPayment(orderId, {
      amount:        parsedAmount,
      paymentMethod: payment_method,
      paymentType:   payment_type,
      paymentDate:   payment_date,
      reference,
      notes,
    })

    res.status(201).json({ success: true, data: payment })

  } catch (err) {
    next(err)
  }
}

module.exports = { addPayment }
