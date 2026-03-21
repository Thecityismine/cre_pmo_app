import { clsx } from 'clsx'
import { Check, AlertTriangle, Clock, Diamond } from 'lucide-react'
import { useScheduleItems } from '@/hooks/useScheduleItems'
import type { ScheduleItem } from '@/hooks/useScheduleItems'
import type { Project } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const parseLocal = (d: string) => { const [y, mo, day] = d.split('-').map(Number); return new Date(y, mo - 1, day) }

const fmtDate = (d: string) =>
  d ? parseLocal(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

type MilestoneStatus = 'complete' | 'delayed' | 'pending'

function getMilestoneStatus(item: ScheduleItem): MilestoneStatus {
  if (item.percentComplete === 100) return 'complete'
  if (item.endDate && parseLocal(item.endDate) < new Date()) return 'delayed'
  return 'pending'
}

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  dot: 'bg-slate-600 border-slate-500',    text: 'text-slate-400',   Icon: Clock },
  complete: { label: 'Complete', dot: 'bg-emerald-500 border-emerald-400', text: 'text-emerald-400', Icon: Check },
  delayed:  { label: 'Delayed',  dot: 'bg-red-500 border-red-400',         text: 'text-red-400',     Icon: AlertTriangle },
}

// ─── Milestone Row ─────────────────────────────────────────────────────────────

function MilestoneRow({
  item,
  onToggleComplete,
  onRemoveMilestone,
}: {
  item: ScheduleItem
  onToggleComplete: (id: string, pct: number) => void
  onRemoveMilestone: (id: string) => void
}) {
  const status = getMilestoneStatus(item)
  const cfg = STATUS_CONFIG[status]
  const targetDate = item.endDate || item.baselineEnd
  const isOverdue = status === 'delayed'

  return (
    <div className={clsx(
      'flex items-start gap-3 px-4 py-3 rounded-xl border mb-2 transition-colors',
      isOverdue ? 'bg-red-950/10 border-red-800/30' : 'bg-slate-900 border-slate-800'
    )}>
      {/* Status toggle */}
      <button
        onClick={() => onToggleComplete(item.id, item.percentComplete === 100 ? 0 : 100)}
        title="Click to toggle complete"
        className={clsx(
          'mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
          cfg.dot
        )}
      >
        {status === 'complete' && <Check size={10} className="text-white" />}
        {status === 'delayed' && <AlertTriangle size={9} className="text-white" />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={clsx('text-sm font-medium', status === 'complete' ? 'line-through text-slate-400' : 'text-slate-100')}>
            {item.name}
          </p>
          {isOverdue && <span className="text-xs text-red-400 font-medium">OVERDUE</span>}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {targetDate ? (
            <span className={clsx('text-xs', isOverdue ? 'text-red-400' : 'text-slate-400')}>
              Target: {fmtDate(targetDate)}
            </span>
          ) : (
            <span className="text-xs text-slate-500 italic">No end date set — edit in Schedule tab</span>
          )}
          {item.percentComplete > 0 && item.percentComplete < 100 && (
            <span className="text-xs text-blue-400">{item.percentComplete}% complete</span>
          )}
        </div>
      </div>

      {/* Status badge */}
      <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium shrink-0 hidden sm:inline-flex', cfg.text,
        status === 'complete' ? 'bg-emerald-900/40' : status === 'delayed' ? 'bg-red-900/40' : 'bg-slate-700')}>
        {cfg.label}
      </span>

      {/* Remove milestone flag */}
      <button
        onClick={() => onRemoveMilestone(item.id)}
        title="Remove milestone flag"
        className="p-1 text-purple-500 hover:text-slate-400 transition-colors shrink-0"
      >
        <Diamond size={13} fill="currentColor" />
      </button>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MilestoneTimeline({ project }: { project: Project }) {
  const { items, loading, updateItem } = useScheduleItems(project.id)

  const milestoneItems = items.filter(i => i.isMilestone)

  const completedCount = milestoneItems.filter(i => i.percentComplete === 100).length
  const delayedCount   = milestoneItems.filter(i => getMilestoneStatus(i) === 'delayed').length
  const pct = milestoneItems.length > 0 ? Math.round((completedCount / milestoneItems.length) * 100) : 0

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <p className="text-slate-100 font-semibold text-sm">Milestones</p>
          {milestoneItems.length > 0 && (
            <>
              <span className="text-xs text-slate-400">{completedCount}/{milestoneItems.length}</span>
              {delayedCount > 0 && (
                <span className="text-xs text-red-400 flex items-center gap-0.5">
                  <AlertTriangle size={10} /> {delayedCount} delayed
                </span>
              )}
            </>
          )}
        </div>
        <p className="text-xs text-slate-500 flex items-center gap-1">
          <Diamond size={10} className="text-purple-400" fill="currentColor" />
          Flag activities in the Schedule tab
        </p>
      </div>

      {/* Progress bar */}
      {milestoneItems.length > 0 && (
        <div className="px-4 pt-3 pb-1">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-slate-400 w-12 text-right">{pct}% done</span>
          </div>
        </div>
      )}

      {/* List */}
      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-6">
            <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : milestoneItems.length === 0 ? (
          <div className="text-center py-6 text-slate-400">
            <Diamond size={22} className="mx-auto mb-2 text-purple-600" />
            <p className="text-sm">No milestones flagged yet.</p>
            <p className="text-xs mt-1 text-slate-500">
              Click the <Diamond size={10} className="inline text-purple-400" fill="currentColor" /> icon on any Schedule activity to mark it as a milestone.
            </p>
          </div>
        ) : (
          milestoneItems.map(item => (
            <MilestoneRow
              key={item.id}
              item={item}
              onToggleComplete={(id, pct) => updateItem(id, { percentComplete: pct })}
              onRemoveMilestone={id => updateItem(id, { isMilestone: false })}
            />
          ))
        )}
      </div>
    </div>
  )
}
