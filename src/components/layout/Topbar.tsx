import { Bell, Search, User, X } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AIChatButton } from '@/components/AIChatDrawer'
import { usePortfolioTasks } from '@/hooks/usePortfolioTasks'

export function Topbar({ onAIOpen }: { onAIOpen?: () => void }) {
  const user = useAuthStore((s) => s.user)
  const [searchOpen, setSearchOpen] = useState(false)
  const { overdueCount } = usePortfolioTasks()

  return (
    <header className="topbar bg-slate-900 border-b border-slate-600 shrink-0"><div className="h-14 flex items-center justify-between px-4 md:px-6">

      {/* Mobile: search overlay toggle / Desktop: inline search */}
      {searchOpen ? (
        <div className="flex-1 flex items-center gap-2 md:hidden">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              type="text"
              placeholder="Search projects..."
              className="w-full bg-slate-900 text-slate-200 placeholder-slate-500 text-sm rounded-lg pl-9 pr-4 py-2 border border-slate-600 focus:outline-none focus:border-blue-500"
            />
          </div>
          <button onClick={() => setSearchOpen(false)} className="text-slate-400 p-1">
            <X size={18} />
          </button>
        </div>
      ) : (
        <>
          {/* Desktop logo */}
          <img src="/App-Logo.png" alt="ProjeX" className="hidden md:block h-8 w-auto object-contain mr-4"  />

          {/* Desktop search */}
          <div className="relative hidden md:block">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search projects..."
              className="bg-slate-900 text-slate-200 placeholder-slate-500 text-sm rounded-lg pl-9 pr-4 py-2 w-48 lg:w-64 border border-slate-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Mobile: app logo */}
          <img src="/App-Logo.png" alt="ProjeX" className="h-8 w-auto object-contain md:hidden"  />

          {/* Right actions */}
          <div className="flex items-center gap-2 md:gap-3">
            {onAIOpen && <AIChatButton onClick={onAIOpen} />}
            {/* Mobile search icon */}
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2 text-slate-400 hover:text-slate-200 rounded-lg md:hidden"
            >
              <Search size={18} />
            </button>

            <button className="relative p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-lg transition-colors" title={overdueCount > 0 ? `${overdueCount} overdue task${overdueCount > 1 ? 's' : ''}` : 'No overdue tasks'}>
              <Bell size={18} />
              {overdueCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 rounded-full flex items-center justify-center px-0.5">
                  <span className="text-[9px] font-bold text-white leading-none">{overdueCount > 9 ? '9+' : overdueCount}</span>
                </span>
              )}
            </button>

            <Link to="/settings" className="flex items-center gap-2 pl-2 md:pl-3 border-l border-slate-600 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName ?? ''} className="w-8 h-8 rounded-full" />
                ) : (
                  <User size={16} className="text-white" />
                )}
              </div>
              <div className="hidden lg:block">
                <p className="text-sm text-slate-200 leading-none truncate max-w-32">{user?.displayName ?? 'User'}</p>
                <p className="text-xs text-slate-400 mt-0.5">{user?.role ?? ''}</p>
              </div>
            </Link>
          </div>
        </>
      )}
    </div></header>
  )
}
