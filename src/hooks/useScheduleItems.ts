import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where, addDoc, updateDoc, deleteDoc, doc, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface ScheduleItem {
  id: string
  projectId: string
  name: string
  startDate: string
  endDate: string
  baselineStart: string
  baselineEnd: string
  percentComplete: number     // 0–100
  isCriticalPath: boolean
  isWarranty?: boolean
  isMilestone?: boolean
  predecessors?: string[]     // array of predecessor ScheduleItem IDs (Finish-to-Start)
  notes: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export const DEFAULT_SCHEDULE_ITEMS = [
  { name: 'Pre-Design / Programming',     sortOrder: 1 },
  { name: 'Schematic Design',             sortOrder: 2 },
  { name: 'Design Development',           sortOrder: 3 },
  { name: 'Construction Documents',       sortOrder: 4 },
  { name: 'Permit Submission',            sortOrder: 5 },
  { name: 'Permit Approval',              sortOrder: 6 },
  { name: 'Bid Period',                   sortOrder: 7 },
  { name: 'Award / Contracts',            sortOrder: 8 },
  { name: 'Site Mobilization',            sortOrder: 9 },
  { name: 'Demolition',                   sortOrder: 10 },
  { name: 'Rough MEP',                    sortOrder: 11 },
  { name: 'Framing / Drywall',           sortOrder: 12 },
  { name: 'Finishes',                     sortOrder: 13 },
  { name: 'FF&E Delivery & Install',      sortOrder: 14 },
  { name: 'Punch List',                   sortOrder: 15 },
  { name: 'Substantial Completion',       sortOrder: 16 },
  { name: 'Move-in / Occupancy',          sortOrder: 17 },
]

export function useScheduleItems(projectId: string | undefined) {
  const [items, setItems] = useState<ScheduleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)

  useEffect(() => {
    if (!projectId) { setLoading(false); return }
    const q = query(collection(db, 'scheduleItems'), where('projectId', '==', projectId))
    const unsub = onSnapshot(q, (snap) => {
      const sorted = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as ScheduleItem))
        .sort((a, b) => {
          const aDate = a.startDate || a.baselineStart
          const bDate = b.startDate || b.baselineStart
          if (aDate && bDate) return aDate.localeCompare(bDate)
          if (aDate && !bDate) return -1  // dated items first
          if (!aDate && bDate) return 1
          return a.sortOrder - b.sortOrder
        })
      setItems(sorted)
      setLoading(false)
    })
    return unsub
  }, [projectId])

  const seedDefaults = async () => {
    if (!projectId || seeding) return
    setSeeding(true)
    try {
      const now = new Date().toISOString()
      // Pull from masterScheduleActivities; fall back to DEFAULT_SCHEDULE_ITEMS if empty
      const masterSnap = await getDocs(collection(db, 'masterScheduleActivities'))
      const template = masterSnap.docs.length > 0
        ? masterSnap.docs.map(d => d.data() as { name: string; sortOrder: number; isWarranty?: boolean })
            .sort((a, b) => a.sortOrder - b.sortOrder)
        : DEFAULT_SCHEDULE_ITEMS.map(s => ({ ...s, isWarranty: false }))

      for (const s of template) {
        await addDoc(collection(db, 'scheduleItems'), {
          projectId,
          name: s.name,
          sortOrder: s.sortOrder,
          isWarranty: s.isWarranty ?? false,
          startDate: '',
          endDate: '',
          baselineStart: '',
          baselineEnd: '',
          percentComplete: 0,
          isCriticalPath: false,
          predecessors: [],
          notes: '',
          createdAt: now,
          updatedAt: now,
        })
      }
    } catch (err) {
      console.error('seedDefaults failed:', err)
      alert('Failed to seed schedule. Check console for details.')
    } finally {
      setSeeding(false)
    }
  }

  const addItem = async (data: Omit<ScheduleItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> => {
    await addDoc(collection(db, 'scheduleItems'), {
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }

  const updateItem = (id: string, data: Partial<ScheduleItem>) =>
    updateDoc(doc(db, 'scheduleItems', id), { ...data, updatedAt: new Date().toISOString() })

  const deleteItem = (id: string) => deleteDoc(doc(db, 'scheduleItems', id))

  // ── Computed stats ──────────────────────────────────────────────────────────
  const itemsWithDates = items.filter(i => i.startDate && i.endDate)

  // SPI = Earned Value / Planned Value
  // EV = average percent complete of items whose planned period has started
  // PV = % of items that should have started + completed based on today
  const today = new Date()

  const plannedDone = itemsWithDates.filter(i => {
    const end = new Date(i.endDate)
    return end < today
  })
  const plannedStarted = itemsWithDates.filter(i => {
    const start = new Date(i.startDate)
    return start <= today
  })

  const earnedValue = plannedStarted.length > 0
    ? plannedStarted.reduce((sum, i) => sum + i.percentComplete, 0) / (plannedStarted.length * 100)
    : null

  const plannedValue = itemsWithDates.length > 0
    ? plannedDone.length / itemsWithDates.length
    : null

  const spi = (earnedValue !== null && plannedValue !== null && plannedValue > 0)
    ? Math.round((earnedValue / plannedValue) * 100) / 100
    : null

  const behindCount = itemsWithDates.filter(i => {
    const end = new Date(i.endDate)
    return end < today && i.percentComplete < 100
  }).length

  const onTrackCount = itemsWithDates.filter(i => {
    const end = new Date(i.endDate)
    return end >= today || i.percentComplete === 100
  }).length

  const overallPct = items.length > 0
    ? Math.round(items.reduce((s, i) => s + i.percentComplete, 0) / items.length)
    : 0

  return {
    items, loading, seeding,
    seedDefaults, addItem, updateItem, deleteItem,
    spi, behindCount, onTrackCount, overallPct,
  }
}
