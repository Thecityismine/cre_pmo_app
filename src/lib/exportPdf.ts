import jsPDF from 'jspdf'
import type { Project, Task } from '@/types'
import type { BudgetItem } from '@/hooks/useBudgetItems'
import type { Milestone } from '@/hooks/useMilestones'
import type { ScheduleItem } from '@/hooks/useScheduleItems'
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
  const pageH = 279
  const margin = 18
  let y = 0

  // Full-page dark background
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, W, pageH, 'F')

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
    const dotW = sw * 0.3
    const dotH = 3
    const dotY = y
    // Connector lines between dots
    for (let i = 0; i < stageLabels.length - 1; i++) {
      const sx = margin + i * sw
      const done = i < stageIdx
      doc.setDrawColor(done ? 16 : 30, done ? 185 : 41, done ? 129 : 59)
      doc.setLineWidth(0.4)
      line(sx + sw * 0.35 + dotW, dotY + dotH / 2, sx + sw + sw * 0.35, dotY + dotH / 2)
    }
    stageLabels.forEach((s, i) => {
      const sx = margin + i * sw
      const done = i < stageIdx
      const active = i === stageIdx
      doc.setFillColor(done ? 16 : active ? 59 : 30, done ? 185 : active ? 130 : 41, done ? 129 : active ? 246 : 59)
      rect(sx + sw * 0.35, dotY, dotW, dotH)
      doc.setFontSize(5.5)
      doc.setTextColor(active ? 147 : done ? 100 : 71, active ? 197 : done ? 200 : 85, active ? 253 : done ? 184 : 105)
      text(s, sx + sw / 2, dotY + 7, { align: 'center' })
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

    const cats = Object.entries(grouped)
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

// ─────────────────────────────────────────────────────────────────────────────
// Gantt PDF Export
// ─────────────────────────────────────────────────────────────────────────────

export interface GanttExportOpts {
  spi: number | null
  overallPct: number
  behindCount: number
  criticalIds: Set<string>
}

export function exportGanttPdf(
  project: Project,
  items: ScheduleItem[],
  milestones: Array<{ id: string; name: string; targetDate: string; status: string }>,
  opts: GanttExportOpts,
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const W = 215.9
  const PAGE_H = 279.4
  const M = 14              // horizontal margin
  const INNER_W = W - M * 2
  const LABEL_W = 52        // activity name column width
  const TL_W = INNER_W - LABEL_W  // timeline width
  const ROW_H = 7           // mm per activity row
  const MS_ROW_H = 5.5      // milestone row height
  const HDR_H = 7           // gantt header (month labels) row

  const BG: [number, number, number]     = [15, 23, 42]
  const BG2: [number, number, number]    = [22, 33, 55]
  const DIVIDER: [number, number, number] = [30, 41, 59]
  const TEXT_DIM: [number, number, number] = [100, 116, 139]
  const TEXT_MED: [number, number, number] = [148, 163, 184]
  const TEXT_MAIN: [number, number, number] = [226, 232, 240]

  const BAR: Record<string, [number, number, number]> = {
    complete:     [16, 185, 129],
    'in-progress':[59, 130, 246],
    behind:       [239, 68, 68],
    upcoming:     [71, 85, 105],
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  const fill = (r: number, g: number, b: number) => doc.setFillColor(r, g, b)
  const stroke = (r: number, g: number, b: number) => doc.setDrawColor(r, g, b)
  const color = (r: number, g: number, b: number) => doc.setTextColor(r, g, b)
  const box = (x: number, y: number, w: number, h: number, style: 'F'|'S'|'FD' = 'F') =>
    doc.rect(x, y, w, h, style)
  const ln = (x1: number, y1: number, x2: number, y2: number) => doc.line(x1, y1, x2, y2)
  const txt = (s: string, x: number, y: number, align: 'left'|'center'|'right' = 'left') =>
    doc.text(s, x, y, { align })

  function itemStatus(item: ScheduleItem): 'complete'|'in-progress'|'behind'|'upcoming' {
    if (item.percentComplete === 100) return 'complete'
    if (!item.endDate) return 'upcoming'
    const end = new Date(item.endDate)
    if (end < today) return 'behind'
    if (!item.startDate) return 'upcoming'
    if (new Date(item.startDate) <= today) return 'in-progress'
    return 'upcoming'
  }

  // ── Date window ────────────────────────────────────────────────────────────

  const today = new Date()
  const dates: Date[] = []
  for (const i of items) {
    if (i.startDate)     dates.push(new Date(i.startDate))
    if (i.endDate)       dates.push(new Date(i.endDate))
    if (i.baselineStart) dates.push(new Date(i.baselineStart))
    if (i.baselineEnd)   dates.push(new Date(i.baselineEnd))
  }
  for (const m of milestones) {
    if (m.targetDate) dates.push(new Date(m.targetDate))
  }

  if (dates.length === 0) {
    const s = new Date(today); s.setMonth(s.getMonth() - 1); s.setDate(1)
    const e = new Date(s); e.setMonth(e.getMonth() + 7)
    dates.push(s, e)
  }

  const minDate = new Date(Math.min(...dates.map(d => d.getTime())))
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())))
  const winStart = new Date(minDate); winStart.setDate(winStart.getDate() - 14)
  const winEnd   = new Date(maxDate); winEnd.setDate(maxDate.getDate() + 14)
  const totalMs  = winEnd.getTime() - winStart.getTime()

  const todayPct = Math.max(0, Math.min(1, (today.getTime() - winStart.getTime()) / totalMs))

  function pct(dateStr: string): number | null {
    if (!dateStr) return null
    const d = new Date(dateStr)
    return Math.max(0, Math.min(1, (d.getTime() - winStart.getTime()) / totalMs))
  }

  const months: Array<{ label: string; pct: number }> = []
  const cur = new Date(winStart); cur.setDate(1)
  while (cur <= winEnd) {
    const p = (cur.getTime() - winStart.getTime()) / totalMs
    if (p >= 0 && p <= 1)
      months.push({ label: cur.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), pct: p })
    cur.setMonth(cur.getMonth() + 1)
  }

  // ── Page background ────────────────────────────────────────────────────────

  fill(...BG); box(0, 0, W, PAGE_H)

  // ── Header bar ─────────────────────────────────────────────────────────────

  fill(...BG); box(0, 0, W, 30)

  // Accent line
  fill(59, 130, 246); box(0, 29.5, W, 0.6)

  // Project name
  color(...TEXT_MAIN)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  txt(project.projectName, M, 11)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  color(...TEXT_MED)
  txt(
    [project.projectNumber, [project.city, project.state].filter(Boolean).join(', ')].filter(Boolean).join('  ·  '),
    M, 17,
  )
  txt(
    `Schedule Report  ·  ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
    M, 23,
  )

  // KPI badges (top-right)
  const kpis = [
    { label: 'SPI',       value: opts.spi !== null ? opts.spi.toFixed(2) : 'N/A',
      col: opts.spi === null ? TEXT_DIM : opts.spi >= 1 ? [16,185,129] as [number,number,number] : opts.spi >= 0.8 ? [245,158,11] as [number,number,number] : [239,68,68] as [number,number,number] },
    { label: 'Progress',  value: `${opts.overallPct}%`, col: [59,130,246] as [number,number,number] },
    { label: 'Behind',    value: String(opts.behindCount),
      col: opts.behindCount > 0 ? [239,68,68] as [number,number,number] : [16,185,129] as [number,number,number] },
    { label: 'Activities',value: String(items.length),  col: TEXT_MED },
  ]
  const KPI_W = 24
  const kpiStartX = W - M - kpis.length * (KPI_W + 1.5)
  kpis.forEach((k, i) => {
    const kx = kpiStartX + i * (KPI_W + 1.5)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
    color(...k.col); txt(k.value, kx + KPI_W / 2, 11, 'center')
    doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5)
    color(...TEXT_DIM); txt(k.label, kx + KPI_W / 2, 16, 'center')
  })

  let y = 34

  // ── Gantt chart header (month labels row) ──────────────────────────────────

  fill(...BG2); box(M, y, INNER_W, HDR_H)

  // Column divider & "Activity" label
  stroke(...DIVIDER); doc.setLineWidth(0.3)
  ln(M + LABEL_W, y, M + LABEL_W, y + HDR_H)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5)
  color(...TEXT_MED); txt('Activity', M + 3, y + 4.5)

  // Month tick marks
  doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5)
  color(...TEXT_DIM)
  months.forEach(m => {
    const mx = M + LABEL_W + m.pct * TL_W
    stroke(...DIVIDER); doc.setLineWidth(0.2)
    ln(mx, y, mx, y + HDR_H)
    txt(m.label, mx + 1, y + 4.5)
  })

  // Outer border of chart header
  stroke(...DIVIDER); doc.setLineWidth(0.3)
  box(M, y, INNER_W, HDR_H, 'S')

  y += HDR_H

  // ── Activity rows ──────────────────────────────────────────────────────────

  const ganttTop = y  // remember for today line later

  items.forEach((item, idx) => {
    // Alternating row background
    fill(idx % 2 === 0 ? 15 : 18, idx % 2 === 0 ? 23 : 27, idx % 2 === 0 ? 42 : 50)
    box(M, y, INNER_W, ROW_H)

    const status = itemStatus(item)
    const isCrit = opts.criticalIds.has(item.id)

    // Critical path dot
    if (isCrit) {
      fill(239, 68, 68)
      doc.circle(M + 1.8, y + ROW_H / 2, 0.9, 'F')
    }

    // Activity name (truncated)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6)
    color(...(item.percentComplete === 100 ? TEXT_DIM : TEXT_MAIN))
    const name = item.name.length > 23 ? item.name.slice(0, 21) + '…' : item.name
    txt(name, M + 3.5, y + ROW_H / 2 + 1.5)

    // Dividers
    stroke(...DIVIDER); doc.setLineWidth(0.15)
    ln(M, y + ROW_H, M + INNER_W, y + ROW_H)
    ln(M + LABEL_W, y, M + LABEL_W, y + ROW_H)

    // Month grid lines in timeline
    months.forEach(m => {
      const mx = M + LABEL_W + m.pct * TL_W
      stroke(22, 33, 55); doc.setLineWidth(0.1)
      ln(mx, y, mx, y + ROW_H)
    })

    const tlX = M + LABEL_W
    const barTop = y + ROW_H * 0.2
    const barH   = ROW_H * 0.38

    // Baseline bar (thin, behind actual)
    const bsP = pct(item.baselineStart ?? '')
    const beP = pct(item.baselineEnd ?? '')
    if (bsP !== null && beP !== null && beP > bsP) {
      fill(51, 65, 85)
      box(tlX + bsP * TL_W, y + ROW_H * 0.65, (beP - bsP) * TL_W, 1.2)
    }

    // Actual bar
    const sP = pct(item.startDate ?? '')
    const eP = pct(item.endDate ?? '')
    if (sP !== null && eP !== null && eP > sP) {
      const [r, g, b] = BAR[status]
      const bw = (eP - sP) * TL_W
      // Dark bg of bar (remaining work)
      fill(r >> 1, g >> 1, b >> 1)
      box(tlX + sP * TL_W, barTop, bw, barH)
      // Progress fill (actual completed portion)
      fill(r, g, b)
      box(tlX + sP * TL_W, barTop, bw * (item.percentComplete / 100), barH)
      // Critical path ring
      if (isCrit) {
        stroke(239, 68, 68); doc.setLineWidth(0.3)
        box(tlX + sP * TL_W, barTop, bw, barH, 'S')
      }
    }

    y += ROW_H
  })

  // ── Milestone rows ─────────────────────────────────────────────────────────

  const milestonesWithDates = milestones.filter(m => m.targetDate)
  if (milestonesWithDates.length > 0) {
    // Section sub-header
    fill(...BG2); box(M, y, INNER_W, 5)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(5.5)
    color(...TEXT_DIM); txt('MILESTONES', M + 3, y + 3.5)
    stroke(...DIVIDER); doc.setLineWidth(0.3)
    ln(M + LABEL_W, y, M + LABEL_W, y + 5)
    y += 5

    milestonesWithDates.forEach((m, idx) => {
      fill(idx % 2 === 0 ? 15 : 17, idx % 2 === 0 ? 23 : 26, idx % 2 === 0 ? 42 : 48)
      box(M, y, INNER_W, MS_ROW_H)

      doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5)
      color(...TEXT_DIM)
      const mName = m.name.length > 23 ? m.name.slice(0, 21) + '…' : m.name
      txt(mName, M + 3, y + MS_ROW_H / 2 + 1.5)

      stroke(...DIVIDER); doc.setLineWidth(0.15)
      ln(M, y + MS_ROW_H, M + INNER_W, y + MS_ROW_H)
      ln(M + LABEL_W, y, M + LABEL_W, y + MS_ROW_H)

      months.forEach(mo => {
        const mx = M + LABEL_W + mo.pct * TL_W
        stroke(22, 33, 55); doc.setLineWidth(0.1)
        ln(mx, y, mx, y + MS_ROW_H)
      })

      // Diamond
      const mp = pct(m.targetDate)
      if (mp !== null) {
        const dx = M + LABEL_W + mp * TL_W
        const dy = y + MS_ROW_H / 2
        const d = 2
        const mCol: [number, number, number] =
          m.status === 'complete' ? [16, 185, 129]
          : m.status === 'delayed' ? [239, 68, 68]
          : [245, 158, 11]
        fill(...mCol)
        doc.lines([[d, d], [-d, d], [-d, -d]], dx, dy - d, [1, 1], 'F', true)
      }

      y += MS_ROW_H
    })
  }

  // Outer border of the entire chart body
  stroke(...DIVIDER); doc.setLineWidth(0.3)
  box(M, ganttTop, INNER_W, y - ganttTop, 'S')

  // ── Today line (on top of chart) ───────────────────────────────────────────

  const todayX = M + LABEL_W + todayPct * TL_W
  stroke(245, 158, 11); doc.setLineWidth(0.5)
  ln(todayX, ganttTop, todayX, y)
  fill(245, 158, 11)
  box(todayX - 5, ganttTop - 4, 10, 3.5)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(5)
  color(15, 23, 42); txt('Today', todayX, ganttTop - 1.2, 'center')

  y += 6

  // ── Legend ─────────────────────────────────────────────────────────────────

  fill(...BG2); box(M, y, INNER_W, 11)

  doc.setFont('helvetica', 'bold'); doc.setFontSize(5.5)
  color(...TEXT_DIM); txt('Legend:', M + 2, y + 5)

  const legendItems: Array<{ label: string; type: 'bar'|'base'|'line'|'diamond'; col: [number,number,number] }> = [
    { label: 'Complete',    type: 'bar',     col: [16, 185, 129] },
    { label: 'In Progress', type: 'bar',     col: [59, 130, 246] },
    { label: 'Behind',      type: 'bar',     col: [239, 68, 68]  },
    { label: 'Upcoming',    type: 'bar',     col: [71, 85, 105]  },
    { label: 'Baseline',    type: 'base',    col: [51, 65, 85]   },
    { label: 'Today',       type: 'line',    col: [245, 158, 11] },
    { label: 'Milestone',   type: 'diamond', col: [245, 158, 11] },
  ]

  let lx = M + 14
  legendItems.forEach(li => {
    const ly = y + 6
    if (li.type === 'bar') {
      fill(...li.col); box(lx, ly - 2.2, 7, 2.2)
    } else if (li.type === 'base') {
      fill(...li.col); box(lx, ly - 1.2, 7, 1)
    } else if (li.type === 'line') {
      stroke(...li.col); doc.setLineWidth(0.5)
      ln(lx, ly - 1.2, lx + 4, ly - 1.2)
    } else if (li.type === 'diamond') {
      fill(...li.col)
      doc.lines([[2, 2], [-2, 2], [-2, -2]], lx + 3, ly - 3.2, [1, 1], 'F', true)
    }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5)
    color(...TEXT_DIM); txt(li.label, lx + 8.5, ly)
    lx += li.label.length * 2 + 14
  })

  y += 15

  // ── Footer ─────────────────────────────────────────────────────────────────

  fill(...BG); box(0, PAGE_H - 8, W, 8)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6)
  color(71, 85, 105)
  txt('Generated by ProjeX  ·  Confidential', M, PAGE_H - 3)
  txt(
    `${project.projectName}  ·  Gantt Report  ·  ${new Date().toISOString().split('T')[0]}`,
    W - M, PAGE_H - 3, 'right',
  )

  const safeName = project.projectName.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40)
  doc.save(`${safeName}_Gantt_${new Date().toISOString().split('T')[0]}.pdf`)
}
