// CustomerSearch.jsx — Searchable customer picker for the Order form.
//
// As staff type a name or phone, matching customers appear in a dropdown.
// Selecting one sets the customer_id in the parent form.
// This avoids a long static dropdown of all customers.

import { useState, useEffect, useRef } from 'react'
import { getCustomers } from '../api/customers'

export default function CustomerSearch({ value, onChange }) {
  // value = { id, name, phone } | null
  const [query,     setQuery]     = useState(value?.name || '')
  const [results,   setResults]   = useState([])
  const [open,      setOpen]      = useState(false)
  const [loading,   setLoading]   = useState(false)
  const containerRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Debounced search
  useEffect(() => {
    if (!query || query === value?.name) { setResults([]); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await getCustomers(query)
        setResults(data)
        setOpen(true)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query, value?.name])

  const select = (customer) => {
    setQuery(customer.name)
    setResults([])
    setOpen(false)
    onChange({ id: customer.id, name: customer.name, phone: customer.phone })
  }

  const clear = () => {
    setQuery('')
    setResults([])
    onChange(null)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); if (!e.target.value) clear() }}
          onFocus={() => results.length && setOpen(true)}
          placeholder="Search customer by name or phone..."
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        {value && (
          <button type="button" onClick={clear} className="text-gray-400 hover:text-gray-600 text-xs px-2">✕</button>
        )}
      </div>

      {/* Selected customer badge */}
      {value && (
        <p className="text-xs text-green-700 mt-1">✓ {value.name} · {value.phone}</p>
      )}

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {loading && <p className="text-xs text-gray-400 px-3 py-2">Searching...</p>}
          {results.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => select(c)}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
            >
              <span className="font-medium text-gray-800">{c.name}</span>
              <span className="text-gray-400 ml-2 text-xs">{c.phone}</span>
            </button>
          ))}
        </div>
      )}

      {open && !loading && query && results.length === 0 && (
        <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2">
          <p className="text-xs text-gray-400">No customers found for "{query}"</p>
        </div>
      )}
    </div>
  )
}
