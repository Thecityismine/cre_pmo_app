import { useState } from 'react'
import { useMasterTasks } from '@/hooks/useMasterTasks'
import { collection, addDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Plus, Search, Trash2, ChevronDown, ChevronRight, X, Check } from 'lucide-react'
import type { MasterTask } from '@/hooks/useMasterTasks'

// ─── Inline edit row ──────────────────────────────────────────────────────────
function TaskRow({ task, onDelete }: { task: MasterTask; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!title.trim()) return
    setSaving(true)
    await updateDoc(doc(db, 'masterTasks', task.id), {
      title: title.trim(),
      notes: notes.trim(),
      updatedAt: new Date().toISOString(),
    })
    setSaving(false)
    setEditing(false)
  }

  return (
    <div className="border-b border-slate-700/50 last:border-0">
      <div className="flex items-center gap-2 px-4 py-2.5 hover:bg-slate-800/50 group">
        <button onClick={() => setExpanded(!expanded)} className="text-slate-600 shrink-0">
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>

        {editing ? (
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
            className="flex-1 bg-slate-700 text-slate-100 text-sm rounded px-2 py-1 border border-blue-500 focus:outline-none"
          />
        ) : (
          <span
            className="flex-1 text-slate-200 text-sm cursor-pointer hover:text-white"
            onClick={() => setEditing(true)}
          >
            {task.title}
          </span>
        )}

        <div className="flex items-center gap-2 shrink-0">
          {task.assignedTeam && (
            <span className="hidden sm:block text-xs text-slate-500">{task.assignedTeam}</span>
          )}
          {editing ? (
            <div className="flex gap-1">
              <button onClick={save} disabled={saving} className="p-1 text-emerald-400 hover:text-emerald-300">
                <Check size={14} />
              </button>
              <button onClick={() => setEditing(false)} className="p-1 text-slate-500 hover:text-slate-300">
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => onDelete(task.id)}
              className="p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-9 pb-3 space-y-2">
          {editing ? (
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notes..."
              rows={2}
              className="w-full bg-slate-700 text-slate-300 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 resize-none"
            />
          ) : (
            task.notes && <p className="text-xs text-slate-400 bg-slate-900/50 rounded-lg p-2">{task.notes}</p>
          )}
          <p className="text-xs text-slate-600">Phase: {task.phase || '—'} · Team: {task.assignedTeam || '—'}</p>
        </div>
      )}
    </div>
  )
}

// ─── New task form ─────────────────────────────────────────────────────────────
function AddTaskRow({ category, onDone }: { category: string; onDone: () => void }) {
  const [title, setTitle] = useState('')
  const [team, setTeam] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!title.trim()) { onDone(); return }
    setSaving(true)
    await addDoc(collection(db, 'masterTasks'), {
      title: title.trim(),
      category,
      phase: category,
      assignedTeam: team.trim(),
      defaultPriority: 'medium',
      applicableTo: ['L', 'S', 'E'],
      order: Date.now(),
      notes: '',
      subtasks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    setSaving(false)
    onDone()
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-blue-950/30 border-t border-blue-800/30">
      <ChevronRight size={13} className="text-slate-600 shrink-0" />
      <input
        autoFocus
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onDone() }}
        placeholder="Task name... (Enter to save, Esc to cancel)"
        className="flex-1 bg-transparent text-slate-200 text-sm placeholder-slate-600 focus:outline-none"
      />
      <input
        value={team}
        onChange={e => setTeam(e.target.value)}
        placeholder="Team"
        className="w-28 bg-slate-800 text-slate-300 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500"
      />
      <button onClick={save} disabled={saving} className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg disabled:opacity-50">
        {saving ? '...' : 'Add'}
      </button>
      <button onClick={onDone} className="text-slate-500 hover:text-slate-300"><X size={14} /></button>
    </div>
  )
}

// ─── Category group ────────────────────────────────────────────────────────────
function CategoryGroup({ category, tasks, onDelete }: {
  category: string; tasks: MasterTask[]; onDelete: (id: string) => void
}) {
  const [collapsed, setCollapsed] = useState(true)
  const [adding, setAdding] = useState(false)

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden mb-3">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-750 transition-colors"
      >
        <div className="flex items-center gap-2">
          {collapsed ? <ChevronRight size={15} className="text-slate-500" /> : <ChevronDown size={15} className="text-slate-500" />}
          <span className="text-slate-100 font-medium text-sm">{category}</span>
          <span className="text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded-full">{tasks.length}</span>
        </div>
        <button
          onClick={e => { e.stopPropagation(); setCollapsed(false); setAdding(true) }}
          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded hover:bg-slate-700 transition-colors"
        >
          <Plus size={12} /> Add Task
        </button>
      </button>

      {!collapsed && (
        <div className="border-t border-slate-700">
          {tasks.map(t => <TaskRow key={t.id} task={t} onDelete={onDelete} />)}
          {adding && <AddTaskRow category={category} onDone={() => setAdding(false)} />}
        </div>
      )}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export function ChecklistPage() {
  const { tasks, loading } = useMasterTasks()
  const [search, setSearch] = useState('')
  const [teamFilter, setTeamFilter] = useState('all')
  const [subdivisionFilter, setSubdivisionFilter] = useState('all')
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [newCategory, setNewCategory] = useState('')

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

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return
    await addDoc(collection(db, 'masterTasks'), {
      title: 'New task — click to edit',
      category: newCategory.trim(),
      phase: newCategory.trim(),
      assignedTeam: '',
      defaultPriority: 'medium',
      applicableTo: ['L', 'S', 'E'],
      order: Date.now(),
      notes: '',
      subtasks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    setNewCategory('')
    setShowNewCategory(false)
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Master Checklist</h1>
          <p className="text-slate-400 text-sm mt-1">
            {tasks.length} tasks across {Object.keys(grouped).length} categories — seeded into every new project
          </p>
        </div>
        <button
          onClick={() => setShowNewCategory(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shrink-0"
        >
          <Plus size={15} /> New Category
        </button>
      </div>

      {/* New category input */}
      {showNewCategory && (
        <div className="flex items-center gap-2 bg-slate-800 border border-blue-600 rounded-xl px-4 py-3">
          <input
            autoFocus
            value={newCategory}
            onChange={e => setNewCategory(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddCategory(); if (e.key === 'Escape') setShowNewCategory(false) }}
            placeholder="Category name (e.g. Procurement, IT/AV)"
            className="flex-1 bg-transparent text-slate-100 text-sm placeholder-slate-500 focus:outline-none"
          />
          <button onClick={handleAddCategory} className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg">Create</button>
          <button onClick={() => setShowNewCategory(false)} className="text-slate-500 hover:text-slate-300"><X size={16} /></button>
        </div>
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
          { label: 'Categories', value: Object.keys(grouped).length },
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
          <CategoryGroup key={cat} category={cat} tasks={catTasks} onDelete={handleDelete} />
        ))
      )}
    </div>
  )
}
