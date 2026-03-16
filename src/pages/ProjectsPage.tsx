import { useProjects } from '@/hooks/useProjects'
import { FolderOpen, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { clsx } from 'clsx'
import { useNavigate } from 'react-router-dom'

export function ProjectsPage() {
  const { projects, loading } = useProjects()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = projects.filter((p) => {
    const matchSearch =
      p.projectName.toLowerCase().includes(search.toLowerCase()) ||
      p.projectNumber.toLowerCase().includes(search.toLowerCase()) ||
      p.city.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || p.status === statusFilter
    return matchSearch && matchStatus
  })

  const statuses = ['all', 'initiate', 'planning', 'design', 'construction', 'handover', 'closeout', 'closed']

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Projects</h1>
          <p className="text-slate-400 text-sm mt-1">{projects.length} total projects</p>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus size={16} />
          New Project
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="bg-slate-800 text-slate-200 placeholder-slate-500 text-sm rounded-lg pl-9 pr-4 py-2 w-56 border border-slate-700 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors',
                statusFilter === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
              )}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-500 bg-slate-800 border border-slate-700 rounded-xl">
          <FolderOpen size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No projects found</p>
          <p className="text-sm mt-1">
            {search ? 'Try a different search term.' : 'Import your data or create a new project.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((project) => (
            <div
              key={project.id}
              onClick={() => navigate(`/projects/${project.id}`)}
              className="bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-blue-500 hover:bg-slate-800/80 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <p className="text-slate-100 font-semibold truncate">{project.projectName}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{project.projectNumber}</p>
                </div>
                <span className="ml-2 shrink-0 text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded font-medium">
                  {project.profile}
                </span>
              </div>

              <p className="text-slate-400 text-sm mb-4">
                {project.city}, {project.state}
              </p>

              {/* Budget bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Budget</span>
                  <span>{formatCurrency(project.totalBudget)}</span>
                </div>
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={clsx(
                      'h-full rounded-full transition-all',
                      project.actualCost / project.totalBudget > 0.9 ? 'bg-red-500' : 'bg-blue-500'
                    )}
                    style={{
                      width: `${Math.min(100, (project.actualCost / project.totalBudget) * 100)}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Spent: {formatCurrency(project.actualCost)}</span>
                  <span>{Math.round((project.actualCost / project.totalBudget) * 100)}%</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-700 flex items-center justify-between">
                <span className="text-slate-400 text-xs">{project.projectManager}</span>
                <StatusPill status={project.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    'pre-project': 'bg-slate-700 text-slate-300',
    initiate: 'bg-purple-900 text-purple-300',
    planning: 'bg-blue-900 text-blue-300',
    design: 'bg-cyan-900 text-cyan-300',
    construction: 'bg-amber-900 text-amber-300',
    handover: 'bg-orange-900 text-orange-300',
    closeout: 'bg-emerald-900 text-emerald-300',
    'defect-period': 'bg-yellow-900 text-yellow-300',
    closed: 'bg-slate-700 text-slate-500',
  }
  return (
    <span className={clsx('px-2 py-0.5 rounded text-xs font-medium capitalize', colors[status] ?? 'bg-slate-700 text-slate-300')}>
      {status.replace('-', ' ')}
    </span>
  )
}
