import { useState } from 'react'
import { clsx } from 'clsx'
import { Plus, Trash2, ChevronDown, ChevronRight, Check, AlertTriangle, Zap, Bug, Lightbulb, Bot, Download, DollarSign, Clock3, Layers, Sparkles, Loader2, Link2, CheckSquare, FileText } from 'lucide-react'
import { useRaidLog } from '@/hooks/useRaidLog'
import type { RaidItem, RaidType, RaidStatus, RaidPriority, LinkedItem } from '@/hooks/useRaidLog'
import type { Project } from '@/types'
import { callClaude, hasClaudeKey } from '@/lib/claude'
import { useProjectTasks } from '@/hooks/useProjectTasks'
import { useBudgetItems } from '@/hooks/useBudgetItems'
import { useRfis } from '@/hooks/useRfis'

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<RaidType, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  risk:     { label: 'Risk',     color: 'text-red-300',    bg: 'bg-red-900/40 border-red-700/50',    Icon: AlertTriangle },
  action:   { label: 'Action',   color: 'text-blue-300',   bg: 'bg-blue-900/40 border-blue-700/50',   Icon: Zap },
  issue:    { label: 'Issue',    color: 'text-amber-300',  bg: 'bg-amber-900/40 border-amber-700/50', Icon: Bug },
  decision: { label: 'Decision', color: 'text-purple-300', bg: 'bg-purple-900/40 border-purple-700/50', Icon: Lightbulb },
}

const STATUS_CONFIG: Record<RaidStatus, { label: string; color: string }> = {
  'open':        { label: 'Open',       color: 'bg-slate-700 text-slate-300' },
  'in-progress': { label: 'In Progress', color: 'bg-blue-900/60 text-blue-300' },
  'mitigated':   { label: 'Mitigated',  color: 'bg-teal-900/60 text-teal-300' },
  'closed':      { label: 'Closed',     color: 'bg-emerald-900/60 text-emerald-300' },
  'accepted':    { label: 'Accepted',   color: 'bg-purple-900/60 text-purple-300' },
}

const PRIORITY_CONFIG: Record<RaidPriority, { label: string; dot: string }> = {
  high:   { label: 'High',   dot: 'bg-red-500' },
  medium: { label: 'Medium', dot: 'bg-amber-500' },
  low:    { label: 'Low',    dot: 'bg-slate-500' },
}

const RAID_TYPES: RaidType[] = ['risk', 'action', 'issue', 'decision']
const RAID_STATUSES: RaidStatus[] = ['open', 'in-progress', 'mitigated', 'closed', 'accepted']
const RAID_PRIORITIES: RaidPriority[] = ['high', 'medium', 'low']

const fmt$ = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

// ─── System-key → source label + tab ─────────────────────────────────────────

const SYSTEM_SOURCE: Record<string, { label: string; tab: string }> = {
  'proj-tasks-overdue': { label: 'Overdue Tasks',     tab: 'tasks'    },
  'milestones-missed':  { label: 'Missed Milestones', tab: 'schedule' },
  'budget-overrun':     { label: 'Budget Overrun',    tab: 'budget'   },
  'rfis-overdue':       { label: 'Overdue RFIs',      tab: 'rfis'     },
  'budget-not-started': { label: 'Budget Setup',      tab: 'budget'   },
}

