import { useState } from 'react'
import { clsx } from 'clsx'
import {
  Plus, Trash2, ChevronDown, ChevronRight,
  CheckSquare, Lightbulb, AlertTriangle, FileText, X, Pencil, Check,
} from 'lucide-react'
import { useMeetingNotes } from '@/hooks/useMeetingNotes'
import type { Project } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

// ─── List editor (action items / decisions / risks) ───────────────────────────

function ListEditor({
  label,
  icon: Icon,
  color,
  items,
  onChange,
}: {
  label: string
  icon: React.FC<{ size?: number; className?: string }>
  color: string
  items: string[]
  onChange: (items: string[]) => void
}) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const trimmed = draft.trim()
    if (!trimmed) return
    onChange([...items, trimmed])
    setDraft('')
  }

  return (
    <div>
      <div className={clsx('flex items-center gap-1.5 mb-1.5', color)}>
        <Icon size={12} />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className="space-y-1 mb-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2 group">
            <span className={clsx('text-xs mt-0.5 shrink-0', color)}>•</span>
            <span className="text-xs text-slate-300 flex-1">{item}</span>
            <button
              type="button"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-red-400 transition-opacity"
            >
              <X size={10} />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder={`Add ${label.toLowerCase()}…`}
          className="flex-1 bg-slate-900 text-slate-300 text-xs rounded px-2 py-1.5 border border-slate-800 focus:outline-none focus:border-blue-500 placeholder-slate-600"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="px-2 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded disabled:opacity-40 transition-colors"
        >
          <Plus size={11} />
        </button>
      </div>
    </div>
  )
}

// ─── Add form ─────────────────────────────────────────────────────────────────

