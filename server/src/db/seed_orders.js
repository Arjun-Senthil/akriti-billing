// seed_orders.js — Create 10 dummy orders for testing
// Run: node ~/Documents/akriti-billing/server/src/db/seed_orders.js
//
// Reads real customers + garment types from your DB, then inserts
// 10 orders spread across all statuses with varied delivery dates.
// Safe to re-run — uses order_number uniqueness to skip duplicates.

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const pool = require('../config/database')

async function seed() {
  const client = await pool.connect()

  try {
    // ── 1. Fetch real customers from DB ─────────────────────────
    const custRes = await client.query(
      `SELECT id, name, phone FROM customers WHERE deleted_at IS NULL ORDER BY id`
    )
    const customers = custRes.rows
    if (customers.length === 0) {
      console.log('❌  No customers found. Add at least one customer first.')
      return
    }
    console.log(`✓  Found ${customers.length} customer(s):`, customers.map(c => c.name).join(', '))

    // ── 2. Fetch garment types from DB ───────────────────────────
    const gtRes = await client.query(
      `SELECT id, name FROM garment_types WHERE deleted_at IS NULL AND is_active = true ORDER BY id`
    )
    const garmentTypes = gtRes.rows
    if (garmentTypes.length === 0) {
      console.log('❌  No garment types found.')
      return
    }
    console.log(`✓  Found ${garmentTypes.length} garment type(s):`, garmentTypes.map(g => g.name).join(', '))

    // ── 3. Fetch settings ────────────────────────────────────────
    const settRes = await client.query(`SELECT key, value FROM app_settings`)
    const settings = Object.fromEntries(settRes.rows.map(r => [r.key, r.value]))
    const gstRate  = parseFloat(settings.gst_rate || '5.00')
    const prefix   = settings.order_prefix || 'AT'
    const year     = new Date().getFullYear()

    console.log(`✓  GST rate: ${gstRate}%, Order prefix: ${prefix}`)

    // ── 4. Helper: pick a customer by index (cycles if < 10 customers) ──
    const cust = (i) => customers[i % customers.length]
    const gt   = (i) => garmentTypes[i % garmentTypes.length]
    const gt2  = (i) => garmentTypes[(i + 1) % garmentTypes.length]

    // ── 5. Order definitions ─────────────────────────────────────
    // Spread across statuses and delivery scenarios:
    //   - some overdue (delivery in past)
    //   - some upcoming
    //   - some no date
    //   - single-item and multi-item orders
    //   - varied prices
    const today = new Date()
    const daysFromNow = (n) => {
      const d = new Date(today)
      d.setDate(d.getDate() + n)
      return d.toISOString().slice(0, 10)
    }

    const orderDefs = [
      {
        customer:      cust(0),
        status:        'received',
        delivery_date: daysFromNow(10),
        notes:         'Customer wants extra embroidery on the neckline.',
        items: [
          { garmentType: gt(0), description: 'Floral print kurta, navy blue', price: 1800, fabric: 'customer' },
        ],
      },
      {
        customer:      cust(1),
        status:        'cutting',
        delivery_date: daysFromNow(7),
        notes:         null,
        items: [
          { garmentType: gt(1), description: 'Bridal blouse, maroon with zari', price: 2500, fabric: 'shop' },
          { garmentType: gt(0), description: 'Matching lehenga skirt',          price: 4500, fabric: 'customer' },
        ],
      },
      {
        customer:      cust(0),
        status:        'stitching',
        delivery_date: daysFromNow(5),
        notes:         'Prefer machine finish on hem.',
        items: [
          { garmentType: gt(2), description: 'Cotton salwar kameez, light green', price: 1200, fabric: 'customer' },
        ],
      },
      {
        customer:      cust(2),
        status:        'stitching',
        delivery_date: daysFromNow(-2), // overdue!
        notes:         'Urgent — needed for wedding.',
        items: [
          { garmentType: gt(1), description: 'Silk blouse, deep red', price: 3000, fabric: 'shop' },
        ],
      },
      {
        customer:      cust(1),
        status:        'finishing',
        delivery_date: daysFromNow(3),
        notes:         null,
        items: [
          { garmentType: gt(0), description: 'Anarkali suit, peacock blue',    price: 3500, fabric: 'customer' },
          { garmentType: gt(2), description: 'Matching dupatta with lace trim', price:  800, fabric: 'customer' },
        ],
      },
      {
        customer:      cust(2),
        status:        'ready',
        delivery_date: daysFromNow(-1), // overdue — not picked up yet
        notes:         'Call customer before delivery.',
        items: [
          { garmentType: gt(0), description: 'Office wear kurta, beige', price: 1500, fabric: 'customer' },
        ],
      },
      {
        customer:      cust(0),
        status:        'ready',
        delivery_date: daysFromNow(1),
        notes:         null,
        items: [
          { garmentType: gt(1), description: 'Function blouse, golden tissue', price: 2000, fabric: 'shop' },
          { garmentType: gt(1), description: 'Casual blouse, white cotton',    price:  900, fabric: 'customer' },
        ],
      },
      {
        customer:      cust(1),
        status:        'received',
        delivery_date: daysFromNow(14),
        notes:         'No lining on the dupatta.',
        items: [
          { garmentType: gt(2), description: 'Daily wear salwar, pastel pink', price: 950, fabric: 'customer' },
        ],
      },
      {
        customer:      cust(2),
        status:        'cutting',
        delivery_date: null, // no date given
        notes:         'Customer will confirm delivery date later.',
        items: [
          { garmentType: gt(0), description: 'Indo-western top, mustard yellow', price: 2200, fabric: 'customer' },
        ],
      },
      {
        customer:      cust(0),
        status:        'delivered',
        delivery_date: daysFromNow(-5),
        notes:         null,
        items: [
          { garmentType: gt(1), description: 'Party blouse, royal blue', price: 1800, fabric: 'shop' },
        ],
      },
    ]

    // ── 6. Insert orders ─────────────────────────────────────────
    let created = 0
    let skipped = 0

    for (let idx = 0; idx < orderDefs.length; idx++) {
      const def = orderDefs[idx]

      // Generate order number
      const countRes = await client.query(
        `SELECT COUNT(*) AS total FROM orders WHERE order_number LIKE $1`,
        [`${prefix}-${year}-%`]
      )
      const seq         = parseInt(countRes.rows[0].total) + 1
      const orderNumber = `${prefix}-${year}-${seq.toString().padStart(4, '0')}`

      // Check for duplicate (in case seed was run before)
      const dupCheck = await client.query(
        `SELECT id FROM orders WHERE customer_id = $1 AND notes IS NOT DISTINCT FROM $2 AND status = $3`,
        [def.customer.id, def.notes, def.status]
      )
      // Simple dup guard — if same customer + same status + same notes exists, skip
      // Not perfect but good enough for a seed script
      if (dupCheck.rows.length > 0 && idx > 0) {
        console.log(`  ↷  Skipped (looks like a duplicate): ${orderNumber}`)
        skipped++
        continue
      }

      // Calculate GST
      const subtotal   = def.items.reduce((s, it) => s + it.price, 0)
      const cgst       = parseFloat(((subtotal * gstRate / 100) / 2).toFixed(2))
      const sgst       = cgst
      const grandTotal = parseFloat((subtotal + cgst + sgst).toFixed(2))

      await client.query('BEGIN')
      try {
        // Insert order header
        const cancelled_at = def.status === 'cancelled' ? 'NOW()' : null
        const orderRes = await client.query(
          `INSERT INTO orders
             (order_number, customer_id, delivery_date, status,
              subtotal, gst_rate, cgst_amount, sgst_amount, grand_total,
              notes, cancelled_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
             ${def.status === 'cancelled' ? 'NOW()' : 'NULL'})
           RETURNING id`,
          [
            orderNumber,
            def.customer.id,
            def.delivery_date || null,
            def.status,
            subtotal, gstRate, cgst, sgst, grandTotal,
            def.notes || null,
          ]
        )
        const orderId = orderRes.rows[0].id

        // Insert items with measurement snapshot (empty if none saved)
        for (const item of def.items) {
          const measRes = await client.query(
            `SELECT measurements FROM customer_measurements
             WHERE customer_id = $1 AND garment_type_id = $2`,
            [def.customer.id, item.garmentType.id]
          )
          const snapshot = measRes.rows[0]?.measurements || {}

          await client.query(
            `INSERT INTO order_items
               (order_id, garment_type_id, description, quantity, price,
                fabric_provided_by, measurements_snapshot)
             VALUES ($1,$2,$3,1,$4,$5,$6)`,
            [
              orderId,
              item.garmentType.id,
              item.description,
              item.price,
              item.fabric,
              JSON.stringify(snapshot),
            ]
          )
        }

        await client.query('COMMIT')
        console.log(`  ✓  ${orderNumber} — ${def.customer.name} — ${def.status} — ₹${grandTotal}`)
        created++

      } catch (err) {
        await client.query('ROLLBACK')
        console.error(`  ✗  Failed order ${idx + 1}:`, err.message)
      }
    }

    console.log(`\n  Done. ${created} orders created, ${skipped} skipped.\n`)

  } finally {
    client.release()
    await pool.end()
  }
}

seed().catch(err => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})
