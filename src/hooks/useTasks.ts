import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Task } from '@/types'

export function useTasks(projectId: string | undefined) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) { setLoading(false); return }
    // No orderBy in Firestore — avoids composite index requirement.
    // Sort client-side by order field instead.
    const q = query(
      collection(db, 'tasks'),
      where('projectId', '==', projectId),
    )
    const unsub = onSnapshot(q, (snap) => {
      const sorted = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Task))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      setTasks(sorted)
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [projectId])

  return { tasks, loading }
}
