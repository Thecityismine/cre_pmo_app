import { useEffect, useState, useCallback } from 'react'
import { collection, onSnapshot, query, where, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export type PunchStatus = 'open' | 'closed'

export interface PunchItem {
  id: string
  projectId: string
  number: string
  description: string
  location: string
  trade: string
  status: PunchStatus
  notes: string
  createdAt: string
  updatedAt: string
}

export function usePunchList(projectId: string | undefined) {
  const [items, setItems] = useState<PunchItem[]>([])
  const [loading, setLoading] = useState(true)
  const [punchListDate, setPunchListDateState] = useState('')

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

  useEffect(() => {
    if (!projectId) return
    getDoc(doc(db, 'punchListMeta', projectId)).then(snap => {
      if (snap.exists()) setPunchListDateState(snap.data().date ?? '')
    })
  }, [projectId])

  const savePunchListDate = useCallback(async (date: string) => {
    if (!projectId) return
    setPunchListDateState(date)
    await setDoc(doc(db, 'punchListMeta', projectId), { date, projectId }, { merge: true })
  }, [projectId])

  const nextNumber = () => {
    if (items.length === 0) return 'PL-001'
    const nums = items.map(i => {
      const n = parseInt(i.number.replace('PL-', ''), 10)
      return isNaN(n) ? 0 : n
    })
    return `PL-${String(Math.max(...nums) + 1).padStart(3, '0')}`
  }

  const addItem = async (data: Omit<PunchItem, 'id' | 'number' | 'createdAt' | 'updatedAt'>): Promise<void> => {
    await addDoc(collection(db, 'punchList'), {
      ...data,
      number: nextNumber(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }

  const updateItem = (id: string, data: Partial<PunchItem>) =>
    updateDoc(doc(db, 'punchList', id), { ...data, updatedAt: new Date().toISOString() })

  const deleteItem = (id: string) => deleteDoc(doc(db, 'punchList', id))

  const activeItems   = items.filter(i => i.status !== 'closed')
  const archivedItems = items.filter(i => i.status === 'closed')
  const openCount     = items.filter(i => i.status === 'open').length

  return {
    items, activeItems, archivedItems, loading,
    addItem, updateItem, deleteItem,
    openCount,
    punchListDate, savePunchListDate,
  }
}
