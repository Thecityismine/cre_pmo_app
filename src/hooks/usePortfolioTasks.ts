import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Task } from '@/types'

// Fetches all non-complete tasks that have a due date — used for cross-project dashboard views
export function usePortfolioTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Query tasks with a due date that are not complete or N/A
    const q = query(
      collection(db, 'tasks'),
      where('status', 'not-in', ['complete', 'n-a']),
    )
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Task))
      // Client-side: only keep tasks that have a dueDate set
      setTasks(all.filter(t => t.dueDate))
      setLoading(false)
    })
    return unsub
  }, [])

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const in14 = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)

  const overdue = tasks.filter(t => new Date(t.dueDate!) < today)
  const upcoming = tasks.filter(t => {
    const d = new Date(t.dueDate!)
    return d >= today && d <= in14
  })

  return { tasks, loading, overdue, upcoming }
}
