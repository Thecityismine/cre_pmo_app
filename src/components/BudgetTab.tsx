import { useState } from 'react'
import { collection, addDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useBudgetItems } from '@/hooks/useBudgetItems'
import { useChangeOrders } from '@/hooks/useChangeOrders'
import { Plus, Trash2, Check, X, TrendingUp, TrendingDown, ChevronDown, ChevronRight, BarChart2 } from 'lucide-react'
import { clsx } from 'clsx'
import type { Project } from '@/types'
import type { BudgetItem } from '@/hooks/useBudgetItems'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = ['Hard Cost', 'Soft Cost', 'FF&E', 'IT/AV', 'Contingency', "Owner's Reserve"]

const CATEGORY_COLORS: Record<string, { pill: string; bar: string }> = {
  'Hard Cost':       { pill: 'bg-amber-900 text-amber-300',   bar: 'bg-amber-500' },
  'Soft Cost':       { pill: 'bg-blue-900 text-blue-300',     bar: 'bg-blue-500' },
  'FF&E':            { pill: 'bg-purple-900 text-purple-300', bar: 'bg-purple-500' },
  'IT/AV':           { pill: 'bg-cyan-900 text-cyan-300',     bar: 'bg-cyan-500' },
  'Contingency':     { pill: 'bg-slate-700 text-slate-300',   bar: 'bg-slate-500' },
  "Owner's Reserve": { pill: 'bg-emerald-900 text-emerald-300', bar: 'bg-emerald-500' },
}

