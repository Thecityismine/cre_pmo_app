import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface Contact {
  id: string
  name: string
  company: string
  role: string
  responsibility?: string
  email: string
  phone: string
  trades: string[]
  notes: string
  projectId: string | null
  createdAt: string
  updatedAt?: string
}

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'contacts'), orderBy('name', 'asc'))
    const unsub = onSnapshot(q, (snap) => {
      setContacts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Contact)))
      setLoading(false)
    })
    return unsub
  }, [])

  return { contacts, loading }
}
