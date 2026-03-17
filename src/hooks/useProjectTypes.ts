import { useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface ProjectType {
  code: string
  label: string
}

const DEFAULTS: ProjectType[] = [
  { code: 'L', label: 'Light' },
  { code: 'S', label: 'Standard' },
  { code: 'E', label: 'Enhanced' },
]

const REF = doc(db, 'settings', 'projectTypes')

export function useProjectTypes() {
  const [types, setTypes] = useState<ProjectType[]>(DEFAULTS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onSnapshot(REF, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as { types: ProjectType[] }
        setTypes(data.types?.length ? data.types : DEFAULTS)
      } else {
        // First time — seed defaults into Firestore
        setDoc(REF, { types: DEFAULTS }).catch(() => {})
        setTypes(DEFAULTS)
      }
      setLoading(false)
    }, () => {
      setTypes(DEFAULTS)
      setLoading(false)
    })
    return unsub
  }, [])

  const addType = async (code: string, label: string) => {
    const trimCode = code.trim().toUpperCase()
    const trimLabel = label.trim()
    if (!trimCode || !trimLabel) return
    if (types.find(t => t.code === trimCode)) return
    const updated = [...types, { code: trimCode, label: trimLabel }]
    await setDoc(REF, { types: updated }, { merge: true })
  }

  const removeType = async (code: string) => {
    const updated = types.filter(t => t.code !== code)
    await setDoc(REF, { types: updated }, { merge: true })
  }

  return { types, loading, addType, removeType }
}
