import { useState } from 'react'
import { clsx } from 'clsx'
import { Plus, Trash2, Check, ChevronDown, ChevronRight, AlertCircle, Clock, MessageSquare } from 'lucide-react'
import { useRfis } from '@/hooks/useRfis'
import type { Rfi, RfiStatus } from '@/hooks/useRfis'
import type { Project } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<RfiStatus, { label: string; color: string }> = {
  draft:    { label: 'Draft',    color: 'bg-slate-700 text-slate-400' },
  open:     { label: 'Open',     color: 'bg-amber-900/60 text-amber-300' },
  answered: { label: 'Answered', color: 'bg-blue-900/60 text-blue-300' },
  closed:   { label: 'Closed',   color: 'bg-emerald-900/60 text-emerald-300' },
}

const RFI_STATUSES: RfiStatus[] = ['draft', 'open', 'answered', 'closed']

// ─── RFI Row ──────────────────────────────────────────────────────────────────

function RfiRow({
  rfi,
  onUpdate,
  onDelete,
}: {
  rfi: Rfi
  onUpdate: (id: string, data: Partial<Rfi>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    subject: rfi.subject,
    question: rfi.question,
    submittedBy: rfi.submittedBy,
    assignedTo: rfi.assignedTo,
    status: rfi.status,
    dueDate: rfi.dueDate,
    answeredDate: rfi.answeredDate,
    response: rfi.response,
    specSection: rfi.specSection,
  })
  const [saving, setSaving] = useState(false)

  const f = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }))

  const save = async () => {
    if (!form.subject.trim()) return
    setSaving(true)
    await onUpdate(rfi.id, form)
    setSaving(false)
    setEditing(false)
  }

  const cancel = () => {
    setForm({
      subject: rfi.subject, question: rfi.question, submittedBy: rfi.submittedBy,
      assignedTo: rfi.assignedTo, status: rfi.status, dueDate: rfi.dueDate,
      answeredDate: rfi.answeredDate, response: rfi.response, specSection: rfi.specSection,
    })
    setEditing(false)
  }

  const isOverdue = rfi.dueDate && (rfi.status === 'open' || rfi.status === 'draft') &&
    new Date(rfi.dueDate) < new Date()

  if (editing) {
    return (
      <div className="border border-blue-600/40 rounded-xl bg-slate-900/60 p-4 space-y-3">
        {/* Subject */}
        <input value={form.subject} onChange={f('subject')} placeholder="Subject *" autoFocus
          className="w-full bg-slate-800 text-slate-100 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500 placeholder-slate-500" />

        {/* Spec section */}
        <input value={form.specSection} onChange={f('specSection')} placeholder="Spec Section (e.g., 03 00 00 - Concrete)"
          className="w-full bg-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500 placeholder-slate-500" />

        {/* Question */}
        <textarea value={form.question} onChange={f('question')} placeholder="Question / Request" rows={3}
          className="w-full bg-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500 resize-none placeholder-slate-500" />

        {/* Meta */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <input value={form.submittedBy} onChange={f('submittedBy')} placeholder="Submitted by"
            className="bg-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500 placeholder-slate-500" />
          <input value={form.assignedTo} onChange={f('assignedTo')} placeholder="Assigned to (reviewer)"
            className="bg-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500 placeholder-slate-500" />
          <input type="date" value={form.dueDate} onChange={f('dueDate')}
            className="bg-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500" />
          <select value={form.status} onChange={f('status')}
            className="bg-slate-800 border border-slate-600 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500">
            {RFI_STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
          </select>
        </div>

        {/* Response */}
        <textarea value={form.response} onChange={f('response')} placeholder="Response / Answer (fill in when answered)" rows={2}
          className="w-full bg-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500 resize-none placeholder-slate-500" />

        <div className="flex gap-2">
          <button onClick={save} disabled={saving || !form.subject.trim()}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-50">
            <Check size={12} /> {saving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={cancel} className="text-xs text-slate-500 hover:text-slate-300 px-2">Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className={clsx(
      'border rounded-xl overflow-hidden transition-colors',
      isOverdue ? 'border-red-800/50 bg-red-950/10' : 'border-slate-700 bg-slate-800'
    )}>
      <div className="flex items-center gap-3 px-4 py-3 group">
        {/* Number */}
        <span className="text-xs font-mono text-slate-500 shrink-0 w-14">RFI-{String(rfi.number).padStart(3, '0')}</span>

        {/* Subject + meta */}
        <button className="flex-1 min-w-0 text-left" onClick={() => setExpanded(!expanded)}>
          <p className="text-sm font-medium text-slate-100 truncate">{rfi.subject}</p>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 flex-wrap">
            {rfi.submittedBy && <span>{rfi.submittedBy}</span>}
            {rfi.assignedTo && <span>→ {rfi.assignedTo}</span>}
            {rfi.specSection && <span className="text-slate-600">· {rfi.specSection}</span>}
            {rfi.dueDate && (
              <span className={clsx('flex items-center gap-0.5', isOverdue ? 'text-red-400' : 'text-slate-500')}>
                {isOverdue ? <AlertCircle size={10} /> : <Clock size={10} />}
                Due {new Date(rfi.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {isOverdue && ' — OVERDUE'}
              </span>
            )}
          </div>
        </button>

        {/* Response indicator */}
        {rfi.response && (
          <MessageSquare size={13} className="text-blue-400 shrink-0" aria-label="Has response" />
        )}

        {/* Status */}
        <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', STATUS_CONFIG[rfi.status].color)}>
          {STATUS_CONFIG[rfi.status].label}
        </span>

        {/* Expand */}
        <button onClick={() => setExpanded(!expanded)} className="text-slate-600 shrink-0">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        {/* Actions */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={() => setEditing(true)} className="text-xs text-slate-500 hover:text-blue-400 px-1">Edit</button>
          <button onClick={() => { if (confirm(`Delete RFI-${String(rfi.number).padStart(3, '0')}?`)) onDelete(rfi.id) }}
            className="p-1 text-slate-600 hover:text-red-400">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-700/50 pt-3 space-y-2">
          {rfi.question && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Question</p>
              <p className="text-sm text-slate-300 leading-relaxed">{rfi.question}</p>
            </div>
          )}
          {rfi.response && (
            <div className="bg-blue-950/30 border border-blue-800/30 rounded-lg p-3">
              <p className="text-xs text-blue-400 uppercase tracking-wide mb-1">Response</p>
              <p className="text-sm text-slate-300 leading-relaxed">{rfi.response}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Add form ─────────────────────────────────────────────────────────────────

function AddRfiForm({
  projectId,
  nextNumber,
  onAdd,
  onCancel,
}: {
  projectId: string
  nextNumber: number
  onAdd: (data: Omit<Rfi, 'id' | 'number' | 'createdAt' | 'updatedAt'>) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    subject: '', question: '', submittedBy: '', assignedTo: '',
    specSection: '', dueDate: '', answeredDate: '', response: '',
  })
  const [saving, setSaving] = useState(false)

  const f = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }))

  const save = async () => {
    if (!form.subject.trim()) return
    setSaving(true)
    await onAdd({ projectId, status: 'open', ...form })
    setSaving(false)
    onCancel()
  }

  return (
    <div className="bg-slate-800 border border-blue-600 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-100">
        New RFI — RFI-{String(nextNumber).padStart(3, '0')}
      </h3>

      <input value={form.subject} onChange={f('subject')} placeholder="Subject *" autoFocus
        onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
        className="w-full bg-slate-700 text-slate-100 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500 placeholder-slate-500" />

      <input value={form.specSection} onChange={f('specSection')} placeholder="Spec Section (optional)"
        className="w-full bg-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500 placeholder-slate-500" />

      <textarea value={form.question} onChange={f('question')} placeholder="Question / request details" rows={3}
        className="w-full bg-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500 resize-none placeholder-slate-500" />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <input value={form.submittedBy} onChange={f('submittedBy')} placeholder="Submitted by"
          className="bg-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500 placeholder-slate-500" />
        <input value={form.assignedTo} onChange={f('assignedTo')} placeholder="Assigned to (reviewer)"
          className="bg-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500 placeholder-slate-500" />
        <input type="date" value={form.dueDate} onChange={f('dueDate')}
          className="bg-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500" />
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={save} disabled={saving || !form.subject.trim()}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-40">
          <Plus size={14} /> {saving ? 'Adding...' : 'Add RFI'}
        </button>
        <button onClick={onCancel} className="text-sm text-slate-500 hover:text-slate-300 px-3 py-2">Cancel</button>
      </div>
    </div>
  )
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export function RfiTab({ project }: { project: Project }) {
  const { rfis, loading, addRfi, updateRfi, deleteRfi, nextNumber, openCount, overdueCount } = useRfis(project.id)
  const [statusFilter, setStatusFilter] = useState<RfiStatus | 'all'>('all')
  const [showAdd, setShowAdd] = useState(false)

  const filtered = statusFilter === 'all' ? rfis : rfis.filter(r => r.status === statusFilter)

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total RFIs', value: rfis.length, color: 'text-slate-100' },
          { label: 'Open', value: openCount, color: openCount > 0 ? 'text-amber-400' : 'text-slate-100' },
          { label: 'Overdue', value: overdueCount, color: overdueCount > 0 ? 'text-red-400' : 'text-slate-100' },
          { label: 'Closed', value: rfis.filter(r => r.status === 'closed').length, color: 'text-emerald-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800 border border-slate-700 rounded-xl p-3 text-center">
            <p className={clsx('text-xl font-bold', s.color)}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-lg p-1">
          {(['all', ...RFI_STATUSES] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={clsx(
                'px-3 py-1 rounded text-xs font-medium transition-colors',
                statusFilter === s
                  ? s === 'all' ? 'bg-blue-600 text-white' : STATUS_CONFIG[s].color
                  : 'text-slate-500 hover:text-slate-300'
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
          <Plus size={14} /> New RFI
        </button>
      </div>

      {showAdd && (
        <AddRfiForm projectId={project.id} nextNumber={nextNumber} onAdd={addRfi} onCancel={() => setShowAdd(false)} />
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <p>{rfis.length === 0 ? 'No RFIs yet.' : 'No RFIs match the current filter.'}</p>
          {rfis.length === 0 && <p className="text-xs text-slate-600 mt-1">Track requests for information from the design team.</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(rfi => (
            <RfiRow key={rfi.id} rfi={rfi} onUpdate={updateRfi} onDelete={deleteRfi} />
          ))}
        </div>
      )}
    </div>
  )
}
