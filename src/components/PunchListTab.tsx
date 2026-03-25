import { useState } from 'react'
import { clsx } from 'clsx'
import { Plus, Check, Trash2, Pencil, ClipboardList, ChevronDown, ChevronRight } from 'lucide-react'
import { usePunchList } from '@/hooks/usePunchList'
import type { PunchItem, PunchStatus, PunchPriority } from '@/hooks/usePunchList'
import type { Project } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PunchStatus, { label: string; color: string; bg: string; dot: string }> = {
  'open':        { label: 'Open',        color: 'text-slate-300',  bg: 'bg-slate-700',       dot: 'bg-slate-500' },
  'in-progress': { label: 'In Progress', color: 'text-blue-300',   bg: 'bg-blue-900/50',     dot: 'bg-blue-500' },
  'complete':    { label: 'Complete',    color: 'text-emerald-300',bg: 'bg-emerald-900/50',  dot: 'bg-emerald-500' },
  'disputed':    { label: 'Disputed',    color: 'text-red-300',    bg: 'bg-red-900/50',      dot: 'bg-red-500' },
}

const PRIORITY_CONFIG: Record<PunchPriority, { label: string; color: string }> = {
  'high':   { label: 'High',   color: 'text-red-400' },
  'medium': { label: 'Medium', color: 'text-amber-400' },
  'low':    { label: 'Low',    color: 'text-slate-400' },
}

const TRADES = [
  'General Contractor', 'Electrical', 'Plumbing', 'HVAC / Mechanical',
  'Painting', 'Flooring', 'Ceiling / Drywall', 'Millwork / Carpentry',
  'Doors / Hardware', 'FF&E', 'IT / AV', 'Fire Protection', 'Other',
]

const fmtDate = (d: string) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, color = 'default' }: {
  label: string; value: string | number; color?: 'emerald' | 'red' | 'amber' | 'default'
}) {
  const accent = color === 'emerald' ? 'border-emerald-700/50 bg-emerald-900/20'
    : color === 'red' ? 'border-red-700/50 bg-red-900/20'
    : color === 'amber' ? 'border-amber-700/50 bg-amber-900/20'
    : 'border-slate-800 bg-slate-900'
  const txt = color === 'emerald' ? 'text-emerald-300'
    : color === 'red' ? 'text-red-300'
    : color === 'amber' ? 'text-amber-300'
    : 'text-slate-100'
  return (
    <div className={clsx('rounded-xl p-3 border', accent)}>
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className={clsx('text-xl font-bold', txt)}>{value}</p>
    </div>
  )
}

// ─── Form ─────────────────────────────────────────────────────────────────────

type FormData = {
  description: string; location: string; trade: string
  status: PunchStatus; priority: PunchPriority; dueDate: string
  completedDate: string; notes: string
}
const EMPTY: FormData = {
  description: '', location: '', trade: '',
  status: 'open', priority: 'medium', dueDate: '', completedDate: '', notes: '',
}

