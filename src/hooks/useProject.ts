import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Project } from '@/types'

export function useProject(id: string | undefined) {
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) { setLoading(false); return }
    const unsub = onSnapshot(doc(db, 'projects', id), (snap) => {
      setProject(snap.exists() ? ({ id: snap.id, ...snap.data() } as Project) : null)
      setLoading(false)
    })
    return unsub
  }, [id])

  return { project, loading }
}
