import { useState } from 'react'
import { useMasterTasks } from '@/hooks/useMasterTasks'
import { collection, addDoc, doc, deleteDoc, updateDoc, getDocs, query, where, writeBatch } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Plus, Search, Trash2, ChevronDown, ChevronRight, Check, Pencil } from 'lucide-react'
import type { MasterTask } from '@/hooks/useMasterTasks'

// ─── Full-edit task row ────────────────────────────────────────────────────────
function TaskRow({
  task,
  teams,
  subdivisions,
  onDelete,
}: {
  task: MasterTask
  teams: string[]
  subdivisions: string[]
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [team, setTeam] = useState(task.assignedTeam)
  const [category, setCategory] = useState(task.category)
  const [notes, setNotes] = useState(task.notes)
  const [newTeam, setNewTeam] = useState('')
  const [newSub, setNewSub] = useState('')
  const [addingTeam, setAddingTeam] = useState(false)
  const [addingSub, setAddingSub] = useState(false)
  const [saving, setSaving] = useState(false)

  const allTeams = Array.from(new Set([...teams, team].filter(Boolean)))
  const allSubs = Array.from(new Set([...subdivisions, category].filter(Boolean)))

  const save = async () => {
    if (!title.trim()) return
    setSaving(true)
    const finalTeam = addingTeam && newTeam.trim() ? newTeam.trim() : team
    const finalCat = addingSub && newSub.trim() ? newSub.trim() : category
    await updateDoc(doc(db, 'masterTasks', task.id), {
      title: title.trim(),
      assignedTeam: finalTeam,
      category: finalCat,
      phase: finalCat,
      notes: notes.trim(),
      updatedAt: new Date().toISOString(),
    })
    setSaving(false)
    setEditing(false)
    setAddingTeam(false)
    setAddingSub(false)
  }

  const cancel = () => {
    setTitle(task.title)
    setTeam(task.assignedTeam)
    setCategory(task.category)
    setNotes(task.notes)
    setAddingTeam(false)
    setAddingSub(false)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="border-b border-slate-700/50 last:border-0 bg-slate-900/60 px-4 py-3 space-y-3">
        {/* Title */}
        <input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') cancel() }}
          placeholder="Task name *"
          className="w-full bg-slate-700 text-slate-100 text-sm rounded-lg px-3 py-2 border border-blue-500 focus:outline-none"
        />

        {/* Team + Subdivision row */}
        <div className="grid grid-cols-2 gap-2">
          {/* Team */}
          <div className="flex gap-1">
            {addingTeam ? (
              <input
                autoFocus
                value={newTeam}
                onChange={e => setNewTeam(e.target.value)}
                placeholder="New team name"
                className="flex-1 bg-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1.5 border border-blue-400 focus:outline-none"
              />
            ) : (
              <select
                value={team}
                onChange={e => setTeam(e.target.value)}
                className="flex-1 bg-slate-700 border border-slate-600 text-slate-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500"
              >
                <option value="">Select Team</option>
                {allTeams.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            <button
              onClick={() => setAddingTeam(!addingTeam)}
              title={addingTeam ? 'Use existing' : 'Add new team'}
              className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-2 text-xs"
            >
              {addingTeam ? '←' : '+'}
            </button>
          </div>

          {/* Subdivision */}
          <div className="flex gap-1">
            {addingSub ? (
              <input
                autoFocus
                value={newSub}
                onChange={e => setNewSub(e.target.value)}
                placeholder="New subdivision"
                className="flex-1 bg-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1.5 border border-blue-400 focus:outline-none"
              />
            ) : (
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="flex-1 bg-slate-700 border border-slate-600 text-slate-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500"
              >
                <option value="">Select Subdivision</option>
                {allSubs.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            <button
              onClick={() => setAddingSub(!addingSub)}
              title={addingSub ? 'Use existing' : 'Add new subdivision'}
              className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-2 text-xs"
            >
              {addingSub ? '←' : '+'}
            </button>
          </div>
        </div>

        {/* Notes */}
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          rows={2}
          className="w-full bg-slate-700 text-slate-300 text-xs rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500 resize-none"
        />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={saving || !title.trim()}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            <Check size={12} /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button onClick={cancel} className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1.5">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="border-b border-slate-700/50 last:border-0">
      <div className="flex items-center gap-2 px-4 py-2.5 hover:bg-slate-800/50 group">
        <span className="flex-1 text-slate-200 text-sm">{task.title}</span>

        <div className="flex items-center gap-2 shrink-0">
          {task.assignedTeam && (
            <span className="hidden sm:block text-xs text-slate-500 bg-slate-700/60 px-2 py-0.5 rounded-full">
              {task.assignedTeam}
            </span>
          )}
          {task.notes && (
            <span className="text-xs text-slate-600 italic hidden md:block max-w-[160px] truncate">
              {task.notes}
            </span>
          )}
          <button
            onClick={() => setEditing(true)}
            className="p-1 text-slate-600 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={() => onDelete(task.id)}
            className="p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Category group ────────────────────────────────────────────────────────────
function CategoryGroup({
  category,
  tasks,
  teams,
  subdivisions,
  onDelete,
}: {
  category: string
  tasks: MasterTask[]
  teams: string[]
  subdivisions: string[]
  onDelete: (id: string) => void
}) {
  const [collapsed, setCollapsed] = useState(true)

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden mb-3">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/80 transition-colors"
      >
        <div className="flex items-center gap-2">
          {collapsed ? <ChevronRight size={15} className="text-slate-500" /> : <ChevronDown size={15} className="text-slate-500" />}
          <span className="text-slate-100 font-medium text-sm">{category}</span>
          <span className="text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded-full">{tasks.length}</span>
        </div>
      </button>

      {!collapsed && (
        <div className="border-t border-slate-700">
          {tasks.map(t => (
            <TaskRow key={t.id} task={t} teams={teams} subdivisions={subdivisions} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Add Task Panel ────────────────────────────────────────────────────────────
function AddTaskPanel({
  teams,
  subdivisions,
  onDone,
}: {
  teams: string[]
  subdivisions: string[]
  onDone: () => void
}) {
  const [title, setTitle] = useState('')
  const [team, setTeam] = useState('')
  const [category, setCategory] = useState('')
  const [notes, setNotes] = useState('')
  const [newTeam, setNewTeam] = useState('')
  const [newSub, setNewSub] = useState('')
  const [addingTeam, setAddingTeam] = useState(false)
  const [addingSub, setAddingSub] = useState(false)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!title.trim()) return
    const finalTeam = addingTeam && newTeam.trim() ? newTeam.trim() : team
    const finalCat = addingSub && newSub.trim() ? newSub.trim() : category
    if (!finalCat) return
    setSaving(true)
    const now = new Date().toISOString()

    // 1. Add to master checklist
    const masterRef = await addDoc(collection(db, 'masterTasks'), {
      title: title.trim(),
      category: finalCat,
      phase: finalCat,
      assignedTeam: finalTeam,
      defaultPriority: 'medium',
      applicableTo: ['L', 'S', 'E'],
      order: Date.now(),
      notes: notes.trim(),
      subtasks: [],
      createdAt: now,
      updatedAt: now,
    })

    // 2. Find all projects that have been seeded from the master template
    const seededSnap = await getDocs(
      query(collection(db, 'tasks'), where('isFromMasterChecklist', '==', true))
    )
    const projectIds = [...new Set(seededSnap.docs.map(d => (d.data() as { projectId: string }).projectId))]

    // 3. Batch-write the new task into each seeded project (chunks of 400)
    if (projectIds.length > 0) {
      const chunks: string[][] = []
      for (let i = 0; i < projectIds.length; i += 400) chunks.push(projectIds.slice(i, i + 400))
      for (const chunk of chunks) {
        const batch = writeBatch(db)
        chunk.forEach(projectId => {
          const ref = doc(collection(db, 'tasks'))
          batch.set(ref, {
            projectId,
            title: title.trim(),
            category: finalCat,
            phase: finalCat,
            assignedTo: finalTeam,
            priority: 'medium',
            status: 'not-started',
            order: Date.now(),
            notes: notes.trim(),
            isFromMasterChecklist: true,
            masterTaskId: masterRef.id,
            createdAt: now,
            updatedAt: now,
          })
        })
        await batch.commit()
      }
    }

    setSaving(false)
    onDone()
  }

  const canSave = title.trim() && ((addingSub ? newSub.trim() : category))

  return (
    <div className="bg-slate-800 border border-blue-600 rounded-xl px-5 py-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-100">Add New Task</h3>

      {/* Title + Team row */}
      <div className="grid grid-cols-2 gap-3">
        <input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') onDone() }}
          placeholder="Task Name *"
          className="bg-slate-700 text-slate-100 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500 placeholder-slate-500"
        />
        <div className="flex gap-1">
          {addingTeam ? (
            <input
              autoFocus
              value={newTeam}
              onChange={e => setNewTeam(e.target.value)}
              placeholder="New team name"
              className="flex-1 bg-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 border border-blue-400 focus:outline-none placeholder-slate-500"
            />
          ) : (
            <select
              value={team}
              onChange={e => setTeam(e.target.value)}
              className="flex-1 bg-slate-700 border border-slate-600 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
            >
              <option value="">Select Team</option>
              {teams.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          <button
            onClick={() => setAddingTeam(!addingTeam)}
            title={addingTeam ? 'Use existing' : 'New team'}
            className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white rounded-lg w-9 flex items-center justify-center text-sm"
          >
            {addingTeam ? '←' : <Plus size={14} />}
          </button>
        </div>
      </div>

      {/* Subdivision + Notes row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex gap-1">
          {addingSub ? (
            <input
              autoFocus
              value={newSub}
              onChange={e => setNewSub(e.target.value)}
              placeholder="New subdivision"
              className="flex-1 bg-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 border border-blue-400 focus:outline-none placeholder-slate-500"
            />
          ) : (
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="flex-1 bg-slate-700 border border-slate-600 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
            >
              <option value="">Select Subdivision *</option>
              {subdivisions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <button
            onClick={() => setAddingSub(!addingSub)}
            title={addingSub ? 'Use existing' : 'New subdivision'}
            className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white rounded-lg w-9 flex items-center justify-center text-sm"
          >
            {addingSub ? '←' : <Plus size={14} />}
          </button>
        </div>
        <input
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          className="bg-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500 placeholder-slate-500"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={save}
          disabled={saving || !canSave}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-40 transition-colors"
        >
          <Plus size={14} /> {saving ? 'Syncing to projects...' : 'Add Task'}
        </button>
        <button onClick={onDone} className="text-sm text-slate-500 hover:text-slate-300 px-3 py-2">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export function ChecklistPage() {
  const { tasks, loading } = useMasterTasks()
  const [search, setSearch] = useState('')
  const [teamFilter, setTeamFilter] = useState('all')
  const [subdivisionFilter, setSubdivisionFilter] = useState('all')
  const [showAddTask, setShowAddTask] = useState(false)

  const teams = Array.from(new Set(tasks.map(t => t.assignedTeam).filter(Boolean)))
  const subdivisions = Array.from(new Set(tasks.map(t => t.category).filter(Boolean)))

  const filtered = tasks.filter(t => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      t.title.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      t.assignedTeam.toLowerCase().includes(q)
    const matchTeam = teamFilter === 'all' || t.assignedTeam === teamFilter
    const matchSub = subdivisionFilter === 'all' || t.category === subdivisionFilter
    return matchSearch && matchTeam && matchSub
  })

  const grouped = filtered.reduce<Record<string, MasterTask[]>>((acc, t) => {
    const cat = t.category || 'General'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(t)
    return acc
  }, {})

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this task from the master checklist?')) return
    await deleteDoc(doc(db, 'masterTasks', id))
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Master Checklist</h1>
          <p className="text-slate-400 text-sm mt-1">
            {tasks.length} tasks across {subdivisions.length} categories — seeded into every new project
          </p>
        </div>
        <button
          onClick={() => setShowAddTask(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shrink-0"
        >
          <Plus size={15} /> Add Task
        </button>
      </div>

      {/* Add task panel */}
      {showAddTask && (
        <AddTaskPanel
          teams={teams}
          subdivisions={subdivisions}
          onDone={() => setShowAddTask(false)}
        />
      )}

      {/* Search + filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tasks, categories, or teams..."
            className="w-full bg-slate-800 text-slate-200 placeholder-slate-500 text-sm rounded-xl pl-9 pr-4 py-2.5 border border-slate-700 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={teamFilter}
            onChange={e => setTeamFilter(e.target.value)}
            className="flex-1 bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Teams</option>
            {teams.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            value={subdivisionFilter}
            onChange={e => setSubdivisionFilter(e.target.value)}
            className="flex-1 bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Subdivisions</option>
            {subdivisions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Tasks', value: tasks.length },
          { label: 'Categories', value: subdivisions.length },
          { label: 'Seeded to New Projects', value: '✓ All' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800 border border-slate-700 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-slate-100">{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Task groups */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <p>No tasks found{search ? ` for "${search}"` : ''}.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([cat, catTasks]) => (
          <CategoryGroup
            key={cat}
            category={cat}
            tasks={catTasks}
            teams={teams}
            subdivisions={subdivisions}
            onDelete={handleDelete}
          />
        ))
      )}
    </div>
  )
}
