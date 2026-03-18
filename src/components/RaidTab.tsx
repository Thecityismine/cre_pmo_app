import { useState } from 'react'
import { clsx } from 'clsx'
import { Plus, Trash2, ChevronDown, ChevronRight, Check, AlertTriangle, Zap, Bug, Lightbulb, Bot } from 'lucide-react'
import { useRaidLog } from '@/hooks/useRaidLog'
import type { RaidItem, RaidType, RaidStatus, RaidPriority } from '@/hooks/useRaidLog'
import type { Project } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<RaidType, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  risk:     { label: 'Risk',     color: 'text-red-300',    bg: 'bg-red-900/40 border-red-700/50',    Icon: AlertTriangle },
  action:   { label: 'Action',   color: 'text-blue-300',   bg: 'bg-blue-900/40 border-blue-700/50',   Icon: Zap },
  issue:    { label: 'Issue',    color: 'text-amber-300',  bg: 'bg-amber-900/40 border-amber-700/50', Icon: Bug },
  decision: { label: 'Decision', color: 'text-purple-300', bg: 'bg-purple-900/40 border-purple-700/50', Icon: Lightbulb },
}

const STATUS_CONFIG: Record<RaidStatus, { label: string; color: string }> = {
  'open':        { label: 'Open',        color: 'bg-slate-700 text-slate-300' },
  'in-progress': { label: 'In Progress', color: 'bg-blue-900/60 text-blue-300' },
  'closed':      { label: 'Closed',      color: 'bg-emerald-900/60 text-emerald-300' },
  'accepted':    { label: 'Accepted',    color: 'bg-purple-900/60 text-purple-300' },
}

const PRIORITY_CONFIG: Record<RaidPriority, { label: string; dot: string }> = {
  high:   { label: 'High',   dot: 'bg-red-500' },
  medium: { label: 'Medium', dot: 'bg-amber-500' },
  low:    { label: 'Low',    dot: 'bg-slate-500' },
}

const RAID_TYPES: RaidType[] = ['risk', 'action', 'issue', 'decision']
const RAID_STATUSES: RaidStatus[] = ['open', 'in-progress', 'closed', 'accepted']
const RAID_PRIORITIES: RaidPriority[] = ['high', 'medium', 'low']

// ─── Item row ─────────────────────────────────────────────────────────────────

