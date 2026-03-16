import { useProjects } from '@/hooks/useProjects'
import { clsx } from 'clsx'
import { DollarSign, FolderOpen, CheckSquare, TrendingUp } from 'lucide-react'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const STATUS_COLORS: Record<string, string> = {
  'pre-project': 'bg-slate-500',
  'initiate':    'bg-purple-500',
  'planning':    'bg-blue-500',
  'design':      'bg-cyan-500',
  'construction':'bg-amber-500',
  'handover':    'bg-orange-500',
  'closeout':    'bg-emerald-500',
  'defect-period':'bg-yellow-500',
  'closed':      'bg-slate-400',
}

const STATUS_LABEL: Record<string, string> = {
  'pre-project': 'Pre-Project', 'initiate': 'Initiate', 'planning': 'Planning',
  'design': 'Design', 'construction': 'Construction', 'handover': 'Handover',
  'closeout': 'Closeout', 'defect-period': 'Defect Period', 'closed': 'Closed',
}

export function AnalyticsPage() {
  const { projects } = useProjects()

  const active = projects.filter(p => p.isActive)
  const totalBudget = active.reduce((s, p) => s + (p.totalBudget || 0), 0)
  const totalActual = active.reduce((s, p) => s + (p.actualCost || 0), 0)
  const totalForecast = active.reduce((s, p) => s + (p.forecastCost || 0), 0)
  const totalRSF = active.reduce((s, p) => s + (p.rsf || 0), 0)

  // Status breakdown
  const byStatus = projects.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1
    return acc
  }, {})

  // Profile breakdown
  const byProfile = projects.reduce<Record<string, { count: number; budget: number }>>((acc, p) => {
    if (!acc[p.profile]) acc[p.profile] = { count: 0, budget: 0 }
    acc[p.profile].count++
    acc[p.profile].budget += p.totalBudget || 0
    return acc
  }, {})

  const profileLabels: Record<string, string> = { L: 'Light', S: 'Standard', E: 'Enhanced' }
  const profileColors: Record<string, string> = { L: 'bg-blue-500', S: 'bg-emerald-500', E: 'bg-purple-500' }

  const maxBudget = Math.max(...active.map(p => p.totalBudget || 0), 1)

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Analytics</h1>
        <p className="text-slate-400 text-sm mt-1">Portfolio performance overview</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <KPI icon={FolderOpen} label="Active Projects" value={String(active.length)} sub={`${projects.length} total`} color="bg-blue-600" />
        <KPI icon={DollarSign} label="Total Budget" value={fmt(totalBudget)} sub="Active portfolio" color="bg-emerald-600" />
        <KPI icon={TrendingUp} label="Forecast Cost" value={fmt(totalForecast)} sub={totalForecast > totalBudget ? '⚠ Over budget' : 'On track'} color={totalForecast > totalBudget ? 'bg-red-600' : 'bg-emerald-600'} />
        <KPI icon={CheckSquare} label="Total RSF" value={totalRSF > 0 ? `${totalRSF.toLocaleString()} sf` : '—'} sub="Active projects" color="bg-slate-600" />
      </div>

      {/* Budget vs Actual by project */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h2 className="text-slate-100 font-semibold mb-4">Budget by Project</h2>
        {active.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-8">No active projects.</p>
        ) : (
          <div className="space-y-4">
            {active.map(p => {
              const pct = p.totalBudget > 0 ? (p.actualCost / p.totalBudget) * 100 : 0
              const forecastPct = p.totalBudget > 0 ? (p.forecastCost / p.totalBudget) * 100 : 0
              const barWidth = (p.totalBudget / maxBudget) * 100
              return (
                <div key={p.id}>
                  <div className="flex justify-between items-baseline mb-1.5">
                    <span className="text-slate-200 text-sm font-medium truncate max-w-xs">{p.projectName}</span>
                    <span className="text-slate-400 text-xs ml-2 shrink-0">{fmt(p.totalBudget)}</span>
                  </div>
                  {/* Budget bar (full width = portfolio max) */}
                  <div className="h-5 bg-slate-700 rounded-lg overflow-hidden" style={{ width: `${barWidth}%`, minWidth: '40%' }}>
                    {/* Actual spent */}
                    <div className="h-full flex">
                      <div
                        className="h-full bg-blue-500 rounded-l-lg"
                        style={{ width: `${Math.min(100, pct)}%` }}
                        title={`Actual: ${fmt(p.actualCost)}`}
                      />
                      {forecastPct > pct && (
                        <div
                          className="h-full bg-amber-500/60"
                          style={{ width: `${Math.min(100, forecastPct - pct)}%` }}
                          title={`Forecast remaining: ${fmt(p.forecastCost - p.actualCost)}`}
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex gap-4 mt-1">
                    <span className="text-xs text-blue-400">Actual: {fmt(p.actualCost)}</span>
                    <span className="text-xs text-amber-400">Forecast: {fmt(p.forecastCost)}</span>
                  </div>
                </div>
              )
            })}

            {/* Legend */}
            <div className="flex gap-4 pt-2 border-t border-slate-700">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-blue-500" /><span className="text-xs text-slate-400">Actual Spent</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-amber-500/60" /><span className="text-xs text-slate-400">Remaining Forecast</span></div>
            </div>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Status breakdown */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h2 className="text-slate-100 font-semibold mb-4">Projects by Stage</h2>
          <div className="space-y-3">
            {Object.entries(byStatus).map(([status, count]) => (
              <div key={status} className="flex items-center gap-3">
                <div className={clsx('w-2.5 h-2.5 rounded-full shrink-0', STATUS_COLORS[status] ?? 'bg-slate-500')} />
                <span className="text-slate-300 text-sm flex-1">{STATUS_LABEL[status] ?? status}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={clsx('h-full rounded-full', STATUS_COLORS[status] ?? 'bg-slate-500')}
                      style={{ width: `${(count / projects.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-slate-400 text-xs w-4 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Profile breakdown */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
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
                  <div
                    className={clsx('h-full rounded-full', profileColors[profile] ?? 'bg-slate-500')}
                    style={{ width: `${(data.count / projects.length) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">Budget: {fmt(data.budget)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Budget summary totals */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h2 className="text-slate-100 font-semibold mb-4">Portfolio Budget Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryItem label="Total Budget" value={fmt(totalBudget)} />
          <SummaryItem label="Total Actual" value={fmt(totalActual)} />
          <SummaryItem label="Total Forecast" value={fmt(totalForecast)} accent={totalForecast > totalBudget ? 'red' : 'green'} />
          <SummaryItem label="Portfolio Variance" value={fmt(Math.abs(totalBudget - totalForecast))} accent={totalForecast > totalBudget ? 'red' : 'green'} sub={totalForecast > totalBudget ? 'Over' : 'Under'} />
        </div>
      </div>
    </div>
  )
}

function KPI({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color: string
}) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-slate-400 text-xs uppercase tracking-wide font-medium">{label}</p>
          <p className="text-xl font-bold text-slate-100 mt-1 truncate">{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
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
      <p className="text-slate-500 text-xs mb-1">{label}</p>
      <p className={clsx('text-lg font-semibold', accent === 'red' ? 'text-red-400' : accent === 'green' ? 'text-emerald-400' : 'text-slate-100')}>
        {value}
      </p>
      {sub && <p className={clsx('text-xs', accent === 'red' ? 'text-red-500' : 'text-emerald-500')}>{sub}</p>}
    </div>
  )
}
