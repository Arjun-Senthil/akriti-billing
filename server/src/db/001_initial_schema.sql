-- =============================================================
-- Akriti Billing App — Initial Database Schema
-- Migration: 001_initial_schema.sql
-- Run: docker exec -i akriti-db psql -U akriti_admin -d akriti_billing < server/src/db/001_initial_schema.sql
--
-- Idempotent: uses IF NOT EXISTS + ON CONFLICT DO NOTHING throughout.
-- Safe to re-run without errors even if tables already exist.
--
-- Design principles:
--   - Single-tenant: one deployment per shop
--   - Soft deletes: data never physically removed (GST audit = 6yr retention)
--   - Audit log: every data change recorded with before/after snapshot
--   - DPDP Act 2023: consent recorded before storing body measurements
--   - NUMERIC(10,2) for all money: no floating point rounding errors
--   - JSONB for flexible fields: measurement names configurable via UI
-- =============================================================


-- -------------------------------------------------------------
-- TABLE 1: app_settings
-- Key-value store for shop configuration — staff change these
-- via the Settings UI, no code changes needed.
-- Examples: gst_rate, shop name, GSTIN, receipt footer, printer width.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_settings (
  id          SERIAL PRIMARY KEY,
  key         VARCHAR(100) NOT NULL UNIQUE,
  value       TEXT NOT NULL,
  description TEXT,
  updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_by  VARCHAR(100) NOT NULL DEFAULT 'system'
);

INSERT INTO app_settings (key, value, description) VALUES
  ('shop_name',        'Akriti',                   'Shop name shown on receipts and invoices'),
  ('shop_address',     '',                          'Shop address printed on receipts'),
  ('shop_phone',       '',                          'Shop contact number on receipts'),
  ('gstin',            '',                          'GST Identification Number (15 digits)'),
  ('gst_rate',         '5.00',                      'Default GST rate in % (e.g. 5.00 for 5%)'),
  ('order_prefix',     'AKR',                       'Prefix for order numbers e.g. AKR-2026-0001'),
  ('thermal_width',    '80',                        'Thermal printer roll width in mm (58 or 80)'),
  ('receipt_footer',   'Thank you for your visit!', 'Footer message printed on receipts'),
  ('currency_symbol',  '₹',                         'Currency symbol shown in the UI'),
  ('backup_enabled',   'true',                      'Whether automated daily backup to S3 is active')
ON CONFLICT (key) DO NOTHING;


-- -------------------------------------------------------------
-- TABLE 2: garment_types
-- Staff can add garment types, rename measurement fields
-- (e.g. "chest" → "seena"), or deactivate types via UI.
-- measurement_fields: JSONB array of field name strings.
-- deleted_at: soft delete — hidden from UI but never removed
-- because historical orders still reference these.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS garment_types (
  id                  SERIAL PRIMARY KEY,
  name                VARCHAR(100) NOT NULL UNIQUE,
  measurement_fields  JSONB NOT NULL DEFAULT '[]',
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMP WITH TIME ZONE
);

INSERT INTO garment_types (name, measurement_fields) VALUES
  ('Blouse',  '["chest", "waist", "shoulder_width", "sleeve_length", "back_length", "front_length", "neck_depth"]'),
  ('Kurta',   '["chest", "waist", "hip", "shoulder_width", "sleeve_length", "length"]'),
  ('Lehenga', '["waist", "hip", "length", "blouse_chest", "blouse_waist", "blouse_back_length"]'),
  ('Pants',   '["waist", "hip", "inseam", "outseam", "thigh", "knee", "bottom_width"]')
ON CONFLICT (name) DO NOTHING;


-- -------------------------------------------------------------
-- TABLE 3: customers
-- consent_given + consent_date: DPDP Act 2023 compliance.
-- Body measurements = personal sensitive data. Consent must be
-- recorded before measurements are stored. Non-negotiable for
-- commercial use and for selling to other businesses.
-- deleted_at: soft delete. Deleted customer's invoices must
-- still be readable for GST audit (6-year legal retention).
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(200) NOT NULL,
  phone         VARCHAR(15)  NOT NULL UNIQUE,
  email         VARCHAR(255),
  address       TEXT,
  notes         TEXT,
  consent_given BOOLEAN NOT NULL DEFAULT FALSE,
  consent_date  TIMESTAMP WITH TIME ZONE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMP WITH TIME ZONE
);


-- -------------------------------------------------------------
-- TABLE 4: customer_measurements
-- One row per customer per garment type.
-- measurements JSONB: {"chest": 36, "waist": 30, ...}
-- Field names match whatever the staff named them in garment_types.
-- Unique constraint: one record per customer per garment type.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_measurements (
  id               SERIAL PRIMARY KEY,
  customer_id      INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  garment_type_id  INTEGER NOT NULL REFERENCES garment_types(id),
  measurements     JSONB NOT NULL DEFAULT '{}',
  notes            TEXT,
  created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  UNIQUE (customer_id, garment_type_id)
);


