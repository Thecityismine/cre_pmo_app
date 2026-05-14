import { useState } from 'react'
import { clsx } from 'clsx'
import { X, Search, UserPlus, Users } from 'lucide-react'
import { useContacts } from '@/hooks/useContacts'
import type { NewTeamMember } from '@/hooks/useProjectTeam'

const ROLE_LABELS: Record<string, string> = {
  'project-manager': 'Project Manager', 'project-executive': 'Project Executive',
  'owners-rep': "Owner's Rep", 'architect': 'Architect', 'aor': 'Architect of Record',
  'general-contractor': 'General Contractor', 'mep-engineer': 'MEP Engineer',
  'structural': 'Structural Engineer', 'civil': 'Civil Engineer',
  'it-vendor': 'IT Vendor', 'av-vendor': 'AV Vendor', 'security': 'Security Vendor',
  'client-rep': 'Client Rep', 'll-rep': 'LL Rep', 'ff-and-e': 'FF&E Vendor',
  'legal': 'Legal', 'accounting': 'Accounting', 'facilities': 'Facilities', 'other': 'Other',
}

const ROLES = Object.keys(ROLE_LABELS)

function avatarColor(name: string) {
  const colors = ['bg-blue-700', 'bg-emerald-700', 'bg-purple-700', 'bg-amber-700', 'bg-cyan-700', 'bg-rose-700']
  return colors[name.charCodeAt(0) % colors.length]
}

function inp() {
  return 'w-full bg-slate-800 text-slate-100 text-sm rounded-lg px-3 py-2.5 border border-slate-700 focus:outline-none focus:border-blue-500 placeholder-slate-500'
}

interface Props {
  projectId: string
  existingNames: Set<string>
  onAdd: (member: NewTeamMember) => Promise<void>
  onClose: () => void
}

export function AddTeamMemberModal({ projectId, existingNames, onAdd, onClose }: Props) {
  const { contacts } = useContacts()
  const [mode, setMode] = useState<'directory' | 'new'>('directory')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', company: '', role: 'other', email: '', phone: '' })

  const available = contacts.filter(c => {
    const notOnTeam = !existingNames.has(c.name.trim().toLowerCase())
    const q = search.toLowerCase()
    const matchSearch = !q ||
      c.name.toLowerCase().includes(q) ||
      c.company.toLowerCase().includes(q) ||
      (ROLE_LABELS[c.role] ?? c.role).toLowerCase().includes(q)
    return notOnTeam && matchSearch
  })

  const handleAddFromDirectory = async (contactId: string) => {
    const contact = contacts.find(c => c.id === contactId)
    if (!contact) return
    setSaving(true)
    try {
      await onAdd({
        projectId,
        name: contact.name,
        company: contact.company,
        role: contact.role,
        email: contact.email,
        phone: contact.phone,
        trades: contact.trades ?? [],
      })
    } finally {
      setSaving(false)
    }
  }

  const handleAddNew = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await onAdd({
        projectId,
        name: form.name.trim(),
        company: form.company.trim(),
        role: form.role,
        email: form.email.trim(),
        phone: form.phone.trim(),
        trades: [],
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-lg bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <UserPlus size={16} className="text-blue-400" />
            <h2 className="text-slate-100 font-semibold">Add Team Member</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1">
            <X size={18} />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-1 p-3 border-b border-slate-800 shrink-0">
          <button
            onClick={() => setMode('directory')}
            className={clsx(
              'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors',
              mode === 'directory' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            )}
          >
            <Users size={14} /> From Directory
          </button>
          <button
            onClick={() => setMode('new')}
            className={clsx(
              'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors',
              mode === 'new' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            )}
          >
            <UserPlus size={14} /> New Member
          </button>
        </div>

        {/* Content */}
        {mode === 'directory' ? (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="p-3 border-b border-slate-800 shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name, company, or role..."
                  className="w-full bg-slate-800 text-slate-200 placeholder-slate-500 text-sm rounded-lg pl-9 pr-3 py-2.5 border border-slate-700 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-3 space-y-2">
              {available.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-sm">
                  {contacts.length === 0
                    ? 'No contacts in directory yet.'
                    : search
                      ? 'No contacts match your search.'
                      : 'All contacts are already on this project.'}
                </div>
              ) : (
                available.map(c => (
                  <button
                    key={c.id}
                    disabled={saving}
                    onClick={() => handleAddFromDirectory(c.id)}
                    className="w-full flex items-center gap-3 p-3 bg-slate-800/50 hover:bg-slate-800 rounded-xl text-left transition-colors disabled:opacity-50"
                  >
                    <div className={clsx('w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0', avatarColor(c.name))}>
                      {c.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-100 text-sm font-medium truncate">{c.name}</p>
                      <p className="text-slate-400 text-xs truncate">{c.company} · {ROLE_LABELS[c.role] ?? c.role}</p>
                    </div>
                    {c.email && <p className="text-slate-500 text-xs truncate hidden sm:block max-w-[140px]">{c.email}</p>}
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleAddNew} className="p-5 space-y-3 overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 text-xs mb-1.5 block">Name *</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" className={inp()} />
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1.5 block">Company</label>
                <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Company" className={inp()} />
              </div>
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1.5 block">Role</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className={inp()}>
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 text-xs mb-1.5 block">Email</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@company.com" className={inp()} />
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1.5 block">Phone</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone" className={inp()} />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose} className="flex-1 border border-slate-700 text-slate-300 text-sm py-2.5 rounded-lg hover:bg-slate-800">
                Cancel
              </button>
              <button type="submit" disabled={saving || !form.name.trim()} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm py-2.5 rounded-lg transition-colors">
                {saving ? 'Adding...' : 'Add Member'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
