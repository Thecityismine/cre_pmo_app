import { useProjects } from '@/hooks/useProjects'
import { usePortfolioTasks } from '@/hooks/usePortfolioTasks'
import { usePortfolioMilestones } from '@/hooks/usePortfolioMilestones'
import { usePortfolioInsights } from '@/hooks/useAIInsights'
import { usePortfolioTaskStats } from '@/hooks/usePortfolioTaskStats'
import { usePortfolioPendingItems } from '@/hooks/usePortfolioPendingItems'
import { useAuthStore } from '@/store/authStore'
import { useState } from 'react'
import {
  AlertTriangle, CheckCircle, DollarSign, FolderOpen, Clock,
  ChevronRight, TrendingUp, TrendingDown, Calendar, Activity, Sparkles, User,
  RefreshCw, Inbox, FileSignature,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useNavigate } from 'react-router-dom'
import { computeHealth, healthBg, healthColor } from '@/lib/healthScore'
import { hasClaudeKey, callClaude } from '@/lib/claude'
import type { Project } from '@/types'
import type { AIInsight } from '@/hooks/useAIInsights'

// ─── AI Daily Briefing widget ─────────────────────────────────────────────────

interface BriefingProps {
  overdueCount: number
  upcomingCount: number
  avgHealth: number | null
  activeCount: number
  portfolioInsights: AIInsight[]
  nextMilestoneName?: string
  nextMilestoneDays?: number
}

function DailyBriefingWidget(props: BriefingProps) {
  const todayKey = `projex_briefing_${new Date().toISOString().slice(0, 10)}`
  const cached = typeof window !== 'undefined' ? localStorage.getItem(todayKey) : null
  const [bullets, setBullets] = useState<string[]>(cached ? JSON.parse(cached) : [])
  const [loading, setLoading] = useState(false)

  if (!hasClaudeKey()) return null

  const generate = async () => {
    setLoading(true)
    const critical = props.portfolioInsights.filter(i => i.severity === 'critical').length
    const warnings = props.portfolioInsights.filter(i => i.severity === 'warning').length

    const context = `Portfolio: ${props.activeCount} active projects | Avg health: ${props.avgHealth ?? 'N/A'}/100
Overdue tasks: ${props.overdueCount} | Upcoming tasks (14d): ${props.upcomingCount}
Open risks: ${critical} critical, ${warnings} warning${props.nextMilestoneName ? `\nNext milestone: "${props.nextMilestoneName}" in ${props.nextMilestoneDays} days` : ''}
Today: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`

    const prompt = `${context}

You are a CRE PM assistant. Generate exactly 3 action-oriented focus bullets for today's portfolio review. Each bullet should be 1 sentence, specific to the data above, and start with an action verb. Return ONLY a JSON array of 3 strings, no markdown: ["bullet1","bullet2","bullet3"]`

    try {
      const raw = await callClaude([{ role: 'user', content: prompt }], 'You are a brief, action-oriented CRE portfolio assistant. Return only valid JSON arrays.', 300)
      const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
      const parsed = JSON.parse(cleaned) as string[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        setBullets(parsed)
        localStorage.setItem(todayKey, JSON.stringify(parsed))
      }
    } catch {
      // silently fail — briefing is optional
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-slate-800 border border-blue-800/30 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-blue-400" />
          <h3 className="text-sm font-semibold text-blue-300">Today's Focus</h3>
          <span className="text-xs text-slate-500">
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          title={bullets.length > 0 ? 'Refresh briefing' : 'Generate briefing'}
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          {bullets.length === 0 ? 'Generate' : ''}
        </button>
      </div>

      {bullets.length > 0 ? (
        <ul className="space-y-2">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="shrink-0 w-5 h-5 rounded-full bg-blue-900/60 border border-blue-700/50 flex items-center justify-center text-[10px] font-bold text-blue-400 mt-0.5">
                {i + 1}
              </span>
              <p className="text-sm text-slate-300 leading-relaxed">{b}</p>
            </li>
          ))}
        </ul>
      ) : loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <div className="animate-spin w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full" />
          Generating today's focus…
        </div>
      ) : (
        <p className="text-sm text-slate-600 italic">Click "Generate" for an AI-powered daily portfolio briefing.</p>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const fmtM = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return fmt(n)
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  'pre-project':   { label: 'Pre-Project',   color: 'bg-slate-700 text-slate-300' },
  'initiate':      { label: 'Initiate',       color: 'bg-purple-900 text-purple-300' },
  'planning':      { label: 'Planning',       color: 'bg-blue-900 text-blue-300' },
  'design':        { label: 'Design',         color: 'bg-cyan-900 text-cyan-300' },
  'construction':  { label: 'Construction',   color: 'bg-amber-900 text-amber-300' },
  'handover':      { label: 'Handover',       color: 'bg-orange-900 text-orange-300' },
  'closeout':      { label: 'Closeout',       color: 'bg-emerald-900 text-emerald-300' },
  'defect-period': { label: 'Defect Period',  color: 'bg-yellow-900 text-yellow-300' },
  'closed':        { label: 'Closed',         color: 'bg-slate-700 text-slate-400' },
}

