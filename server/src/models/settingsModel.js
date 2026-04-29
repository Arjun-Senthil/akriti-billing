const pool = require('../config/database')

// Returns all app_settings as a flat { key: value } object
// so the frontend can read gst_rate, shop_name, etc. in one call
const getAll = async () => {
  const res = await pool.query(`SELECT key, value FROM app_settings ORDER BY key`)
  return res.rows.reduce((obj, row) => {
    obj[row.key] = row.value
    return obj
  }, {})
}

const updateSetting = async (key, value, updatedBy = 'staff') => {
  const res = await pool.query(
    `UPDATE app_settings SET value = $1, updated_by = $2, updated_at = NOW()
     WHERE key = $3 RETURNING *`,
    [value, updatedBy, key]
  )
  return res.rows[0] || null
}

module.exports = { getAll, updateSetting }
