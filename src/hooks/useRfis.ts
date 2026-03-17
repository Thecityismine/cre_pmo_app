import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export type RfiStatus = 'draft' | 'open' | 'answered' | 'closed'

export interface RfiStatusEvent {
  status: RfiStatus
  changedAt: string
  note?: string
}

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
  statusHistory: RfiStatusEvent[]
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
    }, () => setLoading(false))
    return unsub
  }, [projectId])

  const nextNumber = rfis.length > 0 ? Math.max(...rfis.map(r => r.number)) + 1 : 1

  const addRfi = async (data: Omit<Rfi, 'id' | 'number' | 'createdAt' | 'updatedAt' | 'statusHistory'>): Promise<void> => {
    const now = new Date().toISOString()
    await addDoc(collection(db, 'rfis'), {
      ...data,
      number: nextNumber,
      statusHistory: [{ status: data.status, changedAt: now }],
      createdAt: now,
      updatedAt: now,
    })
  }

  const updateRfi = async (id: string, data: Partial<Rfi>): Promise<void> => {
    const now = new Date().toISOString()
    const rfi = rfis.find(r => r.id === id)
    const updates: Partial<Rfi> & { updatedAt: string } = { ...data, updatedAt: now }

    // Append to statusHistory when status changes
    if (data.status && rfi && data.status !== rfi.status) {
      const history: RfiStatusEvent[] = [...(rfi.statusHistory || []), { status: data.status, changedAt: now }]
      updates.statusHistory = history
      // Auto-set answeredDate when moving to answered
      if (data.status === 'answered' && !data.answeredDate && !rfi.answeredDate) {
        updates.answeredDate = now.slice(0, 10)
      }
    }

    await updateDoc(doc(db, 'rfis', id), updates as Record<string, unknown>)
  }

  const deleteRfi = (id: string) => deleteDoc(doc(db, 'rfis', id))

  const openCount = rfis.filter(r => r.status === 'open' || r.status === 'draft').length
  const overdueCount = rfis.filter(r =>
    (r.status === 'open' || r.status === 'draft') &&
    r.dueDate && new Date(r.dueDate) < new Date()
  ).length

  return { rfis, loading, addRfi, updateRfi, deleteRfi, nextNumber, openCount, overdueCount }
}
