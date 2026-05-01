// AddPaymentModal.jsx — Record a payment against an order
//
// Shows current balance due at the top so the receptionist always
// knows what's outstanding before entering the amount.
//
// Payment type is auto-suggested based on context:
//   - First payment ever        → advance
//   - Amount clears the balance → balance
//   - Anything else             → partial
// Staff can override this — it's just a convenience default.

import { useState } from 'react'
import { addPayment } from '../api/payments'

const METHODS = [
  { value: 'cash',          label: 'Cash' },
  { value: 'upi',           label: 'UPI' },
  { value: 'card',          label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
]

const TYPES = [
  { value: 'advance',       label: 'Advance' },
  { value: 'partial',       label: 'Partial' },
  { value: 'balance',       label: 'Balance (final)' },
  { value: 'due_clearance', label: 'Due Clearance' },
]

const fmt = (n) =>
  `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

const today = () => new Date().toISOString().slice(0, 10)

export default function AddPaymentModal({ order, onSuccess, onClose }) {
  // Auto-suggest payment type
  const suggestType = (amt) => {
    const amount = parseFloat(amt || 0)
    const balance = parseFloat(order.balance_due || 0)
    const amountPaid = parseFloat(order.amount_paid || 0)
    if (amountPaid === 0) return 'advance'
    if (Math.abs(amount - balance) < 0.01) return 'balance'
    return 'partial'
  }

  const [amount,        setAmount]        = useState('')
  const [method,        setMethod]        = useState('cash')
  const [type,          setType]          = useState('advance')
  const [date,          setDate]          = useState(today())
  const [reference,     setReference]     = useState('')
  const [notes,         setNotes]         = useState('')
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState(null)

  const balanceDue = parseFloat(order.balance_due || 0)

  const handleAmountChange = (val) => {
    setAmount(val)
    setType(suggestType(val))
  }

  // Quick-fill: click balance due to auto-fill full remaining amount
  const fillBalance = () => {
    setAmount(balanceDue.toFixed(2))
    setType('balance')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    const parsedAmount = parseFloat(amount)
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0)
      return setError('Enter a valid amount.')
    if (parsedAmount > balanceDue + 0.01)
      return setError(`Cannot exceed balance due of ${fmt(balanceDue)}.`)

    setSaving(true)
    try {
      await addPayment(order.id, {
        amount:          parsedAmount,
        payment_method:  method,
        payment_type:    type,
        payment_date:    date,
        reference:       reference || null,
        notes:           notes     || null,
      })
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.error || 'Could not record payment.')
    } finally {
      setSaving(false)
    }
  }

  return (
    // Backdrop
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">Record Payment</h2>
            <p className="text-xs text-gray-400 mt-0.5">{order.order_number} · {order.customer_name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>

        {/* Balance due banner */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm text-gray-500">Balance Due</span>
          <div className="flex items-center gap-3">
            <span className={`text-base font-bold ${balanceDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {fmt(balanceDue)}
            </span>
            {balanceDue > 0 && (
              <button
                type="button"
                onClick={fillBalance}
                className="text-xs text-brand-600 hover:text-brand-700 font-medium border border-brand-200 rounded px-2 py-0.5"
              >
                Fill full
              </button>
            )}
          </div>
        </div>

        {balanceDue <= 0 ? (
          <div className="px-6 py-8 text-center">
            <p className="text-green-600 font-semibold text-sm">This order is fully paid ✓</p>
            <p className="text-gray-400 text-xs mt-1">No outstanding balance.</p>
            <button onClick={onClose} className="mt-4 text-sm text-gray-500 hover:text-gray-700 font-medium">Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{error}</div>
            )}

            {/* Amount */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Amount (₹) *</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={e => handleAmountChange(e.target.value)}
                placeholder="0.00"
                autoFocus
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Method + Type side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Method</label>
                <select
                  value={method}
                  onChange={e => setMethod(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Type</label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Reference — shown only for UPI/card/bank */}
            {(method === 'upi' || method === 'card' || method === 'bank_transfer') && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  {method === 'upi' ? 'UPI Transaction ID' : 'Reference / Transaction No.'}
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                  placeholder="Optional but recommended"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3 justify-end pt-1">
              <button type="button" onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
                {saving ? 'Saving...' : 'Record Payment'}
              </button>
            </div>

          </form>
        )}
      </div>
    </div>
  )
}
