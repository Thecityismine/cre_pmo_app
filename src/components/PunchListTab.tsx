import { useState } from 'react'
import { clsx } from 'clsx'
import {
  Plus, Download, ClipboardList, ChevronDown, ChevronRight,
  Archive, Pencil, Trash2, Check, Loader2,
} from 'lucide-react'
import { usePunchList } from '@/hooks/usePunchList'
import type { PunchItem, PunchStatus } from '@/hooks/usePunchList'
import type { Project } from '@/types'
import jsPDF from 'jspdf'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PunchStatus, { label: string; color: string; bg: string; border: string }> = {
  'open':   { label: 'Open',   color: 'text-slate-300',   bg: 'bg-slate-700/60',   border: 'border-slate-600' },
  'closed': { label: 'Closed', color: 'text-emerald-300', bg: 'bg-emerald-900/40', border: 'border-emerald-700' },
}

const NEXT_STATUS: Record<PunchStatus, PunchStatus> = {
  'open':   'closed',
  'closed': 'open',
}

const TRADES = [
  '', 'General Contractor', 'Lighting', 'HVAC', 'Plumbing',
  'Millwork', 'Door/Hardware', 'AV', 'Security', 'Low Voltage',
  'Furniture', 'Acoustics', 'GTI Technology', 'Signage', 'Fire Alarm',
]

const fmtDate = (d: string) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''

// ─── PDF Export ───────────────────────────────────────────────────────────────

