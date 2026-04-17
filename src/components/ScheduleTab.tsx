import { useState, useMemo } from 'react'
import { clsx } from 'clsx'
import {
  Plus, ChevronDown, ChevronRight, CheckCircle2, AlertTriangle,
  Clock, Calendar, Trash2, Pencil, BarChart2, Flag, Download, Lock,
  List, GanttChartSquare, Link2, Diamond, TrendingUp, FileText,
} from 'lucide-react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useScheduleItems } from '@/hooks/useScheduleItems'
import type { ScheduleItem } from '@/hooks/useScheduleItems'
import { SCurveChart } from './SCurveChart'
import { useMilestones } from '@/hooks/useMilestones'
import type { Project } from '@/types'
import { exportGanttPdf } from '@/lib/exportPdf'

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

function fmtShort(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
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
  complete:    { label: 'Complete',    color: 'text-emerald-300', bg: 'bg-emerald-900/40 border-emerald-700/40', dot: 'bg-emerald-500', bar: 'bg-emerald-500' },
  'in-progress': { label: 'In Progress', color: 'text-blue-300',    bg: 'bg-blue-900/40 border-blue-700/40',    dot: 'bg-blue-500',    bar: 'bg-blue-500'    },
  behind:      { label: 'Behind',      color: 'text-red-300',     bg: 'bg-red-900/40 border-red-700/40',      dot: 'bg-red-500',     bar: 'bg-red-500'     },
  upcoming:    { label: 'Upcoming',    color: 'text-slate-400',   bg: 'bg-slate-900/50 border-slate-800/40',  dot: 'bg-slate-500',   bar: 'bg-slate-600'   },
}

// ─── Critical Path Method (CPM) ───────────────────────────────────────────────
// Returns the set of item IDs on the auto-detected critical path (float = 0).
// Falls back to manual isCriticalPath flags if no dependency data exists.

function computeCriticalPath(items: ScheduleItem[]): Set<string> {
  const withDates = items.filter(i => i.startDate && i.endDate)
  const hasDeps = withDates.some(i => (i.predecessors?.length ?? 0) > 0)

  if (!hasDeps) {
    // No dependency data — fall back to manual flags
    return new Set(items.filter(i => i.isCriticalPath).map(i => i.id))
  }

  const ms = (d: string) => new Date(d).getTime()
  const es: Record<string, number> = {}
  const ef: Record<string, number> = {}
  const ls: Record<string, number> = {}
  const lf: Record<string, number> = {}

  // Forward pass — process in sort order
  for (const item of withDates) {
    const preds = (item.predecessors ?? []).map(pid => withDates.find(i => i.id === pid)).filter(Boolean) as ScheduleItem[]
    es[item.id] = preds.length === 0
      ? ms(item.startDate)
      : Math.max(...preds.map(p => ef[p.id] ?? ms(item.startDate)))
    ef[item.id] = es[item.id] + (ms(item.endDate) - ms(item.startDate))
  }

  const projectEnd = Math.max(...withDates.map(i => ef[i.id]))

  // Backward pass — process in reverse sort order
  for (const item of [...withDates].reverse()) {
    const succs = withDates.filter(i => i.predecessors?.includes(item.id))
    lf[item.id] = succs.length === 0
      ? projectEnd
      : Math.min(...succs.map(s => ls[s.id] ?? projectEnd))
    ls[item.id] = lf[item.id] - (ms(item.endDate) - ms(item.startDate))
  }

  const oneDayMs = 1000 * 60 * 60 * 24
  const critical = new Set<string>()
  for (const item of withDates) {
    if (Math.abs(ls[item.id] - es[item.id]) < oneDayMs) critical.add(item.id)
  }
  return critical
}

// ─── Gantt View ───────────────────────────────────────────────────────────────

interface GanttProps {
  items: ScheduleItem[]
  milestones: Array<{ id: string; name: string; targetDate: string; status: string }>
  criticalIds: Set<string>
}

