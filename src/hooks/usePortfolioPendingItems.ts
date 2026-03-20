import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface PendingCO {
  id: string
  projectId: string
  title: string
  amount: number
  requestedBy?: string
  date?: string
}

export interface OpenRfi {
  id: string
  projectId: string
  subject: string
  number?: number | string
  assignedTo?: string
  dueDate?: string
  status: string
}

export function usePortfolioPendingItems() {
  const [pendingCOs, setPendingCOs] = useState<PendingCO[]>([])
  const [openRfis, setOpenRfis]     = useState<OpenRfi[]>([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    let cosDone  = false
    let rfisDone = false
    const done = () => { if (cosDone && rfisDone) setLoading(false) }

    // Pending change orders across all projects
    const q1 = query(collection(db, 'changeOrders'), where('status', '==', 'pending'))
    const unsub1 = onSnapshot(q1, snap => {
      setPendingCOs(snap.docs.map(d => {
        const data = d.data()
        return { id: d.id, projectId: data.projectId, title: data.title ?? 'Untitled CO', amount: data.amount ?? 0, requestedBy: data.requestedBy, date: data.date }
      }))
      cosDone = true; done()
    }, () => { cosDone = true; done() })

    // Open / draft RFIs across all projects
    const q2 = query(collection(db, 'rfis'), where('status', 'in', ['open', 'draft']))
    const unsub2 = onSnapshot(q2, snap => {
      setOpenRfis(snap.docs.map(d => {
        const data = d.data()
        return { id: d.id, projectId: data.projectId, subject: data.subject ?? 'Untitled RFI', number: data.number, assignedTo: data.assignedTo, dueDate: data.dueDate, status: data.status }
      }))
      rfisDone = true; done()
    }, () => { rfisDone = true; done() })

    return () => { unsub1(); unsub2() }
  }, [])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const overdueRfis = openRfis.filter(r => r.dueDate && new Date(r.dueDate) < today)
  const pendingCOTotal = pendingCOs.reduce((s, co) => s + co.amount, 0)

  return { loading, pendingCOs, openRfis, overdueRfis, pendingCOTotal }
}
