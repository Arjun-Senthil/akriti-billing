// App.jsx — Router configuration. This is the top-level component.
//
// BrowserRouter: enables client-side routing (URL changes without
//   full page reload). Uses the browser's History API under the hood.
//
// Routes + Route: declarative URL-to-component mapping.
//   Think of it like a switch statement — "if the URL is /customers,
//   render <CustomerList />".
//
// The Layout route wraps all other routes. Because Layout contains
// <Outlet />, child routes render inside the Layout's main area.
// This gives every page the sidebar automatically.
//
// Navigate: instantly redirects / → /customers so the app
//   always lands on a meaningful page.

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout          from './components/Layout'
import CustomerList    from './pages/CustomerList'
import CustomerForm    from './pages/CustomerForm'
import CustomerDetail  from './pages/CustomerDetail'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Layout wraps all pages — sidebar + main area */}
        <Route path="/" element={<Layout />}>

          {/* Default: redirect root to /customers */}
          <Route index element={<Navigate to="/customers" replace />} />

          {/* Customer module */}
          <Route path="customers"          element={<CustomerList />} />
          <Route path="customers/new"      element={<CustomerForm />} />
          <Route path="customers/:id"      element={<CustomerDetail />} />
          <Route path="customers/:id/edit" element={<CustomerForm />} />

          {/* Future modules — uncomment as we build them
          <Route path="orders"             element={<OrderList />} />
          <Route path="orders/new"         element={<OrderForm />} />
          <Route path="dashboard"          element={<Dashboard />} />
          <Route path="settings"           element={<Settings />} />
          */}

        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
