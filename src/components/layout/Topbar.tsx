import { Bell, Search, User, X, AlertTriangle, Clock, ChevronRight, CheckSquare } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useState, useRef, useEffect } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { AIChatButton } from '@/components/AIChatDrawer'
import { usePortfolioTasks } from '@/hooks/usePortfolioTasks'
import { useProjects } from '@/hooks/useProjects'

const parseLocal = (d: string) => { const [y, m, day] = d.split('-').map(Number); return new Date(y, m - 1, day) }

const fmtDate = (d: string) =>
  d ? parseLocal(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''

export function Topbar({ onAIOpen }: { onAIOpen?: () => void }) {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const [searchOpen, setSearchOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  const { overdue, upcoming, overdueCount } = usePortfolioTasks()
  const { projects } = useProjects()
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p.projectName]))

  // Close panel when clicking outside
  useEffect(() => {
    if (!notifOpen) return
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [notifOpen])

  const totalCount = overdue.length + upcoming.length

  return (
    <header className="topbar bg-slate-950 shrink-0"><div className="h-14 flex items-center justify-between px-4 md:px-6">

      {/* Mobile: search overlay toggle / Desktop: inline search */}
      {searchOpen ? (
        <div className="flex-1 flex items-center gap-2 md:hidden">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              type="text"
              placeholder="Search projects..."
              className="w-full bg-slate-900 text-slate-200 placeholder-slate-500 text-sm rounded-lg pl-9 pr-4 py-2 border border-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>
          <button onClick={() => setSearchOpen(false)} className="text-slate-400 p-1">
            <X size={18} />
          </button>
        </div>
      ) : (
        <>
          {/* Desktop search */}
          <div className="relative hidden md:block">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search projects..."
              className="bg-slate-900 text-slate-200 placeholder-slate-500 text-sm rounded-lg pl-9 pr-4 py-2 w-48 lg:w-64 border border-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Mobile: app logo */}
          <img src="/App-Logo-v2.png" alt="ProjeX" className="h-8 w-auto object-contain md:hidden" />

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

            {/* Master Checklist shortcut */}
            <NavLink
              to="/checklist"
              className={({ isActive }) =>
                `p-2 rounded-lg transition-colors ${isActive ? 'text-blue-400 bg-blue-500/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'}`
              }
              title="Master Checklist"
            >
              <CheckSquare size={18} />
            </NavLink>

            {/* Bell with notification dropdown */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(o => !o)}
                className="relative p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-lg transition-colors"
                title={overdueCount > 0 ? `${overdueCount} overdue task${overdueCount > 1 ? 's' : ''}` : 'Notifications'}
              >
                <Bell size={18} />
                {overdueCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 rounded-full flex items-center justify-center px-0.5">
                    <span className="text-[9px] font-bold text-white leading-none">{overdueCount > 9 ? '9+' : overdueCount}</span>
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                    <p className="text-sm font-semibold text-slate-100">Notifications</p>
                    {totalCount > 0 && (
                      <span className="text-xs text-slate-400">{totalCount} item{totalCount !== 1 ? 's' : ''}</span>
                    )}
                  </div>

                  <div className="max-h-96 overflow-y-auto">
                    {totalCount === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <Bell size={24} className="mx-auto mb-2 text-slate-600" />
                        <p className="text-sm text-slate-400">All caught up!</p>
                        <p className="text-xs text-slate-500 mt-0.5">No overdue or upcoming tasks.</p>
                      </div>
                    ) : (
                      <>
                        {/* Overdue section */}
                        {overdue.length > 0 && (
                          <>
                            <div className="px-4 py-2 bg-red-950/30 border-b border-red-900/30">
                              <p className="text-xs font-semibold text-red-400 uppercase tracking-wide flex items-center gap-1">
                                <AlertTriangle size={10} /> Overdue — {overdue.length}
                              </p>
                            </div>
                            {overdue.map(t => (
                              <button
                                key={t.id}
                                onClick={() => {
                                  navigate('/tasks')
                                  setNotifOpen(false)
                                }}
                                className="w-full text-left px-4 py-3 border-b border-slate-800/60 hover:bg-slate-800/50 transition-colors group"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-slate-200 truncate">{t.title}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-xs text-red-400 font-medium">Due {fmtDate(t.dueDate)}</span>
                                      <span className="text-xs text-slate-500 truncate">{projectMap[t.projectId] ?? 'Unknown'}</span>
                                    </div>
                                  </div>
                                  <ChevronRight size={14} className="text-slate-600 group-hover:text-slate-400 mt-0.5 shrink-0" />
                                </div>
                              </button>
                            ))}
                          </>
                        )}

                        {/* Upcoming section */}
                        {upcoming.length > 0 && (
                          <>
                            <div className="px-4 py-2 bg-slate-800/40 border-b border-slate-700/40">
                              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                                <Clock size={10} /> Due Soon — {upcoming.length}
                              </p>
                            </div>
                            {upcoming.map(t => (
                              <button
                                key={t.id}
                                onClick={() => {
                                  navigate('/tasks')
                                  setNotifOpen(false)
                                }}
                                className="w-full text-left px-4 py-3 border-b border-slate-800/60 hover:bg-slate-800/50 transition-colors group"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-slate-200 truncate">{t.title}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-xs text-amber-400">Due {fmtDate(t.dueDate)}</span>
                                      <span className="text-xs text-slate-500 truncate">{projectMap[t.projectId] ?? 'Unknown'}</span>
                                    </div>
                                  </div>
                                  <ChevronRight size={14} className="text-slate-600 group-hover:text-slate-400 mt-0.5 shrink-0" />
                                </div>
                              </button>
                            ))}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <Link to="/settings" className="flex items-center gap-2 pl-2 md:pl-3 border-l border-slate-800 hover:opacity-80 transition-opacity">
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
