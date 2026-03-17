import { useState } from 'react'
import { clsx } from 'clsx'
import { Plus, Check, Trash2, Pencil, Award, Clock } from 'lucide-react'
import { useBidLog } from '@/hooks/useBidLog'
import type { BidItem, BidStatus } from '@/hooks/useBidLog'
import type { Project } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<BidStatus, { label: string; color: string; bg: string }> = {
  'invited':      { label: 'Invited',      color: 'text-slate-300',  bg: 'bg-slate-700' },
  'bid-received': { label: 'Bid Received', color: 'text-blue-300',   bg: 'bg-blue-900/50' },
  'awarded':      { label: 'Awarded',      color: 'text-emerald-300',bg: 'bg-emerald-900/50' },
  'rejected':     { label: 'Rejected',     color: 'text-red-300',    bg: 'bg-red-900/50' },
  'no-bid':       { label: 'No Bid',       color: 'text-slate-500',  bg: 'bg-slate-800' },
}

const TRADES = [
  'General Contractor', 'Electrical', 'Plumbing', 'HVAC / Mechanical',
  'Fire Protection', 'Structural', 'Architectural Millwork', 'Flooring',
  'Ceiling / Drywall', 'Painting', 'FF&E / Furniture', 'IT / AV / Security',
  'Signage', 'Moving / Relocation', 'Low Voltage', 'Other',
]

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, color = 'default' }: {
  label: string; value: string | number; sub?: string; color?: 'emerald' | 'blue' | 'amber' | 'default'
}) {
  const accent = color === 'emerald' ? 'border-emerald-700/50 bg-emerald-900/20'
    : color === 'blue' ? 'border-blue-700/50 bg-blue-900/20'
    : color === 'amber' ? 'border-amber-700/50 bg-amber-900/20'
    : 'border-slate-700 bg-slate-800'
  const txt = color === 'emerald' ? 'text-emerald-300'
    : color === 'blue' ? 'text-blue-300'
    : color === 'amber' ? 'text-amber-300'
    : 'text-slate-100'
  return (
    <div className={clsx('rounded-xl p-3 border', accent)}>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={clsx('text-lg font-bold', txt)}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Bid form ─────────────────────────────────────────────────────────────────

type BidFormData = {
  vendor: string; trade: string; bidAmount: string; status: BidStatus
  contact: string; notes: string; bidDueDate: string; submittedDate: string
}

const EMPTY: BidFormData = {
  vendor: '', trade: '', bidAmount: '', status: 'invited',
  contact: '', notes: '', bidDueDate: '', submittedDate: '',
}

function BidForm({
  projectId, initial, onSave, onCancel,
}: {
  projectId: string
  initial?: BidFormData & { id?: string }
  onSave: (data: Omit<BidItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState<BidFormData>(initial ?? EMPTY)
  const [saving, setSaving] = useState(false)
  const f = (k: keyof BidFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }))

  const save = async () => {
    if (!form.vendor.trim()) return
    setSaving(true)
    await onSave({
      projectId,
      vendor: form.vendor.trim(),
      trade: form.trade,
      bidAmount: parseFloat(form.bidAmount) || 0,
      status: form.status,
      contact: form.contact.trim(),
      notes: form.notes.trim(),
      bidDueDate: form.bidDueDate,
      submittedDate: form.submittedDate,
    })
    setSaving(false)
    onCancel()
  }

  return (
    <div className="bg-slate-800 border border-blue-600/50 rounded-xl p-4 space-y-3 mb-3">
      <div className="grid grid-cols-2 gap-2">
        <input value={form.vendor} onChange={f('vendor')} placeholder="Vendor / Company *" autoFocus
          className="col-span-2 bg-slate-700 text-slate-100 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500 placeholder-slate-500" />

        <div>
          <label className="text-xs text-slate-500 mb-1 block">Trade / Scope</label>
          <select value={form.trade} onChange={f('trade')}
            className="w-full bg-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500">
            <option value="">Select trade…</option>
            {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs text-slate-500 mb-1 block">Bid Amount ($)</label>
          <input type="number" value={form.bidAmount} onChange={f('bidAmount')} placeholder="0"
            className="w-full bg-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500" />
        </div>

        <div>
          <label className="text-xs text-slate-500 mb-1 block">Bid Due Date</label>
          <input type="date" value={form.bidDueDate} onChange={f('bidDueDate')}
            className="w-full bg-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500" />
        </div>

        <div>
          <label className="text-xs text-slate-500 mb-1 block">Submitted Date</label>
          <input type="date" value={form.submittedDate} onChange={f('submittedDate')}
            className="w-full bg-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500" />
        </div>

        <input value={form.contact} onChange={f('contact')} placeholder="Contact name"
          className="bg-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500 placeholder-slate-500" />

        <div>
          <label className="text-xs text-slate-500 mb-1 block">Status</label>
          <select value={form.status} onChange={f('status')}
            className="w-full bg-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500">
            {(Object.keys(STATUS_CONFIG) as BidStatus[]).map(s => (
              <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
            ))}
          </select>
        </div>
      </div>

      <textarea value={form.notes} onChange={f('notes')} placeholder="Notes (optional)" rows={2}
        className="w-full bg-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500 resize-none placeholder-slate-500" />

      <div className="flex gap-2">
        <button onClick={save} disabled={saving || !form.vendor.trim()}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-lg disabled:opacity-50 font-medium">
          <Check size={13} /> {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onCancel} className="text-xs text-slate-500 hover:text-slate-300 px-3 py-2">Cancel</button>
      </div>
    </div>
  )
}

// ─── Bid row ─────────────────────────────────────────────────────────────────

function BidRow({ bid, projectId, onUpdate, onDelete }: {
  bid: BidItem; projectId: string
  onUpdate: (id: string, data: Partial<BidItem>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const cfg = STATUS_CONFIG[bid.status]

  if (editing) {
    return (
      <BidForm
        projectId={projectId}
        initial={{
          vendor: bid.vendor, trade: bid.trade,
          bidAmount: bid.bidAmount ? String(bid.bidAmount) : '',
          status: bid.status, contact: bid.contact,
          notes: bid.notes, bidDueDate: bid.bidDueDate,
          submittedDate: bid.submittedDate,
        }}
        onSave={async data => { await onUpdate(bid.id, data); setEditing(false) }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-slate-700/50 last:border-0 group hover:bg-slate-700/20 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-100">{bid.vendor}</span>
          {bid.trade && (
            <span className="text-xs text-slate-500 bg-slate-700/60 px-2 py-0.5 rounded">{bid.trade}</span>
          )}
          <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', cfg.color, cfg.bg)}>
            {cfg.label}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-1">
          {bid.bidAmount > 0 && (
            <span className={clsx('text-sm font-semibold', bid.status === 'awarded' ? 'text-emerald-400' : 'text-slate-300')}>
              {fmt(bid.bidAmount)}
            </span>
          )}
          {bid.contact && <span className="text-xs text-slate-500">{bid.contact}</span>}
          {bid.bidDueDate && (
            <span className="flex items-center gap-0.5 text-xs text-slate-500">
              <Clock size={10} /> Due {new Date(bid.bidDueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
        {bid.notes && <p className="text-xs text-slate-500 mt-1 italic">{bid.notes}</p>}
      </div>

      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={() => setEditing(true)} className="p-1 text-slate-500 hover:text-blue-400">
          <Pencil size={13} />
        </button>
        <button onClick={() => { if (confirm('Delete this bid?')) onDelete(bid.id) }}
          className="p-1 text-slate-600 hover:text-red-400">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const ALL_STATUSES: (BidStatus | 'all')[] = ['all', 'invited', 'bid-received', 'awarded', 'rejected', 'no-bid']

export function BidLogTab({ project }: { project: Project }) {
  const { bids, loading, addBid, updateBid, deleteBid, awardedTotal, receivedCount } = useBidLog(project.id)
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState<BidStatus | 'all'>('all')

  const filtered = filter === 'all' ? bids : bids.filter(b => b.status === filter)

  // Group by trade for display
  const grouped = filtered.reduce<Record<string, BidItem[]>>((acc, b) => {
    const trade = b.trade || 'Other'
    if (!acc[trade]) acc[trade] = []
    acc[trade].push(b)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Total Bids" value={bids.length} />
        <SummaryCard label="Bid Received" value={receivedCount} color="blue" />
        <SummaryCard label="Awarded" value={bids.filter(b => b.status === 'awarded').length} color="emerald" />
        <SummaryCard label="Awarded Total" value={awardedTotal > 0 ? fmt(awardedTotal) : '—'} color="emerald"
          sub="sum of awarded contracts" />
      </div>

      {/* Filter + Add */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 flex-wrap flex-1">
          {ALL_STATUSES.map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                filter === s
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              )}>
              {s === 'all' ? 'All' : STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 border border-blue-800/50 hover:border-blue-700 px-3 py-1.5 rounded-lg transition-colors shrink-0">
          <Plus size={12} /> Add Bid
        </button>
      </div>

      {showAdd && (
        <BidForm projectId={project.id} onSave={addBid} onCancel={() => setShowAdd(false)} />
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Award size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">{filter === 'all' ? 'No bids logged yet.' : `No ${STATUS_CONFIG[filter as BidStatus]?.label} bids.`}</p>
          {filter === 'all' && <p className="text-xs mt-1 text-slate-600">Click "Add Bid" to invite vendors and track their responses.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([trade, tradeBids]) => (
            <div key={trade} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="px-4 py-2 border-b border-slate-700 bg-slate-800/80 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-300 uppercase tracking-wide">{trade}</span>
                <span className="text-xs text-slate-500">{tradeBids.length} bid{tradeBids.length !== 1 ? 's' : ''}</span>
              </div>
              {tradeBids.map(b => (
                <BidRow key={b.id} bid={b} projectId={project.id} onUpdate={updateBid} onDelete={deleteBid} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Footer — awarded total bar */}
      {bids.length > 0 && project.totalBudget > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="flex justify-between text-xs text-slate-400 mb-2">
            <span>Awarded vs. Budget</span>
            <span>{fmt(awardedTotal)} / {fmt(project.totalBudget)}</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={clsx('h-full rounded-full transition-all',
                awardedTotal / project.totalBudget > 1 ? 'bg-red-500'
                : awardedTotal / project.totalBudget > 0.85 ? 'bg-amber-500'
                : 'bg-emerald-500'
              )}
              style={{ width: `${Math.min(100, (awardedTotal / project.totalBudget) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {Math.round((awardedTotal / project.totalBudget) * 100)}% of total budget awarded
          </p>
        </div>
      )}
    </div>
  )
}
