import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjects } from '@/hooks/useProjects'
import { usePortfolioTaskStats } from '@/hooks/usePortfolioTaskStats'
import { usePortfolioTasks } from '@/hooks/usePortfolioTasks'
import { usePortfolioMilestones } from '@/hooks/usePortfolioMilestones'
import { usePortfolioInsights } from '@/hooks/useAIInsights'
import { computeHealth, healthColor } from '@/lib/healthScore'
import { hasClaudeKey, streamClaude } from '@/lib/claude'
import { clsx } from 'clsx'
import {
  DollarSign, FolderOpen, TrendingUp, Activity, AlertTriangle,
  Download, Sparkles, Loader2, ClipboardCopy, Check, FileDown,
  ChevronRight,
} from 'lucide-react'
import type { Project } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const fmtM = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return fmt(n)
}

const STATUS_COLORS: Record<string, string> = {
  'pre-project':  'bg-slate-500',
  'initiate':     'bg-purple-500',
  'planning':     'bg-blue-500',
  'design':       'bg-cyan-500',
  'construction': 'bg-amber-500',
  'handover':     'bg-orange-500',
  'closeout':     'bg-emerald-500',
  'defect-period':'bg-yellow-500',
  'closed':       'bg-slate-400',
}

const STATUS_LABEL: Record<string, string> = {
  'pre-project': 'Pre-Project', 'initiate': 'Initiate', 'planning': 'Planning',
  'design': 'Design', 'construction': 'Construction', 'handover': 'Handover',
  'closeout': 'Closeout', 'defect-period': 'Defect Period', 'closed': 'Closed',
}

const profileLabels: Record<string, string> = { L: 'Light', S: 'Standard', E: 'Enhanced' }
const profileColors: Record<string, string> = { L: 'bg-blue-500', S: 'bg-emerald-500', E: 'bg-purple-500' }

// ─── Sub-components ───────────────────────────────────────────────────────────

function KPI({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color: string
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-slate-400 text-xs uppercase tracking-wide font-medium">{label}</p>
          <p className="text-xl font-bold text-slate-100 mt-1 truncate">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
        <div className={clsx('p-2 rounded-lg shrink-0 ml-2', color)}>
          <Icon size={16} className="text-white" />
        </div>
      </div>
    </div>
  )
}

function SummaryItem({ label, value, accent, sub }: {
  label: string; value: string; accent?: 'red' | 'green'; sub?: string
}) {
  return (
    <div>
      <p className="text-slate-400 text-xs mb-1">{label}</p>
      <p className={clsx('text-lg font-semibold', accent === 'red' ? 'text-red-400' : accent === 'green' ? 'text-emerald-400' : 'text-slate-100')}>
        {value}
      </p>
      {sub && <p className={clsx('text-xs mt-0.5', accent === 'red' ? 'text-red-500' : accent === 'green' ? 'text-emerald-500' : 'text-slate-400')}>{sub}</p>}
    </div>
  )
}

// ─── PDF Export ───────────────────────────────────────────────────────────────

