import { useProjects } from '@/hooks/useProjects'
import { FolderOpen, Plus, Search, LayoutGrid, List, AlertTriangle, ArrowUpDown, X, Download } from 'lucide-react'
import { useState, useMemo } from 'react'
import { clsx } from 'clsx'
import { useNavigate } from 'react-router-dom'
import { NewProjectModal } from '@/components/NewProjectModal'
import { exportProjectsCsv } from '@/lib/exportCsv'
import { computeHealth, healthColor, healthBg } from '@/lib/healthScore'
import { usePortfolioTaskStats, type ProjectTaskStat } from '@/hooks/usePortfolioTaskStats'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUSES = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pre-project', label: 'Pre-Project' },
  { value: 'initiate', label: 'Initiate' },
  { value: 'planning', label: 'Planning' },
  { value: 'design', label: 'Design' },
  { value: 'construction', label: 'Construction' },
  { value: 'handover', label: 'Handover' },
  { value: 'closeout', label: 'Closeout' },
  { value: 'defect-period', label: 'Defect Period' },
  { value: 'closed', label: 'Closed' },
]

const STATUS_COLORS: Record<string, string> = {
  'pre-project':  'bg-slate-700 text-slate-300',
  initiate:       'bg-purple-900 text-purple-300',
  planning:       'bg-blue-900 text-blue-300',
  design:         'bg-cyan-900 text-cyan-300',
  construction:   'bg-amber-900 text-amber-300',
  handover:       'bg-orange-900 text-orange-300',
  closeout:       'bg-emerald-900 text-emerald-300',
  'defect-period':'bg-yellow-900 text-yellow-300',
  closed:         'bg-slate-700 text-slate-500',
}

const PROFILE_COLORS: Record<string, string> = {
  L: 'bg-blue-900/60 text-blue-300 border-blue-700',
  S: 'bg-purple-900/60 text-purple-300 border-purple-700',
  E: 'bg-amber-900/60 text-amber-300 border-amber-700',
}

const SORT_OPTIONS = [
  { value: 'name-asc',      label: 'Name A–Z' },
  { value: 'name-desc',     label: 'Name Z–A' },
  { value: 'budget-desc',   label: 'Budget ↓' },
  { value: 'budget-asc',    label: 'Budget ↑' },
  { value: 'health-asc',    label: 'Health ↑ (worst first)' },
  { value: 'health-desc',   label: 'Health ↓ (best first)' },
  { value: 'status',        label: 'Stage' },
  { value: 'date-desc',     label: 'Newest first' },
]

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const STATUS_ORDER = ['pre-project','initiate','planning','design','construction','handover','closeout','defect-period','closed']

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  return (
    <span className={clsx('px-2 py-0.5 rounded text-xs font-medium capitalize', STATUS_COLORS[status] ?? 'bg-slate-700 text-slate-300')}>
      {status.replace(/-/g, ' ')}
    </span>
  )
}

function ProfileBadge({ profile }: { profile: string }) {
  const label = profile === 'L' ? 'Light' : profile === 'S' ? 'Standard' : 'Enhanced'
  return (
    <span className={clsx('px-2 py-0.5 rounded text-xs font-medium border', PROFILE_COLORS[profile] ?? 'bg-slate-700 text-slate-300 border-slate-600')}>
      {label}
    </span>
  )
}

// ─── Card view ────────────────────────────────────────────────────────────────

function HealthBadge({ score }: { score: number }) {
  const label = score >= 80 ? 'Healthy' : score >= 60 ? 'At Risk' : 'Critical'
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden w-16">
        <div className={clsx('h-full rounded-full', healthBg(score))} style={{ width: `${score}%` }} />
      </div>
      <span className={clsx('text-xs font-semibold tabular-nums w-6', healthColor(score))}>{score}</span>
      <span className={clsx('text-xs', healthColor(score))}>{label}</span>
    </div>
  )
}

