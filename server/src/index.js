require('dotenv').config();

const express = require('express');
const cors = require('cors');
const pool = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(cors());

app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS current_time');
    res.json({
      status: 'healthy',
      timestamp: result.rows[0].current_time,
      service: 'Akriti Billing API',
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`
  ================================================
    Akriti Billing API is running!
    Local:  http://localhost:${PORT}
    Health: http://localhost:${PORT}/api/health
  ================================================
  `);
});
