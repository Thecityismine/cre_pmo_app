import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface PerformanceReview {
  id: string
  projectId: string
  contactName: string
  contactCompany: string
  contactRole: string
  reviewDate: string
  qualityOfWork: number
  timeliness: number
  communication: number
  budgetAdherence: number
  safety: number
  notes: string
  wouldHireAgain: boolean
  createdAt: string
}

export type NewPerformanceReview = Omit<PerformanceReview, 'id' | 'createdAt'>

export function usePerformanceReviews(projectId: string | undefined) {
  const [reviews, setReviews] = useState<PerformanceReview[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) { setLoading(false); return }
    const q = query(
      collection(db, 'performanceReviews'),
      where('projectId', '==', projectId),
      orderBy('reviewDate', 'desc'),
    )
    const unsub = onSnapshot(q, snap => {
      setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() } as PerformanceReview)))
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [projectId])

  const addReview = async (data: NewPerformanceReview) => {
    await addDoc(collection(db, 'performanceReviews'), {
      ...data,
      createdAt: new Date().toISOString(),
    })
  }

  const deleteReview = async (id: string) => {
    await deleteDoc(doc(db, 'performanceReviews', id))
  }

  return { reviews, loading, addReview, deleteReview }
}
