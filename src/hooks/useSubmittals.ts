import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export type SubmittalStatus =
  | 'pending'
  | 'submitted'
  | 'in-review'
  | 'approved'
  | 'approved-with-comments'
  | 'revise-resubmit'
  | 'rejected'

export interface Submittal {
  id: string
  projectId: string
  number: string        // SUB-001, SUB-002...
  title: string
  specSection: string   // e.g., "03 00 00 - Concrete"
  submittedBy: string   // contractor / vendor
  reviewer: string      // architect / engineer
  status: SubmittalStatus
  submittedDate: string
  dueDate: string
  reviewedDate: string
  notes: string
  createdAt: string
  updatedAt: string
}

export function useSubmittals(projectId: string | undefined) {
  const [submittals, setSubmittals] = useState<Submittal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) { setLoading(false); return }
    const q = query(collection(db, 'submittals'), where('projectId', '==', projectId))
    const unsub = onSnapshot(q, (snap) => {
      const sorted = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Submittal))
        .sort((a, b) => a.number.localeCompare(b.number))
      setSubmittals(sorted)
      setLoading(false)
    })
    return unsub
  }, [projectId])

  const nextIndex = submittals.length + 1
  const nextNumber = `SUB-${String(nextIndex).padStart(3, '0')}`

  const addSubmittal = async (data: Omit<Submittal, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> => {
    await addDoc(collection(db, 'submittals'), {
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }

  const updateSubmittal = (id: string, data: Partial<Submittal>) =>
    updateDoc(doc(db, 'submittals', id), { ...data, updatedAt: new Date().toISOString() })

  const deleteSubmittal = (id: string) => deleteDoc(doc(db, 'submittals', id))

  const pendingReview = submittals.filter(s => s.status === 'submitted' || s.status === 'in-review').length
  const overdueCount = submittals.filter(s =>
    (s.status === 'submitted' || s.status === 'in-review' || s.status === 'pending') &&
    s.dueDate && new Date(s.dueDate) < new Date()
  ).length

  return { submittals, loading, addSubmittal, updateSubmittal, deleteSubmittal, nextNumber, pendingReview, overdueCount }
}
