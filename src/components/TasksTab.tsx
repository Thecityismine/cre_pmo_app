import { useState } from 'react'
import { clsx } from 'clsx'
import {
  Plus, Check, Trash2, ChevronDown, ChevronRight,
  Clock, AlertTriangle, CheckSquare, Circle, Loader2,
} from 'lucide-react'
import { useProjectTasks } from '@/hooks/useProjectTasks'
import type { ProjectTask, ProjectTaskPriority } from '@/hooks/useProjectTasks'
import type { Project } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITIES: ProjectTaskPriority[] = ['low', 'medium', 'high', 'urgent']

const PRIORITY_COLORS: Record<ProjectTaskPriority, string> = {
  low:    'bg-slate-700 text-slate-300',
  medium: 'bg-blue-900 text-blue-300',
  high:   'bg-amber-900 text-amber-300',
  urgent: 'bg-red-900 text-red-300',
}

const fmt = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

const fmtShort = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'

function isOverdue(dueDate: string) {
  if (!dueDate) return false
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return new Date(dueDate) < today
}

// ─── Blank form ───────────────────────────────────────────────────────────────

function blankForm() {
  return { title: '', description: '', dueDate: '', assignedTo: '', priority: 'medium' as ProjectTaskPriority }
}

// ─── Add Task Form ────────────────────────────────────────────────────────────

