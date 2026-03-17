import { useState } from 'react'
import { clsx } from 'clsx'
import {
  Plus, ChevronDown, ChevronRight, CheckCircle2, AlertTriangle,
  Clock, Calendar, Trash2, Pencil, BarChart2, Flag, Download, Lock,
} from 'lucide-react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useScheduleItems } from '@/hooks/useScheduleItems'
import type { ScheduleItem } from '@/hooks/useScheduleItems'
import type { Project } from '@/types'

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportScheduleCsv(items: ScheduleItem[], projectName: string) {
  const headers = [
    'Name', 'Start Date', 'End Date', 'Baseline Start', 'Baseline End',
    '% Complete', 'Status', 'Critical Path', 'Notes',
  ]
  const rows = items.map(i => {
    const status =
      i.percentComplete === 100 ? 'Complete'
      : !i.endDate ? 'Upcoming'
      : new Date(i.endDate) < new Date() ? 'Behind'
      : !i.startDate ? 'Upcoming'
      : new Date(i.startDate) <= new Date() ? 'In Progress'
      : 'Upcoming'
    return [
      i.name,
      i.startDate || '',
      i.endDate || '',
      i.baselineStart || '',
      i.baselineEnd || '',
      i.percentComplete,
      status,
      i.isCriticalPath ? 'Yes' : 'No',
      (i.notes || '').replace(/\n/g, ' '),
    ]
  })
  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${projectName.replace(/\s+/g, '_')}_Schedule.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d: string) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysBetween(a: string, b: string) {
  if (!a || !b) return null
  return Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24))
}

function itemStatus(item: ScheduleItem): 'complete' | 'behind' | 'in-progress' | 'upcoming' {
  const today = new Date()
  if (item.percentComplete === 100) return 'complete'
  if (!item.endDate) return 'upcoming'
  const end = new Date(item.endDate)
  if (end < today) return 'behind'
  if (!item.startDate) return 'upcoming'
  const start = new Date(item.startDate)
  if (start <= today) return 'in-progress'
  return 'upcoming'
}

const STATUS_CFG = {
  complete:    { label: 'Complete',    color: 'text-emerald-300', bg: 'bg-emerald-900/40 border-emerald-700/40', dot: 'bg-emerald-500' },
  'in-progress': { label: 'In Progress', color: 'text-blue-300',    bg: 'bg-blue-900/40 border-blue-700/40',    dot: 'bg-blue-500'    },
  behind:      { label: 'Behind',      color: 'text-red-300',     bg: 'bg-red-900/40 border-red-700/40',      dot: 'bg-red-500'     },
  upcoming:    { label: 'Upcoming',    color: 'text-slate-400',   bg: 'bg-slate-800/50 border-slate-700/40',  dot: 'bg-slate-500'   },
}

// ─── Add / Edit form ──────────────────────────────────────────────────────────

interface FormData {
  name: string
  startDate: string
  endDate: string
  baselineStart: string
  baselineEnd: string
  percentComplete: number
  isCriticalPath: boolean
  notes: string
  sortOrder: number
}

const blank = (): FormData => ({
  name: '', startDate: '', endDate: '', baselineStart: '', baselineEnd: '',
  percentComplete: 0, isCriticalPath: false, notes: '', sortOrder: 99,
})

