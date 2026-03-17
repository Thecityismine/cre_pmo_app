import { useEffect, useState } from 'react'
import {
  collection, onSnapshot, query, where,
  addDoc, updateDoc, deleteDoc, doc, Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

export type InsightSeverity = 'info' | 'warning' | 'critical'
export type InsightType = 'budget' | 'schedule' | 'risk' | 'task' | 'milestone'

export interface AIInsight {
  id: string
  projectId: string
  type: InsightType
  severity: InsightSeverity
  title: string
  body: string
  dismissedAt?: string
  createdAt: string
  expiresAt?: string
}

export function useAIInsights(projectId: string | undefined) {
  const [insights, setInsights] = useState<AIInsight[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) { setLoading(false); return }
    const q = query(collection(db, 'aiInsights'), where('projectId', '==', projectId))
    const unsub = onSnapshot(q, (snap) => {
      const now = new Date().toISOString()
      const items = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as AIInsight))
        .filter(i => !i.dismissedAt && (!i.expiresAt || i.expiresAt > now))
        .sort((a, b) => {
          const order = { critical: 0, warning: 1, info: 2 }
          return order[a.severity] - order[b.severity]
        })
      setInsights(items)
      setLoading(false)
    })
    return unsub
  }, [projectId])

  const dismiss = (id: string) =>
    updateDoc(doc(db, 'aiInsights', id), { dismissedAt: new Date().toISOString() })

  const addInsight = async (data: Omit<AIInsight, 'id' | 'createdAt'>) => {
    await addDoc(collection(db, 'aiInsights'), {
      ...data,
      createdAt: new Date().toISOString(),
    })
  }

  const deleteInsight = (id: string) => deleteDoc(doc(db, 'aiInsights', id))

  return { insights, loading, dismiss, addInsight, deleteInsight }
}

// ─── Portfolio-level (all active projects) ────────────────────────────────────

export function usePortfolioInsights(projectIds: string[]) {
  const [insights, setInsights] = useState<AIInsight[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (projectIds.length === 0) { setLoading(false); return }

    // Firestore 'in' queries limited to 30 items; chunk if needed
    const chunks: string[][] = []
    for (let i = 0; i < projectIds.length; i += 30) {
      chunks.push(projectIds.slice(i, i + 30))
    }

    const allItems: AIInsight[] = []
    let settled = 0
    const unsubs: (() => void)[] = []

    chunks.forEach(chunk => {
      const q = query(collection(db, 'aiInsights'), where('projectId', 'in', chunk))
      const unsub = onSnapshot(q, (snap) => {
        const now = new Date().toISOString()
        const items = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as AIInsight))
          .filter(i => !i.dismissedAt && (!i.expiresAt || i.expiresAt > now))

        // Replace this chunk's contribution in allItems
        items.forEach(item => {
          const idx = allItems.findIndex(a => a.id === item.id)
          if (idx >= 0) allItems[idx] = item
          else allItems.push(item)
        })

        settled++
        if (settled >= chunks.length) {
          const sorted = [...allItems].sort((a, b) => {
            const order = { critical: 0, warning: 1, info: 2 }
            return order[a.severity] - order[b.severity]
          })
          setInsights(sorted)
          setLoading(false)
        }
      })
      unsubs.push(unsub)
    })

    return () => unsubs.forEach(u => u())
  }, [projectIds.join(',')])  // eslint-disable-line react-hooks/exhaustive-deps

  return { insights, loading }
}
