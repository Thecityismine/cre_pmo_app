import { useEffect, useState } from 'react'
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

/** True while the on-screen keyboard is open (visual viewport shrinks well below the layout viewport). */
function useKeyboardOpen() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const baseline = { h: window.innerHeight }
    const update = () => {
      // Android shrinks innerHeight with the keyboard; iOS only shrinks visualViewport.
      const focusedField = document.activeElement?.matches('input, textarea, select, [contenteditable="true"]') ?? false
      if (!focusedField) baseline.h = Math.max(window.innerHeight, vv.height)
      setOpen(focusedField && baseline.h - vv.height > 150)
    }
    vv.addEventListener('resize', update)
    window.addEventListener('focusin', update)
    window.addEventListener('focusout', update)
    return () => {
      vv.removeEventListener('resize', update)
      window.removeEventListener('focusin', update)
      window.removeEventListener('focusout', update)
    }
  }, [])
  return open
}

export function BottomNav() {
  const keyboardOpen = useKeyboardOpen()
  if (keyboardOpen) return null
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
