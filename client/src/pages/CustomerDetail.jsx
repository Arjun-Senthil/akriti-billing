// CustomerDetail.jsx — Read-only view of a customer + their measurements.
//
// This page is for the shop staff to quickly look up a customer's
// profile and saved measurements before starting an order.
// No editing happens here — that's CustomerForm's job.

import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getCustomerById } from '../api/customers'
import { getGarmentTypes } from '../api/garmentTypes'
import { downloadMeasurementCard } from '../utils/measurementCard'
import MeasurementCardModal from '../components/MeasurementCardModal'

export default function CustomerDetail() {
  const { id }   = useParams()
  const navigate = useNavigate()

  const [customer,    setCustomer]    = useState(null)
  const [allTypes,    setAllTypes]    = useState([])
  const [showModal,   setShowModal]   = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [data, types] = await Promise.all([
          getCustomerById(id),
          getGarmentTypes(),
        ])
        setCustomer(data)
        setAllTypes(types)
      } catch (err) {
        setError('Could not load customer.')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const handleDownload = (selectedTypeIds) => {
    downloadMeasurementCard(customer, selectedTypeIds, allTypes)
    setShowModal(false)
  }

  if (loading) return <div className="text-center py-16 text-gray-400 text-sm">Loading...</div>
  if (error)   return <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
  if (!customer) return null

  return (
    <div className="max-w-2xl">

      {/* ── Header ──────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to="/customers" className="text-sm text-brand-600 hover:underline">
            ← Back to Customers
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">{customer.name}</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowModal(true)}
            className="border border-gray-300 hover:border-gray-400 text-gray-600 hover:text-gray-800 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            ↓ Download Card
          </button>
          <button
            onClick={() => navigate(`/customers/${id}/edit`)}
            className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Edit
          </button>
        </div>
      </div>

      {/* ── Customer Info ────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
          Details
        </h2>
        <dl className="space-y-3">
          <Row label="Phone"   value={customer.phone} />
          <Row label="Email"   value={customer.email   || '—'} />
          <Row label="Address" value={customer.address || '—'} />
          <Row label="Notes"   value={customer.notes   || '—'} />
          <Row
            label="Consent"
            value={
              customer.consent_given
                ? `Given on ${new Date(customer.consent_date).toLocaleDateString('en-IN')}`
                : 'Not recorded'
            }
            valueClass={customer.consent_given ? 'text-green-700' : 'text-red-600'}
          />
          <Row
            label="Since"
            value={new Date(customer.created_at).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'long', year: 'numeric'
            })}
          />
        </dl>
      </div>

      {/* ── Measurements ─────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
          Measurements
        </h2>

        {customer.measurements.length === 0 ? (
          <p className="text-sm text-gray-400">No measurements saved yet.</p>
        ) : (
          <div className="space-y-6">
            {customer.measurements.map(m => (
              <div key={m.id}>
                {/* Garment type heading */}
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  {m.garment_type_name}
                </p>
                {/* Measurement values grid */}
                <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                  {Object.entries(m.measurements).map(([field, value]) => (
                    <div key={field} className="flex justify-between text-sm">
                      <span className="text-gray-500 capitalize">
                        {field.replace(/_/g, ' ')}
                      </span>
                      <span className="font-medium text-gray-800">
                        {value} <span className="text-gray-400 font-normal">in</span>
                      </span>
                    </div>
                  ))}
                </div>
                {m.notes && (
                  <p className="text-xs text-gray-400 mt-2 italic">{m.notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <MeasurementCardModal
          customer={customer}
          allTypes={allTypes}
          onClose={() => setShowModal(false)}
          onDownload={handleDownload}
        />
      )}
    </div>
  )
}

// Small helper component for label-value rows — avoids repetition
function Row({ label, value, valueClass = 'text-gray-800' }) {
  return (
    <div className="flex gap-4">
      <dt className="w-24 text-sm text-gray-500 shrink-0">{label}</dt>
      <dd className={`text-sm ${valueClass}`}>{value}</dd>
    </div>
  )
}
