import { useState, useRef, useCallback, useEffect } from 'react'
import { clsx } from 'clsx'
import {
  FileText, Image, Film, Archive, Trash2,
  Download, FolderOpen, Loader2, AlertTriangle, File,
  X, ChevronLeft, ChevronRight, ZoomIn, Plus, Upload,
} from 'lucide-react'
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from '@/lib/firebase'
import { useProjectDocuments } from '@/hooks/useProjectDocuments'
import type { ProjectDocument } from '@/hooks/useProjectDocuments'
import { useAuthStore } from '@/store/authStore'
import type { Project } from '@/types'

const CATEGORIES = ['General', 'Drawings', 'Contracts', 'Reports', 'Photos', 'RFIs', 'Submittals', 'Permits', 'Other']

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function isImage(type: string) { return type.startsWith('image/') }
function isPdf(type: string)   { return type === 'application/pdf' }
function isVideo(type: string) { return type.startsWith('video/') }

function categoryColor(cat: string): string {
  const map: Record<string, string> = {
    Drawings:   'bg-blue-900/70 text-blue-300',
    Contracts:  'bg-purple-900/70 text-purple-300',
    Reports:    'bg-amber-900/70 text-amber-300',
    Photos:     'bg-cyan-900/70 text-cyan-300',
    RFIs:       'bg-red-900/70 text-red-300',
    Submittals: 'bg-orange-900/70 text-orange-300',
    Permits:    'bg-emerald-900/70 text-emerald-300',
  }
  return map[cat] ?? 'bg-slate-700 text-slate-300'
}

function DocTypeIcon({ type, size = 40 }: { type: string; size?: number }) {
  if (isPdf(type))   return <FileText size={size} className="text-red-400" />
  if (isVideo(type)) return <Film size={size} className="text-purple-400" />
  if (type.includes('zip') || type.includes('rar') || type.includes('7z')) return <Archive size={size} className="text-amber-400" />
  if (type.includes('word') || type.includes('document')) return <FileText size={size} className="text-blue-300" />
  if (type.includes('sheet') || type.includes('excel'))   return <FileText size={size} className="text-emerald-400" />
  if (type.startsWith('image/')) return <Image size={size} className="text-blue-400" />
  return <File size={size} className="text-slate-400" />
}

// ─── Upload Modal ─────────────────────────────────────────────────────────────

interface UploadItem { file: File; progress: number; error: string; done: boolean }

