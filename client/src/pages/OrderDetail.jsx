import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getOrderById, updateOrder } from '../api/orders'
import AddPaymentModal from '../components/AddPaymentModal'

const STATUS_STYLES = {
  received:  'bg-gray-100 text-gray-700',
  cutting:   'bg-blue-100 text-blue-700',
  stitching: 'bg-amber-100 text-amber-700',
  finishing: 'bg-orange-100 text-orange-700',
  ready:     'bg-green-100 text-green-700',
  delivered: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-600',
}

const fmt = (amount) =>
  `₹${parseFloat(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—'

const PAYMENT_TYPE_LABELS = {
  advance:       'Advance',
  partial:       'Partial',
  balance:       'Balance',
  due_clearance: 'Due Clearance',
}

export default function OrderDetail() {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const [order,          setOrder]          = useState(null)
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState(null)
  const [showPayModal,   setShowPayModal]   = useState(false)

  const loadOrder = useCallback(async () => {
    try {
      setLoading(true)
      setOrder(await getOrderById(id))
    } catch {
      setError('Could not load order.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadOrder() }, [loadOrder])

  const handleCancel = async () => {
    if (!window.confirm(`Cancel order ${order.order_number}?\nYou'll have 24 hours to undo this from the Orders list.`)) return
    try {
      await updateOrder(order.id, { status: 'cancelled' })
      navigate('/orders')
    } catch {
      alert('Could not cancel order.')
    }
  }

  // After payment recorded — close modal and reload order to show updated balance
  const handlePaymentSuccess = () => {
    setShowPayModal(false)
    loadOrder()
  }

  if (loading) return <div className="text-center py-16 text-gray-400 text-sm">Loading...</div>
  if (error)   return <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
  if (!order)  return null

  const isOverdue =
    order.delivery_date &&
    order.status !== 'delivered' &&
    order.status !== 'cancelled' &&
    new Date(order.delivery_date) < new Date()

  const balanceDue = parseFloat(order.balance_due)
  const amountPaid = parseFloat(order.amount_paid || 0)
  const fullyPaid  = balanceDue <= 0

  return (
    <div className="max-w-2xl mx-auto">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/orders')} className="text-gray-400 hover:text-gray-600 text-sm">
            ← Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 font-mono">{order.order_number}</h1>
            <p className="text-xs text-gray-400 mt-0.5">Created {fmtDate(order.created_at)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[order.status]}`}>
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </span>
          <button
            onClick={() => navigate(`/orders/${id}/edit`)}
            className="text-brand-600 hover:text-brand-700 text-sm font-medium px-3 py-1.5 border border-brand-200 rounded-lg"
          >
            Edit
          </button>
          {order.status !== 'cancelled' && (
            <button
              onClick={handleCancel}
              className="text-red-500 hover:text-red-700 text-sm font-medium px-3 py-1.5 border border-red-200 rounded-lg"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">

        {/* ── Customer ────────────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Customer</h2>
          <p className="font-semibold text-gray-900">{order.customer_name}</p>
          <p className="text-sm text-gray-500 mt-0.5">{order.customer_phone}</p>
          <button
            onClick={() => navigate(`/customers/${order.customer_id}`)}
            className="mt-2 text-xs text-brand-600 hover:text-brand-700 font-medium"
          >
            View profile →
          </button>
        </div>

        {/* ── Delivery & Notes ────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Delivery</h2>
          {order.delivery_date ? (
            <p className={`font-medium text-sm ${isOverdue ? 'text-red-600' : 'text-gray-800'}`}>
              {fmtDate(order.delivery_date)}
              {isOverdue && <span className="ml-2 text-xs font-normal">⚠ Overdue</span>}
            </p>
          ) : (
            <p className="text-gray-400 text-sm">No delivery date set</p>
          )}
          {order.notes && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-1">Notes</p>
              <p className="text-sm text-gray-700 whitespace-pre-line">{order.notes}</p>
            </div>
          )}
        </div>

        {/* ── Items + GST Breakdown ───────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Items</h2>

          <div>
            {order.items?.map((item, idx) => (
              <div key={item.id || idx} className="flex justify-between items-start py-3 border-b border-gray-100 last:border-0">
                <div className="flex-1 mr-4">
                  <p className="text-sm font-medium text-gray-800">
                    {item.garment_type_name}
                    {item.description && <span className="font-normal text-gray-500 ml-2">— {item.description}</span>}
                  </p>
                  {item.fabric_provided_by && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Fabric: {item.fabric_provided_by}{item.fabric_details && ` · ${item.fabric_details}`}
                    </p>
                  )}
                  {item.notes && <p className="text-xs text-gray-400 mt-0.5 italic">{item.notes}</p>}
                </div>
                <p className="text-sm font-medium text-gray-800 shrink-0">{fmt(item.price)}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200 space-y-1.5">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Subtotal</span><span>{fmt(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>CGST ({parseFloat(order.gst_rate || 5) / 2}%)</span>
              <span>{fmt(order.cgst_amount)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>SGST ({parseFloat(order.gst_rate || 5) / 2}%)</span>
              <span>{fmt(order.sgst_amount)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-gray-900 pt-2 border-t border-gray-200">
              <span>Grand Total</span><span>{fmt(order.grand_total)}</span>
            </div>
          </div>
        </div>

        {/* ── Payments ────────────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Payments</h2>

          {order.payments?.length > 0 ? (
            <div className="space-y-2.5 mb-4">
              {order.payments.map((p, idx) => (
                <div key={p.id || idx} className="flex justify-between items-start text-sm">
                  <div>
                    <span className="text-gray-700 font-medium">
                      {PAYMENT_TYPE_LABELS[p.payment_type] || p.payment_type}
                    </span>
                    <span className="text-gray-400 ml-2 text-xs capitalize">· {p.payment_method}</span>
                    {p.reference && <span className="text-gray-400 ml-2 text-xs">· Ref: {p.reference}</span>}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {fmtDate(p.payment_date)}
                      {p.notes && ` · ${p.notes}`}
                    </p>
                  </div>
                  <span className="text-gray-800 font-semibold shrink-0 ml-4">{fmt(p.amount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 mb-4">No payments recorded yet.</p>
          )}

          {/* Totals */}
          <div className="pt-3 border-t border-gray-100 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Amount Paid</span>
              <span className="text-green-600 font-medium">{fmt(amountPaid)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold">
              <span className={balanceDue > 0 ? 'text-red-600' : 'text-green-700'}>Balance Due</span>
              <span className={balanceDue > 0 ? 'text-red-600' : 'text-green-700'}>{fmt(balanceDue)}</span>
            </div>
          </div>

          {/* Record Payment button — active now */}
          {order.status !== 'cancelled' && (
            <button
              onClick={() => setShowPayModal(true)}
              disabled={fullyPaid}
              className={`mt-4 w-full py-2.5 rounded-lg text-sm font-medium transition-colors
                ${fullyPaid
                  ? 'bg-green-50 text-green-600 border border-green-200 cursor-default'
                  : 'bg-brand-600 hover:bg-brand-700 text-white'
                }`}
            >
              {fullyPaid ? '✓ Fully Paid' : '+ Record Payment'}
            </button>
          )}
        </div>

      </div>

      {/* ── Payment Modal ────────────────────────────────────── */}
      {showPayModal && (
        <AddPaymentModal
          order={order}
          onSuccess={handlePaymentSuccess}
          onClose={() => setShowPayModal(false)}
        />
      )}
    </div>
  )
}
