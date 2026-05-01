// paymentRoutes.js
// Mounted at /api/orders/:orderId/payments
// Nested under orders because a payment always belongs to an order.

const express = require('express')
const router  = express.Router({ mergeParams: true }) // mergeParams lets us read :orderId from parent
const { addPayment } = require('../controllers/paymentController')

// POST /api/orders/:orderId/payments — record a new payment
router.post('/', addPayment)

module.exports = router
