import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useProject } from '@/hooks/useProject'
import { useTasks } from '@/hooks/useTasks'
import { useProjectTeam } from '@/hooks/useProjectTeam'
import { useState } from 'react'
import { clsx } from 'clsx'
import {
  ArrowLeft, MapPin, DollarSign, Users, CheckSquare,
  Calendar, TrendingUp, ChevronDown, ChevronRight, Pencil, FileDown,
  AlertCircle, Clock, ClipboardList, Plus, X,
  ClipboardCheck, FileText, BookOpen, ShieldAlert,
} from 'lucide-react'
import { doc, updateDoc, collection, writeBatch } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useMasterTasks } from '@/hooks/useMasterTasks'
import { EditProjectModal } from '@/components/EditProjectModal'
import { BudgetTab } from '@/components/BudgetTab'
import { AITab } from '@/components/AITab'
import { DocumentsTab } from '@/components/DocumentsTab'
import { RaidTab } from '@/components/RaidTab'
import { ChangeOrdersTab } from '@/components/ChangeOrdersTab'
import { RfiTab } from '@/components/RfiTab'
import { SubmittalsTab } from '@/components/SubmittalsTab'
import { BidLogTab } from '@/components/BidLogTab'
import { PunchListTab } from '@/components/PunchListTab'
import { ScheduleTab } from '@/components/ScheduleTab'
import { MeetingNotesTab } from '@/components/MeetingNotesTab'
import { TasksTab } from '@/components/TasksTab'
import { useRaidLog } from '@/hooks/useRaidLog'
import { useProjectTasks } from '@/hooks/useProjectTasks'
import { useRiskEngine } from '@/hooks/useRiskEngine'
import { useBudgetItems } from '@/hooks/useBudgetItems'
import { useChangeOrders } from '@/hooks/useChangeOrders'
import { useProjectDocuments } from '@/hooks/useProjectDocuments'
import { useRfis } from '@/hooks/useRfis'
import { usePunchList } from '@/hooks/usePunchList'
import { AIInsightsPanel } from '@/components/AIInsightsPanel'
import { computeHealth } from '@/lib/healthScore'
import { MilestoneTimeline } from '@/components/MilestoneTimeline'
import { useMilestones } from '@/hooks/useMilestones'
import { useScheduleItems } from '@/hooks/useScheduleItems'
import { exportProjectPdf } from '@/lib/exportPdf'
import type { Task, Project } from '@/types'

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

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, accent = false }: {
  label: string; value: string; sub?: string; icon: React.ElementType; accent?: boolean
}) {
  return (
    <div className={clsx('rounded-xl p-4 border', accent ? 'bg-blue-900/30 border-blue-700' : 'bg-slate-900 border-slate-800')}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className={accent ? 'text-blue-400' : 'text-slate-400'} />
        <span className="text-xs text-slate-400 uppercase tracking-wide font-medium">{label}</span>
      </div>
      <p className={clsx('text-xl font-bold', accent ? 'text-blue-300' : 'text-slate-100')}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

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

// ─── Task Row ─────────────────────────────────────────────────────────────────

function TaskRow({ task }: { task: Task }) {
  const [expanded, setExpanded] = useState(false)

  const toggleComplete = async () => {
    const next = task.status === 'complete' ? 'not-started' : 'complete'
    await updateDoc(doc(db, 'tasks', task.id), { status: next, updatedAt: new Date().toISOString() })
  }

  const isOverdue = task.dueDate && task.status !== 'complete' && task.status !== 'n-a'
    && new Date(task.dueDate) < new Date()
  const isDueSoon = task.dueDate && task.status !== 'complete' && task.status !== 'n-a'
    && !isOverdue
    && new Date(task.dueDate) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  return (
    <div className={clsx('border-b border-slate-800/50 last:border-0', isOverdue && 'bg-red-950/20')}>
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Checkbox */}
        <button
          onClick={toggleComplete}
          className={clsx(
            'shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
            task.status === 'complete'
              ? 'bg-emerald-500 border-emerald-500'
              : 'border-slate-800 bg-transparent hover:border-slate-400'
          )}
        >
          {task.status === 'complete' && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* Title — click to expand notes */}
        <button
          className="flex-1 min-w-0 text-left"
          onClick={() => task.notes ? setExpanded(!expanded) : undefined}
        >
          <p className={clsx(
            'text-sm leading-snug',
            task.status === 'complete' ? 'line-through text-slate-400' : 'text-slate-200'
          )}>
            {task.title}
          </p>
          {task.dueDate && (
            <span className={clsx('flex items-center gap-0.5 text-xs mt-0.5', isOverdue ? 'text-red-400' : isDueSoon ? 'text-amber-400' : 'text-slate-400')}>
              {isOverdue ? <AlertCircle size={10} /> : <Clock size={10} />}
              {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {isOverdue && ' overdue'}
            </span>
          )}
        </button>

        {/* Discipline badge */}
        {task.assignedTo && (
          <span className={clsx('shrink-0 text-xs px-2 py-0.5 rounded font-medium hidden sm:inline-flex', disciplineColor(task.assignedTo))}>
            {task.assignedTo}
          </span>
        )}
      </div>

      {/* Inline notes expand */}
      {expanded && task.notes && (
        <div className="px-12 pb-3">
          <p className="text-xs text-slate-400 bg-slate-900/60 rounded-lg px-3 py-2 border border-slate-800 whitespace-pre-wrap">
            {task.notes}
          </p>
        </div>
      )}
    </div>
  )
}

function TaskGroup({ category, tasks }: { category: string; tasks: Task[] }) {
  const [collapsed, setCollapsed] = useState(true)
  const done = tasks.filter(t => t.status === 'complete').length
  const pct = Math.round((done / tasks.length) * 100)

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mb-3">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-750 transition-colors"
      >
        <div className="flex items-center gap-3">
          {collapsed ? <ChevronRight size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
          <span className="text-slate-100 font-medium text-sm">{category}</span>
          <span className="text-xs text-slate-400">{done}/{tasks.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs text-slate-400 w-8 text-right">{pct}%</span>
        </div>
      </button>
      {!collapsed && (
        <div className="border-t border-slate-800">
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
          <span className="text-slate-400">{detail}</span>
          <span className="text-slate-300 font-medium tabular-nums">{score}/{max}</span>
        </div>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={clsx('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function HealthScorecard({ project, taskCompletionPct, raidItems, milestoneItems }: {
  project: Project
  taskCompletionPct?: number
  raidItems?: import('@/hooks/useRaidLog').RaidItem[]
  milestoneItems?: import('@/hooks/useScheduleItems').ScheduleItem[]
}) {
  const milestones = (milestoneItems ?? []).map(i => ({
    targetDate: i.endDate || i.baselineEnd || '',
    status: i.percentComplete === 100 ? 'complete' : (i.endDate && new Date(i.endDate) < new Date() ? 'delayed' : 'pending'),
  }))
  const h = computeHealth(project, { taskCompletionPct, raidItems, milestones })
  const ringColor = h.total >= 80 ? 'text-emerald-400' : h.total >= 60 ? 'text-amber-400' : 'text-red-400'
  const ringBg   = h.total >= 80 ? 'border-emerald-500' : h.total >= 60 ? 'border-amber-500' : 'border-red-500'

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center gap-4">
        {/* Score ring */}
        <div className={clsx('shrink-0 w-16 h-16 rounded-full border-4 flex flex-col items-center justify-center', ringBg)}>
          <span className={clsx('text-xl font-bold leading-none', ringColor)}>{h.total}</span>
          <span className="text-xs text-slate-400 leading-none mt-0.5">/ 100</span>
        </div>

        {/* Label + breakdown */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <p className={clsx('text-sm font-semibold', ringColor)}>{h.label}</p>
            <span className="text-xs text-slate-400 uppercase tracking-wide font-medium">Project Health</span>
          </div>
          <div className="space-y-2">
            <ScoreBar label="Budget"   score={h.budget}         max={30} detail={h.budgetLabel} />
            <ScoreBar label="Schedule" score={h.schedule}       max={30} detail={h.scheduleLabel} />
            <ScoreBar label="Risk"     score={h.risk}           max={20} detail={h.riskLabel} />
            <ScoreBar label="Tasks"    score={h.taskCompletion} max={20} detail={h.taskCompletionLabel} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
type Tab = 'overview' | 'checklist' | 'schedule' | 'budget' | 'cos' | 'rfis' | 'submittals' | 'bids' | 'punch' | 'raid' | 'meetings' | 'team' | 'docs' | 'tasks' | 'ai'

// ─── Main page ────────────────────────────────────────────────────────────────
export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { project, loading: projLoading } = useProject(id)
  const { tasks, loading: tasksLoading } = useTasks(id)
  const { tasks: masterTasks } = useMasterTasks()
  const { team } = useProjectTeam(id)
  const { items: budgetItems } = useBudgetItems(id)
  const { approvedTotal: coApproved, pendingTotal: coPending } = useChangeOrders(id)
  const { milestones, updateMilestone } = useMilestones(id)
  const { items: scheduleItems } = useScheduleItems(id)
  const milestoneScheduleItems = scheduleItems.filter(i => i.isMilestone)
  const { documents: recentDocs } = useProjectDocuments(id)
  const { openCount: openRfis, overdueCount: overdueRfis } = useRfis(id)
  const { openCount: openPunch } = usePunchList(id)
  const { items: raidItems, loading: raidLoading, addItem: addRaidItem, updateItem: updateRaidItem } = useRaidLog(id)
  const { tasks: projectTasks } = useProjectTasks(id)

  // Risk Engine — auto-creates RAID items from project conditions
  useRiskEngine({
    project: project ?? null,
    projectTasks,
    milestones,
    budgetItems,
    overdueRfis,
    coApproved,
    raidItems,
    addRaidItem,
    updateRaidItem,
    raidLoading,
  })
  const [tab, setTab] = useState<Tab>((searchParams.get('tab') as Tab) || 'overview')
  const [disciplineFilter, setDisciplineFilter] = useState<string>('all')
  const [subdivisionFilter, setSubdivisionFilter] = useState<string>('all')
  const [showEdit, setShowEdit] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [fabOpen, setFabOpen] = useState(false)
  const [fabTaskForm, setFabTaskForm] = useState(false)

  // Seed all master tasks (first-time setup)
  const seedFromTemplate = async () => {
    if (!id || masterTasks.length === 0) return
    setSeeding(true)
    try {
      const now = new Date().toISOString()
      const batch = writeBatch(db)
      masterTasks.forEach(mt => {
        const ref = doc(collection(db, 'tasks'))
        batch.set(ref, {
          projectId: id,
          title: mt.title,
          category: mt.category,
          phase: mt.phase,
          assignedTo: mt.assignedTeam || '',
          priority: (mt.defaultPriority as Task['priority']) || 'medium',
          status: 'not-started',
          order: mt.order ?? 0,
          notes: mt.notes || '',
          isFromMasterChecklist: true,
          masterTaskId: mt.id,
          createdAt: now,
          updatedAt: now,
        })
      })
      await batch.commit()
    } finally {
      setSeeding(false)
    }
  }

  // Sync only master tasks not yet in this project (by title match)
  const existingTitles = new Set(tasks.map(t => t.title.trim().toLowerCase()))
  const missingMasterTasks = masterTasks.filter(mt => !existingTitles.has(mt.title.trim().toLowerCase()))

  const syncMissingTasks = async () => {
    if (!id || missingMasterTasks.length === 0) return
    setSeeding(true)
    try {
      const now = new Date().toISOString()
      const batch = writeBatch(db)
      missingMasterTasks.forEach(mt => {
        const ref = doc(collection(db, 'tasks'))
        batch.set(ref, {
          projectId: id,
          title: mt.title,
          category: mt.category,
          phase: mt.phase,
          assignedTo: mt.assignedTeam || '',
          priority: (mt.defaultPriority as Task['priority']) || 'medium',
          status: 'not-started',
          order: mt.order ?? 0,
          notes: mt.notes || '',
          isFromMasterChecklist: true,
          masterTaskId: mt.id,
          createdAt: now,
          updatedAt: now,
        })
      })
      await batch.commit()
    } finally {
      setSeeding(false)
    }
  }

  if (projLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-20 text-slate-400">
        <p>Project not found.</p>
        <button onClick={() => navigate('/projects')} className="text-blue-400 text-sm mt-2">← Back to Projects</button>
      </div>
    )
  }

  const currentStage = STATUS_STAGE_MAP[project.status] ?? 0
  const budgetUsed = project.totalBudget > 0 ? (project.actualCost / project.totalBudget) * 100 : 0
  const budgetVariance = project.totalBudget - project.forecastCost

  // Discipline options from actual task data (teams)
  const disciplines = Array.from(new Set(tasks.map(t => t.assignedTo).filter(Boolean))) as string[]
  const subdivisions = Array.from(new Set(tasks.map(t => t.category).filter(Boolean))) as string[]

  // Group tasks by team (assignedTo)
  const filteredTasks = tasks.filter(t => {
    const matchDiscipline = disciplineFilter === 'all' || t.assignedTo === disciplineFilter
    const matchSubdivision = subdivisionFilter === 'all' || t.category === subdivisionFilter
    return matchDiscipline && matchSubdivision
  })
  const grouped = filteredTasks.reduce<Record<string, Task[]>>((acc, t) => {
    const team = t.assignedTo || 'Unassigned'
    if (!acc[team]) acc[team] = []
    acc[team].push(t)
    return acc
  }, {})
  // Sort each category: incomplete first, complete last
  Object.values(grouped).forEach(arr =>
    arr.sort((a, b) => {
      const aComplete = a.status === 'complete' ? 1 : 0
      const bComplete = b.status === 'complete' ? 1 : 0
      return aComplete - bComplete
    })
  )

  const totalDone = tasks.filter(t => t.status === 'complete').length
  const totalPct = tasks.length > 0 ? Math.round((totalDone / tasks.length) * 100) : 0

  const today0 = new Date(); today0.setHours(0, 0, 0, 0)
  const overdueTaskCount = projectTasks.filter(
    t => t.status === 'open' && t.dueDate && new Date(t.dueDate) < today0
  ).length

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'checklist', label: `Checklist (${totalDone}/${tasks.length})` },
    { id: 'tasks', label: 'Tasks' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'budget', label: 'Budget' },
    { id: 'cos', label: 'Change Orders' },
    { id: 'rfis', label: 'RFIs' },
    { id: 'submittals', label: 'Submittals' },
    { id: 'bids', label: 'Bid Log' },
    { id: 'punch', label: 'Punch List' },
    { id: 'raid', label: 'RAID' },
    { id: 'meetings', label: 'Meetings' },
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
          className="mt-1 p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-lg transition-colors shrink-0"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-xl md:text-2xl font-bold text-slate-100 truncate">{project.projectName}</h1>
            <div className="ml-auto flex items-center gap-2 shrink-0">
              <button
                onClick={() => exportProjectPdf(project, tasks, budgetItems, {
                  milestones,
                  approvedCOs: coApproved,
                  pendingCOs: coPending,
                  openRfis,
                  overdueRfis,
                  taskCompletionPct: totalPct,
                })}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-900 hover:bg-slate-700 border border-slate-800 px-3 py-1.5 rounded-lg transition-colors"
                title="Export PDF report"
              >
                <FileDown size={13} /> <span className="hidden sm:inline">Export</span>
              </button>
              <button
                onClick={() => setShowEdit(true)}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-900 hover:bg-slate-700 border border-slate-800 px-3 py-1.5 rounded-lg transition-colors"
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
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-3">Project Stage</p>
        <div className="flex items-center gap-0">
          {STAGES.map((stage, i) => (
            <div key={stage} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center flex-1">
                <div className={clsx(
                  'w-3 h-3 rounded-full border-2 transition-all',
                  i < currentStage ? 'bg-emerald-500 border-emerald-500' :
                  i === currentStage ? 'bg-blue-500 border-blue-500 ring-2 ring-blue-500/30' :
                  'bg-slate-700 border-slate-800'
                )} />
                <span className={clsx(
                  'text-xs mt-1.5 text-center leading-tight hidden sm:block',
                  i === currentStage ? 'text-blue-400 font-medium' : 'text-slate-400'
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
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex justify-between text-sm text-slate-400 mb-2">
            <span>Budget Spent</span>
            <span>{fmt(project.actualCost)} / {fmt(project.totalBudget)}</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={clsx('h-full rounded-full transition-all', budgetUsed > 90 ? 'bg-red-500' : budgetUsed > 70 ? 'bg-amber-500' : 'bg-emerald-500')}
              style={{ width: `${Math.min(100, budgetUsed)}%` }}
            />
          </div>
          <p className="text-sm text-slate-400 mt-1">{Math.round(budgetUsed)}% of budget utilized</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900/50 p-1 rounded-xl border border-slate-800 overflow-x-auto scrollbar-none">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              'shrink-0 py-2 px-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1.5',
              tab === t.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            )}
          >
            {t.id === 'tasks' && overdueTaskCount > 0 ? (
              <>Tasks <span className={clsx('text-[9px] px-1.5 py-0.5 rounded-full font-bold', tab === t.id ? 'bg-white/20 text-white' : 'bg-red-500 text-white')}>{overdueTaskCount}</span></>
            ) : t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="space-y-4">

        {/* ── War Room: Attention Required ─────────────────────────────── */}
        {(() => {
          const today = new Date(); today.setHours(0, 0, 0, 0)
          const netBudgetWR = (project.totalBudget || 0) + coApproved
          const overdueProjectTasks = projectTasks.filter(
            t => t.status === 'open' && t.dueDate && new Date(t.dueDate) < today
          )
          const missedMilestones = milestones.filter(
            m => m.status !== 'complete' && m.targetDate && new Date(m.targetDate) < today
          )
          const highRaid = raidItems.filter(
            i => i.priority === 'high' && (i.status === 'open' || i.status === 'in-progress')
          )
          const budgetOverrun = netBudgetWR > 0 && (project.forecastCost || 0) > netBudgetWR
          const overrunAmt = budgetOverrun ? (project.forecastCost || 0) - netBudgetWR : 0

          type AlertLevel = 'red' | 'amber'
          const alerts: { level: AlertLevel; title: string; desc: string; tab: string }[] = []

          if (budgetOverrun) alerts.push({
            level: 'red', tab: 'budget',
            title: 'Budget Overrun',
            desc: `Forecast exceeds net budget by ${fmt(overrunAmt)}`,
          })
          if (missedMilestones.length > 0) alerts.push({
            level: 'red', tab: 'schedule',
            title: `${missedMilestones.length} Missed Milestone${missedMilestones.length > 1 ? 's' : ''}`,
            desc: missedMilestones.slice(0, 2).map(m => m.name).join(', '),
          })
          if (highRaid.length > 0) alerts.push({
            level: 'red', tab: 'raid',
            title: `${highRaid.length} High-Priority Risk${highRaid.length > 1 ? 's' : ''}`,
            desc: highRaid[0].title,
          })
          if (overdueProjectTasks.length > 0) alerts.push({
            level: 'amber', tab: 'tasks',
            title: `${overdueProjectTasks.length} Overdue Task${overdueProjectTasks.length > 1 ? 's' : ''}`,
            desc: overdueProjectTasks.slice(0, 2).map(t => t.title).join(', '),
          })
          if (overdueRfis > 0) alerts.push({
            level: 'amber', tab: 'rfis',
            title: `${overdueRfis} Overdue RFI${overdueRfis > 1 ? 's' : ''}`,
            desc: 'Awaiting response past due date',
          })
          if (coPending > 0) alerts.push({
            level: 'amber', tab: 'cos',
            title: 'Pending Change Orders',
            desc: `${fmt(coPending)} awaiting approval`,
          })

          if (alerts.length === 0) return (
            <div className="flex items-center gap-3 bg-emerald-900/20 border border-emerald-700/30 rounded-xl px-4 py-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <p className="text-sm text-emerald-300 font-medium">All clear — no critical alerts on this project.</p>
            </div>
          )

          return (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <AlertCircle size={15} className="text-red-400" />
                  <p className="text-sm font-semibold text-slate-100">Attention Required</p>
                  <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full font-medium">
                    {alerts.length}
                  </span>
                </div>
              </div>
              <div className="divide-y divide-slate-700/50">
                {alerts.map((a, i) => (
                  <button
                    key={i}
                    onClick={() => setTab(a.tab as Tab)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700/30 transition-colors text-left"
                  >
                    <span className={clsx(
                      'w-2 h-2 rounded-full shrink-0',
                      a.level === 'red' ? 'bg-red-500' : 'bg-amber-500',
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className={clsx(
                        'text-sm font-medium',
                        a.level === 'red' ? 'text-red-300' : 'text-amber-300',
                      )}>
                        {a.title}
                      </p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{a.desc}</p>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">→</span>
                  </button>
                ))}
              </div>
            </div>
          )
        })()}

        {/* ── 6 Financial Metric Tiles ─────────────────────────────────── */}
        {(() => {
          const extItems = budgetItems as (typeof budgetItems[0] & { contractAmount?: number; paidAmount?: number })[]
          const totalContracted = extItems.reduce((s, i) => s + (i.contractAmount ?? i.committedAmount ?? 0), 0)
          const totalPaidFromItems = extItems.reduce((s, i) => s + (i.paidAmount ?? 0), 0)
          const netBudgetOv = (project.totalBudget || 0) + coApproved
          const forecastVariance = netBudgetOv - (project.forecastCost || 0)
          const tiles = [
            {
              label: 'Baseline Budget',
              value: fmt(project.totalBudget || 0),
              color: 'text-blue-300',
              sub: 'Original approved budget',
            },
            {
              label: 'Committed (Contract)',
              value: totalContracted > 0 ? fmt(totalContracted) : '—',
              color: 'text-slate-200',
              sub: 'Sum of contract amounts',
            },
            {
              label: 'Total Forecast',
              value: fmt(project.forecastCost || 0),
              color: (project.forecastCost || 0) > netBudgetOv ? 'text-red-400' : 'text-emerald-400',
              sub: (project.forecastCost || 0) > netBudgetOv ? 'Over net budget' : 'Within net budget',
            },
            {
              label: 'Actual Spent',
              value: totalPaidFromItems > 0 ? fmt(totalPaidFromItems) : fmt(project.actualCost || 0),
              color: 'text-slate-200',
              sub: 'Paid to date',
            },
            {
              label: 'Budget Variance',
              value: forecastVariance >= 0 ? fmt(forecastVariance) : `(${fmt(Math.abs(forecastVariance))})`,
              color: forecastVariance >= 0 ? 'text-emerald-400' : 'text-red-400',
              sub: forecastVariance >= 0 ? 'Under forecast' : 'Over forecast',
            },
            {
              label: 'CO Exposure',
              value: coPending > 0 ? fmt(coPending) : '—',
              color: coPending > 0 ? 'text-amber-300' : 'text-slate-400',
              sub: coPending > 0 ? 'Pending approval' : 'No pending COs',
            },
          ]
          return (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {tiles.map(t => (
                <div key={t.label} className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                  <p className="text-xs text-slate-400 mb-1">{t.label}</p>
                  <p className={clsx('text-lg font-bold tabular-nums', t.color)}>{t.value}</p>
                  {t.sub && <p className="text-xs text-slate-400 mt-0.5">{t.sub}</p>}
                </div>
              ))}
            </div>
          )
        })()}

        {/* Health scorecard */}
        <HealthScorecard project={project} taskCompletionPct={totalPct} raidItems={raidItems} milestoneItems={milestoneScheduleItems} />

        {/* ── RAID Risk Widget ──────────────────────────────────────────── */}
        {(() => {
          const openRaid = raidItems.filter(i => i.status === 'open' || i.status === 'in-progress')
          const highCount = openRaid.filter(i => i.priority === 'high').length
          const medCount  = openRaid.filter(i => i.priority === 'medium').length
          const lowCount  = openRaid.filter(i => i.priority === 'low').length
          const totalCostExposure = openRaid.reduce((s, i) => s + (i.costImpact ?? 0), 0)
          const totalScheduleExposure = openRaid.reduce((s, i) => s + (i.scheduleImpact ?? 0), 0)
          const fmt$ = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

          if (openRaid.length === 0 && !raidLoading) {
            return (
              <button
                onClick={() => setTab('raid')}
                className="w-full flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-800 transition-colors text-left"
              >
                <ShieldAlert size={16} className="text-slate-400 shrink-0" />
                <div>
                  <p className="text-sm text-slate-400">No open risks</p>
                  <p className="text-xs text-slate-400 mt-0.5">All RAID items resolved. Go to RAID tab to add items.</p>
                </div>
              </button>
            )
          }

          return (
            <button
              onClick={() => setTab('raid')}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-800 transition-colors text-left"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={15} className={highCount > 0 ? 'text-red-400' : medCount > 0 ? 'text-amber-400' : 'text-slate-400'} />
                  <span className="text-sm font-semibold text-slate-100">Open Risks &amp; Issues</span>
                  <span className="text-xs text-slate-400">{openRaid.length} open</span>
                </div>
                <span className="text-xs text-blue-400">View RAID →</span>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {highCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-sm font-bold text-red-400">{highCount}</span>
                    <span className="text-xs text-slate-400">High</span>
                  </div>
                )}
                {medCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-sm font-bold text-amber-400">{medCount}</span>
                    <span className="text-xs text-slate-400">Medium</span>
                  </div>
                )}
                {lowCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-500" />
                    <span className="text-sm font-bold text-slate-400">{lowCount}</span>
                    <span className="text-xs text-slate-400">Low</span>
                  </div>
                )}
                {(totalCostExposure > 0 || totalScheduleExposure > 0) && (
                  <div className="ml-auto flex items-center gap-3 text-xs text-slate-400">
                    {totalCostExposure > 0 && (
                      <span className="text-amber-400 font-medium">{fmt$(totalCostExposure)} exposure</span>
                    )}
                    {totalScheduleExposure > 0 && (
                      <span className="text-blue-400 font-medium">{totalScheduleExposure}d schedule risk</span>
                    )}
                  </div>
                )}
              </div>

              {/* Mini list: top 3 high-priority items */}
              {highCount > 0 && (
                <div className="mt-3 space-y-1.5 border-t border-slate-800/50 pt-3">
                  {openRaid.filter(i => i.priority === 'high').slice(0, 3).map(i => (
                    <div key={i.id} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                      <span className="text-xs text-slate-300 truncate">{i.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </button>
          )
        })()}

        {/* ── Next Milestone Countdown ──────────────────────────────────── */}
        {(() => {
          const today = new Date(); today.setHours(0, 0, 0, 0)
          const next = milestones
            .filter(m => m.status !== 'complete' && m.targetDate && new Date(m.targetDate) >= today)
            .sort((a, b) => a.targetDate.localeCompare(b.targetDate))[0]
          if (!next) return null
          const daysUntil = Math.ceil((new Date(next.targetDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          const urgency = daysUntil <= 7 ? 'red' : daysUntil <= 21 ? 'amber' : 'blue'
          return (
            <button
              onClick={() => setTab('schedule')}
              className={clsx(
                'w-full flex items-center gap-4 rounded-xl px-4 py-3 border text-left transition-colors',
                urgency === 'red'   ? 'bg-red-900/20 border-red-700/30 hover:border-red-600/50'
                : urgency === 'amber' ? 'bg-amber-900/20 border-amber-700/30 hover:border-amber-600/50'
                : 'bg-blue-900/20 border-blue-700/30 hover:border-blue-600/50',
              )}
            >
              <div className={clsx(
                'shrink-0 text-center px-3 py-2 rounded-lg',
                urgency === 'red' ? 'bg-red-900/40' : urgency === 'amber' ? 'bg-amber-900/40' : 'bg-blue-900/40',
              )}>
                <p className={clsx('text-2xl font-bold leading-none tabular-nums', urgency === 'red' ? 'text-red-300' : urgency === 'amber' ? 'text-amber-300' : 'text-blue-300')}>
                  {daysUntil}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">days</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">Next Milestone</p>
                <p className="text-sm font-semibold text-slate-100 truncate">{next.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {new Date(next.targetDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <span className="text-xs text-slate-400 shrink-0">View Schedule →</span>
            </button>
          )
        })()}

        {/* ── Milestone Mini-Timeline ───────────────────────────────────── */}
        {(() => {
          const dated = milestoneScheduleItems.filter(m => m.endDate || m.baselineEnd)
          const today = new Date()
          const parseLocal = (d: string) => { const [y,mo,day] = d.split('-').map(Number); return new Date(y, mo-1, day) }
          if (dated.length === 0) {
            return (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
                <Calendar size={16} className="text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-400">No milestones flagged yet.</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Click the{' '}
                    <span className="text-purple-400">◆</span>
                    {' '}icon on any Schedule activity to mark it as a milestone.
                  </p>
                </div>
              </div>
            )
          }
          return (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800">
                <p className="text-sm font-semibold text-slate-100">Milestone Timeline</p>
              </div>
              <div className="overflow-x-auto">
                <div className="flex gap-0 px-4 py-4 min-w-max">
                  {dated.slice(0, 8).map((m, idx) => {
                    const isComplete = m.percentComplete === 100
                    const targetDate = m.endDate || m.baselineEnd
                    const tDate = parseLocal(targetDate)
                    const isNear = !isComplete && Math.abs(tDate.getTime() - today.getTime()) <= 14 * 24 * 60 * 60 * 1000
                    const dotColor = isComplete ? 'bg-emerald-500 border-emerald-400' : isNear ? 'bg-blue-500 border-blue-400' : 'bg-slate-600 border-slate-500'
                    const textColor = isComplete ? 'text-emerald-400' : isNear ? 'text-blue-300' : 'text-slate-400'
                    return (
                      <div key={m.id} className="flex items-start" style={{ minWidth: 120 }}>
                        <div className="flex flex-col items-center">
                          <div className={clsx('w-3 h-3 rounded-full border-2 shrink-0 mt-0.5', dotColor)} />
                          {idx < dated.slice(0, 8).length - 1 && (
                            <div className="w-px flex-1 bg-slate-700 mt-1 min-h-[16px]" />
                          )}
                        </div>
                        <div className="ml-2 pb-4">
                          <p className={clsx('text-xs font-medium leading-tight', textColor)}>{m.name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {tDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                        {idx < dated.slice(0, 8).length - 1 && <div className="flex-1 h-px bg-slate-700 mt-1.5 min-w-[16px]" />}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })()}

        {/* AI Insights */}
        <div className="bg-slate-900/60 border border-slate-800/50 rounded-xl p-4">
          <AIInsightsPanel
            input={{
              project,
              taskCount: tasks.length,
              completedTaskCount: totalDone,
              blockedTaskCount: tasks.filter(t => t.status === 'blocked').length,
              openRfiCount: openRfis,
              overdueRfiCount: overdueRfis,
              approvedCOs: coApproved,
              pendingCOs: coPending,
              openPunchCount: openPunch,
            }}
            maxShow={4}
          />
        </div>

        {/* ── Recent Activity Feed ──────────────────────────────────────── */}
        {(() => {
          type ActivityEntry = {
            id: string
            kind: 'task' | 'risk' | 'milestone'
            title: string
            sub: string
            updatedAt: string
            tab: string
          }
          const timeAgo = (iso: string) => {
            const ms = Date.now() - new Date(iso).getTime()
            const mins = Math.floor(ms / 60000)
            if (mins < 1) return 'just now'
            if (mins < 60) return `${mins}m ago`
            const hrs = Math.floor(mins / 60)
            if (hrs < 24) return `${hrs}h ago`
            const days = Math.floor(hrs / 24)
            if (days < 30) return `${days}d ago`
            return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          }
          const entries: ActivityEntry[] = [
            ...raidItems.map(i => ({
              id: i.id, kind: 'risk' as const,
              title: i.title,
              sub: `${i.type.charAt(0).toUpperCase() + i.type.slice(1)} · ${i.status}`,
              updatedAt: i.updatedAt, tab: 'raid',
            })),
            ...projectTasks.map(t => ({
              id: t.id, kind: 'task' as const,
              title: t.title,
              sub: `Task · ${t.status === 'completed' ? 'Completed' : t.status}`,
              updatedAt: t.updatedAt, tab: 'tasks',
            })),
            ...milestones.map(m => ({
              id: m.id, kind: 'milestone' as const,
              title: m.name,
              sub: `Milestone · ${m.status}`,
              updatedAt: m.updatedAt, tab: 'schedule',
            })),
          ]
            .filter(e => e.updatedAt)
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .slice(0, 6)

          if (entries.length === 0) return null

          return (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800">
                <Clock size={14} className="text-slate-400" />
                <p className="text-sm font-semibold text-slate-200">Recent Activity</p>
              </div>
              <div className="divide-y divide-slate-700/50">
                {entries.map(e => (
                  <button
                    key={e.id}
                    onClick={() => setTab(e.tab as Tab)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700/30 transition-colors text-left"
                  >
                    {e.kind === 'risk'
                      ? <ShieldAlert size={13} className="text-red-400 shrink-0" />
                      : e.kind === 'task'
                      ? <CheckSquare size={13} className="text-blue-400 shrink-0" />
                      : <Calendar size={13} className="text-emerald-400 shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 truncate">{e.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{e.sub}</p>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0 tabular-nums">{timeAgo(e.updatedAt)}</span>
                  </button>
                ))}
              </div>
            </div>
          )
        })()}

        {/* Project info + Schedule */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <p className="text-slate-400 text-xs uppercase tracking-wide font-medium">Project Info</p>
            <InfoRow label="Project Number" value={project.projectNumber || '—'} />
            <InfoRow label="Client" value={project.clientName || '—'} />
            <InfoRow label="Business Unit" value={project.businessUnit || '—'} />
            <InfoRow label="Project Manager" value={project.projectManager || '—'} />
            <InfoRow label="Profile" value={project.profile === 'S' ? 'Standard' : project.profile === 'L' ? 'Light' : 'Enhanced'} />
            <InfoRow label="MER Required" value={project.hasMER ? 'Yes' : 'No'} />
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <p className="text-slate-400 text-xs uppercase tracking-wide font-medium">Schedule</p>
            <InfoRow label="Start Date" value={project.startDate || '—'} />
            <InfoRow label="Target Completion" value={project.targetCompletionDate || '—'} />
            <InfoRow label="Lease Expiration" value={(project as unknown as Record<string,string>).leaseExpiration || project.targetCompletionDate || '—'} />
            <InfoRow label="Warranty Start" value={(project as unknown as Record<string,string>).warrantyStartDate || '—'} />
            <InfoRow label="Warranty End" value={(project as unknown as Record<string,string>).warrantyEndDate || '—'} />
            <InfoRow label="Size" value={project.rsf ? `${project.rsf.toLocaleString()} RSF` : '—'} />
          </div>
        </div>

        {/* Milestone timeline */}
        <MilestoneTimeline project={project} />

        {/* Recent Documents */}
        {recentDocs.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <p className="text-sm font-semibold text-slate-200">Recent Documents</p>
              <button onClick={() => setTab('docs')} className="text-xs text-blue-400 hover:text-blue-300">
                View all →
              </button>
            </div>
            <div className="divide-y divide-slate-700/50">
              {recentDocs.slice(0, 5).map(doc => (
                <a key={doc.id} href={doc.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700/30 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      {doc.name.split('.').pop()?.slice(0, 3) ?? 'DOC'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">{doc.name}</p>
                    <p className="text-xs text-slate-400">{doc.category} · {new Date(doc.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
        </div>
      )}

      {tab === 'checklist' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex gap-2 flex-wrap">
            <select
              value={disciplineFilter}
              onChange={e => setDisciplineFilter(e.target.value)}
              className="flex-1 min-w-[130px] bg-slate-900 border border-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Teams</option>
              {disciplines.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <select
              value={subdivisionFilter}
              onChange={e => setSubdivisionFilter(e.target.value)}
              className="flex-1 min-w-[130px] bg-slate-900 border border-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Subdivisions</option>
              {subdivisions.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {/* Sync missing master tasks */}
            {tasks.length > 0 && missingMasterTasks.length > 0 && (
              <button
                onClick={syncMissingTasks}
                disabled={seeding}
                className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 border border-amber-700/50 hover:border-amber-600 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
                title={`Add ${missingMasterTasks.length} task(s) from master checklist not yet in this project`}
              >
                <Plus size={12} />
                {seeding ? 'Syncing…' : `Sync Missing (${missingMasterTasks.length})`}
              </button>
            )}
          </div>

          {tasksLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : tasks.length === 0 ? (
            /* ── Empty state: no tasks yet ── */
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-blue-900/40 border border-blue-700/40 flex items-center justify-center mx-auto">
                <ClipboardList size={26} className="text-blue-400" />
              </div>
              <div>
                <h3 className="text-slate-100 font-semibold mb-1">No checklist tasks yet</h3>
                <p className="text-slate-400 text-sm max-w-sm mx-auto">
                  Start from the master template — {masterTasks.length} tasks across all project phases — or add tasks manually.
                </p>
              </div>
              <div className="flex justify-center gap-3 flex-wrap">
                <button
                  onClick={seedFromTemplate}
                  disabled={seeding || masterTasks.length === 0}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  <ClipboardList size={15} />
                  {seeding ? 'Applying template…' : `Apply Master Template (${masterTasks.length} tasks)`}
                </button>
              </div>
              {masterTasks.length === 0 && (
                <p className="text-xs text-slate-400">
                  No master tasks defined yet. Go to the Checklist page to add tasks to the template first.
                </p>
              )}
            </div>
          ) : Object.keys(grouped).length === 0 ? (
            <p className="text-center text-slate-400 py-12 text-sm">No tasks match the current filter.</p>
          ) : (
            Object.entries(grouped).map(([cat, catTasks]) => (
              <TaskGroup key={cat} category={cat} tasks={catTasks} />
            ))
          )}
        </div>
      )}

      {tab === 'schedule' && <ScheduleTab project={project} />}

      {tab === 'budget' && <BudgetTab project={project} />}

      {tab === 'cos' && <ChangeOrdersTab project={project} />}

      {tab === 'rfis' && <RfiTab project={project} />}

      {tab === 'submittals' && <SubmittalsTab project={project} />}

      {tab === 'bids' && <BidLogTab project={project} />}

      {tab === 'punch' && <PunchListTab project={project} />}

      {tab === 'raid' && <RaidTab project={project} setTab={t => setTab(t as Tab)} />}

      {tab === 'meetings' && <MeetingNotesTab project={project} />}

      {tab === 'docs' && <DocumentsTab project={project} />}

      {tab === 'ai' && (
        <AITab
          project={project}
          tasks={tasks}
          raidItems={raidItems}
          projectTasks={projectTasks}
          budgetItems={budgetItems}
          milestones={milestones}
          openRfis={openRfis}
          overdueRfis={overdueRfis}
        />
      )}

      {tab === 'team' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-slate-400" />
            <p className="text-slate-400 text-xs uppercase tracking-wide font-medium">
              Project Team ({team.length})
            </p>
          </div>
          {team.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">No team members added yet.</p>
          ) : (
            <div className="space-y-3">
              {team.map((m) => (
                <div key={m.id} className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-blue-700 flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-200 text-sm font-medium">{m.name}</p>
                    <p className="text-slate-400 text-xs">{m.role} · {m.company}</p>
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

      {tab === 'tasks' && (
        <TasksTab
          project={project}
          showAddForm={fabTaskForm}
          onFormClose={() => setFabTaskForm(false)}
          milestones={milestones}
          onMilestoneComplete={id => updateMilestone(id, { status: 'complete', actualDate: new Date().toISOString().split('T')[0] })}
        />
      )}

      {showEdit && <EditProjectModal project={project} onClose={() => setShowEdit(false)} />}

      {/* ── Floating Action Button ── */}
      <div className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-50 flex flex-col items-end gap-2">
        {/* FAB menu */}
        {fabOpen && (
          <div className="flex flex-col gap-2 items-end mb-1">
            {[
              {
                label: 'Add Task',
                icon: ClipboardCheck,
                color: 'bg-blue-600 hover:bg-blue-700',
                action: () => { setTab('tasks'); setFabTaskForm(true); setFabOpen(false) },
              },
              {
                label: 'Add Document',
                icon: FileText,
                color: 'bg-slate-700 hover:bg-slate-600',
                action: () => { setTab('docs'); setFabOpen(false) },
              },
              {
                label: 'Add Meeting Note',
                icon: BookOpen,
                color: 'bg-slate-700 hover:bg-slate-600',
                action: () => { setTab('meetings'); setFabOpen(false) },
              },
            ].map(({ label, icon: Icon, color, action }) => (
              <button
                key={label}
                onClick={action}
                className={clsx('flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-white text-sm font-medium shadow-lg transition-all', color)}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Main FAB */}
        <button
          onClick={() => setFabOpen(!fabOpen)}
          className={clsx(
            'w-11 h-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-xl flex items-center justify-center transition-all duration-200',
            fabOpen && 'rotate-45'
          )}
        >
          {fabOpen ? <X size={18} /> : <Plus size={18} />}
        </button>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-slate-400 shrink-0">{label}</span>
      <span className="text-slate-200 text-right">{value}</span>
    </div>
  )
}

