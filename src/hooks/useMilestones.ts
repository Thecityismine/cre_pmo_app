import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export type MilestoneStatus = 'pending' | 'complete' | 'delayed'

export interface Milestone {
  id: string
  projectId: string
  name: string
  targetDate: string
  actualDate: string
  status: MilestoneStatus
  notes: string
  order: number
  createdAt: string
  updatedAt: string
}

// Default milestone set seeded on first open (if none exist)
export const DEFAULT_MILESTONES = [
  { name: 'Lease Signed / Authorization',   order: 1 },
  { name: 'Notice to Proceed (NTP)',         order: 2 },
  { name: 'Design Start',                   order: 3 },
  { name: 'Permit Submission',              order: 4 },
  { name: 'Permit Approved',               order: 5 },
  { name: 'GC Notice to Proceed',          order: 6 },
  { name: 'Construction Start',            order: 7 },
  { name: 'Substantial Completion',        order: 8 },
  { name: 'Certificate of Occupancy',      order: 9 },
  { name: 'Move-in / Occupancy',           order: 10 },
  { name: 'Final Closeout',               order: 11 },
]

export function useMilestones(projectId: string | undefined) {
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) { setLoading(false); return }
    const q = query(collection(db, 'milestones'), where('projectId', '==', projectId))
    const unsub = onSnapshot(q, (snap) => {
      const sorted = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Milestone))
        .sort((a, b) => a.order - b.order)
      setMilestones(sorted)
      setLoading(false)
    })
    return unsub
  }, [projectId])

  const seedDefaults = async () => {
    const now = new Date().toISOString()
    for (const m of DEFAULT_MILESTONES) {
      await addDoc(collection(db, 'milestones'), {
        projectId,
        name: m.name,
        order: m.order,
        targetDate: '',
        actualDate: '',
        status: 'pending',
        notes: '',
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  const addMilestone = (data: Omit<Milestone, 'id' | 'createdAt' | 'updatedAt'>) =>
    addDoc(collection(db, 'milestones'), {
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

  const updateMilestone = (id: string, data: Partial<Milestone>) =>
    updateDoc(doc(db, 'milestones', id), { ...data, updatedAt: new Date().toISOString() })

  const deleteMilestone = (id: string) => deleteDoc(doc(db, 'milestones', id))

  const completedCount = milestones.filter(m => m.status === 'complete').length
  const delayedCount  = milestones.filter(m => m.status === 'delayed').length

  return {
    milestones, loading,
    seedDefaults, addMilestone, updateMilestone, deleteMilestone,
    completedCount, delayedCount,
  }
}
