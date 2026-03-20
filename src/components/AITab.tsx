import { useState, useRef } from 'react'
import { clsx } from 'clsx'
import {
  Sparkles, Mic, FileText, Trash2, ChevronDown, ChevronRight,
  AlertTriangle, CheckSquare, Lightbulb, ClipboardList, Upload,
  Loader2, X, Calendar, Check, ShieldAlert, FileDown, ClipboardCopy,
  BarChart3,
} from 'lucide-react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getOpenAI } from '@/lib/openai'
import { callClaude, streamClaude, hasClaudeKey, CRE_SYSTEM_PROMPT } from '@/lib/claude'
import { useMeetingNotes, type MeetingNote } from '@/hooks/useMeetingNotes'
import { useAuthStore } from '@/store/authStore'
import type { Project, Task } from '@/types'
import type { RaidItem } from '@/hooks/useRaidLog'
import type { ProjectTask } from '@/hooks/useProjectTasks'
import type { BudgetItem } from '@/hooks/useBudgetItems'
import type { Milestone } from '@/hooks/useMilestones'

// ─── Types ───────────────────────────────────────────────────────────────────

interface AIResult {
  summary: string
  actionItems: string[]
  decisions: string[]
  risks: string[]
}

interface ScheduleStage {
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

export function AITab({
  project, tasks,
  raidItems = [], projectTasks = [], budgetItems = [], milestones = [],
  openRfis = 0, overdueRfis = 0,
}: {
  project: Project; tasks: Task[]
  raidItems?: RaidItem[]
  projectTasks?: ProjectTask[]
  budgetItems?: BudgetItem[]
  milestones?: Milestone[]
  openRfis?: number
  overdueRfis?: number
}) {
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
  const [scheduleStages, setScheduleStages] = useState<ScheduleStage[]>([])
  const [scheduleNotes, setScheduleNotes] = useState('')
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleError, setScheduleError] = useState('')
  const [applied, setApplied] = useState(false)

  const noKey = !hasClaudeKey()

  // ── 4.1 AI Risk Scanner ────────────────────────────────────────────────────

  interface DetectedRisk {
    title: string
    description: string
    severity: 'high' | 'medium' | 'low'
    category: string
    reasoning: string
  }

  const [scanResults, setScanResults] = useState<DetectedRisk[]>([])
  const [scanLoading, setScanLoading] = useState(false)
  const [scanError, setScanError] = useState('')
  const [promotedIds, setPromotedIds] = useState<Set<number>>(new Set())

