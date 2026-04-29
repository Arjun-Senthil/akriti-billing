// CustomerForm.jsx — Add or Edit a customer.
//
// This single component handles both modes:
//   /customers/new      → Add mode (id is undefined)
//   /customers/:id/edit → Edit mode (id exists, we fetch the customer first)
//
// useParams extracts :id from the URL.
// useNavigate lets us redirect programmatically after save.
//
// The form is controlled: every input is tied to React state via
// value + onChange. When the user types, state updates. When state
// updates, React re-renders the input. This is "controlled components"
// — React owns the form data, not the DOM.

import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getCustomerById, createCustomer, updateCustomer } from '../api/customers'

const EMPTY_FORM = {
  name:          '',
  phone:         '',
  email:         '',
  address:       '',
  notes:         '',
  consent_given: false,
}

export default function CustomerForm() {
  const { id }     = useParams()    // undefined on /customers/new
  const navigate   = useNavigate()
  const isEditMode = Boolean(id)    // true if editing, false if adding

  const [form,       setForm]       = useState(EMPTY_FORM)
  const [loading,    setLoading]    = useState(isEditMode)  // true initially only in edit mode
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState(null)

  // In edit mode: fetch the existing customer and populate the form.
  useEffect(() => {
    if (!isEditMode) return

    const load = async () => {
      try {
        const customer = await getCustomerById(id)
        setForm({
          name:          customer.name         || '',
          phone:         customer.phone        || '',
          email:         customer.email        || '',
          address:       customer.address      || '',
          notes:         customer.notes        || '',
          consent_given: customer.consent_given || false,
        })
      } catch (err) {
        setError('Could not load customer details.')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [id, isEditMode])

  // Generic field change handler — handles text inputs and checkboxes.
  // Instead of writing a separate onChange for every field, we use the
  // input's `name` attribute to know which field to update in state.
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  // Form submit: validate, call API, redirect on success.
  const handleSubmit = async (e) => {
    e.preventDefault()   // prevent browser's default page-reload behaviour
    setError(null)

    // Client-side validation (mirrors the backend — catches issues before the round trip)
    if (!form.name.trim()) {
      setError('Customer name is required.')
      return
    }
    if (!form.phone.trim()) {
      setError('Phone number is required.')
      return
    }
    if (!isEditMode && !form.consent_given) {
      setError('You must confirm the customer has given consent before saving.')
      return
    }

    try {
      setSubmitting(true)
      if (isEditMode) {
        await updateCustomer(id, form)
      } else {
        await createCustomer({ ...form, consent_given: true })
      }
      navigate('/customers')
    } catch (err) {
      // Show the error message from the backend if available
      const msg = err.response?.data?.error || 'Could not save customer. Please try again.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="text-center py-16 text-gray-400 text-sm">Loading...</div>
  }

  return (
    <div className="max-w-xl">

      {/* ── Header ──────────────────────────────────── */}
      <div className="mb-6">
        <Link to="/customers" className="text-sm text-brand-600 hover:underline">
          ← Back to Customers
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">
          {isEditMode ? 'Edit Customer' : 'Add Customer'}
        </h1>
      </div>

      {/* ── Error banner ────────────────────────────── */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* ── Form ────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="e.g. Priya Sharma"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            placeholder="e.g. 9876543210"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-400 mt-1">Used to identify the customer — must be unique.</p>
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="e.g. priya@gmail.com"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>

        {/* Address */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Address <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            name="address"
            value={form.address}
            onChange={handleChange}
            rows={2}
            placeholder="e.g. 12, MG Road, Indiranagar, Bangalore"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={2}
            placeholder="e.g. Prefers loose fit, allergic to synthetic fabric"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
          />
        </div>

        {/* Consent — shown only when adding a new customer */}
        {!isEditMode && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="consent_given"
                checked={form.consent_given}
                onChange={handleChange}
                className="mt-0.5 accent-brand-600"
              />
              <span className="text-sm text-amber-800">
                The customer has been informed that their personal data and measurements
                will be stored in this system and has given consent.{' '}
                <span className="font-semibold">(Required — DPDP Act 2023)</span>
              </span>
            </label>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            {submitting ? 'Saving...' : isEditMode ? 'Save Changes' : 'Add Customer'}
          </button>
          <Link
            to="/customers"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </Link>
        </div>

      </form>
    </div>
  )
}
