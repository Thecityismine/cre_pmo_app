import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export type BidStatus = 'invited' | 'bid-received' | 'awarded' | 'rejected' | 'no-bid'

export interface BidItem {
  id: string
  projectId: string
  vendor: string
  trade: string
  bidAmount: number
  status: BidStatus
  contact: string
  notes: string
  bidDueDate: string
  submittedDate: string
  createdAt: string
  updatedAt: string
}

export function useBidLog(projectId: string | undefined) {
  const [bids, setBids] = useState<BidItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) { setLoading(false); return }
    const q = query(collection(db, 'bids'), where('projectId', '==', projectId))
    const unsub = onSnapshot(q, snap => {
      const sorted = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as BidItem))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      setBids(sorted)
      setLoading(false)
    })
    return unsub
  }, [projectId])

  const addBid = async (data: Omit<BidItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> => {
    await addDoc(collection(db, 'bids'), {
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }

  const updateBid = (id: string, data: Partial<BidItem>) =>
    updateDoc(doc(db, 'bids', id), { ...data, updatedAt: new Date().toISOString() })

  const deleteBid = (id: string) => deleteDoc(doc(db, 'bids', id))

  const awardedBids   = bids.filter(b => b.status === 'awarded')
  const pendingBids   = bids.filter(b => b.status === 'invited' || b.status === 'bid-received')
  const awardedTotal  = awardedBids.reduce((s, b) => s + (b.bidAmount || 0), 0)
  const receivedCount = bids.filter(b => b.status === 'bid-received').length

  return { bids, loading, addBid, updateBid, deleteBid, awardedBids, pendingBids, awardedTotal, receivedCount }
}
