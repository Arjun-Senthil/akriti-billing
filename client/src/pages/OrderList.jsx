import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getOrders, updateOrder } from '../api/orders'

// ── Status config ────────────────────────────────────────────────
// Each status has a left-border color (section header) and a badge style.
// Workflow order: received → cutting → stitching → finishing → ready → delivered
const STATUS_CONFIG = {
  received:  { border: 'border-gray-400',    badge: 'bg-gray-100 text-gray-700',        label: 'Received' },
  cutting:   { border: 'border-blue-400',    badge: 'bg-blue-100 text-blue-700',        label: 'Cutting' },
  stitching: { border: 'border-amber-400',   badge: 'bg-amber-100 text-amber-700',      label: 'Stitching' },
  finishing: { border: 'border-orange-400',  badge: 'bg-orange-100 text-orange-700',    label: 'Finishing' },
  ready:     { border: 'border-green-400',   badge: 'bg-green-100 text-green-700',      label: 'Ready for Pickup' },
  delivered: { border: 'border-emerald-400', badge: 'bg-emerald-100 text-emerald-800',  label: 'Delivered' },
}

// Active statuses shown as sections (delivered is handled separately)
const ACTIVE_STATUSES  = ['received', 'cutting', 'stitching', 'finishing', 'ready']
const FILTER_STATUSES  = ['received', 'cutting', 'stitching', 'finishing', 'ready', 'delivered']

// Sort rank — used when sort=status to order the sections themselves
const STATUS_RANK = { received: 1, cutting: 2, stitching: 3, finishing: 4, ready: 5, delivered: 6 }

