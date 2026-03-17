import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export type PunchStatus   = 'open' | 'in-progress' | 'complete' | 'disputed'
export type PunchPriority = 'high' | 'medium' | 'low'

export interface PunchItem {
  id: string
  projectId: string
  number: string     // e.g. PL-001
  description: string
  location: string
  trade: string
  status: PunchStatus
  priority: PunchPriority
  dueDate: string
  completedDate: string
  notes: string
  createdAt: string
  updatedAt: string
}

export function usePunchList(projectId: string | undefined) {
  const [items, setItems] = useState<PunchItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) { setLoading(false); return }
    const q = query(collection(db, 'punchList'), where('projectId', '==', projectId))
    const unsub = onSnapshot(q, snap => {
      const sorted = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as PunchItem))
        .sort((a, b) => a.number.localeCompare(b.number))
      setItems(sorted)
      setLoading(false)
    })
    return unsub
  }, [projectId])

  const nextNumber = () => {
    if (items.length === 0) return 'PL-001'
    const nums = items.map(i => {
      const n = parseInt(i.number.replace('PL-', ''), 10)
      return isNaN(n) ? 0 : n
    })
    return `PL-${String(Math.max(...nums) + 1).padStart(3, '0')}`
  }

  const addItem = (data: Omit<PunchItem, 'id' | 'number' | 'createdAt' | 'updatedAt'>) =>
    addDoc(collection(db, 'punchList'), {
      ...data,
      number: nextNumber(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

  const updateItem = (id: string, data: Partial<PunchItem>) =>
    updateDoc(doc(db, 'punchList', id), { ...data, updatedAt: new Date().toISOString() })

  const deleteItem = (id: string) => deleteDoc(doc(db, 'punchList', id))

  const openCount      = items.filter(i => i.status === 'open' || i.status === 'in-progress').length
  const completeCount  = items.filter(i => i.status === 'complete').length
  const highPrioOpen   = items.filter(i => i.priority === 'high' && i.status !== 'complete').length

  return { items, loading, addItem, updateItem, deleteItem, openCount, completeCount, highPrioOpen }
}
