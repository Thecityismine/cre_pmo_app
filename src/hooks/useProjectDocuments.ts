import { useEffect, useState } from 'react'
import {
  collection, onSnapshot, query, where, orderBy,
  addDoc, deleteDoc, doc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface ProjectDocument {
  id: string
  projectId: string
  name: string
  originalName: string
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
      orderBy('createdAt', 'desc')
    )
    const unsub = onSnapshot(q, (snap) => {
      setDocuments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ProjectDocument)))
      setLoading(false)
    })
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