function PunchForm({
  projectId, initial, onSave, onCancel,
}: {
  projectId: string
  initial?: FormData
  onSave: (data: Omit<PunchItem, 'id' | 'number' | 'createdAt' | 'updatedAt'>) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState<FormData>(initial ?? EMPTY)
  const [saving, setSaving] = useState(false)
  const f = (k: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }))

  const save = async () => {
    if (!form.description.trim()) return
    setSaving(true)
    await onSave({ projectId, ...form, description: form.description.trim() })
    setSaving(false)
    onCancel()
  }

  return (
    <div className="bg-slate-900 border border-blue-600/50 rounded-xl p-4 space-y-3 mb-3">
      <textarea value={form.description} onChange={f('description')} placeholder="Deficiency description *" rows={2} autoFocus
        className="w-full bg-slate-700 text-slate-100 text-sm rounded-lg px-3 py-2 border border-slate-800 focus:outline-none focus:border-blue-500 resize-none placeholder-slate-500" />

      <div className="grid grid-cols-2 gap-2">
        <input value={form.location} onChange={f('location')} placeholder="Location / Room"
          className="bg-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-800 focus:outline-none focus:border-blue-500 placeholder-slate-500" />

        <select value={form.trade} onChange={f('trade')}
          className="bg-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-800 focus:outline-none focus:border-blue-500">
          <option value="">Trade responsible…</option>
          {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <div>
          <label className="text-xs text-slate-400 mb-1 block">Priority</label>
          <div className="flex gap-1">
            {(['high', 'medium', 'low'] as PunchPriority[]).map(p => (
              <button key={p} onClick={() => setForm(prev => ({ ...prev, priority: p }))}
                className={clsx(
                  'flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                  form.priority === p
                    ? p === 'high' ? 'bg-red-900/60 text-red-300 border-red-700'
                      : p === 'medium' ? 'bg-amber-900/60 text-amber-300 border-amber-700'
                      : 'bg-slate-700 text-slate-300 border-slate-500'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                )}>
                {PRIORITY_CONFIG[p].label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 mb-1 block">Status</label>
          <select value={form.status} onChange={f('status')}
            className="w-full bg-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-800 focus:outline-none focus:border-blue-500">
            {(Object.keys(STATUS_CONFIG) as PunchStatus[]).map(s => (
              <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-slate-400 mb-1 block">Due Date</label>
          <input type="date" value={form.dueDate} onChange={f('dueDate')}
            className="w-full bg-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-800 focus:outline-none focus:border-blue-500" />
        </div>

        <div>
          <label className="text-xs text-slate-400 mb-1 block">Completed Date</label>
          <input type="date" value={form.completedDate} onChange={f('completedDate')}
            className="w-full bg-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-800 focus:outline-none focus:border-blue-500" />
        </div>
      </div>

      <textarea value={form.notes} onChange={f('notes')} placeholder="Notes (optional)" rows={2}
        className="w-full bg-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-800 focus:outline-none focus:border-blue-500 resize-none placeholder-slate-500" />

      <div className="flex gap-2">
        <button onClick={save} disabled={saving || !form.description.trim()}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-lg disabled:opacity-50 font-medium">
          <Check size={13} /> {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onCancel} className="text-xs text-slate-400 hover:text-slate-300 px-3 py-2">Cancel</button>
      </div>
    </div>
  )
}

// ─── Punch item row ───────────────────────────────────────────────────────────

function PunchRow({ item, projectId, onUpdate, onDelete }: {
  item: PunchItem; projectId: string
  onUpdate: (id: string, data: Partial<PunchItem>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const cfg = STATUS_CONFIG[item.status]
  const prio = PRIORITY_CONFIG[item.priority]
  const isComplete = item.status === 'complete'

  const toggleComplete = async () => {
    const next: PunchStatus = isComplete ? 'open' : 'complete'
    await onUpdate(item.id, {
      status: next,
      completedDate: next === 'complete' ? new Date().toISOString().split('T')[0] : '',
    })
  }

  if (editing) {
    return (
      <PunchForm
        projectId={projectId}
        initial={{
          description: item.description, location: item.location, trade: item.trade,
          status: item.status, priority: item.priority, dueDate: item.dueDate,
          completedDate: item.completedDate, notes: item.notes,
        }}
        onSave={async data => { await onUpdate(item.id, data); setEditing(false) }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  return (
    <div className={clsx(
      'flex items-start gap-3 px-4 py-3 border-b border-slate-800/50 last:border-0 group transition-colors',
      isComplete ? 'opacity-60' : 'hover:bg-slate-700/20'
    )}>
      {/* Status dot — click to toggle complete */}
      <button onClick={toggleComplete} title="Toggle complete"
        className={clsx('mt-0.5 shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors', cfg.dot, 'border-transparent')}>
        {isComplete && <Check size={9} className="text-white" />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono text-slate-400">{item.number}</span>
          <p className={clsx('text-sm', isComplete ? 'line-through text-slate-400' : 'text-slate-100 font-medium')}>
            {item.description}
          </p>
          <span className={clsx('text-xs font-semibold', prio.color)}>{prio.label}</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-0.5">
          {item.location && <span className="text-xs text-slate-400">📍 {item.location}</span>}
          {item.trade && <span className="text-xs text-slate-400 bg-slate-700/60 px-1.5 py-0.5 rounded">{item.trade}</span>}
          {item.dueDate && !isComplete && (
            <span className={clsx('text-xs', new Date(item.dueDate) < new Date() ? 'text-red-400' : 'text-slate-400')}>
              Due {fmtDate(item.dueDate)}
            </span>
          )}
          {item.completedDate && isComplete && (
            <span className="text-xs text-emerald-400">Done {fmtDate(item.completedDate)}</span>
          )}
        </div>

        {item.notes && (
          <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-400 mt-1">
            {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            {expanded ? 'Hide note' : 'View note'}
          </button>
        )}
        {expanded && item.notes && (
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">{item.notes}</p>
        )}
      </div>

      {/* Status badge */}
      <span className={clsx('shrink-0 text-xs px-2 py-0.5 rounded-full font-medium hidden sm:inline-flex', cfg.color, cfg.bg)}>
        {cfg.label}
      </span>

      {/* Actions */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={() => setEditing(true)} className="p-1 text-slate-400 hover:text-blue-400">
          <Pencil size={13} />
        </button>
        <button onClick={() => { if (confirm('Delete this punch item?')) onDelete(item.id) }}
          className="p-1 text-slate-400 hover:text-red-400">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

// ─── Group by trade ───────────────────────────────────────────────────────────

function PunchGroup({ trade, items, projectId, onUpdate, onDelete }: {
  trade: string; items: PunchItem[]; projectId: string
  onUpdate: (id: string, data: Partial<PunchItem>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [collapsed, setCollapsed] = useState(false)
  const done = items.filter(i => i.status === 'complete').length

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mb-3">
      <button onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-700/30 transition-colors">
        <div className="flex items-center gap-2">
          {collapsed ? <ChevronRight size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
          <span className="text-sm font-medium text-slate-200">{trade}</span>
          <span className="text-xs text-slate-400">{done}/{items.length}</span>
        </div>
        <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${items.length > 0 ? Math.round((done / items.length) * 100) : 0}%` }} />
        </div>
      </button>
      {!collapsed && (
        <div className="border-t border-slate-800">
          {items.map(i => (
            <PunchRow key={i.id} item={i} projectId={projectId} onUpdate={onUpdate} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const FILTER_STATUSES: (PunchStatus | 'all')[] = ['all', 'open', 'in-progress', 'complete', 'disputed']

export function PunchListTab({ project }: { project: Project }) {
  const { items, loading, addItem, updateItem, deleteItem, openCount, completeCount, highPrioOpen } = usePunchList(project.id)
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState<PunchStatus | 'all'>('all')

  const filtered = filter === 'all' ? items : items.filter(i => i.status === filter)

  const grouped = filtered.reduce<Record<string, PunchItem[]>>((acc, i) => {
    const trade = i.trade || 'General'
    if (!acc[trade]) acc[trade] = []
    acc[trade].push(i)
    return acc
  }, {})

  const pct = items.length > 0 ? Math.round((completeCount / items.length) * 100) : 0

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Total Items" value={items.length} />
        <SummaryCard label="Open / In Progress" value={openCount} color={openCount > 0 ? 'amber' : 'default'} />
        <SummaryCard label="Complete" value={completeCount} color="emerald" />
        <SummaryCard label="High Priority Open" value={highPrioOpen} color={highPrioOpen > 0 ? 'red' : 'default'} />
      </div>

      {/* Progress bar */}
      {items.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-slate-400 shrink-0">{pct}% complete · {completeCount}/{items.length}</span>
          </div>
        </div>
      )}

      {/* Filters + Add */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 flex-wrap flex-1">
          {FILTER_STATUSES.map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                filter === s
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              )}>
              {s === 'all' ? 'All' : STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 border border-blue-800/50 hover:border-blue-700 px-3 py-1.5 rounded-lg transition-colors shrink-0">
          <Plus size={12} /> Add Item
        </button>
      </div>

      {showAdd && (
        <PunchForm projectId={project.id} onSave={addItem} onCancel={() => setShowAdd(false)} />
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <ClipboardList size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">{filter === 'all' ? 'No punch list items yet.' : `No ${STATUS_CONFIG[filter as PunchStatus]?.label} items.`}</p>
          {filter === 'all' && <p className="text-xs mt-1 text-slate-400">Track construction deficiencies and closeout items.</p>}
        </div>
      ) : (
        Object.entries(grouped).map(([trade, tradeItems]) => (
          <PunchGroup key={trade} trade={trade} items={tradeItems}
            projectId={project.id} onUpdate={updateItem} onDelete={deleteItem} />
        ))
      )}
    </div>
  )
}