function getSource(systemKey?: string): { label: string; tab: string } | null {
  if (!systemKey) return null
  const prefix = Object.keys(SYSTEM_SOURCE).find(k => systemKey.startsWith(k))
  return prefix ? SYSTEM_SOURCE[prefix] : null
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportToCSV(items: RaidItem[], projectName: string) {
  const headers = ['Type', 'Title', 'Status', 'Priority', 'Owner', 'Due Date', 'Cost Impact ($)', 'Schedule Impact (days)', 'Scope Impact', 'Description']
  const rows = items.map(i => [
    i.type,
    `"${i.title.replace(/"/g, '""')}"`,
    i.status,
    i.priority,
    i.owner || '',
    i.dueDate || '',
    i.costImpact ?? '',
    i.scheduleImpact ?? '',
    `"${(i.scopeImpact || '').replace(/"/g, '""')}"`,
    `"${(i.description || '').replace(/"/g, '""')}"`,
  ])
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${projectName.replace(/[^a-z0-9]/gi, '_')}_RAID_Log.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Linked items picker ──────────────────────────────────────────────────────

interface PickerOption { id: string; label: string; sub?: string }

function LinkedItemsPicker({
  value,
  onChange,
  tasks,
  budgetItems,
  rfis,
}: {
  value: LinkedItem[]
  onChange: (items: LinkedItem[]) => void
  tasks: PickerOption[]
  budgetItems: PickerOption[]
  rfis: PickerOption[]
}) {
  const [tab, setTab] = useState<'task' | 'budget' | 'rfi'>('task')
  const [open, setOpen] = useState(false)

  const toggle = (type: LinkedItem['type'], opt: PickerOption) => {
    const exists = value.some(l => l.type === type && l.id === opt.id)
    onChange(exists
      ? value.filter(l => !(l.type === type && l.id === opt.id))
      : [...value, { type, id: opt.id, label: opt.label }]
    )
  }

  const TABS: { id: LinkedItem['type']; label: string; icon: React.ElementType; opts: PickerOption[] }[] = [
    { id: 'task',   label: 'Tasks',        icon: CheckSquare, opts: tasks },
    { id: 'budget', label: 'Budget Lines', icon: DollarSign,  opts: budgetItems },
    { id: 'rfi',    label: 'RFIs',         icon: FileText,    opts: rfis },
  ]

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-600 hover:border-slate-500 rounded-lg px-2.5 py-1.5 transition-colors"
      >
        <Link2 size={11} />
        Link items
        {value.length > 0 && (
          <span className="bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{value.length}</span>
        )}
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      </button>

      {open && (
        <div className="mt-2 bg-slate-900/80 border border-slate-700 rounded-xl overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-slate-700">
            {TABS.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors flex-1 justify-center',
                  tab === t.id ? 'text-blue-300 border-b-2 border-blue-500 bg-blue-950/20' : 'text-slate-500 hover:text-slate-300',
                )}
              >
                <t.icon size={10} />
                {t.label}
                {value.filter(l => l.type === t.id).length > 0 && (
                  <span className="text-[9px] bg-blue-600 text-white px-1 rounded-full">
                    {value.filter(l => l.type === t.id).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Options */}
          <div className="max-h-36 overflow-y-auto divide-y divide-slate-800">
            {TABS.find(t => t.id === tab)!.opts.length === 0 ? (
              <p className="text-xs text-slate-600 text-center py-4 italic">
                No {TABS.find(t => t.id === tab)!.label.toLowerCase()} on this project yet.
              </p>
            ) : (
              TABS.find(t => t.id === tab)!.opts.map(opt => {
                const selected = value.some(l => l.type === tab && l.id === opt.id)
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggle(tab, opt)}
                    className={clsx(
                      'w-full text-left flex items-center gap-2.5 px-3 py-2 text-xs transition-colors',
                      selected ? 'bg-blue-950/40 text-blue-200' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200',
                    )}
                  >
                    <span className={clsx(
                      'w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0',
                      selected ? 'bg-blue-600 border-blue-500' : 'border-slate-600',
                    )}>
                      {selected && <Check size={9} className="text-white" />}
                    </span>
                    <span className="flex-1 truncate">{opt.label}</span>
                    {opt.sub && <span className="text-slate-600 shrink-0">{opt.sub}</span>}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Linked items display chips ───────────────────────────────────────────────

const LINK_TYPE_CFG: Record<LinkedItem['type'], { icon: React.ElementType; color: string; tab: string }> = {
  task:   { icon: CheckSquare, color: 'text-blue-400 bg-blue-900/30 border-blue-800/40',   tab: 'tasks'  },
  budget: { icon: DollarSign,  color: 'text-amber-400 bg-amber-900/30 border-amber-800/40', tab: 'budget' },
  rfi:    { icon: FileText,    color: 'text-purple-400 bg-purple-900/30 border-purple-800/40', tab: 'rfis' },
}

function LinkedItemChips({ items, onNavigate }: { items: LinkedItem[]; onNavigate?: (tab: string) => void }) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {items.map((l, i) => {
        const cfg = LINK_TYPE_CFG[l.type]
        return (
          <button
            key={i}
            type="button"
            onClick={() => onNavigate?.(cfg.tab)}
            className={clsx(
              'flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border transition-colors hover:brightness-125',
              cfg.color,
            )}
            title={`Go to ${l.type}: ${l.label}`}
          >
            <cfg.icon size={9} />
            <span className="truncate max-w-[120px]">{l.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Impact chips (compact display) ──────────────────────────────────────────

function ImpactChips({ item }: { item: RaidItem }) {
  if (!item.costImpact && !item.scheduleImpact && !item.scopeImpact) return null
  return (
    <div className="flex items-center gap-2 flex-wrap mt-1.5">
      {!!item.costImpact && (
        <span className="flex items-center gap-1 text-[10px] bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-amber-300">
          <DollarSign size={9} /> {fmt$(item.costImpact)}
        </span>
      )}
      {!!item.scheduleImpact && (
        <span className="flex items-center gap-1 text-[10px] bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-blue-300">
          <Clock3 size={9} /> {item.scheduleImpact}d
        </span>
      )}
      {item.scopeImpact && (
        <span className="flex items-center gap-1 text-[10px] bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-slate-400">
          <Layers size={9} /> Scope
        </span>
      )}
    </div>
  )
}

// ─── Item row ─────────────────────────────────────────────────────────────────

function RaidRow({
  item,
  onUpdate,
  onDelete,
  projectName,
  onSourceClick,
  taskOptions,
  budgetOptions,
  rfiOptions,
}: {
  item: RaidItem
  onUpdate: (id: string, data: Partial<RaidItem>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  projectName: string
  onSourceClick?: (tab: string) => void
  taskOptions: PickerOption[]
  budgetOptions: PickerOption[]
  rfiOptions: PickerOption[]
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [mitigation, setMitigation] = useState('')
  const [mitigating, setMitigating] = useState(false)
  const [title, setTitle] = useState(item.title)
  const [description, setDescription] = useState(item.description)
  const [owner, setOwner] = useState(item.owner)
  const [type, setType] = useState<RaidType>(item.type)
  const [status, setStatus] = useState<RaidStatus>(item.status)
  const [priority, setPriority] = useState<RaidPriority>(item.priority)
  const [dueDate, setDueDate] = useState(item.dueDate)
  const [costImpact, setCostImpact] = useState(item.costImpact?.toString() ?? '')
  const [scheduleImpact, setScheduleImpact] = useState(item.scheduleImpact?.toString() ?? '')
  const [scopeImpact, setScopeImpact] = useState(item.scopeImpact ?? '')
  const [linkedItems, setLinkedItems] = useState<LinkedItem[]>(item.linkedItems ?? [])
  const [saving, setSaving] = useState(false)

  const { Icon, color, bg } = TYPE_CONFIG[item.type]

  const suggestMitigation = async () => {
    setMitigating(true)
    setMitigation('')
    const prompt = `You are a senior CRE project manager. Suggest 3 concise, actionable mitigation strategies for this RAID item.

Project: ${projectName}
Type: ${item.type} | Priority: ${item.priority} | Status: ${item.status}
Title: ${item.title}
Description: ${item.description || 'No description provided'}${item.costImpact ? `\nCost Impact: $${item.costImpact.toLocaleString()}` : ''}${item.scheduleImpact ? `\nSchedule Impact: ${item.scheduleImpact} days` : ''}

Respond with exactly 3 bullet points. Each bullet: one action verb, one sentence, specific and practical. No preamble.`
    try {
      const result = await callClaude(
        [{ role: 'user', content: prompt }],
        'You are a concise CRE PM risk advisor. Return only bullet points, no intro text.',
        400,
      )
      setMitigation(result.trim())
    } catch {
      setMitigation('Error generating suggestions. Check your Claude API key in Settings.')
    } finally {
      setMitigating(false)
    }
  }

  const save = async () => {
    if (!title.trim()) return
    setSaving(true)
    await onUpdate(item.id, {
      title, description, owner, type, status, priority, dueDate,
      costImpact: costImpact ? parseFloat(costImpact) : undefined,
      scheduleImpact: scheduleImpact ? parseInt(scheduleImpact, 10) : undefined,
      scopeImpact: scopeImpact.trim() || undefined,
      linkedItems,
    })
    setSaving(false)
    setEditing(false)
  }

  const cancel = () => {
    setTitle(item.title); setDescription(item.description); setOwner(item.owner)
    setType(item.type); setStatus(item.status); setPriority(item.priority); setDueDate(item.dueDate)
    setCostImpact(item.costImpact?.toString() ?? '')
    setScheduleImpact(item.scheduleImpact?.toString() ?? '')
    setScopeImpact(item.scopeImpact ?? '')
    setLinkedItems(item.linkedItems ?? [])
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

        {/* Impact fields */}
        <div className="grid grid-cols-3 gap-2">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
            <input
              type="number"
              value={costImpact}
              onChange={e => setCostImpact(e.target.value)}
              placeholder="Cost impact"
              className="w-full bg-slate-900/60 text-slate-300 text-sm rounded-lg pl-5 pr-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="relative">
            <input
              type="number"
              value={scheduleImpact}
              onChange={e => setScheduleImpact(e.target.value)}
              placeholder="Days impact"
              className="w-full bg-slate-900/60 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-[10px]">days</span>
          </div>
          <input
            value={scopeImpact}
            onChange={e => setScopeImpact(e.target.value)}
            placeholder="Scope impact"
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

        {/* Linked items */}
        <LinkedItemsPicker
          value={linkedItems}
          onChange={setLinkedItems}
          tasks={taskOptions}
          budgetItems={budgetOptions}
          rfis={rfiOptions}
        />

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
            {(() => {
              const src = getSource(item.systemKey)
              if (!src) return null
              return (
                <button
                  onClick={e => { e.stopPropagation(); onSourceClick?.(src.tab) }}
                  className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-400 border border-blue-800/40 font-medium shrink-0 hover:bg-blue-800/50 transition-colors"
                  title={`Triggered by: ${src.label} — click to view`}
                >
                  ↗ {src.label}
                </button>
              )
            })()}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {item.owner && <span className="text-xs text-slate-500">{item.owner}</span>}
            {item.dueDate && (
              <span className="text-xs text-slate-600">
                Due {new Date(item.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
          <ImpactChips item={item} />
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

      {/* Expanded section */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-700/40 space-y-3 pt-3">
          {item.description && (
            <p className="text-sm text-slate-400 leading-relaxed">{item.description}</p>
          )}
          {item.scopeImpact && (
            <div className="flex items-start gap-2">
              <Layers size={12} className="text-slate-500 mt-0.5 shrink-0" />
              <p className="text-xs text-slate-500">{item.scopeImpact}</p>
            </div>
          )}
          {item.linkedItems && item.linkedItems.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Linked items</p>
              <LinkedItemChips items={item.linkedItems} onNavigate={onSourceClick} />
            </div>
          )}

          {/* AI Mitigation */}
          {hasClaudeKey() && (item.status === 'open' || item.status === 'in-progress') && (
            <div className="border-t border-slate-700/40 pt-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={12} className="text-violet-400" />
                  <span className="text-xs font-medium text-slate-300">AI Mitigation Suggestions</span>
                </div>
                <button
                  onClick={suggestMitigation}
                  disabled={mitigating}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-violet-900/40 hover:bg-violet-800/50 border border-violet-700/40 text-violet-300 disabled:opacity-60 transition-colors"
                >
                  {mitigating
                    ? <><Loader2 size={10} className="animate-spin" /> Thinking...</>
                    : <><Sparkles size={10} /> Suggest</>
                  }
                </button>
              </div>
              {mitigation && (
                <div className="bg-violet-950/30 border border-violet-800/30 rounded-lg p-3">
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{mitigation}</p>
                </div>
              )}
              {!mitigation && !mitigating && (
                <p className="text-xs text-slate-600 italic">Click "Suggest" to get AI-recommended mitigation strategies.</p>
              )}
            </div>
          )}
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
  taskOptions,
  budgetOptions,
  rfiOptions,
}: {
  projectId: string
  onAdd: (data: Omit<RaidItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  onCancel: () => void
  taskOptions: PickerOption[]
  budgetOptions: PickerOption[]
  rfiOptions: PickerOption[]
}) {
  const [type, setType] = useState<RaidType>('risk')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [owner, setOwner] = useState('')
  const [priority, setPriority] = useState<RaidPriority>('medium')
  const [dueDate, setDueDate] = useState('')
  const [costImpact, setCostImpact] = useState('')
  const [scheduleImpact, setScheduleImpact] = useState('')
  const [scopeImpact, setScopeImpact] = useState('')
  const [linkedItems, setLinkedItems] = useState<LinkedItem[]>([])
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!title.trim()) return
    setSaving(true)
    await onAdd({
      projectId, type, title: title.trim(), description: description.trim(),
      owner: owner.trim(), priority, status: 'open', dueDate, closedDate: '',
      costImpact: costImpact ? parseFloat(costImpact) : undefined,
      scheduleImpact: scheduleImpact ? parseInt(scheduleImpact, 10) : undefined,
      scopeImpact: scopeImpact.trim() || undefined,
      linkedItems: linkedItems.length > 0 ? linkedItems : undefined,
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

      {/* Impact fields */}
      <div className="grid grid-cols-3 gap-2">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
          <input
            type="number"
            value={costImpact}
            onChange={e => setCostImpact(e.target.value)}
            placeholder="Cost impact"
            className="w-full bg-slate-700 text-slate-300 text-sm rounded-lg pl-5 pr-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500 placeholder-slate-500"
          />
        </div>
        <div className="relative">
          <input
            type="number"
            value={scheduleImpact}
            onChange={e => setScheduleImpact(e.target.value)}
            placeholder="Days impact"
            className="w-full bg-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500 placeholder-slate-500"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-[10px]">days</span>
        </div>
        <input
          value={scopeImpact}
          onChange={e => setScopeImpact(e.target.value)}
          placeholder="Scope impact"
          className="bg-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500 placeholder-slate-500"
        />
      </div>

      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Description / mitigation / notes... (optional)"
        rows={2}
        className="w-full bg-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500 resize-none placeholder-slate-500"
      />

      {/* Linked items */}
      <LinkedItemsPicker
        value={linkedItems}
        onChange={setLinkedItems}
        tasks={taskOptions}
        budgetItems={budgetOptions}
        rfis={rfiOptions}
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

export function RaidTab({ project, setTab }: { project: Project; setTab?: (tab: string) => void }) {
  const { items, loading, addItem, updateItem, deleteItem } = useRaidLog(project.id)
  const { tasks: projectTasks } = useProjectTasks(project.id)
  const { items: budgetLineItems } = useBudgetItems(project.id)
  const { rfis } = useRfis(project.id)
  const [typeFilter, setTypeFilter] = useState<RaidType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<RaidStatus | 'all'>('open')
  const [showAdd, setShowAdd] = useState(false)

  const taskOptions: PickerOption[] = projectTasks.map(t => ({ id: t.id, label: t.title }))
  const budgetOptions: PickerOption[] = budgetLineItems.map(b => ({
    id: b.id,
    label: b.category,
    sub: b.description || undefined,
  }))
  const rfiOptions: PickerOption[] = rfis.map(r => ({ id: r.id, label: `RFI #${r.number}`, sub: r.subject }))

  const filtered = items.filter(i => {
    const matchType = typeFilter === 'all' || i.type === typeFilter
    // "open" filter shows open + in-progress + mitigated (not resolved)
    if (statusFilter === 'open') {
      return matchType && (i.status === 'open' || i.status === 'in-progress' || i.status === 'mitigated')
    }
    return matchType && (statusFilter === 'all' || i.status === statusFilter)
  })

  // Summary counts (open + in-progress only)
  const counts = {
    risk: items.filter(i => i.type === 'risk' && (i.status === 'open' || i.status === 'in-progress')).length,
    action: items.filter(i => i.type === 'action' && (i.status === 'open' || i.status === 'in-progress')).length,
    issue: items.filter(i => i.type === 'issue' && (i.status === 'open' || i.status === 'in-progress')).length,
    decision: items.filter(i => i.type === 'decision').length,
  }

  // Total cost/schedule exposure
  const openItems = items.filter(i => i.status === 'open' || i.status === 'in-progress')
  const totalCostExposure = openItems.reduce((s, i) => s + (i.costImpact ?? 0), 0)
  const totalScheduleExposure = openItems.reduce((s, i) => s + (i.scheduleImpact ?? 0), 0)

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

      {/* Exposure summary */}
      {(totalCostExposure > 0 || totalScheduleExposure > 0) && (
        <div className="flex gap-3">
          {totalCostExposure > 0 && (
            <div className="flex items-center gap-2 bg-amber-900/20 border border-amber-700/30 rounded-lg px-3 py-2">
              <DollarSign size={13} className="text-amber-400 shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Total Cost Exposure</p>
                <p className="text-sm font-semibold text-amber-300">{fmt$(totalCostExposure)}</p>
              </div>
            </div>
          )}
          {totalScheduleExposure > 0 && (
            <div className="flex items-center gap-2 bg-blue-900/20 border border-blue-700/30 rounded-lg px-3 py-2">
              <Clock3 size={13} className="text-blue-400 shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Schedule Exposure</p>
                <p className="text-sm font-semibold text-blue-300">{totalScheduleExposure} days</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as RaidStatus | 'all')}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
        >
          <option value="open">Open Items</option>
          <option value="all">All Statuses</option>
          {RAID_STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
        </select>

        <div className="flex-1" />

        <button
          onClick={() => exportToCSV(items, project.projectName)}
          className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm px-3 py-2 rounded-lg transition-colors"
          title="Export to CSV"
        >
          <Download size={13} /> <span className="hidden sm:inline">CSV</span>
        </button>

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
          taskOptions={taskOptions}
          budgetOptions={budgetOptions}
          rfiOptions={rfiOptions}
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
            <RaidRow
              key={item.id}
              item={item}
              onUpdate={updateItem}
              onDelete={deleteItem}
              projectName={project.projectName}
              onSourceClick={setTab}
              taskOptions={taskOptions}
              budgetOptions={budgetOptions}
              rfiOptions={rfiOptions}
            />
          ))}
        </div>
      )}
    </div>
  )
}
