import { useState, useRef, useCallback } from 'react'
import { clsx } from 'clsx'
import {
  Upload, File, FileText, Image, Film, Archive, Trash2,
  Download, FolderOpen, Loader2, AlertTriangle,
} from 'lucide-react'
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from '@/lib/firebase'
import { useProjectDocuments } from '@/hooks/useProjectDocuments'
import { useAuthStore } from '@/store/authStore'
import type { Project } from '@/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORIES = ['General', 'Drawings', 'Contracts', 'Reports', 'Photos', 'RFIs', 'Submittals', 'Permits', 'Other']

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fileIcon(type: string) {
  if (type.startsWith('image/')) return <Image size={18} className="text-blue-400" />
  if (type.startsWith('video/')) return <Film size={18} className="text-purple-400" />
  if (type === 'application/pdf') return <FileText size={18} className="text-red-400" />
  if (type.includes('zip') || type.includes('rar') || type.includes('7z')) return <Archive size={18} className="text-amber-400" />
  if (type.includes('word') || type.includes('document')) return <FileText size={18} className="text-blue-300" />
  if (type.includes('sheet') || type.includes('excel')) return <FileText size={18} className="text-emerald-400" />
  return <File size={18} className="text-slate-400" />
}

function categoryColor(cat: string): string {
  const map: Record<string, string> = {
    Drawings:   'bg-blue-900/60 text-blue-300',
    Contracts:  'bg-purple-900/60 text-purple-300',
    Reports:    'bg-amber-900/60 text-amber-300',
    Photos:     'bg-cyan-900/60 text-cyan-300',
    RFIs:       'bg-red-900/60 text-red-300',
    Submittals: 'bg-orange-900/60 text-orange-300',
    Permits:    'bg-emerald-900/60 text-emerald-300',
  }
  return map[cat] ?? 'bg-slate-700 text-slate-300'
}

// ─── Upload item state ────────────────────────────────────────────────────────

