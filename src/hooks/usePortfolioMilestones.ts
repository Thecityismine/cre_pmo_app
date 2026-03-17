import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Milestone } from './useMilestones'

export interface PortfolioMilestone extends Milestone {
  projectName: string
  projectId: string
  daysUntil: number
}

export function usePortfolioMilestones(projectMap: Record<string, string>) {
  const [milestones, setMilestones] = useState<PortfolioMilestone[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'milestones'), where('status', '==', 'pending'))
    const unsub = onSnapshot(q, (snap) => {
      const today = new Date()
      const in30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)

      const items = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Milestone))
        .filter(m => {
          if (!m.targetDate) return false
          const d = new Date(m.targetDate)
          return d >= today && d <= in30
        })
        .map(m => ({
          ...m,
          projectName: projectMap[m.projectId] ?? 'Unknown Project',
          daysUntil: Math.ceil((new Date(m.targetDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
        }))
        .sort((a, b) => a.daysUntil - b.daysUntil)

      setMilestones(items)
      setLoading(false)
    })
    return unsub
  }, [JSON.stringify(projectMap)])  // eslint-disable-line react-hooks/exhaustive-deps

  return { milestones, loading }
}
