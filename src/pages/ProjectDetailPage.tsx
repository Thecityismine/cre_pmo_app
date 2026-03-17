import { useParams, useNavigate } from 'react-router-dom'
import { useProject } from '@/hooks/useProject'
import { useTasks } from '@/hooks/useTasks'
import { useProjectTeam } from '@/hooks/useProjectTeam'
import { useState } from 'react'
import { clsx } from 'clsx'
import {
  ArrowLeft, MapPin, DollarSign, Users, CheckSquare,
  Calendar, TrendingUp, ChevronDown, ChevronRight, Pencil, FileDown,
  X, AlertCircle, Clock,
} from 'lucide-react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { EditProjectModal } from '@/components/EditProjectModal'
import { BudgetTab } from '@/components/BudgetTab'
import { AITab } from '@/components/AITab'
import { DocumentsTab } from '@/components/DocumentsTab'
import { RaidTab } from '@/components/RaidTab'
import { ChangeOrdersTab } from '@/components/ChangeOrdersTab'
import { RfiTab } from '@/components/RfiTab'
import { SubmittalsTab } from '@/components/SubmittalsTab'
import { useBudgetItems } from '@/hooks/useBudgetItems'
import { computeHealth, healthColor, healthBg } from '@/lib/healthScore'
import { MilestoneTimeline } from '@/components/MilestoneTimeline'
import { exportProjectPdf } from '@/lib/exportPdf'
import type { Task, TaskStatus } from '@/types'

// ─── Stage gate progress ──────────────────────────────────────────────────────
const STAGES = [
  'Pre-Project', 'Initiate', 'Planning', 'Design',
  'Construction', 'Handover', 'Closeout', 'Closed',
]

const STATUS_STAGE_MAP: Record<string, number> = {
  'pre-project': 0, 'initiate': 1, 'planning': 2, 'design': 3,
  'construction': 4, 'handover': 5, 'closeout': 6, 'defect-period': 6, 'closed': 7,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  'complete':     'bg-emerald-900 text-emerald-300',
  'in-progress':  'bg-blue-900 text-blue-300',
  'not-started':  'bg-slate-700 text-slate-400',
  'on-hold':      'bg-yellow-900 text-yellow-300',
  'blocked':      'bg-red-900 text-red-300',
  'n-a':          'bg-slate-800 text-slate-500',
}

const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  'complete': 'Complete', 'in-progress': 'In Progress', 'not-started': 'Not Started',
  'on-hold': 'On Hold', 'blocked': 'Blocked', 'n-a': 'N/A',
}