interface UploadItem {
  file: File
  progress: number
  error: string
  done: boolean
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DocumentsTab({ project }: { project: Project }) {
  const user = useAuthStore((s) => s.user)
  const { documents, loading, addDocument, removeDocument } = useProjectDocuments(project.id)

  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [category, setCategory] = useState('General')
  const [dragging, setDragging] = useState(false)
  const [catFilter, setCatFilter] = useState('All')
  const [deleting, setDeleting] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Upload logic ─────────────────────────────────────────────────────────

  const uploadFiles = useCallback(async (files: File[]) => {
    const newItems: UploadItem[] = files.map(f => ({ file: f, progress: 0, error: '', done: false }))
    setUploads(prev => [...prev, ...newItems])

    await Promise.all(files.map(async (file, idx) => {
      const globalIdx = uploads.length + idx
      const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const storagePath = `projects/${project.id}/documents/${safeName}`
      const storageRef = ref(storage, storagePath)

      try {
        await new Promise<void>((resolve, reject) => {
          const task = uploadBytesResumable(storageRef, file)
          task.on(
            'state_changed',
            (snap) => {
              const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
              setUploads(prev => prev.map((u, i) => i === globalIdx ? { ...u, progress: pct } : u))
            },
            (err) => {
              setUploads(prev => prev.map((u, i) => i === globalIdx ? { ...u, error: err.message } : u))
              reject(err)
            },
            async () => {
              const url = await getDownloadURL(task.snapshot.ref)
              await addDocument({
                projectId: project.id,
                name: file.name,
                originalName: file.name,
                url,
                storagePath,
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
      } catch {
        // error already set in state
      }
    }))

    // Clear completed uploads after a delay
    setTimeout(() => {
      setUploads(prev => prev.filter(u => !u.done))
    }, 2000)
  }, [uploads.length, project.id, category, user, addDocument])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length) uploadFiles(files)
  }, [uploadFiles])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length) uploadFiles(files)
    e.target.value = ''
  }

  const handleDelete = async (id: string, storagePath: string) => {
    setDeleting(id)
    try {
      await deleteObject(ref(storage, storagePath))
    } catch {
      // file may already be gone — still remove Firestore record
    }
    await removeDocument(id)
    setDeleting(null)
  }

  // ── Filtered docs ─────────────────────────────────────────────────────────

  const categories = ['All', ...Array.from(new Set(documents.map(d => d.category)))]
  const filtered = catFilter === 'All' ? documents : documents.filter(d => d.category === catFilter)

  const grouped = filtered.reduce<Record<string, typeof filtered>>((acc, d) => {
    const cat = d.category || 'General'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(d)
    return acc
  }, {})

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Upload zone ── */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-slate-200 font-medium text-sm">Upload Documents</p>
          {/* Category selector */}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-slate-700 border border-slate-600 text-slate-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500"
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={clsx(
            'border-2 border-dashed rounded-xl py-8 flex flex-col items-center gap-2 cursor-pointer transition-colors',
            dragging
              ? 'border-blue-500 bg-blue-500/10 text-blue-300'
              : 'border-slate-600 hover:border-slate-400 text-slate-400 hover:text-slate-300'
          )}
        >
          <Upload size={24} />
          <p className="text-sm font-medium">
            {dragging ? 'Drop files here' : 'Click or drag & drop files'}
          </p>
          <p className="text-xs text-slate-500">PDFs, images, Word docs, Excel — up to 50 MB each</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInput}
        />

        {/* Active uploads */}
        {uploads.filter(u => !u.done).map((u, i) => (
          <div key={i} className="bg-slate-900 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                {fileIcon(u.file.type)}
                <span className="text-sm text-slate-200 truncate">{u.file.name}</span>
              </div>
              {u.error
                ? <span className="text-red-400 text-xs flex items-center gap-1 shrink-0"><AlertTriangle size={12} /> Failed</span>
                : <span className="text-slate-400 text-xs shrink-0">{u.progress}%</span>
              }
            </div>
            {!u.error && (
              <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${u.progress}%` }}
                />
              </div>
            )}
            {u.error && <p className="text-xs text-red-400 mt-1">{u.error}</p>}
          </div>
        ))}
      </div>

      {/* ── Document list ── */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={20} className="animate-spin text-slate-500" />
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-16 text-slate-500 bg-slate-800 border border-slate-700 rounded-xl">
          <FolderOpen size={36} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No documents uploaded yet.</p>
          <p className="text-xs mt-1">Upload specs, drawings, contracts, or any project files.</p>
        </div>
      ) : (
        <div>
          {/* Category filter tabs */}
          {categories.length > 2 && (
            <div className="flex gap-1.5 flex-wrap mb-3">
              {categories.map(c => (
                <button
                  key={c}
                  onClick={() => setCatFilter(c)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    catFilter === c
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                  )}
                >
                  {c} {c === 'All' ? `(${documents.length})` : `(${documents.filter(d => d.category === c).length})`}
                </button>
              ))}
            </div>
          )}

          {/* Grouped file list */}
          <div className="space-y-4">
            {Object.entries(grouped).map(([cat, docs]) => (
              <div key={cat}>
                {catFilter === 'All' && (
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2 px-1">{cat}</p>
                )}
                <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden divide-y divide-slate-700">
                  {docs.map(d => (
                    <div key={d.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-700/40 transition-colors group">
                      <div className="shrink-0">{fileIcon(d.type)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-200 text-sm font-medium truncate">{d.originalName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={clsx('text-xs px-1.5 py-0.5 rounded font-medium', categoryColor(d.category))}>
                            {d.category}
                          </span>
                          <span className="text-xs text-slate-500">{formatSize(d.size)}</span>
                          <span className="text-xs text-slate-600 hidden sm:block">
                            {new Date(d.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                          {d.uploadedBy && (
                            <span className="text-xs text-slate-600 hidden md:block truncate max-w-32">{d.uploadedBy}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded-lg transition-colors"
                          title="Download"
                        >
                          <Download size={14} />
                        </a>
                        <button
                          onClick={() => handleDelete(d.id, d.storagePath)}
                          disabled={deleting === d.id}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          {deleting === d.id
                            ? <Loader2 size={14} className="animate-spin" />
                            : <Trash2 size={14} />
                          }
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
