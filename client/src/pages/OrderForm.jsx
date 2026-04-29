// OrderForm.jsx — Create a new order or edit an existing one.
//
// TWO MODES based on whether :id is in the URL:
//   /orders/new      → isEdit = false → full form (customer + items + dates)
//   /orders/:id/edit → isEdit = true  → limited form (status + date + notes only)
//
// Why can't we edit items in edit mode?
//   Once an order is created, the measurement snapshot is frozen.
//   Changing items would break the audit trail and GST calculation.
//   Status/date/notes are safe to change — they don't affect financial records.
//
// Why live GST calculation on the frontend?
//   UX: the tailor wants to see the total before saving.
//   The backend recalculates independently — frontend preview only.

import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import CustomerSearch from '../components/CustomerSearch'
import { getGarmentTypes } from '../api/garmentTypes'
import { getSettings } from '../api/settings'
import { createOrder, getOrderById, updateOrder } from '../api/orders'

// All valid statuses — mirrors the backend STATUS_VALUES array
const STATUS_VALUES = [
  'received', 'cutting', 'stitching', 'finishing', 'ready', 'delivered', 'cancelled',
]

// A blank item row — we spread this to avoid sharing references
const EMPTY_ITEM = {
  garment_type_id:   '',
  description:       '',
  price:             '',
  fabric_provided_by: 'customer',
  fabric_details:    '',
  item_notes:        '',
}

