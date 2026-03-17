import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export type RfiStatus = 'draft' | 'open' | 'answered' | 'closed'

export interface Rfi {
  id: string
  projectId: string
  number: number
  subject: string
  question: string
  submittedBy: string
  assignedTo: string
  status: RfiStatus
  dueDate: string
  answeredDate: string
  response: string
  specSection: string
  createdAt: string
  updatedAt: string
}

export function useRfis(projectId: string | undefined) {
  const [rfis, setRfis] = useState<Rfi[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) { setLoading(false); return }
    const q = query(collection(db, 'rfis'), where('projectId', '==', projectId))
    const unsub = onSnapshot(q, (snap) => {
      const sorted = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Rfi))
        .sort((a, b) => a.number - b.number)
      setRfis(sorted)
      setLoading(false)
    })
    return unsub
  }, [projectId])

  const nextNumber = rfis.length > 0 ? Math.max(...rfis.map(r => r.number)) + 1 : 1

  const addRfi = (data: Omit<Rfi, 'id' | 'number' | 'createdAt' | 'updatedAt'>) =>
    addDoc(collection(db, 'rfis'), {
      ...data,
      number: nextNumber,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

  const updateRfi = (id: string, data: Partial<Rfi>) =>
    updateDoc(doc(db, 'rfis', id), { ...data, updatedAt: new Date().toISOString() })

  const deleteRfi = (id: string) => deleteDoc(doc(db, 'rfis', id))

  const openCount = rfis.filter(r => r.status === 'open' || r.status === 'draft').length
  const overdueCount = rfis.filter(r =>
    (r.status === 'open' || r.status === 'draft') &&
    r.dueDate && new Date(r.dueDate) < new Date()
  ).length

  return { rfis, loading, addRfi, updateRfi, deleteRfi, nextNumber, openCount, overdueCount }
}
