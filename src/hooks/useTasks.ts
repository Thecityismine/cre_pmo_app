import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Task } from '@/types'

export function useTasks(projectId: string | undefined) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) { setLoading(false); return }
    const q = query(
      collection(db, 'tasks'),
      where('projectId', '==', projectId),
      orderBy('order', 'asc')
    )
    const unsub = onSnapshot(q, (snap) => {
      setTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task)))
      setLoading(false)
    })
    return unsub
  }, [projectId])

  return { tasks, loading }
}