function GanttView({ items, milestones, criticalIds }: GanttProps) {
  // Compute date window
  const { windowStart, totalDays, months, todayPct, forecastDate } = useMemo(() => {
    const dates: Date[] = []
    for (const i of items) {
      if (i.startDate)     dates.push(new Date(i.startDate))
      if (i.endDate)       dates.push(new Date(i.endDate))
      if (i.baselineStart) dates.push(new Date(i.baselineStart))
      if (i.baselineEnd)   dates.push(new Date(i.baselineEnd))
    }
    for (const m of milestones) {
      if (m.targetDate) dates.push(new Date(m.targetDate))
    }

    const today = new Date()
    if (dates.length === 0) {
      // No dates — show 6-month window around today
      const s = new Date(today); s.setMonth(s.getMonth() - 1); s.setDate(1)
      const e = new Date(s); e.setMonth(e.getMonth() + 7)
      dates.push(s, e)
    }

    const minDate = new Date(Math.min(...dates.map(d => d.getTime())))
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())))

    // Pad by 2 weeks on each side
    const windowStart = new Date(minDate); windowStart.setDate(windowStart.getDate() - 14)
    const windowEnd   = new Date(maxDate); windowEnd.setDate(windowEnd.getDate() + 14)
    const totalDays   = Math.ceil((windowEnd.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24))

    const todayPct = Math.max(0, Math.min(100,
      ((today.getTime() - windowStart.getTime()) / (windowEnd.getTime() - windowStart.getTime())) * 100
    ))

    // Month tick marks
    const months: Array<{ label: string; leftPct: number }> = []
    const cur = new Date(windowStart); cur.setDate(1)
    while (cur <= windowEnd) {
      const pct = ((cur.getTime() - windowStart.getTime()) / (windowEnd.getTime() - windowStart.getTime())) * 100
      if (pct >= 0 && pct <= 100) months.push({ label: fmtShort(cur), leftPct: pct })
      cur.setMonth(cur.getMonth() + 1)
    }

    // Forecast completion date: estimate from current progress
    // Find items with dates, compute weighted finish estimate
    const itemsWithDates = items.filter(i => i.startDate && i.endDate)
    let forecastDate: Date | null = null
    if (itemsWithDates.length > 0) {
      // Find the latest end date among in-progress/behind items adjusted for remaining work
      let latestForecast = new Date(0)
      let hasEstimate = false
      for (const i of itemsWithDates) {
        const end = new Date(i.endDate)
        if (i.percentComplete === 100) {
          // Complete — use actual end
          if (end > latestForecast) { latestForecast = end; hasEstimate = true }
        } else {
          const start = new Date(i.startDate)
          const duration = (end.getTime() - start.getTime())
          const remaining = duration * (1 - i.percentComplete / 100)
          const estimated = new Date(today.getTime() + remaining)
          if (estimated > latestForecast) { latestForecast = estimated; hasEstimate = true }
        }
      }
      if (hasEstimate && latestForecast.getTime() > 0) forecastDate = latestForecast
    }

    return { windowStart, windowEnd, totalDays, months, todayPct, forecastDate }
  }, [items, milestones])

  function pct(dateStr: string) {
    if (!dateStr) return null
    const d = new Date(dateStr)
    return Math.max(0, Math.min(100,
      ((d.getTime() - windowStart.getTime()) / (totalDays * 24 * 60 * 60 * 1000)) * 100
    ))
  }

  const ROW_H = 40 // px per activity row
  const LABEL_W = 180 // px for name column

  const milestonesWithDates = milestones.filter(m => m.targetDate)

  return (
    <div className="bg-slate-900/40 border border-slate-800/50 rounded-xl overflow-hidden">
      <div className="flex" style={{ minWidth: 640 }}>
        {/* Label column */}
        <div className="shrink-0 border-r border-slate-800/50" style={{ width: LABEL_W }}>
          {/* Header */}
          <div className="h-8 flex items-center px-3 border-b border-slate-800/50 bg-slate-900/60">
            <span className="text-xs text-slate-400 font-medium">Activity</span>
          </div>
          {items.map(item => {
            const status = itemStatus(item)
            const cfg = STATUS_CFG[status]
            const isCrit = criticalIds.has(item.id)
            const hasPreds = (item.predecessors?.length ?? 0) > 0
            return (
              <div key={item.id}
                className="flex items-center gap-1.5 px-3 border-b border-slate-800/30"
                style={{ height: ROW_H }}>
                <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', cfg.dot)} />
                <span className={clsx(
                  'text-xs truncate',
                  item.percentComplete === 100 ? 'text-slate-400 line-through' : 'text-slate-200'
                )} title={item.name}>
                  {item.name}
                </span>
                {hasPreds && <Link2 size={8} className="text-blue-500 shrink-0" />}
                {isCrit && <Flag size={9} className="text-red-400 shrink-0" />}
              </div>
            )
          })}
          {/* Milestone rows */}
          {milestonesWithDates.length > 0 && (
            <>
              <div className="h-6 flex items-center px-3 border-b border-slate-800/50 bg-slate-900/40">
                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Milestones</span>
              </div>
              {milestonesWithDates.map(m => (
                <div key={m.id}
                  className="flex items-center gap-1.5 px-3 border-b border-slate-800/30"
                  style={{ height: ROW_H - 8 }}>
                  <span className={clsx(
                    'w-2 h-2 rotate-45 shrink-0',
                    m.status === 'complete' ? 'bg-emerald-400' : m.status === 'delayed' ? 'bg-red-400' : 'bg-amber-400'
                  )} />
                  <span className="text-[11px] text-slate-400 truncate" title={m.name}>{m.name}</span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Timeline area */}
        <div className="flex-1 overflow-x-auto">
          <div style={{ minWidth: 460, position: 'relative' }}>
            {/* Month headers */}
            <div className="h-8 border-b border-slate-800/50 bg-slate-900/60 relative select-none">
              {months.map((m, i) => (
                <div key={i}
                  className="absolute top-0 h-full flex items-center border-l border-slate-800/40 pl-1"
                  style={{ left: `${m.leftPct}%` }}>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">{m.label}</span>
                </div>
              ))}
            </div>

            {/* Today line */}
            <div
              className="absolute top-8 bottom-0 w-px bg-amber-400/70 z-10 pointer-events-none"
              style={{ left: `${todayPct}%` }}
            >
              <span className="absolute -top-0 -translate-x-1/2 bg-amber-400 text-slate-900 text-[9px] font-bold px-1 rounded whitespace-nowrap">
                Today
              </span>
            </div>

            {/* Forecast line */}
            {forecastDate && (() => {
              const forecastStr = forecastDate.toISOString().slice(0, 10)
              const fp = pct(forecastStr)
              return fp !== null && fp !== todayPct ? (
                <div
                  className="absolute top-8 bottom-0 w-px border-l border-dashed border-blue-400/50 z-10 pointer-events-none"
                  style={{ left: `${fp}%` }}
                >
                  <span className="absolute -top-0 -translate-x-full bg-blue-900 text-blue-300 text-[9px] font-medium px-1 rounded whitespace-nowrap border border-blue-700/50">
                    Forecast
                  </span>
                </div>
              ) : null
            })()}

            {/* Activity bars */}
            {items.map(item => {
              const status = itemStatus(item)
              const cfg = STATUS_CFG[status]
              const isCrit = criticalIds.has(item.id)
              const startP = pct(item.startDate)
              const endP   = pct(item.endDate)
              const baseStartP = pct(item.baselineStart)
              const baseEndP   = pct(item.baselineEnd)
              const hasBar     = startP !== null && endP !== null && endP > startP
              const hasBase    = baseStartP !== null && baseEndP !== null && baseEndP > baseStartP

              return (
                <div key={item.id}
                  className="relative border-b border-slate-800/30"
                  style={{ height: ROW_H }}>
                  {/* Grid lines */}
                  {months.map((m, i) => (
                    <div key={i}
                      className="absolute top-0 bottom-0 w-px bg-slate-700/20"
                      style={{ left: `${m.leftPct}%` }} />
                  ))}

                  {/* Baseline bar (thin, behind) */}
                  {hasBase && (
                    <div
                      className="absolute rounded-sm bg-slate-600/50 border border-slate-500/40"
                      style={{
                        left:   `${baseStartP}%`,
                        width:  `${baseEndP! - baseStartP!}%`,
                        top:    '60%',
                        height: 4,
                        transform: 'translateY(-50%)',
                      }}
                      title={`Baseline: ${fmt(item.baselineStart)} → ${fmt(item.baselineEnd)}`}
                    />
                  )}

                  {/* Actual bar */}
                  {hasBar && (
                    <div
                      className={clsx(
                        'absolute rounded flex items-center overflow-hidden',
                        isCrit ? 'ring-1 ring-red-500/60' : '',
                        cfg.bar,
                      )}
                      style={{
                        left:   `${startP}%`,
                        width:  `${endP! - startP!}%`,
                        top:    '20%',
                        height: '38%',
                      }}
                      title={`${item.name}: ${fmt(item.startDate)} → ${fmt(item.endDate)} (${item.percentComplete}%)`}
                    >
                      {/* Progress fill overlay */}
                      <div
                        className="h-full bg-white/20"
                        style={{ width: `${item.percentComplete}%` }}
                      />
                    </div>
                  )}

                  {/* No dates placeholder */}
                  {!hasBar && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[10px] text-slate-400 italic">no dates</span>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Milestone rows */}
            {milestonesWithDates.length > 0 && (
              <>
                <div style={{ height: 24 }} className="border-b border-slate-800/50 bg-slate-900/20" />
                {milestonesWithDates.map(m => {
                  const mp = pct(m.targetDate)
                  return (
                    <div key={m.id}
                      className="relative border-b border-slate-800/30"
                      style={{ height: ROW_H - 8 }}>
                      {months.map((mo, i) => (
                        <div key={i}
                          className="absolute top-0 bottom-0 w-px bg-slate-700/20"
                          style={{ left: `${mo.leftPct}%` }} />
                      ))}
                      {mp !== null && (
                        <div
                          className="absolute z-10"
                          style={{ left: `${mp}%`, top: '50%', transform: 'translate(-50%, -50%)' }}
                          title={`${m.name}: ${fmt(m.targetDate)}`}
                        >
                          {/* Diamond shape */}
                          <div className={clsx(
                            'w-3 h-3 rotate-45',
                            m.status === 'complete' ? 'bg-emerald-400' : m.status === 'delayed' ? 'bg-red-400' : 'bg-amber-400'
                          )} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-t border-slate-800/50 bg-slate-900/30 flex-wrap">
        <span className="text-[10px] text-slate-400 font-medium">Legend:</span>
        {Object.entries(STATUS_CFG).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1">
            <span className={clsx('inline-block w-6 h-2 rounded', v.bar)} />
            <span className="text-[10px] text-slate-400">{v.label}</span>
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="inline-block w-6 h-1 bg-slate-600/50 border border-slate-500/40 rounded-sm" />
          <span className="text-[10px] text-slate-400">Baseline</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-1 h-3 bg-amber-400/70" />
          <span className="text-[10px] text-slate-400">Today</span>
        </span>
        <span className="flex items-center gap-1">
          <span className={clsx('inline-block w-2 h-2 rotate-45 bg-amber-400')} />
          <span className="text-[10px] text-slate-400">Milestone</span>
        </span>
        {forecastDate && (
          <span className="text-[10px] text-blue-300">
            Forecast completion: {forecastDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        )}
      </div>
    </div>
  )
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
  predecessors: string[]
  notes: string
  sortOrder: number
}

const blank = (): FormData => ({
  name: '', startDate: '', endDate: '', baselineStart: '', baselineEnd: '',
  percentComplete: 0, isCriticalPath: false, predecessors: [], notes: '', sortOrder: 155,
})

function ScheduleForm({
  initial, onSave, onCancel, allItems = [], editingId,
}: {
  initial?: FormData
  onSave: (d: FormData) => void
  onCancel: () => void
  allItems?: ScheduleItem[]
  editingId?: string
}) {
  const [f, setF] = useState<FormData>(initial ?? blank())
  const set = (k: keyof FormData, v: FormData[keyof FormData]) => setF(p => ({ ...p, [k]: v }))

  const togglePred = (id: string) => {
    setF(p => ({
      ...p,
      predecessors: p.predecessors.includes(id)
        ? p.predecessors.filter(x => x !== id)
        : [...p.predecessors, id],
    }))
  }

  const availablePreds = allItems.filter(i => i.id !== editingId)

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs text-slate-400 mb-1">Activity Name *</label>
          <input value={f.name} onChange={e => set('name', e.target.value)}
            placeholder="e.g. Construction Documents"
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Baseline Start</label>
          <input type="date" value={f.baselineStart} onChange={e => set('baselineStart', e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Baseline End</label>
          <input type="date" value={f.baselineEnd} onChange={e => set('baselineEnd', e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Actual Start</label>
          <input type="date" value={f.startDate} onChange={e => set('startDate', e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Actual End</label>
          <input type="date" value={f.endDate} onChange={e => set('endDate', e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
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
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
        </div>

        <div className="sm:col-span-2 flex items-center gap-2">
          <input type="checkbox" id="crit" checked={f.isCriticalPath} onChange={e => set('isCriticalPath', e.target.checked)}
            className="accent-red-500" />
          <label htmlFor="crit" className="text-sm text-slate-300">Manual critical path flag</label>
          <span className="text-xs text-slate-400">(auto-detected when dependencies are set)</span>
        </div>

        {availablePreds.length > 0 && (
          <div className="sm:col-span-2">
            <label className="block text-xs text-slate-400 mb-1">
              <span className="flex items-center gap-1"><Link2 size={10} /> Predecessors (Finish-to-Start)</span>
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              {availablePreds.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => togglePred(item.id)}
                  className={clsx(
                    'text-xs px-2 py-0.5 rounded border transition-colors',
                    f.predecessors.includes(item.id)
                      ? 'bg-blue-900/60 border-blue-600 text-blue-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-500 hover:text-slate-200',
                  )}
                >
                  {item.name}
                </button>
              ))}
            </div>
            {f.predecessors.length > 0 && (
              <p className="text-[10px] text-blue-400 mt-1">
                {f.predecessors.length} predecessor{f.predecessors.length > 1 ? 's' : ''} selected — this activity starts after they finish
              </p>
            )}
          </div>
        )}

        <div className="sm:col-span-2">
          <label className="block text-xs text-slate-400 mb-1">Notes</label>
          <input value={f.notes} onChange={e => set('notes', e.target.value)}
            placeholder="Optional notes"
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-800 transition-colors">
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
  item, onUpdate, onDelete, allItems = [], isAutoCritical = false,
}: {
  item: ScheduleItem
  onUpdate: (id: string, data: Partial<ScheduleItem>) => void
  onDelete: (id: string) => void
  allItems?: ScheduleItem[]
  isAutoCritical?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const status = itemStatus(item)
  const cfg = STATUS_CFG[status]

  // Predecessor info
  const predecessors = (item.predecessors ?? [])
    .map(pid => allItems.find(i => i.id === pid))
    .filter(Boolean) as ScheduleItem[]

  // Successors (items that depend on this one)
  const successors = allItems.filter(i => i.predecessors?.includes(item.id))

  // Delay impact: this item is behind AND has successors
  const isBehind = status === 'behind'
  const impactsCount = isBehind ? successors.length : 0

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
            predecessors: item.predecessors ?? [],
            notes: item.notes, sortOrder: item.sortOrder,
          }}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
          allItems={allItems}
          editingId={item.id}
        />
      </div>
    )
  }

  const isWarranty = item.isWarranty || item.name?.toLowerCase() === 'warranty period'

  return (
    <div className={clsx(
      'rounded-xl border transition-colors',
      isWarranty
        ? 'bg-amber-950/40 border-amber-600/50'
        : cfg.bg
    )}>
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
            <span className={clsx('text-sm font-medium', item.percentComplete === 100 ? 'line-through text-slate-400' : 'text-slate-100')}>
              {item.name}
            </span>
            {isWarranty && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-800/60 text-amber-300 border border-amber-600/50 font-medium">
                Warranty
              </span>
            )}
            {item.isMilestone && (
              <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-purple-900/60 text-purple-300 border border-purple-700/50 font-medium">
                <Diamond size={8} fill="currentColor" /> Milestone
              </span>
            )}
            {isAutoCritical && (
              <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-red-900/60 text-red-300 border border-red-700/50">
                <Flag size={9} /> Critical Path
              </span>
            )}
            {predecessors.length > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-blue-400">
                <Link2 size={9} /> {predecessors.length} dep
              </span>
            )}
            {impactsCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-orange-900/50 text-orange-300 border border-orange-700/40">
                <AlertTriangle size={9} /> delays {impactsCount} downstream
              </span>
            )}
            {status === 'complete' && item.startDate && item.endDate && (() => {
              const weeks = Math.round((new Date(item.endDate).getTime() - new Date(item.startDate).getTime()) / (7 * 24 * 60 * 60 * 1000));
              return weeks > 0 ? (
                <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-900/50 text-emerald-300 border border-emerald-700/50 font-medium">
                  {weeks} wk{weeks !== 1 ? 's' : ''}
                </span>
              ) : null;
            })()}
          </div>
          {/* Dates row */}
          <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400 flex-wrap">
            {(item.startDate || item.endDate) && (
              <span className="flex items-center gap-1">
                <Calendar size={10} />
                {fmt(item.startDate)} → {fmt(item.endDate)}
              </span>
            )}
            {(item.baselineStart || item.baselineEnd) && (
              <span className="text-slate-400">
                Baseline: {fmt(item.baselineStart)} → {fmt(item.baselineEnd)}
              </span>
            )}
          </div>
        </div>

        {/* Variance chip */}
        {endVariance !== null && (
          status === 'complete' && endVariance < 0 ? (
            // Completed ahead of schedule — lightning badge
            <div className="hidden sm:flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border shrink-0 bg-emerald-900/40 text-emerald-300 border-emerald-700/50">
              ⚡ {Math.abs(endVariance) >= 7 ? `${Math.round(Math.abs(endVariance) / 7)}W` : `${Math.abs(endVariance)}D`} Ahead
            </div>
          ) : (
            <div className={clsx(
              'hidden sm:flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border shrink-0',
              endVariance > 0
                ? 'bg-red-900/40 text-red-300 border-red-700/50'
                : endVariance < 0
                  ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50'
                  : 'bg-slate-900 text-slate-400 border-slate-800'
            )}>
              {endVariance > 0 ? `+${endVariance}d` : endVariance < 0 ? `${endVariance}d` : 'On time'}
            </div>
          )
        )}

        {/* Status badge */}
        <span className={clsx('hidden sm:inline text-xs font-medium shrink-0', cfg.color)}>
          {cfg.label}
        </span>

        {/* Expand */}
        <button onClick={() => setExpanded(!expanded)} className="text-slate-400 shrink-0">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onUpdate(item.id, { isMilestone: !item.isMilestone })}
            title={item.isMilestone ? 'Remove milestone flag' : 'Mark as milestone'}
            className={clsx('p-1 transition-colors', item.isMilestone ? 'text-purple-400 hover:text-purple-300' : 'text-slate-600 hover:text-purple-400')}
          >
            <Diamond size={13} fill={item.isMilestone ? 'currentColor' : 'none'} />
          </button>
          <button onClick={() => setEditing(true)}
            className="p-1 text-slate-400 hover:text-blue-400 transition-colors">
            <Pencil size={13} />
          </button>
          <button onClick={() => onDelete(item.id)}
            className="p-1 text-slate-400 hover:text-red-400 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-3 border-t border-slate-800/50 mt-1 pt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <p className="text-slate-400 mb-0.5">Start Variance</p>
            <p className={clsx('font-medium', startVariance === null ? 'text-slate-400' : startVariance > 0 ? 'text-red-300' : startVariance < 0 ? 'text-emerald-300' : 'text-slate-300')}>
              {startVariance === null ? '—' : startVariance > 0 ? `+${startVariance}d late` : startVariance < 0 ? `${Math.abs(startVariance)}d early` : 'On time'}
            </p>
          </div>
          <div>
            <p className="text-slate-400 mb-0.5">End Variance</p>
            <p className={clsx('font-medium', endVariance === null ? 'text-slate-400' : endVariance > 0 ? 'text-red-300' : endVariance < 0 ? 'text-emerald-300' : 'text-slate-300')}>
              {endVariance === null ? '—' : endVariance > 0 ? `+${endVariance}d late` : endVariance < 0 ? `${Math.abs(endVariance)}d early` : 'On time'}
            </p>
          </div>
          <div>
            <p className="text-slate-400 mb-0.5">Duration (Actual)</p>
            <p className="text-slate-300 font-medium">
              {item.startDate && item.endDate ? `${daysBetween(item.startDate, item.endDate)}d` : '—'}
            </p>
          </div>
          <div>
            <p className="text-slate-400 mb-0.5">Duration (Baseline)</p>
            <p className="text-slate-300 font-medium">
              {item.baselineStart && item.baselineEnd ? `${daysBetween(item.baselineStart, item.baselineEnd)}d` : '—'}
            </p>
          </div>
          {predecessors.length > 0 && (
            <div className="col-span-2 sm:col-span-4">
              <p className="text-slate-400 mb-0.5">Predecessors (must finish first)</p>
              <div className="flex flex-wrap gap-1.5">
                {predecessors.map(p => {
                  const ps = itemStatus(p)
                  return (
                    <span key={p.id} className={clsx(
                      'text-xs px-2 py-0.5 rounded border',
                      ps === 'behind' ? 'bg-red-900/40 border-red-700/40 text-red-300'
                      : ps === 'complete' ? 'bg-emerald-900/40 border-emerald-700/40 text-emerald-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400',
                    )}>
                      {p.name}
                      {ps === 'behind' && ' ⚠ behind'}
                      {ps === 'complete' && ' ✓'}
                    </span>
                  )
                })}
              </div>
            </div>
          )}
          {successors.length > 0 && (
            <div className="col-span-2 sm:col-span-4">
              <p className="text-slate-400 mb-0.5">Successors (depend on this)</p>
              <div className="flex flex-wrap gap-1.5">
                {successors.map(s => (
                  <span key={s.id} className="text-xs px-2 py-0.5 rounded border bg-slate-900 border-slate-800 text-slate-400">
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          {item.notes && (
            <div className="col-span-2 sm:col-span-4">
              <p className="text-slate-400 mb-0.5">Notes</p>
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
  const { items, loading, seeding, seedDefaults, addItem, updateItem, deleteItem, spi, behindCount, overallPct } =
    useScheduleItems(project.id)
  const { milestones } = useMilestones(project.id)
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState<'all' | 'behind' | 'in-progress' | 'upcoming' | 'complete'>('all')
  const [viewMode, setViewMode] = useState<'list' | 'gantt' | 'scurve'>('list')
  const [lockingBaseline, setLockingBaseline] = useState(false)

  // Auto-detect critical path via CPM
  const criticalIds = useMemo(() => computeCriticalPath(items), [items])

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
        <div className="bg-slate-900/60 border border-slate-800/50 rounded-xl p-3 text-center">
          <p className="text-xs text-slate-400 mb-1">Schedule Performance</p>
          <p className={clsx('text-2xl font-bold', spiColor)}>
            {spi !== null ? spi.toFixed(2) : '—'}
          </p>
          <p className={clsx('text-xs mt-0.5', spiColor)}>{spiLabel}</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800/50 rounded-xl p-3 text-center">
          <p className="text-xs text-slate-400 mb-1">Overall Progress</p>
          <p className="text-2xl font-bold text-blue-300">{overallPct}%</p>
          <p className="text-xs text-slate-400 mt-0.5">{items.length} activities</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800/50 rounded-xl p-3 text-center">
          <p className="text-xs text-slate-400 mb-1">Behind Schedule</p>
          <p className={clsx('text-2xl font-bold', behindCount > 0 ? 'text-red-400' : 'text-emerald-400')}>
            {behindCount}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">activities overdue</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800/50 rounded-xl p-3 text-center">
          <p className="text-xs text-slate-400 mb-1">Critical Path Items</p>
          <p className="text-2xl font-bold text-red-400">
            {criticalIds.size}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {items.some(i => (i.predecessors?.length ?? 0) > 0) ? 'auto-detected' : 'manually flagged'}
          </p>
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

      {/* Toolbar — row 1: view toggle + actions */}
      <div className="flex items-center gap-2">
        {/* View toggle */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 shrink-0">
          <button
            onClick={() => setViewMode('list')}
            className={clsx(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
              viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            )}>
            <List size={12} /> List
          </button>
          <button
            onClick={() => setViewMode('gantt')}
            className={clsx(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
              viewMode === 'gantt' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            )}>
            <GanttChartSquare size={12} /> Gantt
          </button>
          <button
            onClick={() => setViewMode('scurve')}
            className={clsx(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
              viewMode === 'scurve' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            )}>
            <TrendingUp size={12} /> S-Curve
          </button>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {items.length === 0 && (
            <button onClick={seedDefaults} disabled={seeding}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-800 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
              <BarChart2 size={12} /> {seeding ? 'Seeding…' : 'Seed defaults'}
            </button>
          )}
          {items.length > 0 && (
            <button
              onClick={lockBaseline}
              disabled={lockingBaseline}
              title="Copy current start/end dates to baseline for all items"
              className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-800 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              <Lock size={12} /> {lockingBaseline ? 'Locking…' : 'Lock Baseline'}
            </button>
          )}
          {items.length > 0 && (
            <button
              onClick={() => exportScheduleCsv(items, project.projectName || 'Project')}
              className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-800 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Download size={12} /> Export CSV
            </button>
          )}
          {items.length > 0 && (
            <button
              onClick={() => exportGanttPdf(project, items, milestones, { spi, overallPct, behindCount, criticalIds })}
              className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-800 px-3 py-1.5 rounded-lg transition-colors"
            >
              <FileText size={12} /> Export PDF
            </button>
          )}
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 border border-blue-800/50 hover:border-blue-700 px-3 py-1.5 rounded-lg transition-colors shrink-0">
            <Plus size={12} /> Add Activity
          </button>
        </div>
      </div>

      {/* Toolbar — row 2: status filters (scrollable on mobile) */}
      {viewMode === 'list' && (
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
          {(['all', 'in-progress', 'behind', 'upcoming', 'complete'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={clsx(
                'shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                filter === s
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              )}>
              {s === 'all' ? 'All' : STATUS_CFG[s].label}
              {s !== 'all' && (
                <span className="ml-1 opacity-60">
                  {items.filter(i => itemStatus(i) === s).length}
                </span>
              )}
            </button>
          ))}
          {/* Action buttons visible only on mobile in row 2 */}
          {items.length > 0 && (
            <button onClick={lockBaseline} disabled={lockingBaseline}
              className="sm:hidden shrink-0 flex items-center gap-1 text-xs text-slate-400 border border-slate-800 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ml-auto">
              <Lock size={12} /> Baseline
            </button>
          )}
          {items.length > 0 && (
            <button onClick={() => exportScheduleCsv(items, project.projectName || 'Project')}
              className="sm:hidden shrink-0 flex items-center gap-1 text-xs text-slate-400 border border-slate-800 px-3 py-1.5 rounded-lg transition-colors">
              <Download size={12} /> CSV
            </button>
          )}
        </div>
      )}

      {showAdd && (
        <ScheduleForm onSave={handleAdd} onCancel={() => setShowAdd(false)} allItems={items} />
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : viewMode === 'scurve' ? (
        <SCurveChart items={items} />
      ) : viewMode === 'gantt' ? (
        items.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Clock size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No schedule activities yet.</p>
            <p className="text-xs mt-1 text-slate-400">Add activities or use "Seed defaults" to get started.</p>
          </div>
        ) : (
          <GanttView items={items} milestones={milestones} criticalIds={criticalIds} />
        )
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Clock size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">{filter === 'all' ? 'No schedule activities yet.' : `No ${STATUS_CFG[filter]?.label} activities.`}</p>
          {filter === 'all' && (
            <p className="text-xs mt-1 text-slate-400">Add activities or use "Seed defaults" to get started.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => (
            <ScheduleRow key={item.id} item={item}
              onUpdate={updateItem} onDelete={deleteItem}
              allItems={items} isAutoCritical={criticalIds.has(item.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
