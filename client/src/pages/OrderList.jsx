import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getOrders, deleteOrder } from '../api/orders'

const STATUS_STYLES = {
  received:  'bg-gray-100 text-gray-700',
  cutting:   'bg-blue-100 text-blue-700',
  stitching: 'bg-amber-100 text-amber-700',
  finishing: 'bg-orange-100 text-orange-700',
  ready:     'bg-green-100 text-green-700',
  delivered: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-600',
}

const ALL_STATUSES = ['received','cutting','stitching','finishing','ready','delivered','cancelled']

const fmt = (amount) =>
  `₹${parseFloat(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export default function OrderList() {
  const navigate = useNavigate()
  const [orders,       setOrders]       = useState([])
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)

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

  useEffect(() => {
    const t = setTimeout(() => fetchOrders(search, statusFilter), 350)
    return () => clearTimeout(t)
  }, [search, statusFilter, fetchOrders])

  const handleDelete = async (order) => {
    if (!window.confirm(`Cancel order ${order.order_number}? This cannot be undone.`)) return
    try {
      await deleteOrder(order.id)
      setOrders(prev => prev.filter(o => o.id !== order.id))
    } catch { alert('Could not cancel order.') }
  }

  const isOverdue = (order) =>
    order.delivery_date &&
    order.status !== 'delivered' &&
    order.status !== 'cancelled' &&
    new Date(order.delivery_date) < new Date()

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          {!loading && <p className="text-sm text-gray-500 mt-0.5">{orders.length} order{orders.length !== 1 ? 's' : ''}</p>}
        </div>
        <button
          onClick={() => navigate('/orders/new')}
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + New Order
        </button>
      </div>

      {/* Filters */}
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
          {ALL_STATUSES.map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {loading && <div className="text-center py-16 text-gray-400 text-sm">Loading...</div>}
      {!loading && error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
      {!loading && !error && orders.length === 0 && (
        <div className="text-center py-16 text-gray-400 text-sm">
          {search || statusFilter ? 'No orders match your filters.' : 'No orders yet. Create the first one.'}
        </div>
      )}

      {!loading && !error && orders.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Delivery</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-right">Actions</th>
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
                  <td className="px-4 py-3 text-right font-medium text-gray-800">{fmt(order.grand_total)}</td>
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
                    <button onClick={() => handleDelete(order)}
                      className="text-red-500 hover:text-red-700 font-medium text-xs">Cancel</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
