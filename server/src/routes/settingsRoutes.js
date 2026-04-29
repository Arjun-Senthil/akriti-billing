const express    = require('express')
const router     = express.Router()
const controller = require('../controllers/settingsController')

router.get('/',        controller.getAllSettings)
router.put('/:key',    controller.updateSetting)

module.exports = router
