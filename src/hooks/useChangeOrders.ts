import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export type COStatus = 'pending' | 'approved' | 'rejected'

export interface ChangeOrder {
  id: string
  projectId: string
  number: number          // CO#1, CO#2...
  title: string
  description: string
  amount: number          // positive = add cost, negative = deduction
  status: COStatus
  requestedBy: string
  category: string        // links to budget category label
  notes: string
  date: string            // date submitted
  approvedDate: string
  createdAt: string
  updatedAt: string
}

export function useChangeOrders(projectId: string | undefined) {
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) { setLoading(false); return }
    const q = query(collection(db, 'changeOrders'), where('projectId', '==', projectId))
    const unsub = onSnapshot(q, (snap) => {
      const sorted = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as ChangeOrder))
        .sort((a, b) => a.number - b.number)
      setChangeOrders(sorted)
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [projectId])

  const nextNumber = changeOrders.length > 0
    ? Math.max(...changeOrders.map(c => c.number)) + 1
    : 1

  const addChangeOrder = async (data: Omit<ChangeOrder, 'id' | 'number' | 'createdAt' | 'updatedAt'>): Promise<void> => {
    await addDoc(collection(db, 'changeOrders'), {
      ...data,
      number: nextNumber,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }

  const updateChangeOrder = (id: string, data: Partial<ChangeOrder>) =>
    updateDoc(doc(db, 'changeOrders', id), { ...data, updatedAt: new Date().toISOString() })

  const deleteChangeOrder = (id: string) => deleteDoc(doc(db, 'changeOrders', id))

  // Rollups
  const approvedTotal = changeOrders.filter(c => c.status === 'approved').reduce((s, c) => s + c.amount, 0)
  const pendingTotal = changeOrders.filter(c => c.status === 'pending').reduce((s, c) => s + c.amount, 0)

  return { changeOrders, loading, addChangeOrder, updateChangeOrder, deleteChangeOrder, approvedTotal, pendingTotal, nextNumber }
}
