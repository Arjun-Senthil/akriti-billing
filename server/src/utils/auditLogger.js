// =============================================================
// auditLogger.js — Shared utility for writing to audit_logs
//
// Called from every controller after any INSERT, UPDATE, DELETE.
// This is app-layer audit logging (vs. DB triggers) — easier to
// debug and understand because you see it in your own JS code.
//
// IMPORTANT: audit log failures must NEVER crash the main request.
// If logging fails, we log the error to console and move on.
// The user's action (create customer, update order, etc.) succeeds
// regardless. A failed audit trail is bad; a failed business
// operation is worse.
// =============================================================

const pool = require('../config/database');

/**
 * Logs a data change to the audit_logs table.
 *
 * @param {object} params
 * @param {string} params.tableName   - 'customers', 'orders', 'payments', etc.
 * @param {number} params.recordId    - the id of the row that was changed
 * @param {string} params.action      - 'INSERT', 'UPDATE', or 'DELETE'
 * @param {object} params.oldData     - row data before the change (null for INSERT)
 * @param {object} params.newData     - row data after the change (null for DELETE)
 * @param {string} params.changedBy   - who made the change ('staff', 'system')
 * @param {string} params.ipAddress   - request IP address (tracks which device)
 */
const logAction = async ({
  tableName,
  recordId,
  action,
  oldData = null,
  newData = null,
  changedBy = 'system',
  ipAddress = null,
}) => {
  try {
    await pool.query(
      `INSERT INTO audit_logs
         (table_name, record_id, action, old_data, new_data, changed_by, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        tableName,
        recordId,
        action,
        oldData  ? JSON.stringify(oldData)  : null,
        newData  ? JSON.stringify(newData)  : null,
        changedBy,
        ipAddress,
      ]
    );
  } catch (err) {
    // Never throw — audit failure must not break the main flow
    console.error('[AuditLogger] Failed to write audit log:', err.message);
  }
};

module.exports = { logAction };
