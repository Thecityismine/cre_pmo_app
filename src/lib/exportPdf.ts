import jsPDF from 'jspdf'
import type { Project, Task } from '@/types'
import type { BudgetItem } from '@/hooks/useBudgetItems'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const STAGE_ORDER = ['pre-project','initiate','planning','design','construction','handover','closeout','defect-period','closed']

export function exportProjectPdf(
  project: Project,
  tasks: Task[],
  budgetItems: BudgetItem[],
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const W = 215.9  // letter width mm
  const margin = 18
  let y = 0

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const text = (str: string, x: number, yPos: number, opts?: Parameters<typeof doc.text>[3]) =>
    doc.text(str, x, yPos, opts)

  const line = (x1: number, y1: number, x2: number, y2: number) =>
    doc.line(x1, y1, x2, y2)

  const rect = (x: number, yPos: number, w: number, h: number, style: 'F' | 'S' | 'FD' = 'F') =>
    doc.rect(x, yPos, w, h, style)

  // ── Header bar ──────────────────────────────────────────────────────────────

  doc.setFillColor(15, 23, 42)   // slate-950
  rect(0, 0, W, 28)

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  text(project.projectName, margin, 11)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)  // slate-400
  text(`${project.projectNumber}  ·  ${[project.city, project.state].filter(Boolean).join(', ')}  ·  ${project.status.replace(/-/g, ' ').toUpperCase()}`, margin, 17)
  text(`Profile: ${project.profile === 'L' ? 'Light' : project.profile === 'S' ? 'Standard' : 'Enhanced'}`, margin, 22)

  // Report date top-right
  doc.setTextColor(100, 116, 139)
  text(`Report: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, W - margin, 22, { align: 'right' })

  y = 34

  // ── Section helper ───────────────────────────────────────────────────────────

  const section = (title: string) => {
    doc.setFillColor(30, 41, 59)  // slate-800
    rect(margin, y, W - margin * 2, 6)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(148, 163, 184)
    text(title.toUpperCase(), margin + 2, y + 4.2)
    y += 9
  }

  const labelValue = (label: string, value: string, x: number, col: number) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    text(label, x, y)
    doc.setTextColor(226, 232, 240)
    text(value || '—', x + col, y)
  }

  // ── Project Info ─────────────────────────────────────────────────────────────

  section('Project Information')
  doc.setFillColor(15, 23, 42)
  rect(margin, y - 2, W - margin * 2, 30)

  const infoCol = 28
  const rowH = 6
  const left = margin + 3
  const right = W / 2 + 3

  labelValue('Client', project.clientName || '—', left, infoCol)
  labelValue('Start Date', project.startDate || '—', right, infoCol)
  y += rowH
  labelValue('Business Unit', project.businessUnit || '—', left, infoCol)
  labelValue('Target Completion', project.targetCompletionDate || '—', right, infoCol)
  y += rowH
  labelValue('Project Manager', project.projectManager || '—', left, infoCol)
  labelValue('Size', project.rsf ? `${(project.rsf).toLocaleString()} RSF` : '—', right, infoCol)
  y += rowH
  labelValue('MER Required', project.hasMER ? 'Yes' : 'No', left, infoCol)
  y += rowH + 3

  // ── Budget Summary ───────────────────────────────────────────────────────────

  section('Budget Summary')

  const budgCols = [
    { label: 'Total Budget',   value: fmt(project.totalBudget),   color: [59, 130, 246] as [number,number,number] },
    { label: 'Committed',      value: fmt(project.committedCost),  color: [139, 92, 246] as [number,number,number] },
    { label: 'Forecast Cost',  value: fmt(project.forecastCost),  color: project.forecastCost > project.totalBudget ? [239, 68, 68] as [number,number,number] : [16, 185, 129] as [number,number,number] },
    { label: 'Actual Cost',    value: fmt(project.actualCost),    color: [245, 158, 11] as [number,number,number] },
  ]
  const boxW = (W - margin * 2 - 6) / 4
  budgCols.forEach((b, i) => {
    const bx = margin + i * (boxW + 2)
    doc.setFillColor(15, 23, 42)
    rect(bx, y - 2, boxW, 14)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...b.color)
    text(b.value, bx + boxW / 2, y + 4, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(100, 116, 139)
    text(b.label, bx + boxW / 2, y + 9, { align: 'center' })
  })
  y += 18

  // Variance note
  const variance = project.totalBudget - project.forecastCost
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  if (variance >= 0) {
    doc.setTextColor(16, 185, 129)
    text(`▼ ${fmt(variance)} under budget`, margin, y)
  } else {
    doc.setTextColor(239, 68, 68)
    text(`▲ ${fmt(Math.abs(variance))} over budget`, margin, y)
  }
  y += 6

  // Budget utilization bar
  const barW = W - margin * 2
  const barH = 3
  doc.setFillColor(30, 41, 59)
  rect(margin, y, barW, barH)
  const pctUsed = project.totalBudget > 0 ? Math.min(1, project.actualCost / project.totalBudget) : 0
  doc.setFillColor(59, 130, 246)
  rect(margin, y, barW * pctUsed, barH)
  y += 7

  // Budget line items table (if any)
  if (budgetItems.length > 0) {
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    const tc = [margin, margin + 55, margin + 95, margin + 120, margin + 145, margin + 170]
    text('Category / Description', tc[0], y)
    text('Budget', tc[2], y, { align: 'right' })
    text('Committed', tc[3], y, { align: 'right' })
    text('Forecast', tc[4], y, { align: 'right' })
    text('Actual', tc[5], y, { align: 'right' })
    y += 2
    doc.setDrawColor(30, 41, 59)
    line(margin, y, W - margin, y)
    y += 3

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(226, 232, 240)
    for (const item of budgetItems.slice(0, 12)) {
      if (y > 230) break
      const desc = item.description.length > 40 ? item.description.slice(0, 38) + '…' : item.description
      text(desc, tc[0], y)
      text(fmt(item.budgetAmount), tc[2], y, { align: 'right' })
      text(fmt(item.committedAmount), tc[3], y, { align: 'right' })
      text(fmt(item.forecastAmount), tc[4], y, { align: 'right' })
      text(fmt(item.actualAmount), tc[5], y, { align: 'right' })
      y += 5
    }
    y += 2
  }

  // ── Stage Gate ───────────────────────────────────────────────────────────────

  if (y < 200) {
    section('Stage Gate Progress')
    const stageIdx = STAGE_ORDER.indexOf(project.status)
    const stageLabels = ['Pre-Project','Initiate','Planning','Design','Construction','Handover','Closeout','Closed']
    const sw = (W - margin * 2) / stageLabels.length
    stageLabels.forEach((s, i) => {
      const sx = margin + i * sw
      const done = i < stageIdx
      const active = i === stageIdx
      doc.setFillColor(done ? 16 : active ? 59 : 30, done ? 185 : active ? 130 : 41, done ? 129 : active ? 246 : 59)
      rect(sx + sw * 0.35, y, sw * 0.3, 3)
      doc.setFontSize(6)
      doc.setTextColor(active ? 147 : done ? 100 : 71, active ? 197 : done ? 200 : 85, active ? 253 : done ? 184 : 105)
      text(s, sx + sw / 2, y + 7, { align: 'center' })
    })
    y += 13
  }

  // ── Checklist Summary ────────────────────────────────────────────────────────

  if (tasks.length > 0 && y < 210) {
    section('Checklist Summary')

    const done = tasks.filter(t => t.status === 'complete').length
    const blocked = tasks.filter(t => t.status === 'blocked').length
    const pct = Math.round((done / tasks.length) * 100)

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(226, 232, 240)
    text(`${done} / ${tasks.length} tasks complete  (${pct}%)`, margin, y)
    if (blocked > 0) {
      doc.setTextColor(239, 68, 68)
      text(`  ${blocked} blocked`, margin + 60, y)
    }
    y += 4

    // Progress bar
    const cpct = tasks.length > 0 ? Math.min(1, done / tasks.length) : 0
    doc.setFillColor(30, 41, 59)
    rect(margin, y, W - margin * 2, 3)
    doc.setFillColor(16, 185, 129)
    rect(margin, y, (W - margin * 2) * cpct, 3)
    y += 6

    // Category breakdown
    const grouped = tasks.reduce<Record<string, { total: number; done: number }>>((acc, t) => {
      const cat = t.category || 'General'
      if (!acc[cat]) acc[cat] = { total: 0, done: 0 }
      acc[cat].total++
      if (t.status === 'complete') acc[cat].done++
      return acc
    }, {})

    const cats = Object.entries(grouped).slice(0, 8)
    const catColW = (W - margin * 2) / Math.min(cats.length, 4)
    cats.forEach(([cat, v], i) => {
      const col = i % 4
      const row = Math.floor(i / 4)
      const cx = margin + col * catColW
      const cy = y + row * 10
      if (cy > 240) return
      const p = Math.round((v.done / v.total) * 100)
      doc.setFillColor(30, 41, 59)
      rect(cx, cy, catColW - 2, 2)
      doc.setFillColor(16, 185, 129)
      rect(cx, cy, (catColW - 2) * (p / 100), 2)
      doc.setFontSize(6.5)
      doc.setTextColor(148, 163, 184)
      const label = cat.length > 18 ? cat.slice(0, 16) + '…' : cat
      text(`${label} ${v.done}/${v.total}`, cx, cy + 5.5)
    })
    const rows = Math.ceil(cats.length / 4)
    y += rows * 10 + 2
  }

  // ── Footer ───────────────────────────────────────────────────────────────────

  doc.setFillColor(15, 23, 42)
  rect(0, 274, W, 6)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(71, 85, 105)
  text('Generated by CRE PMO', margin, 278)
  text(`${project.projectName}  ·  Confidential`, W - margin, 278, { align: 'right' })

  // ── Save ─────────────────────────────────────────────────────────────────────

  const safeName = project.projectName.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40)
  doc.save(`${safeName}_report_${new Date().toISOString().split('T')[0]}.pdf`)
}
