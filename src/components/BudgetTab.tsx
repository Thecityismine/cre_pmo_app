import { useState, useEffect, useRef } from 'react'
import { collection, addDoc, doc, deleteDoc, updateDoc, increment } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useBudgetItems } from '@/hooks/useBudgetItems'
import { useChangeOrders } from '@/hooks/useChangeOrders'
import {
  Plus, Trash2, Check, X, TrendingUp, TrendingDown,
  ChevronDown, ChevronRight, BookOpen, AlertTriangle, Receipt,
} from 'lucide-react'
import { clsx } from 'clsx'
import type { Project } from '@/types'
import type { BudgetItem } from '@/hooks/useBudgetItems'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = ['Hard Cost', 'Soft Cost', 'FF&E', 'Expenses', 'Contingency', 'Tax']

const CATEGORY_COLORS: Record<string, { pill: string; bar: string; border: string }> = {
  'Hard Cost':   { pill: 'bg-amber-900 text-amber-300',    bar: 'bg-amber-500',   border: 'border-amber-800/40' },
  'Soft Cost':   { pill: 'bg-blue-900 text-blue-300',      bar: 'bg-blue-500',    border: 'border-blue-800/40' },
  'FF&E':        { pill: 'bg-purple-900 text-purple-300',  bar: 'bg-purple-500',  border: 'border-purple-800/40' },
  'Expenses':    { pill: 'bg-cyan-900 text-cyan-300',      bar: 'bg-cyan-500',    border: 'border-cyan-800/40' },
  'Contingency': { pill: 'bg-slate-700 text-slate-300',    bar: 'bg-slate-500',   border: 'border-slate-800/40' },
  'Tax':         { pill: 'bg-emerald-900 text-emerald-300', bar: 'bg-emerald-500', border: 'border-emerald-800/40' },
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const inp = 'w-full bg-slate-900 text-slate-100 text-xs rounded px-2 py-1.5 border border-slate-800 focus:outline-none focus:border-blue-500 placeholder-slate-600'

// Extended BudgetItem type with optional extra fields stored in Firestore
type ExtBudgetItem = BudgetItem & {
  vendorName?: string
  contractNumber?: string
  contactEmail?: string
  contractAmount?: number
  invoicedAmount?: number
  paidAmount?: number
  paymentStatus?: string
  costToComplete?: number
  // Variance trend tracking
  forecastTrend?: 'up' | 'down' | 'flat'
  forecastPrev?: number
}

// ─── Health helpers ────────────────────────────────────────────────────────────

function lineHealth(forecast: number, budget: number): 'green' | 'amber' | 'red' {
  if (budget <= 0) return 'green'
  const ratio = forecast / budget
  if (ratio <= 1.0) return 'green'
  if (ratio <= 1.10) return 'amber'
  return 'red'
}

function HealthDot({ forecast, budget }: { forecast: number; budget: number }) {
  const h = lineHealth(forecast, budget)
  return (
    <span
      className={clsx(
        'inline-block w-2 h-2 rounded-full shrink-0',
        h === 'green' ? 'bg-emerald-500' : h === 'amber' ? 'bg-amber-500' : 'bg-red-500',
      )}
      title={h === 'green' ? 'On budget' : h === 'amber' ? 'Slightly over budget' : 'Over budget'}
    />
  )
}

// Compute forecast from form values (EAC = AC + ETC)
function computeForecast(paid: number, ctc: number, budget: number, manualForecast: number): number {
  if (ctc > 0) return paid + ctc
  if (manualForecast > 0) return manualForecast
  return budget
}

// ─── Blank form state ─────────────────────────────────────────────────────────

function blankForm(category: string) {
  return {
    description: '', vendorName: '', contractNumber: '', contactEmail: '', category,
    budgetAmount: '', contractAmount: '', invoicedAmount: '', paidAmount: '',
    forecastAmount: '', costToComplete: '', paymentStatus: 'Pending', notes: '',
  }
}

// ─── Inline line-item form ────────────────────────────────────────────────────

function LineItemForm({
  category,
  onSave,
  onCancel,
}: {
  category: string
  onSave: (form: ReturnType<typeof blankForm>) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState(blankForm(category))
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.description.trim()) return
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <form onSubmit={handleSave} className="mt-3 p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input value={form.description} onChange={e => set('description', e.target.value)}
          placeholder="Description *" required className={inp} autoFocus />
        <input value={form.vendorName} onChange={e => set('vendorName', e.target.value)}
          placeholder="Vendor / Contractor" className={inp} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <input type="number" value={form.contractAmount} onChange={e => set('contractAmount', e.target.value)}
          placeholder="Contract $" className={inp} />
        <div className="relative">
          <input type="number" value={form.costToComplete} onChange={e => set('costToComplete', e.target.value)}
            placeholder="Cost to Complete $" className={inp} />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 pointer-events-none">ETC</span>
        </div>
        <input value={form.notes} onChange={e => set('notes', e.target.value)}
          placeholder="Notes" className={inp} />
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={saving || !form.description.trim()}
          className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-50">
          <Check size={12} /> {saving ? 'Saving…' : 'Add Item'}
        </button>
        <button type="button" onClick={onCancel}
          className="flex items-center gap-1 border border-slate-800 text-slate-400 text-xs px-3 py-1.5 rounded-lg hover:bg-slate-900">
          <X size={12} /> Cancel
        </button>
      </div>
    </form>
  )
}

