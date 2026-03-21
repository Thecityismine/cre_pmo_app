import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { ScheduleItem } from './useScheduleItems'

export interface PortfolioMilestone {
  id: string
  projectId: string
  projectName: string
  name: string
  targetDate: string
  status: 'pending' | 'complete' | 'delayed'
  daysUntil: number
}

export function usePortfolioMilestones(projectMap: Record<string, string>) {
  const [milestones, setMilestones] = useState<PortfolioMilestone[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'scheduleItems'), where('isMilestone', '==', true))
    const unsub = onSnapshot(q, (snap) => {
      const parseLocal = (s: string) => { const [y, mo, day] = s.split('-').map(Number); return new Date(y, mo - 1, day) }
      const today = new Date()
      const in30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)

      const items = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as ScheduleItem))
        .filter(item => {
          const targetDate = item.endDate || item.baselineEnd
          if (!targetDate) return false
          if (item.percentComplete === 100) return false  // exclude completed
          const d = parseLocal(targetDate)
          return d >= today && d <= in30
        })
        .map(item => {
          const targetDate = item.endDate || item.baselineEnd
          const d = parseLocal(targetDate)
          const isDelayed = targetDate && parseLocal(targetDate) < today && item.percentComplete < 100
          return {
            id: item.id,
            projectId: item.projectId,
            projectName: projectMap[item.projectId] ?? 'Unknown Project',
            name: item.name,
            targetDate,
            status: (item.percentComplete === 100 ? 'complete' : isDelayed ? 'delayed' : 'pending') as 'pending' | 'complete' | 'delayed',
            daysUntil: Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
          }
        })
        .sort((a, b) => a.daysUntil - b.daysUntil)

      setMilestones(items)
      setLoading(false)
    })
    return unsub
  }, [JSON.stringify(projectMap)])  // eslint-disable-line react-hooks/exhaustive-deps

  return { milestones, loading }
}
