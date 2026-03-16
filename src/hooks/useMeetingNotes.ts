import { useEffect, useState } from 'react'
import {
  collection, onSnapshot, query, where, orderBy,
  addDoc, deleteDoc, doc,
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
      orderBy('createdAt', 'desc')
    )
    const unsub = onSnapshot(q, (snap) => {
      setNotes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as MeetingNote)))
      setLoading(false)
    })
    return unsub
  }, [projectId])

  const addNote = async (note: Omit<MeetingNote, 'id'>) => {
    await addDoc(collection(db, 'meetingNotes'), note)
  }

  const deleteNote = async (id: string) => {
    await deleteDoc(doc(db, 'meetingNotes', id))
  }

  return { notes, loading, addNote, deleteNote }
}