function ScheduleForm({
  initial, onSave, onCancel,
}: {
  initial?: FormData
  onSave: (d: FormData) => void
  onCancel: () => void
}) {
  const [f, setF] = useState<FormData>(initial ?? blank())
  const set = (k: keyof FormData, v: FormData[keyof FormData]) => setF(p => ({ ...p, [k]: v }))

  return (
    <div className="bg-slate-800/70 border border-slate-700 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs text-slate-400 mb-1">Activity Name *</label>
          <input value={f.name} onChange={e => set('name', e.target.value)}
            placeholder="e.g. Construction Documents"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Actual Start</label>
          <input type="date" value={f.startDate} onChange={e => set('startDate', e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Actual End</label>
          <input type="date" value={f.endDate} onChange={e => set('endDate', e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Baseline Start</label>
          <input type="date" value={f.baselineStart} onChange={e => set('baselineStart', e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Baseline End</label>
          <input type="date" value={f.baselineEnd} onChange={e => set('baselineEnd', e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">% Complete</label>
          <div className="flex items-center gap-2">
            <input type="range" min={0} max={100} step={5}
              value={f.percentComplete} onChange={e => set('percentComplete', Number(e.target.value))}
              className="flex-1 accent-blue-500" />
            <span className="text-sm text-slate-200 w-10 text-right">{f.percentComplete}%</span>
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Sort Order</label>
          <input type="number" value={f.sortOrder} onChange={e => set('sortOrder', Number(e.target.value))}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
        </div>

        <div className="sm:col-span-2 flex items-center gap-2">
          <input type="checkbox" id="crit" checked={f.isCriticalPath} onChange={e => set('isCriticalPath', e.target.checked)}
            className="accent-red-500" />
          <label htmlFor="crit" className="text-sm text-slate-300">Critical Path item</label>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs text-slate-400 mb-1">Notes</label>
          <input value={f.notes} onChange={e => set('notes', e.target.value)}
            placeholder="Optional notes"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600 transition-colors">
          Cancel
        </button>
        <button onClick={() => { if (f.name.trim()) onSave(f) }}
          disabled={!f.name.trim()}
          className="px-4 py-1.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 transition-colors">
          Save
        </button>
      </div>
    </div>
  )
}

// ─── Schedule Row ─────────────────────────────────────────────────────────────

function ScheduleRow({
  item, onUpdate, onDelete,
}: {
  item: ScheduleItem
  onUpdate: (id: string, data: Partial<ScheduleItem>) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const status = itemStatus(item)
  const cfg = STATUS_CFG[status]

  // Variance: actual end vs baseline end
  const startVariance = item.startDate && item.baselineStart
    ? daysBetween(item.baselineStart, item.startDate)
    : null
  const endVariance = item.endDate && item.baselineEnd
    ? daysBetween(item.baselineEnd, item.endDate)
    : null

  const handleSave = (f: FormData) => {
    onUpdate(item.id, { ...f })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="px-1">
        <ScheduleForm
          initial={{
            name: item.name, startDate: item.startDate, endDate: item.endDate,
            baselineStart: item.baselineStart, baselineEnd: item.baselineEnd,
            percentComplete: item.percentComplete, isCriticalPath: item.isCriticalPath,
            notes: item.notes, sortOrder: item.sortOrder,
          }}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
        />
      </div>
    )
  }

  return (
    <div className={clsx('rounded-xl border transition-colors', cfg.bg)}>
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* % complete ring */}
        <button
          onClick={() => onUpdate(item.id, { percentComplete: item.percentComplete === 100 ? 0 : 100 })}
          className="shrink-0 relative w-8 h-8"
          title="Toggle complete"
        >
          <svg viewBox="0 0 32 32" className="w-8 h-8 -rotate-90">
            <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" strokeWidth="3"
              className="text-slate-700" />
            <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" strokeWidth="3"
              strokeDasharray={`${2 * Math.PI * 12}`}
              strokeDashoffset={`${2 * Math.PI * 12 * (1 - item.percentComplete / 100)}`}
              strokeLinecap="round"
              className={status === 'complete' ? 'text-emerald-400' : status === 'behind' ? 'text-red-400' : 'text-blue-400'} />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-slate-300" style={{ transform: 'rotate(90deg)' }}>
            {item.percentComplete}
          </span>
        </button>

        {/* Name + critical path badge */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={clsx('text-sm font-medium', item.percentComplete === 100 ? 'line-through text-slate-500' : 'text-slate-100')}>
              {item.name}
            </span>
            {item.isCriticalPath && (
              <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-red-900/60 text-red-300 border border-red-700/50">
                <Flag size={9} /> Critical
              </span>
            )}
          </div>
          {/* Dates row */}
          <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500 flex-wrap">
            {(item.startDate || item.endDate) && (
              <span className="flex items-center gap-1">
                <Calendar size={10} />
                {fmt(item.startDate)} → {fmt(item.endDate)}
              </span>
            )}
            {(item.baselineStart || item.baselineEnd) && (
              <span className="text-slate-600">
                Baseline: {fmt(item.baselineStart)} → {fmt(item.baselineEnd)}
              </span>
            )}
          </div>
        </div>

        {/* Variance chip */}
        {endVariance !== null && (
          <div className={clsx(
            'hidden sm:flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border shrink-0',
            endVariance > 0
              ? 'bg-red-900/40 text-red-300 border-red-700/50'
              : endVariance < 0
                ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50'
                : 'bg-slate-800 text-slate-400 border-slate-700'
          )}>
            {endVariance > 0 ? `+${endVariance}d` : endVariance < 0 ? `${endVariance}d` : 'On time'}
          </div>
        )}

        {/* Status badge */}
        <span className={clsx('hidden sm:inline text-xs font-medium shrink-0', cfg.color)}>
          {cfg.label}
        </span>

        {/* Expand */}
        <button onClick={() => setExpanded(!expanded)} className="text-slate-600 shrink-0">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setEditing(true)}
            className="p-1 text-slate-600 hover:text-blue-400 transition-colors">
            <Pencil size={13} />
          </button>
          <button onClick={() => onDelete(item.id)}
            className="p-1 text-slate-600 hover:text-red-400 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-3 border-t border-slate-700/50 mt-1 pt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <p className="text-slate-500 mb-0.5">Start Variance</p>
            <p className={clsx('font-medium', startVariance === null ? 'text-slate-500' : startVariance > 0 ? 'text-red-300' : startVariance < 0 ? 'text-emerald-300' : 'text-slate-300')}>
              {startVariance === null ? '—' : startVariance > 0 ? `+${startVariance}d late` : startVariance < 0 ? `${Math.abs(startVariance)}d early` : 'On time'}
            </p>
          </div>
          <div>
            <p className="text-slate-500 mb-0.5">End Variance</p>
            <p className={clsx('font-medium', endVariance === null ? 'text-slate-500' : endVariance > 0 ? 'text-red-300' : endVariance < 0 ? 'text-emerald-300' : 'text-slate-300')}>
              {endVariance === null ? '—' : endVariance > 0 ? `+${endVariance}d late` : endVariance < 0 ? `${Math.abs(endVariance)}d early` : 'On time'}
            </p>
          </div>
          <div>
            <p className="text-slate-500 mb-0.5">Duration (Actual)</p>
            <p className="text-slate-300 font-medium">
              {item.startDate && item.endDate ? `${daysBetween(item.startDate, item.endDate)}d` : '—'}
            </p>
          </div>
          <div>
            <p className="text-slate-500 mb-0.5">Duration (Baseline)</p>
            <p className="text-slate-300 font-medium">
              {item.baselineStart && item.baselineEnd ? `${daysBetween(item.baselineStart, item.baselineEnd)}d` : '—'}
            </p>
          </div>
          {item.notes && (
            <div className="col-span-2 sm:col-span-4">
              <p className="text-slate-500 mb-0.5">Notes</p>
              <p className="text-slate-300">{item.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main ScheduleTab ─────────────────────────────────────────────────────────

export function ScheduleTab({ project }: { project: Project }) {
  const { items, loading, seedDefaults, addItem, updateItem, deleteItem, spi, behindCount, overallPct } =
    useScheduleItems(project.id)
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState<'all' | 'behind' | 'in-progress' | 'upcoming' | 'complete'>('all')
  const [lockingBaseline, setLockingBaseline] = useState(false)

  const filtered = filter === 'all' ? items : items.filter(i => itemStatus(i) === filter)

  const handleAdd = async (f: FormData) => {
    await addItem({ ...f, projectId: project.id })
    setShowAdd(false)
  }

  const spiColor = spi === null ? 'text-slate-400' : spi >= 1.0 ? 'text-emerald-400' : spi >= 0.8 ? 'text-amber-400' : 'text-red-400'
  const spiLabel = spi === null ? 'N/A' : spi >= 1.0 ? 'On Schedule' : spi >= 0.8 ? 'Slightly Behind' : 'Behind Schedule'

  const lockBaseline = async () => {
    const itemsWithDates = items.filter(i => i.startDate || i.endDate)
    if (itemsWithDates.length === 0) {
      alert('No items with dates to lock as baseline.')
      return
    }
    if (!confirm(`Lock current dates as baseline for all ${itemsWithDates.length} item(s) with dates? This will overwrite any existing baseline dates.`)) return
    setLockingBaseline(true)
    const now = new Date().toISOString()
    await Promise.all(
      itemsWithDates.map(i =>
        updateDoc(doc(db, 'scheduleItems', i.id), {
          baselineStart: i.startDate,
          baselineEnd:   i.endDate,
          updatedAt:     now,
        })
      )
    )
    setLockingBaseline(false)
  }

  return (
    <div className="space-y-4">
      {/* KPI Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 text-center">
          <p className="text-xs text-slate-500 mb-1">Schedule Performance</p>
          <p className={clsx('text-2xl font-bold', spiColor)}>
            {spi !== null ? spi.toFixed(2) : '—'}
          </p>
          <p className={clsx('text-xs mt-0.5', spiColor)}>{spiLabel}</p>
        </div>
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 text-center">
          <p className="text-xs text-slate-500 mb-1">Overall Progress</p>
          <p className="text-2xl font-bold text-blue-300">{overallPct}%</p>
          <p className="text-xs text-slate-500 mt-0.5">{items.length} activities</p>
        </div>
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 text-center">
          <p className="text-xs text-slate-500 mb-1">Behind Schedule</p>
          <p className={clsx('text-2xl font-bold', behindCount > 0 ? 'text-red-400' : 'text-emerald-400')}>
            {behindCount}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">activities overdue</p>
        </div>
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 text-center">
          <p className="text-xs text-slate-500 mb-1">Critical Path Items</p>
          <p className="text-2xl font-bold text-red-400">
            {items.filter(i => i.isCriticalPath).length}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">flagged critical</p>
        </div>
      </div>

      {/* SPI explanation */}
      {spi !== null && (
        <div className={clsx(
          'flex items-start gap-2 text-xs px-3 py-2 rounded-lg border',
          spi >= 1.0
            ? 'bg-emerald-900/20 border-emerald-700/40 text-emerald-300'
            : spi >= 0.8
              ? 'bg-amber-900/20 border-amber-700/40 text-amber-300'
              : 'bg-red-900/20 border-red-700/40 text-red-300'
        )}>
          {spi >= 1.0 ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" /> : <AlertTriangle size={14} className="shrink-0 mt-0.5" />}
          <span>
            <strong>SPI {spi.toFixed(2)}</strong> — Schedule Performance Index (Earned Value ÷ Planned Value).{' '}
            {spi >= 1.0
              ? 'Work is being completed at or ahead of plan.'
              : spi >= 0.8
                ? 'Work is slightly behind plan. Monitor closely.'
                : 'Work is significantly behind plan. Corrective action required.'}
          </span>
        </div>
      )}

      {/* Filter + Actions bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap flex-1">
          {(['all', 'in-progress', 'behind', 'upcoming', 'complete'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                filter === s
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              )}>
              {s === 'all' ? 'All' : STATUS_CFG[s].label}
              {s !== 'all' && (
                <span className="ml-1 opacity-60">
                  {items.filter(i => itemStatus(i) === s).length}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {items.length === 0 && (
            <button onClick={seedDefaults}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600 px-3 py-1.5 rounded-lg transition-colors">
              <BarChart2 size={12} /> Seed defaults
            </button>
          )}
          {items.length > 0 && (
            <button
              onClick={lockBaseline}
              disabled={lockingBaseline}
              title="Copy current start/end dates to baseline for all items"
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              <Lock size={12} /> {lockingBaseline ? 'Locking…' : 'Lock Baseline'}
            </button>
          )}
          {items.length > 0 && (
            <button
              onClick={() => exportScheduleCsv(items, project.projectName || 'Project')}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Download size={12} /> Export CSV
            </button>
          )}
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 border border-blue-800/50 hover:border-blue-700 px-3 py-1.5 rounded-lg transition-colors shrink-0">
            <Plus size={12} /> Add Activity
          </button>
        </div>
      </div>

      {showAdd && (
        <ScheduleForm onSave={handleAdd} onCancel={() => setShowAdd(false)} />
      )}

      {/* Items list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Clock size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">{filter === 'all' ? 'No schedule activities yet.' : `No ${STATUS_CFG[filter]?.label} activities.`}</p>
          {filter === 'all' && (
            <p className="text-xs mt-1 text-slate-600">Add activities or use "Seed defaults" to get started.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => (
            <ScheduleRow key={item.id} item={item}
              onUpdate={updateItem} onDelete={deleteItem} />
          ))}
        </div>
      )}
    </div>
  )
}
