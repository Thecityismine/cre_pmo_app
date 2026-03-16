import { useProjects } from '@/hooks/useProjects'
import { AlertTriangle, CheckCircle, DollarSign, FolderOpen } from 'lucide-react'
import { clsx } from 'clsx'

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-slate-100 mt-1">{value}</p>
          {sub && <p className="text-slate-400 text-sm mt-1">{sub}</p>}
        </div>
        <div className={clsx('p-2.5 rounded-lg', color)}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { projects, loading } = useProjects()

  const active = projects.filter((p) => p.isActive)
  const atRisk = projects.filter((p) =>
    ['construction', 'design'].includes(p.status) && p.forecastCost > p.totalBudget
  )
  const completed = projects.filter((p) => p.status === 'closed')

  const totalBudget = active.reduce((sum, p) => sum + (p.totalBudget || 0), 0)
  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

  if (loading) {
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
        <p className="text-slate-400 text-sm mt-1">All active CRE projects at a glance</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Projects"
          value={active.length}
          sub={`${projects.length} total`}
          icon={FolderOpen}
          color="bg-blue-600"
        />
        <StatCard
          label="Total Portfolio Budget"
          value={formatCurrency(totalBudget)}
          sub="Active projects"
          icon={DollarSign}
          color="bg-emerald-600"
        />
        <StatCard
          label="At Risk"
          value={atRisk.length}
          sub="Over budget forecast"
          icon={AlertTriangle}
          color="bg-amber-600"
        />
        <StatCard
          label="Completed"
          value={completed.length}
          sub="Closed projects"
          icon={CheckCircle}
          color="bg-slate-600"
        />
      </div>

      {/* Recent Projects Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-slate-100 font-semibold">Active Projects</h2>
          <a href="/projects" className="text-blue-400 hover:text-blue-300 text-sm">
            View all →
          </a>
        </div>
        {active.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <FolderOpen size={40} className="mx-auto mb-3 opacity-40" />
            <p>No active projects yet.</p>
            <p className="text-sm mt-1">Import your data or create a new project.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs uppercase tracking-wide">
                  <th className="text-left px-6 py-3">Project</th>
                  <th className="text-left px-6 py-3">Status</th>
                  <th className="text-left px-6 py-3">Profile</th>
                  <th className="text-right px-6 py-3">Budget</th>
                  <th className="text-right px-6 py-3">Forecast</th>
                </tr>
              </thead>
              <tbody>
                {active.slice(0, 8).map((project, i) => {
                  const overBudget = project.forecastCost > project.totalBudget
                  return (
                    <tr
                      key={project.id}
                      className={clsx(
                        'border-t border-slate-700 hover:bg-slate-750 transition-colors cursor-pointer',
                        i % 2 === 0 ? '' : 'bg-slate-850'
                      )}
                    >
                      <td className="px-6 py-3">
                        <p className="text-slate-100 font-medium">{project.projectName}</p>
                        <p className="text-slate-500 text-xs">{project.projectNumber} · {project.city}, {project.state}</p>
                      </td>
                      <td className="px-6 py-3">
                        <StatusBadge status={project.status} />
                      </td>
                      <td className="px-6 py-3">
                        <span className="text-slate-300 bg-slate-700 px-2 py-0.5 rounded text-xs font-medium">
                          {project.profile}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right text-slate-300">
                        {formatCurrency(project.totalBudget)}
                      </td>
                      <td className={clsx('px-6 py-3 text-right font-medium', overBudget ? 'text-red-400' : 'text-emerald-400')}>
                        {formatCurrency(project.forecastCost)}
                        {overBudget && <span className="ml-1 text-xs">↑</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    'pre-project': { label: 'Pre-Project', color: 'bg-slate-700 text-slate-300' },
    initiate: { label: 'Initiate', color: 'bg-purple-900 text-purple-300' },
    planning: { label: 'Planning', color: 'bg-blue-900 text-blue-300' },
    design: { label: 'Design', color: 'bg-cyan-900 text-cyan-300' },
    construction: { label: 'Construction', color: 'bg-amber-900 text-amber-300' },
    handover: { label: 'Handover', color: 'bg-orange-900 text-orange-300' },
    closeout: { label: 'Closeout', color: 'bg-emerald-900 text-emerald-300' },
    'defect-period': { label: 'Defect Period', color: 'bg-yellow-900 text-yellow-300' },
    closed: { label: 'Closed', color: 'bg-slate-700 text-slate-400' },
  }
  const { label, color } = map[status] ?? { label: status, color: 'bg-slate-700 text-slate-300' }
  return <span className={clsx('px-2 py-0.5 rounded text-xs font-medium', color)}>{label}</span>
}
