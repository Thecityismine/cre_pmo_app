import { useEffect, useState } from 'react'
import {
  collection, onSnapshot, query, where,
  addDoc, deleteDoc, doc, updateDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface MeetingNote {
  id: string
  projectId: string
  title: string
  rawText: string
  summary: string
  actionItems: string[]
  decisions: string[]
  risks: string[]
  createdAt: string
  createdBy?: string
}

export function useMeetingNotes(projectId: string | undefined) {
  const [notes, setNotes] = useState<MeetingNote[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) { setLoading(false); return }
    const q = query(
      collection(db, 'meetingNotes'),
      where('projectId', '==', projectId),
    )
    const unsub = onSnapshot(q, (snap) => {
      const sorted = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as MeetingNote))
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      setNotes(sorted)
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [projectId])

  const addNote = async (note: Omit<MeetingNote, 'id'>) => {
    await addDoc(collection(db, 'meetingNotes'), note)
  }

  const deleteNote = async (id: string) => {
    await deleteDoc(doc(db, 'meetingNotes', id))
  }

  const updateNote = async (id: string, data: Partial<Omit<MeetingNote, 'id' | 'projectId' | 'createdAt'>>) => {
    await updateDoc(doc(db, 'meetingNotes', id), { ...data, updatedAt: new Date().toISOString() })
  }

  return { notes, loading, addNote, deleteNote, updateNote }
}
