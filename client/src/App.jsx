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
import OrderList       from './pages/OrderList'
import OrderForm       from './pages/OrderForm'
import OrderDetail     from './pages/OrderDetail'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Layout wraps all pages — sidebar + main area */}
        <Route path="/" element={<Layout />}>

          {/* Default: redirect root to /orders */}
          <Route index element={<Navigate to="/orders" replace />} />

          {/* Customer module */}
          <Route path="customers"          element={<CustomerList />} />
          <Route path="customers/new"      element={<CustomerForm />} />
          <Route path="customers/:id"      element={<CustomerDetail />} />
          <Route path="customers/:id/edit" element={<CustomerForm />} />

          {/* Order module (M3) */}
          <Route path="orders"             element={<OrderList />} />
          <Route path="orders/new"         element={<OrderForm />} />
          <Route path="orders/:id"         element={<OrderDetail />} />
          <Route path="orders/:id/edit"    element={<OrderForm />} />

          {/* Future modules
          <Route path="dashboard"          element={<Dashboard />} />
          <Route path="settings"           element={<Settings />} />
          */}

        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
