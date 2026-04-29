// =============================================================
// customerRoutes.js — URL definitions for customer endpoints
//
// This file only maps HTTP method + path → controller function.
// No logic lives here. Think of this as your MuleSoft HTTP
// Listener config — it just says "this URL goes to this handler".
//
// All routes here are prefixed with /api/customers
// because of how they're registered in index.js.
// =============================================================

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/customerController');

// List all customers (with optional ?search= query param)
router.get('/',    controller.getAllCustomers);

// Get a single customer by ID (includes measurements)
router.get('/:id', controller.getCustomerById);

// Create a new customer
router.post('/',   controller.createCustomer);

// Update a customer's details
router.put('/:id', controller.updateCustomer);

// Soft-delete a customer
router.delete('/:id', controller.deleteCustomer);

// Add or update measurements for a customer + garment type
router.post('/:id/measurements', controller.upsertMeasurements);

module.exports = router;