// ─── Editable line item row ───────────────────────────────────────────────────

function LineItemRow({ item, onDelete }: {
  item: ExtBudgetItem
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [invoicing, setInvoicing] = useState(false)
  const [invoiceAmt, setInvoiceAmt] = useState('')
  const [form, setForm] = useState({
    description:      item.description,
    vendorName:       item.vendorName ?? '',
    contractNumber:   item.contractNumber ?? '',
    contactEmail:     item.contactEmail ?? '',
    category:         item.category,
    budgetAmount:     String(item.budgetAmount),
    contractAmount:   String(item.contractAmount ?? item.committedAmount),
    invoicedAmount:   String(item.invoicedAmount ?? 0),
    paidAmount:       String(item.paidAmount ?? 0),
    forecastAmount:   String(item.forecastAmount),
    costToComplete:   String(item.costToComplete ?? ''),
    paymentStatus:    item.paymentStatus ?? 'Pending',
    notes:            item.notes,
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    setSaving(true)
    const contract = Number(form.contractAmount) || 0
    const ctc      = Number(form.costToComplete) || 0
    // forecast = contract + CTC if CTC is set, otherwise just contract amount
    const forecast = ctc > 0 ? contract + ctc : contract
    await updateDoc(doc(db, 'budgetItems', item.id), {
      description:      form.description,
      vendorName:       form.vendorName,
      category:         form.category,
      budgetAmount:     contract,
      committedAmount:  contract,
      contractAmount:   contract,
      forecastAmount:   forecast,
      costToComplete:   ctc > 0 ? ctc : null,
      variance:         contract - forecast,
      notes:            form.notes,
      // Clear trend badge — intentional fee revisions should not flag as a variance change
      forecastTrend:    'flat',
      forecastPrev:     null,
      updatedAt:        new Date().toISOString(),
    })
    setSaving(false)
    setEditing(false)
  }

  const logInvoice = async () => {
    const amount = Number(invoiceAmt)
    if (!amount || amount <= 0) return
    setSaving(true)
    const newPaid = (item.paidAmount ?? 0) + amount
    const ctc = item.costToComplete ?? 0
    const newForecast = ctc > 0 ? newPaid + ctc : item.forecastAmount
    await updateDoc(doc(db, 'budgetItems', item.id), {
      paidAmount:    increment(amount),
      invoicedAmount: increment(amount),
      actualAmount:  increment(amount),
      forecastAmount: newForecast,
      variance:      item.budgetAmount - newForecast,
      paymentStatus: 'Paid',
      updatedAt:     new Date().toISOString(),
    })
    setInvoiceAmt('')
    setInvoicing(false)
    setSaving(false)
  }

  const paidAmt = item.paidAmount ?? 0
  const forecast    = item.forecastAmount
  const variance      = item.budgetAmount - forecast
  const trendDelta    = item.forecastPrev != null ? forecast - item.forecastPrev : 0

  if (editing) {
    // Preview forecast based on current form values
    const prevForecast = computeForecast(
      Number(form.paidAmount) || 0,
      Number(form.costToComplete) || 0,
      Number(form.budgetAmount) || 0,
      Number(form.forecastAmount) || 0,
    )

    const lbl = 'block text-[10px] text-slate-400 mb-1'

    return (
      <tr className="bg-slate-900/80 border-t border-slate-800">
        <td className="px-3 py-3" colSpan={5}>
          <div className="space-y-3">

            {/* Row 1: Description + Vendor */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Description *</label>
                <input value={form.description} onChange={e => set('description', e.target.value)}
                  placeholder="e.g. Construction Fee" className={inp} autoFocus />
              </div>
              <div>
                <label className={lbl}>Vendor / Contractor</label>
                <input value={form.vendorName} onChange={e => set('vendorName', e.target.value)}
                  placeholder="Vendor name" className={inp} />
              </div>
            </div>

            {/* Row 2: Contract $, CTC, Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={lbl}>Contract $</label>
                <input type="number" value={form.contractAmount} onChange={e => set('contractAmount', e.target.value)}
                  placeholder="0" className={inp} />
              </div>
              <div>
                <label className={lbl}>Cost to Complete (ETC) $</label>
                <input type="number" value={form.costToComplete} onChange={e => set('costToComplete', e.target.value)}
                  placeholder="Auto-calculates forecast" className={inp} />
              </div>
              <div>
                <label className={lbl}>Notes</label>
                <input value={form.notes} onChange={e => set('notes', e.target.value)}
                  placeholder="Optional" className={inp} />
              </div>
            </div>

            {Number(form.costToComplete) > 0 && (
              <p className="text-[10px] text-blue-400">
                Auto-forecast: {fmt(prevForecast)} (Paid + Cost to Complete)
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={save} disabled={saving}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-lg">
                <Check size={12} /> {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditing(false)}
                className="flex items-center gap-1.5 border border-slate-800 text-slate-400 text-xs px-4 py-2 rounded-lg hover:bg-slate-900">
                <X size={12} /> Cancel
              </button>
            </div>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <>
      <tr className="border-t border-slate-800/50 hover:bg-slate-900/40 group cursor-pointer" onClick={() => setEditing(true)}>
        <td className="px-3 py-2.5 w-4">
          <HealthDot forecast={forecast} budget={item.budgetAmount} />
        </td>
        <td className="px-3 py-2.5">
          <p className="text-slate-200 text-sm">{item.description || '—'}</p>
          {item.vendorName && <p className="text-xs text-slate-400 mt-0.5">{item.vendorName}</p>}
          {item.costToComplete != null && item.costToComplete > 0 && (
            <p className="text-[10px] text-blue-400 mt-0.5">ETC: {fmt(item.costToComplete)}</p>
          )}
        </td>
        <td className="px-3 py-2.5 text-right text-sm tabular-nums font-medium">
          <span className={clsx(lineHealth(forecast, item.budgetAmount) === 'green' ? 'text-emerald-400' : lineHealth(forecast, item.budgetAmount) === 'amber' ? 'text-amber-400' : 'text-red-400')}>
            {fmt(forecast)}
          </span>
        </td>
        <td className="px-3 py-2.5 text-right text-slate-400 text-sm tabular-nums">{paidAmt > 0 ? fmt(paidAmt) : '—'}</td>
        <td className="px-3 py-2.5 text-right">
          <div className="flex items-center justify-end gap-1">
            {variance >= 0
              ? <TrendingDown size={12} className="text-emerald-400" />
              : <TrendingUp size={12} className="text-red-400" />}
            <span className={clsx('text-sm font-medium tabular-nums', variance >= 0 ? 'text-emerald-400' : 'text-red-400')}>
              {fmt(Math.abs(variance))}
            </span>
            {item.forecastTrend && item.forecastTrend !== 'flat' && Math.abs(trendDelta) >= 1 && (
              <span
                className={clsx(
                  'ml-1 text-[9px] font-medium px-1 py-0.5 rounded',
                  item.forecastTrend === 'up'
                    ? 'bg-red-900/60 text-red-400'
                    : 'bg-emerald-900/60 text-emerald-400',
                )}
                title={`Forecast ${item.forecastTrend === 'up' ? 'increased' : 'decreased'} by ${fmt(Math.abs(trendDelta))} since last save`}
              >
                {item.forecastTrend === 'up' ? '↑' : '↓'} {fmt(Math.abs(trendDelta))}
              </span>
            )}
            <button
              onClick={e => { e.stopPropagation(); setInvoicing(!invoicing); setInvoiceAmt('') }}
              className={clsx(
                'ml-1 p-1 rounded transition-colors',
                invoicing ? 'text-emerald-400' : 'text-slate-400 hover:text-emerald-400',
              )}
              title="Log invoice"
            >
              <Receipt size={11} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete(item.id) }}
              className="p-1 text-slate-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 size={11} />
            </button>
          </div>
        </td>
      </tr>

      {invoicing && (
        <tr className="border-t border-emerald-800/40 bg-emerald-950/20">
          <td colSpan={8} className="px-4 py-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Receipt size={13} className="text-emerald-400 shrink-0" />
              <span className="text-xs text-emerald-300 font-medium shrink-0">Log Invoice</span>
              {paidAmt > 0 && (
                <span className="text-[10px] text-slate-400 shrink-0">Total paid so far: {fmt(paidAmt)}</span>
              )}
              <input
                type="number"
                value={invoiceAmt}
                onChange={e => setInvoiceAmt(e.target.value)}
                placeholder="Invoice amount $"
                autoFocus
                className="w-44 bg-slate-900 text-slate-100 text-xs rounded px-2 py-1.5 border border-emerald-700/60 focus:outline-none focus:border-emerald-500 placeholder-slate-600"
                onKeyDown={e => { if (e.key === 'Enter') logInvoice(); if (e.key === 'Escape') setInvoicing(false) }}
              />
              <button
                onClick={logInvoice}
                disabled={saving || !invoiceAmt || Number(invoiceAmt) <= 0}
                className="flex items-center gap-1 bg-emerald-700 hover:bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-50"
              >
                <Check size={11} /> {saving ? 'Saving…' : 'Add'}
              </button>
              <button
                onClick={() => { setInvoicing(false); setInvoiceAmt('') }}
                className="flex items-center gap-1 border border-slate-800 text-slate-400 text-xs px-3 py-1.5 rounded-lg hover:bg-slate-900"
              >
                <X size={11} /> Cancel
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Category accordion card ──────────────────────────────────────────────────

function CategoryCard({
  category,
  items,
  approvedBudget,
  onAdd,
  onDelete,
  onSetBudget,
}: {
  category: string
  items: ExtBudgetItem[]
  approvedBudget: number | null
  onAdd: (form: ReturnType<typeof blankForm>) => Promise<void>
  onDelete: (id: string) => void
  onSetBudget: (amount: number | null) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingBudget, setEditingBudget] = useState(false)
  const [budgetInput, setBudgetInput] = useState('')
  const [savingBudget, setSavingBudget] = useState(false)

  const cfg = CATEGORY_COLORS[category] ?? { pill: 'bg-slate-700 text-slate-300', bar: 'bg-slate-500', border: 'border-slate-800/40' }

  // All line items draw from the approved category budget
  const totalDrawn = items.reduce((s, i) => s + i.forecastAmount, 0)
  const catPaid    = items.reduce((s, i) => s + (i.paidAmount ?? 0), 0)

  // If an approved budget is set, use it; otherwise fall back to sum of line item budgets
  const catBudget  = approvedBudget ?? items.reduce((s, i) => s + i.budgetAmount, 0)
  const catRemaining = catBudget > 0 ? catBudget - totalDrawn : null


  // Status based on drawn vs approved budget
  const drawnPct = catBudget > 0 ? (totalDrawn / catBudget) * 100 : 0
  const catHealth: 'green' | 'amber' | 'red' = drawnPct > 100 ? 'red' : drawnPct >= 85 ? 'amber' : 'green'
  const barColor = drawnPct > 100 ? 'bg-red-500' : drawnPct >= 85 ? 'bg-amber-500' : 'bg-emerald-500'
  const barWidth = Math.min(100, drawnPct)

  const handleAdd = async (form: ReturnType<typeof blankForm>) => {
    await onAdd({ ...form, category })
    setShowForm(false)
    setExpanded(true)
  }

  const saveBudget = async () => {
    const amount = Number(budgetInput)
    if (!budgetInput || isNaN(amount)) return
    setSavingBudget(true)
    await onSetBudget(amount > 0 ? amount : null)
    setSavingBudget(false)
    setEditingBudget(false)
  }

  const openBudgetEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setBudgetInput(approvedBudget ? String(approvedBudget) : '')
    setEditingBudget(true)
    setExpanded(true)
  }

  return (
    <div className={clsx('bg-slate-900 border rounded-xl overflow-hidden', expanded ? cfg.border : 'border-slate-800')}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex flex-col gap-3 px-4 pt-4 pb-3 hover:bg-slate-700/20 transition-colors text-left"
      >
        {/* Row 1: chevron + category pill + health badge + spacer + item count */}
        <div className="flex items-center gap-2 w-full">
          {expanded
            ? <ChevronDown size={14} className="text-slate-400 shrink-0" />
            : <ChevronRight size={14} className="text-slate-400 shrink-0" />}
          <span className={clsx('text-xs px-2 py-0.5 rounded font-medium shrink-0', cfg.pill)}>
            {category}
          </span>
          {catBudget > 0 && catHealth !== 'green' && (
            <span className={clsx(
              'text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0',
              catHealth === 'amber' ? 'bg-amber-900/60 text-amber-300' : 'bg-red-900/60 text-red-300',
            )}>
              {catHealth === 'red' ? 'Over budget' : 'Approaching limit'}
            </span>
          )}
          <div className="flex-1" />
          <span className="text-sm text-slate-400 shrink-0 font-medium">
            {items.length === 0 ? 'No items' : `${items.length} item${items.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        {/* Row 2: Budget | Forecast | Remaining — fixed thirds so numbers always align */}
        <div className="grid grid-cols-3 items-end w-full pl-5">
          {/* Budget — left */}
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Budget</p>
            <button
              onClick={openBudgetEdit}
              className={clsx('font-semibold tabular-nums hover:underline leading-none block p-0 m-0', approvedBudget ? 'text-slate-100 text-sm' : 'text-blue-400 text-sm')}
              title="Click to set approved budget"
            >
              {approvedBudget ? fmt(approvedBudget) : '+ Set budget'}
            </button>
          </div>
          {/* Forecast — center */}
          <div className="text-center">
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Forecast</p>
            <p className="text-slate-100 font-semibold text-sm tabular-nums leading-none">
              {totalDrawn > 0 ? fmt(totalDrawn) : '—'}
            </p>
          </div>
          {/* Remaining — right */}
          <div className="text-right">
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Remaining</p>
            {catBudget > 0 ? (
              <p className={clsx('font-semibold text-sm tabular-nums leading-none', (catRemaining ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                {catRemaining !== null ? fmt(Math.abs(catRemaining)) : '—'}
                {(catRemaining ?? 0) < 0 && <span className="text-xs ml-0.5">over</span>}
              </p>
            ) : (
              <p className="text-slate-400 text-sm leading-none">—</p>
            )}
          </div>
        </div>

        {/* Row 3: progress bar */}
        {catBudget > 0 ? (
          <div className="w-full pl-5">
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div className={clsx('h-full rounded-l-full transition-all', barColor)} style={{ width: `${barWidth}%` }} />
            </div>
            <span className={clsx('text-sm font-semibold mt-1 block', catHealth === 'red' ? 'text-red-400' : catHealth === 'amber' ? 'text-amber-400' : 'text-emerald-400')}>
              {Math.round(drawnPct)}% utilized
            </span>
          </div>
        ) : (
          <p className="pl-5 text-xs text-slate-400">No approved budget set — click "+ Set budget" to add one</p>
        )}
      </button>

      {expanded && (
        <div className="border-t border-slate-800/50">

          {/* ── Approved budget editor ─────────────────────────────────────── */}
          {editingBudget ? (
            <div className="px-4 py-3 bg-slate-900/40 border-b border-slate-800/50 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-400 font-medium">Approved {category} Budget:</span>
              <input
                type="number"
                value={budgetInput}
                onChange={e => setBudgetInput(e.target.value)}
                placeholder="e.g. 2331000"
                autoFocus
                className="w-44 bg-slate-900 text-slate-100 text-xs rounded px-2 py-1.5 border border-blue-600 focus:outline-none placeholder-slate-600"
                onKeyDown={e => { if (e.key === 'Enter') saveBudget(); if (e.key === 'Escape') setEditingBudget(false) }}
              />
              <button onClick={saveBudget} disabled={savingBudget}
                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-50">
                <Check size={11} /> {savingBudget ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditingBudget(false)}
                className="flex items-center gap-1 border border-slate-800 text-slate-400 text-xs px-3 py-1.5 rounded-lg hover:bg-slate-900">
                <X size={11} /> Cancel
              </button>
              {approvedBudget && (
                <button onClick={async () => { setSavingBudget(true); await onSetBudget(null); setSavingBudget(false); setEditingBudget(false) }}
                  className="text-xs text-red-400 hover:text-red-300 ml-2">
                  Clear budget
                </button>
              )}
            </div>
          ) : (
            <div className="px-4 py-2 border-b border-slate-800/30 flex items-center justify-between">
              <div className="flex items-center gap-3 text-sm flex-wrap">
                <span className="text-slate-400">
                  Approved Budget: <span className="text-slate-100 font-semibold tabular-nums">
                    {approvedBudget ? fmt(approvedBudget) : <span className="text-slate-400 italic">not set</span>}
                  </span>
                </span>
                {catBudget > 0 && (
                  <>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-400">
                      Drawn: <span className={clsx('font-semibold tabular-nums', catHealth === 'red' ? 'text-red-400' : catHealth === 'amber' ? 'text-amber-400' : 'text-emerald-400')}>
                        {fmt(totalDrawn)}
                      </span>
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-400">
                      Remaining: <span className={clsx('font-semibold tabular-nums', (catRemaining ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                        {catRemaining !== null
                          ? `${(catRemaining ?? 0) < 0 ? '(' : ''}${fmt(Math.abs(catRemaining ?? 0))}${(catRemaining ?? 0) < 0 ? ') over' : ''}`
                          : '—'}
                      </span>
                    </span>
                  </>
                )}
              </div>
              <button onClick={openBudgetEdit}
                className="text-xs text-blue-400 hover:text-blue-300 shrink-0 ml-2">
                {approvedBudget ? 'Edit' : '+ Set Budget'}
              </button>
            </div>
          )}

          {items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 text-[10px] uppercase tracking-wide border-b border-slate-800/50">
                    <th className="px-3 py-2 w-4" />
                    <th className="text-left px-3 py-2">Description / Vendor</th>
                    <th className="text-right px-3 py-2">Forecast</th>
                    <th className="text-right px-3 py-2">Paid</th>
                    <th className="text-right px-3 py-2">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <LineItemRow
                      key={item.id}
                      item={item}
                      onDelete={onDelete}
                    />
                  ))}
                  {/* Category subtotal row */}
                  <tr className="border-t border-slate-800/50 bg-slate-900/30 text-xs font-semibold">
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2 text-slate-400">
                      Total <span className="text-slate-400 font-normal">of {approvedBudget ? fmt(approvedBudget) : 'budget'}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <span className={clsx(catHealth === 'green' ? 'text-emerald-400' : catHealth === 'amber' ? 'text-amber-400' : 'text-red-400')}>
                        {totalDrawn > 0 ? fmt(totalDrawn) : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-emerald-400 tabular-nums">{catPaid > 0 ? fmt(catPaid) : '—'}</td>
                    <td className="px-3 py-2 text-right">
                      {catBudget > 0 && catRemaining !== null && (
                        <span className={clsx('tabular-nums', catRemaining >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                          {catRemaining >= 0 ? fmt(catRemaining) : `(${fmt(Math.abs(catRemaining))})`}
                          <span className="text-slate-400 font-normal ml-1 text-[9px]">remaining</span>
                        </span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-4 py-6 text-center text-slate-400">
              <p className="text-sm">No line items yet for {category}.</p>
              <p className="text-xs text-slate-400 mt-1">Click "+ Add Line Item" below to get started.</p>
            </div>
          )}

          <div className="px-4 pb-4">
            {showForm ? (
              <LineItemForm
                category={category}
                onSave={handleAdd}
                onCancel={() => setShowForm(false)}
              />
            ) : (
              <button
                onClick={() => setShowForm(true)}
                className="mt-2 flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 border border-blue-800/50 hover:border-blue-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus size={12} /> Add Line Item
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Empty state onboarding card ─────────────────────────────────────────────

function EmptyOnboardingCard() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center space-y-4">
      <div className="w-12 h-12 rounded-full bg-blue-900/40 border border-blue-700/40 flex items-center justify-center mx-auto">
        <BookOpen size={22} className="text-blue-400" />
      </div>
      <div>
        <h3 className="text-slate-100 font-semibold text-sm mb-1">Set up your budget</h3>
        <p className="text-slate-400 text-xs">Track costs by category — from hard costs to furniture and technology.</p>
      </div>
      <div className="text-left space-y-3 max-w-sm mx-auto">
        {[
          { step: '1', text: 'Click any category card below to expand it' },
          { step: '2', text: 'Click "+ Add Line Item" and enter a vendor name, description, and budget amount' },
          { step: '3', text: 'Add a "Cost to Complete" (ETC) to auto-calculate the forecast for each line' },
        ].map(({ step, text }) => (
          <div key={step} className="flex items-start gap-3">
            <span className="shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
              {step}
            </span>
            <p className="text-slate-400 text-xs leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Contingency drawdown tracker ─────────────────────────────────────────────

function ContingencyTracker({ items, coApproved }: { items: ExtBudgetItem[]; coApproved: number }) {
  const contingencyItems = items.filter(i => i.category === 'Contingency' || i.category === "Owner's Reserve")
  const nonContingencyItems = items.filter(i => i.category !== 'Contingency' && i.category !== "Owner's Reserve")

  if (contingencyItems.length === 0) return null

  const totalContingency = contingencyItems.reduce((s, i) => s + i.budgetAmount, 0)
  const nonConBudget     = nonContingencyItems.reduce((s, i) => s + i.budgetAmount, 0)
  const nonConForecast   = nonContingencyItems.reduce((s, i) => s + i.forecastAmount, 0)
  const overrun          = Math.max(0, nonConForecast - nonConBudget)
  const effectiveContingency = totalContingency + coApproved
  const remaining        = effectiveContingency - overrun
  const drawdownPct      = effectiveContingency > 0 ? Math.min(100, (overrun / effectiveContingency) * 100) : 0

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-3">Contingency Drawdown</p>
      <div className="flex items-center gap-4 flex-wrap text-xs mb-3">
        <div>
          <p className="text-slate-400">Total Contingency</p>
          <p className="text-slate-200 font-semibold tabular-nums">{fmt(effectiveContingency)}</p>
        </div>
        <div>
          <p className="text-slate-400">Consumed by Overruns</p>
          <p className={clsx('font-semibold tabular-nums', overrun > 0 ? 'text-amber-400' : 'text-slate-400')}>
            {overrun > 0 ? fmt(overrun) : '—'}
          </p>
        </div>
        <div>
          <p className="text-slate-400">Remaining</p>
          <p className={clsx('font-semibold tabular-nums', remaining < 0 ? 'text-red-400' : remaining < effectiveContingency * 0.25 ? 'text-amber-400' : 'text-emerald-400')}>
            {fmt(Math.max(0, remaining))}
          </p>
        </div>
        {remaining < 0 && (
          <div>
            <p className="text-slate-400">Contingency Exhausted</p>
            <p className="text-red-400 font-semibold tabular-nums">{fmt(Math.abs(remaining))} over</p>
          </div>
        )}
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all', drawdownPct >= 100 ? 'bg-red-500' : drawdownPct >= 75 ? 'bg-amber-500' : 'bg-slate-500')}
          style={{ width: `${drawdownPct}%` }}
        />
      </div>
      <p className="text-[10px] text-slate-400 mt-1">{Math.round(drawdownPct)}% of contingency consumed by line-item overruns</p>
    </div>
  )
}

// ─── Main BudgetTab ───────────────────────────────────────────────────────────

export function BudgetTab({ project }: { project: Project }) {
  const { items, loading } = useBudgetItems(project.id)
  const { approvedTotal: coApproved, pendingTotal: coPending } = useChangeOrders(project.id)
  const categoryBudgets: Record<string, number> = project.categoryBudgets ?? {}

  const ext = items as ExtBudgetItem[]
  const totalBudget   = ext.reduce((s, i) => s + i.budgetAmount, 0)
  const totalForecast = ext.reduce((s, i) => s + i.forecastAmount, 0)
  const totalActual   = ext.reduce((s, i) => s + i.actualAmount, 0)
  const totalPaid     = ext.reduce((s, i) => s + (i.paidAmount ?? 0), 0)
  const baseBudget    = project.totalBudget || totalBudget
  const netBudget     = baseBudget + coApproved
  const totalVariance = netBudget - totalForecast

  // Budget health
  const budgetHealth = lineHealth(totalForecast, netBudget)

  // Sync live totals back to the project document so Overview cards stay accurate.
  // Only writes when values actually change; skips the initial render.
  const syncedRef = useRef<string>('')
  useEffect(() => {
    if (loading || items.length === 0) return
    const key = `${totalForecast}|${totalPaid}|${coApproved}`
    if (syncedRef.current === key) return
    syncedRef.current = key
    updateDoc(doc(db, 'projects', project.id), {
      forecastCost:   totalForecast,
      actualCost:     totalPaid,
      committedCost:  coApproved,
      updatedAt:      new Date().toISOString(),
    })
  }, [loading, totalForecast, totalPaid, coApproved, items.length, project.id])

  const handleAdd = async (form: ReturnType<typeof blankForm>) => {
    const contract = Number(form.contractAmount) || 0
    const ctc      = Number(form.costToComplete) || 0
    // forecast = contract + CTC if CTC set, otherwise just the contract amount
    const forecast = ctc > 0 ? contract + ctc : contract
    const now = new Date().toISOString()
    await addDoc(collection(db, 'budgetItems'), {
      projectId:        project.id,
      category:         form.category,
      description:      form.description,
      vendorName:       form.vendorName,
      budgetAmount:     contract,
      committedAmount:  contract,
      contractAmount:   contract,
      invoicedAmount:   0,
      paidAmount:       0,
      forecastAmount:   forecast,
      costToComplete:   ctc > 0 ? ctc : null,
      actualAmount:     0,
      paymentStatus:    'Pending',
      variance:         contract - forecast,
      notes:            form.notes,
      createdAt: now, updatedAt: now,
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this budget line item?')) return
    await deleteDoc(doc(db, 'budgetItems', id))
  }

  const handleSetCategoryBudget = async (category: string, amount: number | null) => {
    const updated = { ...categoryBudgets }
    if (amount === null) {
      delete updated[category]
    } else {
      updated[category] = amount
    }
    await updateDoc(doc(db, 'projects', project.id), { categoryBudgets: updated })
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  const hasItems = ext.length > 0 || Object.keys(categoryBudgets).length > 0 || (project.totalBudget ?? 0) > 0

  return (
    <div className="space-y-4">

      {/* ── Budget health banner ──────────────────────────────────────────── */}
      {hasItems && budgetHealth !== 'green' && (
        <div className={clsx(
          'flex items-center gap-3 rounded-xl px-4 py-3 border text-sm',
          budgetHealth === 'amber'
            ? 'bg-amber-900/20 border-amber-700/40 text-amber-300'
            : 'bg-red-900/20 border-red-700/40 text-red-300',
        )}>
          <AlertTriangle size={15} className="shrink-0" />
          <span>
            {budgetHealth === 'amber'
              ? `Forecast is slightly over net budget by ${fmt(Math.abs(totalVariance))}.`
              : `Budget overrun — forecast exceeds net budget by ${fmt(Math.abs(totalVariance))}.`}
          </span>
        </div>
      )}

      {/* ── 4 KPI cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Approved Budget',  value: fmt(baseBudget),    color: 'text-slate-100' },
          { label: 'Net w/ COs',       value: fmt(netBudget),     color: coApproved > 0 ? 'text-amber-300' : 'text-slate-100' },
          { label: 'Total Forecast',   value: fmt(totalForecast), color: budgetHealth === 'green' ? 'text-blue-300' : budgetHealth === 'amber' ? 'text-amber-400' : 'text-red-400' },
          { label: 'Actual Spent',     value: fmt(totalActual || totalPaid), color: 'text-slate-200' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-3">
            <p className="text-xs text-slate-400 mb-1">{s.label}</p>
            <p className={clsx('text-lg font-bold tabular-nums', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── CO Rollup banner ─────────────────────────────────────────────── */}
      {(coApproved !== 0 || coPending !== 0) && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex flex-wrap gap-4 text-xs">
          {coApproved !== 0 && (
            <div>
              <span className="text-slate-400">Approved COs: </span>
              <span className={clsx('font-semibold', coApproved > 0 ? 'text-red-400' : 'text-emerald-400')}>
                {coApproved >= 0 ? '+' : ''}{fmt(coApproved)}
              </span>
            </div>
          )}
          {coPending !== 0 && (
            <div className="flex items-center gap-1">
              <AlertTriangle size={11} className="text-amber-400" />
              <span className="text-slate-400">Pending Exposure: </span>
              <span className="text-amber-400 font-semibold">{fmt(coPending)}</span>
            </div>
          )}
          <div>
            <span className="text-slate-400">Net Budget: </span>
            <span className="text-slate-200 font-semibold">{fmt(netBudget)}</span>
          </div>
          <div>
            <span className="text-slate-400">Remaining: </span>
            <span className={clsx('font-semibold', totalVariance >= 0 ? 'text-emerald-400' : 'text-red-400')}>
              {totalVariance >= 0 ? fmt(totalVariance) : `(${fmt(Math.abs(totalVariance))})`}
            </span>
          </div>
        </div>
      )}

      {/* ── Utilization bar ──────────────────────────────────────────────── */}
      {hasItems && (() => {
        const forecastPct = Math.min(100, (totalForecast / (netBudget || 1)) * 100)
        const paidPct     = Math.min(forecastPct, (totalPaid / (netBudget || 1)) * 100)
        const barColor    = budgetHealth === 'red' ? 'bg-red-500' : budgetHealth === 'amber' ? 'bg-amber-500' : 'bg-blue-500'
        return (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-300 font-medium">Budget Utilization</span>
              <span className={clsx('font-semibold', totalVariance < 0 ? 'text-red-400' : 'text-emerald-400')}>
                {totalVariance >= 0 ? `${fmt(totalVariance)} remaining` : `${fmt(Math.abs(totalVariance))} over budget`}
              </span>
            </div>
            {/* Two-layer bar: forecast fill + paid overlay */}
            <div className="h-3 bg-slate-700 rounded-full overflow-hidden relative">
              {/* Forecast committed */}
              <div className={clsx('absolute h-full rounded-full transition-all opacity-40', barColor)}
                style={{ width: `${forecastPct}%` }} />
              {/* Actually paid */}
              {paidPct > 0 && (
                <div className={clsx('absolute h-full rounded-full transition-all', barColor)}
                  style={{ width: `${paidPct}%` }} />
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              <span className="text-sm text-slate-400 flex items-center gap-1">
                <span className={clsx('w-2 h-2 rounded-sm inline-block opacity-40', barColor)} />
                Forecast {fmt(totalForecast)} <span className="text-slate-100 font-medium">({Math.round(forecastPct)}% of budget)</span>
              </span>
              {totalPaid > 0 && (
                <span className="text-sm text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" /> Paid {fmt(totalPaid)}
                </span>
              )}
            </div>
          </div>
        )
      })()}

      {/* ── Contingency drawdown ──────────────────────────────────────────── */}
      {hasItems && <ContingencyTracker items={ext} coApproved={coApproved} />}

      {/* ── Empty onboarding card ─────────────────────────────────────────── */}
      {!hasItems && <EmptyOnboardingCard />}

      {/* ── Category accordion cards ──────────────────────────────────────── */}
      <div className="space-y-2">
        {CATEGORIES.map(cat => {
          const catItems = ext.filter(i => i.category === cat)
          return (
            <CategoryCard
              key={cat}
              category={cat}
              items={catItems}
              approvedBudget={categoryBudgets[cat] ?? null}
              onAdd={handleAdd}
              onDelete={handleDelete}
              onSetBudget={amount => handleSetCategoryBudget(cat, amount)}
            />
          )
        })}
        {(() => {
          const orphans = ext.filter(i => !CATEGORIES.includes(i.category))
          if (orphans.length === 0) return null
          return (
            <div className="bg-slate-900 border border-red-800/40 rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3">
                <AlertTriangle size={13} className="text-red-400 shrink-0" />
                <span className="text-sm font-medium text-red-300">Unrecognized Category ({orphans.length} item{orphans.length > 1 ? 's' : ''})</span>
                <span className="text-xs text-slate-400 ml-1">— imported from external source, unknown category</span>
              </div>
              <div className="border-t border-slate-800 divide-y divide-slate-700/50">
                {orphans.map(item => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 text-xs text-slate-400">
                    <span className="flex-1 truncate">{item.description || '(no description)'}</span>
                    <span className="text-slate-400">{item.category}</span>
                    <span className="tabular-nums text-slate-300">{fmt(item.forecastAmount || item.budgetAmount || 0)}</span>
                    <button onClick={() => handleDelete(item.id)} className="p-1 text-slate-400 hover:text-red-400 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}
      </div>

      {/* ── Financial summary footer ──────────────────────────────────────── */}
      {hasItems && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl px-4 py-3 flex flex-wrap gap-4 text-sm">
          <div><span className="text-slate-400">Baseline: </span><span className="text-slate-200 font-medium">{fmt(baseBudget)}</span></div>
          <div>
            <span className="text-slate-400">+ Approved COs: </span>
            <span className={clsx('font-medium', coApproved > 0 ? 'text-red-400' : coApproved < 0 ? 'text-emerald-400' : 'text-slate-400')}>
              {coApproved !== 0 ? `${coApproved > 0 ? '+' : ''}${fmt(coApproved)}` : '—'}
            </span>
          </div>
          <div><span className="text-slate-400">= Net Budget: </span><span className="text-blue-300 font-medium">{fmt(netBudget)}</span></div>
          <div className="ml-auto">
            <span className="text-slate-400">Forecast Variance: </span>
            <span className={clsx('font-semibold', totalVariance >= 0 ? 'text-emerald-400' : 'text-red-400')}>
              {totalVariance >= 0 ? fmt(totalVariance) : `(${fmt(Math.abs(totalVariance))})`}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
