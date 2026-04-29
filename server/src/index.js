require('dotenv').config();

const express        = require('express');
const cors           = require('cors');
const pool           = require('./config/database');
const customerRoutes    = require('./routes/customerRoutes');
const garmentTypeRoutes = require('./routes/garmentTypeRoutes');
const orderRoutes       = require('./routes/orderRoutes');
const settingsRoutes    = require('./routes/settingsRoutes');
const errorHandler      = require('./middleware/errorHandler');

const app  = express();
const PORT = process.env.PORT || 3001;

// -------------------------------------------------------------
// Core middleware
// express.json() parses incoming JSON request bodies.
// cors() allows the React frontend (port 3000) to call this API.
// Without cors(), browsers block cross-origin requests.
// -------------------------------------------------------------
app.use(express.json());
app.use(cors());

// -------------------------------------------------------------
// Routes
// Each router is mounted at a base path. All customer endpoints
// will be at /api/customers/... automatically.
// Adding a new module later = one new line here.
// -------------------------------------------------------------
app.use('/api/customers',     customerRoutes);
app.use('/api/garment-types', garmentTypeRoutes);
app.use('/api/orders',        orderRoutes);
app.use('/api/settings',      settingsRoutes);

// -------------------------------------------------------------
// Health check — always keep this working
// -------------------------------------------------------------
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS current_time');
    res.json({
      status:    'healthy',
      timestamp: result.rows[0].current_time,
      service:   'Akriti Billing API',
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error:  error.message,
    });
  }
});

// -------------------------------------------------------------
// Catch-all for undefined routes — must come after all routes
// -------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` });
});

// -------------------------------------------------------------
// Global error handler — must be registered LAST
// Any controller that calls next(err) lands here.
// -------------------------------------------------------------
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`
  ================================================
    Akriti Billing API is running!
    Local:     http://localhost:${PORT}
    Health:    http://localhost:${PORT}/api/health
    Customers: http://localhost:${PORT}/api/customers
  ================================================
  `);
});