function ProjectCard({ project, taskStat, onClick }: { project: ReturnType<typeof useProjects>['projects'][0]; taskStat?: ProjectTaskStat; onClick: () => void }) {
  const health = computeHealth(project)
  const atRisk = project.forecastCost > project.totalBudget
  const budgetPct = project.totalBudget > 0 ? Math.min(100, Math.round((project.actualCost / project.totalBudget) * 100)) : 0
  const barColor = atRisk ? 'bg-red-500' : budgetPct > 80 ? 'bg-amber-500' : 'bg-blue-500'

  return (
    <div
      onClick={onClick}
      className={clsx(
        'bg-slate-800 border rounded-xl p-5 cursor-pointer transition-all hover:shadow-lg hover:shadow-black/20',
        health.total < 60 ? 'border-red-800 hover:border-red-600'
        : health.total < 80 ? 'border-amber-800/50 hover:border-amber-600'
        : 'border-slate-700 hover:border-blue-500'
      )}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-slate-100 font-semibold leading-tight truncate flex-1">{project.projectName}</p>
        {atRisk && <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />}
      </div>
      <p className="text-slate-500 text-xs mb-3">{project.projectNumber} · {project.city}, {project.state}</p>

      {/* Badges */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <StatusPill status={project.status} />
        <ProfileBadge profile={project.profile} />
      </div>

      {/* Health score */}
      <div className="mb-3">
        <HealthBadge score={health.total} />
      </div>

      {/* Budget bar */}
      {project.totalBudget > 0 && (
        <div className="space-y-1.5 mb-3">
          <div className="flex justify-between text-xs text-slate-500">
            <span>Spent</span>
            <span className={clsx(atRisk && 'text-red-400')}>{fmt(project.actualCost)} / {fmt(project.totalBudget)}</span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div className={clsx('h-full rounded-full transition-all', barColor)} style={{ width: `${budgetPct}%` }} />
          </div>
          {atRisk && (
            <p className="text-xs text-red-400">Forecast {fmt(project.forecastCost)} — over budget</p>
          )}
        </div>
      )}

      {/* Checklist progress */}
      {taskStat && taskStat.total > 0 && (
        <div className="space-y-1 mb-3">
          <div className="flex justify-between text-xs text-slate-500">
            <span>Checklist</span>
            <span className={clsx(taskStat.pct === 100 ? 'text-emerald-400' : 'text-slate-400')}>
              {taskStat.complete}/{taskStat.total} tasks
            </span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={clsx('h-full rounded-full transition-all', taskStat.pct === 100 ? 'bg-emerald-500' : taskStat.pct >= 60 ? 'bg-blue-500' : 'bg-slate-500')}
              style={{ width: `${taskStat.pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-700">
        <span className="text-slate-500 text-xs truncate max-w-[55%]">{project.projectManager || '—'}</span>
        {project.targetCompletionDate && (
          <span className="text-slate-500 text-xs">
            Target: {new Date(project.targetCompletionDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── List row ─────────────────────────────────────────────────────────────────

function ProjectRow({ project, onClick }: { project: ReturnType<typeof useProjects>['projects'][0]; onClick: () => void }) {
  const atRisk = project.forecastCost > project.totalBudget
  const health = computeHealth(project)

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-4 px-4 py-3 border-b border-slate-700 last:border-0 hover:bg-slate-700/40 transition-colors cursor-pointer"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-slate-100 font-medium text-sm truncate">{project.projectName}</p>
          {atRisk && <AlertTriangle size={12} className="text-red-400 shrink-0" />}
        </div>
        <p className="text-slate-500 text-xs mt-0.5">{project.projectNumber} · {project.city}, {project.state}</p>
      </div>

      <div className="hidden sm:flex items-center gap-2 shrink-0">
        <StatusPill status={project.status} />
        <span className={clsx('px-2 py-0.5 rounded text-xs font-medium border', PROFILE_COLORS[project.profile] ?? 'bg-slate-700 text-slate-300 border-slate-600')}>
          {project.profile}
        </span>
      </div>

      {/* Health score — list view */}
      <div className="hidden md:flex items-center gap-1.5 shrink-0 w-28">
        <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div className={clsx('h-full rounded-full', healthBg(health.total))} style={{ width: `${health.total}%` }} />
        </div>
        <span className={clsx('text-xs font-semibold tabular-nums w-6 text-right', healthColor(health.total))}>
          {health.total}
        </span>
      </div>

      <div className="text-right shrink-0">
        <p className="text-slate-200 text-sm font-medium">{fmt(project.totalBudget)}</p>
        <p className={clsx('text-xs', atRisk ? 'text-red-400' : 'text-slate-500')}>
          {atRisk ? `↑ ${fmt(project.forecastCost)}` : project.projectManager || ''}
        </p>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ProjectsPage() {
  const { projects, loading } = useProjects()
  const { stats: taskStats } = usePortfolioTaskStats(projects.map(p => p.id))
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [profileFilter, setProfileFilter] = useState<'all' | 'L' | 'S' | 'E'>('all')
  const [activeOnly, setActiveOnly] = useState(false)
  const [sort, setSort] = useState('name-asc')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showNew, setShowNew] = useState(false)

  const filtered = useMemo(() => {
    let list = projects.filter((p) => {
      const q = search.toLowerCase()
      const matchSearch = !q ||
        p.projectName.toLowerCase().includes(q) ||
        (p.projectNumber || '').toLowerCase().includes(q) ||
        (p.city || '').toLowerCase().includes(q) ||
        (p.clientName || '').toLowerCase().includes(q) ||
        (p.projectManager || '').toLowerCase().includes(q)
      const matchStatus = statusFilter === 'all' || p.status === statusFilter
      const matchProfile = profileFilter === 'all' || p.profile === profileFilter
      const matchActive = !activeOnly || p.isActive
      return matchSearch && matchStatus && matchProfile && matchActive
    })

    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'name-asc':    return a.projectName.localeCompare(b.projectName)
        case 'name-desc':   return b.projectName.localeCompare(a.projectName)
        case 'budget-desc':  return (b.totalBudget || 0) - (a.totalBudget || 0)
        case 'budget-asc':   return (a.totalBudget || 0) - (b.totalBudget || 0)
        case 'health-asc':   return computeHealth(a).total - computeHealth(b).total
        case 'health-desc':  return computeHealth(b).total - computeHealth(a).total
        case 'status':       return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
        case 'date-desc':    return (b.createdAt || '').localeCompare(a.createdAt || '')
        default: return 0
      }
    })

    return list
  }, [projects, search, statusFilter, profileFilter, activeOnly, sort])

  const atRiskCount = projects.filter(p => p.forecastCost > p.totalBudget && p.isActive).length
  const hasActiveFilter = search || statusFilter !== 'all' || profileFilter !== 'all' || activeOnly

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setProfileFilter('all')
    setActiveOnly(false)
  }

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Projects</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {filtered.length} of {projects.length} projects
            {atRiskCount > 0 && (
              <span className="ml-2 text-red-400">· {atRiskCount} at risk</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportProjectsCsv(filtered, 'cre-projects.csv')}
            title="Export visible projects to CSV"
            className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm px-3 py-2 rounded-lg border border-slate-600 transition-colors"
          >
            <Download size={15} /><span className="hidden sm:inline text-xs">CSV</span>
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} /> <span className="hidden sm:inline">New Project</span><span className="sm:hidden">New</span>
          </button>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="space-y-2">
        {/* Row 1: search + view toggle */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, number, city, PM..."
              className="w-full bg-slate-800 text-slate-200 placeholder-slate-500 text-sm rounded-lg pl-9 pr-4 py-2 border border-slate-700 focus:outline-none focus:border-blue-500"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Sort */}
          <div className="relative">
            <ArrowUpDown size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:border-blue-500 appearance-none"
            >
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* View toggle */}
          <div className="flex bg-slate-800 border border-slate-700 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={clsx('p-1.5 rounded transition-colors', viewMode === 'grid' ? 'bg-slate-600 text-slate-200' : 'text-slate-500 hover:text-slate-300')}
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={clsx('p-1.5 rounded transition-colors', viewMode === 'list' ? 'bg-slate-600 text-slate-200' : 'text-slate-500 hover:text-slate-300')}
            >
              <List size={15} />
            </button>
          </div>
        </div>

        {/* Row 2: chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Active toggle */}
          <button
            onClick={() => setActiveOnly(!activeOnly)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
              activeOnly ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            )}
          >
            Active only
          </button>

          {/* Profile filter */}
          {(['L', 'S', 'E'] as const).map(p => (
            <button
              key={p}
              onClick={() => setProfileFilter(profileFilter === p ? 'all' : p)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                profileFilter === p
                  ? p === 'L' ? 'bg-blue-600 text-white border-blue-600'
                  : p === 'S' ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-amber-600 text-white border-amber-600'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              )}
            >
              {p === 'L' ? 'Light' : p === 'S' ? 'Standard' : 'Enhanced'}
            </button>
          ))}

          {/* Status dropdown on mobile, pills on desktop for common statuses */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-400 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500"
          >
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>

          {/* Clear filters */}
          {hasActiveFilter && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors ml-1"
            >
              <X size={12} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-500 bg-slate-800 border border-slate-700 rounded-xl">
          <FolderOpen size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No projects found</p>
          <p className="text-sm mt-1">
            {hasActiveFilter ? 'Try adjusting your filters.' : 'Create your first project to get started.'}
          </p>
          {hasActiveFilter && (
            <button onClick={clearFilters} className="mt-3 text-blue-400 text-sm hover:text-blue-300">Clear filters</button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(p => (
            <ProjectCard key={p.id} project={p} taskStat={taskStats[p.id]} onClick={() => navigate(`/projects/${p.id}`)} />
          ))}
        </div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          {filtered.map(p => (
            <ProjectRow key={p.id} project={p} onClick={() => navigate(`/projects/${p.id}`)} />
          ))}
        </div>
      )}

      {showNew && <NewProjectModal onClose={() => setShowNew(false)} />}
    </div>
  )
}
