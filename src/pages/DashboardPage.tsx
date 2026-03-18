import { useProjects } from '@/hooks/useProjects'
import { usePortfolioTasks } from '@/hooks/usePortfolioTasks'
import { usePortfolioMilestones } from '@/hooks/usePortfolioMilestones'
import { usePortfolioInsights } from '@/hooks/useAIInsights'
import { usePortfolioTaskStats } from '@/hooks/usePortfolioTaskStats'
import { useAuthStore } from '@/store/authStore'
import {
  AlertTriangle, CheckCircle, DollarSign, FolderOpen, Clock,
  ChevronRight, TrendingUp, TrendingDown, Calendar, Activity, Sparkles, User,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useNavigate } from 'react-router-dom'
import { computeHealth, healthBg, healthColor } from '@/lib/healthScore'
import type { Project } from '@/types'

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

// ─── Main dashboard ───────────────────────────────────────────────────────────

export function DashboardPage() {
  const { projects, loading: projLoading } = useProjects()
  const { overdue, upcoming, loading: tasksLoading } = usePortfolioTasks()
  const user    = useAuthStore(s => s.user)
  const myName  = user?.displayName?.trim().toLowerCase() ?? ''
  const navigate = useNavigate()

  const active = projects.filter(p => p.isActive)
  const closed = projects.filter(p => p.status === 'closed')
  const atRisk = active.filter(p => p.forecastCost > p.totalBudget)
  const totalBudget = active.reduce((s, p) => s + (p.totalBudget || 0), 0)
  const totalForecast = active.reduce((s, p) => s + (p.forecastCost || 0), 0)
  const portfolioVariance = totalBudget - totalForecast

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Portfolio Overview</h1>
        <p className="text-slate-400 text-sm mt-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

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
            <div className="text-center py-8 text-slate-500">
              <Calendar size={24} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No milestones in the next 30 days.</p>
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
          <div className="text-center py-16 text-slate-500">
            <FolderOpen size={40} className="mx-auto mb-3 opacity-40" />
            <p>No active projects yet.</p>
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
