import { useState, useEffect } from 'react'
import { signOut, updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import { doc, updateDoc, setDoc, getDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { useNavigate } from 'react-router-dom'
import { User, Lock, LogOut, Save, Shield, Bell, Key, Eye, EyeOff, Check, Tag, Plus, Trash2, Database } from 'lucide-react'
import { clsx } from 'clsx'
import { useProjectTypes } from '@/hooks/useProjectTypes'
import { useProjects } from '@/hooks/useProjects'

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-700">
        <Icon size={16} className="text-slate-400" />
        <h2 className="text-slate-100 font-semibold text-sm">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-slate-400 text-xs font-medium mb-1.5">{label}</label>
      {children}
    </div>
  )
}

const inp = () => clsx('w-full bg-slate-900 text-slate-100 text-sm rounded-lg px-3 py-2.5 border border-slate-700 focus:outline-none focus:border-blue-500 placeholder-slate-500 disabled:opacity-50 disabled:cursor-not-allowed')

// ─── API Key row ──────────────────────────────────────────────────────────────

// ─── Project Types section ────────────────────────────────────────────────────

function ProjectTypesSection() {
  const { types, addType, removeType } = useProjectTypes()
  const [code, setCode] = useState('')
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleAdd = async () => {
    const trimCode = code.trim().toUpperCase()
    const trimLabel = label.trim()
    if (!trimCode || !trimLabel) { setError('Both code and label are required.'); return }
    if (types.find(t => t.code === trimCode)) { setError(`Code "${trimCode}" already exists.`); return }
    setSaving(true)
    setError('')
    try {
      await addType(trimCode, trimLabel)
      setCode('')
      setLabel('')
    } catch (e) {
      setError((e as Error).message ?? 'Failed to save. Check Firestore permissions.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section title="Project Types" icon={Tag}>
      <div className="space-y-4">
        <p className="text-xs text-slate-500">
          Define the project classification types used across the app (e.g. Light, Standard, Enhanced). Changes apply immediately to all project forms and filters.
        </p>

        {/* Existing types */}
        <div className="space-y-2">
          {types.map(t => (
            <div key={t.code} className="flex items-center justify-between px-3 py-2 bg-slate-900/60 rounded-lg border border-slate-700">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-blue-300 bg-blue-900/40 px-2 py-0.5 rounded">{t.code}</span>
                <span className="text-sm text-slate-200">{t.label}</span>
              </div>
              {types.length > 1 && (
                <button
                  onClick={() => removeType(t.code)}
                  className="p-1 text-slate-600 hover:text-red-400 transition-colors"
                  title={`Remove ${t.label}`}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add new type */}
        <div className="border-t border-slate-700 pt-4 space-y-3">
          <p className="text-xs font-medium text-slate-400">Add New Type</p>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={e => { setCode(e.target.value.toUpperCase()); setError('') }}
              placeholder="Code (e.g. XL)"
              maxLength={5}
              className="w-24 bg-slate-900 text-slate-100 text-sm rounded-lg px-3 py-2 border border-slate-700 focus:outline-none focus:border-blue-500 placeholder-slate-600 font-mono uppercase"
            />
            <input
              value={label}
              onChange={e => { setLabel(e.target.value); setError('') }}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
              placeholder="Label (e.g. Extra Large)"
              className="flex-1 bg-slate-900 text-slate-100 text-sm rounded-lg px-3 py-2 border border-slate-700 focus:outline-none focus:border-blue-500 placeholder-slate-600"
            />
            <button
              onClick={handleAdd}
              disabled={saving || !code.trim() || !label.trim()}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-2 rounded-lg disabled:opacity-50 transition-colors shrink-0"
            >
              <Plus size={14} /> {saving ? 'Adding…' : 'Add'}
            </button>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      </div>
    </Section>
  )
}

// ─── Data Audit section ───────────────────────────────────────────────────────

const AUDIT_COLLECTIONS = [
  { key: 'scheduleItems',    label: 'Schedule Items' },
  { key: 'changeOrders',     label: 'Change Orders' },
  { key: 'rfis',             label: 'RFIs' },
  { key: 'submittals',       label: 'Submittals' },
  { key: 'bids',             label: 'Bid Log' },
  { key: 'punchList',        label: 'Punch List' },
  { key: 'raidLog',          label: 'RAID Log' },
  { key: 'budgetItems',      label: 'Budget Items' },
  { key: 'tasks',            label: 'Tasks' },
  { key: 'milestones',       label: 'Milestones' },
  { key: 'meetingNotes',     label: 'Meeting Notes' },
  { key: 'projectDocuments', label: 'Documents' },
] as const

type AuditCounts = Partial<Record<string, number>>

function DataAuditSection() {
  const { projects } = useProjects()
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [counts, setCounts] = useState<AuditCounts>({})
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [auditDone, setAuditDone] = useState(false)

  const runAudit = async () => {
    if (!selectedProjectId) return
    setLoading(true)
    setAuditDone(false)
    const result: AuditCounts = {}
    await Promise.all(
      AUDIT_COLLECTIONS.map(async ({ key }) => {
        const snap = await getDocs(query(collection(db, key), where('projectId', '==', selectedProjectId)))
        result[key] = snap.size
      })
    )
    setCounts(result)
    setAuditDone(true)
    setLoading(false)
  }

  const clearCollection = async (colKey: string, label: string) => {
    if (!selectedProjectId) return
    if (!confirm(`Delete ALL ${label} for this project? This cannot be undone.`)) return
    setDeleting(colKey)
    const snap = await getDocs(query(collection(db, colKey), where('projectId', '==', selectedProjectId)))
    const batch = writeBatch(db)
    snap.docs.forEach(d => batch.delete(d.ref))
    await batch.commit()
    setCounts(prev => ({ ...prev, [colKey]: 0 }))
    setDeleting(null)
  }

  const totalItems = Object.values(counts).reduce((s: number, n) => s + (n ?? 0), 0)

  return (
    <Section title="Data Audit" icon={Database}>
      <div className="space-y-4">
        <p className="text-xs text-slate-500">
          Inspect and clean up data for a specific project. Use this to find and remove any items that were imported or seeded accidentally.
        </p>

        {/* Project selector + run */}
        <div className="flex gap-2">
          <select
            value={selectedProjectId}
            onChange={e => { setSelectedProjectId(e.target.value); setAuditDone(false); setCounts({}) }}
            className="flex-1 bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
          >
            <option value="">Select a project…</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.projectName}</option>
            ))}
          </select>
          <button
            onClick={runAudit}
            disabled={!selectedProjectId || loading}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50 transition-colors shrink-0"
          >
            {loading ? (
              <><span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" /> Scanning…</>
            ) : 'Run Audit'}
          </button>
        </div>

        {/* Results */}
        {auditDone && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
              <span>Collection</span>
              <span>{totalItems} total items</span>
            </div>
            {AUDIT_COLLECTIONS.map(({ key, label }) => {
              const count = counts[key] ?? 0
              return (
                <div key={key} className={clsx(
                  'flex items-center justify-between px-3 py-2 rounded-lg border',
                  count > 0
                    ? 'bg-amber-900/20 border-amber-700/40'
                    : 'bg-slate-900/40 border-slate-700/50'
                )}>
                  <div className="flex items-center gap-2">
                    <span className={clsx(
                      'w-6 h-6 flex items-center justify-center text-xs font-bold rounded-full',
                      count > 0 ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-400'
                    )}>
                      {count}
                    </span>
                    <span className={clsx('text-sm', count > 0 ? 'text-slate-200' : 'text-slate-500')}>{label}</span>
                  </div>
                  {count > 0 && (
                    <button
                      onClick={() => clearCollection(key, label)}
                      disabled={deleting === key}
                      className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 border border-red-800/60 hover:border-red-700 px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {deleting === key ? (
                        <span className="animate-spin w-3 h-3 border border-red-400 border-t-transparent rounded-full" />
                      ) : (
                        <Trash2 size={11} />
                      )}
                      {deleting === key ? 'Deleting…' : `Clear ${count}`}
                    </button>
                  )}
                </div>
              )
            })}
            {totalItems === 0 && (
              <p className="text-xs text-emerald-400 text-center py-2">No data found in any collection for this project.</p>
            )}
          </div>
        )}
      </div>
    </Section>
  )
}

function ApiKeysSection() {
  const user = useAuthStore((s) => s.user)
  const [openai, setOpenai] = useState('')
  const [anthropic, setAnthropic] = useState('')
  const [showOpenai, setShowOpenai] = useState(false)
  const [showAnthropic, setShowAnthropic] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load from Firestore on mount, also sync to localStorage for runtime use
  useEffect(() => {
    if (!user?.uid) return
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      const keys = snap.data()?.apiKeys ?? {}
      const oai = keys.openai ?? ''
      const ant = keys.anthropic ?? ''
      setOpenai(oai)
      setAnthropic(ant)
      if (oai) localStorage.setItem('openai_api_key', oai)
      if (ant) localStorage.setItem('anthropic_api_key', ant)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [user?.uid])

  const save = async () => {
    if (!user?.uid) return
    const keys = { openai: openai.trim(), anthropic: anthropic.trim() }
    await setDoc(doc(db, 'users', user.uid), { apiKeys: keys }, { merge: true })
    // Keep localStorage in sync for runtime use
    if (keys.openai) localStorage.setItem('openai_api_key', keys.openai)
    else localStorage.removeItem('openai_api_key')
    if (keys.anthropic) localStorage.setItem('anthropic_api_key', keys.anthropic)
    else localStorage.removeItem('anthropic_api_key')
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) return null

  return (
    <Section title="AI API Keys" icon={Key}>
      <div className="space-y-6">
        <p className="text-xs text-slate-500 bg-slate-900/50 rounded-lg p-3 border border-slate-700">
          Keys are saved to your account and available on all devices. They are never shared with other users.
        </p>

        {/* OpenAI */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-slate-300 text-sm font-medium">OpenAI API Key</label>
            {openai && <span className="text-xs text-emerald-400 flex items-center gap-1"><Check size={11} /> Configured</span>}
          </div>
          <p className="text-xs text-slate-500">Used for AI Schedule Generator, Meeting Notes summary, and Project Brief · <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Get API key</a></p>
          <div className="relative">
            <input
              type={showOpenai ? 'text' : 'password'}
              value={openai}
              onChange={e => setOpenai(e.target.value)}
              placeholder={openai ? '••••••••••••••••' : 'Paste your API key here'}
              className="w-full bg-slate-900 text-slate-100 text-sm rounded-lg px-3 py-2.5 pr-10 border border-slate-700 focus:outline-none focus:border-blue-500 placeholder-slate-600 font-mono"
            />
            <button type="button" onClick={() => setShowOpenai(!showOpenai)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              {showOpenai ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        <div className="border-t border-slate-700" />

        {/* Anthropic */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-slate-300 text-sm font-medium">Anthropic (Claude) API Key</label>
            {anthropic && <span className="text-xs text-emerald-400 flex items-center gap-1"><Check size={11} /> Configured</span>}
          </div>
          <p className="text-xs text-slate-500">Powers the AI Assistant chat, project brief, risk insights, and meeting notes · <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Get API key</a></p>
          <div className="relative">
            <input
              type={showAnthropic ? 'text' : 'password'}
              value={anthropic}
              onChange={e => setAnthropic(e.target.value)}
              placeholder={anthropic ? '••••••••••••••••' : 'Paste your API key here'}
              className="w-full bg-slate-900 text-slate-100 text-sm rounded-lg px-3 py-2.5 pr-10 border border-slate-700 focus:outline-none focus:border-blue-500 placeholder-slate-600 font-mono"
            />
            <button type="button" onClick={() => setShowAnthropic(!showAnthropic)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              {showAnthropic ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        <button
          onClick={save}
          className={clsx('flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors', saved ? 'bg-emerald-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white')}
        >
          {saved ? <><Check size={14} /> Saved</> : <><Save size={14} /> Save API Keys</>}
        </button>
      </div>
    </Section>
  )
}

// ─── Main settings page ───────────────────────────────────────────────────────

export function SettingsPage() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  // Profile form
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState('')

  // Password form
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const isGoogleUser = auth.currentUser?.providerData.some(p => p.providerId === 'google.com')

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!displayName.trim() || !auth.currentUser || !user) return
    setProfileSaving(true)
    setProfileMsg('')
    try {
      await updateProfile(auth.currentUser, { displayName: displayName.trim() })
      await updateDoc(doc(db, 'users', user.uid), { displayName: displayName.trim(), updatedAt: new Date().toISOString() })
      setProfileMsg('Profile updated.')
    } catch {
      setProfileMsg('Failed to update profile.')
    } finally {
      setProfileSaving(false)
    }
  }

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordMsg('')
    if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match.'); return }
    if (newPassword.length < 6) { setPasswordError('Password must be at least 6 characters.'); return }
    if (!auth.currentUser?.email) return
    setPasswordSaving(true)
    try {
      const cred = EmailAuthProvider.credential(auth.currentUser.email, currentPassword)
      await reauthenticateWithCredential(auth.currentUser, cred)
      await updatePassword(auth.currentUser, newPassword)
      setPasswordMsg('Password updated successfully.')
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? ''
      setPasswordError(
        code === 'auth/wrong-password' ? 'Current password is incorrect.' :
        code === 'auth/too-many-requests' ? 'Too many attempts. Try again later.' :
        'Failed to update password.'
      )
    } finally {
      setPasswordSaving(false)
    }
  }

  const handleSignOut = async () => {
    await signOut(auth)
    navigate('/login')
  }

  return (

    <div className="space-y-5 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Settings</h1>
        <p className="text-slate-400 text-sm mt-1">Manage your account and preferences</p>
      </div>

      {/* Profile */}
      <Section title="Profile" icon={User}>
        <form onSubmit={saveProfile} className="space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-4 mb-2">
            <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-bold shrink-0">
              {(displayName || user?.displayName || 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-slate-200 font-medium">{user?.displayName}</p>
              <p className="text-slate-500 text-sm">{user?.email}</p>
              <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded mt-1 inline-block capitalize">{user?.role}</span>
            </div>
          </div>

          <Field label="Display Name">
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} className={inp()} />
          </Field>
          <Field label="Email">
            <input value={user?.email ?? ''} disabled className={inp()} />
          </Field>

          {profileMsg && (
            <p className="text-sm text-emerald-400">{profileMsg}</p>
          )}

          <button type="submit" disabled={profileSaving} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
            <Save size={14} />
            {profileSaving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </Section>

      {/* Password — only for email/password users */}
      {!isGoogleUser && (
        <Section title="Change Password" icon={Lock}>
          <form onSubmit={savePassword} className="space-y-4">
            <Field label="Current Password">
              <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className={inp()} required />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="New Password">
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={6} className={inp()} required />
              </Field>
              <Field label="Confirm New Password">
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inp()} required />
              </Field>
            </div>
            {passwordError && <p className="text-sm text-red-400">{passwordError}</p>}
            {passwordMsg && <p className="text-sm text-emerald-400">{passwordMsg}</p>}
            <button type="submit" disabled={passwordSaving} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
              <Lock size={14} />
              {passwordSaving ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </Section>
      )}

      {isGoogleUser && (
        <Section title="Authentication" icon={Shield}>
          <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg">
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <div>
              <p className="text-slate-200 text-sm font-medium">Signed in with Google</p>
              <p className="text-slate-500 text-xs">Password management is handled by Google</p>
            </div>
          </div>
        </Section>
      )}

      {/* Project Types */}
      <ProjectTypesSection />

      {/* Data Audit */}
      <DataAuditSection />

      {/* API Keys */}
      <ApiKeysSection />

      {/* Notifications placeholder */}
      <Section title="Notifications" icon={Bell}>
        <p className="text-slate-500 text-sm">Email and push notification preferences — coming soon.</p>
      </Section>

      {/* App info */}
      <Section title="About" icon={Shield}>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">App</span>
            <span className="text-slate-300">ProjeX</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Firebase Project</span>
            <span className="text-slate-300">portfolio-f86b9</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">User ID</span>
            <span className="text-slate-400 text-xs font-mono truncate max-w-48">{user?.uid}</span>
          </div>
        </div>
      </Section>

      {/* Sign out */}
      <div className="pb-4">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 border border-red-800 text-red-400 hover:bg-red-900/20 text-sm font-medium py-3 rounded-xl transition-colors"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </div>
  )
}
