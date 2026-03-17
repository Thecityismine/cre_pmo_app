import { useProjects } from '@/hooks/useProjects'
import { usePortfolioTasks } from '@/hooks/usePortfolioTasks'
import { AlertTriangle, CheckCircle, DollarSign, FolderOpen, Clock, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react'
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

function HealthBar({ project }: { project: Project }) {
  const h = computeHealth(project)
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

// ─── Main dashboard ───────────────────────────────────────────────────────────

export function DashboardPage() {
  const { projects, loading: projLoading } = useProjects()
  const { overdue, upcoming, loading: tasksLoading } = usePortfolioTasks()
  const navigate = useNavigate()

  const active = projects.filter(p => p.isActive)
  const atRisk = active.filter(p => p.forecastCost > p.totalBudget)
  const closed = projects.filter(p => p.status === 'closed')
  const totalBudget = active.reduce((s, p) => s + (p.totalBudget || 0), 0)
  const totalForecast = active.reduce((s, p) => s + (p.forecastCost || 0), 0)
  const portfolioVariance = totalBudget - totalForecast

  // Build a projectId → name map for task display
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p.projectName]))

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
          label="Portfolio Budget"
          value={fmtM(totalBudget)}
          sub={`${fmtM(totalForecast)} forecast`}
          icon={DollarSign}
          color="bg-emerald-600"
        />
        <StatCard
          label="At Risk"
          value={atRisk.length}
          sub={atRisk.length > 0 ? 'Over forecast' : 'All on budget'}
          icon={AlertTriangle}
          color={atRisk.length > 0 ? 'bg-red-600' : 'bg-slate-600'}
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
        </div>
      )}

      {/* Two-column: overdue tasks + upcoming */}
      {!tasksLoading && (overdue.length > 0 || upcoming.length > 0) && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Overdue tasks */}
          {overdue.length > 0 && (
            <div className="bg-slate-800 border border-red-800/40 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700 bg-red-950/20">
                <AlertTriangle size={14} className="text-red-400" />
                <h3 className="text-sm font-semibold text-red-300">Overdue Tasks ({overdue.length})</h3>
              </div>
              <div className="divide-y divide-slate-700/50 max-h-72 overflow-y-auto">
                {overdue.slice(0, 15).map(t => (
                  <button
                    key={t.id}
                    onClick={() => navigate(`/projects/${t.projectId}`)}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-700/50 transition-colors"
                  >
                    <p className="text-sm text-slate-200 truncate">{t.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                      <span className="text-red-400">
                        {new Date(t.dueDate!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      <span>·</span>
                      <span className="truncate">{projectMap[t.projectId] ?? 'Unknown project'}</span>
                    </div>
                  </button>
                ))}
                {overdue.length > 15 && (
                  <p className="text-xs text-slate-500 text-center py-2">+{overdue.length - 15} more</p>
                )}
              </div>
            </div>
          )}

          {/* Upcoming tasks */}
          {upcoming.length > 0 && (
            <div className="bg-slate-800 border border-amber-800/40 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700 bg-amber-950/20">
                <Clock size={14} className="text-amber-400" />
                <h3 className="text-sm font-semibold text-amber-300">Due in 14 Days ({upcoming.length})</h3>
              </div>
              <div className="divide-y divide-slate-700/50 max-h-72 overflow-y-auto">
                {upcoming.slice(0, 15).map(t => {
                  const daysLeft = Math.ceil((new Date(t.dueDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  return (
                    <button
                      key={t.id}
                      onClick={() => navigate(`/projects/${t.projectId}`)}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-700/50 transition-colors"
                    >
                      <p className="text-sm text-slate-200 truncate">{t.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                        <span className={clsx(daysLeft <= 3 ? 'text-orange-400' : 'text-amber-400')}>
                          {daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft} days`}
                        </span>
                        <span>·</span>
                        <span className="truncate">{projectMap[t.projectId] ?? 'Unknown project'}</span>
                      </div>
                    </button>
                  )
                })}
                {upcoming.length > 15 && (
                  <p className="text-xs text-slate-500 text-center py-2">+{upcoming.length - 15} more</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Active projects with health */}
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
                          <p className="text-slate-100 font-medium">{p.projectName}</p>
                          <p className="text-slate-500 text-xs">{p.projectNumber} · {[p.city, p.state].filter(Boolean).join(', ')}</p>
                        </td>
                        <td className="px-5 py-3"><StatusBadge status={p.status} /></td>
                        <td className="px-5 py-3 text-right text-slate-300">{fmt(p.totalBudget)}</td>
                        <td className={clsx('px-5 py-3 text-right font-medium', overBudget ? 'text-red-400' : 'text-emerald-400')}>
                          {fmt(p.forecastCost)}
                          {overBudget && <span className="ml-1 text-xs">↑</span>}
                        </td>
                        <td className="px-5 py-3 w-36">
                          <HealthBar project={p} />
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
                return (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/projects/${p.id}`)}
                    className="w-full text-left px-4 py-3 space-y-2 hover:bg-slate-700/40 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-slate-100 font-medium text-sm truncate">{p.projectName}</p>
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
