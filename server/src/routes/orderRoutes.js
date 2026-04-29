const express    = require('express')
const router     = express.Router()
const controller = require('../controllers/orderController')

router.get('/',     controller.getAllOrders)
router.get('/:id',  controller.getOrderById)
router.post('/',    controller.createOrder)
router.put('/:id',  controller.updateOrder)
router.delete('/:id', controller.deleteOrder)

module.exports = router