-- -------------------------------------------------------------
-- TABLE 5: orders
-- Core entity of the app. deleted_at for soft delete — a
-- cancelled or deleted order stays in the DB for GST audit.
-- Order number (AKR-2026-0001) generated by app logic using
-- the order_prefix setting from app_settings.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id            SERIAL PRIMARY KEY,
  order_number  VARCHAR(20) NOT NULL UNIQUE,
  customer_id   INTEGER NOT NULL REFERENCES customers(id),
  order_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date DATE,
  status        VARCHAR(20) NOT NULL DEFAULT 'received'
                  CHECK (status IN ('received','cutting','stitching','finishing','ready','delivered','cancelled')),
  subtotal      NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  gst_rate      NUMERIC(5,2)  NOT NULL DEFAULT 5.00,
  cgst_amount   NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  sgst_amount   NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  grand_total   NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  notes         TEXT,
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMP WITH TIME ZONE
);


-- -------------------------------------------------------------
-- TABLE 6: order_items
-- Each line item in an order (one row per garment being stitched).
-- measurements_snapshot: FROZEN copy of measurements at order time.
-- Even if customer updates measurements later, this snapshot is
-- immutable — like a bank transaction record. Historical accuracy.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
  id                    SERIAL PRIMARY KEY,
  order_id              INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  garment_type_id       INTEGER NOT NULL REFERENCES garment_types(id),
  description           TEXT,
  quantity              INTEGER NOT NULL DEFAULT 1,
  price                 NUMERIC(10,2) NOT NULL,
  fabric_provided_by    VARCHAR(10) NOT NULL DEFAULT 'customer'
                          CHECK (fabric_provided_by IN ('customer','shop')),
  fabric_details        TEXT,
  measurements_snapshot JSONB NOT NULL DEFAULT '{}',
  notes                 TEXT,
  created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);


-- -------------------------------------------------------------
-- TABLE 7: payments
-- Ledger pattern: each payment = one row. Never delete rows.
-- If a payment was entered wrong, add a correcting entry.
-- Balance due = orders.grand_total - SUM(payments.amount)
-- Supports: full upfront, advance+balance, partials, dues/credit.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id              SERIAL PRIMARY KEY,
  order_id        INTEGER NOT NULL REFERENCES orders(id),
  amount          NUMERIC(10,2) NOT NULL,
  payment_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method  VARCHAR(20) NOT NULL DEFAULT 'cash'
                    CHECK (payment_method IN ('cash','upi','card','bank_transfer')),
  payment_type    VARCHAR(20) NOT NULL DEFAULT 'advance'
                    CHECK (payment_type IN ('advance','partial','balance','due_clearance')),
  reference       VARCHAR(100),
  notes           TEXT,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);


-- -------------------------------------------------------------
-- TABLE 8: audit_logs
-- Append-only. Every INSERT, UPDATE, DELETE on every significant
-- table is recorded here via app-layer logging (not DB triggers —
-- app-layer is easier to debug and understand for this project).
-- old_data / new_data: full JSONB snapshots before and after.
-- This table is NEVER updated or deleted — it's a permanent record.
-- BIGSERIAL: expects millions of rows over years of use.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  table_name  VARCHAR(50)  NOT NULL,
  record_id   INTEGER      NOT NULL,
  action      VARCHAR(10)  NOT NULL
                CHECK (action IN ('INSERT','UPDATE','DELETE')),
  old_data    JSONB,
  new_data    JSONB,
  changed_by  VARCHAR(100) NOT NULL DEFAULT 'system',
  changed_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  ip_address  VARCHAR(45)
);


-- =============================================================
-- INDEXES
-- Speed up the most common query patterns.
-- Partial indexes (WHERE deleted_at IS NULL) only index active
-- records — keeps the index small since 99% of queries are for
-- active data, not soft-deleted records.
-- =============================================================

CREATE INDEX IF NOT EXISTS idx_customers_phone       ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_active       ON customers(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_customer_id     ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status          ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_date   ON orders(delivery_date);
CREATE INDEX IF NOT EXISTS idx_orders_active          ON orders(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_order_id      ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_audit_table_record     ON audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_changed_at       ON audit_logs(changed_at);
CREATE INDEX IF NOT EXISTS idx_app_settings_key       ON app_settings(key);


-- =============================================================
-- VERIFY after running:
--   docker exec -it akriti-db psql -U akriti_admin -d akriti_billing -c "\dt"
--   Expect 8 tables: app_settings, audit_logs, customer_measurements,
--   customers, garment_types, order_items, orders, payments
-- =============================================================
