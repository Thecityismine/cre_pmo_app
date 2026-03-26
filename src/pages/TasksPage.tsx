import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Circle, ChevronDown, ChevronRight, RefreshCw, AlertTriangle, Clock, ListTodo, FolderKanban, BarChart2 } from 'lucide-react'
import { clsx } from 'clsx'
import { useAllProjectTasks } from '@/hooks/useAllProjectTasks'
import { useProjects } from '@/hooks/useProjects'
import type { ProjectTask, ProjectTaskPriority } from '@/hooks/useProjectTasks'

type Filter = 'all' | 'overdue' | 'this-week' | 'recurring'

const PRIORITY_COLORS: Record<ProjectTaskPriority, string> = {
  low:    'bg-slate-700 text-slate-300',
  medium: 'bg-blue-900 text-blue-300',
  high:   'bg-amber-900 text-amber-300',
  urgent: 'bg-red-900 text-red-300',
}

const parseLocal = (d: string) => {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day)
}

const fmtDate = (d: string) =>
  d ? parseLocal(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''

function isOverdue(dueDate: string) {
  if (!dueDate) return false
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return parseLocal(dueDate) < today
}

// ─── Single task row ────────────────────────────────────────────────────────
function TaskRow({
  task,
  projectName,
  onComplete,
}: {
  task: ProjectTask
  projectName: string
  onComplete: () => void
}) {
  const [completing, setCompleting] = useState(false)
  const overdue = isOverdue(task.dueDate)

  const handleComplete = async () => {
    setCompleting(true)
    await onComplete()
    setCompleting(false)
  }

  return (
    <div className="flex items-start gap-3 px-4 py-4 border-b border-slate-800/60 last:border-0">
      <button
        onClick={handleComplete}
        disabled={completing}
        className="mt-0.5 shrink-0 text-slate-500 hover:text-green-400 transition-colors"
      >
        {completing ? (
          <CheckCircle2 size={20} className="text-green-400 animate-pulse" />
        ) : (
          <Circle size={20} />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-200 leading-snug">{task.title}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {task.priority && (
            <span className={clsx('text-[10px] px-1.5 py-0.5 rounded font-medium', PRIORITY_COLORS[task.priority])}>
              {task.priority}
            </span>
          )}
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <FolderKanban size={10} />
            {projectName}
          </span>
          {task.dueDate && (
            <span className={clsx('text-xs font-medium flex items-center gap-1', overdue ? 'text-red-400' : 'text-slate-400')}>
              {overdue ? <AlertTriangle size={10} /> : <Clock size={10} />}
              {fmtDate(task.dueDate)}
            </span>
          )}
          {task.recurrence && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/50 text-purple-300 flex items-center gap-1">
              <RefreshCw size={9} />
              {task.recurrence.frequency}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Recurring group row ────────────────────────────────────────────────────
function RecurringGroup({
  title,
  tasks,
  projectMap,
  onComplete,
}: {
  title: string
  tasks: ProjectTask[]
  projectMap: Record<string, string>
  onComplete: (task: ProjectTask) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const freq = tasks[0]?.recurrence?.frequency ?? ''
  const overdueCnt = tasks.filter(t => isOverdue(t.dueDate)).length

  return (
    <div className="border-b border-slate-800/60 last:border-0">
      {/* Group header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-slate-800/30 transition-colors"
      >
        <RefreshCw size={16} className="text-purple-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-200 font-medium truncate">{title}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/50 text-purple-300">
              {freq}
            </span>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <FolderKanban size={10} />
              {tasks.length} project{tasks.length !== 1 ? 's' : ''}
            </span>
            {overdueCnt > 0 && (
              <span className="text-xs text-red-400 flex items-center gap-1">
                <AlertTriangle size={10} />
                {overdueCnt} overdue
              </span>
            )}
          </div>
        </div>
        {expanded
          ? <ChevronDown size={16} className="text-slate-500 shrink-0" />
          : <ChevronRight size={16} className="text-slate-500 shrink-0" />
        }
      </button>

      {/* Per-project rows */}
      {expanded && (
        <div className="bg-slate-900/30 border-t border-slate-800/40">
          {tasks.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              projectName={projectMap[task.projectId] ?? 'Unknown'}
              onComplete={() => onComplete(task)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────
export function TasksPage() {
  const { tasks, loading, completeTask, overdue, thisWeek, recurring } = useAllProjectTasks()
  const { projects } = useProjects()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('all')

  const projectMap = useMemo(
    () => Object.fromEntries(projects.map(p => [p.id, p.projectName])),
    [projects]
  )

  // Group recurring tasks by title
  const recurringGroups = useMemo(() => {
    const map = new Map<string, ProjectTask[]>()
    recurring.forEach(t => {
      const key = t.title.trim().toLowerCase()
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    })
    // Sort: overdue groups first, then by title
    return Array.from(map.entries())
      .map(([, tasks]) => tasks)
      .sort((a, b) => {
        const aOverdue = a.some(t => isOverdue(t.dueDate)) ? 0 : 1
        const bOverdue = b.some(t => isOverdue(t.dueDate)) ? 0 : 1
        if (aOverdue !== bOverdue) return aOverdue - bOverdue
        return a[0].title.localeCompare(b[0].title)
      })
  }, [recurring])

  // Non-recurring tasks (for All / Overdue / This Week views)
  const nonRecurring = useMemo(() => tasks.filter(t => !t.recurrence), [tasks])

  // Filtered view
  const filteredTasks = useMemo(() => {
    switch (filter) {
      case 'overdue':   return overdue.filter(t => !t.recurrence)
      case 'this-week': return thisWeek.filter(t => !t.recurrence)
      default:          return nonRecurring
    }
  }, [filter, overdue, thisWeek, nonRecurring])

  const filteredRecurringGroups = useMemo(() => {
    if (filter === 'overdue') {
      return recurringGroups
        .map(g => g.filter(t => isOverdue(t.dueDate)))
        .filter(g => g.length > 0)
    }
    if (filter === 'this-week') {
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const in7 = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
      return recurringGroups
        .map(g => g.filter(t => t.dueDate && parseLocal(t.dueDate) >= today && parseLocal(t.dueDate) <= in7))
        .filter(g => g.length > 0)
    }
    if (filter === 'recurring') return recurringGroups
    return recurringGroups // 'all'
  }, [filter, recurringGroups])

  const showRecurring = filter !== 'overdue' && filter !== 'this-week'
    ? filteredRecurringGroups.length > 0
    : filteredRecurringGroups.length > 0

  const stats = [
    { label: 'Open',      value: tasks.length,     icon: ListTodo,       color: 'text-blue-400',   filter: 'all' as Filter },
    { label: 'Overdue',   value: overdue.length,    icon: AlertTriangle,  color: 'text-red-400',    filter: 'overdue' as Filter },
    { label: 'This Week', value: thisWeek.length,   icon: Clock,          color: 'text-amber-400',  filter: 'this-week' as Filter },
    { label: 'Recurring', value: recurring.length,  icon: RefreshCw,      color: 'text-purple-400', filter: 'recurring' as Filter },
  ]

  const filters: { id: Filter; label: string }[] = [
    { id: 'all',       label: 'All' },
    { id: 'overdue',   label: 'Overdue' },
    { id: 'this-week', label: 'This Week' },
    { id: 'recurring', label: 'Recurring' },
  ]

  return (
    <div className="min-h-screen bg-slate-950 pb-24">
      {/* Page header */}
      <div className="px-4 pt-6 pb-5">
        <h1 className="text-2xl font-bold text-slate-100">Tasks</h1>
        <p className="text-sm text-slate-400 mt-1">{projects.length} active project{projects.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Stats grid — 2×2 matching dashboard card style */}
      <div className="grid grid-cols-2 gap-3 px-4 mb-5">
        {stats.map(({ label, value, icon: Icon, color, filter: f }) => (
          <button
            key={label}
            onClick={() => setFilter(f)}
            className={clsx(
              'flex items-center justify-between rounded-xl border p-4 transition-colors text-left',
              filter === f
                ? 'bg-slate-800 border-slate-600'
                : 'bg-slate-900 border-slate-800 hover:bg-slate-800/50'
            )}
          >
            <div>
              <p className="text-xs text-slate-400 mb-1">{label}</p>
              <p className={clsx('text-2xl font-bold leading-none', color)}>{value}</p>
            </div>
            <div className={clsx('p-2.5 rounded-lg shrink-0', {
              'bg-blue-500/10':   color.includes('blue'),
              'bg-red-500/10':    color.includes('red'),
              'bg-amber-500/10':  color.includes('amber'),
              'bg-purple-500/10': color.includes('purple'),
            })}>
              <Icon size={20} className={color} />
            </div>
          </button>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 px-4 mb-5 overflow-x-auto scrollbar-hide">
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={clsx(
              'shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              filter === f.id
                ? 'bg-blue-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            )}
          >
            {f.label}
            {f.id === 'overdue' && overdue.length > 0 && (
              <span className="ml-1.5 text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                {overdue.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="px-4 space-y-5">

          {/* Recurring groups section */}
          {showRecurring && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <RefreshCw size={11} /> Recurring
              </p>
              <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
                {filteredRecurringGroups.map((group) => (
                  <RecurringGroup
                    key={group[0].title}
                    title={group[0].title}
                    tasks={group}
                    projectMap={projectMap}
                    onComplete={completeTask}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Individual tasks */}
          {filter !== 'recurring' && filteredTasks.length > 0 && (
            <div>
              {filter === 'all' && (
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  One-time
                </p>
              )}
              <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
                {filteredTasks.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    projectName={projectMap[task.projectId] ?? 'Unknown'}
                    onComplete={() => completeTask(task)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* By Project breakdown — shown in All view */}
          {filter === 'all' && tasks.length > 0 && (() => {
            const byProject = projects
              .map(p => {
                const open    = tasks.filter(t => t.projectId === p.id)
                const overdue = open.filter(t => isOverdue(t.dueDate))
                return { project: p, open: open.length, overdue: overdue.length }
              })
              .filter(r => r.open > 0)
              .sort((a, b) => b.overdue - a.overdue || b.open - a.open)
            if (byProject.length === 0) return null
            const maxOpen = Math.max(...byProject.map(r => r.open))
            return (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <BarChart2 size={11} /> By Project
                </p>
                <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
                  {byProject.map(({ project, open, overdue }) => (
                    <button
                      key={project.id}
                      onClick={() => navigate(`/projects/${project.id}?tab=tasks`)}
                      className="w-full flex items-center gap-3 px-4 py-3 border-b border-slate-800/60 last:border-0 hover:bg-slate-800/40 transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm text-slate-200 font-medium truncate">{project.projectName}</p>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            {overdue > 0 && (
                              <span className="text-xs text-red-400 flex items-center gap-0.5 font-medium">
                                <AlertTriangle size={10} /> {overdue}
                              </span>
                            )}
                            <span className="text-xs text-slate-400">{open} open</span>
                          </div>
                        </div>
                        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={clsx('h-full rounded-full transition-all duration-700 bar-fill', overdue > 0 ? 'bg-red-500' : 'bg-blue-500')}
                            style={{ width: `${Math.round((open / maxOpen) * 100)}%` }}
                          />
                        </div>
                      </div>
                      <ChevronRight size={13} className="text-slate-600 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Empty state */}
          {!showRecurring && filteredTasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CheckCircle2 size={36} className="text-slate-700 mb-3" />
              <p className="text-slate-400 font-medium">
                {filter === 'overdue' ? 'No overdue tasks' :
                 filter === 'this-week' ? 'Nothing due this week' :
                 filter === 'recurring' ? 'No recurring tasks' :
                 'All caught up!'}
              </p>
              <p className="text-slate-600 text-sm mt-1">
                {filter === 'all' && 'No open tasks across any projects.'}
              </p>
              {filter === 'all' && (
                <button
                  onClick={() => navigate('/projects')}
                  className="mt-4 text-sm text-blue-400 hover:text-blue-300"
                >
                  Go to Projects →
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
