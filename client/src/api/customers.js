// api/customers.js — All HTTP calls for the customer module.
//
// Centralising API calls here means:
//   - Components stay clean (no axios code mixed with UI code)
//   - If the backend URL or response shape changes, you fix it here,
//     not in 10 different component files
//
// All URLs use /api/... — Vite's proxy forwards these to
// http://localhost:3001 in development automatically.
//
// MuleSoft analogy: this file is your API connector config —
// one place that knows how to talk to the backend.

import axios from 'axios'

// Fetch all customers. Optional search filters by name or phone.
export const getCustomers = async (search = '') => {
  const params = search ? { search } : {}
  const res = await axios.get('/api/customers', { params })
  return res.data.data   // { success, count, data: [...] } → return just the array
}

// Fetch one customer by ID (includes their measurements).
export const getCustomerById = async (id) => {
  const res = await axios.get(`/api/customers/${id}`)
  return res.data.data
}

// Create a new customer.
export const createCustomer = async (payload) => {
  const res = await axios.post('/api/customers', payload)
  return res.data.data
}

// Update an existing customer.
export const updateCustomer = async (id, payload) => {
  const res = await axios.put(`/api/customers/${id}`, payload)
  return res.data.data
}

// Soft-delete a customer.
export const deleteCustomer = async (id) => {
  const res = await axios.delete(`/api/customers/${id}`)
  return res.data
}