const fmt = (amount) =>
  `₹${parseFloat(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

const undoTimeLeft = (cancelledAt) => {
  const expiry = new Date(new Date(cancelledAt).getTime() + 24 * 60 * 60 * 1000)
  const msLeft = expiry - Date.now()
  if (msLeft <= 0) return '0m left'
  const hrs  = Math.floor(msLeft / (1000 * 60 * 60))
  const mins = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60))
  return hrs > 0 ? `${hrs}h ${mins}m left` : `${mins}m left`
}

function SortIcon({ field, sortField, sortDir }) {
  if (sortField !== field) return <span className="text-gray-300 ml-1">⇅</span>
  return <span className="text-brand-600 ml-1">{sortDir === 'asc' ? '▲' : '▼'}</span>
}

// ── StatusSection ────────────────────────────────────────────────
// Renders one collapsible section per status.
// deliveredStyle = true gives the section a muted, de-emphasised look.
function StatusSection({ status, orders, onView, onEdit, onCancel, deliveredStyle = false }) {
  const [open, setOpen] = useState(!deliveredStyle) // delivered starts collapsed
  const cfg = STATUS_CONFIG[status]
  if (orders.length === 0) return null

  const isOverdue = (o) =>
    o.delivery_date &&
    status !== 'delivered' &&
    new Date(o.delivery_date) < new Date()

  return (
    <div className={`rounded-xl border overflow-hidden ${deliveredStyle ? 'border-gray-100 opacity-80' : 'border-gray-200'}`}>

      {/* Section header — click to collapse/expand */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between px-5 py-3 border-l-4 ${cfg.border} ${deliveredStyle ? 'bg-gray-50' : 'bg-white'} hover:bg-gray-50 transition-colors`}
      >
        <div className="flex items-center gap-3">
          <span className={`inline-flex px-2.5 py-0.5 rounded text-xs font-semibold ${cfg.badge}`}>
            {cfg.label}
          </span>
          <span className="text-xs text-gray-400 font-medium">
            {orders.length} order{orders.length !== 1 ? 's' : ''}
          </span>
        </div>
        <span className="text-gray-400 text-sm">{open ? '▾' : '▸'}</span>
      </button>

      {/* Table — only rendered when section is open */}
      {open && (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-t border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wider">
              <th className="px-4 py-2">Order</th>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Delivery</th>
              <th className="px-4 py-2 text-right">Total</th>
              <th className="px-4 py-2 text-right">Balance</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map(order => (
              <tr key={order.id} className="hover:bg-gray-50 transition-colors">

                <td className="px-4 py-3 font-mono font-medium text-gray-900 text-xs">
                  {order.order_number}
                </td>

                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800">{order.customer_name}</p>
                  <p className="text-xs text-gray-400">{order.customer_phone}</p>
                </td>

                <td className="px-4 py-3">
                  {order.delivery_date ? (
                    <span className={isOverdue(order) ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                      {new Date(order.delivery_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      {isOverdue(order) && <span className="ml-1">⚠</span>}
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
                  <button onClick={() => onView(order.id)}
                    className="text-gray-500 hover:text-gray-700 font-medium text-xs">View</button>
                  <button onClick={() => onEdit(order.id)}
                    className="text-brand-600 hover:text-brand-700 font-medium text-xs">Edit</button>
                  {status !== 'delivered' && (
                    <button onClick={() => onCancel(order)}
                      className="text-red-500 hover:text-red-700 font-medium text-xs">Cancel</button>
                  )}
                </td>

              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────
export default function OrderList() {
  const navigate = useNavigate()

  const [orders,          setOrders]          = useState([])
  const [cancelledOrders, setCancelledOrders] = useState([])
  const [search,          setSearch]          = useState('')
  const [statusFilter,    setStatusFilter]    = useState('')
  const [sortField,       setSortField]       = useState('created_at')
  const [sortDir,         setSortDir]         = useState('desc')
  const [loading,         setLoading]         = useState(true)
  const [error,           setError]           = useState(null)

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

  const fetchCancelled = useCallback(async () => {
    try { setCancelledOrders(await getOrders({ status: 'cancelled' })) }
    catch { /* non-critical */ }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => fetchOrders(search, statusFilter), 350)
    return () => clearTimeout(t)
  }, [search, statusFilter, fetchOrders])

  useEffect(() => { fetchCancelled() }, [fetchCancelled])

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  // ── Sort rows within a section ───────────────────────────────
  // Status sort is handled at the section level (section order), so
  // within a section we fall back to created_at when sort=status.
  const sortRows = (rows) => {
    const field = sortField === 'status' ? 'created_at' : sortField
    return [...rows].sort((a, b) => {
      let cmp = 0
      if (field === 'delivery_date') {
        const da = a.delivery_date ? new Date(a.delivery_date) : new Date('9999-12-31')
        const db = b.delivery_date ? new Date(b.delivery_date) : new Date('9999-12-31')
        cmp = da - db
      } else if (field === 'order_number') {
        cmp = a.order_number.localeCompare(b.order_number)
      } else if (field === 'customer_name') {
        cmp = a.customer_name.localeCompare(b.customer_name)
      } else {
        cmp = new Date(a.created_at) - new Date(b.created_at)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }

  // ── Section order: status sort changes section sequence ──────
  // ASC  = workflow order (received first)
  // DESC = reverse workflow (delivered first — useful for end-of-day review)
  const sectionOrder = sortField === 'status' && sortDir === 'desc'
    ? [...ACTIVE_STATUSES].reverse()
    : ACTIVE_STATUSES

  // ── Group orders by status ───────────────────────────────────
  const grouped = {}
  for (const status of [...ACTIVE_STATUSES, 'delivered']) {
    grouped[status] = sortRows(orders.filter(o => o.status === status))
  }

  const totalActive = ACTIVE_STATUSES.reduce((s, st) => s + grouped[st].length, 0)

  // ── Sortable header (used in global filters area only) ───────
  const Th = ({ field, children }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors"
    >
      {children}
      <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
    </button>
  )

  // ── Action handlers ──────────────────────────────────────────
  const handleCancel = async (order) => {
    if (!window.confirm(`Cancel order ${order.order_number}?\nYou'll have 24 hours to undo this.`)) return
    try {
      await updateOrder(order.id, { status: 'cancelled' })
      setOrders(prev => prev.filter(o => o.id !== order.id))
      fetchCancelled()
    } catch { alert('Could not cancel order.') }
  }

  const handleUndo = async (order) => {
    try {
      await updateOrder(order.id, { status: 'received' })
      setCancelledOrders(prev => prev.filter(o => o.id !== order.id))
      fetchOrders(search, statusFilter)
    } catch { alert('Could not undo cancellation.') }
  }

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          {!loading && (
            <p className="text-sm text-gray-500 mt-0.5">
              {totalActive} active order{totalActive !== 1 ? 's' : ''}
              {grouped.delivered.length > 0 && ` · ${grouped.delivered.length} delivered`}
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

      {/* ── Filters + Sort controls ─────────────────────────────── */}
      <div className="flex items-center gap-3 mb-2 flex-wrap">
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
            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
          ))}
        </select>
      </div>

      {/* Sort pills */}
      <div className="flex items-center gap-4 mb-5 text-xs">
        <span className="text-gray-400">Sort by:</span>
        <Th field="created_at">Date</Th>
        <Th field="order_number">Order No.</Th>
        <Th field="customer_name">Customer</Th>
        <Th field="delivery_date">Delivery</Th>
        <Th field="status">Status</Th>
      </div>

      {/* ── Loading / error states ──────────────────────────────── */}
      {loading && <div className="text-center py-16 text-gray-400 text-sm">Loading...</div>}
      {!loading && error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      {/* ── Status sections ─────────────────────────────────────── */}
      {!loading && !error && (
        <div className="space-y-3">

          {/* Active workflow sections in sort order */}
          {sectionOrder.map(status => (
            <StatusSection
              key={status}
              status={status}
              orders={grouped[status]}
              onView={id => navigate(`/orders/${id}`)}
              onEdit={id => navigate(`/orders/${id}/edit`)}
              onCancel={handleCancel}
            />
          ))}

          {/* Empty state — only when no active orders at all */}
          {totalActive === 0 && grouped.delivered.length === 0 && (
            <div className="text-center py-16 text-gray-400 text-sm">
              {search || statusFilter ? 'No orders match your filters.' : 'No orders yet. Create the first one.'}
            </div>
          )}

          {/* ── Delivered section ─────────────────────────────────
              Visually separated and collapsed by default.
              Delivered = done work. No cancel button.
          ──────────────────────────────────────────────────────── */}
          {!statusFilter && grouped.delivered.length > 0 && (
            <div className="pt-2">
              <StatusSection
                status="delivered"
                orders={grouped.delivered}
                onView={id => navigate(`/orders/${id}`)}
                onEdit={id => navigate(`/orders/${id}/edit`)}
                onCancel={handleCancel}
                deliveredStyle={true}
              />
            </div>
          )}

        </div>
      )}

      {/* ── Recently Cancelled — 24-hour undo panel ─────────────── */}
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
