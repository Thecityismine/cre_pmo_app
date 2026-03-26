import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Camera, Plus, Download, Pencil, Trash2, X,
  ChevronLeft, ChevronRight, Loader2, ImageIcon,
  CalendarDays, FileText, ZoomIn,
} from 'lucide-react'
import {
  collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc,
  query, orderBy, getDocs, writeBatch, increment,
} from 'firebase/firestore'
import {
  ref as sRef, uploadBytesResumable, getDownloadURL, deleteObject,
} from 'firebase/storage'
import { db, storage } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import type { Project } from '@/types'
import jsPDF from 'jspdf'

// ─── Local Types ──────────────────────────────────────────────────────────────

interface SiteVisit {
  id: string
  visitDate: string          // 'YYYY-MM-DD'
  title?: string
  notes?: string
  photoCount: number
  coverUrl?: string          // first photo URL for card preview
  createdBy: string
  createdAt: string
  updatedAt: string
}

interface SitePhoto {
  id: string
  url: string
  storagePath: string
  caption?: string
  order: number
  uploadedBy: string
  uploadedAt: string
}

// ─── PDF helpers ───────────────────────────────────────────────────────────────

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

const PDF_BG   = [15,  23,  42 ] as [number, number, number]
const PDF_CARD = [30,  41,  59 ] as [number, number, number]
const PDF_DIM  = [100, 116, 139] as [number, number, number]
const PDF_LT   = [226, 232, 240] as [number, number, number]
const PDF_BLUE = [59,  130, 246] as [number, number, number]