function AddNoteForm({
  projectId,
  onAdd,
  onCancel,
}: {
  projectId: string
  onAdd: (note: Parameters<ReturnType<typeof useMeetingNotes>['addNote']>[0]) => Promise<void>
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [createdBy, setCreatedBy] = useState('')
  const [rawText, setRawText] = useState('')
  const [actionItems, setActionItems] = useState<string[]>([])
  const [decisions, setDecisions] = useState<string[]>([])
  const [risks, setRisks] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!title.trim()) return
    setSaving(true)
    await onAdd({
      projectId,
      title: title.trim(),
      createdBy: createdBy.trim(),
      rawText: rawText.trim(),
      summary: '',
      actionItems,
      decisions,
      risks,
      createdAt: new Date().toISOString(),
    })
    setSaving(false)
    onCancel()
  }

  return (
    <div className="bg-slate-900 border border-blue-600 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-100">New Meeting Note</h3>

      {/* Title + attendee */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Meeting title *"
          className="bg-slate-700 text-slate-100 text-sm rounded-lg px-3 py-2 border border-slate-800 focus:outline-none focus:border-blue-500 placeholder-slate-500"
        />
        <input
          value={createdBy}
          onChange={e => setCreatedBy(e.target.value)}
          placeholder="Recorded by (optional)"
          className="bg-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-800 focus:outline-none focus:border-blue-500 placeholder-slate-500"
        />
      </div>

      {/* Raw notes */}
      <textarea
        value={rawText}
        onChange={e => setRawText(e.target.value)}
        placeholder="Meeting notes / summary…"
        rows={3}
        className="w-full bg-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-800 focus:outline-none focus:border-blue-500 resize-none placeholder-slate-500"
      />

      {/* Structured lists */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-900/40 rounded-lg p-3">
        <ListEditor
          label="Action Items"
          icon={CheckSquare}
          color="text-blue-400"
          items={actionItems}
          onChange={setActionItems}
        />
        <ListEditor
          label="Decisions"
          icon={Lightbulb}
          color="text-emerald-400"
          items={decisions}
          onChange={setDecisions}
        />
        <ListEditor
          label="Risks"
          icon={AlertTriangle}
          color="text-amber-400"
          items={risks}
          onChange={setRisks}
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={save}
          disabled={saving || !title.trim()}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-40 transition-colors"
        >
          <Plus size={14} /> {saving ? 'Saving…' : 'Save Note'}
        </button>
        <button onClick={onCancel} className="text-sm text-slate-400 hover:text-slate-300 px-3 py-2">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Note card ────────────────────────────────────────────────────────────────

function NoteCard({
  note,
  onDelete,
  onUpdate,
}: {
  note: ReturnType<typeof useMeetingNotes>['notes'][0]
  onDelete: (id: string) => void
  onUpdate: (id: string, data: Parameters<ReturnType<typeof useMeetingNotes>['updateNote']>[1]) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(note.title)
  const [createdBy, setCreatedBy] = useState(note.createdBy ?? '')
  const [rawText, setRawText] = useState(note.rawText ?? '')
  const [actionItems, setActionItems] = useState<string[]>(note.actionItems ?? [])
  const [decisions, setDecisions] = useState<string[]>(note.decisions ?? [])
  const [risks, setRisks] = useState<string[]>(note.risks ?? [])
  const [saving, setSaving] = useState(false)

  const hasStructured = note.actionItems?.length || note.decisions?.length || note.risks?.length

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setTitle(note.title)
    setCreatedBy(note.createdBy ?? '')
    setRawText(note.rawText ?? '')
    setActionItems(note.actionItems ?? [])
    setDecisions(note.decisions ?? [])
    setRisks(note.risks ?? [])
    setEditing(true)
    setExpanded(true)
  }

  const save = async () => {
    if (!title.trim()) return
    setSaving(true)
    await onUpdate(note.id, { title: title.trim(), createdBy: createdBy.trim(), rawText: rawText.trim(), actionItems, decisions, risks })
    setSaving(false)
    setEditing(false)
  }

  const cancel = () => {
    setEditing(false)
  }

  const inp = 'w-full bg-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 border border-slate-800 focus:outline-none focus:border-blue-500 placeholder-slate-500'

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => !editing && setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700/30 transition-colors text-left"
      >
        {expanded
          ? <ChevronDown size={14} className="text-slate-400 shrink-0" />
          : <ChevronRight size={14} className="text-slate-400 shrink-0" />}

        <div className="flex-1 min-w-0">
          <p className="text-slate-200 text-sm font-medium truncate">{note.title}</p>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
            <span>{fmtDate(note.createdAt)}</span>
            {note.createdBy && <span>· {note.createdBy}</span>}
            {hasStructured ? (
              <div className="flex items-center gap-2">
                {note.actionItems?.length > 0 && (
                  <span className="text-blue-400">{note.actionItems.length} action{note.actionItems.length !== 1 ? 's' : ''}</span>
                )}
                {note.decisions?.length > 0 && (
                  <span className="text-emerald-400">{note.decisions.length} decision{note.decisions.length !== 1 ? 's' : ''}</span>
                )}
                {note.risks?.length > 0 && (
                  <span className="text-amber-400">{note.risks.length} risk{note.risks.length !== 1 ? 's' : ''}</span>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={startEdit}
            className="p-1.5 text-slate-400 hover:text-blue-400 transition-colors"
            title="Edit note"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); if (confirm('Delete this meeting note?')) onDelete(note.id) }}
            className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-slate-800/50 px-4 py-4 space-y-4">
          {editing ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Meeting title *" className={inp} />
                <input value={createdBy} onChange={e => setCreatedBy(e.target.value)} placeholder="Recorded by (optional)" className={inp} />
              </div>
              <textarea
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                placeholder="Meeting notes / summary…"
                rows={3}
                className="w-full bg-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-800 focus:outline-none focus:border-blue-500 resize-none placeholder-slate-500"
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-900/40 rounded-lg p-3">
                <ListEditor label="Action Items" icon={CheckSquare} color="text-blue-400" items={actionItems} onChange={setActionItems} />
                <ListEditor label="Decisions" icon={Lightbulb} color="text-emerald-400" items={decisions} onChange={setDecisions} />
                <ListEditor label="Risks" icon={AlertTriangle} color="text-amber-400" items={risks} onChange={setRisks} />
              </div>
              <div className="flex gap-2">
                <button onClick={save} disabled={saving || !title.trim()}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-40 transition-colors">
                  <Check size={13} /> {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button onClick={cancel} className="text-sm text-slate-400 hover:text-slate-300 px-3 py-2">Cancel</button>
              </div>
            </>
          ) : (
            <>
              {note.rawText && (
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-1.5">Notes</p>
                  <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{note.rawText}</p>
                </div>
              )}
              {hasStructured ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {note.actionItems?.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 text-blue-400 mb-2">
                        <CheckSquare size={12} />
                        <span className="text-xs font-semibold uppercase tracking-wide">Action Items</span>
                      </div>
                      <ul className="space-y-1">
                        {note.actionItems.map((item, i) => (
                          <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                            <span className="text-blue-400 shrink-0 mt-0.5">•</span>{item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {note.decisions?.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 text-emerald-400 mb-2">
                        <Lightbulb size={12} />
                        <span className="text-xs font-semibold uppercase tracking-wide">Decisions</span>
                      </div>
                      <ul className="space-y-1">
                        {note.decisions.map((item, i) => (
                          <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                            <span className="text-emerald-400 shrink-0 mt-0.5">•</span>{item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {note.risks?.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 text-amber-400 mb-2">
                        <AlertTriangle size={12} />
                        <span className="text-xs font-semibold uppercase tracking-wide">Risks Raised</span>
                      </div>
                      <ul className="space-y-1">
                        {note.risks.map((item, i) => (
                          <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                            <span className="text-amber-400 shrink-0 mt-0.5">•</span>{item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export function MeetingNotesTab({ project }: { project: Project }) {
  const { notes, loading, addNote, deleteNote, updateNote } = useMeetingNotes(project.id)
  const [showAdd, setShowAdd] = useState(false)

  const totalActions = notes.reduce((s, n) => s + (n.actionItems?.length || 0), 0)
  const totalRisks   = notes.reduce((s, n) => s + (n.risks?.length || 0), 0)

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-slate-100">{notes.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">Meetings</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-blue-400">{totalActions}</p>
          <p className="text-xs text-slate-400 mt-0.5">Action Items</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
          <p className={clsx('text-xl font-bold', totalRisks > 0 ? 'text-amber-400' : 'text-slate-100')}>{totalRisks}</p>
          <p className="text-xs text-slate-400 mt-0.5">Risks Raised</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={14} /> New Meeting Note
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <AddNoteForm projectId={project.id} onAdd={addNote} onCancel={() => setShowAdd(false)} />
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : notes.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center mx-auto">
            <FileText size={22} className="text-slate-400" />
          </div>
          <p className="text-slate-300 font-medium text-sm">No meeting notes yet</p>
          <p className="text-slate-400 text-xs max-w-xs mx-auto">
            Log meeting summaries, track action items, decisions, and risks raised during project meetings.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map(note => (
            <NoteCard key={note.id} note={note} onDelete={deleteNote} onUpdate={updateNote} />
          ))}
        </div>
      )}
    </div>
  )
}
