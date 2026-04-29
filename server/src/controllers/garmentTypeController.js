const garmentTypeModel = require('../models/garmentTypeModel')

const getAllGarmentTypes = async (req, res, next) => {
  try {
    const types = await garmentTypeModel.findAllActive()
    res.json({ success: true, data: types })
  } catch (err) {
    next(err)
  }
}

module.exports = { getAllGarmentTypes }
