import { useState } from 'react'
import { clsx } from 'clsx'
import { Plus, Trash2, Check, ChevronDown, ChevronRight, AlertCircle, Clock } from 'lucide-react'
import { useSubmittals } from '@/hooks/useSubmittals'
import type { Submittal, SubmittalStatus, SubmittalStatusEvent } from '@/hooks/useSubmittals'
import type { Project } from '@/types'

// ─── Status Timeline ──────────────────────────────────────────────────────────

function StatusTimeline({ events }: { events: SubmittalStatusEvent[] }) {
  if (!events || events.length === 0) return null
  return (
    <div className="space-y-2">
      {events.map((ev, idx) => {
        const isLast = idx === events.length - 1
        const cfg = STATUS_CONFIG[ev.status] ?? { label: ev.status, color: 'bg-slate-700 text-slate-400' }
        return (
          <div key={idx} className="flex items-start gap-3">
            <div className="flex flex-col items-center shrink-0">
              <div className={clsx('w-2.5 h-2.5 rounded-full mt-0.5', isLast ? 'bg-blue-500' : 'bg-slate-600')} />
              {!isLast && <div className="w-px flex-1 bg-slate-700 mt-1 h-4" />}
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', cfg.color)}>
                  {cfg.label}
                </span>
                <span className="text-xs text-slate-400">
                  {new Date(ev.changedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              {ev.note && <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{ev.note}</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<SubmittalStatus, { label: string; color: string }> = {
  'pending':                { label: 'Pending',              color: 'bg-slate-700 text-slate-400' },
  'submitted':              { label: 'Submitted',            color: 'bg-amber-900/60 text-amber-300' },
  'in-review':              { label: 'In Review',            color: 'bg-blue-900/60 text-blue-300' },
  'approved':               { label: 'Approved',             color: 'bg-emerald-900/60 text-emerald-300' },
  'approved-with-comments': { label: 'Approved w/ Comments', color: 'bg-cyan-900/60 text-cyan-300' },
  'revise-resubmit':        { label: 'Revise & Resubmit',   color: 'bg-orange-900/60 text-orange-300' },
  'rejected':               { label: 'Rejected',             color: 'bg-red-900/60 text-red-300' },
}

const SUBMITTAL_STATUSES: SubmittalStatus[] = [
  'pending', 'submitted', 'in-review', 'approved', 'approved-with-comments', 'revise-resubmit', 'rejected',
]

// ─── Row ──────────────────────────────────────────────────────────────────────

function SubmittalRow({
  submittal,
  onUpdate,
  onDelete,
}: {
  submittal: Submittal
  onUpdate: (id: string, data: Partial<Submittal>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    title: submittal.title,
    specSection: submittal.specSection,
    submittedBy: submittal.submittedBy,
    reviewer: submittal.reviewer,
    status: submittal.status,
    submittedDate: submittal.submittedDate,
    dueDate: submittal.dueDate,
    reviewedDate: submittal.reviewedDate,
    notes: submittal.notes,
  })
  const [saving, setSaving] = useState(false)

  const f = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }))

  const save = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    await onUpdate(submittal.id, form)
    setSaving(false)
    setEditing(false)
  }

  const cancel = () => {
    setForm({
      title: submittal.title, specSection: submittal.specSection, submittedBy: submittal.submittedBy,
      reviewer: submittal.reviewer, status: submittal.status, submittedDate: submittal.submittedDate,
      dueDate: submittal.dueDate, reviewedDate: submittal.reviewedDate, notes: submittal.notes,
    })
    setEditing(false)
  }

  const isOpen = submittal.status === 'pending' || submittal.status === 'submitted' || submittal.status === 'in-review'
  const isOverdue = isOpen && submittal.dueDate && new Date(submittal.dueDate) < new Date()

  if (editing) {
    return (
      <div className="border border-blue-600/40 rounded-xl bg-slate-900/60 p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <input value={form.title} onChange={f('title')} placeholder="Title *" autoFocus
            className="bg-slate-900 text-slate-100 text-sm rounded-lg px-3 py-2 border border-slate-800 focus:outline-none focus:border-blue-500 placeholder-slate-500" />
          <input value={form.specSection} onChange={f('specSection')} placeholder="Spec Section"
            className="bg-slate-900 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-800 focus:outline-none focus:border-blue-500 placeholder-slate-500" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <input value={form.submittedBy} onChange={f('submittedBy')} placeholder="Submitted by"
            className="bg-slate-900 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-800 focus:outline-none focus:border-blue-500 placeholder-slate-500" />
          <input value={form.reviewer} onChange={f('reviewer')} placeholder="Reviewer"
            className="bg-slate-900 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-800 focus:outline-none focus:border-blue-500 placeholder-slate-500" />
          <input type="date" value={form.submittedDate} onChange={f('submittedDate')} title="Date Submitted"
            className="bg-slate-900 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-800 focus:outline-none focus:border-blue-500" />
          <input type="date" value={form.dueDate} onChange={f('dueDate')} title="Review Due Date"
            className="bg-slate-900 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-800 focus:outline-none focus:border-blue-500" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <select value={form.status} onChange={f('status')}
            className="bg-slate-900 border border-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500">
            {SUBMITTAL_STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
          </select>
          <input type="date" value={form.reviewedDate} onChange={f('reviewedDate')} title="Date Reviewed"
            className="bg-slate-900 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-800 focus:outline-none focus:border-blue-500" />
        </div>

        <textarea value={form.notes} onChange={f('notes')} placeholder="Notes / comments" rows={2}
          className="w-full bg-slate-900 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-800 focus:outline-none focus:border-blue-500 resize-none placeholder-slate-500" />

        <div className="flex gap-2">
          <button onClick={save} disabled={saving || !form.title.trim()}
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
      'border rounded-xl overflow-hidden transition-colors',
      isOverdue ? 'border-red-800/50 bg-red-950/10' : 'border-slate-800 bg-slate-900'
    )}>
      <div className="flex items-center gap-3 px-4 py-3 group">
        {/* Number */}
        <span className="text-xs font-mono text-slate-400 shrink-0 w-18">{submittal.number}</span>

        {/* Title + meta */}
        <button className="flex-1 min-w-0 text-left" onClick={() => setExpanded(!expanded)}>
          <p className="text-sm font-medium text-slate-100 truncate">{submittal.title}</p>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400 flex-wrap">
            {submittal.specSection && <span>{submittal.specSection}</span>}
            {submittal.submittedBy && <span>· {submittal.submittedBy}</span>}
            {submittal.reviewer && <span>→ {submittal.reviewer}</span>}
            {submittal.dueDate && (
              <span className={clsx('flex items-center gap-0.5', isOverdue ? 'text-red-400' : 'text-slate-400')}>
                {isOverdue ? <AlertCircle size={10} /> : <Clock size={10} />}
                Due {new Date(submittal.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        </button>

        {/* Status */}
        <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', STATUS_CONFIG[submittal.status].color)}>
          {STATUS_CONFIG[submittal.status].label}
        </span>

        <button onClick={() => setExpanded(!expanded)} className="text-slate-400 shrink-0">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={() => setEditing(true)} className="text-xs text-slate-400 hover:text-blue-400 px-1">Edit</button>
          <button onClick={() => { if (confirm(`Delete ${submittal.number}?`)) onDelete(submittal.id) }}
            className="p-1 text-slate-400 hover:text-red-400">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-800/50 pt-3 space-y-3">
          {submittal.notes && (
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Review Notes</p>
              <p className="text-sm text-slate-400 leading-relaxed">{submittal.notes}</p>
            </div>
          )}
          {submittal.statusHistory && submittal.statusHistory.length > 0 && (
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-2">Status History</p>
              <StatusTimeline events={submittal.statusHistory} />
            </div>
          )}
          {(!submittal.notes && (!submittal.statusHistory || submittal.statusHistory.length === 0)) && (
            <p className="text-xs text-slate-400 italic">No notes or status history yet.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Add form ─────────────────────────────────────────────────────────────────

function AddSubmittalForm({
  projectId,
  nextNumber,
  onAdd,
  onCancel,
}: {
  projectId: string
  nextNumber: string
  onAdd: (data: Omit<Submittal, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    title: '', specSection: '', submittedBy: '', reviewer: '',
    dueDate: '', submittedDate: '', reviewedDate: '', notes: '',
  })
  const [saving, setSaving] = useState(false)

  const f = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }))

  const save = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    await onAdd({ projectId, number: nextNumber, status: 'pending', ...form })
    setSaving(false)
    onCancel()
  }

  return (
    <div className="bg-slate-900 border border-blue-600 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-100">New Submittal — {nextNumber}</h3>

      <div className="grid grid-cols-2 gap-2">
        <input value={form.title} onChange={f('title')} placeholder="Title *" autoFocus
          onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
          className="bg-slate-700 text-slate-100 text-sm rounded-lg px-3 py-2 border border-slate-800 focus:outline-none focus:border-blue-500 placeholder-slate-500" />
        <input value={form.specSection} onChange={f('specSection')} placeholder="Spec Section (optional)"
          className="bg-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-800 focus:outline-none focus:border-blue-500 placeholder-slate-500" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <input value={form.submittedBy} onChange={f('submittedBy')} placeholder="Submitted by (contractor)"
          className="bg-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-800 focus:outline-none focus:border-blue-500 placeholder-slate-500" />
        <input value={form.reviewer} onChange={f('reviewer')} placeholder="Reviewer (architect/engineer)"
          className="bg-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-800 focus:outline-none focus:border-blue-500 placeholder-slate-500" />
        <input type="date" value={form.dueDate} onChange={f('dueDate')} title="Review due date"
          className="bg-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-800 focus:outline-none focus:border-blue-500" />
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={save} disabled={saving || !form.title.trim()}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-40">
          <Plus size={14} /> {saving ? 'Adding...' : 'Add Submittal'}
        </button>
        <button onClick={onCancel} className="text-sm text-slate-400 hover:text-slate-300 px-3 py-2">Cancel</button>
      </div>
    </div>
  )
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export function SubmittalsTab({ project }: { project: Project }) {
  const { submittals, loading, addSubmittal, updateSubmittal, deleteSubmittal, nextNumber, pendingReview, overdueCount } =
    useSubmittals(project.id)
  const [statusFilter, setStatusFilter] = useState<SubmittalStatus | 'all'>('all')
  const [showAdd, setShowAdd] = useState(false)

  const filtered = statusFilter === 'all' ? submittals : submittals.filter(s => s.status === statusFilter)

  const approved = submittals.filter(s => s.status === 'approved' || s.status === 'approved-with-comments').length

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total', value: submittals.length, color: 'text-slate-100' },
          { label: 'Pending Review', value: pendingReview, color: pendingReview > 0 ? 'text-amber-400' : 'text-slate-100' },
          { label: 'Overdue', value: overdueCount, color: overdueCount > 0 ? 'text-red-400' : 'text-slate-100' },
          { label: 'Approved', value: approved, color: approved > 0 ? 'text-emerald-400' : 'text-slate-100' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
            <p className={clsx('text-xl font-bold', s.color)}>{s.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1 flex-wrap">
          {(['all', ...SUBMITTAL_STATUSES] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={clsx(
                'px-2.5 py-1 rounded text-xs font-medium transition-colors',
                statusFilter === s
                  ? s === 'all' ? 'bg-blue-600 text-white' : STATUS_CONFIG[s].color
                  : 'text-slate-400 hover:text-slate-300'
              )}
            >
              {s === 'all' ? 'All' : STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          <Plus size={14} /> New Submittal
        </button>
      </div>

      {showAdd && (
        <AddSubmittalForm projectId={project.id} nextNumber={nextNumber} onAdd={addSubmittal} onCancel={() => setShowAdd(false)} />
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p>{submittals.length === 0 ? 'No submittals yet.' : 'No submittals match the current filter.'}</p>
          {submittals.length === 0 && <p className="text-xs text-slate-400 mt-1">Track shop drawings, product data, and samples for review.</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => (
            <SubmittalRow key={s.id} submittal={s} onUpdate={updateSubmittal} onDelete={deleteSubmittal} />
          ))}
        </div>
      )}
    </div>
  )
}