function exportPunchListPdf(project: Project, items: PunchItem[], punchListDate: string) {
  const activeItems = items.filter(i => i.status !== 'closed')

  const pd = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const W = pd.internal.pageSize.getWidth()
  const H = pd.internal.pageSize.getHeight()
  const MX = 10
  const FOOTER_H = 10
  const HEADER_H = 34

  let currentPage = 1

  const drawHeader = () => {
    // Dark background
    pd.setFillColor(15, 23, 42)
    pd.rect(0, 0, W, H, 'F')
    // Blue accent bar
    pd.setFillColor(59, 130, 246)
    pd.rect(0, 0, W, 1.5, 'F')
    // Card
    pd.setFillColor(30, 41, 59)
    pd.rect(0, 1.5, W, HEADER_H - 1.5, 'F')
    // Project name
    pd.setFontSize(14); pd.setFont('helvetica', 'bold'); pd.setTextColor(226, 232, 240)
    pd.text(project.projectName, MX, 13)
    // Meta
    pd.setFontSize(8); pd.setFont('helvetica', 'normal'); pd.setTextColor(100, 116, 139)
    const meta = [project.projectNumber, [project.address, project.city, project.state].filter(Boolean).join(', ')].filter(Boolean).join('  ·  ')
    pd.text(meta, MX, 19.5)
    if (project.projectManager) pd.text(`PM: ${project.projectManager}`, MX, 25.5)
    // Right side labels
    pd.setFontSize(7); pd.setFont('helvetica', 'bold'); pd.setTextColor(59, 130, 246)
    pd.text('PUNCH LIST', W - MX, 10, { align: 'right' })
    pd.setFont('helvetica', 'normal'); pd.setTextColor(100, 116, 139)
    if (punchListDate) pd.text(fmtDate(punchListDate), W - MX, 16.5, { align: 'right' })
    pd.text(`${activeItems.length} open item${activeItems.length !== 1 ? 's' : ''}`, W - MX, 23, { align: 'right' })
    // White body
    pd.setFillColor(255, 255, 255)
    pd.rect(0, HEADER_H, W, H - HEADER_H, 'F')
  }

  const drawFooter = (pageNum: number, total: number) => {
    pd.setFillColor(240, 242, 245)
    pd.rect(0, H - FOOTER_H, W, FOOTER_H, 'F')
    pd.setFontSize(7); pd.setFont('helvetica', 'normal'); pd.setTextColor(100, 116, 139)
    pd.text(`${project.projectNumber ? project.projectNumber + ' · ' : ''}${project.projectName}`, MX, H - 3.5)
    pd.text(`Page ${pageNum} of ${total}`, W - MX, H - 3.5, { align: 'right' })
    pd.text(new Date().toLocaleDateString('en-US'), W / 2, H - 3.5, { align: 'center' })
  }

  drawHeader()

  let y = HEADER_H + 8

  const checkPage = (needed: number) => {
    if (y + needed > H - FOOTER_H - 4) {
      pd.addPage()
      currentPage++
      pd.setFillColor(255, 255, 255)
      pd.rect(0, 0, W, H, 'F')
      y = 12
    }
  }

  // Group by location
  const groups: Record<string, PunchItem[]> = {}
  for (const item of activeItems) {
    const loc = item.location?.trim() || 'General'
    if (!groups[loc]) groups[loc] = []
    groups[loc].push(item)
  }

  if (activeItems.length === 0) {
    pd.setFontSize(10); pd.setFont('helvetica', 'normal'); pd.setTextColor(150, 150, 150)
    pd.text('No open punch list items.', W / 2, y + 20, { align: 'center' })
  }

  for (const [location, locItems] of Object.entries(groups)) {
    checkPage(12 + locItems.length * 10)

    // Location header bar
    pd.setFillColor(230, 235, 245)
    pd.rect(MX - 2, y - 5, W - MX * 2 + 4, 9, 'F')
    pd.setFontSize(9); pd.setFont('helvetica', 'bold'); pd.setTextColor(30, 40, 70)
    pd.text(location.toUpperCase(), MX, y)
    pd.setFontSize(7.5); pd.setFont('helvetica', 'normal'); pd.setTextColor(100, 116, 139)
    pd.text(`${locItems.length} item${locItems.length !== 1 ? 's' : ''}`, W - MX, y, { align: 'right' })
    y += 7

    for (const item of locItems) {
      const noteLines = item.notes ? (pd.splitTextToSize(`Note: ${item.notes}`, W - MX * 2 - 20) as string[]) : []
      const rowH = 9 + (noteLines.length > 0 ? noteLines.length * 4 + 2 : 0)
      checkPage(rowH + 2)

      // Checkbox
      pd.setDrawColor(160, 160, 160)
      pd.setLineWidth(0.4)
      pd.rect(MX, y - 4, 4.5, 4.5)

      // Item number
      pd.setFontSize(7); pd.setFont('helvetica', 'normal'); pd.setTextColor(120, 130, 150)
      pd.text(item.number, MX + 6.5, y - 0.5)

      // Description
      const descW = W - MX * 2 - 48
      const descLines = pd.splitTextToSize(item.description, descW) as string[]
      pd.setFontSize(9); pd.setFont('helvetica', 'normal'); pd.setTextColor(15, 20, 30)
      pd.text(descLines[0], MX + 18, y - 0.5)

      // Trade (right)
      if (item.trade) {
        pd.setFontSize(7); pd.setTextColor(100, 116, 139)
        pd.text(item.trade, W - MX, y - 0.5, { align: 'right' })
      }

      // Status pill
      const statusLabel = STATUS_CONFIG[item.status].label
      const statusColor: [number, number, number] = [80, 100, 130]
      pd.setFontSize(6.5); pd.setTextColor(...statusColor)
      pd.text(`[${statusLabel}]`, MX + 18, y + 3.5)

      // Notes
      if (noteLines.length > 0) {
        pd.setFontSize(7); pd.setFont('helvetica', 'italic'); pd.setTextColor(120, 120, 120)
        pd.text(noteLines, MX + 18, y + 7)
        y += noteLines.length * 4
      }

      // Divider
      pd.setDrawColor(220, 225, 235)
      pd.setLineWidth(0.2)
      pd.line(MX, y + 4, W - MX, y + 4)
      y += 9
    }
    y += 5
  }

  // Add footers
  const total = pd.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    pd.setPage(p)
    drawFooter(p, total)
  }

  const dateStr = punchListDate || new Date().toISOString().split('T')[0]
  pd.save(`${project.projectNumber || 'project'}-punch-list-${dateStr}.pdf`)
}

// ─── Form ─────────────────────────────────────────────────────────────────────

