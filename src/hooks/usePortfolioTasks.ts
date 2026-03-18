import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Task } from '@/types'
import type { ProjectTask } from '@/hooks/useProjectTasks'

// Unified task shape for dashboard display
export interface PortfolioTask {
  id: string
  title: string
  dueDate: string
  projectId: string
  source: 'checklist' | 'project'
  assignedTo?: string   // populated for project tasks
}

// Fetches both checklist tasks (with due dates) and manual project tasks
export function usePortfolioTasks() {
  const [checklistTasks, setChecklistTasks] = useState<Task[]>([])
  const [projectTasks, setProjectTasks]     = useState<ProjectTask[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let checklistDone = false
    let projectDone   = false
    const done = () => { if (checklistDone && projectDone) setLoading(false) }

    // 1. Checklist tasks with a due date that aren't complete
    const q1 = query(collection(db, 'tasks'), where('status', 'not-in', ['complete', 'n-a']))
    const unsub1 = onSnapshot(q1, (snap) => {
      setChecklistTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task)).filter(t => t.dueDate))
      checklistDone = true; done()
    }, () => { checklistDone = true; done() })

    // 2. Manual project tasks that are still open
    const q2 = query(collection(db, 'projectTasks'), where('status', '==', 'open'))
    const unsub2 = onSnapshot(q2, (snap) => {
      setProjectTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProjectTask)))
      projectDone = true; done()
    }, () => { projectDone = true; done() })

    return () => { unsub1(); unsub2() }
  }, [])

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const in14 = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)

  // Project tasks take priority on dashboard
  const ptOverdue  = projectTasks.filter(t => t.dueDate && new Date(t.dueDate) < today)
  const ptUpcoming = projectTasks.filter(t => {
    if (!t.dueDate) return false
    const d = new Date(t.dueDate)
    return d >= today && d <= in14
  })

  // Checklist tasks for secondary reference
  const clOverdue  = checklistTasks.filter(t => new Date(t.dueDate!) < today)
  const clUpcoming = checklistTasks.filter(t => {
    const d = new Date(t.dueDate!)
    return d >= today && d <= in14
  })

  // Merged — project tasks first
  const overdue: PortfolioTask[] = [
    ...ptOverdue.map(t => ({ id: t.id, title: t.title, dueDate: t.dueDate, projectId: t.projectId, source: 'project' as const, assignedTo: t.assignedTo })),
    ...clOverdue.map(t => ({ id: t.id, title: t.title, dueDate: t.dueDate!, projectId: t.projectId, source: 'checklist' as const })),
  ]
  const upcoming: PortfolioTask[] = [
    ...ptUpcoming.map(t => ({ id: t.id, title: t.title, dueDate: t.dueDate, projectId: t.projectId, source: 'project' as const, assignedTo: t.assignedTo })),
    ...clUpcoming.map(t => ({ id: t.id, title: t.title, dueDate: t.dueDate!, projectId: t.projectId, source: 'checklist' as const })),
  ]

  return { loading, overdue, upcoming, overdueCount: overdue.length }
}
