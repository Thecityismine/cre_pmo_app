import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where, updateDoc, addDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { ProjectTask, RecurrenceFrequency } from '@/hooks/useProjectTasks'

function calcNextDue(fromDate: string, freq: RecurrenceFrequency, interval: number): string {
  const [y, m, d] = fromDate.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  if (freq === 'daily')       date.setDate(date.getDate() + interval)
  else if (freq === 'weekly') date.setDate(date.getDate() + interval * 7)
  else                        date.setMonth(date.getMonth() + interval)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const parseLocal = (d: string) => {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day)
}

export function useAllProjectTasks() {
  const [tasks, setTasks] = useState<ProjectTask[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'projectTasks'), where('status', '==', 'open'))
    const unsub = onSnapshot(q, (snap) => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProjectTask)))
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])

  const completeTask = async (task: ProjectTask) => {
    const now = new Date().toISOString()
    await updateDoc(doc(db, 'projectTasks', task.id), {
      status: 'completed',
      completedAt: now,
      updatedAt: now,
    })
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

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const in7 = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

  const overdue   = tasks.filter(t => t.dueDate && parseLocal(t.dueDate) < today)
  const thisWeek  = tasks.filter(t => t.dueDate && parseLocal(t.dueDate) >= today && parseLocal(t.dueDate) <= in7)
  const recurring = tasks.filter(t => !!t.recurrence)

  return { tasks, loading, completeTask, overdue, thisWeek, recurring }
}
