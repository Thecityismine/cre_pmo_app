import { useEffect, useState } from 'react'
import {
  collection, onSnapshot, query, where,
  addDoc, deleteDoc, doc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface ProjectDocument {
  id: string
  projectId: string
  name: string
  originalName: string
  displayName: string
  url: string
  storagePath: string
  size: number
  type: string
  category: string
  uploadedBy: string
  createdAt: string
}

export function useProjectDocuments(projectId: string | undefined) {
  const [documents, setDocuments] = useState<ProjectDocument[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) { setLoading(false); return }
    const q = query(
      collection(db, 'projectDocuments'),
      where('projectId', '==', projectId),
    )
    const unsub = onSnapshot(q, (snap) => {
      const sorted = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as ProjectDocument))
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      setDocuments(sorted)
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [projectId])

  const addDocument = async (doc_: Omit<ProjectDocument, 'id'>) => {
    await addDoc(collection(db, 'projectDocuments'), doc_)
  }

  const removeDocument = async (id: string) => {
    await deleteDoc(doc(db, 'projectDocuments', id))
  }

  return { documents, loading, addDocument, removeDocument }
}