const TASK_STATUSES: TaskStatus[] = ['not-started', 'in-progress', 'complete', 'on-hold', 'blocked', 'n-a']

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, accent = false }: {
  label: string; value: string; sub?: string; icon: React.ElementType; accent?: boolean
}) {
  return (
    <div className={clsx('rounded-xl p-4 border', accent ? 'bg-blue-900/30 border-blue-700' : 'bg-slate-800 border-slate-700')}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className={accent ? 'text-blue-400' : 'text-slate-500'} />
        <span className="text-xs text-slate-400 uppercase tracking-wide font-medium">{label}</span>
      </div>
      <p className={clsx('text-xl font-bold', accent ? 'text-blue-300' : 'text-slate-100')}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Task Edit Drawer ─────────────────────────────────────────────────────────

const DISCIPLINES = [
  'Architect', 'General Contractor', 'MEP Engineer', 'IT / AV',
  'Furniture / FF&E', 'Client / Owner', 'Project Manager',
  'Legal', 'Permits / Authority', 'Commissioning', 'Other',
]

const DISCIPLINE_COLORS: Record<string, string> = {
  'Architect':            'bg-blue-900/60 text-blue-300',
  'General Contractor':   'bg-amber-900/60 text-amber-300',
  'MEP Engineer':         'bg-cyan-900/60 text-cyan-300',
  'IT / AV':              'bg-purple-900/60 text-purple-300',
  'Furniture / FF&E':     'bg-pink-900/60 text-pink-300',
  'Client / Owner':       'bg-emerald-900/60 text-emerald-300',
  'Project Manager':      'bg-slate-700 text-slate-300',
  'Legal':                'bg-red-900/60 text-red-300',
  'Permits / Authority':  'bg-orange-900/60 text-orange-300',
}

function disciplineColor(d: string) {
  return DISCIPLINE_COLORS[d] ?? 'bg-slate-700 text-slate-400'
}

function TaskEditDrawer({ task, onClose }: { task: Task; onClose: () => void }) {
  const [status, setStatus] = useState<TaskStatus>(task.status as TaskStatus)
  const [assignedTo, setAssignedTo] = useState(task.assignedTo || '')
  const [dueDate, setDueDate] = useState(task.dueDate || '')
  const [notes, setNotes] = useState(task.notes || '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    await updateDoc(doc(db, 'tasks', task.id), {
      status, assignedTo, dueDate, notes,
      updatedAt: new Date().toISOString(),
    })
    setSaving(false)
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-slate-900 border-l border-slate-700 z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-4 border-b border-slate-700">
          <p className="text-slate-200 font-medium text-sm leading-snug">{task.title}</p>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 shrink-0 mt-0.5">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Status */}
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wide font-medium block mb-1.5">Status</label>
            <div className="grid grid-cols-2 gap-1.5">
              {TASK_STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={clsx(
                    'px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left',
                    status === s ? TASK_STATUS_COLORS[s] + ' ring-1 ring-inset ring-current' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  )}
                >
                  {TASK_STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Discipline */}
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wide font-medium block mb-1.5">Discipline / Responsible Party</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {DISCIPLINES.map(d => (
                <button
                  key={d}
                  onClick={() => setAssignedTo(assignedTo === d ? '' : d)}
                  className={clsx(
                    'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border',
                    assignedTo === d
                      ? disciplineColor(d) + ' border-current'
                      : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-slate-300'
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
            <input
              value={assignedTo}
              onChange={e => setAssignedTo(e.target.value)}
              placeholder="Or type a custom discipline..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Due Date */}
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wide font-medium block mb-1.5">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wide font-medium block mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add context, links, or instructions..."
              rows={4}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {/* Category / Phase (read-only info) */}
          <div className="bg-slate-800 rounded-lg p-3 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Category</span>
              <span className="text-slate-300">{task.category}</span>
            </div>
            {task.phase && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Phase</span>
                <span className="text-slate-300">{task.phase}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm text-slate-400 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 py-2 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-60 transition-colors font-medium"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Task Row ─────────────────────────────────────────────────────────────────

function TaskRow({ task }: { task: Task }) {
  const [showDrawer, setShowDrawer] = useState(false)

  const cycleStatus = async () => {
    const order: TaskStatus[] = ['not-started', 'in-progress', 'complete', 'n-a']
    const curr = order.indexOf(task.status as TaskStatus)
    const next = order[(curr + 1) % order.length]
    await updateDoc(doc(db, 'tasks', task.id), { status: next, updatedAt: new Date().toISOString() })
  }

  const isOverdue = task.dueDate && task.status !== 'complete' && task.status !== 'n-a'
    && new Date(task.dueDate) < new Date()
  const isDueSoon = task.dueDate && task.status !== 'complete' && task.status !== 'n-a'
    && !isOverdue
    && new Date(task.dueDate) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  return (
    <>
      <div className={clsx('border-b border-slate-700/50 last:border-0', isOverdue && 'bg-red-950/20')}>
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Status toggle */}
          <button
            onClick={cycleStatus}
            className={clsx(
              'shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
              task.status === 'complete'
                ? 'bg-emerald-500 border-emerald-500'
                : task.status === 'in-progress'
                ? 'border-blue-500 bg-blue-500/20'
                : 'border-slate-600 bg-transparent hover:border-slate-400'
            )}
          >
            {task.status === 'complete' && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>

          {/* Title + meta — click to open drawer */}
          <button className="flex-1 min-w-0 text-left" onClick={() => setShowDrawer(true)}>
            <p className={clsx(
              'text-sm leading-snug',
              task.status === 'complete' ? 'line-through text-slate-500' : 'text-slate-200 hover:text-white'
            )}>
              {task.title}
            </p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {task.dueDate && (
                <span className={clsx('flex items-center gap-0.5 text-xs', isOverdue ? 'text-red-400' : isDueSoon ? 'text-amber-400' : 'text-slate-500')}>
                  {isOverdue ? <AlertCircle size={10} /> : <Clock size={10} />}
                  {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {isOverdue && ' overdue'}
                </span>
              )}
            </div>
          </button>

          {/* Discipline badge */}
          {task.assignedTo && (
            <span className={clsx('shrink-0 text-xs px-2 py-0.5 rounded font-medium hidden sm:inline-flex', disciplineColor(task.assignedTo))}>
              {task.assignedTo}
            </span>
          )}

          {/* Status badge */}
          <span className={clsx('shrink-0 text-xs px-2 py-0.5 rounded font-medium hidden md:inline-flex', TASK_STATUS_COLORS[task.status as TaskStatus])}>
            {TASK_STATUS_LABELS[task.status as TaskStatus]}
          </span>
        </div>
      </div>

      {showDrawer && <TaskEditDrawer task={task} onClose={() => setShowDrawer(false)} />}
    </>
  )
}

function TaskGroup({ category, tasks }: { category: string; tasks: Task[] }) {
  const [collapsed, setCollapsed] = useState(true)
  const done = tasks.filter(t => t.status === 'complete').length
  const pct = Math.round((done / tasks.length) * 100)

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden mb-3">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-750 transition-colors"
      >
        <div className="flex items-center gap-3">
          {collapsed ? <ChevronRight size={15} className="text-slate-500" /> : <ChevronDown size={15} className="text-slate-500" />}
          <span className="text-slate-100 font-medium text-sm">{category}</span>
          <span className="text-xs text-slate-500">{done}/{tasks.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs text-slate-500 w-8 text-right">{pct}%</span>
        </div>
      </button>
      {!collapsed && (
        <div className="border-t border-slate-700">
          {tasks.map(t => <TaskRow key={t.id} task={t} />)}
        </div>
      )}
    </div>
  )
}

// ─── Health Scorecard ─────────────────────────────────────────────────────────

function ScoreBar({ label, score, max, detail }: { label: string; score: number; max: number; detail: string }) {
  const pct = Math.round((score / max) * 100)
  const barColor = pct >= 80 ? 'bg-emerald-500' : pct >= 55 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-slate-500">{detail}</span>
          <span className="text-slate-300 font-medium tabular-nums">{score}/{max}</span>
        </div>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={clsx('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function HealthScorecard({ project }: { project: Project }) {
  const h = computeHealth(project)
  const ringColor = h.total >= 80 ? 'text-emerald-400' : h.total >= 60 ? 'text-amber-400' : 'text-red-400'
  const ringBg   = h.total >= 80 ? 'border-emerald-500' : h.total >= 60 ? 'border-amber-500' : 'border-red-500'

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <div className="flex items-center gap-4">
        {/* Score ring */}
        <div className={clsx('shrink-0 w-16 h-16 rounded-full border-4 flex flex-col items-center justify-center', ringBg)}>
          <span className={clsx('text-xl font-bold leading-none', ringColor)}>{h.total}</span>
          <span className="text-xs text-slate-500 leading-none mt-0.5">/ 100</span>
        </div>

        {/* Label + breakdown */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <p className={clsx('text-sm font-semibold', ringColor)}>{h.label}</p>
            <span className="text-xs text-slate-500 uppercase tracking-wide font-medium">Project Health</span>
          </div>
          <div className="space-y-2">
            <ScoreBar label="Budget"   score={h.budget}   max={40} detail={h.budgetLabel} />
            <ScoreBar label="Schedule" score={h.schedule} max={35} detail={h.scheduleLabel} />
            <ScoreBar label="Stage"    score={h.stage}    max={25} detail={h.stageLabel} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
type Tab = 'overview' | 'checklist' | 'budget' | 'cos' | 'raid' | 'rfis' | 'submittals' | 'team' | 'docs' | 'ai'

// ─── Main page ────────────────────────────────────────────────────────────────
export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { project, loading: projLoading } = useProject(id)
  const { tasks, loading: tasksLoading } = useTasks(id)
  const { team } = useProjectTeam(id)
  const { items: budgetItems } = useBudgetItems(id)
  const [tab, setTab] = useState<Tab>('overview')
  const [disciplineFilter, setDisciplineFilter] = useState<string>('all')
  const [subdivisionFilter, setSubdivisionFilter] = useState<string>('all')
  const [showEdit, setShowEdit] = useState(false)

  if (projLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-20 text-slate-500">
        <p>Project not found.</p>
        <button onClick={() => navigate('/projects')} className="text-blue-400 text-sm mt-2">← Back to Projects</button>
      </div>
    )
  }

  const currentStage = STATUS_STAGE_MAP[project.status] ?? 0
  const budgetUsed = project.totalBudget > 0 ? (project.actualCost / project.totalBudget) * 100 : 0
  const budgetVariance = project.totalBudget - project.forecastCost

  // Discipline options from actual task data
  const disciplines = Array.from(new Set(tasks.map(t => t.assignedTo).filter(Boolean))) as string[]
  const subdivisions = Array.from(new Set(tasks.map(t => t.category).filter(Boolean))) as string[]

  // Group tasks by category
  const filteredTasks = tasks.filter(t => {
    const matchDiscipline = disciplineFilter === 'all' || t.assignedTo === disciplineFilter
    const matchSubdivision = subdivisionFilter === 'all' || t.category === subdivisionFilter
    return matchDiscipline && matchSubdivision
  })
  const grouped = filteredTasks.reduce<Record<string, Task[]>>((acc, t) => {
    const cat = t.category || 'General'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(t)
    return acc
  }, {})

  const totalDone = tasks.filter(t => t.status === 'complete').length
  const totalPct = tasks.length > 0 ? Math.round((totalDone / tasks.length) * 100) : 0

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'checklist', label: `Checklist (${totalDone}/${tasks.length})` },
    { id: 'budget', label: 'Budget' },
    { id: 'cos', label: 'Change Orders' },
    { id: 'rfis', label: 'RFIs' },
    { id: 'submittals', label: 'Submittals' },
    { id: 'raid', label: 'RAID' },
    { id: 'team', label: 'Team' },
    { id: 'docs', label: 'Docs' },
    { id: 'ai', label: '✦ AI' },
  ]

  return (
    <div className="space-y-4 max-w-5xl mx-auto">

      {/* Back + header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => navigate(-1)}
          className="mt-1 p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-xl md:text-2xl font-bold text-slate-100 truncate">{project.projectName}</h1>
            <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded font-medium">{project.profile}</span>
            <StatusPill status={project.status} />
            <div className="ml-auto flex items-center gap-2 shrink-0">
              <button
                onClick={() => exportProjectPdf(project, tasks, budgetItems)}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3 py-1.5 rounded-lg transition-colors"
                title="Export PDF report"
              >
                <FileDown size={13} /> <span className="hidden sm:inline">Export</span>
              </button>
              <button
                onClick={() => setShowEdit(true)}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Pencil size={13} /> Edit
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400 text-sm">
            <MapPin size={13} />
            <span>{[project.address, project.city, project.state].filter(Boolean).join(', ')}</span>
          </div>
        </div>
      </div>

      {/* Stage gate progress */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-3">Project Stage</p>
        <div className="flex items-center gap-0">
          {STAGES.map((stage, i) => (
            <div key={stage} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center flex-1">
                <div className={clsx(
                  'w-3 h-3 rounded-full border-2 transition-all',
                  i < currentStage ? 'bg-emerald-500 border-emerald-500' :
                  i === currentStage ? 'bg-blue-500 border-blue-500 ring-2 ring-blue-500/30' :
                  'bg-slate-700 border-slate-600'
                )} />
                <span className={clsx(
                  'text-xs mt-1.5 text-center leading-tight hidden sm:block',
                  i === currentStage ? 'text-blue-400 font-medium' : 'text-slate-500'
                )}>
                  {stage}
                </span>
              </div>
              {i < STAGES.length - 1 && (
                <div className={clsx('h-0.5 flex-1 mx-1', i < currentStage ? 'bg-emerald-500' : 'bg-slate-700')} />
              )}
            </div>
          ))}
        </div>
        {/* Mobile: show current stage text */}
        <p className="sm:hidden text-center text-blue-400 font-medium text-sm mt-2">{STAGES[currentStage]}</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Budget" value={fmt(project.totalBudget)} icon={DollarSign} accent />
        <StatCard
          label="Variance"
          value={fmt(Math.abs(budgetVariance))}
          sub={budgetVariance >= 0 ? 'Under budget' : 'Over budget'}
          icon={TrendingUp}
        />
        <StatCard
          label="Checklist"
          value={`${totalPct}%`}
          sub={`${totalDone} of ${tasks.length} done`}
          icon={CheckSquare}
        />
        <StatCard
          label="Target Completion"
          value={project.targetCompletionDate ? new Date(project.targetCompletionDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}
          sub={project.rsf ? `${project.rsf.toLocaleString()} RSF` : undefined}
          icon={Calendar}
        />
      </div>

      {/* Budget bar */}
      {project.totalBudget > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="flex justify-between text-xs text-slate-400 mb-2">
            <span>Budget Spent</span>
            <span>{fmt(project.actualCost)} / {fmt(project.totalBudget)}</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={clsx('h-full rounded-full transition-all', budgetUsed > 90 ? 'bg-red-500' : budgetUsed > 70 ? 'bg-amber-500' : 'bg-emerald-500')}
              style={{ width: `${Math.min(100, budgetUsed)}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">{Math.round(budgetUsed)}% of budget utilized</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/50 p-1 rounded-xl border border-slate-700 overflow-x-auto scrollbar-none">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              'shrink-0 py-2 px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap',
              tab === t.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="space-y-4">
        {/* Health scorecard */}
        <HealthScorecard project={project} />

        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
            <p className="text-slate-400 text-xs uppercase tracking-wide font-medium">Project Info</p>
            <InfoRow label="Project Number" value={project.projectNumber || '—'} />
            <InfoRow label="Client" value={project.clientName || '—'} />
            <InfoRow label="Business Unit" value={project.businessUnit || '—'} />
            <InfoRow label="Project Manager" value={project.projectManager || '—'} />
            <InfoRow label="Profile" value={project.profile === 'S' ? 'Standard' : project.profile === 'L' ? 'Light' : 'Enhanced'} />
            <InfoRow label="MER Required" value={project.hasMER ? 'Yes' : 'No'} />
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
            <p className="text-slate-400 text-xs uppercase tracking-wide font-medium">Schedule</p>
            <InfoRow label="Start Date" value={project.startDate || '—'} />
            <InfoRow label="Target Completion" value={project.targetCompletionDate || '—'} />
            <InfoRow label="Lease Expiration" value={project.targetCompletionDate || '—'} />
            <InfoRow label="Warranty Start" value={(project as unknown as Record<string,string>).warrantyStartDate || '—'} />
            <InfoRow label="Warranty End" value={(project as unknown as Record<string,string>).warrantyEndDate || '—'} />
            <InfoRow label="Size" value={project.rsf ? `${project.rsf.toLocaleString()} RSF` : '—'} />
          </div>
        </div>

        {/* Milestone timeline */}
        <MilestoneTimeline project={project} />
        </div>
      )}

      {tab === 'checklist' && (
        <div>
          {/* Filters row */}
          <div className="flex gap-2 mb-4">
            <select
              value={disciplineFilter}
              onChange={e => setDisciplineFilter(e.target.value)}
              className="flex-1 bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Teams</option>
              {disciplines.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <select
              value={subdivisionFilter}
              onChange={e => setSubdivisionFilter(e.target.value)}
              className="flex-1 bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Subdivisions</option>
              {subdivisions.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {tasksLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : Object.keys(grouped).length === 0 ? (
            <p className="text-center text-slate-500 py-12">No tasks found.</p>
          ) : (
            Object.entries(grouped).map(([cat, catTasks]) => (
              <TaskGroup key={cat} category={cat} tasks={catTasks} />
            ))
          )}
        </div>
      )}

      {tab === 'budget' && <BudgetTab project={project} />}

      {tab === 'cos' && <ChangeOrdersTab project={project} />}

      {tab === 'rfis' && <RfiTab project={project} />}

      {tab === 'submittals' && <SubmittalsTab project={project} />}

      {tab === 'raid' && <RaidTab project={project} />}

      {tab === 'docs' && <DocumentsTab project={project} />}

      {tab === 'ai' && <AITab project={project} tasks={tasks} />}

      {tab === 'team' && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-slate-400" />
            <p className="text-slate-400 text-xs uppercase tracking-wide font-medium">
              Project Team ({team.length})
            </p>
          </div>
          {team.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">No team members added yet.</p>
          ) : (
            <div className="space-y-3">
              {team.map((m) => (
                <div key={m.id} className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-blue-700 flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-200 text-sm font-medium">{m.name}</p>
                    <p className="text-slate-500 text-xs">{m.role} · {m.company}</p>
                  </div>
                  {m.email && (
                    <a href={`mailto:${m.email}`} className="text-blue-400 hover:text-blue-300 text-xs shrink-0 hidden sm:block">
                      {m.email}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showEdit && <EditProjectModal project={project} onClose={() => setShowEdit(false)} />}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className="text-slate-200 text-right">{value}</span>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    'pre-project': 'bg-slate-700 text-slate-300', 'initiate': 'bg-purple-900 text-purple-300',
    'planning': 'bg-blue-900 text-blue-300', 'design': 'bg-cyan-900 text-cyan-300',
    'construction': 'bg-amber-900 text-amber-300', 'handover': 'bg-orange-900 text-orange-300',
    'closeout': 'bg-emerald-900 text-emerald-300', 'defect-period': 'bg-yellow-900 text-yellow-300',
    'closed': 'bg-slate-700 text-slate-500',
  }
  return (
    <span className={clsx('px-2 py-0.5 rounded text-xs font-medium capitalize', colors[status] ?? 'bg-slate-700 text-slate-300')}>
      {status.replace('-', ' ')}
    </span>
  )
}
