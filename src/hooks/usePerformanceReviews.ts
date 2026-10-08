import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, addDoc, deleteDoc, updateDoc, doc, arrayUnion } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface ReviewComment {
  id: string
  text: string
  author: string
  createdAt: string
}

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
  comments?: ReviewComment[]
  finalized?: boolean
  createdAt: string
  updatedAt?: string
}

export type NewPerformanceReview = Omit<PerformanceReview, 'id' | 'createdAt' | 'updatedAt' | 'comments' | 'finalized'>
export type PerformanceReviewPatch = Partial<Omit<PerformanceReview, 'id' | 'projectId' | 'createdAt' | 'comments'>>

export function usePerformanceReviews(projectId: string | undefined) {
  const [reviews, setReviews] = useState<PerformanceReview[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) { setLoading(false); return }
    const q = query(
      collection(db, 'performanceReviews'),
      where('projectId', '==', projectId),
    )
    const unsub = onSnapshot(q, snap => {
      const sorted = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as PerformanceReview))
        .sort((a, b) => b.reviewDate.localeCompare(a.reviewDate))
      setReviews(sorted)
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

  const updateReview = async (id: string, patch: PerformanceReviewPatch) => {
    await updateDoc(doc(db, 'performanceReviews', id), {
      ...patch,
      updatedAt: new Date().toISOString(),
    })
  }

  const addComment = async (id: string, text: string, author: string) => {
    const now = new Date().toISOString()
    const comment: ReviewComment = { id: crypto.randomUUID(), text, author, createdAt: now }
    await updateDoc(doc(db, 'performanceReviews', id), {
      comments: arrayUnion(comment),
      updatedAt: now,
    })
  }

  const deleteReview = async (id: string) => {
    await deleteDoc(doc(db, 'performanceReviews', id))
  }

  return { reviews, loading, addReview, updateReview, addComment, deleteReview }
}
