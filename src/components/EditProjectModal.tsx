import { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { X } from 'lucide-react'
import { clsx } from 'clsx'
import type { Project, ProjectProfile, ProjectStatus } from '@/types'

interface Props {
  project: Project
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
  { value: 'defect-period', label: 'Defect Period' },
  { value: 'closed', label: 'Closed' },
]

export function EditProjectModal({ project, onClose }: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    projectName:          project.projectName,
    projectNumber:        project.projectNumber ?? '',
    profile:              project.profile,
    status:               project.status,
    clientName:           project.clientName,
    businessUnit:         project.businessUnit ?? '',
    projectManager:       project.projectManager,
    address:              project.address,
    city:                 project.city,
    state:                project.state,
    country:              project.country,
    rsf:                  project.rsf ? String(project.rsf) : '',
    totalBudget:          project.totalBudget ? String(project.totalBudget) : '',
    committedCost:        project.committedCost ? String(project.committedCost) : '',
    forecastCost:         project.forecastCost ? String(project.forecastCost) : '',
    actualCost:           project.actualCost ? String(project.actualCost) : '',
    contingencyPercent:   project.contingencyPercent ? String(project.contingencyPercent) : '10',
    startDate:            project.startDate ?? '',
    targetCompletionDate: project.targetCompletionDate ?? '',
    hasMER:               project.hasMER,
    isActive:             project.isActive,
  })

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.projectName.trim()) { setError('Project name is required.'); return }
    setSaving(true)
    setError('')
    try {
      await updateDoc(doc(db, 'projects', project.id), {
        projectName:          form.projectName.trim(),
        projectNumber:        form.projectNumber.trim(),
        profile:              form.profile as ProjectProfile,
        status:               form.status as ProjectStatus,
        clientName:           form.clientName,
        businessUnit:         form.businessUnit,
        projectManager:       form.projectManager,
        address:              form.address,
        city:                 form.city,
        state:                form.state,
        country:              form.country,
        rsf:                  form.rsf ? Number(form.rsf) : null,
        totalBudget:          Number(form.totalBudget) || 0,
        committedCost:        Number(form.committedCost) || 0,
        forecastCost:         Number(form.forecastCost) || 0,
        actualCost:           Number(form.actualCost) || 0,
        contingencyPercent:   Number(form.contingencyPercent) || 10,
        startDate:            form.startDate,
        targetCompletionDate: form.targetCompletionDate,
        hasMER:               form.hasMER,
        isActive:             form.isActive,
        updatedAt:            new Date().toISOString(),
      })
      onClose()
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-2xl bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
          <div>
            <h2 className="text-slate-100 font-semibold text-lg">Edit Project</h2>
            <p className="text-slate-500 text-xs mt-0.5 truncate max-w-xs">{project.projectName}</p>
          </div>
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

            <Field label="Project Name *">
              <input value={form.projectName} onChange={e => set('projectName', e.target.value)} className={inp()} required />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Project Number (SO#)">
                <input value={form.projectNumber} onChange={e => set('projectNumber', e.target.value)} placeholder="SO09897" className={inp()} />
              </Field>
              <Field label="Profile">
                <select value={form.profile} onChange={e => set('profile', e.target.value)} className={inp()}>
                  <option value="L">Light (L)</option>
                  <option value="S">Standard (S)</option>
                  <option value="E">Enhanced (E)</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Status">
                <select value={form.status} onChange={e => set('status', e.target.value)} className={inp()}>
                  {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>
              <Field label="RSF (sq ft)">
                <input type="number" value={form.rsf} onChange={e => set('rsf', e.target.value)} className={inp()} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Client">
                <input value={form.clientName} onChange={e => set('clientName', e.target.value)} className={inp()} />
              </Field>
              <Field label="Business Unit">
                <input value={form.businessUnit} onChange={e => set('businessUnit', e.target.value)} placeholder="CB&W / IB" className={inp()} />
              </Field>
            </div>

            <Field label="Project Manager">
              <input value={form.projectManager} onChange={e => set('projectManager', e.target.value)} className={inp()} />
            </Field>

            <Field label="Address">
              <input value={form.address} onChange={e => set('address', e.target.value)} className={inp()} />
            </Field>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Field label="City">
                  <input value={form.city} onChange={e => set('city', e.target.value)} className={inp()} />
                </Field>
              </div>
              <Field label="State">
                <input value={form.state} onChange={e => set('state', e.target.value)} className={inp()} />
              </Field>
            </div>

            {/* Budget section */}
            <div className="border-t border-slate-700 pt-4">
              <p className="text-slate-400 text-xs uppercase tracking-wide font-medium mb-3">Budget</p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Approved Budget ($)">
                  <input type="number" value={form.totalBudget} onChange={e => set('totalBudget', e.target.value)} className={inp()} />
                </Field>
                <Field label="Committed Cost ($)">
                  <input type="number" value={form.committedCost} onChange={e => set('committedCost', e.target.value)} className={inp()} />
                </Field>
                <Field label="Forecast Cost ($)">
                  <input type="number" value={form.forecastCost} onChange={e => set('forecastCost', e.target.value)} className={inp()} />
                </Field>
                <Field label="Actual Cost ($)">
                  <input type="number" value={form.actualCost} onChange={e => set('actualCost', e.target.value)} className={inp()} />
                </Field>
              </div>
            </div>

            {/* Schedule section */}
            <div className="border-t border-slate-700 pt-4">
              <p className="text-slate-400 text-xs uppercase tracking-wide font-medium mb-3">Schedule</p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Start Date">
                  <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} className={inp()} />
                </Field>
                <Field label="Target Completion">
                  <input type="date" value={form.targetCompletionDate} onChange={e => set('targetCompletionDate', e.target.value)} className={inp()} />
                </Field>
              </div>
            </div>

            {/* Flags */}
            <div className="border-t border-slate-700 pt-4 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.hasMER} onChange={e => set('hasMER', e.target.checked)} className="w-4 h-4 rounded accent-blue-500" />
                <span className="text-slate-300 text-sm">MER (Mission-Critical Equipment Room) required</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={e => set('isActive', e.target.checked)} className="w-4 h-4 rounded accent-blue-500" />
                <span className="text-slate-300 text-sm">Active project (shows on dashboard)</span>
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-700 flex gap-3 shrink-0">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-600 text-slate-300 text-sm hover:bg-slate-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Changes'}
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

function inp() {
  return clsx('w-full bg-slate-800 text-slate-100 text-sm rounded-lg px-3 py-2.5 border border-slate-700 focus:outline-none focus:border-blue-500 placeholder-slate-500')
}
