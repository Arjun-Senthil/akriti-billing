const express    = require('express')
const router     = express.Router()
const controller = require('../controllers/garmentTypeController')

router.get('/', controller.getAllGarmentTypes)

module.exports = router
