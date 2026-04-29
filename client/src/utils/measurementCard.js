// measurementCard.js — Thermal-print-friendly measurement card.
//
// Page 1: Customer name + phone + measurements for selected garment types
// Page 2: Notes (always a separate page — print double-sided, pin Page 1)
//
// Rules:
//   - Black and white only
//   - Empty measurement fields still print (blank correction line shown)
//   - Correction line under every measurement value (for manual edits)
//   - Notes section: no correction lines, just heading + content + blank space
//   - All selected measurements fit on Page 1 (tight layout, no overflow)

import { jsPDF } from 'jspdf'

export const downloadMeasurementCard = (customer, selectedTypeIds, allTypes) => {
  if (!customer || !selectedTypeIds?.length) return

  const doc      = new jsPDF({ unit: 'mm', format: 'a5' })
  const pageW    = 148
  const margin   = 12
  const rightX   = pageW - margin
  const contentW = pageW - margin * 2

  // ── Helper: light correction line under each measurement
  const correctionLine = (atY) => {
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.2)
    doc.line(margin + 2, atY, rightX, atY)
  }

  // ── Helper: full-width bold divider
  const divider = (atY) => {
    doc.setDrawColor(50, 50, 50)
    doc.setLineWidth(0.4)
    doc.line(margin, atY, rightX, atY)
  }

  // ── Build the list of sections to print
  // For each selected garment type, find the customer's measurement record.
  // If no record exists, use the field names from the garment type definition
  // and leave values blank — staff can fill by hand.
  const sections = selectedTypeIds.map(typeId => {
    const typeInfo    = allTypes.find(t => t.id === typeId)
    const savedRecord = (customer.measurements || []).find(m => m.garment_type_id === typeId)

    // Fields come from the saved record's measurement_fields (which includes
    // the field names defined for that garment type), or from the type definition
    const fieldNames = savedRecord
      ? savedRecord.measurement_fields   // already an array from the API
      : (typeInfo?.measurement_fields || [])

    // Build field → value map. Empty string if not recorded.
    const values = {}
    fieldNames.forEach(field => {
      values[field] = savedRecord?.measurements?.[field] ?? ''
    })

    return {
      name:   typeInfo?.name || 'Unknown',
      fields: fieldNames,
      values,
    }
  })

  // ── Estimate if everything fits on one page (A5 = 210mm, usable ~185mm)
  // Each garment type: heading (6mm) + fields × 11mm each + gap (6mm)
  // Header block: ~28mm, footer buffer: 10mm
  const estimatedHeight = 28 + sections.reduce((sum, s) => sum + 6 + s.fields.length * 11 + 6, 0)
  const tight = estimatedHeight > 175  // if too tall, compress spacing

  const rowH      = tight ? 9  : 11   // mm per measurement row
  const typeGapH  = tight ? 4  : 6    // mm between garment types
  const headerH   = tight ? 24 : 28   // mm for name/phone block

  // ════════════════════════════════════════════
  // PAGE 1 — MEASUREMENTS
  // ════════════════════════════════════════════

  let y = tight ? 14 : 18

  // Name
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(tight ? 18 : 22)
  doc.setTextColor(0, 0, 0)
  doc.text(customer.name, margin, y)
  y += tight ? 6 : 8

  // Phone
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(50, 50, 50)
  doc.text(customer.phone, margin, y)
  y += tight ? 4 : 6

  divider(y)
  y += tight ? 5 : 7

  // Measurement sections
  sections.forEach((section, idx) => {
    // Garment type heading
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(tight ? 8 : 9)
    doc.setTextColor(0, 0, 0)
    doc.text(section.name.toUpperCase(), margin, y)
    y += tight ? 5 : 6

    // Fields
    section.fields.forEach(field => {
      const label = field
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase())
      const value = section.values[field]

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(tight ? 8 : 9)
      doc.setTextColor(30, 30, 30)
      doc.text(label, margin, y)
      if (value !== '') {
        doc.text(`${value} in`, rightX, y, { align: 'right' })
      }

      y += tight ? 4 : 5
      correctionLine(y)         // blank line for manual correction
      y += tight ? 5 : 6
    })

    // Gap between garment types
    if (idx < sections.length - 1) {
      y += typeGapH - 3
      doc.setDrawColor(210, 210, 210)
      doc.setLineWidth(0.2)
      doc.line(margin, y, rightX, y)
      y += 4
    }
  })

  // Footer on page 1
  const printDate = new Date().toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(150, 150, 150)
  doc.text(`Akriti Tailoring  ·  ${printDate}`, margin, 205)
  doc.text('→ Notes overleaf', rightX, 205, { align: 'right' })

  // ════════════════════════════════════════════
  // PAGE 2 — NOTES
  // Always a separate page — print double-sided.
  // Front = measurements, Back = notes.
  // ════════════════════════════════════════════

  doc.addPage()
  let ny = 18

  // Page 2 mini-header so staff know which customer this belongs to
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(0, 0, 0)
  doc.text(customer.name, margin, ny)
  ny += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.text(customer.phone, margin, ny)
  ny += 5

  divider(ny)
  ny += 8

  // Notes heading
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(0, 0, 0)
  doc.text('Notes', margin, ny)
  ny += 7

  // Notes content from customer profile (if any)
  if (customer.notes) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(40, 40, 40)
    const lines = doc.splitTextToSize(customer.notes, contentW)
    doc.text(lines, margin, ny)
    ny += lines.length * 5 + 6
  }

  // Always draw a bordered empty space for additional notes —
  // even if profile notes exist, the receptionist may want to add more
  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.3)
  doc.rect(margin, ny, contentW, 50)  // 50mm tall empty box

  // Light "write here" hint inside the box
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7)
  doc.setTextColor(200, 200, 200)
  doc.text('Additional notes...', margin + 3, ny + 6)

  // Footer on page 2
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(150, 150, 150)
  doc.text(`Akriti Tailoring  ·  ${printDate}`, margin, 205)
  doc.text('Pin with job card', rightX, 205, { align: 'right' })

  // ── Save
  const safeName = customer.name.replace(/\s+/g, '_')
  doc.save(`Akriti_${safeName}_Measurements.pdf`)
}