async function exportVisitPdf(project: Project, visit: SiteVisit, photos: SitePhoto[]) {
  const pd = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const W = pd.internal.pageSize.getWidth()
  const H = pd.internal.pageSize.getHeight()
  const MX = 8
  const FOOTER = 10

  const fillBg = () => { pd.setFillColor(...PDF_BG); pd.rect(0, 0, W, H, 'F') }

  // ── Page 1 background ──
  fillBg()

  // Blue top accent bar
  pd.setFillColor(...PDF_BLUE); pd.rect(0, 0, W, 1.5, 'F')

  // Header card
  pd.setFillColor(...PDF_CARD); pd.rect(0, 1.5, W, 28, 'F')
  pd.setFontSize(15); pd.setFont('helvetica', 'bold'); pd.setTextColor(...PDF_LT)
  pd.text(project.projectName, MX, 13)
  pd.setFontSize(8); pd.setFont('helvetica', 'normal'); pd.setTextColor(...PDF_DIM)
  const meta = [
    project.projectNumber,
    project.address,
    [project.city, project.state].filter(Boolean).join(', '),
  ].filter(Boolean).join('  ·  ')
  pd.text(meta, MX, 19.5)
  if (project.clientName) pd.text(`Client: ${project.clientName}`, MX, 25.5)
  pd.setFontSize(7); pd.setFont('helvetica', 'bold'); pd.setTextColor(...PDF_BLUE)
  pd.text('SITE VISIT REPORT', W - MX, 10, { align: 'right' })

  let y = 35

  // ── Visit info bar ──
  const visitLabel = new Date(visit.visitDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  pd.setFillColor(20, 30, 50); pd.rect(0, y, W, 22, 'F')
  pd.setFillColor(...PDF_BLUE); pd.rect(0, y, 3, 22, 'F')
  pd.setFontSize(11); pd.setFont('helvetica', 'bold'); pd.setTextColor(...PDF_LT)
  pd.text(visit.title || visitLabel, 12, y + 9)
  pd.setFontSize(8); pd.setFont('helvetica', 'normal'); pd.setTextColor(...PDF_DIM)
  if (visit.title) pd.text(visitLabel, 12, y + 16)
  pd.text(`${photos.length} photo${photos.length !== 1 ? 's' : ''}`, W - MX, y + 9, { align: 'right' })
  y += 26

  // ── Visit notes ──
  if (visit.notes) {
    pd.setFontSize(8); pd.setFont('helvetica', 'normal'); pd.setTextColor(...PDF_DIM)
    const lines = pd.splitTextToSize(`Field Notes: ${visit.notes}`, W - MX * 2) as string[]
    pd.text(lines, MX, y)
    y += lines.length * 4.5 + 5
  }

  // ── Pre-load all images ──
  const dataUrls = await Promise.all(photos.map(p => toDataUrl(p.url)))

  // ── Photo grid — 2 per row ──
  if (photos.length === 0) {
    pd.setFontSize(10); pd.setTextColor(...PDF_DIM)
    pd.text('No photos for this site visit.', W / 2, y + 20, { align: 'center' })
  }

  const GAP   = 5
  const colW  = (W - MX * 2 - GAP) / 2
  const imgH  = colW * 0.68
  const capH  = 5.5
  const rowH  = imgH + capH + 6

  for (let i = 0; i < photos.length; i++) {
    const col = i % 2
    // New page when left column won't fit
    if (col === 0 && i > 0 && y + rowH > H - FOOTER - 4) {
      pd.addPage(); fillBg(); y = MX
    }
    const x = MX + col * (colW + GAP)
    const du = dataUrls[i]
    if (du) {
      try { pd.addImage(du, 'JPEG', x, y, colW, imgH) } catch {
        pd.setFillColor(...PDF_CARD); pd.rect(x, y, colW, imgH, 'F')
      }
    } else {
      pd.setFillColor(...PDF_CARD); pd.rect(x, y, colW, imgH, 'F')
      pd.setTextColor(...PDF_DIM); pd.setFontSize(7)
      pd.text('Unavailable', x + colW / 2, y + imgH / 2, { align: 'center' })
    }
    if (photos[i].caption) {
      pd.setFontSize(7); pd.setFont('helvetica', 'normal'); pd.setTextColor(...PDF_DIM)
      const cap = (pd.splitTextToSize(photos[i].caption!, colW) as string[])[0]
      pd.text(cap, x, y + imgH + 4)
    }
    // Advance y after each right-side photo (or the very last photo)
    if (col === 1 || i === photos.length - 1) y += rowH
  }

  // ── Footers on all pages ──
  const total = pd.getNumberOfPages()
  const exportTs = new Date().toLocaleString()
  for (let p = 1; p <= total; p++) {
    pd.setPage(p)
    pd.setFillColor(...PDF_CARD); pd.rect(0, H - FOOTER, W, FOOTER, 'F')
    pd.setFontSize(7); pd.setFont('helvetica', 'normal'); pd.setTextColor(...PDF_DIM)
    pd.text(`${project.projectNumber} · ${project.projectName}`, MX, H - 3.5)
    pd.text(`Page ${p} of ${total}`, W - MX, H - 3.5, { align: 'right' })
    pd.text(exportTs, W / 2, H - 3.5, { align: 'center' })
  }

  pd.save(`${project.projectNumber}-site-visit-${visit.visitDate}.pdf`)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

function today() {
  return new Date().toISOString().split('T')[0]
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({
  photos, idx, onClose, onPrev, onNext,
}: {
  photos: SitePhoto[]
  idx: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}) {
  const photo = photos[idx]
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onPrev()
      if (e.key === 'ArrowRight') onNext()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, onPrev, onNext])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex flex-col"
      onClick={onClose}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0" onClick={e => e.stopPropagation()}>
        <span className="text-slate-400 text-sm">{idx + 1} / {photos.length}</span>
        <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors">
          <X size={20} />
        </button>
      </div>

      {/* Image */}
      <div className="flex-1 flex items-center justify-center min-h-0 px-4" onClick={e => e.stopPropagation()}>
        <button
          onClick={onPrev}
          disabled={idx === 0}
          className="p-2 text-slate-400 hover:text-white disabled:opacity-20 transition-colors shrink-0"
        >
          <ChevronLeft size={28} />
        </button>
        <img
          src={photo.url}
          alt={photo.caption || `Photo ${idx + 1}`}
          className="max-h-full max-w-full object-contain rounded-lg"
          style={{ maxHeight: 'calc(100vh - 140px)' }}
        />
        <button
          onClick={onNext}
          disabled={idx === photos.length - 1}
          className="p-2 text-slate-400 hover:text-white disabled:opacity-20 transition-colors shrink-0"
        >
          <ChevronRight size={28} />
        </button>
      </div>

      {/* Caption */}
      {photo.caption && (
        <div className="px-6 py-3 text-center text-slate-400 text-sm shrink-0" onClick={e => e.stopPropagation()}>
          {photo.caption}
        </div>
      )}
    </div>
  )
}

// ─── New Visit Modal ───────────────────────────────────────────────────────────

