import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface MasterTask {
  id: string
  title: string
  category: string
  phase: string
  assignedTeam: string
  defaultPriority: string
  order: number
  notes: string
  subtasks: string[]
}

export function useMasterTasks() {
  const [tasks, setTasks] = useState<MasterTask[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'masterTasks'), orderBy('order', 'asc'))
    const unsub = onSnapshot(q, (snap) => {
      setTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() } as MasterTask)))
      setLoading(false)
    })
    return unsub
  }, [])

  return { tasks, loading }
}
