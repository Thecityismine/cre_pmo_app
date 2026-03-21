import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export type ProjectTaskPriority  = 'low' | 'medium' | 'high' | 'urgent'
export type ProjectTaskStatus    = 'open' | 'completed'
export type RecurrenceFrequency  = 'daily' | 'weekly' | 'monthly'

export interface ProjectTask {
  id: string
  projectId: string
  title: string
  description: string
  dueDate: string
  assignedTo: string
  priority: ProjectTaskPriority
  status: ProjectTaskStatus
  completedAt: string
  milestoneId?: string
  recurrence?: { frequency: RecurrenceFrequency; interval: number }
  createdAt: string
  updatedAt: string
}

function calcNextDue(fromDate: string, freq: RecurrenceFrequency, interval: number): string {
  const [y, m, d] = fromDate.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  if (freq === 'daily')        date.setDate(date.getDate() + interval)
  else if (freq === 'weekly')  date.setDate(date.getDate() + interval * 7)
  else                         date.setMonth(date.getMonth() + interval)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function useProjectTasks(projectId: string | undefined) {
  const [tasks, setTasks] = useState<ProjectTask[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) { setLoading(false); return }
    const q = query(collection(db, 'projectTasks'), where('projectId', '==', projectId))
    const unsub = onSnapshot(q, (snap) => {
      const sorted = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as ProjectTask))
        .sort((a, b) => (a.dueDate || a.createdAt).localeCompare(b.dueDate || b.createdAt))
      setTasks(sorted)
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [projectId])

  const addTask = async (data: Omit<ProjectTask, 'id' | 'createdAt' | 'updatedAt' | 'completedAt'>) => {
    const now = new Date().toISOString()
    const payload = Object.fromEntries(
      Object.entries({ ...data, completedAt: '', createdAt: now, updatedAt: now })
        .filter(([, v]) => v !== undefined)
    )
    await addDoc(collection(db, 'projectTasks'), payload)
  }

  const updateTask = async (id: string, data: Partial<ProjectTask>) => {
    const payload = Object.fromEntries(
      Object.entries({ ...data, updatedAt: new Date().toISOString() })
        .filter(([, v]) => v !== undefined)
    )
    await updateDoc(doc(db, 'projectTasks', id), payload)
  }

  const completeTask = async (task: ProjectTask) => {
    const now = new Date().toISOString()
    await updateDoc(doc(db, 'projectTasks', task.id), { status: 'completed', completedAt: now, updatedAt: now })
    if (task.recurrence && task.dueDate) {
      const { id: _id, createdAt: _c, updatedAt: _u, completedAt: _ca, status: _s, ...rest } = task
      await addDoc(collection(db, 'projectTasks'), {
        ...rest,
        status: 'open',
        completedAt: '',
        dueDate: calcNextDue(task.dueDate, task.recurrence.frequency, task.recurrence.interval),
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  const deleteTask = (id: string) => deleteDoc(doc(db, 'projectTasks', id))

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const in7 = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
  // Parse date-only strings (YYYY-MM-DD) as local midnight to avoid UTC offset shifting the day
  const parseLocal = (d: string) => { const [y, m, day] = d.split('-').map(Number); return new Date(y, m - 1, day) }

  const open      = tasks.filter(t => t.status === 'open')
  const completed = tasks.filter(t => t.status === 'completed')
  const overdue   = open.filter(t => t.dueDate && parseLocal(t.dueDate) < today)
  const dueSoon   = open.filter(t => t.dueDate && parseLocal(t.dueDate) >= today && parseLocal(t.dueDate) <= in7)

  return { tasks, loading, addTask, updateTask, completeTask, deleteTask, open, completed, overdue, dueSoon }
}
