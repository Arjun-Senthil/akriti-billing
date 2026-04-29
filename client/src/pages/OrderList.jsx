import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getOrders, updateOrder } from '../api/orders'

// ── Status display config ────────────────────────────────────────
const STATUS_STYLES = {
  received:  'bg-gray-100 text-gray-700',
  cutting:   'bg-blue-100 text-blue-700',
  stitching: 'bg-amber-100 text-amber-700',
  finishing: 'bg-orange-100 text-orange-700',
  ready:     'bg-green-100 text-green-700',
  delivered: 'bg-emerald-100 text-emerald-800',
}

// Status sort rank — workflow order, NOT alphabetical.
// received is earliest (rank 1), delivered is furthest along (rank 6).
// Sorting by status ASC = "show oldest work first" — most urgent at top.
const STATUS_RANK = {
  received:  1,
  cutting:   2,
  stitching: 3,
  finishing: 4,
  ready:     5,
  delivered: 6,
}

// Status filter options — cancelled intentionally excluded.
// Cancelled orders live in the undo panel below, not in the main list.
const FILTER_STATUSES = ['received', 'cutting', 'stitching', 'finishing', 'ready', 'delivered']

const fmt = (amount) =>
  `₹${parseFloat(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

// ── Time remaining in the 24-hour undo window ────────────────────
// cancelled_at + 24h = expiry. Show "23h 45m left" etc.
const undoTimeLeft = (cancelledAt) => {
  const expiry = new Date(new Date(cancelledAt).getTime() + 24 * 60 * 60 * 1000)
  const msLeft = expiry - Date.now()
  if (msLeft <= 0) return '0m left'
  const hrs  = Math.floor(msLeft / (1000 * 60 * 60))
  const mins = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60))
  return hrs > 0 ? `${hrs}h ${mins}m left` : `${mins}m left`
}

// ── Sort icon ────────────────────────────────────────────────────
// Shows ▲ (asc), ▼ (desc), or neutral ⇅ when column is inactive.
function SortIcon({ field, sortField, sortDir }) {
  if (sortField !== field) return <span className="text-gray-300 ml-1">⇅</span>
  return <span className="text-brand-600 ml-1">{sortDir === 'asc' ? '▲' : '▼'}</span>
}

export default function OrderList() {
  const navigate = useNavigate()

  // ── Data state ────────────────────────────────────────────────
  const [orders,          setOrders]          = useState([])
  const [cancelledOrders, setCancelledOrders] = useState([])

  // ── Filter state ──────────────────────────────────────────────
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // ── Sort state ────────────────────────────────────────────────
  // Default: newest orders first (created_at desc)
  const [sortField, setSortField] = useState('created_at')
  const [sortDir,   setSortDir]   = useState('desc')

  // ── UI state ──────────────────────────────────────────────────
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  // ── Fetch active orders (excludes cancelled — backend handles that) ──
  const fetchOrders = useCallback(async (q, st) => {
    try {
      setLoading(true); setError(null)
      const params = {}
      if (q)  params.search = q
      if (st) params.status = st
      setOrders(await getOrders(params))
    } catch { setError('Could not load orders.') }
    finally  { setLoading(false) }
  }, [])

  // ── Fetch cancelled orders (for the undo panel) ───────────────
  // The backend auto-purges anything > 24hrs old before returning,
  // so whatever comes back here is guaranteed within the undo window.
  const fetchCancelled = useCallback(async () => {
    try {
      const data = await getOrders({ status: 'cancelled' })
      setCancelledOrders(data)
    } catch { /* undo panel is non-critical, fail silently */ }
  }, [])

  // ── Debounced search / filter re-fetch ────────────────────────
  useEffect(() => {
    const t = setTimeout(() => fetchOrders(search, statusFilter), 350)
    return () => clearTimeout(t)
  }, [search, statusFilter, fetchOrders])

  // ── Load cancelled orders once on mount ───────────────────────
  useEffect(() => { fetchCancelled() }, [fetchCancelled])

  // ── Sort handler ──────────────────────────────────────────────
  // Click same column → flip direction. Click different column → sort asc.
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  // ── Client-side sort ──────────────────────────────────────────
  // Data is already fetched — sorting in JS, no extra API call.
  // Fine for a single-store app (hundreds, not millions of orders).
  const sorted = [...orders].sort((a, b) => {
    let cmp = 0

    if (sortField === 'status') {
      // Custom rank — workflow order, not alphabetical
      cmp = (STATUS_RANK[a.status] || 0) - (STATUS_RANK[b.status] || 0)

    } else if (sortField === 'delivery_date') {
      // Orders without a delivery date always sort to the end
      const da = a.delivery_date ? new Date(a.delivery_date) : new Date('9999-12-31')
      const db = b.delivery_date ? new Date(b.delivery_date) : new Date('9999-12-31')
      cmp = da - db

    } else if (sortField === 'order_number') {
      // String compare works: format is AT-YYYY-NNNN (zero-padded)
      cmp = a.order_number.localeCompare(b.order_number)

    } else if (sortField === 'customer_name') {
      cmp = a.customer_name.localeCompare(b.customer_name)

    } else {
      // created_at (default)
      cmp = new Date(a.created_at) - new Date(b.created_at)
    }

    return sortDir === 'asc' ? cmp : -cmp
  })

  // ── Cancel: set status to 'cancelled', NOT a hard delete ─────
  // The 24-hour undo window is anchored to this moment (cancelled_at = NOW() in DB).
  const handleCancel = async (order) => {
    if (!window.confirm(`Cancel order ${order.order_number}?\nYou'll have 24 hours to undo this.`)) return
    try {
      await updateOrder(order.id, { status: 'cancelled' })
      setOrders(prev => prev.filter(o => o.id !== order.id))
      fetchCancelled()
    } catch { alert('Could not cancel order.') }
  }

  // ── Undo: restore cancelled order back to 'received' ─────────
  // Clears cancelled_at in the DB so the order is active again.
  const handleUndo = async (order) => {
    try {
      await updateOrder(order.id, { status: 'received' })
      setCancelledOrders(prev => prev.filter(o => o.id !== order.id))
      fetchOrders(search, statusFilter)
    } catch { alert('Could not undo cancellation.') }
  }

  const isOverdue = (order) =>
    order.delivery_date && new Date(order.delivery_date) < new Date()

  // ── Sortable column header component ─────────────────────────
  const Th = ({ field, children, className = '' }) => (
    <th
      onClick={() => handleSort(field)}
      className={`px-4 py-3 cursor-pointer select-none hover:bg-gray-100 transition-colors ${className}`}
    >
      {children}
      <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
    </th>
  )

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          {!loading && (
            <p className="text-sm text-gray-500 mt-0.5">
              {sorted.length} order{sorted.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <button
          onClick={() => navigate('/orders/new')}
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + New Order
        </button>
      </div>

      {/* ── Filters ────────────────────────────────────────────── */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="Search order no. or customer..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-64"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">All statuses</option>
          {FILTER_STATUSES.map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* ── Loading / error / empty states ─────────────────────── */}
      {loading && <div className="text-center py-16 text-gray-400 text-sm">Loading...</div>}
      {!loading && error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}
      {!loading && !error && sorted.length === 0 && (
        <div className="text-center py-16 text-gray-400 text-sm">
          {search || statusFilter ? 'No orders match your filters.' : 'No orders yet. Create the first one.'}
        </div>
      )}

      {/* ── Main orders table ───────────────────────────────────── */}
      {!loading && !error && sorted.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <Th field="order_number">Order</Th>
                <Th field="customer_name">Customer</Th>
                <Th field="status">Status</Th>
                <Th field="delivery_date">Delivery</Th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map(order => (
                <tr key={order.id} className="hover:bg-gray-50 transition-colors">

                  <td className="px-4 py-3 font-mono font-medium text-gray-900 text-xs">
                    {order.order_number}
                  </td>

                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{order.customer_name}</p>
                    <p className="text-xs text-gray-400">{order.customer_phone}</p>
                  </td>

                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[order.status]}`}>
                      {order.status}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    {order.delivery_date ? (
                      <span className={isOverdue(order) ? 'text-red-600 font-medium' : 'text-gray-600'}>
                        {new Date(order.delivery_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        {isOverdue(order) && ' ⚠'}
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>

                  <td className="px-4 py-3 text-right font-medium text-gray-800">
                    {fmt(order.grand_total)}
                  </td>

                  <td className="px-4 py-3 text-right">
                    <span className={parseFloat(order.balance_due) > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
                      {fmt(order.balance_due)}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-right space-x-3">
                    <button onClick={() => navigate(`/orders/${order.id}`)}
                      className="text-gray-500 hover:text-gray-700 font-medium text-xs">View</button>
                    <button onClick={() => navigate(`/orders/${order.id}/edit`)}
                      className="text-brand-600 hover:text-brand-700 font-medium text-xs">Edit</button>
                    <button onClick={() => handleCancel(order)}
                      className="text-red-500 hover:text-red-700 font-medium text-xs">Cancel</button>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Recently Cancelled — 24-hour undo panel ──────────────
          Only shown when cancelled orders exist within the window.
          After 24hrs, the backend auto-purges them; this section disappears.
      ─────────────────────────────────────────────────────────── */}
      {cancelledOrders.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Recently Cancelled — undo within 24 hrs
          </h2>
          <div className="bg-red-50 border border-red-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-red-100">
                {cancelledOrders.map(order => (
                  <tr key={order.id}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{order.order_number}</td>
                    <td className="px-4 py-3 text-gray-700 font-medium">{order.customer_name}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-600">{fmt(order.grand_total)}</td>
                    <td className="px-4 py-3 text-right text-xs text-red-400 font-medium">
                      {order.cancelled_at ? undoTimeLeft(order.cancelled_at) : ''}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleUndo(order)}
                        className="text-brand-600 hover:text-brand-700 text-xs font-semibold border border-brand-200 bg-white rounded px-2.5 py-1"
                      >
                        Undo
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
