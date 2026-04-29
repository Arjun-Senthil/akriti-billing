// MeasurementCardModal.jsx
//
// Shown when staff click "↓ Card" on any customer.
// Lets them select which garment types to include before downloading.
//
// Props:
//   customer    — full customer object (with measurements array)
//   allTypes    — all garment types from the DB (id, name, measurement_fields)
//   onClose     — function to close the modal
//   onDownload  — function(selectedTypeIds) called when Download is clicked

import { useState } from 'react'

export default function MeasurementCardModal({ customer, allTypes, onClose, onDownload }) {
  // Pre-select garment types the customer already has measurements for
  const typesWithMeasurements = new Set(
    (customer.measurements || []).map(m => m.garment_type_id)
  )

  const [selected, setSelected] = useState(
    new Set(allTypes.filter(t => typesWithMeasurements.has(t.id)).map(t => t.id))
  )

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll   = () => setSelected(new Set(allTypes.map(t => t.id)))
  const deselectAll = () => setSelected(new Set())

  const handleDownload = () => {
    if (selected.size === 0) return
    onDownload([...selected])
  }

  return (
    // Backdrop — clicking outside closes the modal
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      {/* Modal box — stop click from bubbling to backdrop */}
      <div
        className="bg-white rounded-xl shadow-xl w-80 p-6"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-base font-bold text-gray-900 mb-1">Download Measurement Card</h2>
        <p className="text-xs text-gray-400 mb-4">
          Select garment types to include in the card for {customer.name}.
        </p>

        {/* Select / Deselect all */}
        <div className="flex gap-3 mb-3">
          <button onClick={selectAll}   className="text-xs text-brand-600 hover:underline">Select all</button>
          <button onClick={deselectAll} className="text-xs text-gray-400 hover:underline">Deselect all</button>
        </div>

        {/* Garment type checkboxes */}
        <div className="space-y-2 mb-6">
          {allTypes.map(type => {
            const hasMeasurements = typesWithMeasurements.has(type.id)
            return (
              <label
                key={type.id}
                className="flex items-center gap-3 cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={selected.has(type.id)}
                  onChange={() => toggle(type.id)}
                  className="accent-brand-600"
                />
                <span className="text-sm text-gray-800 group-hover:text-gray-900">
                  {type.name}
                </span>
                {/* Badge showing whether measurements exist */}
                {hasMeasurements ? (
                  <span className="ml-auto text-xs text-green-600">Saved</span>
                ) : (
                  <span className="ml-auto text-xs text-gray-300">Empty</span>
                )}
              </label>
            )
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleDownload}
            disabled={selected.size === 0}
            className="flex-1 bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white text-sm font-medium py-2 rounded-lg transition-colors"
          >
            ↓ Download PDF
          </button>
          <button
            onClick={onClose}
            className="px-4 text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