function StatusBadge({ status }: { status: string }) {
  const { label, color } = STATUS_MAP[status] ?? { label: status, color: 'bg-slate-700 text-slate-300' }
  return <span className={clsx('px-2 py-0.5 rounded text-xs font-medium', color)}>{label}</span>
}

function HealthBar({ project, taskPct }: { project: Project; taskPct?: number }) {
  const h = computeHealth(project, { taskCompletionPct: taskPct })
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={clsx('h-full rounded-full', healthBg(h.total))} style={{ width: `${h.total}%` }} />
      </div>
      <span className={clsx('text-xs font-semibold w-6 text-right tabular-nums', healthColor(h.total))}>
        {h.total}
      </span>
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color, onClick }: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; color: string; onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={clsx('bg-slate-800 border border-slate-700 rounded-xl p-5', onClick && 'cursor-pointer hover:border-slate-600 transition-colors')}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-slate-100 mt-1">{value}</p>
          {sub && <p className="text-slate-400 text-sm mt-1">{sub}</p>}
        </div>
        <div className={clsx('p-2.5 rounded-lg shrink-0', color)}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
    </div>
  )
}

// ─── Budget summary bars ──────────────────────────────────────────────────────

function BudgetSummaryBars({ projects }: { projects: Project[] }) {
  const navigate = useNavigate()
  const withBudget = projects.filter(p => p.totalBudget > 0)
  if (withBudget.length === 0) return null

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-700">
        <h2 className="text-slate-100 font-semibold text-sm">Budget Utilization</h2>
        <p className="text-xs text-slate-500 mt-0.5">Forecast vs. approved budget per project</p>
      </div>
      <div className="divide-y divide-slate-700/50">
        {withBudget.map(p => {
          const pct = Math.min(110, (p.forecastCost / p.totalBudget) * 100)
          const over = p.forecastCost > p.totalBudget
          return (
            <button
              key={p.id}
              onClick={() => navigate(`/projects/${p.id}`)}
              className="w-full text-left px-5 py-3 hover:bg-slate-700/30 transition-colors"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-slate-200 font-medium truncate">{p.projectName}</span>
                <span className={clsx('text-xs font-medium shrink-0 ml-2', over ? 'text-red-400' : 'text-emerald-400')}>
                  {fmt(p.forecastCost)} / {fmt(p.totalBudget)}
                </span>
              </div>
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={clsx('h-full rounded-full transition-all', over ? 'bg-red-500' : pct > 85 ? 'bg-amber-500' : 'bg-emerald-500')}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Attention Required panel ─────────────────────────────────────────────────

function AttentionRequiredPanel({
  projects,
  taskStats,
  overdueCount,
  criticalInsights,
}: {
  projects: Project[]
  taskStats: Record<string, { pct: number }>
  overdueCount: number
  criticalInsights: AIInsight[]
}) {
  const navigate = useNavigate()

  type Alert = { label: string; sub: string; color: string; projectId?: string }
  const alerts: Alert[] = []

  projects.forEach(p => {
    const h = computeHealth(p, { taskCompletionPct: taskStats[p.id]?.pct })
    if (h.total < 60) {
      alerts.push({
        label: p.projectName,
        sub: `Health ${h.total}/100 — ${h.label}`,
        color: 'text-red-400 border-red-800/50 bg-red-900/10',
        projectId: p.id,
      })
    } else if (p.forecastCost > p.totalBudget && p.totalBudget > 0) {
      alerts.push({
        label: p.projectName,
        sub: `Over budget by ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(p.forecastCost - p.totalBudget)}`,
        color: 'text-amber-400 border-amber-800/50 bg-amber-900/10',
        projectId: p.id,
      })
    }
  })

  if (overdueCount > 0) {
    alerts.push({
      label: `${overdueCount} Overdue Task${overdueCount > 1 ? 's' : ''}`,
      sub: 'Across active projects — review immediately',
      color: 'text-amber-400 border-amber-800/50 bg-amber-900/10',
    })
  }

  criticalInsights.slice(0, 2).forEach(ins => {
    alerts.push({
      label: ins.title,
      sub: 'AI Risk Detection',
      color: 'text-red-400 border-red-800/50 bg-red-900/10',
      projectId: ins.projectId,
    })
  })

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700">
        <AlertTriangle size={14} className={alerts.length > 0 ? 'text-red-400' : 'text-emerald-400'} />
        <h3 className="text-sm font-semibold text-slate-200">Attention Required</h3>
        {alerts.length > 0 && (
          <span className="ml-auto text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full font-medium">
            {alerts.length}
          </span>
        )}
      </div>
      {alerts.length === 0 ? (
        <div className="flex items-center gap-3 px-4 py-4">
          <CheckCircle size={16} className="text-emerald-500 shrink-0" />
          <p className="text-sm text-emerald-300">All projects on track — no critical alerts.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-700/50">
          {alerts.slice(0, 6).map((a, i) => (
            <button
              key={i}
              onClick={a.projectId ? () => navigate(`/projects/${a.projectId}`) : undefined}
              className={clsx(
                'w-full text-left flex items-start gap-3 px-4 py-2.5 transition-colors',
                a.projectId ? 'hover:bg-slate-700/40 cursor-pointer' : 'cursor-default',
              )}
            >
              <AlertTriangle size={13} className={clsx('shrink-0 mt-0.5', a.color.split(' ')[0])} />
              <div className="min-w-0">
                <p className={clsx('text-sm font-medium truncate', a.color.split(' ')[0])}>{a.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{a.sub}</p>
              </div>
              {a.projectId && <ChevronRight size={13} className="text-slate-600 shrink-0 mt-0.5 ml-auto" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Pending Decisions panel ──────────────────────────────────────────────────

function PendingDecisionsPanel({
  pendingCOs,
  openRfis,
  overdueRfis,
  pendingCOTotal,
  projectMap,
}: {
  pendingCOs: import('@/hooks/usePortfolioPendingItems').PendingCO[]
  openRfis: import('@/hooks/usePortfolioPendingItems').OpenRfi[]
  overdueRfis: import('@/hooks/usePortfolioPendingItems').OpenRfi[]
  pendingCOTotal: number
  projectMap: Record<string, string>
}) {
  const navigate = useNavigate()
  const fmtLocal = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

  const total = pendingCOs.length + openRfis.length
  if (total === 0) return null

  return (
    <div className="bg-slate-800 border border-amber-800/30 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700 bg-amber-950/20">
        <Inbox size={14} className="text-amber-400" />
        <h3 className="text-sm font-semibold text-amber-300">Pending Decisions</h3>
        <span className="ml-auto text-xs bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full font-medium border border-amber-700/40">
          {total} items
        </span>
      </div>
      <div className="divide-y divide-slate-700/50">
        {/* Pending Change Orders */}
        {pendingCOs.length > 0 && (
          <div className="px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <FileSignature size={12} className="text-blue-400" />
              <span className="text-xs font-semibold text-blue-300">Change Orders Awaiting Approval</span>
              <span className="ml-auto text-xs text-blue-400 font-medium tabular-nums">{fmtLocal(pendingCOTotal)}</span>
            </div>
            <div className="space-y-1.5">
              {pendingCOs.slice(0, 4).map(co => (
                <button
                  key={co.id}
                  onClick={() => navigate(`/projects/${co.projectId}?tab=cos`)}
                  className="w-full text-left flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors group"
                >
                  <span className="w-1 h-1 rounded-full bg-blue-500 shrink-0" />
                  <span className="truncate flex-1">{co.title}</span>
                  <span className="text-slate-500 shrink-0">{projectMap[co.projectId] ?? '—'}</span>
                  <span className="text-blue-400 font-medium shrink-0 tabular-nums">{fmtLocal(co.amount)}</span>
                  <ChevronRight size={11} className="text-slate-600 shrink-0 opacity-0 group-hover:opacity-100" />
                </button>
              ))}
              {pendingCOs.length > 4 && (
                <p className="text-xs text-slate-600 pl-3">+{pendingCOs.length - 4} more</p>
              )}
            </div>
          </div>
        )}

        {/* Open RFIs */}
        {openRfis.length > 0 && (
          <div className="px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={12} className={overdueRfis.length > 0 ? 'text-red-400' : 'text-amber-400'} />
              <span className={clsx('text-xs font-semibold', overdueRfis.length > 0 ? 'text-red-300' : 'text-amber-300')}>
                Open RFIs
              </span>
              {overdueRfis.length > 0 && (
                <span className="text-xs text-red-400">{overdueRfis.length} overdue</span>
              )}
            </div>
            <div className="space-y-1.5">
              {openRfis.slice(0, 4).map(rfi => {
                const isOvd = rfi.dueDate && new Date(rfi.dueDate) < new Date()
                return (
                  <button
                    key={rfi.id}
                    onClick={() => navigate(`/projects/${rfi.projectId}?tab=rfis`)}
                    className="w-full text-left flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors group"
                  >
                    <span className={clsx('w-1 h-1 rounded-full shrink-0', isOvd ? 'bg-red-500' : 'bg-amber-500')} />
                    <span className="truncate flex-1">{rfi.subject}</span>
                    <span className="text-slate-500 shrink-0">{projectMap[rfi.projectId] ?? '—'}</span>
                    {isOvd && <span className="text-red-400 shrink-0">overdue</span>}
                    <ChevronRight size={11} className="text-slate-600 shrink-0 opacity-0 group-hover:opacity-100" />
                  </button>
                )
              })}
              {openRfis.length > 4 && (
                <p className="text-xs text-slate-600 pl-3">+{openRfis.length - 4} more</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export function DashboardPage() {
  const { projects, loading: projLoading } = useProjects()
  const { overdue, upcoming, loading: tasksLoading } = usePortfolioTasks()
  const user    = useAuthStore(s => s.user)
  const myName  = user?.displayName?.trim().toLowerCase() ?? ''
  const navigate = useNavigate()

  const { pendingCOs, openRfis, overdueRfis, pendingCOTotal } = usePortfolioPendingItems()

  const active = projects.filter(p => p.isActive)
  const closed = projects.filter(p => p.status === 'closed')
  const atRisk = active.filter(p => p.forecastCost > p.totalBudget)
  const totalBudget = active.reduce((s, p) => s + (p.totalBudget || 0), 0)
  const totalForecast = active.reduce((s, p) => s + (p.forecastCost || 0), 0)
  const totalCommitted = active.reduce((s, p) => s + (p.committedCost || 0), 0)
  const totalActual = active.reduce((s, p) => s + (p.actualCost || 0), 0)
  const portfolioVariance = totalBudget - totalForecast
  const commitPct = totalBudget > 0 ? Math.min(100, Math.round((totalCommitted / totalBudget) * 100)) : 0
  const spendPct  = totalBudget > 0 ? Math.min(100, Math.round((totalActual   / totalBudget) * 100)) : 0

  // Build a projectId → name map
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p.projectName]))

  const activeIds = active.map(p => p.id)
  const { milestones: upcomingMilestones } = usePortfolioMilestones(projectMap)
  const { insights: portfolioInsights } = usePortfolioInsights(activeIds)

  // Per-project task completion — powers accurate SPI in health scores
  const { stats: taskStats } = usePortfolioTaskStats(activeIds)

  // Average health score using actual task completion per project
  const avgHealth = active.length > 0
    ? Math.round(
        active.reduce((s, p) => s + computeHealth(p, { taskCompletionPct: taskStats[p.id]?.pct }).total, 0)
        / active.length
      )
    : null

  if (projLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  // Empty portfolio — show get-started screen instead of zero-filled cards
  if (projects.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Portfolio Overview</h1>
          <p className="text-slate-400 text-sm mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
          <FolderOpen size={48} className="mx-auto mb-4 text-slate-600" />
          <h2 className="text-xl font-semibold text-slate-200 mb-2">No projects yet</h2>
          <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
            Create your first project to start tracking budget, schedule, risks, and tasks in one place.
          </p>
          <button
            onClick={() => navigate('/projects')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <FolderOpen size={16} />
            Go to Projects
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Portfolio Overview</h1>
        <p className="text-slate-400 text-sm mt-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* AI Daily Briefing */}
      <DailyBriefingWidget
        overdueCount={overdue.length}
        upcomingCount={upcoming.length}
        avgHealth={avgHealth}
        activeCount={active.length}
        portfolioInsights={portfolioInsights}
        nextMilestoneName={upcomingMilestones[0]?.name}
        nextMilestoneDays={upcomingMilestones[0]?.daysUntil}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard
          label="Active Projects"
          value={active.length}
          sub={`${projects.length} total`}
          icon={FolderOpen}
          color="bg-blue-600"
          onClick={() => navigate('/projects')}
        />
        <StatCard
          label="Total Budget"
          value={fmtM(totalBudget)}
          sub={`${fmtM(totalForecast)} forecast`}
          icon={DollarSign}
          color="bg-emerald-600"
        />
        <StatCard
          label="Portfolio Health"
          value={avgHealth !== null ? `${avgHealth}` : '—'}
          sub={avgHealth !== null
            ? avgHealth >= 80 ? 'Avg — Healthy'
            : avgHealth >= 60 ? 'Avg — At Risk'
            : 'Avg — Critical'
            : 'No active projects'}
          icon={Activity}
          color={avgHealth === null ? 'bg-slate-600' : avgHealth >= 80 ? 'bg-emerald-600' : avgHealth >= 60 ? 'bg-amber-600' : 'bg-red-600'}
        />
        <StatCard
          label="Overdue Tasks"
          value={overdue.length}
          sub={upcoming.length > 0 ? `${upcoming.length} due in 14 days` : 'None upcoming'}
          icon={Clock}
          color={overdue.length > 0 ? 'bg-amber-600' : 'bg-slate-600'}
        />
      </div>

      {/* Portfolio Burn Rate */}
      {totalBudget > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <DollarSign size={14} className="text-slate-400" />
              <span className="text-sm font-semibold text-slate-200">Portfolio Burn Rate</span>
            </div>
            <span className="text-xs text-slate-500">Active projects only</span>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-xs text-slate-500 mb-1">Committed</p>
              <p className="text-base font-bold text-slate-100 tabular-nums">{fmtM(totalCommitted)}</p>
              <p className="text-xs text-slate-600">{commitPct}% of budget</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Actual Spent</p>
              <p className="text-base font-bold text-blue-300 tabular-nums">{fmtM(totalActual)}</p>
              <p className="text-xs text-slate-600">{spendPct}% of budget</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Total Forecast</p>
              <p className={clsx('text-base font-bold tabular-nums', totalForecast > totalBudget ? 'text-red-400' : 'text-emerald-400')}>
                {fmtM(totalForecast)}
              </p>
              <p className={clsx('text-xs', totalForecast > totalBudget ? 'text-red-600' : 'text-slate-600')}>
                {totalForecast > totalBudget ? 'Over budget' : 'Under budget'}
              </p>
            </div>
          </div>
          {/* Stacked progress bar */}
          <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-amber-500/60 rounded-full"
              style={{ width: `${Math.min(100, (totalForecast / totalBudget) * 100)}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 bg-blue-500 rounded-full"
              style={{ width: `${spendPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-600 mt-1">
            <span>0%</span>
            <span>Budget: {fmt(totalBudget)}</span>
          </div>
        </div>
      )}

      {/* Portfolio variance banner */}
      {totalBudget > 0 && (
        <div className={clsx(
          'rounded-xl p-4 flex items-center gap-3 border',
          portfolioVariance >= 0
            ? 'bg-emerald-900/20 border-emerald-800/40'
            : 'bg-red-900/20 border-red-800/40'
        )}>
          {portfolioVariance >= 0
            ? <TrendingDown size={18} className="text-emerald-400 shrink-0" />
            : <TrendingUp size={18} className="text-red-400 shrink-0" />
          }
          <div className="flex-1 min-w-0">
            <p className={clsx('text-sm font-medium', portfolioVariance >= 0 ? 'text-emerald-300' : 'text-red-300')}>
              Portfolio is <span className="font-bold">{fmt(Math.abs(portfolioVariance))}</span> {portfolioVariance >= 0 ? 'under' : 'over'} combined forecast
            </p>
            <div className="mt-2 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
              <div
                className={clsx('h-full rounded-full', portfolioVariance >= 0 ? 'bg-emerald-500' : 'bg-red-500')}
                style={{ width: `${Math.min(100, (totalForecast / totalBudget) * 100)}%` }}
              />
            </div>
          </div>
          {atRisk.length > 0 && (
            <div className="shrink-0 text-right">
              <p className="text-xs text-red-400 font-medium">{atRisk.length} over budget</p>
            </div>
          )}
        </div>
      )}

      {/* My Tasks Today */}
      {myName && (() => {
        const myTasks = [...overdue, ...upcoming].filter(
          t => t.source === 'project' && t.assignedTo?.trim().toLowerCase() === myName
        )
        if (myTasks.length === 0) return null
        const myOverdue  = myTasks.filter(t => { const d = new Date(t.dueDate); d.setHours(0,0,0,0); const td = new Date(); td.setHours(0,0,0,0); return d < td })
        const myToday    = myTasks.filter(t => { const d = new Date(t.dueDate); d.setHours(0,0,0,0); const td = new Date(); td.setHours(0,0,0,0); return d.getTime() === td.getTime() })
        const myUpcoming = myTasks.filter(t => { const d = new Date(t.dueDate); d.setHours(0,0,0,0); const td = new Date(); td.setHours(0,0,0,0); return d > td })

        return (
          <div className="bg-slate-800 border border-blue-800/40 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700 bg-blue-950/20">
              <User size={14} className="text-blue-400" />
              <h3 className="text-sm font-semibold text-blue-300">My Tasks</h3>
              <span className="text-xs text-slate-500">{user?.displayName}</span>
              {myOverdue.length > 0 && (
                <span className="ml-auto text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full font-medium">
                  {myOverdue.length} overdue
                </span>
              )}
            </div>
            <div className="divide-y divide-slate-700/50 max-h-52 overflow-y-auto">
              {myTasks.slice(0, 10).map(t => {
                const dDate = new Date(t.dueDate); dDate.setHours(0,0,0,0)
                const todayDate = new Date(); todayDate.setHours(0,0,0,0)
                const isOvd = dDate < todayDate
                const isToday = dDate.getTime() === todayDate.getTime()
                const daysLeft = Math.ceil((dDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24))
                return (
                  <button
                    key={t.id}
                    onClick={() => navigate(`/projects/${t.projectId}?tab=tasks`)}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-700/50 transition-colors"
                  >
                    <p className="text-sm text-slate-200 truncate">{t.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                      <span className={clsx(isOvd ? 'text-red-400' : isToday ? 'text-amber-400' : 'text-blue-400')}>
                        {isOvd ? `${Math.abs(daysLeft)}d overdue` : isToday ? 'Due Today' : `${daysLeft} days`}
                      </span>
                      <span>·</span>
                      <span className="truncate">{projects.find(p => p.id === t.projectId)?.projectName ?? 'Unknown'}</span>
                    </div>
                  </button>
                )
              })}
            </div>
            <div className="flex gap-4 px-4 py-2 border-t border-slate-700/50 text-[10px] text-slate-500">
              {myOverdue.length > 0  && <span className="text-red-400">{myOverdue.length} overdue</span>}
              {myToday.length > 0   && <span className="text-amber-400">{myToday.length} due today</span>}
              {myUpcoming.length > 0 && <span>{myUpcoming.length} upcoming</span>}
            </div>
          </div>
        )
      })()}

      {/* Attention Required */}
      <AttentionRequiredPanel
        projects={active}
        taskStats={taskStats}
        overdueCount={overdue.length}
        criticalInsights={portfolioInsights.filter(i => i.severity === 'critical')}
      />

      {/* Pending Decisions */}
      <PendingDecisionsPanel
        pendingCOs={pendingCOs}
        openRfis={openRfis}
        overdueRfis={overdueRfis}
        pendingCOTotal={pendingCOTotal}
        projectMap={projectMap}
      />

      {/* Two-column: milestones + tasks */}
      <div className="grid md:grid-cols-2 gap-4">

        {/* Next 30-Day Milestones */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-blue-400" />
              <h3 className="text-sm font-semibold text-slate-200">Next 30-Day Milestones</h3>
            </div>
            <span className="text-xs text-slate-500">{upcomingMilestones.length} upcoming</span>
          </div>
          {upcomingMilestones.length === 0 ? (
            <div className="text-center py-8 px-6 text-slate-500">
              <Calendar size={24} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm text-slate-400">No milestones in the next 30 days.</p>
              {active.length > 0 ? (
                <p className="text-xs text-slate-600 mt-1.5">
                  Add milestones in a project's{' '}
                  <button
                    onClick={() => navigate(`/projects/${active[0]?.id}?tab=schedule`)}
                    className="text-blue-500 hover:text-blue-400 underline"
                  >
                    Schedule tab
                  </button>{' '}
                  to track upcoming deliverables.
                </p>
              ) : (
                <p className="text-xs text-slate-600 mt-1.5">
                  Create a project to start tracking milestones.
                </p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-700/50 max-h-64 overflow-y-auto">
              {upcomingMilestones.map(m => (
                <button
                  key={m.id}
                  onClick={() => navigate(`/projects/${m.projectId}`)}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-700/50 transition-colors"
                >
                  <p className="text-sm text-slate-200 truncate">{m.name}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                    <span className={clsx(
                      m.daysUntil <= 7 ? 'text-red-400' : m.daysUntil <= 14 ? 'text-amber-400' : 'text-blue-400'
                    )}>
                      {m.daysUntil === 0 ? 'Today' : m.daysUntil === 1 ? 'Tomorrow' : `${m.daysUntil} days`}
                    </span>
                    <span>·</span>
                    <span className="text-slate-400 truncate">{m.projectName}</span>
                    {m.targetDate && (
                      <>
                        <span>·</span>
                        <span>{new Date(m.targetDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Overdue tasks */}
        {!tasksLoading && (overdue.length > 0 || upcoming.length > 0) ? (
          <div className="space-y-4">
            {overdue.length > 0 && (
              <div className="bg-slate-800 border border-red-800/40 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700 bg-red-950/20">
                  <AlertTriangle size={14} className="text-red-400" />
                  <h3 className="text-sm font-semibold text-red-300">Overdue Tasks ({overdue.length})</h3>
                </div>
                <div className="divide-y divide-slate-700/50 max-h-48 overflow-y-auto">
                  {overdue.slice(0, 8).map(t => (
                    <button
                      key={t.id}
                      onClick={() => navigate(`/projects/${t.projectId}?tab=tasks`)}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-700/50 transition-colors"
                    >
                      <p className="text-sm text-slate-200 truncate">{t.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                        <span className="text-red-400">
                          {new Date(t.dueDate!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <span>·</span>
                        <span className="truncate">{projectMap[t.projectId] ?? 'Unknown'}</span>
                      </div>
                    </button>
                  ))}
                  {overdue.length > 8 && (
                    <p className="text-xs text-slate-500 text-center py-2">+{overdue.length - 8} more</p>
                  )}
                </div>
              </div>
            )}

            {upcoming.length > 0 && (
              <div className="bg-slate-800 border border-amber-800/40 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700 bg-amber-950/20">
                  <Clock size={14} className="text-amber-400" />
                  <h3 className="text-sm font-semibold text-amber-300">Due in 14 Days ({upcoming.length})</h3>
                </div>
                <div className="divide-y divide-slate-700/50 max-h-48 overflow-y-auto">
                  {upcoming.slice(0, 8).map(t => {
                    const daysLeft = Math.ceil((new Date(t.dueDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    return (
                      <button
                        key={t.id}
                        onClick={() => navigate(`/projects/${t.projectId}?tab=tasks`)}
                        className="w-full text-left px-4 py-2.5 hover:bg-slate-700/50 transition-colors"
                      >
                        <p className="text-sm text-slate-200 truncate">{t.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                          <span className={clsx(daysLeft <= 3 ? 'text-orange-400' : 'text-amber-400')}>
                            {daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft} days`}
                          </span>
                          <span>·</span>
                          <span className="truncate">{projectMap[t.projectId] ?? 'Unknown'}</span>
                        </div>
                      </button>
                    )
                  })}
                  {upcoming.length > 8 && (
                    <p className="text-xs text-slate-500 text-center py-2">+{upcoming.length - 8} more</p>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center py-8 text-slate-500">
            <div className="text-center">
              <CheckCircle size={24} className="mx-auto mb-2 text-emerald-500 opacity-70" />
              <p className="text-sm">No overdue or upcoming tasks</p>
            </div>
          </div>
        )}
      </div>

      {/* Portfolio AI Insights */}
      {portfolioInsights.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={14} className="text-blue-400" />
            <h3 className="text-sm font-semibold text-slate-200">Portfolio Risk Insights</h3>
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-400 text-[10px]">
              {portfolioInsights.length}
            </span>
          </div>
          <div className="space-y-2">
            {portfolioInsights.slice(0, 5).map(insight => {
              const projectName = projectMap[insight.projectId] ?? 'Unknown'
              const isWarning = insight.severity === 'warning'
              const isCritical = insight.severity === 'critical'
              return (
                <div key={insight.id} className={clsx(
                  'flex items-start gap-2.5 px-3 py-2.5 rounded-lg border text-xs',
                  isCritical ? 'bg-red-900/20 border-red-700/50' :
                  isWarning ? 'bg-amber-900/20 border-amber-700/50' :
                  'bg-blue-900/20 border-blue-700/50'
                )}>
                  <AlertTriangle size={13} className={clsx(
                    'shrink-0 mt-0.5',
                    isCritical ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-blue-400'
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className={clsx('font-medium', isCritical ? 'text-red-300' : isWarning ? 'text-amber-300' : 'text-blue-300')}>
                      {insight.title}
                    </p>
                    <p className="text-slate-500 mt-0.5 truncate">
                      <button
                        onClick={() => navigate(`/projects/${insight.projectId}`)}
                        className="text-slate-400 hover:text-slate-200 transition-colors"
                      >
                        {projectName} →
                      </button>
                    </p>
                  </div>
                </div>
              )
            })}
            {portfolioInsights.length > 5 && (
              <p className="text-xs text-slate-500 text-center py-1">
                +{portfolioInsights.length - 5} more across portfolio
              </p>
            )}
          </div>
        </div>
      )}

      {/* Budget utilization bars */}
      <BudgetSummaryBars projects={active} />

      {/* Active projects table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h2 className="text-slate-100 font-semibold">Active Projects</h2>
          <button onClick={() => navigate('/projects')} className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1">
            View all <ChevronRight size={14} />
          </button>
        </div>

        {active.length === 0 ? (
          <div className="text-center py-12 text-slate-500 px-6">
            <FolderOpen size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm text-slate-400 font-medium">No active projects</p>
            <p className="text-xs text-slate-600 mt-1.5">
              All projects are closed.{' '}
              <button
                onClick={() => navigate('/projects')}
                className="text-blue-500 hover:text-blue-400 underline"
              >
                Create a new project
              </button>{' '}
              to get started.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-xs uppercase tracking-wide border-b border-slate-700">
                    <th className="text-left px-5 py-3">Project</th>
                    <th className="text-left px-5 py-3">Stage</th>
                    <th className="text-right px-5 py-3">Budget</th>
                    <th className="text-right px-5 py-3">Forecast</th>
                    <th className="text-left px-5 py-3 w-36">Health</th>
                  </tr>
                </thead>
                <tbody>
                  {active.map((p, i) => {
                    const overBudget = p.forecastCost > p.totalBudget
                    const h = computeHealth(p, { taskCompletionPct: taskStats[p.id]?.pct })
                    const trafficLight = h.total >= 80 ? 'bg-emerald-500' : h.total >= 60 ? 'bg-amber-500' : 'bg-red-500'
                    const trafficTitle = h.total >= 80 ? 'Healthy' : h.total >= 60 ? 'At Risk' : 'Critical'
                    return (
                      <tr
                        key={p.id}
                        onClick={() => navigate(`/projects/${p.id}`)}
                        className={clsx(
                          'border-t border-slate-700 hover:bg-slate-700/40 cursor-pointer transition-colors',
                          i % 2 !== 0 ? 'bg-slate-900/20' : ''
                        )}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className={clsx('w-2 h-2 rounded-full shrink-0', trafficLight)} title={trafficTitle} />
                            <div>
                              <p className="text-slate-100 font-medium">{p.projectName}</p>
                              <p className="text-slate-500 text-xs">{p.projectNumber} · {[p.city, p.state].filter(Boolean).join(', ')}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3"><StatusBadge status={p.status} /></td>
                        <td className="px-5 py-3 text-right text-slate-300">{fmt(p.totalBudget)}</td>
                        <td className={clsx('px-5 py-3 text-right font-medium', overBudget ? 'text-red-400' : 'text-emerald-400')}>
                          {fmt(p.forecastCost)}
                          {overBudget && <span className="ml-1 text-xs">↑</span>}
                        </td>
                        <td className="px-5 py-3 w-36">
                          <HealthBar project={p} taskPct={taskStats[p.id]?.pct} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden divide-y divide-slate-700">
              {active.map(p => {
                const overBudget = p.forecastCost > p.totalBudget
                const hm = computeHealth(p, { taskCompletionPct: taskStats[p.id]?.pct })
                const tlm = hm.total >= 80 ? 'bg-emerald-500' : hm.total >= 60 ? 'bg-amber-500' : 'bg-red-500'
                return (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/projects/${p.id}`)}
                    className="w-full text-left px-4 py-3 space-y-2 hover:bg-slate-700/40 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={clsx('w-2 h-2 rounded-full shrink-0', tlm)} />
                        <p className="text-slate-100 font-medium text-sm truncate">{p.projectName}</p>
                      </div>
                      <StatusBadge status={p.status} />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">{fmt(p.totalBudget)}</span>
                      <span className={overBudget ? 'text-red-400 font-medium' : 'text-emerald-400'}>
                        {fmt(p.forecastCost)} {overBudget ? '↑' : ''}
                      </span>
                    </div>
                    <HealthBar project={p} />
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Closed projects summary */}
      {closed.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl">
          <div className="flex items-center gap-2">
            <CheckCircle size={15} className="text-emerald-500" />
            <span className="text-sm text-slate-400">
              <span className="text-slate-200 font-medium">{closed.length}</span> project{closed.length !== 1 ? 's' : ''} closed
            </span>
          </div>
          <button onClick={() => navigate('/projects')} className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1">
            View <ChevronRight size={12} />
          </button>
        </div>
      )}
    </div>
  )
}