function RaidRow({
  item,
  onUpdate,
  onDelete,
}: {
  item: RaidItem
  onUpdate: (id: string, data: Partial<RaidItem>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(item.title)
  const [description, setDescription] = useState(item.description)
  const [owner, setOwner] = useState(item.owner)
  const [type, setType] = useState<RaidType>(item.type)
  const [status, setStatus] = useState<RaidStatus>(item.status)
  const [priority, setPriority] = useState<RaidPriority>(item.priority)
  const [dueDate, setDueDate] = useState(item.dueDate)
  const [saving, setSaving] = useState(false)

  const { Icon, color, bg } = TYPE_CONFIG[item.type]

  const save = async () => {
    if (!title.trim()) return
    setSaving(true)
    await onUpdate(item.id, { title, description, owner, type, status, priority, dueDate })
    setSaving(false)
    setEditing(false)
  }

  const cancel = () => {
    setTitle(item.title); setDescription(item.description); setOwner(item.owner)
    setType(item.type); setStatus(item.status); setPriority(item.priority); setDueDate(item.dueDate)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className={clsx('border rounded-xl p-4 space-y-3', bg)}>
        {/* Type + Priority row */}
        <div className="flex gap-2 flex-wrap">
          {RAID_TYPES.map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={clsx(
                'px-3 py-1 rounded-lg text-xs font-medium border transition-colors',
                type === t ? TYPE_CONFIG[t].bg + ' ' + TYPE_CONFIG[t].color : 'bg-slate-800 text-slate-500 border-slate-700'
              )}
            >
              {TYPE_CONFIG[t].label}
            </button>
          ))}
          <div className="flex-1" />
          {RAID_PRIORITIES.map(p => (
            <button
              key={p}
              onClick={() => setPriority(p)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition-colors',
                priority === p ? 'bg-slate-700 text-slate-200 border-slate-500' : 'bg-slate-800 text-slate-500 border-slate-700'
              )}
            >
              <span className={clsx('w-1.5 h-1.5 rounded-full', PRIORITY_CONFIG[p].dot)} />
              {PRIORITY_CONFIG[p].label}
            </button>
          ))}
        </div>

        <input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Title *"
          className="w-full bg-slate-900/60 text-slate-100 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500"
        />

        <div className="grid grid-cols-2 gap-2">
          <input
            value={owner}
            onChange={e => setOwner(e.target.value)}
            placeholder="Owner / Responsible"
            className="bg-slate-900/60 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500"
          />
          <input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            className="bg-slate-900/60 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500"
          />
        </div>

        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Description / notes..."
          rows={2}
          className="w-full bg-slate-900/60 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500 resize-none"
        />

        {/* Status */}
        <div className="flex gap-2 flex-wrap">
          {RAID_STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={clsx(
                'px-3 py-1 rounded-lg text-xs font-medium transition-colors',
                status === s ? STATUS_CONFIG[s].color : 'bg-slate-800 text-slate-500'
              )}
            >
              {STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={saving || !title.trim()}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            <Check size={12} /> {saving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={cancel} className="text-xs text-slate-500 hover:text-slate-300 px-2">Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className={clsx('border rounded-xl overflow-hidden', bg)}>
      <div className="flex items-center gap-3 px-4 py-3 group">
        {/* Type icon */}
        <Icon size={15} className={clsx('shrink-0', color)} />

        {/* Title */}
        <button className="flex-1 text-left min-w-0" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className={clsx('text-sm font-medium', item.status === 'closed' ? 'line-through text-slate-500' : 'text-slate-100')}>
              {item.title}
            </p>
            {item.isSystemGenerated && (
              <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-slate-700/80 text-slate-400 font-medium shrink-0">
                <Bot size={9} /> Auto
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {item.owner && <span className="text-xs text-slate-500">{item.owner}</span>}
            {item.dueDate && (
              <span className="text-xs text-slate-600">
                Due {new Date(item.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        </button>

        {/* Priority dot */}
        <span className={clsx('w-2 h-2 rounded-full shrink-0', PRIORITY_CONFIG[item.priority].dot)} title={item.priority} />

        {/* Status badge */}
        <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium shrink-0 hidden sm:inline-flex', STATUS_CONFIG[item.status].color)}>
          {STATUS_CONFIG[item.status].label}
        </span>

        {/* Expand / collapse chevron */}
        <button onClick={() => setExpanded(!expanded)} className="text-slate-600 shrink-0">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        {/* Actions (hover) */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={() => setEditing(true)} className="p-1 text-slate-500 hover:text-blue-400 text-xs">Edit</button>
          <button
            onClick={() => { if (confirm('Delete this item?')) onDelete(item.id) }}
            className="p-1 text-slate-600 hover:text-red-400"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Expanded description */}
      {expanded && item.description && (
        <div className="px-4 pb-3 border-t border-slate-700/40">
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">{item.description}</p>
        </div>
      )}
    </div>
  )
}

// ─── Add form ─────────────────────────────────────────────────────────────────

function AddRaidForm({
  projectId,
  onAdd,
  onCancel,
}: {
  projectId: string
  onAdd: (data: Omit<RaidItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  onCancel: () => void
}) {
  const [type, setType] = useState<RaidType>('risk')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [owner, setOwner] = useState('')
  const [priority, setPriority] = useState<RaidPriority>('medium')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!title.trim()) return
    setSaving(true)
    await onAdd({
      projectId, type, title: title.trim(), description: description.trim(),
      owner: owner.trim(), priority, status: 'open', dueDate, closedDate: '',
    })
    setSaving(false)
    onCancel()
  }

  return (
    <div className="bg-slate-800 border border-blue-600 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-100">Add RAID Item</h3>

      {/* Type selector */}
      <div className="flex gap-2">
        {RAID_TYPES.map(t => {
          const cfg = TYPE_CONFIG[t]
          return (
            <button
              key={t}
              onClick={() => setType(t)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex-1 justify-center',
                type === t ? cfg.bg + ' ' + cfg.color : 'bg-slate-700 text-slate-400 border-slate-600 hover:text-slate-200'
              )}
            >
              <cfg.Icon size={12} /> {cfg.label}
            </button>
          )
        })}
      </div>

      <input
        autoFocus
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
        placeholder="Title *"
        className="w-full bg-slate-700 text-slate-100 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500 placeholder-slate-500"
      />

      <div className="grid grid-cols-2 gap-2">
        <input
          value={owner}
          onChange={e => setOwner(e.target.value)}
          placeholder="Owner / Responsible"
          className="bg-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500 placeholder-slate-500"
        />
        <input
          type="date"
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
          className="bg-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500"
        />
      </div>

      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Description / mitigation / notes... (optional)"
        rows={2}
        className="w-full bg-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500 resize-none placeholder-slate-500"
      />

      {/* Priority */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Priority:</span>
        {RAID_PRIORITIES.map(p => (
          <button
            key={p}
            onClick={() => setPriority(p)}
            className={clsx(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition-colors',
              priority === p ? 'bg-slate-700 text-slate-200 border-slate-500' : 'text-slate-500 border-slate-700 hover:text-slate-300'
            )}
          >
            <span className={clsx('w-1.5 h-1.5 rounded-full', PRIORITY_CONFIG[p].dot)} />
            {PRIORITY_CONFIG[p].label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={save}
          disabled={saving || !title.trim()}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-40"
        >
          <Plus size={14} /> {saving ? 'Adding...' : 'Add Item'}
        </button>
        <button onClick={onCancel} className="text-sm text-slate-500 hover:text-slate-300 px-3 py-2">Cancel</button>
      </div>
    </div>
  )
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export function RaidTab({ project }: { project: Project }) {
  const { items, loading, addItem, updateItem, deleteItem } = useRaidLog(project.id)
  const [typeFilter, setTypeFilter] = useState<RaidType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<RaidStatus | 'all'>('all')
  const [showAdd, setShowAdd] = useState(false)

  const filtered = items.filter(i => {
    const matchType = typeFilter === 'all' || i.type === typeFilter
    const matchStatus = statusFilter === 'all' || i.status === statusFilter
    return matchType && matchStatus
  })

  // Summary counts
  const counts = {
    risk: items.filter(i => i.type === 'risk' && i.status !== 'closed').length,
    action: items.filter(i => i.type === 'action' && i.status !== 'closed').length,
    issue: items.filter(i => i.type === 'issue' && i.status !== 'closed').length,
    decision: items.filter(i => i.type === 'decision').length,
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        {RAID_TYPES.map(t => {
          const cfg = TYPE_CONFIG[t]
          return (
            <button
              key={t}
              onClick={() => setTypeFilter(typeFilter === t ? 'all' : t)}
              className={clsx(
                'rounded-xl p-3 text-center border transition-colors',
                typeFilter === t ? cfg.bg : 'bg-slate-800 border-slate-700 hover:border-slate-600'
              )}
            >
              <cfg.Icon size={16} className={clsx('mx-auto mb-1', cfg.color)} />
              <p className={clsx('text-xl font-bold', cfg.color)}>{counts[t]}</p>
              <p className="text-xs text-slate-500">{cfg.label}s</p>
            </button>
          )
        })}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as RaidStatus | 'all')}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Statuses</option>
          {RAID_STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
        </select>

        <div className="flex-1" />

        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={14} /> Add Item
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <AddRaidForm
          projectId={project.id}
          onAdd={addItem}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <p className="mb-2">{items.length === 0 ? 'No RAID items yet.' : 'No items match the current filter.'}</p>
          {items.length === 0 && (
            <p className="text-xs text-slate-600">Track Risks, Actions, Issues, and Decisions for this project.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => (
            <RaidRow key={item.id} item={item} onUpdate={updateItem} onDelete={deleteItem} />
          ))}
        </div>
      )}
    </div>
  )
}
