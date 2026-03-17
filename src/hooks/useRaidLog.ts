import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export type RaidType = 'risk' | 'action' | 'issue' | 'decision'
export type RaidStatus = 'open' | 'in-progress' | 'closed' | 'accepted'
export type RaidPriority = 'high' | 'medium' | 'low'

export interface RaidItem {
  id: string
  projectId: string
  type: RaidType
  title: string
  description: string
  owner: string
  priority: RaidPriority
  status: RaidStatus
  dueDate: string
  closedDate: string
  createdAt: string
  updatedAt: string
}

export function useRaidLog(projectId: string | undefined) {
  const [items, setItems] = useState<RaidItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) { setLoading(false); return }
    const q = query(collection(db, 'raidLog'), where('projectId', '==', projectId))
    const unsub = onSnapshot(q, (snap) => {
      const sorted = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as RaidItem))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      setItems(sorted)
      setLoading(false)
    })
    return unsub
  }, [projectId])

  const addItem = (data: Omit<RaidItem, 'id' | 'createdAt' | 'updatedAt'>) =>
    addDoc(collection(db, 'raidLog'), {
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

  const updateItem = (id: string, data: Partial<RaidItem>) =>
    updateDoc(doc(db, 'raidLog', id), { ...data, updatedAt: new Date().toISOString() })

  const deleteItem = (id: string) => deleteDoc(doc(db, 'raidLog', id))

  return { items, loading, addItem, updateItem, deleteItem }
}
