import { useState } from 'react'
import { clsx } from 'clsx'
import { Plus, Trash2, Check, TrendingUp, TrendingDown, Clock, Download, AlertTriangle } from 'lucide-react'
import { useChangeOrders } from '@/hooks/useChangeOrders'
import type { ChangeOrder, COStatus } from '@/hooks/useChangeOrders'
import type { Project } from '@/types'

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCOsCsv(cos: ChangeOrder[], projectName: string) {
  const headers = ['Number', 'Title', 'Category', 'Amount', 'Status', 'Requested By', 'Date', 'Approved Date', 'Description', 'Notes']
  const rows = cos.map(c => [
    `CO-${String(c.number).padStart(3, '0')}`,
    c.title,
    c.category,
    c.amount,
    c.status,
    c.requestedBy,
    c.date,
    c.approvedDate,
    (c.description || '').replace(/\n/g, ' '),
    (c.notes || '').replace(/\n/g, ' '),
  ])
  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${projectName.replace(/\s+/g, '_')}_Change_Orders.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<COStatus, { label: string; color: string }> = {
  pending:  { label: 'Pending',  color: 'bg-amber-900/60 text-amber-300' },
  approved: { label: 'Approved', color: 'bg-emerald-900/60 text-emerald-300' },
  rejected: { label: 'Rejected', color: 'bg-red-900/60 text-red-300' },
}

const CO_STATUSES: COStatus[] = ['pending', 'approved', 'rejected']

const BUDGET_CATEGORIES = ['Hard Cost', 'Soft Cost', 'FF&E', 'IT/AV', 'Contingency', "Owner's Reserve", 'Other']

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

// ─── Row ──────────────────────────────────────────────────────────────────────

function CORow({
  co,
  onUpdate,
  onDelete,
}: {
  co: ChangeOrder
  onUpdate: (id: string, data: Partial<ChangeOrder>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    title: co.title,
    description: co.description,
    amount: String(co.amount),
    status: co.status,
    requestedBy: co.requestedBy,
    category: co.category,
    notes: co.notes,
    date: co.date,
    approvedDate: co.approvedDate,
  })
  const [saving, setSaving] = useState(false)

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  const save = async () => {
    setSaving(true)
    await onUpdate(co.id, {
      ...form,
      amount: parseFloat(form.amount) || 0,
    })
    setSaving(false)
    setEditing(false)
  }

  const cancel = () => {
    setForm({
      title: co.title, description: co.description, amount: String(co.amount),
      status: co.status, requestedBy: co.requestedBy, category: co.category,
      notes: co.notes, date: co.date, approvedDate: co.approvedDate,
    })
    setEditing(false)
  }

  const isPositive = co.amount >= 0

  if (editing) {
    return (
      <div className="border border-blue-600/40 rounded-xl bg-slate-900/60 p-4 space-y-3">
        {/* Title + amount */}
        <div className="grid grid-cols-3 gap-2">
          <input value={form.title} onChange={f('title')} placeholder="Title *" autoFocus
            className="col-span-2 bg-slate-900 text-slate-100 text-sm rounded-lg px-3 py-2 border border-slate-800 focus:outline-none focus:border-blue-500 placeholder-slate-500" />
          <input value={form.amount} onChange={f('amount')} placeholder="Amount" type="number"
            className="bg-slate-900 text-slate-100 text-sm rounded-lg px-3 py-2 border border-slate-800 focus:outline-none focus:border-blue-500 placeholder-slate-500" />
        </div>

        {/* Description */}
        <textarea value={form.description} onChange={f('description')} placeholder="Description (optional)" rows={2}
          className="w-full bg-slate-900 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-800 focus:outline-none focus:border-blue-500 resize-none placeholder-slate-500" />

        {/* Meta row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <input value={form.requestedBy} onChange={f('requestedBy')} placeholder="Requested by"
            className="bg-slate-900 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-800 focus:outline-none focus:border-blue-500 placeholder-slate-500" />
          <select value={form.category} onChange={f('category')}
            className="bg-slate-900 border border-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500">
            <option value="">Category</option>
            {BUDGET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="date" value={form.date} onChange={f('date')} placeholder="Date submitted"
            className="bg-slate-900 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-800 focus:outline-none focus:border-blue-500" />
          <select value={form.status} onChange={f('status')}
            className="bg-slate-900 border border-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500">
            {CO_STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
          </select>
        </div>

        <input value={form.notes} onChange={f('notes')} placeholder="Notes (optional)"
          className="w-full bg-slate-900 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-800 focus:outline-none focus:border-blue-500 placeholder-slate-500" />

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
    <div className="flex items-center gap-3 px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-800 group transition-colors">
      {/* CO number */}
      <span className="text-xs font-mono text-slate-400 shrink-0 w-10">CO#{co.number}</span>

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-200 font-medium truncate">{co.title}</p>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400 flex-wrap">
          {co.requestedBy && <span>{co.requestedBy}</span>}
          {co.category && <span>· {co.category}</span>}
          {co.date && <span>· {new Date(co.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
        </div>
        {co.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{co.description}</p>}
      </div>

      {/* Amount */}
      <span className={clsx('text-sm font-semibold shrink-0', isPositive ? 'text-red-400' : 'text-emerald-400')}>
        {isPositive ? '+' : ''}{fmt(co.amount)}
      </span>

      {/* Status badge */}
      <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', STATUS_CONFIG[co.status].color)}>
        {STATUS_CONFIG[co.status].label}
      </span>

      {/* Actions (hover) */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={() => setEditing(true)} className="text-slate-400 hover:text-blue-400 text-xs px-1">Edit</button>
        <button onClick={() => { if (confirm(`Delete CO#${co.number}?`)) onDelete(co.id) }}
          className="p-1 text-slate-400 hover:text-red-400">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

// ─── Add form ─────────────────────────────────────────────────────────────────

function AddCOForm({
  projectId,
  nextNumber,
  onAdd,
  onCancel,
}: {
  projectId: string
  nextNumber: number
  onAdd: (data: Omit<ChangeOrder, 'id' | 'number' | 'createdAt' | 'updatedAt'>) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    title: '', description: '', amount: '', requestedBy: '',
    category: '', notes: '', date: new Date().toISOString().split('T')[0], approvedDate: '',
  })
  const [saving, setSaving] = useState(false)

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  const save = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    await onAdd({
      projectId, status: 'pending',
      title: form.title.trim(),
      description: form.description.trim(),
      amount: parseFloat(form.amount) || 0,
      requestedBy: form.requestedBy.trim(),
      category: form.category,
      notes: form.notes.trim(),
      date: form.date,
      approvedDate: '',
    })
    setSaving(false)
    onCancel()
  }

  return (
    <div className="bg-slate-900 border border-blue-600 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-100">New Change Order — CO#{nextNumber}</h3>

      <div className="grid grid-cols-3 gap-2">
        <input value={form.title} onChange={f('title')} placeholder="Title *" autoFocus
          onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
          className="col-span-2 bg-slate-700 text-slate-100 text-sm rounded-lg px-3 py-2 border border-slate-800 focus:outline-none focus:border-blue-500 placeholder-slate-500" />
        <input value={form.amount} onChange={f('amount')} placeholder="Amount ($)" type="number"
          className="bg-slate-700 text-slate-100 text-sm rounded-lg px-3 py-2 border border-slate-800 focus:outline-none focus:border-blue-500 placeholder-slate-500" />
      </div>

      <textarea value={form.description} onChange={f('description')} placeholder="Description (optional)" rows={2}
        className="w-full bg-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-800 focus:outline-none focus:border-blue-500 resize-none placeholder-slate-500" />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <input value={form.requestedBy} onChange={f('requestedBy')} placeholder="Requested by"
          className="bg-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-800 focus:outline-none focus:border-blue-500 placeholder-slate-500" />
        <select value={form.category} onChange={f('category')}
          className="bg-slate-700 border border-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500">
          <option value="">Budget Category</option>
          {BUDGET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="date" value={form.date} onChange={f('date')}
          className="bg-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-800 focus:outline-none focus:border-blue-500" />
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={save} disabled={saving || !form.title.trim()}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-40">
          <Plus size={14} /> {saving ? 'Adding...' : 'Add Change Order'}
        </button>
        <button onClick={onCancel} className="text-sm text-slate-400 hover:text-slate-300 px-3 py-2">Cancel</button>
      </div>
    </div>
  )
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export function ChangeOrdersTab({ project }: { project: Project }) {
  const { changeOrders, loading, addChangeOrder, updateChangeOrder, deleteChangeOrder, approvedTotal, pendingTotal, nextNumber } =
    useChangeOrders(project.id)
  const [statusFilter, setStatusFilter] = useState<COStatus | 'all'>('all')
  const [showAdd, setShowAdd] = useState(false)

  const filtered = statusFilter === 'all' ? changeOrders : changeOrders.filter(c => c.status === statusFilter)

  const rejectedTotal = changeOrders.filter(c => c.status === 'rejected').reduce((s, c) => s + c.amount, 0)

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Check size={14} className="text-emerald-400" />
            <span className="text-xs text-slate-400 uppercase tracking-wide">Approved</span>
          </div>
          <p className={clsx('text-xl font-bold', approvedTotal >= 0 ? 'text-red-400' : 'text-emerald-400')}>
            {approvedTotal >= 0 ? '+' : ''}{fmt(approvedTotal)}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {changeOrders.filter(c => c.status === 'approved').length} CO{changeOrders.filter(c => c.status === 'approved').length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={14} className="text-amber-400" />
            <span className="text-xs text-slate-400 uppercase tracking-wide">Pending</span>
          </div>
          <p className="text-xl font-bold text-amber-400">
            {pendingTotal >= 0 ? '+' : ''}{fmt(pendingTotal)}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {changeOrders.filter(c => c.status === 'pending').length} awaiting approval
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            {approvedTotal > 0 ? <TrendingUp size={14} className="text-red-400" /> : <TrendingDown size={14} className="text-emerald-400" />}
            <span className="text-xs text-slate-400 uppercase tracking-wide">Budget Impact</span>
          </div>
          <p className={clsx('text-xl font-bold', approvedTotal > 0 ? 'text-red-400' : 'text-emerald-400')}>
            {approvedTotal >= 0 ? '+' : ''}{fmt(approvedTotal)}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {rejectedTotal !== 0 && `${fmt(Math.abs(rejectedTotal))} rejected`}
            {rejectedTotal === 0 && 'from approved COs'}
          </p>
        </div>
      </div>

      {/* Pending exposure banner */}
      {pendingTotal > 0 && (
        <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg border bg-amber-900/20 border-amber-700/40 text-amber-300">
          <AlertTriangle size={13} className="shrink-0" />
          <span>
            <strong>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(pendingTotal)}</strong> pending CO exposure —{' '}
            {changeOrders.filter(c => c.status === 'pending').length} change order{changeOrders.filter(c => c.status === 'pending').length !== 1 ? 's' : ''} awaiting approval
          </span>
        </div>
      )}

      {/* Approved CO banner */}
      {approvedTotal > 0 && (
        <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg border bg-emerald-900/20 border-emerald-700/40 text-emerald-300">
          <Check size={13} className="shrink-0" />
          <span>
            Approved COs added{' '}
            <strong>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(approvedTotal)}</strong>{' '}
            to project budget
          </span>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
          {(['all', ...CO_STATUSES] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={clsx(
                'px-3 py-1 rounded text-xs font-medium transition-colors',
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

        {changeOrders.length > 0 && (
          <button
            onClick={() => exportCOsCsv(changeOrders, project.projectName || 'Project')}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-800 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Download size={12} /> Export CSV
          </button>
        )}

        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={14} /> New CO
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <AddCOForm
          projectId={project.id}
          nextNumber={nextNumber}
          onAdd={addChangeOrder}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p>{changeOrders.length === 0 ? 'No change orders yet.' : 'No change orders match the current filter.'}</p>
          {changeOrders.length === 0 && (
            <p className="text-xs text-slate-400 mt-1">Track scope changes and their budget impact.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(co => (
            <CORow key={co.id} co={co} onUpdate={updateChangeOrder} onDelete={deleteChangeOrder} />
          ))}
        </div>
      )}

      {/* Budget base note */}
      {changeOrders.length > 0 && project.totalBudget > 0 && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs text-slate-400">
          <span>Original Budget: <span className="text-slate-300 font-medium">{fmt(project.totalBudget)}</span></span>
          <span>After Approved COs: <span className={clsx('font-medium', approvedTotal > 0 ? 'text-red-400' : 'text-emerald-400')}>
            {fmt(project.totalBudget + approvedTotal)}
          </span></span>
        </div>
      )}
    </div>
  )
}
