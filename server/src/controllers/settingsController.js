const settingsModel = require('../models/settingsModel')

const getAllSettings = async (req, res, next) => {
  try {
    const settings = await settingsModel.getAll()
    res.json({ success: true, data: settings })
  } catch (err) {
    next(err)
  }
}

const updateSetting = async (req, res, next) => {
  try {
    const { key } = req.params
    const { value } = req.body
    if (value === undefined || value === null) {
      return res.status(400).json({ success: false, error: 'value is required' })
    }
    const updated = await settingsModel.updateSetting(key, value, 'staff')
    if (!updated) {
      return res.status(404).json({ success: false, error: `Setting '${key}' not found` })
    }
    res.json({ success: true, data: updated })
  } catch (err) {
    next(err)
  }
}

module.exports = { getAllSettings, updateSetting }
