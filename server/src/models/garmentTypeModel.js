const pool = require('../config/database')

const findAllActive = async () => {
  const result = await pool.query(
    `SELECT id, name, measurement_fields
     FROM garment_types
     WHERE is_active = TRUE AND deleted_at IS NULL
     ORDER BY name ASC`
  )
  return result.rows
}

module.exports = { findAllActive }
