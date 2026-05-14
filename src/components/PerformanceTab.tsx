import { useState } from 'react'
import { clsx } from 'clsx'
import { Star, Trophy, Trash2, Plus, ChevronDown, ThumbsUp } from 'lucide-react'
import { usePerformanceReviews } from '@/hooks/usePerformanceReviews'
import type { TeamMember } from '@/hooks/useProjectTeam'
import type { Project } from '@/types'

const METRICS = [
  { key: 'qualityOfWork',    label: 'Quality of Work' },
  { key: 'timeliness',       label: 'Timeliness' },
  { key: 'communication',    label: 'Communication' },
  { key: 'budgetAdherence',  label: 'Budget Adherence' },
  { key: 'safety',           label: 'Safety' },
] as const

type MetricKey = typeof METRICS[number]['key']

function avgScore(r: Record<MetricKey, number>): number {
  const vals = METRICS.map(m => r[m.key])
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[0, 1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange?.(n)}
          className={clsx(
            'w-8 h-8 rounded-lg text-sm font-semibold border transition-colors',
            value === n
              ? 'bg-amber-500 border-amber-400 text-white'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-amber-500 hover:text-amber-400',
            !onChange && 'cursor-default pointer-events-none',
          )}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 4 ? 'text-emerald-400' : score >= 2.5 ? 'text-amber-400' : 'text-red-400'
  return (
    <span className={clsx('flex items-center gap-1 text-sm font-bold tabular-nums', color)}>
      <Star size={13} className="fill-current" />
      {score.toFixed(1)}
    </span>
  )
}

const today = new Date().toISOString().split('T')[0]

const ROLE_LABELS: Record<string, string> = {
  'project-manager': 'PM', 'project-executive': 'Exec', 'owners-rep': "Owner's Rep",
  'architect': 'Architect', 'aor': 'AOR', 'general-contractor': 'GC',
  'mep-engineer': 'MEP', 'structural': 'Structural', 'civil': 'Civil',
  'it-vendor': 'IT', 'av-vendor': 'AV', 'security': 'Security',
  'client-rep': 'Client', 'll-rep': 'LL Rep', 'ff-and-e': 'FF&E',
  'legal': 'Legal', 'accounting': 'Accounting', 'facilities': 'Facilities', 'other': 'Other',
}

function avatarColor(name: string) {
  const colors = ['bg-blue-700', 'bg-emerald-700', 'bg-purple-700', 'bg-amber-700', 'bg-cyan-700', 'bg-rose-700']
  return colors[name.charCodeAt(0) % colors.length]
}

interface Props {
  project: Project
  team: TeamMember[]
}