async function exportAnalyticsPdf(
  active: Project[],
  taskStats: Record<string, { pct: number }>,
  totalBudget: number,
  totalForecast: number,
  totalActual: number,
  avgHealth: number | null,
) {
  const { default: jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const W = 215.9
  const margin = 18
  let y = 0

  // Header
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, W, 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Portfolio Analytics Report', margin, 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(148, 163, 184)
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}  ·  ${active.length} Active Projects`, margin, 18)
  y = 28

  // Portfolio KPIs
  const kpiBgX = [margin, margin + 44, margin + 88, margin + 132]
  const kpiLabels = ['Total Budget', 'Total Forecast', 'Actual Spent', 'Avg Health']
  const kpiValues = [fmtM(totalBudget), fmtM(totalForecast), fmtM(totalActual), avgHealth !== null ? `${avgHealth}/100` : '—']
  const kpiColors: [number, number, number][] = [
    [59, 130, 246], totalForecast > totalBudget ? [239, 68, 68] : [16, 185, 129],
    [245, 158, 11], avgHealth === null ? [100, 116, 139] : avgHealth >= 80 ? [16, 185, 129] : avgHealth >= 60 ? [245, 158, 11] : [239, 68, 68],
  ]
  kpiBgX.forEach((x, i) => {
    doc.setFillColor(30, 41, 59)
    doc.rect(x, y - 2, 40, 14, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...kpiColors[i])
    doc.text(kpiValues[i], x + 20, y + 4, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.setTextColor(100, 116, 139)
    doc.text(kpiLabels[i], x + 20, y + 9.5, { align: 'center' })
  })
  y += 18

  // Health Matrix table header
  doc.setFillColor(30, 41, 59)
  doc.rect(margin, y - 2, W - margin * 2, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(100, 116, 139)
  const tc = [margin + 2, margin + 68, margin + 100, margin + 128, margin + 155, margin + 175]
  doc.text('PROJECT', tc[0], y + 2.5)
  doc.text('STAGE', tc[1], y + 2.5)
  doc.text('HEALTH', tc[2], y + 2.5)
  doc.text('BUDGET', tc[3], y + 2.5)
  doc.text('FORECAST', tc[4], y + 2.5)
  doc.text('VARIANCE', tc[5], y + 2.5)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  for (const p of active) {
    if (y > 240) { doc.addPage(); y = 18 }
    const h = computeHealth(p, { taskCompletionPct: taskStats[p.id]?.pct })
    const over = p.forecastCost > p.totalBudget
    const variance = p.totalBudget - p.forecastCost

    // Health color
    const hc: [number, number, number] = h.total >= 80 ? [16, 185, 129] : h.total >= 60 ? [245, 158, 11] : [239, 68, 68]

    doc.setFillColor(15, 23, 42)
    doc.rect(margin, y - 1, W - margin * 2, 5.5, 'F')
    doc.setTextColor(226, 232, 240)
    doc.text(p.projectName.length > 28 ? p.projectName.slice(0, 26) + '…' : p.projectName, tc[0], y + 3)
    doc.setTextColor(148, 163, 184)
    doc.text(STATUS_LABEL[p.status] ?? p.status, tc[1], y + 3)
    doc.setTextColor(...hc)
    doc.text(String(h.total), tc[2], y + 3)
    doc.setTextColor(226, 232, 240)
    doc.text(fmtM(p.totalBudget), tc[3], y + 3)
    doc.setTextColor(over ? 239 : 16, over ? 68 : 185, over ? 68 : 129)
    doc.text(fmtM(p.forecastCost), tc[4], y + 3)
    doc.setTextColor(variance >= 0 ? 16 : 239, variance >= 0 ? 185 : 68, variance >= 0 ? 129 : 68)
    doc.text(`${variance >= 0 ? '-' : '+'}${fmtM(Math.abs(variance))}`, tc[5], y + 3)
    y += 6
  }
  y += 4

  // Footer
  const pageH = 279
  doc.setFillColor(15, 23, 42)
  doc.rect(0, pageH - 8, W, 8, 'F')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(71, 85, 105)
  doc.text('Generated by ProjeX  ·  Confidential', margin, pageH - 3)
  doc.text(`Portfolio Analytics  ·  ${active.length} active projects`, W - margin, pageH - 3, { align: 'right' })

  doc.save(`Portfolio_Analytics_${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function AnalyticsPage() {
  const navigate = useNavigate()
  const { projects } = useProjects()

  const active = projects.filter(p => p.isActive)
  const activeIds = active.map(p => p.id)
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p.projectName]))

  const { stats: taskStats }       = usePortfolioTaskStats(activeIds)
  const { overdue, upcoming }      = usePortfolioTasks()
  const { milestones: nextMilestones } = usePortfolioMilestones(projectMap)
  const { insights: portfolioInsights } = usePortfolioInsights(activeIds)

  const totalBudget   = active.reduce((s, p) => s + (p.totalBudget || 0), 0)
  const totalActual   = active.reduce((s, p) => s + (p.actualCost || 0), 0)
  const totalForecast = active.reduce((s, p) => s + (p.forecastCost || 0), 0)
  const budgetVariance = totalBudget - totalForecast

  const avgHealth = active.length > 0
    ? Math.round(active.reduce((s, p) => s + computeHealth(p, { taskCompletionPct: taskStats[p.id]?.pct }).total, 0) / active.length)
    : null

  // Computed health for each project
  const projectHealth = active.map(p => ({
    p,
    h: computeHealth(p, { taskCompletionPct: taskStats[p.id]?.pct }),
  }))

  // Off-track projects (health < 60 or forecast over budget or past target)
  const today = new Date()
  const offTrack = projectHealth.filter(({ p, h }) => {
    if (h.total < 60) return true
    if (p.forecastCost > p.totalBudget && p.totalBudget > 0) return true
    if (p.targetCompletionDate && new Date(p.targetCompletionDate) < today) return true
    return false
  })

  // Status & profile breakdowns
  const byStatus  = projects.reduce<Record<string, number>>((acc, p) => { acc[p.status] = (acc[p.status] || 0) + 1; return acc }, {})
  const byProfile = projects.reduce<Record<string, { count: number; budget: number }>>((acc, p) => {
    if (!acc[p.profile]) acc[p.profile] = { count: 0, budget: 0 }
    acc[p.profile].count++
    acc[p.profile].budget += p.totalBudget || 0
    return acc
  }, {})

  // ── Weekly report state ────────────────────────────────────────────────────
  const [weeklyReport, setWeeklyReport] = useState('')
  const [reportLoading, setReportLoading] = useState(false)
  const [reportCopied, setReportCopied] = useState(false)
  const [exporting, setExporting] = useState(false)

  const buildWeeklyContext = () => {
    const critical = portfolioInsights.filter(i => i.severity === 'critical').length
    const warnings  = portfolioInsights.filter(i => i.severity === 'warning').length

    const projectLines = projectHealth.map(({ p, h }) => {
      const over = p.forecastCost > p.totalBudget
      const daysLeft = p.targetCompletionDate
        ? Math.ceil((new Date(p.targetCompletionDate).getTime() - today.getTime()) / 86400000)
        : null
      return `- ${p.projectName} | Stage: ${STATUS_LABEL[p.status] ?? p.status} | Health: ${h.total}/100 | Budget: ${over ? 'OVER by ' + fmtM(p.forecastCost - p.totalBudget) : 'under'} | ${daysLeft !== null ? (daysLeft < 0 ? `${Math.abs(daysLeft)}d OVERDUE` : `${daysLeft}d to completion`) : 'no target date'}`
    }).join('\n')

    const milestoneLines = nextMilestones.slice(0, 5)
      .map(m => `- "${m.name}" — ${m.projectName} — due in ${m.daysUntil} days`)
      .join('\n')

    const insightLines = portfolioInsights.slice(0, 5)
      .map(i => `- [${i.severity.toUpperCase()}] ${i.title}`)
      .join('\n')

    return `WEEKLY PORTFOLIO REPORT CONTEXT
Date: ${today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

PORTFOLIO SUMMARY:
- Active projects: ${active.length}
- Total budget: ${fmtM(totalBudget)} | Total forecast: ${fmtM(totalForecast)} (${totalBudget > 0 ? Math.round((totalForecast / totalBudget) * 100) : 0}% of budget)
- Portfolio variance: ${budgetVariance >= 0 ? fmtM(budgetVariance) + ' under' : fmtM(Math.abs(budgetVariance)) + ' over'} budget
- Avg health score: ${avgHealth ?? 'N/A'}/100
- Off-track projects: ${offTrack.length} (health < 60 or over budget)
- Overdue tasks: ${overdue.length} | Upcoming tasks (14d): ${upcoming.length}
- Risk insights: ${critical} critical, ${warnings} warnings

PROJECTS:
${projectLines || 'No active projects'}

UPCOMING MILESTONES (next 30 days):
${milestoneLines || 'None scheduled'}

ACTIVE RISK INSIGHTS:
${insightLines || 'None'}`
  }

  const generateWeeklyReport = async () => {
    setReportLoading(true)
    setWeeklyReport('')
    setReportCopied(false)

    const context = buildWeeklyContext()
    const prompt = `${context}

Generate a professional weekly portfolio status report for a CRE PM team. Use the data above and be specific — cite project names, numbers, and dates. Keep it executive-ready: clear, factual, and action-oriented.

Format your response exactly like this:

## Weekly Portfolio Report
**Week of ${today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}**

## Executive Summary
[2-3 sentence portfolio-level summary — overall health, key headline, most urgent item]

## Portfolio Status
[One bullet per project: status, key issue or win, any action needed]

## Key Risks & Issues
[Bullet list of top 3-5 risks across the portfolio with specific context]

## Upcoming Milestones
[Bullet list of next 5 milestones with project name and days remaining]

## Priority Actions This Week
[Numbered list of 4-6 specific, actionable items the PM team should do this week]`

    try {
      let text = ''
      await streamClaude(
        [{ role: 'user', content: prompt }],
        chunk => {
          text += chunk
          setWeeklyReport(text)
        },
        'You are a senior CRE portfolio manager assistant. Write concise, professional weekly reports using real project data. Cite specific names and numbers.',
        1200,
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setWeeklyReport(`Error: ${msg}`)
    } finally {
      setReportLoading(false)
    }
  }

  const copyReport = async () => {
    await navigator.clipboard.writeText(weeklyReport)
    setReportCopied(true)
    setTimeout(() => setReportCopied(false), 2000)
  }

  const exportReportPdf = async () => {
    const { default: jsPDF } = await import('jspdf')
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
    const W = 215.9
    const margin = 18
    let y = 18

    pdf.setFillColor(15, 23, 42)
    pdf.rect(0, 0, W, 22, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12)
    pdf.text('Weekly Portfolio Report', margin, 12)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(148, 163, 184)
    pdf.text(`Week of ${today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, W - margin, 12, { align: 'right' })
    y = 28

    pdf.setTextColor(30, 30, 30)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)

    for (const line of weeklyReport.split('\n')) {
      if (y > 260) { pdf.addPage(); y = 18 }
      const clean = line.replace(/\*\*/g, '')
      if (line.startsWith('## ')) {
        y += 3
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.setTextColor(30, 41, 59)
        pdf.text(clean.slice(3), margin, y)
        y += 5
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(30, 30, 30)
      } else if (line.trim()) {
        const wrapped = pdf.splitTextToSize(clean, W - margin * 2)
        wrapped.forEach((l: string) => {
          if (y > 260) { pdf.addPage(); y = 18 }
          pdf.text(l, margin + (line.startsWith('-') || /^\d+\./.test(line.trim()) ? 4 : 0), y)
          y += 5
        })
      } else {
        y += 2
      }
    }
    pdf.save(`Weekly_Report_${today.toISOString().slice(0, 10)}.pdf`)
  }

  const handleExportAnalytics = async () => {
    setExporting(true)
    try {
      await exportAnalyticsPdf(active, taskStats, totalBudget, totalForecast, totalActual, avgHealth)
    } finally {
      setExporting(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Analytics</h1>
          <p className="text-slate-400 text-sm mt-1">Portfolio performance overview</p>
        </div>
        <button
          onClick={handleExportAnalytics}
          disabled={exporting || active.length === 0}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-800 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 shrink-0"
        >
          <Download size={12} /> {exporting ? 'Exporting…' : 'Export PDF'}
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <KPI icon={FolderOpen} label="Active Projects" value={String(active.length)} sub={`${projects.length} total`} color="bg-blue-600" />
        <KPI icon={DollarSign} label="Total Budget" value={fmtM(totalBudget)} sub="Active portfolio" color="bg-emerald-600" />
        <KPI
          icon={TrendingUp}
          label="Portfolio Variance"
          value={`${budgetVariance >= 0 ? '-' : '+'}${fmtM(Math.abs(budgetVariance))}`}
          sub={budgetVariance >= 0 ? 'Under forecast' : 'Over forecast'}
          color={budgetVariance >= 0 ? 'bg-emerald-600' : 'bg-red-600'}
        />
        <KPI
          icon={Activity}
          label="Avg Health Score"
          value={avgHealth !== null ? String(avgHealth) : '—'}
          sub={avgHealth !== null ? (avgHealth >= 80 ? 'Healthy' : avgHealth >= 60 ? 'At Risk' : 'Critical') : 'No projects'}
          color={avgHealth === null ? 'bg-slate-600' : avgHealth >= 80 ? 'bg-emerald-600' : avgHealth >= 60 ? 'bg-amber-600' : 'bg-red-600'}
        />
      </div>

      {/* Off-Track Summary */}
      {offTrack.length > 0 && (
        <div className="bg-red-900/20 border border-red-800/40 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={15} className="text-red-400" />
            <h2 className="text-sm font-semibold text-red-300">Off-Track Projects ({offTrack.length})</h2>
            <span className="text-xs text-slate-400">Health &lt; 60 or over budget</span>
          </div>
          <div className="space-y-2">
            {offTrack.map(({ p, h }) => {
              const over = p.forecastCost > p.totalBudget && p.totalBudget > 0
              const pastDue = p.targetCompletionDate && new Date(p.targetCompletionDate) < today
              const primaryIssue =
                h.budget < 16 ? `Budget risk (${h.budgetLabel})` :
                h.schedule < 15 ? `Schedule risk (${h.scheduleLabel})` :
                h.risk < 8 ? `High risk exposure (${h.riskLabel})` :
                over ? `Forecast over budget by ${fmtM(p.forecastCost - p.totalBudget)}` :
                pastDue ? `Past target completion date` :
                `Health score ${h.total}/100`
              return (
                <button
                  key={p.id}
                  onClick={() => navigate(`/projects/${p.id}`)}
                  className="w-full flex items-center gap-3 text-left px-3 py-2 bg-slate-900/60 rounded-lg hover:bg-slate-900 transition-colors"
                >
                  <span className={clsx(
                    'w-2 h-2 rounded-full shrink-0',
                    h.total < 60 ? 'bg-red-500' : 'bg-amber-500'
                  )} />
                  <span className="text-sm text-slate-200 font-medium truncate flex-1">{p.projectName}</span>
                  <span className="text-xs text-slate-400 shrink-0">{primaryIssue}</span>
                  <ChevronRight size={12} className="text-slate-400 shrink-0" />
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Portfolio Health Matrix */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-slate-100 font-semibold">Portfolio Health Matrix</h2>
            <p className="text-xs text-slate-400 mt-0.5">Project × Health × Budget — sorted worst to best</p>
          </div>
        </div>

        {active.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-10">No active projects.</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 text-xs uppercase tracking-wide border-b border-slate-800 bg-slate-900/60">
                    <th className="text-left px-5 py-2.5">Project</th>
                    <th className="text-left px-4 py-2.5">Stage</th>
                    <th className="text-center px-4 py-2.5">Health</th>
                    <th className="text-right px-4 py-2.5">Budget</th>
                    <th className="text-right px-4 py-2.5">Forecast</th>
                    <th className="text-right px-4 py-2.5">Variance</th>
                    <th className="text-center px-4 py-2.5">Days Left</th>
                    <th className="text-left px-4 py-2.5">Weakness</th>
                  </tr>
                </thead>
                <tbody>
                  {[...projectHealth]
                    .sort((a, b) => a.h.total - b.h.total)
                    .map(({ p, h }) => {
                      const over = p.forecastCost > p.totalBudget && p.totalBudget > 0
                      const variance = p.totalBudget - p.forecastCost
                      const daysLeft = p.targetCompletionDate
                        ? Math.ceil((new Date(p.targetCompletionDate).getTime() - today.getTime()) / 86400000)
                        : null
                      const trafficDot = h.total >= 80 ? 'bg-emerald-500' : h.total >= 60 ? 'bg-amber-500' : 'bg-red-500'
                      const weakness =
                        h.budget === Math.min(h.budget, h.schedule, h.risk, h.taskCompletion) ? 'Budget'
                        : h.schedule === Math.min(h.budget, h.schedule, h.risk, h.taskCompletion) ? 'Schedule'
                        : h.risk === Math.min(h.budget, h.schedule, h.risk, h.taskCompletion) ? 'Risk'
                        : 'Tasks'
                      return (
                        <tr
                          key={p.id}
                          onClick={() => navigate(`/projects/${p.id}`)}
                          className="border-t border-slate-800/60 hover:bg-slate-700/30 cursor-pointer transition-colors"
                        >
                          <td className="px-5 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className={clsx('w-2 h-2 rounded-full shrink-0', trafficDot)} />
                              <p className="text-slate-100 font-medium truncate max-w-[180px]">{p.projectName}</p>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={clsx('text-xs px-2 py-0.5 rounded font-medium text-white', STATUS_COLORS[p.status] ?? 'bg-slate-600')}>
                              {STATUS_LABEL[p.status] ?? p.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={clsx('text-sm font-bold tabular-nums', healthColor(h.total))}>{h.total}</span>
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-400 text-xs">{fmtM(p.totalBudget)}</td>
                          <td className={clsx('px-4 py-2.5 text-right text-xs font-medium', over ? 'text-red-400' : 'text-emerald-400')}>
                            {fmtM(p.forecastCost)}
                          </td>
                          <td className={clsx('px-4 py-2.5 text-right text-xs font-medium', variance >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                            {variance >= 0 ? `-${fmtM(variance)}` : `+${fmtM(Math.abs(variance))}`}
                          </td>
                          <td className={clsx('px-4 py-2.5 text-center text-xs',
                            daysLeft === null ? 'text-slate-400' :
                            daysLeft < 0 ? 'text-red-400 font-medium' :
                            daysLeft <= 30 ? 'text-amber-400' : 'text-slate-400')}>
                            {daysLeft === null ? '—' : daysLeft < 0 ? `${Math.abs(daysLeft)}d over` : `${daysLeft}d`}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={clsx('text-xs px-2 py-0.5 rounded',
                              weakness === 'Budget' ? 'bg-red-900/40 text-red-300' :
                              weakness === 'Schedule' ? 'bg-amber-900/40 text-amber-300' :
                              weakness === 'Risk' ? 'bg-orange-900/40 text-orange-300' :
                              'bg-blue-900/40 text-blue-300'
                            )}>{weakness}</span>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-700/60">
              {[...projectHealth]
                .sort((a, b) => a.h.total - b.h.total)
                .map(({ p, h }) => {
                  const trafficDot = h.total >= 80 ? 'bg-emerald-500' : h.total >= 60 ? 'bg-amber-500' : 'bg-red-500'
                  const over = p.forecastCost > p.totalBudget
                  return (
                    <button
                      key={p.id}
                      onClick={() => navigate(`/projects/${p.id}`)}
                      className="w-full text-left px-4 py-3 hover:bg-slate-700/40 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={clsx('w-2 h-2 rounded-full shrink-0', trafficDot)} />
                          <p className="text-slate-100 text-sm font-medium truncate">{p.projectName}</p>
                        </div>
                        <span className={clsx('text-sm font-bold tabular-nums shrink-0', healthColor(h.total))}>{h.total}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-400 ml-4">
                        <span>{STATUS_LABEL[p.status]}</span>
                        <span className={over ? 'text-red-400' : 'text-emerald-400'}>
                          {fmtM(p.forecastCost)} / {fmtM(p.totalBudget)}
                        </span>
                      </div>
                    </button>
                  )
                })}
            </div>
          </>
        )}
      </div>

      {/* Budget by Project */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-slate-100 font-semibold">Budget by Project</h2>
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-blue-500" /><span className="text-xs text-slate-400">Actual</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-amber-500/70" /><span className="text-xs text-slate-400">Forecast</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-slate-600" /><span className="text-xs text-slate-400">Budget</span></div>
          </div>
        </div>
        {active.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8">No active projects.</p>
        ) : (
          <div className="space-y-5">
            {active.map(p => {
              const budget = p.totalBudget || 0
              const actualPct   = budget > 0 ? Math.min(110, (p.actualCost   / budget) * 100) : 0
              const forecastPct = budget > 0 ? Math.min(110, (p.forecastCost / budget) * 100) : 0
              const over = p.forecastCost > budget
              return (
                <div key={p.id}>
                  <div className="flex items-baseline justify-between mb-1.5 gap-2">
                    <span className="text-slate-200 text-sm font-medium truncate">{p.projectName}</span>
                    <div className="flex items-center gap-3 shrink-0 text-xs">
                      <span className="text-blue-400">A: {fmtM(p.actualCost)}</span>
                      <span className={over ? 'text-red-400 font-medium' : 'text-amber-400'}>F: {fmtM(p.forecastCost)}</span>
                      <span className="text-slate-400">B: {fmtM(budget)}</span>
                    </div>
                  </div>
                  <div className="relative h-4 bg-slate-700 rounded-lg overflow-hidden">
                    <div
                      className={clsx('absolute inset-y-0 left-0 rounded-lg', over ? 'bg-red-500/50' : 'bg-amber-500/50')}
                      style={{ width: `${forecastPct}%` }}
                    />
                    <div
                      className="absolute inset-y-0 left-0 rounded-lg bg-blue-500"
                      style={{ width: `${actualPct}%` }}
                    />
                    <div className="absolute inset-y-0 right-0 w-px bg-slate-500" title="Budget" />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                    <span>0%</span>
                    <span className={over ? 'text-red-500' : 'text-slate-400'}>{Math.round(forecastPct)}% of budget</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Stage + Profile breakdown */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-slate-100 font-semibold mb-4">Projects by Stage</h2>
          <div className="space-y-3">
            {Object.entries(byStatus).map(([status, count]) => (
              <div key={status} className="flex items-center gap-3">
                <div className={clsx('w-2.5 h-2.5 rounded-full shrink-0', STATUS_COLORS[status] ?? 'bg-slate-500')} />
                <span className="text-slate-300 text-sm flex-1">{STATUS_LABEL[status] ?? status}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div className={clsx('h-full rounded-full', STATUS_COLORS[status] ?? 'bg-slate-500')}
                      style={{ width: `${(count / projects.length) * 100}%` }} />
                  </div>
                  <span className="text-slate-400 text-xs w-4 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-slate-100 font-semibold mb-4">Projects by Profile</h2>
          <div className="space-y-4">
            {Object.entries(byProfile).map(([profile, data]) => (
              <div key={profile}>
                <div className="flex justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={clsx('w-5 h-5 rounded flex items-center justify-center text-white text-xs font-bold', profileColors[profile] ?? 'bg-slate-600')}>
                      {profile}
                    </span>
                    <span className="text-slate-300 text-sm">{profileLabels[profile] ?? profile}</span>
                  </div>
                  <span className="text-slate-400 text-sm">{data.count} project{data.count !== 1 ? 's' : ''}</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div className={clsx('h-full rounded-full', profileColors[profile] ?? 'bg-slate-500')}
                    style={{ width: `${(data.count / projects.length) * 100}%` }} />
                </div>
                <p className="text-xs text-slate-400 mt-1">Budget: {fmtM(data.budget)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Portfolio Budget Summary */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-slate-100 font-semibold mb-4">Portfolio Budget Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryItem label="Approved Budget" value={fmtM(totalBudget)} sub="Combined active" />
          <SummaryItem label="Actual Spent" value={fmtM(totalActual)} sub={totalBudget > 0 ? `${Math.round((totalActual / totalBudget) * 100)}% of budget` : undefined} />
          <SummaryItem label="Total Forecast" value={fmtM(totalForecast)} accent={totalForecast > totalBudget ? 'red' : 'green'} sub={totalBudget > 0 ? `${Math.round((totalForecast / totalBudget) * 100)}% of budget` : undefined} />
          <SummaryItem
            label="Budget Variance"
            value={`${budgetVariance >= 0 ? '' : '-'}${fmtM(Math.abs(budgetVariance))}`}
            accent={budgetVariance >= 0 ? 'green' : 'red'}
            sub={budgetVariance >= 0 ? 'Under forecast' : 'Over forecast'}
          />
        </div>
      </div>

      {/* ── 5.1 Auto Weekly Report ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-blue-400" />
            <h2 className="text-slate-100 font-semibold">Weekly Portfolio Report</h2>
            {!hasClaudeKey() && (
              <span className="text-xs text-amber-400 bg-amber-900/30 border border-amber-700/50 px-2 py-0.5 rounded">Requires API key</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {weeklyReport && (
              <>
                <button
                  onClick={copyReport}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-800 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  {reportCopied ? <><Check size={11} /> Copied</> : <><ClipboardCopy size={11} /> Copy</>}
                </button>
                <button
                  onClick={exportReportPdf}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-800 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <FileDown size={11} /> PDF
                </button>
              </>
            )}
            <button
              onClick={generateWeeklyReport}
              disabled={reportLoading || !hasClaudeKey()}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-lg transition-colors font-medium"
            >
              {reportLoading
                ? <><Loader2 size={12} className="animate-spin" /> Generating…</>
                : <><Sparkles size={12} /> Generate Weekly Report</>
              }
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-400 mb-3">
          Pulls live budget, schedule, tasks, milestones, and risk data across all active projects. Outputs an executive-ready report.
        </p>

        {weeklyReport ? (
          <div className="bg-slate-900/60 rounded-lg p-4 space-y-1 max-h-[600px] overflow-y-auto">
            {weeklyReport.split('\n').map((line, i) => {
              if (line.startsWith('## ')) {
                return <p key={i} className="text-slate-100 font-semibold text-sm mt-4 first:mt-0 border-b border-slate-800/50 pb-1">{line.slice(3)}</p>
              } else if (line.startsWith('**') && line.endsWith('**')) {
                return <p key={i} className="text-xs text-slate-400 font-medium -mt-1">{line.replace(/\*\*/g, '')}</p>
              } else if (line.startsWith('- ')) {
                return (
                  <div key={i} className="flex items-start gap-2 ml-2">
                    <span className="mt-1.5 w-1.5 h-1.5 bg-slate-500 rounded-full shrink-0" />
                    <p className="text-sm text-slate-300 leading-relaxed">{line.slice(2)}</p>
                  </div>
                )
              } else if (/^\d+\./.test(line.trim())) {
                return (
                  <div key={i} className="flex items-start gap-2 ml-2">
                    <span className="text-xs text-blue-400 font-bold shrink-0 mt-0.5">{line.trim().match(/^\d+/)?.[0]}.</span>
                    <p className="text-sm text-slate-300 leading-relaxed">{line.trim().replace(/^\d+\.\s*/, '')}</p>
                  </div>
                )
              } else if (line.trim()) {
                return <p key={i} className="text-sm text-slate-300 leading-relaxed ml-0">{line}</p>
              }
              return <div key={i} className="h-1" />
            })}
            {reportLoading && (
              <span className="inline-block w-1.5 h-4 bg-blue-400 animate-pulse ml-0.5" />
            )}
          </div>
        ) : (
          <div className="bg-slate-900/40 border border-slate-800/50 rounded-lg p-4 text-center text-slate-400">
            <Sparkles size={24} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Click "Generate Weekly Report" to create a full portfolio status report powered by AI.</p>
            <p className="text-xs mt-1 text-slate-400">Report covers: Executive Summary · Project Status · Risks · Milestones · Priority Actions</p>
          </div>
        )}
      </div>
    </div>
  )
}
