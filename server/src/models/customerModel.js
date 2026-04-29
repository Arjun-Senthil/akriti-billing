// =============================================================
// customerModel.js — Raw SQL queries for the customers table
//
// The model's ONLY job is to talk to the database.
// No business logic here — that lives in the controller.
// No HTTP knowledge (req/res) — that's the controller's job too.
//
// MuleSoft analogy: this is your Database Connector operation.
// The controller is your DataWeave processor and flow logic.
// The route is your HTTP Listener.
// =============================================================

const pool = require('../config/database');

// -------------------------------------------------------------
// CREATE a new customer
// Returns the full inserted row (RETURNING * gives us the DB-
// generated id, created_at, etc. without a second query).
// -------------------------------------------------------------
const createCustomer = async ({ name, phone, email, address, notes, consent_given, consent_date }) => {
  const result = await pool.query(
    `INSERT INTO customers
       (name, phone, email, address, notes, consent_given, consent_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [name, phone, email || null, address || null, notes || null, consent_given, consent_date]
  );
  return result.rows[0];
};

// -------------------------------------------------------------
// GET ALL active customers
// Optional search: filters by name OR phone using ILIKE (case-
// insensitive LIKE). The % wildcards match anything before/after.
// WHERE deleted_at IS NULL = only return non-soft-deleted records.
// -------------------------------------------------------------
const findAll = async (search = '') => {
  if (search) {
    const result = await pool.query(
      `SELECT id, name, phone, email, address, notes, consent_given, is_active, created_at
       FROM customers
       WHERE deleted_at IS NULL
         AND (name ILIKE $1 OR phone ILIKE $1)
       ORDER BY name ASC`,
      [`%${search}%`]
    );
    return result.rows;
  }

  const result = await pool.query(
    `SELECT id, name, phone, email, address, notes, consent_given, is_active, created_at
     FROM customers
     WHERE deleted_at IS NULL
     ORDER BY name ASC`
  );
  return result.rows;
};

// -------------------------------------------------------------
// GET ONE customer by ID — includes their measurements
// We run two queries: one for the customer, one for measurements,
// then attach measurements to the customer object before returning.
// This avoids a complex JOIN that would duplicate customer data
// for each measurement row.
// -------------------------------------------------------------
const findById = async (id) => {
  const customerResult = await pool.query(
    `SELECT * FROM customers WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );

  if (customerResult.rows.length === 0) return null;

  const customer = customerResult.rows[0];

  // Fetch measurements with the garment type name and field definitions
  // so the frontend knows what fields exist and what to display
  const measurementsResult = await pool.query(
    `SELECT
       cm.id,
       cm.garment_type_id,
       gt.name            AS garment_type_name,
       gt.measurement_fields,
       cm.measurements,
       cm.notes,
       cm.updated_at
     FROM customer_measurements cm
     JOIN garment_types gt ON cm.garment_type_id = gt.id
     WHERE cm.customer_id = $1
     ORDER BY gt.name ASC`,
    [id]
  );

  customer.measurements = measurementsResult.rows;
  return customer;
};

// -------------------------------------------------------------
// UPDATE customer details
// Only updates editable fields — consent/audit fields are not
// updatable via this function (they're set once at creation).
// Returns null if the customer doesn't exist or is soft-deleted.
// -------------------------------------------------------------
const updateCustomer = async (id, { name, phone, email, address, notes }) => {
  const result = await pool.query(
    `UPDATE customers
     SET name      = $1,
         phone     = $2,
         email     = $3,
         address   = $4,
         notes     = $5,
         updated_at = NOW()
     WHERE id = $6 AND deleted_at IS NULL
     RETURNING *`,
    [name, phone, email || null, address || null, notes || null, id]
  );
  return result.rows[0] || null;
};

// -------------------------------------------------------------
// SOFT DELETE a customer
// Sets deleted_at = NOW() and is_active = FALSE.
// The row stays in the DB — orders and invoices tied to this
// customer must remain readable for GST audit (6-year retention).
// -------------------------------------------------------------
const softDeleteCustomer = async (id) => {
  const result = await pool.query(
    `UPDATE customers
     SET deleted_at = NOW(),
         is_active  = FALSE,
         updated_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING *`,
    [id]
  );
  return result.rows[0] || null;
};

// -------------------------------------------------------------
// UPSERT measurements for a customer + garment type combination
// INSERT if no measurement record exists for this pair.
// UPDATE if one already exists (ON CONFLICT on the unique constraint).
// This means "save measurements" always works — no need to check
// first whether to INSERT or UPDATE.
// -------------------------------------------------------------
const upsertMeasurements = async (customerId, garmentTypeId, measurements, notes) => {
  const result = await pool.query(
    `INSERT INTO customer_measurements
       (customer_id, garment_type_id, measurements, notes)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (customer_id, garment_type_id)
     DO UPDATE SET
       measurements = EXCLUDED.measurements,
       notes        = EXCLUDED.notes,
       updated_at   = NOW()
     RETURNING *`,
    [customerId, garmentTypeId, JSON.stringify(measurements), notes || null]
  );
  return result.rows[0];
};

module.exports = {
  createCustomer,
  findAll,
  findById,
  updateCustomer,
  softDeleteCustomer,
  upsertMeasurements,
};
