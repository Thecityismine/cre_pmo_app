import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { BottomNav } from './BottomNav'
import { AIChatDrawer, useAIChatShortcut } from '@/components/AIChatDrawer'
import { useBackup } from '@/hooks/useBackup'

export function AppLayout() {
  const [aiOpen, setAiOpen] = useState(false)
  useAIChatShortcut(() => setAiOpen(o => !o))
  const { runAutoBackupIfDue } = useBackup()

  useEffect(() => {
    runAutoBackupIfDue()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-950">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar onAIOpen={() => setAiOpen(true)} />
        <main className="app-main flex-1 overflow-y-auto p-4 pb-24 md:p-6 md:pb-6">
          <Outlet />
        </main>
      </div>
      <BottomNav />
      <AIChatDrawer open={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
  )
}
