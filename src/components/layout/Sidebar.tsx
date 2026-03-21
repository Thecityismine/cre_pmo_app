import {
  LayoutDashboard,
  FolderKanban,
  BarChart3,
  Users,
  CheckSquare,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import { clsx } from 'clsx'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/team', label: 'Team', icon: Users },
  { to: '/checklist', label: 'Checklist', icon: CheckSquare },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    // Hidden on mobile (bottom nav takes over), icon-only on tablet, full on desktop
    <aside
      className={clsx(
        'hidden md:flex flex-col h-screen bg-slate-900 border-r border-slate-600 transition-all duration-200 shrink-0',
        collapsed ? 'w-16' : 'lg:w-56 md:w-16'
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-center px-4 py-4 border-b border-slate-600 overflow-hidden">
        <img
          src="/App-Logo.png"
          alt="ProjeX"
          className={clsx('w-auto object-contain transition-all duration-200', collapsed ? 'h-7' : 'h-8')}
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              )
            }
          >
            <Icon size={18} className="shrink-0" />
            <span className={clsx(
              'truncate transition-all duration-200',
              collapsed ? 'hidden' : 'hidden lg:block'
            )}>
              {label}
            </span>
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle — desktop only */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden lg:flex items-center justify-center p-3 border-t border-slate-600 text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  )
}
