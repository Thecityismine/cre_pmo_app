import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface TeamMember {
  id: string
  projectId: string
  name: string
  role: string
  email: string
  phone: string
  company: string
  trades: string[]
  addedAt: string
}

export function useProjectTeam(projectId: string | undefined) {
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) { setLoading(false); return }
    const q = query(collection(db, 'projectTeam'), where('projectId', '==', projectId))
    const unsub = onSnapshot(q, (snap) => {
      setTeam(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TeamMember)))
      setLoading(false)
    })
    return unsub
  }, [projectId])

  return { team, loading }
}