function NewVisitModal({
  onClose,
  onCreate,
  uploading,
  uploadProgress,
}: {
  onClose: () => void
  onCreate: (files: File[], data: { visitDate: string; title?: string; notes?: string }) => Promise<void>
  uploading: boolean
  uploadProgress: number
}) {
  const [visitDate, setVisitDate] = useState(today())
  const [title, setTitle]         = useState('')
  const [notes, setNotes]         = useState('')
  const [files, setFiles]         = useState<File[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const previews = files.map(f => URL.createObjectURL(f))

  const handleSubmit = async () => {
    if (files.length === 0) return
    await onCreate(files, { visitDate, title: title || undefined, notes: notes || undefined })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <h3 className="font-semibold text-slate-100">New Site Visit</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Date */}
          <div>
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Visit Date</label>
            <input
              type="date"
              value={visitDate}
              onChange={e => setVisitDate(e.target.value)}
              className="mt-1.5 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Title <span className="normal-case text-slate-600">(optional)</span></label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Week 12 Walk, Structural Inspection"
              className="mt-1.5 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Field Notes <span className="normal-case text-slate-600">(optional)</span></label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Observations, issues noted, next steps…"
              className="mt-1.5 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {/* Photo upload zone */}
          <div>
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Photos</label>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-1.5 w-full border-2 border-dashed border-slate-700 hover:border-blue-500/50 rounded-xl py-6 flex flex-col items-center gap-2 transition-colors"
            >
              <Camera size={24} className="text-slate-500" />
              <span className="text-sm text-slate-400">Tap to select photos</span>
              <span className="text-xs text-slate-600">Multiple files supported</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => setFiles(Array.from(e.target.files ?? []))}
            />
          </div>

          {/* Preview strip */}
          {files.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-2">{files.length} photo{files.length !== 1 ? 's' : ''} selected</p>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {previews.map((src, i) => (
                  <img key={i} src={src} alt="" className="w-16 h-16 object-cover rounded-lg shrink-0 border border-slate-700" />
                ))}
              </div>
            </div>
          )}

          {/* Upload progress */}
          {uploading && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-400">Uploading…</span>
                <span className="text-xs text-blue-400">{uploadProgress}%</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-slate-800 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={files.length === 0 || uploading}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            {uploading ? <><Loader2 size={15} className="animate-spin" /> Uploading…</> : 'Create Visit'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Edit Visit Modal ─────────────────────────────────────────────────────────

function EditVisitModal({
  visit,
  projectId,
  onClose,
}: {
  visit: SiteVisit
  projectId: string
  onClose: () => void
}) {
  const [visitDate, setVisitDate] = useState(visit.visitDate)
  const [title, setTitle]         = useState(visit.title ?? '')
  const [notes, setNotes]         = useState(visit.notes ?? '')
  const [saving, setSaving]       = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await updateDoc(doc(db, 'projects', projectId, 'siteVisits', visit.id), {
      visitDate,
      title: title || null,
      notes: notes || null,
      updatedAt: new Date().toISOString(),
    })
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h3 className="font-semibold text-slate-100">Edit Site Visit</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Visit Date</label>
            <input type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)}
              className="mt-1.5 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Optional visit title"
              className="mt-1.5 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Field Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Observations, issues noted…"
              className="mt-1.5 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-500 resize-none" />
          </div>
        </div>
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-800 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2">
            {saving ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Visit Detail Sheet ───────────────────────────────────────────────────────

function VisitDetailSheet({
  visit,
  photos,
  project: _project,
  onClose,
  onAddPhotos,
  onDeletePhoto,
  onUpdateCaption,
  onExport,
  uploading,
  uploadProgress,
  exporting,
}: {
  visit: SiteVisit
  photos: SitePhoto[]
  project: Project
  onClose: () => void
  onAddPhotos: (files: File[]) => Promise<void>
  onDeletePhoto: (photo: SitePhoto) => Promise<void>
  onUpdateCaption: (photo: SitePhoto, caption: string) => Promise<void>
  onExport: () => Promise<void>
  uploading: boolean
  uploadProgress: number
  exporting: boolean
}) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const [editCaption, setEditCaption] = useState<{ id: string; value: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <>
      <div className="fixed inset-0 z-30 bg-slate-950 flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-800 bg-slate-900 shrink-0">
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg transition-colors">
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-100 truncate">{visit.title || fmtDate(visit.visitDate)}</h3>
            {visit.title && <p className="text-xs text-slate-500">{fmtDate(visit.visitDate)}</p>}
          </div>
          <button
            onClick={onExport}
            disabled={exporting || photos.length === 0}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 px-3 py-2 rounded-lg transition-colors"
          >
            {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            PDF
          </button>
        </div>

        {/* Notes bar */}
        {visit.notes && (
          <div className="px-4 py-3 bg-slate-900/50 border-b border-slate-800 shrink-0">
            <p className="text-xs text-slate-400 flex items-start gap-1.5">
              <FileText size={12} className="mt-0.5 shrink-0 text-slate-500" />
              {visit.notes}
            </p>
          </div>
        )}

        {/* Photo grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {photos.length === 0 && !uploading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ImageIcon size={32} className="text-slate-700 mb-3" />
              <p className="text-slate-500 text-sm">No photos yet</p>
              <button
                onClick={() => fileRef.current?.click()}
                className="mt-4 flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                <Plus size={15} /> Add first photo
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {photos.map((photo, idx) => (
                <div key={photo.id} className="group relative">
                  <button
                    onClick={() => setLightboxIdx(idx)}
                    className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-800 block"
                  >
                    <img src={photo.url} alt={photo.caption || ''} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-xl flex items-center justify-center">
                      <ZoomIn size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={() => onDeletePhoto(photo)}
                    className="absolute top-2 right-2 p-1 bg-black/60 rounded-md text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={13} />
                  </button>

                  {/* Caption */}
                  {editCaption?.id === photo.id ? (
                    <input
                      autoFocus
                      value={editCaption.value}
                      onChange={e => setEditCaption({ id: photo.id, value: e.target.value })}
                      onBlur={async () => {
                        await onUpdateCaption(photo, editCaption.value)
                        setEditCaption(null)
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') e.currentTarget.blur()
                        if (e.key === 'Escape') setEditCaption(null)
                      }}
                      className="mt-1.5 w-full bg-slate-800 border border-blue-500 rounded-lg px-2 py-1 text-slate-100 text-xs focus:outline-none"
                    />
                  ) : (
                    <button
                      onClick={() => setEditCaption({ id: photo.id, value: photo.caption ?? '' })}
                      className="mt-1.5 w-full text-left text-xs text-slate-500 hover:text-slate-300 truncate block transition-colors"
                    >
                      {photo.caption || <span className="italic">Add caption…</span>}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Upload progress */}
          {uploading && (
            <div className="mt-4 bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-300 flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-blue-400" /> Uploading photos…
                </span>
                <span className="text-xs text-blue-400">{uploadProgress}%</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Bottom FAB */}
        <div className="px-4 pb-6 pt-3 border-t border-slate-800 bg-slate-900 shrink-0">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors"
          >
            <Plus size={18} /> Add Photos
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => {
            const files = Array.from(e.target.files ?? [])
            if (files.length) onAddPhotos(files)
            e.target.value = ''
          }}
        />
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <Lightbox
          photos={photos}
          idx={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onPrev={() => setLightboxIdx(i => Math.max(0, (i ?? 0) - 1))}
          onNext={() => setLightboxIdx(i => Math.min(photos.length - 1, (i ?? 0) + 1))}
        />
      )}
    </>
  )
}

// ─── Visit Card ───────────────────────────────────────────────────────────────

function VisitCard({
  visit,
  onView,
  onEdit,
  onDelete,
  deleting,
}: {
  visit: SiteVisit
  onView: () => void
  onEdit: () => void
  onDelete: () => void
  deleting: boolean
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Cover photo */}
      {visit.coverUrl ? (
        <button onClick={onView} className="w-full h-40 block bg-slate-800 relative overflow-hidden">
          <img src={visit.coverUrl} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-full">
            <Camera size={11} className="text-slate-300" />
            <span className="text-xs text-slate-200 font-medium">{visit.photoCount} photo{visit.photoCount !== 1 ? 's' : ''}</span>
          </div>
        </button>
      ) : (
        <button
          onClick={onView}
          className="w-full h-28 bg-slate-800/50 flex flex-col items-center justify-center gap-2 hover:bg-slate-800 transition-colors"
        >
          <Camera size={24} className="text-slate-600" />
          <span className="text-xs text-slate-600">{visit.photoCount} photo{visit.photoCount !== 1 ? 's' : ''}</span>
        </button>
      )}

      {/* Meta */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-slate-100 text-sm truncate">{visit.title || 'Site Visit'}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <CalendarDays size={11} className="text-slate-500 shrink-0" />
              <span className="text-xs text-slate-500">{fmtDate(visit.visitDate)}</span>
            </div>
            {visit.notes && (
              <p className="text-xs text-slate-600 mt-1.5 line-clamp-2">{visit.notes}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onEdit} className="p-1.5 text-slate-500 hover:text-slate-300 rounded-lg transition-colors">
              <Pencil size={14} />
            </button>
            <button onClick={onDelete} disabled={deleting} className="p-1.5 text-slate-500 hover:text-red-400 disabled:opacity-40 rounded-lg transition-colors">
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </button>
          </div>
        </div>

        <button
          onClick={onView}
          className="mt-3 w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
        >
          View Photos
        </button>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props { project: Project }

export function PhotosTab({ project }: Props) {
  const { user } = useAuthStore()
  const [visits, setVisits]           = useState<SiteVisit[]>([])
  const [selectedVisit, setSelected]  = useState<SiteVisit | null>(null)
  const [photos, setPhotos]           = useState<SitePhoto[]>([])
  const [showNew, setShowNew]         = useState(false)
  const [editVisit, setEditVisit]     = useState<SiteVisit | null>(null)
  const [uploading, setUploading]     = useState(false)
  const [uploadProgress, setProgress] = useState(0)
  const [exporting, setExporting]     = useState(false)
  const [deletingId, setDeletingId]   = useState<string | null>(null)

  // ── Fetch visits ──────────────────────────────────────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, 'projects', project.id, 'siteVisits'),
      orderBy('visitDate', 'desc'),
    )
    return onSnapshot(q, snap => {
      setVisits(snap.docs.map(d => ({ id: d.id, ...d.data() } as SiteVisit)))
    })
  }, [project.id])

  // Keep selectedVisit in sync when visits update
  useEffect(() => {
    if (!selectedVisit) return
    const updated = visits.find(v => v.id === selectedVisit.id)
    if (updated) setSelected(updated)
  }, [visits]) // eslint-disable-line

  // ── Fetch photos for selected visit ──────────────────────────────────────
  useEffect(() => {
    if (!selectedVisit) { setPhotos([]); return }
    const q = query(
      collection(db, 'projects', project.id, 'siteVisits', selectedVisit.id, 'photos'),
      orderBy('order', 'asc'),
    )
    return onSnapshot(q, snap => {
      setPhotos(snap.docs.map(d => ({ id: d.id, ...d.data() } as SitePhoto)))
    })
  }, [project.id, selectedVisit?.id])

  // ── Upload photos to a visit ──────────────────────────────────────────────
  const uploadPhotos = useCallback(async (visitId: string, files: File[], baseOrder = 0) => {
    setUploading(true)
    setProgress(0)
    const displayName = user?.displayName || user?.email || 'Unknown'
    const now = new Date().toISOString()
    let done = 0

    await Promise.all(files.map(async (file, i) => {
      const path = `projects/${project.id}/site-visits/${visitId}/${Date.now()}-${i}-${file.name}`
      const storageRef = sRef(storage, path)
      const task = uploadBytesResumable(storageRef, file)

      await new Promise<void>((resolve, reject) => {
        task.on(
          'state_changed',
          snap => {
            const filePct = snap.bytesTransferred / snap.totalBytes
            setProgress(Math.round(((done + filePct) / files.length) * 100))
          },
          reject,
          async () => {
            const url = await getDownloadURL(task.snapshot.ref)
            await addDoc(
              collection(db, 'projects', project.id, 'siteVisits', visitId, 'photos'),
              { url, storagePath: path, caption: '', order: baseOrder + i, uploadedBy: displayName, uploadedAt: now },
            )
            // Update photoCount + coverUrl on first photo
            const visitRef = doc(db, 'projects', project.id, 'siteVisits', visitId)
            await updateDoc(visitRef, {
              photoCount: increment(1),
              ...(baseOrder + i === 0 ? { coverUrl: url } : {}),
              updatedAt: now,
            })
            done++
            resolve()
          },
        )
      })
    }))

    setUploading(false)
    setProgress(0)
  }, [project.id, user])

  // ── Create new visit ──────────────────────────────────────────────────────
  const handleCreate = async (files: File[], data: { visitDate: string; title?: string; notes?: string }) => {
    const displayName = user?.displayName || user?.email || 'Unknown'
    const now = new Date().toISOString()
    const visitRef = await addDoc(
      collection(db, 'projects', project.id, 'siteVisits'),
      { ...data, photoCount: 0, coverUrl: null, createdBy: displayName, createdAt: now, updatedAt: now },
    )
    await uploadPhotos(visitRef.id, files, 0)
  }

  // ── Delete photo ─────────────────────────────────────────────────────────
  const handleDeletePhoto = async (photo: SitePhoto) => {
    if (!selectedVisit) return
    if (!confirm('Delete this photo?')) return
    try { await deleteObject(sRef(storage, photo.storagePath)) } catch {}
    await deleteDoc(doc(db, 'projects', project.id, 'siteVisits', selectedVisit.id, 'photos', photo.id))
    const newCount = Math.max(0, selectedVisit.photoCount - 1)
    // If deleted photo was the cover, find the next one
    const updates: Record<string, unknown> = { photoCount: newCount, updatedAt: new Date().toISOString() }
    if (selectedVisit.coverUrl === photo.url) {
      const remaining = photos.filter(p => p.id !== photo.id)
      updates.coverUrl = remaining[0]?.url ?? null
    }
    await updateDoc(doc(db, 'projects', project.id, 'siteVisits', selectedVisit.id), updates)
  }

  // ── Update caption ────────────────────────────────────────────────────────
  const handleUpdateCaption = async (photo: SitePhoto, caption: string) => {
    if (!selectedVisit) return
    await updateDoc(
      doc(db, 'projects', project.id, 'siteVisits', selectedVisit.id, 'photos', photo.id),
      { caption },
    )
  }

  // ── Delete visit ─────────────────────────────────────────────────────────
  const handleDeleteVisit = async (visit: SiteVisit) => {
    if (!confirm(`Delete this site visit and all ${visit.photoCount} photo${visit.photoCount !== 1 ? 's' : ''}? This cannot be undone.`)) return
    setDeletingId(visit.id)
    try {
      const snap = await getDocs(collection(db, 'projects', project.id, 'siteVisits', visit.id, 'photos'))
      const batch = writeBatch(db)
      for (const d of snap.docs) {
        const p = d.data() as SitePhoto
        try { await deleteObject(sRef(storage, p.storagePath)) } catch {}
        batch.delete(d.ref)
      }
      await batch.commit()
      await deleteDoc(doc(db, 'projects', project.id, 'siteVisits', visit.id))
      if (selectedVisit?.id === visit.id) setSelected(null)
    } finally {
      setDeletingId(null)
    }
  }

  // ── Export PDF ────────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (!selectedVisit) return
    setExporting(true)
    try { await exportVisitPdf(project, selectedVisit, photos) }
    finally { setExporting(false) }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const totalPhotos = visits.reduce((s, v) => s + v.photoCount, 0)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-200">Site Visits</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {visits.length} visit{visits.length !== 1 ? 's' : ''} · {totalPhotos} photo{totalPhotos !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
        >
          <Plus size={15} /> New Visit
        </button>
      </div>

      {/* Empty state */}
      {visits.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4">
            <Camera size={28} className="text-slate-600" />
          </div>
          <p className="text-slate-400 font-medium">No site visits yet</p>
          <p className="text-slate-600 text-sm mt-1">Track progress with dated photo visits</p>
          <button
            onClick={() => setShowNew(true)}
            className="mt-5 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
          >
            <Plus size={15} /> Add First Visit
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {visits.map(visit => (
            <VisitCard
              key={visit.id}
              visit={visit}
              onView={() => setSelected(visit)}
              onEdit={() => setEditVisit(visit)}
              onDelete={() => handleDeleteVisit(visit)}
              deleting={deletingId === visit.id}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showNew && (
        <NewVisitModal
          onClose={() => setShowNew(false)}
          onCreate={handleCreate}
          uploading={uploading}
          uploadProgress={uploadProgress}
        />
      )}
      {editVisit && (
        <EditVisitModal
          visit={editVisit}
          projectId={project.id}
          onClose={() => setEditVisit(null)}
        />
      )}

      {/* Detail sheet */}
      {selectedVisit && (
        <VisitDetailSheet
          visit={selectedVisit}
          photos={photos}
          project={project}
          onClose={() => setSelected(null)}
          onAddPhotos={files => uploadPhotos(selectedVisit.id, files, photos.length)}
          onDeletePhoto={handleDeletePhoto}
          onUpdateCaption={handleUpdateCaption}
          onExport={handleExport}
          uploading={uploading}
          uploadProgress={uploadProgress}
          exporting={exporting}
        />
      )}
    </div>
  )
}
