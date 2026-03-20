import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export type ProjectTaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type ProjectTaskStatus   = 'open' | 'completed'

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
  milestoneId?: string   // optional link to a Milestone
  createdAt: string
  updatedAt: string
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

  const completeTask = async (id: string) => {
    const now = new Date().toISOString()
    await updateDoc(doc(db, 'projectTasks', id), { status: 'completed', completedAt: now, updatedAt: now })
  }

  const deleteTask = (id: string) => deleteDoc(doc(db, 'projectTasks', id))

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const in7 = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

  const open      = tasks.filter(t => t.status === 'open')
  const completed = tasks.filter(t => t.status === 'completed')
  const overdue   = open.filter(t => t.dueDate && new Date(t.dueDate) < today)
  const dueSoon   = open.filter(t => t.dueDate && new Date(t.dueDate) >= today && new Date(t.dueDate) <= in7)

  return { tasks, loading, addTask, updateTask, completeTask, deleteTask, open, completed, overdue, dueSoon }
}
