// Layout.jsx — The persistent shell that wraps every page.
//
// Think of this like a master page template. The sidebar and header
// are defined here once. Each page's content renders inside <Outlet />
// which is React Router's placeholder for "whatever page is active".
//
// MuleSoft analogy: this is like a shared API policy (auth header,
// logging) applied to all flows — defined once, applied everywhere.

import { NavLink, Outlet } from 'react-router-dom'

// Nav items — add a new object here when we build each module
const NAV_ITEMS = [
  { to: '/customers', label: 'Customers' },
  // { to: '/orders',    label: 'Orders' },     ← M3
  // { to: '/payments',  label: 'Payments' },   ← M5
  // { to: '/dashboard', label: 'Dashboard' },  ← M7
  // { to: '/settings',  label: 'Settings' },   ← configurable fields
]

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col fixed top-0 left-0 h-full">

        {/* Brand */}
        <div className="px-5 py-4 border-b border-gray-200">
          <p className="text-xl font-bold text-brand-700">Akriti</p>
          <p className="text-xs text-gray-400 mt-0.5">Billing &amp; Orders</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-100 text-brand-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200">
          <p className="text-xs text-gray-400">Single store · v1.0</p>
        </div>
      </aside>

      {/* ── Page content ─────────────────────────────────── */}
      {/* ml-56 pushes content right to clear the fixed sidebar */}
      <main className="ml-56 flex-1 p-8">
        <Outlet />
      </main>

    </div>
  )
}
