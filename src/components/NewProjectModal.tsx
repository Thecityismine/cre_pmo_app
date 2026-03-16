import { useState } from 'react'
import { collection, addDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { X } from 'lucide-react'
import { clsx } from 'clsx'
import type { ProjectProfile, ProjectStatus } from '@/types'

interface Props {
  onClose: () => void
}

const STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: 'pre-project', label: 'Pre-Project' },
  { value: 'initiate', label: 'Initiate' },
  { value: 'planning', label: 'Planning' },
  { value: 'design', label: 'Design' },
  { value: 'construction', label: 'Construction' },
  { value: 'handover', label: 'Handover' },
  { value: 'closeout', label: 'Closeout' },
  { value: 'closed', label: 'Closed' },
]

export function NewProjectModal({ onClose }: Props) {
  const user = useAuthStore((s) => s.user)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    projectName: '',
    projectNumber: '',
    profile: 'S' as ProjectProfile,
    status: 'planning' as ProjectStatus,
    clientName: 'JPMorgan Chase',
    businessUnit: '',
    projectManager: user?.displayName ?? '',
    address: '',
    city: '',
    state: '',
    country: 'USA',
    rsf: '',
    totalBudget: '',
    targetCompletionDate: '',
    startDate: '',
    hasMER: false,
  })

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.projectName.trim()) { setError('Project name is required.'); return }
    setSaving(true)
    setError('')
    try {
      const now = new Date().toISOString()
      await addDoc(collection(db, 'projects'), {
        projectName:          form.projectName.trim(),
        projectNumber:        form.projectNumber.trim(),
        profile:              form.profile,
        status:               form.status,
        currentPhase:         '',
        clientName:           form.clientName,
        businessUnit:         form.businessUnit,
        projectManager:       form.projectManager,
        teamMembers:          [],
        address:              form.address,
        city:                 form.city,
        state:                form.state,
        country:              form.country,
        lat:                  null,
        lng:                  null,
        rsf:                  form.rsf ? Number(form.rsf) : null,
        totalBudget:          form.totalBudget ? Number(form.totalBudget) : 0,
        committedCost:        0,
        forecastCost:         form.totalBudget ? Number(form.totalBudget) : 0,
        actualCost:           0,
        contingencyPercent:   10,
        startDate:            form.startDate,
        targetCompletionDate: form.targetCompletionDate,
        actualCompletionDate: null,
        isActive:             form.status !== 'closed',
        hasMER:               form.hasMER,
        archived:             false,
        createdAt:            now,
        updatedAt:            now,
        createdBy:            user?.uid ?? '',
      })
      onClose()
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Failed to create project.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative z-10 w-full sm:max-w-2xl bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
          <h2 className="text-slate-100 font-semibold text-lg">New Project</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="p-6 space-y-5">
            {error && (
              <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-3">{error}</div>
            )}

            {/* Project Name */}
            <Field label="Project Name *">
              <input
                value={form.projectName}
                onChange={e => set('projectName', e.target.value)}
                placeholder="Las Olas 23rd Floor Expansion"
                className={input()}
                required
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Project Number (SO#)">
                <input value={form.projectNumber} onChange={e => set('projectNumber', e.target.value)} placeholder="SO09897" className={input()} />
              </Field>
              <Field label="Profile">
                <select value={form.profile} onChange={e => set('profile', e.target.value)} className={input()}>
                  <option value="L">Light (L)</option>
                  <option value="S">Standard (S)</option>
                  <option value="E">Enhanced (E)</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Status">
                <select value={form.status} onChange={e => set('status', e.target.value)} className={input()}>
                  {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>
              <Field label="RSF (sq ft)">
                <input type="number" value={form.rsf} onChange={e => set('rsf', e.target.value)} placeholder="5000" className={input()} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Client">
                <input value={form.clientName} onChange={e => set('clientName', e.target.value)} className={input()} />
              </Field>
              <Field label="Business Unit">
                <input value={form.businessUnit} onChange={e => set('businessUnit', e.target.value)} placeholder="CB&W / IB" className={input()} />
              </Field>
            </div>

            <Field label="Project Manager">
              <input value={form.projectManager} onChange={e => set('projectManager', e.target.value)} className={input()} />
            </Field>

            <Field label="Address">
              <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="123 Main St" className={input()} />
            </Field>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Field label="City">
                  <input value={form.city} onChange={e => set('city', e.target.value)} placeholder="New York" className={input()} />
                </Field>
              </div>
              <Field label="State">
                <input value={form.state} onChange={e => set('state', e.target.value)} placeholder="NY" className={input()} />
              </Field>
            </div>

            <Field label="Approved Budget ($)">
              <input type="number" value={form.totalBudget} onChange={e => set('totalBudget', e.target.value)} placeholder="5000000" className={input()} />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Start Date">
                <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} className={input()} />
              </Field>
              <Field label="Target Completion">
                <input type="date" value={form.targetCompletionDate} onChange={e => set('targetCompletionDate', e.target.value)} className={input()} />
              </Field>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.hasMER}
                onChange={e => set('hasMER', e.target.checked)}
                className="w-4 h-4 rounded accent-blue-500"
              />
              <span className="text-slate-300 text-sm">MER (Mission-Critical Equipment Room) required</span>
            </label>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-700 flex gap-3 shrink-0">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-600 text-slate-300 text-sm hover:bg-slate-800 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
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

function input() {
  return clsx('w-full bg-slate-800 text-slate-100 text-sm rounded-lg px-3 py-2.5 border border-slate-700 focus:outline-none focus:border-blue-500 placeholder-slate-500')
}
