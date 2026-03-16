import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore'
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
      orderBy('createdAt', 'asc')
    )
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as BudgetItem)))
      setLoading(false)
    })
    return unsub
  }, [projectId])

  return { items, loading }
}
