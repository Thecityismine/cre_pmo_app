import jsPDF from 'jspdf'
import type { Project, Task } from '@/types'
import type { BudgetItem } from '@/hooks/useBudgetItems'
import type { Milestone } from '@/hooks/useMilestones'
import { computeHealth } from '@/lib/healthScore'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const STAGE_ORDER = ['pre-project','initiate','planning','design','construction','handover','closeout','defect-period','closed']

export interface ExportPdfOptions {
  milestones?: Milestone[]
  approvedCOs?: number
  pendingCOs?: number
  openRfis?: number
  overdueRfis?: number
  taskCompletionPct?: number
}

export function exportProjectPdf(
  project: Project,
  tasks: Task[],
  budgetItems: BudgetItem[],
  opts: ExportPdfOptions = {},
) {
  const {
    milestones = [],
    approvedCOs = 0,
    pendingCOs = 0,
    openRfis = 0,
    overdueRfis = 0,
  } = opts

  const health = computeHealth(project, { taskCompletionPct: opts.taskCompletionPct })

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const W = 215.9
  const margin = 18
  let y = 0

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const text = (str: string, x: number, yPos: number, opts?: Parameters<typeof doc.text>[3]) =>
    doc.text(str, x, yPos, opts)

  const line = (x1: number, y1: number, x2: number, y2: number) =>
    doc.line(x1, y1, x2, y2)

  const rect = (x: number, yPos: number, w: number, h: number, style: 'F' | 'S' | 'FD' = 'F') =>
    doc.rect(x, yPos, w, h, style)

  // health color as RGB
  const healthRgb = (): [number, number, number] =>
    health.total >= 80 ? [16, 185, 129] : health.total >= 60 ? [245, 158, 11] : [239, 68, 68]

  // ── Header bar ───────────────────────────────────────────────────────────────

  doc.setFillColor(15, 23, 42)
  rect(0, 0, W, 30)

  // Health score badge (top-right)
  const [hr, hg, hb] = healthRgb()
  doc.setFillColor(hr, hg, hb)
  rect(W - margin - 22, 4, 22, 22)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(255, 255, 255)
  text(String(health.total), W - margin - 11, 13, { align: 'center' })
  doc.setFontSize(6)
  doc.setFont('helvetica', 'normal')
  text('HEALTH', W - margin - 11, 19, { align: 'center' })
  text('SCORE', W - margin - 11, 23, { align: 'center' })

  // Project name + meta
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  text(project.projectName, margin, 11)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(148, 163, 184)
  text(
    [project.projectNumber, [project.city, project.state].filter(Boolean).join(', '), project.status.replace(/-/g, ' ').toUpperCase()]
      .filter(Boolean).join('  ·  '),
    margin, 17,
  )
  text(
    `Profile: ${project.profile === 'L' ? 'Light' : project.profile === 'S' ? 'Standard' : 'Enhanced'}  ·  Report: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
    margin, 23,
  )

  y = 36

  // ── Section helper ────────────────────────────────────────────────────────────

  const section = (title: string) => {
    doc.setFillColor(30, 41, 59)
    rect(margin, y, W - margin * 2, 6)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(148, 163, 184)
    text(title.toUpperCase(), margin + 2, y + 4.2)
    y += 9
  }

  const labelValue = (label: string, value: string, x: number, col: number) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(100, 116, 139)
    text(label, x, y)
    doc.setTextColor(226, 232, 240)
    text(value || '—', x + col, y)
  }

  // ── Project Information ───────────────────────────────────────────────────────

  section('Project Information')
  doc.setFillColor(15, 23, 42)
  rect(margin, y - 2, W - margin * 2, 30)

  const infoCol = 30
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
  labelValue('Size', project.rsf ? `${project.rsf.toLocaleString()} RSF` : '—', right, infoCol)
  y += rowH
  labelValue('MER Required', project.hasMER ? 'Yes' : 'No', left, infoCol)
  labelValue('Location', [project.address, project.city, project.state].filter(Boolean).join(', ') || '—', right, infoCol)
  y += rowH + 4

  // ── Budget & CO Summary ───────────────────────────────────────────────────────

  section('Budget Summary')

  const netBudget = project.totalBudget + approvedCOs
  const budgCols: { label: string; value: string; color: [number,number,number] }[] = [
    { label: 'Approved Budget',  value: fmt(project.totalBudget), color: [59, 130, 246] },
    { label: 'Approved COs',     value: approvedCOs !== 0 ? `${approvedCOs > 0 ? '+' : ''}${fmt(approvedCOs)}` : '—', color: approvedCOs > 0 ? [239, 68, 68] : [100, 116, 139] },
    { label: 'Net Budget',       value: fmt(netBudget),           color: [139, 92, 246] },
    { label: 'Forecast Cost',    value: fmt(project.forecastCost), color: project.forecastCost > netBudget ? [239, 68, 68] : [16, 185, 129] },
    { label: 'Actual Spent',     value: fmt(project.actualCost),  color: [245, 158, 11] },
  ]

  const boxW = (W - margin * 2 - 8) / 5
  budgCols.forEach((b, i) => {
    const bx = margin + i * (boxW + 2)
    doc.setFillColor(15, 23, 42)
    rect(bx, y - 2, boxW, 14)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...b.color)
    text(b.value, bx + boxW / 2, y + 4, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(100, 116, 139)
    text(b.label, bx + boxW / 2, y + 9, { align: 'center' })
  })
  y += 18

  // Variance note
  const variance = netBudget - project.forecastCost
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  if (variance >= 0) {
    doc.setTextColor(16, 185, 129)
    text(`▼ ${fmt(variance)} under budget`, margin, y)
  } else {
    doc.setTextColor(239, 68, 68)
    text(`▲ ${fmt(Math.abs(variance))} over budget`, margin, y)
  }
  if (pendingCOs > 0) {
    doc.setTextColor(245, 158, 11)
    text(`  ·  ${fmt(pendingCOs)} pending CO exposure`, margin + 50, y)
  }
  y += 5

  // Budget utilization bar
  const barW = W - margin * 2
  doc.setFillColor(30, 41, 59)
  rect(margin, y, barW, 3)
  const pctUsed = netBudget > 0 ? Math.min(1, project.actualCost / netBudget) : 0
  doc.setFillColor(59, 130, 246)
  rect(margin, y, barW * pctUsed, 3)
  y += 7

  // Budget line items (up to 10)
  if (budgetItems.length > 0) {
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    const tc = [margin, margin + 60, margin + 100, margin + 128, margin + 156, margin + 180]
    text('Description', tc[0], y)
    text('Category', tc[1], y)
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
    for (const item of budgetItems.slice(0, 10)) {
      if (y > 220) break
      text(item.description.length > 30 ? item.description.slice(0, 28) + '…' : item.description, tc[0], y)
      text(item.category.length > 14 ? item.category.slice(0, 12) + '…' : item.category, tc[1], y)
      text(fmt(item.budgetAmount), tc[2], y, { align: 'right' })
      text(fmt(item.committedAmount), tc[3], y, { align: 'right' })
      text(fmt(item.forecastAmount), tc[4], y, { align: 'right' })
      text(fmt(item.actualAmount), tc[5], y, { align: 'right' })
      y += 4.5
    }
    if (budgetItems.length > 10) {
      doc.setTextColor(100, 116, 139)
      text(`+ ${budgetItems.length - 10} more line items`, margin, y)
    }
    y += 5
  }

  // ── Open items: RFI + CO ──────────────────────────────────────────────────────

  if ((openRfis > 0 || overdueRfis > 0 || pendingCOs > 0) && y < 230) {
    section('Open Items')
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')

    const items: { label: string; value: string; color: [number,number,number] }[] = []
    if (openRfis > 0) items.push({ label: 'Open RFIs', value: String(openRfis), color: [245, 158, 11] })
    if (overdueRfis > 0) items.push({ label: 'Overdue RFIs', value: String(overdueRfis), color: [239, 68, 68] })
    if (pendingCOs > 0) items.push({ label: 'Pending COs', value: fmt(pendingCOs), color: [245, 158, 11] })

    items.forEach((item, i) => {
      doc.setTextColor(...item.color)
      text(`${item.value}  `, margin + i * 60, y)
      doc.setTextColor(100, 116, 139)
      text(item.label, margin + i * 60 + 14, y)
    })
    y += 8
  }

  // ── Milestone Timeline ────────────────────────────────────────────────────────

  if (milestones.length > 0 && y < 230) {
    section('Milestones')
    doc.setFontSize(6.5)

    const mRowH = 5.5
    const colDate = W / 2 + 10
    const colStatus = W - margin - 20

    // Header
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    text('Milestone', left, y)
    text('Target Date', colDate, y)
    text('Status', colStatus, y)
    y += 2
    doc.setDrawColor(30, 41, 59)
    line(margin, y, W - margin, y)
    y += 3

    doc.setFont('helvetica', 'normal')
    for (const m of milestones.slice(0, 12)) {
      if (y > 260) break
      const statusColor: [number,number,number] =
        m.status === 'complete' ? [16, 185, 129]
        : m.status === 'delayed' ? [239, 68, 68]
        : [100, 116, 139]

      doc.setTextColor(226, 232, 240)
      const nameText = m.name.length > 42 ? m.name.slice(0, 40) + '…' : m.name
      text(nameText, left, y)
      doc.setTextColor(148, 163, 184)
      text(m.targetDate ? new Date(m.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—', colDate, y)
      doc.setTextColor(...statusColor)
      text(m.status.charAt(0).toUpperCase() + m.status.slice(1), colStatus, y)
      y += mRowH
    }
    y += 3
  }

  // ── Stage Gate ────────────────────────────────────────────────────────────────

  if (y < 240) {
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
      doc.setFontSize(5.5)
      doc.setTextColor(active ? 147 : done ? 100 : 71, active ? 197 : done ? 200 : 85, active ? 253 : done ? 184 : 105)
      text(s, sx + sw / 2, y + 7, { align: 'center' })
    })
    y += 13
  }

  // ── Checklist Summary ─────────────────────────────────────────────────────────

  if (tasks.length > 0 && y < 240) {
    section('Checklist Summary')

    const done = tasks.filter(t => t.status === 'complete').length
    const blocked = tasks.filter(t => t.status === 'blocked').length
    const pct = Math.round((done / tasks.length) * 100)

    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(226, 232, 240)
    text(`${done} / ${tasks.length} tasks complete  (${pct}%)`, margin, y)
    if (blocked > 0) {
      doc.setTextColor(239, 68, 68)
      text(`  ·  ${blocked} blocked`, margin + 65, y)
    }
    y += 4

    const cpct = tasks.length > 0 ? Math.min(1, done / tasks.length) : 0
    doc.setFillColor(30, 41, 59)
    rect(margin, y, W - margin * 2, 3)
    doc.setFillColor(16, 185, 129)
    rect(margin, y, (W - margin * 2) * cpct, 3)
    y += 6

    // Category mini-bars
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
      if (cy > 265) return
      const p = Math.round((v.done / v.total) * 100)
      doc.setFillColor(30, 41, 59)
      rect(cx, cy, catColW - 2, 2)
      doc.setFillColor(16, 185, 129)
      rect(cx, cy, (catColW - 2) * (p / 100), 2)
      doc.setFontSize(6)
      doc.setTextColor(148, 163, 184)
      text(`${(cat.length > 18 ? cat.slice(0, 16) + '…' : cat)} ${v.done}/${v.total}`, cx, cy + 5.5)
    })
    const rows = Math.ceil(cats.length / 4)
    y += rows * 10 + 2
  }

  // ── Footer ────────────────────────────────────────────────────────────────────

  const pageH = 279
  doc.setFillColor(15, 23, 42)
  rect(0, pageH - 8, W, 8)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(71, 85, 105)
  text('Generated by ProjeX  ·  Confidential', margin, pageH - 3)
  text(
    `${project.projectName}  ·  Health: ${health.total}/100`,
    W - margin, pageH - 3, { align: 'right' },
  )

  // ── Save ──────────────────────────────────────────────────────────────────────

  const safeName = project.projectName.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40)
  doc.save(`${safeName}_report_${new Date().toISOString().split('T')[0]}.pdf`)
}