const fmt = (n) =>
  `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export default function OrderForm() {
  const { id }  = useParams()
  const isEdit  = Boolean(id)
  const navigate = useNavigate()

  // ── Form fields ─────────────────────────────────────
  const [customer,     setCustomer]     = useState(null)
  const [items,        setItems]        = useState([{ ...EMPTY_ITEM }])
  const [deliveryDate, setDeliveryDate] = useState('')
  const [notes,        setNotes]        = useState('')
  const [status,       setStatus]       = useState('received')

  // ── Supporting data ──────────────────────────────────
  const [garmentTypes, setGarmentTypes] = useState([])
  const [gstRate,      setGstRate]      = useState(5)   // default 5%, overwritten from DB

  // ── UI state ─────────────────────────────────────────
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState(null)
  const [order,    setOrder]    = useState(null) // existing order (edit mode only)

  // ── Load garment types, settings, and (in edit mode) the existing order ──
  useEffect(() => {
    const init = async () => {
      try {
        // Promise.all fetches both in parallel — faster than sequential awaits
        const [types, settings] = await Promise.all([
          getGarmentTypes(),
          getSettings(),
        ])
        setGarmentTypes(types)
        if (settings.gst_rate) setGstRate(parseFloat(settings.gst_rate))

        if (isEdit) {
          const existing = await getOrderById(id)
          setOrder(existing)
          setStatus(existing.status)
          // Slice to 10 chars: DB returns "2026-05-15T00:00:00.000Z", date input needs "2026-05-15"
          setDeliveryDate(existing.delivery_date ? existing.delivery_date.slice(0, 10) : '')
          setNotes(existing.notes || '')
        }
      } catch {
        setError('Could not load form data. Please refresh.')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [id, isEdit])

  // ── Live GST calculation ─────────────────────────────
  // Runs on every keystroke in a price field — pure math, no network call
  const subtotal  = items.reduce((sum, it) => sum + parseFloat(it.price || 0), 0)
  const cgst      = parseFloat(((subtotal * gstRate / 100) / 2).toFixed(2))
  const sgst      = cgst
  const grandTotal = subtotal + cgst + sgst

  // ── Item helpers ─────────────────────────────────────
  const addItem = () =>
    setItems(prev => [...prev, { ...EMPTY_ITEM }])

  const removeItem = (idx) =>
    setItems(prev => prev.filter((_, i) => i !== idx))

  const updateItem = (idx, field, val) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it))

  // ── Submit ───────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    // Client-side validation (backend validates too — this is just fast UX feedback)
    if (!isEdit) {
      if (!customer)
        return setError('Please select a customer.')
      if (items.some(it => !it.garment_type_id || !it.price))
        return setError('Each item needs a garment type and a price.')
      if (items.some(it => parseFloat(it.price) <= 0))
        return setError('Price must be greater than zero.')
    }

    setSaving(true)
    try {
      if (isEdit) {
        await updateOrder(id, {
          status,
          deliveryDate: deliveryDate || null,
          notes:        notes        || null,
        })
        navigate(`/orders/${id}`)
      } else {
        const created = await createOrder({
          customer_id:   customer.id,
          delivery_date: deliveryDate || null,
          notes:         notes        || null,
          items: items.map(it => ({
            garment_type_id:    parseInt(it.garment_type_id),
            description:        it.description        || null,
            price:              parseFloat(it.price),
            fabric_provided_by: it.fabric_provided_by || 'customer',
            fabric_details:     it.fabric_details     || null,
            notes:              it.item_notes         || null,
          })),
        })
        navigate(`/orders/${created.id}`)
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save order. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-center py-16 text-gray-400 text-sm">Loading...</div>

  return (
    <div className="max-w-2xl mx-auto">

      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(isEdit ? `/orders/${id}` : '/orders')}
          className="text-gray-400 hover:text-gray-600 text-sm"
        >
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? `Edit ${order?.order_number}` : 'New Order'}
        </h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-5">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Customer picker (new orders only) ───────────── */}
        {!isEdit && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Customer *</h2>
            <CustomerSearch value={customer} onChange={setCustomer} />
          </div>
        )}

        {/* ── Status (edit mode only) ──────────────────────── */}
        {isEdit && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Status</h2>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {STATUS_VALUES.map(s => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-2">
              Items cannot be changed after an order is created — only status, delivery date, and notes.
            </p>
          </div>
        )}

        {/* ── Line items (new orders only) ─────────────────── */}
        {!isEdit && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">Items *</h2>
              <button
                type="button"
                onClick={addItem}
                className="text-brand-600 hover:text-brand-700 text-xs font-medium"
              >
                + Add Item
              </button>
            </div>

            <div className="space-y-4">
              {items.map((item, idx) => (
                <div key={idx} className="border border-gray-100 rounded-lg p-4 bg-gray-50">

                  <div className="flex justify-between items-center mb-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Item {idx + 1}
                    </p>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="text-red-400 hover:text-red-600 text-xs font-medium"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">

                    {/* Garment type dropdown — pulled from DB */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Garment Type *</label>
                      <select
                        value={item.garment_type_id}
                        onChange={e => updateItem(idx, 'garment_type_id', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="">Select type...</option>
                        {garmentTypes.map(g => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Price — number input, decimal allowed */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Price (₹) *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.price}
                        onChange={e => updateItem(idx, 'price', e.target.value)}
                        placeholder="0.00"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>

                    {/* Description — optional, helps tailor identify the piece */}
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">Description</label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={e => updateItem(idx, 'description', e.target.value)}
                        placeholder="e.g. Floral print kurta, navy blue"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>

                    {/* Fabric — who provides it? */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Fabric provided by</label>
                      <select
                        value={item.fabric_provided_by}
                        onChange={e => updateItem(idx, 'fabric_provided_by', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="customer">Customer</option>
                        <option value="shop">Shop</option>
                      </select>
                    </div>

                    {/* Fabric details */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Fabric Details</label>
                      <input
                        type="text"
                        value={item.fabric_details}
                        onChange={e => updateItem(idx, 'fabric_details', e.target.value)}
                        placeholder="e.g. Cotton, 2.5 metres"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>

                    {/* Item-level notes — separate from the order notes */}
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">Item Notes</label>
                      <input
                        type="text"
                        value={item.item_notes}
                        onChange={e => updateItem(idx, 'item_notes', e.target.value)}
                        placeholder="Special instructions for this piece..."
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>

                  </div>
                </div>
              ))}
            </div>

            {/* ── Live GST preview — updates on every price keystroke ── */}
            {subtotal > 0 && (
              <div className="mt-5 border-t border-gray-200 pt-4 space-y-1.5">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Subtotal</span>
                  <span>{fmt(subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>CGST ({(gstRate / 2).toFixed(1)}%)</span>
                  <span>{fmt(cgst)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>SGST ({(gstRate / 2).toFixed(1)}%)</span>
                  <span>{fmt(sgst)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-gray-900 pt-2 border-t border-gray-200">
                  <span>Grand Total</span>
                  <span>{fmt(grandTotal)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Delivery date + order notes (both modes) ────────── */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Details</h2>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Delivery Date</label>
            <input
              type="date"
              value={deliveryDate}
              onChange={e => setDeliveryDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Order Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Any special instructions for this order..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>
        </div>

        {/* ── Submit buttons ───────────────────────────────────── */}
        <div className="flex gap-3 justify-end pb-8">
          <button
            type="button"
            onClick={() => navigate(isEdit ? `/orders/${id}` : '/orders')}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Order'}
          </button>
        </div>

      </form>
    </div>
  )
}
