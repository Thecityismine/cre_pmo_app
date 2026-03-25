import { NavLink } from 'react-router-dom'
import { LayoutDashboard, FolderKanban, BarChart3, Users, ListTodo } from 'lucide-react'
import { clsx } from 'clsx'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/team', label: 'Team', icon: Users },
  { to: '/tasks', label: 'Tasks', icon: ListTodo },
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950 border-t border-slate-800/60 flex md:hidden">
      {navItems.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className="flex-1">
          {({ isActive }) => (
            <div className={clsx(
              'flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs transition-all relative',
              isActive ? 'text-blue-400' : 'text-slate-500'
            )}>
              {/* Active indicator line */}
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-400 rounded-full" />
              )}
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.75} />
              <span className={isActive ? 'font-semibold' : 'font-normal'}>{label}</span>
            </div>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