type FormData = { description: string; location: string; trade: string; notes: string; status: PunchStatus }
const EMPTY: FormData = { description: '', location: '', trade: '', notes: '', status: 'open' }

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
    await onSave({ projectId, description: form.description.trim(), location: form.location, trade: form.trade, notes: form.notes, status: form.status })
    setSaving(false)
    onCancel()
  }

  return (
    <div className="bg-slate-900 border border-blue-600/50 rounded-xl p-4 space-y-3 mb-3">
      <textarea
        value={form.description} onChange={f('description')}
        placeholder="Deficiency description *" rows={2} autoFocus
        className="w-full bg-slate-800 text-slate-100 text-base rounded-lg px-3 py-2.5 border border-slate-700 focus:outline-none focus:border-blue-500 resize-none placeholder-slate-500"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          value={form.location} onChange={f('location')} placeholder="Location / Room"
          className="bg-slate-800 text-slate-300 text-base rounded-lg px-3 py-2.5 border border-slate-700 focus:outline-none focus:border-blue-500 placeholder-slate-500"
        />
        <select
          value={form.trade} onChange={f('trade')}
          className="bg-slate-800 text-slate-300 text-base rounded-lg px-3 py-2.5 border border-slate-700 focus:outline-none focus:border-blue-500"
        >
          <option value="">Trade…</option>
          {TRADES.filter(Boolean).map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs text-slate-400 mb-1.5 block">Status</label>
        <div className="flex gap-2">
          {(['open', 'closed'] as PunchStatus[]).map(s => (
            <button
              key={s} type="button"
              onClick={() => setForm(p => ({ ...p, status: s }))}
              className={clsx(
                'flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
                form.status === s
                  ? s === 'closed' ? 'bg-emerald-700 text-white border-emerald-600' : 'bg-slate-600 text-white border-slate-500'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              )}
            >
              {STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      </div>
      <textarea
        value={form.notes} onChange={f('notes')} placeholder="Notes (optional)" rows={2}
        className="w-full bg-slate-800 text-slate-400 text-base rounded-lg px-3 py-2.5 border border-slate-700 focus:outline-none focus:border-blue-500 resize-none placeholder-slate-500"
      />
      <div className="flex gap-2 pt-1">
        <button
          onClick={save} disabled={saving || !form.description.trim()}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onCancel} className="text-sm text-slate-400 hover:text-slate-300 px-3 py-2">Cancel</button>
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
  const cfg = STATUS_CONFIG[item.status]
  const [expanded, setExpanded] = useState(false)

  const cycleStatus = async () => {
    await onUpdate(item.id, { status: NEXT_STATUS[item.status] })
  }

  if (editing) {
    return (
      <PunchForm
        projectId={projectId}
        initial={{ description: item.description, location: item.location, trade: item.trade, notes: item.notes, status: item.status }}
        onSave={async data => { await onUpdate(item.id, data); setEditing(false) }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-slate-800/50 last:border-0 group hover:bg-slate-800/20 transition-colors">
      {/* Status toggle button */}
      <button
        onClick={cycleStatus}
        title={`Status: ${cfg.label} — tap to advance`}
        className={clsx('mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors', cfg.border, cfg.bg)}
      >
        {item.status === 'closed' && <Check size={10} className="text-emerald-300" />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <span className="text-xs font-mono text-slate-500 shrink-0 mt-0.5">{item.number}</span>
          <p className="text-sm text-slate-100 font-medium leading-snug">{item.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {item.location && (
            <span className="text-xs text-slate-400">📍 {item.location}</span>
          )}
          {item.trade && (
            <span className="text-xs text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded">{item.trade}</span>
          )}
          <button
            onClick={cycleStatus}
            className={clsx('text-xs px-2 py-0.5 rounded-full border font-medium transition-colors', cfg.color, cfg.bg, cfg.border)}
          >
            {cfg.label}
          </button>
        </div>
        {item.notes && (
          <>
            <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 mt-1.5 transition-colors">
              {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              {expanded ? 'Hide note' : 'Note'}
            </button>
            {expanded && <p className="text-xs text-slate-400 mt-1 leading-relaxed">{item.notes}</p>}
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={() => setEditing(true)} className="p-1.5 text-slate-500 hover:text-blue-400 rounded transition-colors">
          <Pencil size={13} />
        </button>
        <button
          onClick={() => { if (confirm('Delete this item?')) onDelete(item.id) }}
          className="p-1.5 text-slate-500 hover:text-red-400 rounded transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

// ─── Location group ───────────────────────────────────────────────────────────

function LocationGroup({ location, items, projectId, onUpdate, onDelete }: {
  location: string; items: PunchItem[]; projectId: string
  onUpdate: (id: string, data: Partial<PunchItem>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mb-3">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          {collapsed ? <ChevronRight size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
          <span className="text-sm font-semibold text-slate-200">{location}</span>
          <span className="text-xs text-slate-500">{items.length} item{items.length !== 1 ? 's' : ''}</span>
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

export function PunchListTab({ project }: { project: Project }) {
  const {
    activeItems, archivedItems, loading,
    addItem, updateItem, deleteItem,
    openCount,
    punchListDate, savePunchListDate,
  } = usePunchList(project.id)

  const [showAdd, setShowAdd] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [editingDate, setEditingDate] = useState(false)
  const [dateInput, setDateInput] = useState('')
  const [exporting, setExporting] = useState(false)

  const grouped = activeItems.reduce<Record<string, PunchItem[]>>((acc, i) => {
    const loc = i.location?.trim() || 'General'
    if (!acc[loc]) acc[loc] = []
    acc[loc].push(i)
    return acc
  }, {})

  const handleExport = async () => {
    setExporting(true)
    try { exportPunchListPdf(project, activeItems, punchListDate) }
    finally { setExporting(false) }
  }

  const handleDateSave = async () => {
    await savePunchListDate(dateInput)
    setEditingDate(false)
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-slate-100">Punch List</h2>
            {/* Date row */}
            {editingDate ? (
              <div className="flex items-center gap-2 mt-1.5">
                <input
                  type="date" value={dateInput}
                  onChange={e => setDateInput(e.target.value)}
                  className="bg-slate-800 text-slate-100 text-base rounded-lg px-3 py-1.5 border border-slate-700 focus:outline-none focus:border-blue-500"
                />
                <button onClick={handleDateSave} className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg">Save</button>
                <button onClick={() => setEditingDate(false)} className="text-xs text-slate-400 px-2 py-1.5">Cancel</button>
              </div>
            ) : (
              <button
                onClick={() => { setDateInput(punchListDate); setEditingDate(true) }}
                className="flex items-center gap-1.5 mt-1 text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                {punchListDate ? fmtDate(punchListDate) : 'Set punch list date'}
                <Pencil size={11} className="opacity-60" />
              </button>
            )}
          </div>

          {/* Export button */}
          <button
            onClick={handleExport}
            disabled={exporting || activeItems.length === 0}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 px-3 py-2 rounded-lg border border-slate-700 transition-colors shrink-0"
          >
            {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            Export PDF
          </button>
        </div>

        {/* Summary pills */}
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-slate-700/60 border border-slate-600 text-slate-300 font-medium">
            {openCount} Open
          </span>
          {archivedItems.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-900/30 border border-emerald-700/50 text-emerald-400 font-medium">
              <Archive size={10} /> {archivedItems.length} Archived
            </span>
          )}
        </div>
      </div>

      {/* Add button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 border border-blue-800/50 hover:border-blue-700 bg-blue-900/10 px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={14} /> Add Item
        </button>
      </div>

      {showAdd && (
        <PunchForm projectId={project.id} onSave={addItem} onCancel={() => setShowAdd(false)} />
      )}

      {/* Items grouped by location */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : activeItems.length === 0 && !showAdd ? (
        <div className="text-center py-12 text-slate-400">
          <ClipboardList size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No open punch list items</p>
          <p className="text-xs mt-1 text-slate-500">Add items to track construction deficiencies.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([loc, locItems]) => (
          <LocationGroup
            key={loc} location={loc} items={locItems}
            projectId={project.id} onUpdate={updateItem} onDelete={deleteItem}
          />
        ))
      )}

      {/* Archived section */}
      {archivedItems.length > 0 && (
        <div className="border border-slate-800 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="w-full flex items-center gap-2 px-4 py-3 bg-slate-900/50 hover:bg-slate-800/40 transition-colors"
          >
            {showArchived ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
            <Archive size={14} className="text-emerald-500" />
            <span className="text-sm font-medium text-slate-400">Closed — {archivedItems.length} item{archivedItems.length !== 1 ? 's' : ''}</span>
            <span className="text-xs text-slate-500 ml-1">(not included in PDF)</span>
          </button>
          {showArchived && (
            <div className="border-t border-slate-800 divide-y divide-slate-800/50">
              {archivedItems.map(item => (
                <div key={item.id} className="flex items-start gap-3 px-4 py-3 opacity-50">
                  <div className="mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 border-emerald-700 bg-emerald-900/40 flex items-center justify-center">
                    <Check size={10} className="text-emerald-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-500">{item.number}</span>
                      <p className="text-sm text-slate-400 line-through">{item.description}</p>
                    </div>
                    {item.location && <p className="text-xs text-slate-500 mt-0.5">📍 {item.location}</p>}
                  </div>
                  <button
                    onClick={() => updateItem(item.id, { status: 'open' })}
                    className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1 rounded shrink-0"
                    title="Restore to open"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
