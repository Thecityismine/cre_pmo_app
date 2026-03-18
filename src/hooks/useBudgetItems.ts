import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface BudgetItem {
  id: string
  projectId: string
  category: string
  description: string
  budgetAmount: number
  committedAmount: number
  forecastAmount: number
  actualAmount: number
  variance: number
  notes: string
  costToComplete?: number   // ETC: estimate to complete (auto-computes forecast when set)
  createdAt: string
  updatedAt: string
}

export function useBudgetItems(projectId: string | undefined) {
  const [items, setItems] = useState<BudgetItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) { setLoading(false); return }
    const q = query(
      collection(db, 'budgetItems'),
      where('projectId', '==', projectId),
    )
    const unsub = onSnapshot(q, (snap) => {
      const sorted = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as BudgetItem))
        .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
      setItems(sorted)
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [projectId])

  return { items, loading }
}
