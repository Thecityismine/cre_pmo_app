import { useState, useRef } from 'react'
import { clsx } from 'clsx'
import {
  Sparkles, Mic, FileText, Trash2, ChevronDown, ChevronRight,
  AlertTriangle, CheckSquare, Lightbulb, ClipboardList, Upload,
  Loader2, X, Calendar, Check,
} from 'lucide-react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getOpenAI, hasOpenAIKey } from '@/lib/openai'
import { useMeetingNotes, type MeetingNote } from '@/hooks/useMeetingNotes'
import { useAuthStore } from '@/store/authStore'
import type { Project, Task } from '@/types'

// ─── Types ───────────────────────────────────────────────────────────────────

interface AIResult {
  summary: string
  actionItems: string[]
  decisions: string[]
  risks: string[]
}

interface Milestone {
  stage: string
  startDate: string
  endDate: string
  duration: string
  notes: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseAIResponse(text: string): AIResult {
  const sections = {
    summary: '',
    actionItems: [] as string[],
    decisions: [] as string[],
    risks: [] as string[],
  }

  const summaryMatch = text.match(/##?\s*Summary[\s\S]*?\n([\s\S]*?)(?=##?\s*(Action Items|Decisions|Risks|$))/i)
  if (summaryMatch) sections.summary = summaryMatch[1].trim()

  const extractList = (label: string): string[] => {
    const re = new RegExp(`##?\\s*${label}[\\s\\S]*?\\n([\\s\\S]*?)(?=##?\\s*(?:Summary|Action Items|Decisions|Risks)|$)`, 'i')
    const m = text.match(re)
    if (!m) return []
    return m[1]
      .split('\n')
      .map(l => l.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean)
  }

  sections.actionItems = extractList('Action Items')
  sections.decisions = extractList('Decisions')
  sections.risks = extractList('Risks')

  if (!sections.summary && !sections.actionItems.length) {
    sections.summary = text.trim()
  }

  return sections
}

const MEETING_PROMPT = `You are a CRE Project Management assistant. Analyze these meeting notes and extract structured information.

Return your response in exactly this format:

## Summary
[2-3 sentence summary of what was discussed]

## Action Items
- [action item with owner if mentioned]
- [action item with owner if mentioned]

## Decisions
- [key decision made]
- [key decision made]

## Risks
- [risk or issue raised]
- [risk or issue raised]

If a section has nothing relevant, write "None identified."

Meeting Notes:
`

const STAGE_COLORS: Record<string, string> = {
  'Pre-Project':  'bg-slate-700 border-slate-600',
  'Initiate':     'bg-purple-900/60 border-purple-700',
  'Planning':     'bg-blue-900/60 border-blue-700',
  'Design':       'bg-cyan-900/60 border-cyan-700',
  'Construction': 'bg-amber-900/60 border-amber-700',
  'Handover':     'bg-orange-900/60 border-orange-700',
  'Closeout':     'bg-emerald-900/60 border-emerald-700',
  'Closed':       'bg-slate-800 border-slate-600',
}

const STAGE_DOT: Record<string, string> = {
  'Pre-Project':  'bg-slate-400',
  'Initiate':     'bg-purple-400',
  'Planning':     'bg-blue-400',
  'Design':       'bg-cyan-400',
  'Construction': 'bg-amber-400',
  'Handover':     'bg-orange-400',
  'Closeout':     'bg-emerald-400',
  'Closed':       'bg-slate-500',
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function NoteCard({ note, onDelete }: { note: MeetingNote; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const date = new Date(note.createdAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-750 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          {expanded
            ? <ChevronDown size={14} className="text-slate-500 shrink-0" />
            : <ChevronRight size={14} className="text-slate-500 shrink-0" />
          }
          <FileText size={14} className="text-blue-400 shrink-0" />
          <span className="text-slate-200 text-sm font-medium truncate">{note.title}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-2">
          <span className="text-slate-500 text-xs hidden sm:block">{date}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="text-slate-600 hover:text-red-400 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-700 p-4 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ClipboardList size={13} className="text-blue-400" />
              <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Summary</p>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">{note.summary}</p>
          </div>

          {note.actionItems.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CheckSquare size={13} className="text-emerald-400" />
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Action Items</p>
              </div>
              <ul className="space-y-1.5">
                {note.actionItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                    <span className="mt-1.5 w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {note.decisions.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb size={13} className="text-amber-400" />
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Decisions</p>
              </div>
              <ul className="space-y-1.5">
                {note.decisions.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                    <span className="mt-1.5 w-1.5 h-1.5 bg-amber-400 rounded-full shrink-0" />
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {note.risks.length > 0 && note.risks[0].toLowerCase() !== 'none identified.' && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={13} className="text-red-400" />
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Risks & Issues</p>
              </div>
              <ul className="space-y-1.5">
                {note.risks.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                    <span className="mt-1.5 w-1.5 h-1.5 bg-red-400 rounded-full shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <details className="group">
            <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400 select-none list-none flex items-center gap-1">
              <ChevronRight size={12} className="group-open:rotate-90 transition-transform" />
              View original notes
            </summary>
            <p className="mt-2 text-xs text-slate-500 bg-slate-900 rounded-lg p-3 whitespace-pre-wrap leading-relaxed">
              {note.rawText}
            </p>
          </details>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AITab({ project, tasks }: { project: Project; tasks: Task[] }) {
  const user = useAuthStore((s) => s.user)
  const { notes, addNote, deleteNote } = useMeetingNotes(project.id)

  // Meeting notes state
  const [mode, setMode] = useState<'text' | 'audio'>('text')
  const [title, setTitle] = useState('')
  const [rawText, setRawText] = useState('')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Project brief state
  const [brief, setBrief] = useState('')
  const [briefLoading, setBriefLoading] = useState(false)

  // Schedule generator state
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [scheduleNotes, setScheduleNotes] = useState('')
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleError, setScheduleError] = useState('')
  const [applied, setApplied] = useState(false)

  const noKey = !hasOpenAIKey()

  // ── Process meeting notes ──────────────────────────────────────────────────

  const processNotes = async () => {
    if (!title.trim()) { setError('Please enter a meeting title.'); return }
    if (mode === 'text' && !rawText.trim()) { setError('Please paste your meeting notes.'); return }
    if (mode === 'audio' && !audioFile) { setError('Please select an audio file.'); return }
    setError('')
    setProcessing(true)

    try {
      let noteText = rawText

      if (mode === 'audio' && audioFile) {
        const transcription = await getOpenAI().audio.transcriptions.create({
          file: audioFile,
          model: 'whisper-1',
        })
        noteText = transcription.text
      }

      const completion = await getOpenAI().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a concise CRE project management assistant.' },
          { role: 'user', content: MEETING_PROMPT + noteText },
        ],
        max_tokens: 800,
        temperature: 0.3,
      })

      const aiText = completion.choices[0]?.message?.content ?? ''
      const parsed = parseAIResponse(aiText)

      await addNote({
        projectId: project.id,
        title: title.trim(),
        rawText: noteText,
        summary: parsed.summary,
        actionItems: parsed.actionItems,
        decisions: parsed.decisions,
        risks: parsed.risks,
        createdAt: new Date().toISOString(),
        createdBy: user?.displayName || user?.email || 'Unknown',
      })

      setTitle('')
      setRawText('')
      setAudioFile(null)
      setShowForm(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg.includes('API key') ? 'Invalid OpenAI API key.' : `Error: ${msg}`)
    } finally {
      setProcessing(false)
    }
  }

  // ── Generate project brief ─────────────────────────────────────────────────

  const generateBrief = async () => {
    setBriefLoading(true)
    setBrief('')

    const doneTasks = tasks.filter(t => t.status === 'complete').length
    const blockedTasks = tasks.filter(t => t.status === 'blocked').length
    const inProgressTasks = tasks.filter(t => t.status === 'in-progress').length
    const pct = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0
    const budgetUsed = project.totalBudget > 0 ? Math.round((project.actualCost / project.totalBudget) * 100) : 0
    const variance = project.totalBudget - project.forecastCost
    const varDir = variance >= 0 ? 'under' : 'over'
    const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Math.abs(n))

    const context = `
Project: ${project.projectName}
Status: ${project.status}
Profile: ${project.profile === 'L' ? 'Light' : project.profile === 'S' ? 'Standard' : 'Enhanced'}
Location: ${project.city}, ${project.state}
Size: ${project.rsf ? project.rsf.toLocaleString() + ' RSF' : 'N/A'}
Total Budget: ${fmt(project.totalBudget)}
Actual Cost: ${fmt(project.actualCost)} (${budgetUsed}% utilized)
Forecast Cost: ${fmt(project.forecastCost)} — ${fmt(variance)} ${varDir} budget
Start Date: ${project.startDate || 'N/A'}
Target Completion: ${project.targetCompletionDate || 'N/A'}
Checklist: ${doneTasks}/${tasks.length} tasks complete (${pct}%)
In Progress: ${inProgressTasks} tasks | Blocked: ${blockedTasks} tasks
Project Manager: ${project.projectManager || 'N/A'}
Client: ${project.clientName || 'N/A'}
`.trim()

    try {
      const completion = await getOpenAI().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a senior CRE project management consultant. Write concise, professional project status briefs suitable for executive reporting.' },
          { role: 'user', content: `Generate a concise project status brief (3-4 short paragraphs) for the following CRE project. Cover: overall status, budget health, schedule, and any notable risks or items to watch. Be direct and professional.\n\n${context}` },
        ],
        max_tokens: 500,
        temperature: 0.4,
      })
      setBrief(completion.choices[0]?.message?.content ?? '')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setBrief(`Error: ${msg}`)
    } finally {
      setBriefLoading(false)
    }
  }

  // ── Generate schedule ──────────────────────────────────────────────────────

  const generateSchedule = async () => {
    setScheduleLoading(true)
    setScheduleError('')
    setMilestones([])
    setScheduleNotes('')
    setApplied(false)

    const profileLabel = project.profile === 'L' ? 'Light' : project.profile === 'S' ? 'Standard' : 'Enhanced'
    const rfsFull = project.rsf ? `${project.rsf.toLocaleString()} RSF` : 'unknown size'
    const startRef = project.startDate || new Date().toISOString().split('T')[0]

    const prompt = `You are a CRE project scheduling expert. Generate a realistic stage-gate schedule for a commercial real estate project.

Project details:
- Name: ${project.projectName}
- Profile: ${profileLabel} (${project.profile === 'L' ? 'smaller/simpler project' : project.profile === 'S' ? 'standard complexity' : 'large or complex project'})
- Size: ${rfsFull}
- Budget: ${project.totalBudget > 0 ? `$${(project.totalBudget / 1e6).toFixed(1)}M` : 'N/A'}
- Current status: ${project.status}
- Start date: ${startRef}
- Location: ${project.city || ''}, ${project.state || ''}

Return ONLY valid JSON in this exact structure (no markdown, no explanation):
{
  "milestones": [
    {"stage": "Pre-Project", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "duration": "X weeks", "notes": "brief description"},
    {"stage": "Initiate", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "duration": "X weeks", "notes": "brief description"},
    {"stage": "Planning", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "duration": "X weeks", "notes": "brief description"},
    {"stage": "Design", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "duration": "X weeks", "notes": "brief description"},
    {"stage": "Construction", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "duration": "X weeks/months", "notes": "brief description"},
    {"stage": "Handover", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "duration": "X weeks", "notes": "brief description"},
    {"stage": "Closeout", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "duration": "X weeks", "notes": "brief description"},
    {"stage": "Closed", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "duration": "X weeks", "notes": "brief description"}
  ],
  "totalDuration": "X months",
  "notes": "1-2 sentences on key scheduling assumptions"
}`

    try {
      const completion = await getOpenAI().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a CRE scheduling expert. Return only valid JSON.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 900,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      })

      const raw = completion.choices[0]?.message?.content ?? '{}'
      const parsed = JSON.parse(raw)
      setMilestones(parsed.milestones ?? [])
      setScheduleNotes(parsed.notes ?? '')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setScheduleError(`Error: ${msg}`)
    } finally {
      setScheduleLoading(false)
    }
  }

  const applySchedule = async () => {
    if (!milestones.length) return
    const first = milestones[0]
    const last = milestones[milestones.length - 1]
    await updateDoc(doc(db, 'projects', project.id), {
      startDate: first.startDate,
      targetCompletionDate: last.endDate,
      updatedAt: new Date().toISOString(),
    })
    setApplied(true)
  }

  // ─────────────────────────────────────────────────────────────────────────

  if (noKey) {
    return (
      <div className="bg-slate-800 border border-amber-700/50 rounded-xl p-6 text-center">
        <Sparkles size={32} className="mx-auto mb-3 text-amber-400" />
        <h3 className="text-slate-100 font-semibold mb-2">OpenAI API Key Required</h3>
        <p className="text-slate-400 text-sm mb-4 max-w-sm mx-auto">
          Add your OpenAI API key to <code className="bg-slate-700 px-1.5 py-0.5 rounded text-xs">.env.local</code> to enable AI features.
        </p>
        <div className="bg-slate-900 rounded-lg p-3 text-left max-w-sm mx-auto">
          <p className="text-xs text-slate-400 font-mono">VITE_OPENAI_API_KEY=sk-...</p>
        </div>
        <p className="text-slate-500 text-xs mt-3">
          Get a key at platform.openai.com → restart the dev server after adding.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* ── Project Brief ── */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-blue-400" />
            <p className="text-slate-200 font-medium text-sm">AI Project Brief</p>
          </div>
          <button
            onClick={generateBrief}
            disabled={briefLoading}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
          >
            {briefLoading
              ? <><Loader2 size={12} className="animate-spin" /> Generating...</>
              : <><Sparkles size={12} /> Generate Brief</>
            }
          </button>
        </div>

        {brief ? (
          <div className="bg-slate-900/60 rounded-lg p-4">
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{brief}</p>
          </div>
        ) : (
          <p className="text-slate-500 text-sm">
            Click "Generate Brief" to get an AI-written executive summary of this project's current status.
          </p>
        )}
      </div>

      {/* ── Schedule Generator ── */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar size={15} className="text-emerald-400" />
            <p className="text-slate-200 font-medium text-sm">AI Schedule Generator</p>
          </div>
          <button
            onClick={generateSchedule}
            disabled={scheduleLoading}
            className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
          >
            {scheduleLoading
              ? <><Loader2 size={12} className="animate-spin" /> Generating...</>
              : <><Calendar size={12} /> Generate Schedule</>
            }
          </button>
        </div>

        {/* Context pills */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
            Profile: {project.profile === 'L' ? 'Light' : project.profile === 'S' ? 'Standard' : 'Enhanced'}
          </span>
          {(project.rsf ?? 0) > 0 && (
            <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
              {(project.rsf ?? 0).toLocaleString()} RSF
            </span>
          )}
          {project.startDate && (
            <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
              Starts {project.startDate}
            </span>
          )}
          {project.totalBudget > 0 && (
            <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
              ${(project.totalBudget / 1e6).toFixed(1)}M budget
            </span>
          )}
        </div>

        {scheduleError && (
          <p className="text-red-400 text-xs flex items-center gap-1 mb-3">
            <AlertTriangle size={12} /> {scheduleError}
          </p>
        )}

        {milestones.length > 0 && (
          <>
            {/* Timeline */}
            <div className="space-y-2 mb-3">
              {milestones.map((m, i) => (
                <div
                  key={i}
                  className={clsx(
                    'rounded-lg border p-3',
                    STAGE_COLORS[m.stage] ?? 'bg-slate-800 border-slate-700'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={clsx('w-2 h-2 rounded-full shrink-0 mt-0.5', STAGE_DOT[m.stage] ?? 'bg-slate-400')} />
                      <p className="text-slate-100 text-sm font-medium">{m.stage}</p>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0 font-mono">{m.duration}</span>
                  </div>
                  <div className="ml-4 mt-1">
                    <p className="text-xs text-slate-400">
                      {m.startDate} → {m.endDate}
                    </p>
                    {m.notes && (
                      <p className="text-xs text-slate-500 mt-0.5">{m.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* AI notes */}
            {scheduleNotes && (
              <p className="text-xs text-slate-500 italic mb-3">{scheduleNotes}</p>
            )}

            {/* Apply button */}
            <button
              onClick={applySchedule}
              disabled={applied}
              className={clsx(
                'w-full flex items-center justify-center gap-2 text-sm py-2 rounded-lg transition-colors font-medium',
                applied
                  ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-700 cursor-default'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600'
              )}
            >
              {applied
                ? <><Check size={14} /> Schedule applied to project</>
                : 'Apply start & completion dates to project'
              }
            </button>
          </>
        )}

        {!scheduleLoading && milestones.length === 0 && !scheduleError && (
          <p className="text-slate-500 text-sm">
            Click "Generate Schedule" to get AI-suggested milestone dates based on this project's profile, size, and budget.
          </p>
        )}
      </div>

      {/* ── Meeting Notes ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Mic size={15} className="text-slate-400" />
            <p className="text-slate-200 font-medium text-sm">Meeting Notes ({notes.length})</p>
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs px-3 py-1.5 rounded-lg border border-slate-600 transition-colors"
            >
              + Add Notes
            </button>
          )}
        </div>

        {/* New Note Form */}
        {showForm && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-slate-200 font-medium text-sm">New Meeting Notes</p>
              <button onClick={() => { setShowForm(false); setError('') }} className="text-slate-500 hover:text-slate-300">
                <X size={16} />
              </button>
            </div>

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Meeting title (e.g. Design Review – Week 12)"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />

            <div className="flex gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700">
              <button
                onClick={() => setMode('text')}
                className={clsx(
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-colors',
                  mode === 'text' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                )}
              >
                <FileText size={12} /> Paste Text
              </button>
              <button
                onClick={() => setMode('audio')}
                className={clsx(
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-colors',
                  mode === 'audio' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                )}
              >
                <Mic size={12} /> Upload Audio
              </button>
            </div>

            {mode === 'text' ? (
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste your meeting notes here..."
                rows={6}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
              />
            ) : (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,.mp3,.mp4,.m4a,.wav,.webm,.ogg"
                  className="hidden"
                  onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
                />
                {audioFile ? (
                  <div className="flex items-center justify-between bg-slate-900 border border-slate-700 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Mic size={14} className="text-blue-400" />
                      <span className="text-sm text-slate-200 truncate max-w-xs">{audioFile.name}</span>
                      <span className="text-xs text-slate-500">({(audioFile.size / 1024 / 1024).toFixed(1)} MB)</span>
                    </div>
                    <button onClick={() => setAudioFile(null)} className="text-slate-500 hover:text-red-400 transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex flex-col items-center gap-2 border-2 border-dashed border-slate-600 hover:border-blue-500 rounded-lg py-6 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <Upload size={20} />
                    <span className="text-sm">Click to upload audio recording</span>
                    <span className="text-xs text-slate-500">MP3, M4A, WAV, WebM — max 25MB</span>
                  </button>
                )}
              </div>
            )}

            {error && (
              <p className="text-red-400 text-xs flex items-center gap-1">
                <AlertTriangle size={12} /> {error}
              </p>
            )}

            <button
              onClick={processNotes}
              disabled={processing}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm py-2.5 rounded-lg transition-colors font-medium"
            >
              {processing ? (
                <><Loader2 size={15} className="animate-spin" />
                  {mode === 'audio' ? 'Transcribing & analyzing...' : 'Analyzing notes...'}
                </>
              ) : (
                <><Sparkles size={15} /> Analyze with AI</>
              )}
            </button>
          </div>
        )}

        {notes.length === 0 && !showForm ? (
          <div className="text-center py-12 text-slate-500 bg-slate-800 border border-slate-700 rounded-xl">
            <Mic size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">No meeting notes yet.</p>
            <p className="text-xs mt-1">Add notes to extract action items and decisions with AI.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notes.map((note) => (
              <NoteCard key={note.id} note={note} onDelete={() => deleteNote(note.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
