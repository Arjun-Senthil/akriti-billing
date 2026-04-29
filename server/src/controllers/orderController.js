const orderModel = require('../models/orderModel')
const { logAction } = require('../utils/auditLogger')

const STATUS_VALUES = ['received','cutting','stitching','finishing','ready','delivered','cancelled']

// POST /api/orders
const createOrder = async (req, res, next) => {
  try {
    const { customer_id, delivery_date, notes, items } = req.body

    if (!customer_id)        return res.status(400).json({ success: false, error: 'customer_id is required' })
    if (!items?.length)      return res.status(400).json({ success: false, error: 'At least one order item is required' })

    for (const [idx, item] of items.entries()) {
      if (!item.garment_type_id) return res.status(400).json({ success: false, error: `Item ${idx + 1}: garment_type_id is required` })
      if (!item.price || isNaN(parseFloat(item.price)) || parseFloat(item.price) <= 0)
        return res.status(400).json({ success: false, error: `Item ${idx + 1}: valid price is required` })
    }

    const order = await orderModel.createOrder({ customerId: customer_id, deliveryDate: delivery_date, notes, items })

    await logAction({ tableName: 'orders', recordId: order.id, action: 'INSERT', oldData: null, newData: order, changedBy: 'staff', ipAddress: req.ip })

    res.status(201).json({ success: true, data: order })
  } catch (err) {
    next(err)
  }
}

// GET /api/orders
// GET /api/orders?status=cutting
// GET /api/orders?search=Priya
const getAllOrders = async (req, res, next) => {
  try {
    const { status, customer_id, search } = req.query
    const orders = await orderModel.findAll({ status, customerId: customer_id, search })
    res.json({ success: true, count: orders.length, data: orders })
  } catch (err) {
    next(err)
  }
}

// GET /api/orders/:id
const getOrderById = async (req, res, next) => {
  try {
    const order = await orderModel.findById(req.params.id)
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' })
    res.json({ success: true, data: order })
  } catch (err) {
    next(err)
  }
}

// PUT /api/orders/:id
const updateOrder = async (req, res, next) => {
  try {
    const { status, delivery_date, notes } = req.body

    if (status && !STATUS_VALUES.includes(status)) {
      return res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${STATUS_VALUES.join(', ')}` })
    }

    const old = await orderModel.findById(req.params.id)
    if (!old) return res.status(404).json({ success: false, error: 'Order not found' })

    const updated = await orderModel.updateOrder(req.params.id, { status, deliveryDate: delivery_date, notes })

    await logAction({ tableName: 'orders', recordId: updated.id, action: 'UPDATE', oldData: old, newData: updated, changedBy: 'staff', ipAddress: req.ip })

    res.json({ success: true, data: updated })
  } catch (err) {
    next(err)
  }
}

// DELETE /api/orders/:id
const deleteOrder = async (req, res, next) => {
  try {
    const old = await orderModel.findById(req.params.id)
    if (!old) return res.status(404).json({ success: false, error: 'Order not found' })

    const deleted = await orderModel.softDeleteOrder(req.params.id)
    await logAction({ tableName: 'orders', recordId: deleted.id, action: 'DELETE', oldData: old, newData: deleted, changedBy: 'staff', ipAddress: req.ip })

    res.json({ success: true, message: 'Order cancelled successfully' })
  } catch (err) {
    next(err)
  }
}

module.exports = { createOrder, getAllOrders, getOrderById, updateOrder, deleteOrder }