function AddTaskForm({ onSave, onCancel }: {
  onSave: (form: ReturnType<typeof blankForm>) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState(blankForm())
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const [saveError, setSaveError] = useState('')

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    setSaveError('')
    try {
      await onSave(form)
    } catch (err: unknown) {
      setSaveError((err as Error).message ?? 'Failed to save task.')
      setSaving(false)
    }
  }

  const inp = 'w-full bg-slate-900 text-slate-100 text-xs rounded-lg px-2.5 py-2 border border-slate-700 focus:outline-none focus:border-blue-500 placeholder-slate-600'

  return (
    <form onSubmit={handleSave} className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">New Task</p>

      <input
        value={form.title}
        onChange={e => set('title', e.target.value)}
        placeholder="Task title *"
        required
        autoFocus
        className={inp}
      />

      <textarea
        value={form.description}
        onChange={e => set('description', e.target.value)}
        placeholder="Description (optional)"
        rows={2}
        className={`${inp} resize-none`}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] text-slate-500 mb-1 block">Due Date</label>
          <input
            type="date"
            value={form.dueDate}
            onChange={e => set('dueDate', e.target.value)}
            className={inp}
          />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 mb-1 block">Assigned To</label>
          <input
            value={form.assignedTo}
            onChange={e => set('assignedTo', e.target.value)}
            placeholder="Name or role"
            className={inp}
          />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 mb-1 block">Priority</label>
          <select
            value={form.priority}
            onChange={e => set('priority', e.target.value)}
            className={inp}
          >
            {PRIORITIES.map(p => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      {saveError && (
        <p className="text-xs text-red-400 bg-red-900/30 border border-red-800/50 rounded-lg px-3 py-2">{saveError}</p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={saving || !form.title.trim()}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-lg disabled:opacity-50 transition-colors">
          <Check size={12} /> {saving ? 'Saving…' : 'Add Task'}
        </button>
        <button type="button" onClick={onCancel}
          className="border border-slate-600 text-slate-400 text-xs px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  )
}

// ─── Task Row ─────────────────────────────────────────────────────────────────

function TaskRow({ task, onComplete, onDelete }: {
  task: ProjectTask
  onComplete: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [completing, setCompleting] = useState(false)
  const overdue = task.status === 'open' && isOverdue(task.dueDate)

  const handleComplete = async () => {
    setCompleting(true)
    await onComplete()
    setCompleting(false)
  }

  return (
    <div className="border-b border-slate-700/50 last:border-0">
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/30 transition-colors group">
        {/* Checkbox */}
        <button
          onClick={handleComplete}
          disabled={completing || task.status === 'completed'}
          className={clsx(
            'shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
            task.status === 'completed'
              ? 'bg-emerald-600 border-emerald-600'
              : 'border-slate-600 hover:border-blue-500'
          )}
        >
          {completing
            ? <Loader2 size={10} className="animate-spin text-slate-400" />
            : task.status === 'completed'
              ? <Check size={10} className="text-white" />
              : null}
        </button>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={clsx('text-sm font-medium', task.status === 'completed' ? 'line-through text-slate-500' : 'text-slate-200')}>
              {task.title}
            </span>
            <span className={clsx('text-[10px] px-1.5 py-0.5 rounded font-medium', PRIORITY_COLORS[task.priority])}>
              {task.priority}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {task.dueDate && (
              <span className={clsx('text-xs flex items-center gap-1', overdue ? 'text-red-400' : 'text-slate-500')}>
                <Clock size={10} />
                {overdue ? 'Overdue · ' : ''}{fmtShort(task.dueDate)}
              </span>
            )}
            {task.assignedTo && (
              <span className="text-xs text-slate-500">{task.assignedTo}</span>
            )}
            {task.status === 'completed' && task.completedAt && (
              <span className="text-xs text-emerald-500">Completed {fmtShort(task.completedAt)}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {task.description && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
            >
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Expanded description */}
      {expanded && task.description && (
        <div className="px-12 pb-3">
          <p className="text-xs text-slate-400 bg-slate-900/60 rounded-lg px-3 py-2 leading-relaxed">
            {task.description}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Main TasksTab ─────────────────────────────────────────────────────────────

type Filter = 'open' | 'overdue' | 'completed' | 'all'

export function TasksTab({ project, showAddForm: externalShowForm, onFormClose }: {
  project: Project
  showAddForm?: boolean
  onFormClose?: () => void
}) {
  const { tasks, loading, addTask, completeTask, deleteTask, open, completed, overdue, dueSoon } = useProjectTasks(project.id)
  const [filter, setFilter] = useState<Filter>('open')
  const [showForm, setShowForm] = useState(false)
  const [showArchive, setShowArchive] = useState(false)

  const isFormVisible = showForm || (externalShowForm ?? false)
  const closeForm = () => { setShowForm(false); onFormClose?.() }

  const handleAdd = async (form: ReturnType<typeof blankForm>) => {
    await addTask({
      projectId: project.id,
      title:       form.title,
      description: form.description,
      dueDate:     form.dueDate,
      assignedTo:  form.assignedTo,
      priority:    form.priority as ProjectTaskPriority,
      status:      'open',
    })
    closeForm()
    setFilter('open')
  }

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"?`)) return
    await deleteTask(id)
  }

  const visibleOpen = filter === 'overdue'
    ? overdue
    : filter === 'all'
      ? tasks.filter(t => t.status === 'open')
      : open

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-slate-500" /></div>
  }

  return (
    <div className="space-y-4">

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Open',       value: open.length,      color: 'text-slate-100',    icon: Circle },
          { label: 'Overdue',    value: overdue.length,   color: overdue.length > 0 ? 'text-red-400' : 'text-slate-100', icon: AlertTriangle },
          { label: 'Due This Week', value: dueSoon.length, color: dueSoon.length > 0 ? 'text-amber-300' : 'text-slate-100', icon: Clock },
          { label: 'Completed',  value: completed.length, color: 'text-emerald-400',  icon: CheckSquare },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="bg-slate-800 border border-slate-700 rounded-xl p-3 flex items-center gap-3">
            <Icon size={18} className={clsx('shrink-0', color)} />
            <div>
              <p className={clsx('text-xl font-bold tabular-nums', color)}>{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {(['open', 'overdue', 'all'] as Filter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize',
                filter === f ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
              )}>
              {f === 'all' ? 'All Open' : f}
              {f === 'overdue' && overdue.length > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-[9px] px-1 rounded-full">{overdue.length}</span>
              )}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shrink-0"
        >
          <Plus size={14} /> Add Task
        </button>
      </div>

      {/* ── Add Form ── */}
      {isFormVisible && (
        <AddTaskForm onSave={handleAdd} onCancel={closeForm} />
      )}

      {/* ── Open Tasks ── */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        {visibleOpen.length === 0 ? (
          <div className="py-12 text-center">
            <CheckSquare size={32} className="mx-auto text-slate-600 mb-3" />
            <p className="text-slate-500 text-sm">
              {filter === 'overdue' ? 'No overdue tasks.' : 'No open tasks. Click "Add Task" to get started.'}
            </p>
          </div>
        ) : (
          visibleOpen.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              onComplete={() => completeTask(task.id)}
              onDelete={() => handleDelete(task.id, task.title)}
            />
          ))
        )}
      </div>

      {/* ── Completed / Archive ── */}
      {completed.length > 0 && (
        <div>
          <button
            onClick={() => setShowArchive(!showArchive)}
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-2"
          >
            {showArchive ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            Archive ({completed.length} completed)
          </button>

          {showArchive && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden opacity-70">
              {completed.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onComplete={() => {}}
                  onDelete={() => handleDelete(task.id, task.title)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Footer info ── */}
      {tasks.length > 0 && (
        <p className="text-xs text-slate-600 text-center">
          {open.length} open · {completed.length} completed · Last updated {fmt(tasks[0]?.updatedAt || '')}
        </p>
      )}
    </div>
  )
}
