/**
 * Queries all tasks for a set of project IDs and returns per-project
 * completion statistics. Used to power health score SPI on the dashboard.
 */
import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Task } from '@/types'

export interface ProjectTaskStat {
  total: number
  complete: number
  pct: number  // 0–100
}

export function usePortfolioTaskStats(projectIds: string[]): {
  stats: Record<string, ProjectTaskStat>
  loading: boolean
} {
  const [stats, setStats] = useState<Record<string, ProjectTaskStat>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (projectIds.length === 0) { setLoading(false); return }

    // Firestore 'in' max = 30; chunk if needed
    const chunks: string[][] = []
    for (let i = 0; i < projectIds.length; i += 30) {
      chunks.push(projectIds.slice(i, i + 30))
    }

    const allTasks: Task[] = []
    let settled = 0
    const unsubs: (() => void)[] = []

    chunks.forEach(chunk => {
      const q = query(collection(db, 'tasks'), where('projectId', 'in', chunk))
      const unsub = onSnapshot(q, (snap) => {
        const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() } as Task))

        // Replace this chunk's tasks in allTasks
        tasks.forEach(t => {
          const idx = allTasks.findIndex(a => a.id === t.id)
          if (idx >= 0) allTasks[idx] = t
          else allTasks.push(t)
        })

        settled++
        if (settled >= chunks.length) {
          // Group by project
          const grouped: Record<string, ProjectTaskStat> = {}
          for (const t of allTasks) {
            if (!grouped[t.projectId]) grouped[t.projectId] = { total: 0, complete: 0, pct: 0 }
            grouped[t.projectId].total++
            if (t.status === 'complete' || t.status === 'n-a') grouped[t.projectId].complete++
          }
          for (const id of Object.keys(grouped)) {
            const g = grouped[id]
            g.pct = g.total > 0 ? Math.round((g.complete / g.total) * 100) : 0
          }
          setStats(grouped)
          setLoading(false)
        }
      })
      unsubs.push(unsub)
    })

    return () => unsubs.forEach(u => u())
  }, [projectIds.join(',')])  // eslint-disable-line react-hooks/exhaustive-deps

  return { stats, loading }
}
