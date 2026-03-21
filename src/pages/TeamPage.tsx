import { useState } from 'react'
import { useContacts } from '@/hooks/useContacts'
import { collection, addDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Plus, Search, Mail, Phone, Trash2, X, Pencil, Users } from 'lucide-react'
import { clsx } from 'clsx'
import type { Contact } from '@/hooks/useContacts'

const ROLE_COLORS: Record<string, string> = {
  'project-manager':   'bg-blue-900 text-blue-300',
  'project-executive': 'bg-purple-900 text-purple-300',
  'architect':         'bg-cyan-900 text-cyan-300',
  'general-contractor':'bg-amber-900 text-amber-300',
  'mep-engineer':      'bg-teal-900 text-teal-300',
  'it-vendor':         'bg-indigo-900 text-indigo-300',
  'client-rep':        'bg-emerald-900 text-emerald-300',
  'facilities':        'bg-orange-900 text-orange-300',
  'other':             'bg-slate-700 text-slate-300',
}

const ROLE_LABELS: Record<string, string> = {
  'project-manager':    'Project Manager',
  'project-executive':  'Project Executive',
  'architect':          'Architect',
  'general-contractor': 'General Contractor',
  'mep-engineer':       'MEP Engineer',
  'it-vendor':          'IT Vendor',
  'client-rep':         'Client Rep',
  'facilities':         'Facilities',
  'other':              'Other',
}

const ROLES = Object.keys(ROLE_LABELS)

// ─── Contact Card ─────────────────────────────────────────────────────────────
function ContactCard({ contact, onDelete }: { contact: Contact; onDelete: (id: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: contact.name, company: contact.company, role: contact.role, email: contact.email, phone: contact.phone, notes: contact.notes })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    await updateDoc(doc(db, 'contacts', contact.id), { ...form, updatedAt: new Date().toISOString() })
    setSaving(false)
    setEditing(false)
  }

  const initials = contact.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const colorIndex = contact.name.charCodeAt(0) % 6
  const avatarColors = ['bg-blue-700', 'bg-emerald-700', 'bg-purple-700', 'bg-amber-700', 'bg-cyan-700', 'bg-rose-700']

  if (editing) {
    return (
      <div className="bg-slate-900 border border-blue-600 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Name" className={inp()} />
          <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Company" className={inp()} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className={inp()}>
            {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Email" type="email" className={inp()} />
        </div>
        <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone" className={inp()} />
        <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes" rows={2} className={clsx(inp(), 'resize-none')} />
        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 rounded-lg disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={() => setEditing(false)} className="flex-1 border border-slate-800 text-slate-300 text-sm py-2 rounded-lg hover:bg-slate-700">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-800 transition-colors group">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className={clsx('w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0', avatarColors[colorIndex])}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-slate-100 font-medium text-sm truncate">{contact.name}</p>
              <p className="text-slate-400 text-xs truncate">{contact.company}</p>
            </div>
            <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => setEditing(true)} className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg">
                <Pencil size={13} />
              </button>
              <button onClick={() => onDelete(contact.id)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg">
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          <div className="mt-2">
            <span className={clsx('text-xs px-2 py-0.5 rounded font-medium', ROLE_COLORS[contact.role] ?? ROLE_COLORS.other)}>
              {ROLE_LABELS[contact.role] ?? contact.role}
            </span>
          </div>

          {/* Contact details */}
          <div className="mt-2 space-y-1">
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 truncate">
                <Mail size={11} />{contact.email}
              </a>
            )}
            {contact.phone && (
              <a href={`tel:${contact.phone}`} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200">
                <Phone size={11} />{contact.phone}
              </a>
            )}
          </div>

          {contact.notes && (
            <p className="mt-2 text-xs text-slate-400 line-clamp-2">{contact.notes}</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Add Contact Modal ─────────────────────────────────────────────────────────
function AddContactModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ name: '', company: '', role: 'other', email: '', phone: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    await addDoc(collection(db, 'contacts'), {
      ...form,
      projectId: null,
      trades: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-md bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="text-slate-100 font-semibold">Add Contact</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200"><X size={18} /></button>
        </div>
        <form onSubmit={save} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className={inp()} />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Company</label>
              <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} className={inp()} />
            </div>
          </div>
          <div>
            <label className="text-slate-400 text-xs mb-1 block">Role</label>
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className={inp()}>
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inp()} />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Phone</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inp()} />
            </div>
          </div>
          <div>
            <label className="text-slate-400 text-xs mb-1 block">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={clsx(inp(), 'resize-none')} />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-800 text-slate-300 text-sm py-2.5 rounded-lg hover:bg-slate-900">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm py-2.5 rounded-lg disabled:opacity-50">
              {saving ? 'Adding...' : 'Add Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export function TeamPage() {
  const { contacts, loading } = useContacts()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [showAdd, setShowAdd] = useState(false)

  const filtered = contacts.filter(c => {
    const matchSearch = !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.company.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === 'all' || c.role === roleFilter
    return matchSearch && matchRole
  })

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this contact?')) return
    await deleteDoc(doc(db, 'contacts', id))
  }

  const roleOptions = ['all', ...Array.from(new Set(contacts.map(c => c.role))).sort()]

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Contacts</h1>
          <p className="text-slate-400 text-sm mt-1">{contacts.length} contacts in directory</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shrink-0"
        >
          <Plus size={15} /> Add Contact
        </button>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, company, email..."
            className="w-full bg-slate-900 text-slate-200 placeholder-slate-500 text-sm rounded-xl pl-9 pr-4 py-2.5 border border-slate-800 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {roleOptions.map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize',
                roleFilter === r ? 'bg-blue-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
              )}
            >
              {r === 'all' ? `All (${contacts.length})` : ROLE_LABELS[r] ?? r}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-slate-900 border border-slate-800 rounded-xl">
          <Users size={36} className="mx-auto mb-3 opacity-30" />
          <p>{search ? `No contacts matching "${search}"` : 'No contacts yet.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(c => <ContactCard key={c.id} contact={c} onDelete={handleDelete} />)}
        </div>
      )}

      {showAdd && <AddContactModal onClose={() => setShowAdd(false)} />}
    </div>
  )
}

function inp() {
  return clsx('w-full bg-slate-900 text-slate-100 text-sm rounded-lg px-3 py-2 border border-slate-800 focus:outline-none focus:border-blue-500 placeholder-slate-500')
}