function UploadModal({
  onClose,
  onUpload,
}: {
  onClose: () => void
  onUpload: (files: File[], name: string, category: string) => void
}) {
  const [category, setCategory] = useState('General')
  const [displayName, setDisplayName] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const pick = (files: File[]) => {
    if (!files.length) return
    if (!displayName.trim() && files.length === 1) {
      setDisplayName(files[0].name.replace(/\.[^.]+$/, ''))
    }
    onUpload(files, displayName, category)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-slate-100 font-semibold text-sm">Add Document</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={16} /></button>
        </div>

        {/* Category */}
        <div>
          <label className="text-xs text-slate-400 block mb-1.5">Category</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-500"
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Display name */}
        <div>
          <label className="text-xs text-slate-400 block mb-1.5">Display Name <span className="text-slate-600">(optional)</span></label>
          <input
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="e.g. 23rd Floor Plan"
            className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-500 placeholder-slate-600"
          />
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); pick(Array.from(e.dataTransfer.files)) }}
          onClick={() => fileInputRef.current?.click()}
          className={clsx(
            'border-2 border-dashed rounded-xl py-8 flex flex-col items-center gap-2 cursor-pointer transition-colors',
            dragging
              ? 'border-blue-500 bg-blue-500/10 text-blue-300'
              : 'border-slate-700 hover:border-slate-500 text-slate-500 hover:text-slate-400'
          )}
        >
          <Upload size={20} />
          <p className="text-sm font-medium">{dragging ? 'Drop files here' : 'Click or drag & drop'}</p>
          <p className="text-xs text-slate-600">PDFs, images, Word, Excel — up to 50 MB</p>
        </div>
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => pick(Array.from(e.target.files ?? []))} />
      </div>
    </div>
  )
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({ doc: d, all, onClose }: { doc: ProjectDocument; all: ProjectDocument[]; onClose: () => void }) {
  const [current, setCurrent] = useState(d)
  const currentIdx = all.findIndex(x => x.id === current.id)

  const prev = () => setCurrent(all[Math.max(0, currentIdx - 1)])
  const next = () => setCurrent(all[Math.min(all.length - 1, currentIdx + 1)])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [currentIdx, all])

  const label = current.displayName || current.originalName

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="relative max-w-5xl w-full max-h-[90vh] flex flex-col bg-slate-900 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className={clsx('text-xs px-2 py-0.5 rounded font-medium shrink-0', categoryColor(current.category))}>{current.category}</span>
            <span className="text-slate-200 text-sm font-medium truncate">{label}</span>
            <span className="text-slate-500 text-xs shrink-0">{formatSize(current.size)}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <a href={current.url} download={current.originalName}
              className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors" title="Download">
              <Download size={15} />
            </a>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-4 min-h-0">
          {isImage(current.type) ? (
            <img src={current.url} alt={label} className="max-w-full max-h-full object-contain rounded-lg" />
          ) : isPdf(current.type) ? (
            <iframe src={current.url} className="w-full rounded-lg border border-slate-700" style={{ height: 'min(70vh, 600px)' }} title={label} />
          ) : (
            <div className="flex flex-col items-center gap-4 py-12">
              <DocTypeIcon type={current.type} size={56} />
              <p className="text-slate-300 text-sm">{label}</p>
              <a href={current.url} download={current.originalName}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors">
                <Download size={14} /> Download
              </a>
            </div>
          )}
        </div>

        {/* Navigation */}
        {all.length > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-slate-700 shrink-0">
            <button onClick={prev} disabled={currentIdx === 0}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-30 px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors">
              <ChevronLeft size={14} /> Prev
            </button>
            <span className="text-xs text-slate-500">{currentIdx + 1} / {all.length}</span>
            <button onClick={next} disabled={currentIdx === all.length - 1}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-30 px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors">
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Document card ────────────────────────────────────────────────────────────

function DocCard({ doc: d, onOpen, onDelete, deleting }: {
  doc: ProjectDocument; onOpen: () => void; onDelete: () => void; deleting: boolean
}) {
  const label = d.displayName || d.originalName

  return (
    <div className="group relative bg-slate-800 border border-slate-700 hover:border-slate-500 rounded-xl overflow-hidden transition-all hover:shadow-lg hover:shadow-black/30 flex flex-col">
      {/* Thumbnail */}
      <button onClick={onOpen} className="relative w-full aspect-[4/3] flex items-center justify-center bg-slate-900 overflow-hidden">
        {isImage(d.type) ? (
          <>
            <img src={d.url} alt={label} className="w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <ZoomIn size={22} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 px-2">
            <DocTypeIcon type={d.type} size={40} />
            <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">
              {d.type.split('/').pop()?.toUpperCase() || 'FILE'}
            </span>
          </div>
        )}
      </button>

      {/* Footer */}
      <div className="px-3 py-2.5 flex-1 flex flex-col gap-1 min-w-0">
        <button onClick={onOpen} className="text-left text-sm text-slate-200 font-medium truncate hover:text-blue-300 transition-colors" title={label}>
          {label}
        </button>
        <div className="flex items-center justify-between gap-1">
          <span className={clsx('text-[10px] px-1.5 py-0.5 rounded font-medium truncate', categoryColor(d.category))}>{d.category}</span>
          <span className="text-[10px] text-slate-500 shrink-0">{formatSize(d.size)}</span>
        </div>
      </div>

      {/* Delete on hover */}
      <button
        onClick={e => { e.stopPropagation(); onDelete() }}
        disabled={deleting}
        className="absolute top-2 right-2 p-1 bg-black/60 hover:bg-red-900/80 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
        title="Delete"
      >
        {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
      </button>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DocumentsTab({ project }: { project: Project }) {
  const user = useAuthStore((s) => s.user)
  const { documents, loading, addDocument, removeDocument } = useProjectDocuments(project.id)

  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [catFilter, setCatFilter] = useState('All')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [lightboxDoc, setLightboxDoc] = useState<ProjectDocument | null>(null)
  const [showModal, setShowModal] = useState(false)

  const uploadFiles = useCallback(async (files: File[], displayName: string, category: string) => {
    const newItems: UploadItem[] = files.map(f => ({ file: f, progress: 0, error: '', done: false }))
    setUploads(prev => [...prev, ...newItems])
    const baseIndex = uploads.length

    await Promise.all(files.map(async (file, idx) => {
      const globalIdx = baseIndex + idx
      const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const storagePath = `projects/${project.id}/documents/${safeName}`
      const storageRef = ref(storage, storagePath)

      try {
        await new Promise<void>((resolve, reject) => {
          const task = uploadBytesResumable(storageRef, file)
          task.on('state_changed',
            snap => {
              const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
              setUploads(prev => prev.map((u, i) => i === globalIdx ? { ...u, progress: pct } : u))
            },
            err => {
              setUploads(prev => prev.map((u, i) => i === globalIdx ? { ...u, error: err.message } : u))
              reject(err)
            },
            async () => {
              const url = await getDownloadURL(task.snapshot.ref)
              const resolvedName = (files.length === 1 && displayName.trim())
                ? displayName.trim()
                : file.name.replace(/\.[^.]+$/, '')
              await addDocument({
                projectId: project.id,
                name: file.name,
                originalName: file.name,
                displayName: resolvedName,
                url, storagePath,
                size: file.size,
                type: file.type,
                category,
                uploadedBy: user?.displayName || user?.email || 'Unknown',
                createdAt: new Date().toISOString(),
              })
              setUploads(prev => prev.map((u, i) => i === globalIdx ? { ...u, done: true, progress: 100 } : u))
              resolve()
            }
          )
        })
      } catch { /* error already set */ }
    }))

    setTimeout(() => setUploads(prev => prev.filter(u => !u.done)), 2000)
  }, [uploads.length, project.id, user, addDocument])

  const handleDelete = async (id: string, storagePath: string) => {
    setDeleting(id)
    try { await deleteObject(ref(storage, storagePath)) } catch { /* already gone */ }
    await removeDocument(id)
    setDeleting(null)
  }

  const categories = ['All', ...Array.from(new Set(documents.map(d => d.category)))]
  const filtered = catFilter === 'All' ? documents : documents.filter(d => d.category === catFilter)
  const grouped = filtered.reduce<Record<string, ProjectDocument[]>>((acc, d) => {
    const cat = d.category || 'General'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(d)
    return acc
  }, {})

  return (
    <div className="space-y-4">

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between">
        {/* Category filter tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {categories.length > 2 && categories.map(c => (
            <button key={c} onClick={() => setCatFilter(c)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                catFilter === c ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
              )}>
              {c} {c === 'All' ? `(${documents.length})` : `(${documents.filter(d => d.category === c).length})`}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shrink-0"
        >
          <Plus size={14} /> Add Document
        </button>
      </div>

      {/* ── Active uploads ── */}
      {uploads.filter(u => !u.done).map((u, i) => (
        <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-3">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <DocTypeIcon type={u.file.type} size={14} />
              <span className="text-sm text-slate-200 truncate">{u.file.name}</span>
            </div>
            {u.error
              ? <span className="text-red-400 text-xs flex items-center gap-1 shrink-0"><AlertTriangle size={12} /> Failed</span>
              : <span className="text-slate-400 text-xs shrink-0">{u.progress}%</span>
            }
          </div>
          {!u.error && (
            <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${u.progress}%` }} />
            </div>
          )}
        </div>
      ))}

      {/* ── Document grid ── */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-slate-500" /></div>
      ) : documents.length === 0 ? (
        <div className="text-center py-20 text-slate-500 bg-slate-800 border border-slate-700 rounded-xl">
          <FolderOpen size={36} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No documents yet.</p>
          <p className="text-xs mt-1 mb-4">Upload drawings, contracts, photos, or any project files.</p>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors mx-auto">
            <Plus size={14} /> Add Document
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([cat, docs]) => (
            <div key={cat}>
              {catFilter === 'All' && (
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2 px-0.5">{cat}</p>
              )}
              <div className="grid grid-cols-2 gap-3">
                {docs.map(d => (
                  <DocCard
                    key={d.id}
                    doc={d}
                    onOpen={() => setLightboxDoc(d)}
                    onDelete={() => { if (confirm(`Delete "${d.displayName || d.originalName}"?`)) handleDelete(d.id, d.storagePath) }}
                    deleting={deleting === d.id}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Upload Modal ── */}
      {showModal && <UploadModal onClose={() => setShowModal(false)} onUpload={uploadFiles} />}

      {/* ── Lightbox ── */}
      {lightboxDoc && <Lightbox doc={lightboxDoc} all={filtered} onClose={() => setLightboxDoc(null)} />}
    </div>
  )
}
