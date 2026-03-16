import { useEffect } from 'react'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useProjectStore } from '@/store/projectStore'
import type { Project } from '@/types'

export function useProjects() {
  const { projects, loading, error, setProjects, setLoading, setError } = useProjectStore()

  useEffect(() => {
    setLoading(true)
    const q = query(collection(db, 'projects'), orderBy('updatedAt', 'desc'))

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Project))
        setProjects(data)
        setLoading(false)
      },
      (err) => {
        console.error('Projects listener error:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [setProjects, setLoading, setError])

  return { projects, loading, error }
}
