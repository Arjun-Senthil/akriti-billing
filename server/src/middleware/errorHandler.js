// =============================================================
// errorHandler.js — Centralized Express error handling middleware
//
// In Express, any function with 4 params (err, req, res, next)
// is treated as an error handler. When a controller calls next(err),
// Express skips all remaining regular middleware and jumps here.
//
// This is the MuleSoft equivalent of a global error handler in
// your API Gateway — one place where all unhandled errors land,
// get logged, and return a consistent JSON response format.
//
// Must be registered LAST in index.js (after all routes).
// =============================================================

const errorHandler = (err, req, res, next) => {
  // Always log the full error server-side for debugging
  console.error(`[ErrorHandler] ${req.method} ${req.path} →`, err.message);
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  // PostgreSQL unique constraint violation (e.g. duplicate phone)
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      error: 'A record with this value already exists',
    });
  }

  // PostgreSQL foreign key violation (e.g. referencing a non-existent customer)
  if (err.code === '23503') {
    return res.status(400).json({
      success: false,
      error: 'Referenced record does not exist',
    });
  }

  // Default: 500 Internal Server Error
  // In development, expose the actual message to help debugging.
  // In production, return a generic message — never leak internals.
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'development'
      ? err.message
      : 'Internal server error',
  });
};

module.exports = errorHandler;