  const buildRiskContext = () => {
    const fmtCur = (n: number) => `$${(n / 1000).toFixed(0)}K`
    const today = new Date()
    const daysToComplete = project.targetCompletionDate
      ? Math.ceil((new Date(project.targetCompletionDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      : null

    const openRaid = raidItems.filter(r => r.status === 'open' || r.status === 'in-progress')
    const overdueProjectTasks = projectTasks.filter(t => t.status === 'open' && t.dueDate && new Date(t.dueDate) < today)
    const overBudgetLines = budgetItems.filter(b => b.forecastAmount > b.budgetAmount)
    const delayedMilestones = milestones.filter(m => m.status === 'delayed')

    return `
PROJECT: ${project.projectName}
Status: ${project.status} | Profile: ${project.profile === 'L' ? 'Light' : project.profile === 'S' ? 'Standard' : 'Enhanced'} | Size: ${project.rsf ? project.rsf.toLocaleString() + ' RSF' : 'N/A'}
Budget: Approved ${fmtCur(project.totalBudget)}, Forecast ${fmtCur(project.forecastCost)} (${project.totalBudget > 0 ? Math.round((project.forecastCost / project.totalBudget) * 100) : 0}% of budget)
Target Completion: ${project.targetCompletionDate || 'Not set'}${daysToComplete !== null ? ` (${daysToComplete} days away)` : ''}

CHECKLIST: ${tasks.filter(t => t.status === 'complete').length}/${tasks.length} complete
PROJECT TASKS: ${projectTasks.filter(t => t.status === 'open').length} open, ${overdueProjectTasks.length} overdue
OPEN RFIs: ${openRfis} (${overdueRfis} overdue >14 days)
DELAYED MILESTONES: ${delayedMilestones.map(m => m.name).join(', ') || 'None'}

BUDGET LINE OVERRUNS:
${overBudgetLines.length > 0 ? overBudgetLines.slice(0, 5).map(b => `- ${b.description}: ${fmtCur(b.forecastAmount)} vs ${fmtCur(b.budgetAmount)} budget`).join('\n') : 'None'}

EXISTING RAID LOG (already captured):
${openRaid.length > 0 ? openRaid.map(r => `- [${r.priority}][${r.type}] ${r.title}`).join('\n') : 'No open RAID items'}
`.trim()
  }

  const scanForRisks = async () => {
    setScanLoading(true)
    setScanError('')
    setScanResults([])
    setPromotedIds(new Set())

    const context = buildRiskContext()
    const prompt = `${context}

Based on this project data, identify risks or issues that are NOT already in the RAID log above. Look for patterns that experienced CRE PMs watch for: schedule pressure, budget drift, RFI bottlenecks, contractor risk, permitting delays, scope creep indicators, occupancy risk, etc.

Return ONLY valid JSON — an array of up to 5 risk objects. No markdown, no explanation outside the JSON:
[
  {
    "title": "Short risk title (max 8 words)",
    "description": "1-2 sentences describing the risk and its potential impact",
    "severity": "high|medium|low",
    "category": "Budget|Schedule|Scope|Quality|Contractor|Regulatory|Occupancy|Other",
    "reasoning": "1 sentence explaining why this data pattern suggests this risk"
  }
]

If no additional risks are detected, return an empty array: []`

    try {
      const raw = await callClaude(
        [{ role: 'user', content: prompt }],
        'You are a senior CRE risk analyst. Return only valid JSON arrays. No markdown code fences.',
        1000,
      )
      const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
      const parsed = JSON.parse(cleaned) as DetectedRisk[]
      setScanResults(Array.isArray(parsed) ? parsed : [])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setScanError(`Error: ${msg}`)
    } finally {
      setScanLoading(false)
    }
  }

  const promoteToRaid = async (risk: DetectedRisk, idx: number) => {
    const { addDoc, collection } = await import('firebase/firestore')
    const { db } = await import('@/lib/firebase')
    const now = new Date().toISOString()
    await addDoc(collection(db, 'raidItems'), {
      projectId: project.id,
      type: 'Risk',
      category: risk.category,
      title: risk.title,
      description: `${risk.description}\n\nAI Reasoning: ${risk.reasoning}`,
      severity: risk.severity,
      priority: risk.severity,
      status: 'open',
      owner: '',
      dueDate: '',
      isSystemGenerated: false,
      createdAt: now,
      updatedAt: now,
    })
    setPromotedIds(prev => new Set([...prev, idx]))
  }

  // ── 4.2 AI Status Report ───────────────────────────────────────────────────

  const [statusReport, setStatusReport] = useState('')
  const [reportLoading, setReportLoading] = useState(false)
  const [reportCopied, setReportCopied] = useState(false)
  const [meetingType, setMeetingType] = useState<'oac' | 'owner' | 'internal' | 'executive'>('oac')

  const MEETING_TYPES = [
    { id: 'oac',       label: 'OAC Meeting',       audience: 'Owner, Architect, and Contractor team', tone: 'technical, action-oriented, highlight open RFIs, submittals, and schedule impacts' },
    { id: 'owner',     label: 'Owner Update',       audience: 'the project owner/client',             tone: 'concise, financial-first, avoid jargon, highlight budget variance and milestone progress' },
    { id: 'internal',  label: 'Internal Review',    audience: 'internal PM team',                     tone: 'direct, operational detail, include task owners, risk items, and blockers' },
    { id: 'executive', label: 'Executive Briefing', audience: 'executive leadership (VP/C-suite)',    tone: 'headline-only, three bullets max per section, no technical detail, focus on financial exposure and schedule' },
  ] as const

  const buildReportContext = () => {
    const today = new Date()
    const fmtCur = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
    const daysToComplete = project.targetCompletionDate
      ? Math.ceil((new Date(project.targetCompletionDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      : null
    const openRaid = raidItems.filter(r => r.status === 'open' || r.status === 'in-progress')
    const highRisks = openRaid.filter(r => r.priority === 'high')
    const completedMilestones = milestones.filter(m => m.status === 'complete').length
    const nextMilestone = milestones.filter(m => m.status !== 'complete' && m.targetDate).sort((a, b) => a.targetDate.localeCompare(b.targetDate))[0]
    const overdueProjectTasks = projectTasks.filter(t => t.status === 'open' && t.dueDate && new Date(t.dueDate) < today)
    const taskDone = tasks.filter(t => t.status === 'complete').length

    return `
PROJECT: ${project.projectName}
Date: ${today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
Stage: ${project.status} | PM: ${project.projectManager || 'N/A'} | Client: ${project.clientName || 'N/A'}

BUDGET:
- Approved Budget: ${fmtCur(project.totalBudget)}
- Forecast: ${fmtCur(project.forecastCost)} (${project.totalBudget > 0 ? Math.round((project.forecastCost / project.totalBudget) * 100) : 0}% utilized)
- Variance: ${fmtCur(Math.abs(project.totalBudget - project.forecastCost))} ${project.forecastCost <= project.totalBudget ? 'under' : 'over'} budget

SCHEDULE:
- Target Completion: ${project.targetCompletionDate || 'Not set'}${daysToComplete !== null ? ` (${daysToComplete > 0 ? `${daysToComplete} days remaining` : `${Math.abs(daysToComplete)} days overdue`})` : ''}
- Milestones: ${completedMilestones}/${milestones.length} complete${nextMilestone ? `, next: "${nextMilestone.name}" on ${nextMilestone.targetDate}` : ''}

TASKS:
- Checklist: ${taskDone}/${tasks.length} complete (${tasks.length > 0 ? Math.round(taskDone / tasks.length * 100) : 0}%)
- Project Tasks: ${projectTasks.filter(t => t.status === 'open').length} open, ${overdueProjectTasks.length} overdue

RISKS & ISSUES:
- Open RAID items: ${openRaid.length} (${highRisks.length} high priority)
${highRisks.slice(0, 3).map(r => `- HIGH: ${r.title}`).join('\n')}

OPEN ITEMS:
- RFIs: ${openRfis} open (${overdueRfis} overdue)
`.trim()
  }

  const generateStatusReport = async () => {
    setReportLoading(true)
    setStatusReport('')
    setReportCopied(false)

    const mt = MEETING_TYPES.find(m => m.id === meetingType)!
    const context = buildReportContext()
    const prompt = `${context}

Meeting type: ${mt.label}
Audience: ${mt.audience}
Tone/focus: ${mt.tone}

Generate a professional CRE project status report tailored for ${mt.label}. Be specific, cite numbers, and keep it concise.

## Status Report — ${project.projectName}
**Date:** [today's date]
**Report type:** ${mt.label}

## Overall Status
[1-2 sentence executive summary: overall project health, key metric, and one key headline — tuned for the audience]

## Accomplishments
- [what has been achieved — cite specific milestones, % complete, etc.]
- [budget or cost control wins if any]
- [any risks resolved or items closed]

## Active Risks & Issues
- [top 2-3 risks with specifics — tie to actual data]

## Next Steps
- [3-4 specific actions for the coming period]
- [next milestone or decision point]`

    try {
      let text = ''
      await streamClaude(
        [{ role: 'user', content: prompt }],
        chunk => {
          text += chunk
          setStatusReport(text)
        },
        'You are a senior CRE project management consultant. Write concise, factual status reports using the provided project data.',
        900,
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setStatusReport(`Error: ${msg}`)
    } finally {
      setReportLoading(false)
    }
  }

  const copyReport = async () => {
    await navigator.clipboard.writeText(statusReport)
    setReportCopied(true)
    setTimeout(() => setReportCopied(false), 2000)
  }

  const exportReportPdf = () => {
    import('jspdf').then(({ default: jsPDF }) => {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
      const W = 215.9
      const margin = 18
      let y = 18

      // Header
      pdf.setFillColor(15, 23, 42)
      pdf.rect(0, 0, W, 20, 'F')
      pdf.setTextColor(255, 255, 255)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(12)
      pdf.text(`Status Report — ${project.projectName}`, margin, 13)
      pdf.setFontSize(7)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(148, 163, 184)
      pdf.text(new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), W - margin, 13, { align: 'right' })
      y = 28

      // Body
      pdf.setTextColor(30, 30, 30)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      const lines = statusReport.split('\n')
      for (const line of lines) {
        if (y > 260) { pdf.addPage(); y = 18 }
        const clean = line.replace(/^##\s*/, '').replace(/\*\*/g, '')
        if (line.startsWith('## ')) {
          pdf.setFont('helvetica', 'bold')
          pdf.setFontSize(10)
          pdf.setTextColor(30, 41, 59)
          y += 3
          pdf.text(clean, margin, y)
          y += 5
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(9)
          pdf.setTextColor(30, 30, 30)
        } else if (line.trim()) {
          const wrapped = pdf.splitTextToSize(clean, W - margin * 2)
          wrapped.forEach((l: string) => {
            if (y > 260) { pdf.addPage(); y = 18 }
            pdf.text(l, margin + (line.startsWith('-') ? 4 : 0), y)
            y += 5
          })
        } else {
          y += 2
        }
      }

      const safe = project.projectName.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)
      pdf.save(`${safe}_status_report_${new Date().toISOString().slice(0, 10)}.pdf`)
    })
  }

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

      const aiText = await callClaude(
        [{ role: 'user', content: MEETING_PROMPT + noteText }],
        CRE_SYSTEM_PROMPT,
        800,
      )
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
      const brief = await callClaude(
        [{ role: 'user', content: `Generate a concise project status brief (3-4 short paragraphs) for the following CRE project. Cover: overall status, budget health, schedule, and any notable risks or items to watch. Be direct and professional.\n\n${context}` }],
        'You are a senior CRE project management consultant. Write concise, professional project status briefs suitable for executive reporting.',
        500,
      )
      setBrief(brief)
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
    setScheduleStages([])
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
      const raw = await callClaude(
        [{ role: 'user', content: prompt }],
        'You are a CRE scheduling expert. Return only valid JSON with no markdown formatting or code blocks.',
        900,
      )
      // Strip any markdown code fences if present
      const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
      const parsed = JSON.parse(cleaned)
      setScheduleStages(parsed.milestones ?? [])
      setScheduleNotes(parsed.notes ?? '')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setScheduleError(`Error: ${msg}`)
    } finally {
      setScheduleLoading(false)
    }
  }

  const applySchedule = async () => {
    if (!scheduleStages.length) return
    const first = scheduleStages[0]
    const last = scheduleStages[scheduleStages.length - 1]
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
        <h3 className="text-slate-100 font-semibold mb-2">Claude API Key Required</h3>
        <p className="text-slate-400 text-sm mb-4 max-w-sm mx-auto">
          Add your Anthropic API key in <strong>Settings → AI API Keys</strong> to enable AI features.
        </p>
        <a
          href="/settings"
          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          Go to Settings →
        </a>
        <p className="text-slate-500 text-xs mt-3">
          Get a key at console.anthropic.com
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

        {scheduleStages.length > 0 && (
          <>
            {/* Timeline */}
            <div className="space-y-2 mb-3">
              {scheduleStages.map((m, i) => (
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

        {!scheduleLoading && scheduleStages.length === 0 && !scheduleError && (
          <p className="text-slate-500 text-sm">
            Click "Generate Schedule" to get AI-suggested milestone dates based on this project's profile, size, and budget.
          </p>
        )}
      </div>

      {/* ── 4.1 AI Risk Scanner ── */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert size={15} className="text-red-400" />
            <p className="text-slate-200 font-medium text-sm">AI Risk Scanner</p>
          </div>
          <button
            onClick={scanForRisks}
            disabled={scanLoading}
            className="flex items-center gap-1.5 bg-red-900/60 hover:bg-red-800/70 border border-red-700/50 disabled:opacity-60 text-red-300 text-xs px-3 py-1.5 rounded-lg transition-colors"
          >
            {scanLoading
              ? <><Loader2 size={12} className="animate-spin" /> Scanning...</>
              : <><ShieldAlert size={12} /> Scan for Risks</>
            }
          </button>
        </div>

        <p className="text-xs text-slate-500 mb-3">
          AI analyzes your project data (budget, schedule, tasks, RFIs, existing RAID) and surfaces potential risks not yet logged.
        </p>

        {scanError && (
          <p className="text-red-400 text-xs flex items-center gap-1 mb-3">
            <AlertTriangle size={12} /> {scanError}
          </p>
        )}

        {scanResults.length > 0 && (
          <div className="space-y-2">
            {scanResults.map((risk, idx) => (
              <div key={idx} className={clsx(
                'rounded-lg border p-3',
                risk.severity === 'high' ? 'bg-red-900/20 border-red-700/40' :
                risk.severity === 'medium' ? 'bg-amber-900/20 border-amber-700/40' :
                'bg-slate-800/60 border-slate-700/40'
              )}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={clsx(
                        'text-xs font-bold uppercase',
                        risk.severity === 'high' ? 'text-red-400' :
                        risk.severity === 'medium' ? 'text-amber-400' : 'text-slate-400'
                      )}>{risk.severity}</span>
                      <span className="text-xs text-slate-500 bg-slate-700/60 px-1.5 py-0.5 rounded">{risk.category}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-200">{risk.title}</p>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{risk.description}</p>
                    <p className="text-xs text-slate-600 mt-1 italic">Why: {risk.reasoning}</p>
                  </div>
                  <button
                    onClick={() => promoteToRaid(risk, idx)}
                    disabled={promotedIds.has(idx)}
                    className={clsx(
                      'shrink-0 flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors',
                      promotedIds.has(idx)
                        ? 'bg-emerald-900/40 text-emerald-400 border-emerald-700/50 cursor-default'
                        : 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600 hover:text-white'
                    )}
                  >
                    {promotedIds.has(idx) ? <><Check size={11} /> Added</> : '+ RAID'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!scanLoading && scanResults.length === 0 && !scanError && (
          <p className="text-slate-600 text-xs italic">
            No scan results yet. Click "Scan for Risks" to analyze this project.
          </p>
        )}

        {!scanLoading && scanResults.length > 0 && scanResults.every((_, i) => promotedIds.has(i)) && (
          <p className="text-emerald-400 text-xs flex items-center gap-1 mt-2">
            <Check size={12} /> All detected risks have been added to the RAID log.
          </p>
        )}
      </div>

      {/* ── 4.2 AI Status Report ── */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 size={15} className="text-purple-400" />
            <p className="text-slate-200 font-medium text-sm">AI Status Report</p>
          </div>
          <div className="flex items-center gap-2">
            {statusReport && (
              <>
                <button
                  onClick={copyReport}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  {reportCopied ? <><Check size={11} /> Copied</> : <><ClipboardCopy size={11} /> Copy</>}
                </button>
                <button
                  onClick={exportReportPdf}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <FileDown size={11} /> PDF
                </button>
              </>
            )}
            <button
              onClick={generateStatusReport}
              disabled={reportLoading}
              className="flex items-center gap-1.5 bg-purple-900/60 hover:bg-purple-800/70 border border-purple-700/50 disabled:opacity-60 text-purple-300 text-xs px-3 py-1.5 rounded-lg transition-colors"
            >
              {reportLoading
                ? <><Loader2 size={12} className="animate-spin" /> Generating...</>
                : <><BarChart3 size={12} /> Generate Report</>
              }
            </button>
          </div>
        </div>

        {/* Meeting type selector */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {MEETING_TYPES.map(mt => (
            <button
              key={mt.id}
              onClick={() => { setMeetingType(mt.id); setStatusReport('') }}
              className={clsx(
                'text-xs px-2.5 py-1 rounded-md border transition-colors',
                meetingType === mt.id
                  ? 'bg-purple-900/70 border-purple-600 text-purple-200'
                  : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-500',
              )}
            >
              {mt.label}
            </button>
          ))}
        </div>

        {statusReport ? (
          <div className="bg-slate-900/60 rounded-lg p-4 space-y-1">
            {statusReport.split('\n').map((line, i) => {
              if (line.startsWith('## ')) {
                return <p key={i} className="text-slate-100 font-semibold text-sm mt-3 first:mt-0">{line.slice(3)}</p>
              } else if (line.startsWith('**') && line.endsWith('**')) {
                return <p key={i} className="text-xs text-slate-400 font-medium">{line.replace(/\*\*/g, '')}</p>
              } else if (line.startsWith('- ')) {
                return (
                  <div key={i} className="flex items-start gap-2">
                    <span className="mt-1.5 w-1.5 h-1.5 bg-slate-500 rounded-full shrink-0" />
                    <p className="text-sm text-slate-300 leading-relaxed">{line.slice(2)}</p>
                  </div>
                )
              } else if (line.trim()) {
                return <p key={i} className="text-sm text-slate-300 leading-relaxed">{line}</p>
              }
              return <div key={i} className="h-1" />
            })}
            {reportLoading && (
              <span className="inline-block w-1.5 h-4 bg-purple-400 animate-pulse ml-0.5" />
            )}
          </div>
        ) : (
          <p className="text-slate-500 text-sm">
            Click "Generate Report" to create a professional executive status report pulling live budget, schedule, risk, and task data.
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
