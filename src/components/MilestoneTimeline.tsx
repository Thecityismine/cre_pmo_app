import { useState } from 'react'
import { clsx } from 'clsx'
import { Plus, Check, Clock, AlertTriangle, Trash2, ChevronDown, ChevronRight, Wand2 } from 'lucide-react'
import { useMilestones } from '@/hooks/useMilestones'
import type { Milestone, MilestoneStatus } from '@/hooks/useMilestones'
import type { Project } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<MilestoneStatus, { label: string; dot: string; text: string; Icon: React.ElementType }> = {
  pending:  { label: 'Pending',  dot: 'bg-slate-600 border-slate-500',             text: 'text-slate-400', Icon: Clock },
  complete: { label: 'Complete', dot: 'bg-emerald-500 border-emerald-400',          text: 'text-emerald-400', Icon: Check },
  delayed:  { label: 'Delayed',  dot: 'bg-red-500 border-red-400',                 text: 'text-red-400', Icon: AlertTriangle },
}

const fmtDate = (d: string) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

const isOverdue = (m: Milestone) =>
  m.status === 'pending' && m.targetDate && new Date(m.targetDate) < new Date()

// ─── Inline milestone row ─────────────────────────────────────────────────────

function MilestoneRow({
  milestone,
  onUpdate,
  onDelete,
}: {
  milestone: Milestone
  onUpdate: (id: string, data: Partial<Milestone>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: milestone.name,
    targetDate: milestone.targetDate,
    actualDate: milestone.actualDate,
    status: milestone.status,
    notes: milestone.notes,
  })
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const f = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }))

  const save = async () => {
    setSaving(true)
    await onUpdate(milestone.id, form)
    setSaving(false)
    setEditing(false)
  }

  const cancel = () => {
    setForm({
      name: milestone.name, targetDate: milestone.targetDate,
      actualDate: milestone.actualDate, status: milestone.status, notes: milestone.notes,
    })
    setEditing(false)
  }

  const toggleComplete = async () => {
    const next: MilestoneStatus = milestone.status === 'complete' ? 'pending' : 'complete'
    await onUpdate(milestone.id, {
      status: next,
      actualDate: next === 'complete' ? new Date().toISOString().split('T')[0] : '',
    })
  }

  const overdue = isOverdue(milestone)
  const cfg = STATUS_CONFIG[milestone.status]

  if (editing) {
    return (
      <div className="border border-blue-600/40 rounded-xl bg-slate-900/60 p-4 space-y-3 mb-2">
        <div className="grid grid-cols-2 gap-2">
          <input value={form.name} onChange={f('name')} placeholder="Milestone name *" autoFocus
            className="col-span-2 bg-slate-800 text-slate-100 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500 placeholder-slate-500" />
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Target Date</label>
            <input type="date" value={form.targetDate} onChange={f('targetDate')}
              className="w-full bg-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Actual Date</label>
            <input type="date" value={form.actualDate} onChange={f('actualDate')}
              className="w-full bg-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500" />
          </div>
        </div>

        <div className="flex gap-2">
          {(['pending', 'complete', 'delayed'] as MilestoneStatus[]).map(s => (
            <button key={s} onClick={() => setForm(p => ({ ...p, status: s }))}
              className={clsx(
                'flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                form.status === s
                  ? s === 'complete' ? 'bg-emerald-900/60 text-emerald-300 border-emerald-700'
                    : s === 'delayed' ? 'bg-red-900/60 text-red-300 border-red-700'
                    : 'bg-slate-700 text-slate-300 border-slate-500'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              )}>
              {STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>

        <textarea value={form.notes} onChange={f('notes')} placeholder="Notes (optional)" rows={2}
          className="w-full bg-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500 resize-none placeholder-slate-500" />

        <div className="flex gap-2">
          <button onClick={save} disabled={saving || !form.name.trim()}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-50">
            <Check size={12} /> {saving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={cancel} className="text-xs text-slate-400 hover:text-slate-300 px-2">Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className={clsx(
      'flex items-start gap-3 px-4 py-3 rounded-xl border mb-2 group transition-colors',
      overdue ? 'bg-red-950/10 border-red-800/30' : 'bg-slate-800 border-slate-700 hover:border-slate-600'
    )}>
      {/* Status toggle button */}
      <button
        onClick={toggleComplete}
        title="Click to toggle complete"
        className={clsx(
          'mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
          cfg.dot
        )}
      >
        {milestone.status === 'complete' && <Check size={10} className="text-white" />}
        {milestone.status === 'delayed' && <AlertTriangle size={9} className="text-white" />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={clsx('text-sm font-medium', milestone.status === 'complete' ? 'line-through text-slate-400' : 'text-slate-100')}>
            {milestone.name}
          </p>
          {overdue && <span className="text-xs text-red-400 font-medium">OVERDUE</span>}
        </div>

        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {milestone.targetDate && (
            <span className={clsx('text-xs', overdue ? 'text-red-400' : 'text-slate-400')}>
              Target: {fmtDate(milestone.targetDate)}
            </span>
          )}
          {milestone.actualDate && (
            <span className="text-xs text-emerald-400">
              Actual: {fmtDate(milestone.actualDate)}
            </span>
          )}
          {!milestone.targetDate && !milestone.actualDate && (
            <span className="text-xs text-slate-400 italic">No date set</span>
          )}
        </div>

        {/* Notes (expandable) */}
        {milestone.notes && (
          <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-400 mt-1">
            {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            {expanded ? 'Hide note' : 'View note'}
          </button>
        )}
        {expanded && milestone.notes && (
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">{milestone.notes}</p>
        )}
      </div>

      {/* Status badge */}
      <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium shrink-0 hidden sm:inline-flex', cfg.text,
        milestone.status === 'complete' ? 'bg-emerald-900/40' : milestone.status === 'delayed' ? 'bg-red-900/40' : 'bg-slate-700')}>
        {cfg.label}
      </span>

      {/* Actions */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={() => setEditing(true)} className="text-xs text-slate-400 hover:text-blue-400 px-1">Edit</button>
        <button onClick={() => { if (confirm('Delete this milestone?')) onDelete(milestone.id) }}
          className="p-1 text-slate-400 hover:text-red-400">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

// ─── Add form ─────────────────────────────────────────────────────────────────

function AddMilestoneForm({
  projectId,
  nextOrder,
  onAdd,
  onCancel,
}: {
  projectId: string
  nextOrder: number
  onAdd: (data: Omit<Milestone, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState({ name: '', targetDate: '', actualDate: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const f = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }))

  const save = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    await onAdd({ projectId, status: 'pending', order: nextOrder, ...form })
    setSaving(false)
    onCancel()
  }

  return (
    <div className="bg-slate-800 border border-blue-600 rounded-xl p-4 space-y-3 mb-2">
      <h3 className="text-sm font-semibold text-slate-100">Add Milestone</h3>
      <input value={form.name} onChange={f('name')} placeholder="Milestone name *" autoFocus
        onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
        className="w-full bg-slate-700 text-slate-100 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500 placeholder-slate-500" />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Target Date</label>
          <input type="date" value={form.targetDate} onChange={f('targetDate')}
            className="w-full bg-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Actual Date (if done)</label>
          <input type="date" value={form.actualDate} onChange={f('actualDate')}
            className="w-full bg-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500" />
        </div>
      </div>
      <input value={form.notes} onChange={f('notes') as React.ChangeEventHandler<HTMLInputElement>}
        placeholder="Notes (optional)"
        className="w-full bg-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500 placeholder-slate-500" />
      <div className="flex gap-2">
        <button onClick={save} disabled={saving || !form.name.trim()}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-40">
          <Plus size={14} /> {saving ? 'Adding...' : 'Add'}
        </button>
        <button onClick={onCancel} className="text-sm text-slate-400 hover:text-slate-300 px-3 py-2">Cancel</button>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MilestoneTimeline({ project }: { project: Project }) {
  const { milestones, loading, seedDefaults, addMilestone, updateMilestone, deleteMilestone, completedCount, delayedCount } =
    useMilestones(project.id)
  const [showAdd, setShowAdd] = useState(false)
  const [seeding, setSeeding] = useState(false)

  const handleSeed = async () => {
    setSeeding(true)
    await seedDefaults()
    setSeeding(false)
  }

  const nextOrder = milestones.length > 0 ? Math.max(...milestones.map(m => m.order)) + 1 : 1

  // Progress bar: completed / total
  const pct = milestones.length > 0 ? Math.round((completedCount / milestones.length) * 100) : 0

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <p className="text-slate-100 font-semibold text-sm">Milestones</p>
          {milestones.length > 0 && (
            <>
              <span className="text-xs text-slate-400">{completedCount}/{milestones.length}</span>
              {delayedCount > 0 && (
                <span className="text-xs text-red-400 flex items-center gap-0.5">
                  <AlertTriangle size={10} /> {delayedCount} delayed
                </span>
              )}
            </>
          )}
        </div>
        <div className="flex gap-2">
          {milestones.length === 0 && !loading && (
            <button onClick={handleSeed} disabled={seeding}
              className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 border border-purple-800/50 hover:border-purple-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
              <Wand2 size={12} /> {seeding ? 'Seeding...' : 'Seed defaults'}
            </button>
          )}
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 border border-blue-800/50 hover:border-blue-700 px-3 py-1.5 rounded-lg transition-colors">
            <Plus size={12} /> Add
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {milestones.length > 0 && (
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
        ) : milestones.length === 0 && !showAdd ? (
          <div className="text-center py-6 text-slate-400">
            <p className="text-sm">No milestones yet.</p>
            <p className="text-xs mt-1 text-slate-400">Click "Seed defaults" to add standard CRE milestones, or add your own.</p>
          </div>
        ) : (
          <>
            {showAdd && (
              <AddMilestoneForm
                projectId={project.id}
                nextOrder={nextOrder}
                onAdd={addMilestone}
                onCancel={() => setShowAdd(false)}
              />
            )}
            {milestones.map(m => (
              <MilestoneRow key={m.id} milestone={m} onUpdate={updateMilestone} onDelete={deleteMilestone} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