export function PerformanceTab({ project, team }: Props) {
  const { reviews, loading, addReview, deleteReview } = usePerformanceReviews(project.id)
  const [selectedMember, setSelectedMember] = useState('')
  const [reviewDate, setReviewDate] = useState(today)
  const [metrics, setMetrics] = useState<Record<MetricKey, number>>({
    qualityOfWork: 0, timeliness: 0, communication: 0, budgetAdherence: 0, safety: 0,
  })
  const [notes, setNotes] = useState('')
  const [wouldHireAgain, setWouldHireAgain] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const setMetric = (key: MetricKey, val: number) => setMetrics(m => ({ ...m, [key]: val }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMember) return
    const member = team.find(m => m.id === selectedMember)
    if (!member) return
    setSaving(true)
    await addReview({
      projectId: project.id,
      contactName: member.name,
      contactCompany: member.company,
      contactRole: member.role,
      reviewDate,
      ...metrics,
      notes,
      wouldHireAgain,
    })
    setSelectedMember('')
    setMetrics({ qualityOfWork: 0, timeliness: 0, communication: 0, budgetAdherence: 0, safety: 0 })
    setNotes('')
    setWouldHireAgain(true)
    setReviewDate(today)
    setSaving(false)
  }

  // Aggregate per contact
  const leaderboard = Object.values(
    reviews.reduce<Record<string, { name: string; company: string; role: string; scores: number[]; wouldHire: number }>>((acc, r) => {
      if (!acc[r.contactName]) acc[r.contactName] = { name: r.contactName, company: r.contactCompany, role: r.contactRole, scores: [], wouldHire: 0 }
      acc[r.contactName].scores.push(avgScore(r))
      if (r.wouldHireAgain) acc[r.contactName].wouldHire++
      return acc
    }, {})
  )
    .map(e => ({ ...e, avg: e.scores.reduce((a, b) => a + b, 0) / e.scores.length, count: e.scores.length }))
    .sort((a, b) => b.avg - a.avg)

  return (
    <div className="space-y-5">

      {/* Top Performers */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Trophy size={16} className="text-amber-400" />
          <h3 className="text-slate-100 font-semibold text-sm">Top Performers</h3>
          <span className="text-xs text-slate-500 ml-auto">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</span>
        </div>

        {leaderboard.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-6">No reviews yet. Add the first one below.</p>
        ) : (
          <div className="space-y-3">
            {leaderboard.map((entry, i) => (
              <div key={entry.name} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
                <span className={clsx(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                  i === 0 ? 'bg-amber-500 text-white' : i === 1 ? 'bg-slate-400 text-slate-900' : i === 2 ? 'bg-amber-800 text-amber-200' : 'bg-slate-700 text-slate-400'
                )}>{i + 1}</span>
                <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0', avatarColor(entry.name))}>
                  {entry.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-100 text-sm font-medium truncate">{entry.name}</p>
                  <p className="text-slate-500 text-xs truncate">{entry.company} · {ROLE_LABELS[entry.role] ?? entry.role} · {entry.count} review{entry.count !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {entry.wouldHire > 0 && (
                    <span className="flex items-center gap-1 text-xs text-emerald-400">
                      <ThumbsUp size={11} /> {entry.wouldHire}
                    </span>
                  )}
                  <ScoreBadge score={entry.avg} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Review Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Plus size={16} className="text-slate-400" />
          <h3 className="text-slate-100 font-semibold text-sm">Add Performance Review</h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-xs mb-1.5 block">Team Member *</label>
              <div className="relative">
                <select
                  required
                  value={selectedMember}
                  onChange={e => setSelectedMember(e.target.value)}
                  className="w-full appearance-none bg-slate-800 text-slate-100 text-sm rounded-lg pl-3 pr-8 py-2.5 border border-slate-700 focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select team member</option>
                  {team.map(m => (
                    <option key={m.id} value={m.id}>{m.name} · {m.company}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1.5 block">Review Date</label>
              <input
                type="date"
                value={reviewDate}
                onChange={e => setReviewDate(e.target.value)}
                className="w-full bg-slate-800 text-slate-100 text-sm rounded-lg px-3 py-2.5 border border-slate-700 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <p className="text-slate-400 text-xs mb-3 font-medium uppercase tracking-wide">Performance Metrics (0–5)</p>
            <div className="space-y-3">
              {METRICS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-4">
                  <span className="text-slate-300 text-sm w-36 shrink-0">{label}</span>
                  <StarRating value={metrics[key]} onChange={v => setMetric(key, v)} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-slate-400 text-xs mb-1.5 block">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Additional feedback or comments..."
              rows={3}
              className="w-full bg-slate-800 text-slate-100 text-sm rounded-lg px-3 py-2.5 border border-slate-700 focus:outline-none focus:border-blue-500 placeholder-slate-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={wouldHireAgain}
                onChange={e => setWouldHireAgain(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 accent-blue-500"
              />
              <span className="text-slate-300 text-sm">Would hire again</span>
            </label>
            <button
              type="submit"
              disabled={saving || !selectedMember}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              <Plus size={15} />
              {saving ? 'Saving...' : 'Add Review'}
            </button>
          </div>
        </form>
      </div>

      {/* Review History */}
      {reviews.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-slate-100 font-semibold text-sm mb-4">Review History ({reviews.length})</h3>
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map(r => {
                const score = avgScore(r)
                const isOpen = expandedId === r.id
                return (
                  <div key={r.id} className="border border-slate-800 rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isOpen ? null : r.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/40 transition-colors text-left"
                    >
                      <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0', avatarColor(r.contactName))}>
                        {r.contactName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-200 text-sm font-medium truncate">{r.contactName}</p>
                        <p className="text-slate-500 text-xs">{r.contactCompany} · {new Date(r.reviewDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {r.wouldHireAgain && <ThumbsUp size={13} className="text-emerald-400" />}
                        <ScoreBadge score={score} />
                        <ChevronDown size={14} className={clsx('text-slate-500 transition-transform', isOpen && 'rotate-180')} />
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-4 border-t border-slate-800 pt-3 space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {METRICS.map(({ key, label }) => (
                            <div key={key} className="bg-slate-800/60 rounded-lg px-3 py-2">
                              <p className="text-slate-500 text-xs mb-1">{label}</p>
                              <StarRating value={r[key]} />
                            </div>
                          ))}
                        </div>
                        {r.notes && (
                          <p className="text-slate-400 text-sm bg-slate-800/40 rounded-lg px-3 py-2">{r.notes}</p>
                        )}
                        <div className="flex items-center justify-between">
                          <span className={clsx('flex items-center gap-1 text-xs', r.wouldHireAgain ? 'text-emerald-400' : 'text-slate-500')}>
                            <ThumbsUp size={11} />
                            {r.wouldHireAgain ? 'Would hire again' : 'Would not hire again'}
                          </span>
                          <button
                            onClick={() => { if (confirm('Delete this review?')) deleteReview(r.id) }}
                            className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