const PAYMENT_STATUS = ['Pending', 'Under Contract', 'Invoiced', 'Paid']
const PAYMENT_STATUS_COLORS: Record<string, string> = {
  'Pending':        'bg-slate-700 text-slate-400',
  'Under Contract': 'bg-blue-900 text-blue-300',
  'Invoiced':       'bg-amber-900 text-amber-300',
  'Paid':           'bg-emerald-900 text-emerald-300',
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const inp = 'w-full bg-slate-900 text-slate-100 text-xs rounded px-2 py-1.5 border border-slate-700 focus:outline-none focus:border-blue-500 placeholder-slate-600'

// ─── Editable row ─────────────────────────────────────────────────────────────

function EditableRow({ item, onDelete }: { item: BudgetItem; onDelete: (id: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    description:    item.description,
    vendorName:     (item as BudgetItem & { vendorName?: string }).vendorName ?? '',
    category:       item.category,
    budgetAmount:   String(item.budgetAmount),
    contractAmount: String((item as BudgetItem & { contractAmount?: number }).contractAmount ?? item.committedAmount),
    invoicedAmount: String((item as BudgetItem & { invoicedAmount?: number }).invoicedAmount ?? 0),
    paidAmount:     String((item as BudgetItem & { paidAmount?: number }).paidAmount ?? 0),
    forecastAmount: String(item.forecastAmount),
    actualAmount:   String(item.actualAmount),
    paymentStatus:  (item as BudgetItem & { paymentStatus?: string }).paymentStatus ?? 'Pending',
    notes:          item.notes,
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    setSaving(true)
    const budget   = Number(form.budgetAmount) || 0
    const forecast = Number(form.forecastAmount) || 0
    await updateDoc(doc(db, 'budgetItems', item.id), {
      description:     form.description,
      vendorName:      form.vendorName,
      category:        form.category,
      budgetAmount:    budget,
      committedAmount: Number(form.contractAmount) || 0,
      contractAmount:  Number(form.contractAmount) || 0,
      invoicedAmount:  Number(form.invoicedAmount) || 0,
      paidAmount:      Number(form.paidAmount) || 0,
      forecastAmount:  forecast,
      actualAmount:    Number(form.actualAmount) || 0,
      paymentStatus:   form.paymentStatus,
      variance:        budget - forecast,
      notes:           form.notes,
      updatedAt:       new Date().toISOString(),
    })
    setSaving(false)
    setEditing(false)
  }

  const ext = item as BudgetItem & { vendorName?: string; contractAmount?: number; invoicedAmount?: number; paidAmount?: number; paymentStatus?: string }
  const vendorName     = ext.vendorName ?? ''
  const contractAmt    = ext.contractAmount ?? item.committedAmount
  const invoicedAmt    = ext.invoicedAmount ?? 0
  const paidAmt        = ext.paidAmount ?? 0
  const paymentStatus  = ext.paymentStatus ?? 'Pending'
  const variance       = item.budgetAmount - item.forecastAmount

  if (editing) {
    return (
      <tr className="bg-slate-900/80 border-t border-slate-700">
        <td className="px-3 py-2" colSpan={8}>
          <div className="space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Description *" className={inp} />
              <input value={form.vendorName}  onChange={e => set('vendorName', e.target.value)}  placeholder="Vendor / Contractor" className={inp} />
              <select value={form.category}   onChange={e => set('category', e.target.value)}    className={inp}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <select value={form.paymentStatus} onChange={e => set('paymentStatus', e.target.value)} className={inp}>
                {PAYMENT_STATUS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              <input type="number" value={form.budgetAmount}   onChange={e => set('budgetAmount', e.target.value)}   placeholder="Budget $"    className={inp} />
              <input type="number" value={form.contractAmount} onChange={e => set('contractAmount', e.target.value)} placeholder="Contract $"  className={inp} />
              <input type="number" value={form.invoicedAmount} onChange={e => set('invoicedAmount', e.target.value)} placeholder="Invoiced $"  className={inp} />
              <input type="number" value={form.paidAmount}     onChange={e => set('paidAmount', e.target.value)}     placeholder="Paid $"      className={inp} />
              <input type="number" value={form.forecastAmount} onChange={e => set('forecastAmount', e.target.value)} placeholder="Forecast $"  className={inp} />
              <input type="number" value={form.actualAmount}   onChange={e => set('actualAmount', e.target.value)}   placeholder="Actual $"    className={inp} />
            </div>
            <div className="flex gap-2">
              <input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Notes" className={`${inp} flex-1`} />
              <button onClick={save} disabled={saving}
                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-lg">
                <Check size={12} />{saving ? '...' : 'Save'}
              </button>
              <button onClick={() => setEditing(false)}
                className="flex items-center gap-1 border border-slate-600 text-slate-400 text-xs px-3 py-1.5 rounded-lg hover:bg-slate-800">
                <X size={12} />Cancel
              </button>
            </div>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-t border-slate-700/50 hover:bg-slate-800/40 group cursor-pointer" onClick={() => setEditing(true)}>
      <td className="px-4 py-2.5">
        <span className={clsx('text-xs px-2 py-0.5 rounded font-medium', CATEGORY_COLORS[item.category]?.pill ?? 'bg-slate-700 text-slate-300')}>
          {item.category}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <p className="text-slate-200 text-sm">{item.description || '—'}</p>
        {vendorName && <p className="text-xs text-slate-500 mt-0.5">{vendorName}</p>}
      </td>
      <td className="px-4 py-2.5 text-right text-slate-300 text-sm">{fmt(item.budgetAmount)}</td>
      <td className="px-4 py-2.5 text-right text-slate-400 text-sm">{contractAmt > 0 ? fmt(contractAmt) : '—'}</td>
      <td className="px-4 py-2.5 text-right text-slate-400 text-sm">{invoicedAmt > 0 ? fmt(invoicedAmt) : '—'}</td>
      <td className="px-4 py-2.5 text-right text-slate-400 text-sm">{paidAmt > 0 ? fmt(paidAmt) : '—'}</td>
      <td className="px-4 py-2.5">
        <span className={clsx('text-xs px-2 py-0.5 rounded font-medium', PAYMENT_STATUS_COLORS[paymentStatus] ?? 'bg-slate-700 text-slate-400')}>
          {paymentStatus}
        </span>
      </td>
      <td className="px-4 py-2.5 text-right">
        <div className="flex items-center justify-end gap-1">
          {variance >= 0
            ? <TrendingDown size={13} className="text-emerald-400" />
            : <TrendingUp size={13} className="text-red-400" />}
          <span className={clsx('text-sm font-medium', variance >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {fmt(Math.abs(variance))}
          </span>
          <button
            onClick={e => { e.stopPropagation(); onDelete(item.id) }}
            className="ml-2 p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── Category chart bar ───────────────────────────────────────────────────────

function CategoryBar({ category, budget, forecast, actual, maxVal }: {
  category: string; budget: number; forecast: number; actual: number; maxVal: number
}) {
  const cfg = CATEGORY_COLORS[category] ?? { pill: 'bg-slate-700 text-slate-300', bar: 'bg-slate-500' }
  const budgetPct   = maxVal > 0 ? (budget / maxVal) * 100 : 0
  const forecastPct = maxVal > 0 ? (forecast / maxVal) * 100 : 0
  const actualPct   = maxVal > 0 ? (actual / maxVal) * 100 : 0
  const over        = forecast > budget

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className={clsx('px-2 py-0.5 rounded font-medium', cfg.pill)}>{category}</span>
        <span className={clsx('font-medium', over ? 'text-red-400' : 'text-slate-300')}>{fmt(forecast)}</span>
      </div>
      {/* Budget bar (ghost) */}
      <div className="relative h-3 bg-slate-700/50 rounded-full overflow-hidden">
        <div className="absolute inset-y-0 left-0 h-full bg-slate-600/50 rounded-full" style={{ width: `${budgetPct}%` }} />
        <div className={clsx('absolute inset-y-0 left-0 h-full rounded-full opacity-80', cfg.bar)} style={{ width: `${forecastPct}%` }} />
        {actual > 0 && (
          <div className="absolute inset-y-0 left-0 h-full rounded-full bg-white/20" style={{ width: `${actualPct}%` }} />
        )}
      </div>
      <div className="flex justify-between text-[10px] text-slate-600">
        <span>Budget: {fmt(budget)}</span>
        {actual > 0 && <span className="text-slate-500">Actual: {fmt(actual)}</span>}
      </div>
    </div>
  )
}

// ─── Main BudgetTab ───────────────────────────────────────────────────────────

export function BudgetTab({ project }: { project: Project }) {
  const { items, loading } = useBudgetItems(project.id)
  const { approvedTotal: coApproved, pendingTotal: coPending } = useChangeOrders(project.id)
  const [adding, setAdding] = useState(false)
  const [showChart, setShowChart] = useState(false)
  const [newForm, setNewForm] = useState({
    description: '', vendorName: '', category: 'Hard Cost',
    budgetAmount: '', contractAmount: '', invoicedAmount: '', paidAmount: '',
    forecastAmount: '', actualAmount: '', paymentStatus: 'Pending', notes: '',
  })
  const [saving, setSaving] = useState(false)

  // ── Totals ──────────────────────────────────────────────────────────────────
  const totalBudget   = items.reduce((s, i) => s + i.budgetAmount, 0)
  const totalForecast = items.reduce((s, i) => s + i.forecastAmount, 0)
  const totalActual   = items.reduce((s, i) => s + i.actualAmount, 0)
  const totalContract = items.reduce((s, i) => s + ((i as BudgetItem & { contractAmount?: number }).contractAmount ?? i.committedAmount), 0)
  const totalInvoiced = items.reduce((s, i) => s + ((i as BudgetItem & { invoicedAmount?: number }).invoicedAmount ?? 0), 0)
  const totalPaid     = items.reduce((s, i) => s + ((i as BudgetItem & { paidAmount?: number }).paidAmount ?? 0), 0)
  const baseBudget    = project.totalBudget || totalBudget
  const netBudget     = baseBudget + coApproved
  const totalVariance = netBudget - totalForecast

  // ── Group by category ───────────────────────────────────────────────────────
  const byCategory = items.reduce<Record<string, { budget: number; forecast: number; actual: number }>>((acc, i) => {
    if (!acc[i.category]) acc[i.category] = { budget: 0, forecast: 0, actual: 0 }
    acc[i.category].budget   += i.budgetAmount
    acc[i.category].forecast += i.forecastAmount
    acc[i.category].actual   += i.actualAmount
    return acc
  }, {})
  const maxCatVal = Math.max(...Object.values(byCategory).map(v => v.budget), 1)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const budget   = Number(newForm.budgetAmount) || 0
    const forecast = Number(newForm.forecastAmount) || budget
    const now = new Date().toISOString()
    await addDoc(collection(db, 'budgetItems'), {
      projectId:       project.id,
      category:        newForm.category,
      description:     newForm.description,
      vendorName:      newForm.vendorName,
      budgetAmount:    budget,
      committedAmount: Number(newForm.contractAmount) || 0,
      contractAmount:  Number(newForm.contractAmount) || 0,
      invoicedAmount:  Number(newForm.invoicedAmount) || 0,
      paidAmount:      Number(newForm.paidAmount) || 0,
      forecastAmount:  forecast,
      actualAmount:    Number(newForm.actualAmount) || 0,
      paymentStatus:   newForm.paymentStatus,
      variance:        budget - forecast,
      notes:           newForm.notes,
      createdAt: now, updatedAt: now,
    })
    setNewForm({
      description: '', vendorName: '', category: 'Hard Cost',
      budgetAmount: '', contractAmount: '', invoicedAmount: '', paidAmount: '',
      forecastAmount: '', actualAmount: '', paymentStatus: 'Pending', notes: '',
    })
    setSaving(false)
    setAdding(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this budget line item?')) return
    await deleteDoc(doc(db, 'budgetItems', id))
  }

  return (
    <div className="space-y-4">

      {/* ── Summary cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Approved Budget',  value: fmt(baseBudget),    color: 'text-slate-100' },
          { label: 'Net w/ COs',       value: fmt(netBudget),     color: coApproved > 0 ? 'text-amber-300' : 'text-slate-100' },
          { label: 'Total Forecast',   value: fmt(totalForecast), color: totalForecast > netBudget ? 'text-red-400' : 'text-blue-300' },
          { label: 'Actual Spent',     value: fmt(totalActual),   color: 'text-slate-200' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800 border border-slate-700 rounded-xl p-3">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={clsx('text-lg font-bold', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── CO Rollup banner ───────────────────────────────────────────────── */}
      {(coApproved !== 0 || coPending !== 0) && (
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 flex flex-wrap gap-4 text-xs">
          <div>
            <span className="text-slate-500">Approved COs: </span>
            <span className={clsx('font-semibold', coApproved > 0 ? 'text-red-400' : 'text-emerald-400')}>
              {coApproved >= 0 ? '+' : ''}{fmt(coApproved)}
            </span>
          </div>
          {coPending !== 0 && (
            <div>
              <span className="text-slate-500">Pending Exposure: </span>
              <span className="text-amber-400 font-semibold">{fmt(coPending)}</span>
            </div>
          )}
          <div>
            <span className="text-slate-500">Net Budget: </span>
            <span className="text-slate-200 font-semibold">{fmt(netBudget)}</span>
          </div>
          <div>
            <span className="text-slate-500">Remaining: </span>
            <span className={clsx('font-semibold', totalVariance >= 0 ? 'text-emerald-400' : 'text-red-400')}>
              {totalVariance >= 0 ? fmt(totalVariance) : `(${fmt(Math.abs(totalVariance))})`}
            </span>
          </div>
        </div>
      )}

      {/* ── Utilization bar ────────────────────────────────────────────────── */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <div className="flex justify-between text-xs text-slate-400 mb-2">
          <span>Budget Utilization</span>
          <span className={totalVariance < 0 ? 'text-red-400' : 'text-emerald-400'}>
            {totalVariance >= 0 ? `${fmt(totalVariance)} remaining` : `${fmt(Math.abs(totalVariance))} over budget`}
          </span>
        </div>
        <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden flex">
          <div className="h-full bg-emerald-500 rounded-l-full transition-all"
            style={{ width: `${Math.min(100, totalPaid / (netBudget || 1) * 100)}%` }} />
          <div className="h-full bg-blue-500/60 transition-all"
            style={{ width: `${Math.min(100, Math.max(0, (totalInvoiced - totalPaid) / (netBudget || 1) * 100))}%` }} />
          <div className="h-full bg-amber-500/60 transition-all"
            style={{ width: `${Math.min(100, Math.max(0, (totalForecast - totalInvoiced) / (netBudget || 1) * 100))}%` }} />
        </div>
        <div className="flex flex-wrap gap-4 mt-2">
          <span className="text-xs text-emerald-400 flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" />Paid {fmt(totalPaid)}</span>
          <span className="text-xs text-blue-400 flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500/60 inline-block" />Invoiced {fmt(totalInvoiced)}</span>
          <span className="text-xs text-amber-400 flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500/60 inline-block" />Contracted {fmt(totalContract)}</span>
        </div>
      </div>

      {/* ── Category charts toggle ─────────────────────────────────────────── */}
      {Object.keys(byCategory).length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowChart(!showChart)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <BarChart2 size={14} className="text-slate-400" />
              <span className="text-sm font-semibold text-slate-200">Budget by Category</span>
            </div>
            {showChart ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
          </button>
          {showChart && (
            <div className="px-4 pb-4 space-y-3 border-t border-slate-700">
              <div className="flex items-center gap-4 text-[10px] text-slate-600 pt-3">
                <span className="flex items-center gap-1"><span className="w-8 h-2.5 rounded-full bg-slate-600/50 inline-block" /> Budget</span>
                <span className="flex items-center gap-1"><span className="w-8 h-2.5 rounded-full bg-blue-500 inline-block opacity-80" /> Forecast</span>
                <span className="flex items-center gap-1"><span className="w-8 h-2.5 rounded-full bg-white/20 inline-block" /> Actual</span>
              </div>
              {Object.entries(byCategory).map(([cat, vals]) => (
                <CategoryBar key={cat} category={cat} maxVal={maxCatVal} {...vals} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Line items table ───────────────────────────────────────────────── */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <p className="text-slate-100 font-semibold text-sm">Line Items</p>
          <button
            onClick={() => setAdding(!adding)}
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={13} /> Add Line Item
          </button>
        </div>

        {/* Add form */}
        {adding && (
          <form onSubmit={handleAdd} className="p-4 border-b border-slate-700 bg-slate-900/50 space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <input value={newForm.description} onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Description *" className={inp} />
              <input value={newForm.vendorName} onChange={e => setNewForm(f => ({ ...f, vendorName: e.target.value }))}
                placeholder="Vendor / Contractor" className={inp} />
              <select value={newForm.category} onChange={e => setNewForm(f => ({ ...f, category: e.target.value }))} className={inp}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <select value={newForm.paymentStatus} onChange={e => setNewForm(f => ({ ...f, paymentStatus: e.target.value }))} className={inp}>
                {PAYMENT_STATUS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              <input type="number" value={newForm.budgetAmount}   onChange={e => setNewForm(f => ({ ...f, budgetAmount: e.target.value }))}   placeholder="Budget $"   className={inp} />
              <input type="number" value={newForm.contractAmount} onChange={e => setNewForm(f => ({ ...f, contractAmount: e.target.value }))} placeholder="Contract $" className={inp} />
              <input type="number" value={newForm.invoicedAmount} onChange={e => setNewForm(f => ({ ...f, invoicedAmount: e.target.value }))} placeholder="Invoiced $" className={inp} />
              <input type="number" value={newForm.paidAmount}     onChange={e => setNewForm(f => ({ ...f, paidAmount: e.target.value }))}     placeholder="Paid $"     className={inp} />
              <input type="number" value={newForm.forecastAmount} onChange={e => setNewForm(f => ({ ...f, forecastAmount: e.target.value }))} placeholder="Forecast $" className={inp} />
              <input type="number" value={newForm.actualAmount}   onChange={e => setNewForm(f => ({ ...f, actualAmount: e.target.value }))}   placeholder="Actual $"   className={inp} />
            </div>
            <div className="flex gap-2">
              <input value={newForm.notes} onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Notes (optional)" className={`${inp} flex-1`} />
              <button type="submit" disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-1.5 rounded-lg disabled:opacity-50">
                {saving ? '...' : 'Add'}
              </button>
              <button type="button" onClick={() => setAdding(false)}
                className="border border-slate-600 text-slate-400 text-xs px-3 py-1.5 rounded-lg hover:bg-slate-800">
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-10 text-slate-500">
            <p className="text-sm">No line items yet.</p>
            <p className="text-xs mt-1">Click "Add Line Item" to start tracking costs.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs uppercase tracking-wide border-b border-slate-700">
                  <th className="text-left px-4 py-2">Category</th>
                  <th className="text-left px-4 py-2">Description / Vendor</th>
                  <th className="text-right px-4 py-2">Budget</th>
                  <th className="text-right px-4 py-2">Contract</th>
                  <th className="text-right px-4 py-2">Invoiced</th>
                  <th className="text-right px-4 py-2">Paid</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-right px-4 py-2">Variance</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => <EditableRow key={item.id} item={item} onDelete={handleDelete} />)}
                {/* Totals row */}
                <tr className="border-t-2 border-slate-600 bg-slate-900/50 font-semibold">
                  <td className="px-4 py-2.5 text-slate-300 text-xs" colSpan={2}>TOTAL</td>
                  <td className="px-4 py-2.5 text-right text-slate-200 text-sm">{fmt(totalBudget)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-400 text-sm">{fmt(totalContract)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-400 text-sm">{fmt(totalInvoiced)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-400 text-sm">{fmt(totalPaid)}</td>
                  <td className="px-4 py-2.5" />
                  <td className="px-4 py-2.5 text-right">
                    <span className={clsx('text-sm font-semibold', totalVariance >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {totalVariance >= 0 ? fmt(totalVariance) : `(${fmt(Math.abs(totalVariance))})`}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Financial summary footer bar ──────────────────────────────────────── */}
      <div className="bg-slate-900/70 border border-slate-700 rounded-xl px-4 py-3 flex flex-wrap gap-4 text-xs">
        <div><span className="text-slate-500">Baseline: </span><span className="text-slate-200 font-medium">{fmt(baseBudget)}</span></div>
        <div><span className="text-slate-500">+ Approved COs: </span><span className={clsx('font-medium', coApproved > 0 ? 'text-red-400' : coApproved < 0 ? 'text-emerald-400' : 'text-slate-400')}>{coApproved !== 0 ? `${coApproved > 0 ? '+' : ''}${fmt(coApproved)}` : '—'}</span></div>
        <div><span className="text-slate-500">= Net Budget: </span><span className="text-blue-300 font-medium">{fmt(netBudget)}</span></div>
        <div className="ml-auto"><span className="text-slate-500">Forecast Variance: </span><span className={clsx('font-semibold', totalVariance >= 0 ? 'text-emerald-400' : 'text-red-400')}>{totalVariance >= 0 ? fmt(totalVariance) : `(${fmt(Math.abs(totalVariance))})`}</span></div>
      </div>
    </div>
  )
}
