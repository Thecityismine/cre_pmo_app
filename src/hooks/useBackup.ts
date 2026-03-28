import { useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'

const BACKUP_COLLECTIONS = [
  'projects', 'budgetItems', 'tasks', 'projectTasks', 'scheduleItems',
  'changeOrders', 'rfis', 'submittals', 'bids', 'punchList', 'raidLog',
  'milestones', 'meetingNotes', 'projectDocuments', 'projectTeam',
  'contacts', 'masterTasks', 'masterScheduleActivities', 'settings',
]

const LAST_BACKUP_KEY = 'projex_last_backup'
const LAST_AUTO_BACKUP_KEY = 'projex_last_auto_backup'

export function useBackup() {
  const [loading, setLoading] = useState(false)
  const [lastBackup, setLastBackup] = useState<string | null>(
    () => localStorage.getItem(LAST_BACKUP_KEY)
  )

  const runBackup = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const data: Record<string, object[]> = {}
      await Promise.all(
        BACKUP_COLLECTIONS.map(async (col) => {
          const snap = await getDocs(collection(db, col))
          data[col] = snap.docs.map(d => ({ _id: d.id, ...d.data() }))
        })
      )

      const payload = {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        collections: data,
      }

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const dateStr = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `cre-pmo-backup-${dateStr}.json`
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 10000)

      const now = new Date().toISOString()
      localStorage.setItem(LAST_BACKUP_KEY, now)
      setLastBackup(now)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  /** Call on app load — auto-backups every Sunday if not already done today */
  const runAutoBackupIfDue = async () => {
    const today = new Date()
    if (today.getDay() !== 0) return // not Sunday
    const todayStr = today.toISOString().slice(0, 10)
    const lastAuto = localStorage.getItem(LAST_AUTO_BACKUP_KEY)
    if (lastAuto === todayStr) return // already ran today
    await runBackup(true)
    localStorage.setItem(LAST_AUTO_BACKUP_KEY, todayStr)
  }

  return { loading, lastBackup, runBackup, runAutoBackupIfDue }
}
