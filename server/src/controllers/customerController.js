// =============================================================
// customerController.js — Business logic for customer endpoints
//
// Each function handles one API operation:
//   1. Validate the incoming request
//   2. Call the model (database)
//   3. Write to audit log
//   4. Return a consistent JSON response
//
// All functions are async and use try/catch.
// On error, we call next(err) to hand off to errorHandler.js.
// This keeps error handling in one place (not scattered in every
// controller) — same pattern as MuleSoft's global error handler.
// =============================================================

const customerModel = require('../models/customerModel');
const { logAction }  = require('../utils/auditLogger');

// -------------------------------------------------------------
// POST /api/customers
// Creates a new customer.
// Requires consent_given = true (DPDP Act 2023 compliance).
// -------------------------------------------------------------
const createCustomer = async (req, res, next) => {
  try {
    const { name, phone, email, address, notes, consent_given } = req.body;

    // --- Validation ---
    if (!name?.trim()) {
      return res.status(400).json({ success: false, error: 'Customer name is required' });
    }
    if (!phone?.trim()) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }
    // Basic phone format check (10 digits, optionally prefixed with +91 or 0)
    const cleanPhone = phone.trim().replace(/\s+/g, '');
    if (!/^(\+91|0)?[6-9]\d{9}$/.test(cleanPhone)) {
      return res.status(400).json({ success: false, error: 'Enter a valid Indian mobile number' });
    }
    // DPDP Act 2023: consent is mandatory before storing personal data
    if (!consent_given) {
      return res.status(400).json({
        success: false,
        error: 'Customer consent is required before storing personal data (DPDP Act 2023)',
      });
    }

    const customer = await customerModel.createCustomer({
      name:          name.trim(),
      phone:         cleanPhone,
      email:         email?.trim()   || null,
      address:       address?.trim() || null,
      notes:         notes?.trim()   || null,
      consent_given: true,
      consent_date:  new Date(),
    });

    await logAction({
      tableName: 'customers',
      recordId:  customer.id,
      action:    'INSERT',
      oldData:   null,
      newData:   customer,
      changedBy: 'staff',
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, data: customer });

  } catch (err) {
    next(err);
  }
};

// -------------------------------------------------------------
// GET /api/customers
// GET /api/customers?search=Priya
// GET /api/customers?search=9876543210
// Returns all active customers, optionally filtered by name/phone.
// -------------------------------------------------------------
const getAllCustomers = async (req, res, next) => {
  try {
    const { search = '' } = req.query;
    const customers = await customerModel.findAll(search.trim());

    res.json({
      success: true,
      count:   customers.length,
      data:    customers,
    });

  } catch (err) {
    next(err);
  }
};

// -------------------------------------------------------------
// GET /api/customers/:id
// Returns a single customer with all their saved measurements.
// -------------------------------------------------------------
const getCustomerById = async (req, res, next) => {
  try {
    const customer = await customerModel.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    res.json({ success: true, data: customer });

  } catch (err) {
    next(err);
  }
};

// -------------------------------------------------------------
// PUT /api/customers/:id
// Updates a customer's editable fields.
// Consent fields are NOT updatable — set once at creation.
// -------------------------------------------------------------
const updateCustomer = async (req, res, next) => {
  try {
    const { name, phone, email, address, notes } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ success: false, error: 'Customer name is required' });
    }
    if (!phone?.trim()) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }
    const cleanPhone = phone.trim().replace(/\s+/g, '');
    if (!/^(\+91|0)?[6-9]\d{9}$/.test(cleanPhone)) {
      return res.status(400).json({ success: false, error: 'Enter a valid Indian mobile number' });
    }

    // Fetch before-state for the audit log
    const oldCustomer = await customerModel.findById(req.params.id);
    if (!oldCustomer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const updated = await customerModel.updateCustomer(req.params.id, {
      name:    name.trim(),
      phone:   cleanPhone,
      email:   email?.trim()   || null,
      address: address?.trim() || null,
      notes:   notes?.trim()   || null,
    });

    await logAction({
      tableName: 'customers',
      recordId:  updated.id,
      action:    'UPDATE',
      oldData:   oldCustomer,
      newData:   updated,
      changedBy: 'staff',
      ipAddress: req.ip,
    });

    res.json({ success: true, data: updated });

  } catch (err) {
    next(err);
  }
};

// -------------------------------------------------------------
// DELETE /api/customers/:id
// Soft delete: sets deleted_at = NOW(). Data is never removed.
// Historical orders and invoices remain readable for GST audit.
// -------------------------------------------------------------
const deleteCustomer = async (req, res, next) => {
  try {
    const oldCustomer = await customerModel.findById(req.params.id);
    if (!oldCustomer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const deleted = await customerModel.softDeleteCustomer(req.params.id);

    await logAction({
      tableName: 'customers',
      recordId:  deleted.id,
      action:    'DELETE',
      oldData:   oldCustomer,
      newData:   deleted,
      changedBy: 'staff',
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Customer deactivated successfully' });

  } catch (err) {
    next(err);
  }
};

// -------------------------------------------------------------
// POST /api/customers/:id/measurements
// Saves (creates or updates) measurements for one garment type.
// Uses upsert — calling it multiple times is always safe.
// Body: { garment_type_id, measurements: { chest: 36, ... }, notes }
// -------------------------------------------------------------
const upsertMeasurements = async (req, res, next) => {
  try {
    const { garment_type_id, measurements, notes } = req.body;

    if (!garment_type_id) {
      return res.status(400).json({ success: false, error: 'garment_type_id is required' });
    }
    if (!measurements || typeof measurements !== 'object') {
      return res.status(400).json({ success: false, error: 'measurements must be a JSON object' });
    }

    const customer = await customerModel.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const result = await customerModel.upsertMeasurements(
      req.params.id,
      garment_type_id,
      measurements,
      notes
    );

    await logAction({
      tableName: 'customer_measurements',
      recordId:  result.id,
      action:    'UPDATE',
      oldData:   null,
      newData:   result,
      changedBy: 'staff',
      ipAddress: req.ip,
    });

    res.json({ success: true, data: result });

  } catch (err) {
    next(err);
  }
};

module.exports = {
  createCustomer,
  getAllCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  upsertMeasurements,
};
