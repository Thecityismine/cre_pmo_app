import { Bell, Search, User } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

export function Topbar() {
  const user = useAuthStore((s) => s.user)

  return (
    <header className="h-14 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-6">
      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Search projects..."
          className="bg-slate-800 text-slate-200 placeholder-slate-500 text-sm rounded-lg pl-9 pr-4 py-2 w-64 border border-slate-700 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-3">
        <button className="relative p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>

        <div className="flex items-center gap-2 pl-3 border-l border-slate-700">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
            {user?.photoURL ? (
              <img src={user.photoURL} alt={user.displayName} className="w-8 h-8 rounded-full" />
            ) : (
              <User size={16} className="text-white" />
            )}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm text-slate-200 leading-none">{user?.displayName ?? 'User'}</p>
            <p className="text-xs text-slate-500 mt-0.5">{user?.role ?? ''}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
