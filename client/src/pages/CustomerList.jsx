// CustomerList.jsx — Shows all customers with search and actions.
//
// React concepts used here:
//   useState  — local state (customers array, loading flag, search text)
//   useEffect — side effects (fetch data when component mounts or search changes)
//   useNavigate — programmatic navigation (go to /customers/new on button click)
//
// The search uses a debounce pattern: we wait 400ms after the user
// stops typing before firing the API call. Without this, every keystroke
// would trigger a request — bad UX and wasteful.

import { useState, useEffect, useCallback } from 'react'
import { useNavigate }                       from 'react-router-dom'
import { getCustomers, getCustomerById, deleteCustomer } from '../api/customers'
import { getGarmentTypes } from '../api/garmentTypes'
import { downloadMeasurementCard } from '../utils/measurementCard'
import MeasurementCardModal from '../components/MeasurementCardModal'

export default function CustomerList() {
  const navigate = useNavigate()

  const [customers,    setCustomers]    = useState([])
  const [search,       setSearch]       = useState('')
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [modalData,    setModalData]    = useState(null)   // { customer, allTypes } when modal open
  const [loadingCard,  setLoadingCard]  = useState(null)   // customer id being fetched for modal

  // fetchCustomers: pulls the list from the API.
  // useCallback memoises this function so it doesn't get recreated
  // on every render — safe to use in a useEffect dependency array.
  const fetchCustomers = useCallback(async (searchTerm) => {
    try {
      setLoading(true)
      setError(null)
      const data = await getCustomers(searchTerm)
      setCustomers(data)
    } catch (err) {
      setError('Could not load customers. Is the server running?')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounced search: wait 400ms after the user stops typing, then fetch.
  // The cleanup function (return () => clearTimeout) cancels the timer
  // if the user types again before 400ms — prevents stale requests.
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCustomers(search)
    }, 400)
    return () => clearTimeout(timer)
  }, [search, fetchCustomers])

  // Open the modal: fetch full customer (with measurements) + all garment types in parallel
  const openCardModal = async (customer) => {
    try {
      setLoadingCard(customer.id)
      const [full, types] = await Promise.all([
        getCustomerById(customer.id),
        getGarmentTypes(),
      ])
      setModalData({ customer: full, allTypes: types })
    } catch (err) {
      alert('Could not load data. Please try again.')
      console.error(err)
    } finally {
      setLoadingCard(null)
    }
  }

  const handleModalDownload = (selectedTypeIds) => {
    downloadMeasurementCard(modalData.customer, selectedTypeIds, modalData.allTypes)
    setModalData(null)
  }

  // Handle delete: confirm first, then soft-delete, then refresh the list.
  const handleDelete = async (customer) => {
    const confirmed = window.confirm(
      `Deactivate ${customer.name}? Their order history will be preserved.`
    )
    if (!confirmed) return

    try {
      await deleteCustomer(customer.id)
      setCustomers(prev => prev.filter(c => c.id !== customer.id))
    } catch (err) {
      alert('Could not deactivate customer. Please try again.')
      console.error(err)
    }
  }

  return (
    <div>

      {/* ── Page header ───────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {!loading && `${customers.length} customer${customers.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={() => navigate('/customers/new')}
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Add Customer
        </button>
      </div>

      {/* ── Search ────────────────────────────────────── */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-sm border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        />
      </div>

      {/* ── States: loading / error / empty / table ───── */}

      {loading && (
        <div className="text-center py-16 text-gray-400 text-sm">Loading...</div>
      )}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && customers.length === 0 && (
        <div className="text-center py-16">
          <p className="text-gray-400 text-sm">
            {search ? `No customers found for "${search}"` : 'No customers yet. Add your first one.'}
          </p>
        </div>
      )}

      {!loading && !error && customers.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Consent</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map(customer => (
                <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {customer.name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {customer.phone}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {customer.email || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {customer.consent_given ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700">
                        Given
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-600">
                        Missing
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <button
                      onClick={() => navigate(`/customers/${customer.id}`)}
                      className="text-gray-500 hover:text-gray-700 font-medium text-xs"
                    >
                      View
                    </button>
                    <button
                      onClick={() => navigate(`/customers/${customer.id}/edit`)}
                      className="text-brand-600 hover:text-brand-700 font-medium text-xs"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => openCardModal(customer)}
                      disabled={loadingCard === customer.id}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-40 font-medium text-xs"
                    >
                      {loadingCard === customer.id ? '...' : '↓ Card'}
                    </button>
                    <button
                      onClick={() => handleDelete(customer)}
                      className="text-red-500 hover:text-red-700 font-medium text-xs"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalData && (
        <MeasurementCardModal
          customer={modalData.customer}
          allTypes={modalData.allTypes}
          onClose={() => setModalData(null)}
          onDownload={handleModalDownload}
        />
      )}
    </div>
  )
}
