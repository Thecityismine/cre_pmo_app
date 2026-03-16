/**
 * CRE PMO V1 → V2 Migration Script
 * Reads: scripts/cre-backup-2026-03-16.json
 * Writes to: Firebase Firestore (portfolio-f86b9)
 *
 * Run:
 *   node scripts/migrate-v1-data.mjs
 *
 * Prerequisites:
 *   1. Download Firebase service account key:
 *      Firebase Console → Project Settings → Service Accounts → Generate new private key
 *      Save as: scripts/serviceAccountKey.json  (NEVER commit this file)
 *   2. npm install firebase-admin --save-dev
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

// ─── Service account ──────────────────────────────────────────────────────────
const SA_PATH = resolve(__dirname, 'serviceAccountKey.json')
if (!existsSync(SA_PATH)) {
  console.error('\n❌ Missing scripts/serviceAccountKey.json')
  console.error('   1. Go to Firebase Console → Project Settings → Service Accounts')
  console.error('   2. Click "Generate new private key" → Download JSON')
  console.error('   3. Rename it to serviceAccountKey.json and place it in scripts/')
  process.exit(1)
}

let admin
try {
  admin = require('firebase-admin')
} catch {
  console.error('\n❌ firebase-admin not installed')
  console.error('   Run: npm install firebase-admin --save-dev')
  process.exit(1)
}

const serviceAccount = JSON.parse(readFileSync(SA_PATH, 'utf-8'))
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
const db = admin.firestore()
const now = new Date().toISOString()

// ─── Load backup ──────────────────────────────────────────────────────────────
const BACKUP = resolve(__dirname, 'cre-backup-2026-03-16.json')
if (!existsSync(BACKUP)) {
  console.error('\n❌ Missing', BACKUP)
  process.exit(1)
}

const raw = JSON.parse(readFileSync(BACKUP, 'utf-8'))
console.log(`\n📦 Backup: v${raw.version} — exported ${raw.exportDate}`)
console.log(`   Projects:     ${raw.projects?.length ?? 0}`)
console.log(`   Contacts:     ${raw.contacts?.length ?? 0}`)
console.log(`   Master Tasks: ${raw.masterTasks?.length ?? 0}\n`)

// ─── Batch writer ─────────────────────────────────────────────────────────────
async function batchWrite(collectionName, docs) {
  if (docs.length === 0) return
  const LIMIT = 400
  let written = 0
  for (let i = 0; i < docs.length; i += LIMIT) {
    const batch = db.batch()
    for (const { id, data } of docs.slice(i, i + LIMIT)) {
      const ref = id
        ? db.collection(collectionName).doc(String(id))
        : db.collection(collectionName).doc()
      batch.set(ref, data, { merge: true })
    }
    await batch.commit()
    written += Math.min(LIMIT, docs.length - i)
  }
  console.log(`  ✓ ${collectionName}: ${written} docs`)
}

// ─── Status mapping ───────────────────────────────────────────────────────────
function mapStatus(s) {
  const m = {
    'active':       'construction',
    'Active':       'construction',
    'archived':     'closed',
    'Archived':     'closed',
    'on-hold':      'planning',
    'On Hold':      'planning',
    'completed':    'closeout',
    'Completed':    'closeout',
    'pre-project':  'pre-project',
    'Pre-Project':  'pre-project',
    'planning':     'planning',
    'Planning':     'planning',
    'design':       'design',
    'Design':       'design',
    'construction': 'construction',
    'Construction': 'construction',
  }
  return m[s] ?? 'planning'
}

function mapProfile(t) {
  const m = { 'Standard': 'S', 'Light': 'L', 'Enhanced': 'E', 'S': 'S', 'L': 'L', 'E': 'E' }
  return m[t] ?? 'S'
}

function mapTaskStatus(completed) {
  if (completed === true) return 'complete'
  if (completed === false) return 'not-started'
  const m = { 'complete': 'complete', 'in-progress': 'in-progress', 'not-started': 'not-started', 'n-a': 'n-a', 'blocked': 'blocked' }
  return m[String(completed).toLowerCase()] ?? 'not-started'
}

function mapRole(role) {
  const m = {
    'Project Manager': 'project-manager',
    'Project Executive': 'project-executive',
    'Architect': 'architect',
    'General Contractor': 'general-contractor',
    'GC': 'general-contractor',
    'MEP Engineer': 'mep-engineer',
    'IT Vendor': 'it-vendor',
    'Client Representative': 'client-rep',
    'Facilities': 'facilities',
    'D&C Account Director': 'project-executive',
    'Owner': 'client-rep',
  }
  return m[role] ?? 'other'
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function migrate() {
  const projectDocs  = []
  const taskDocs     = []
  const teamDocs     = []
  const budgetDocs   = []

  // ── Projects ────────────────────────────────────────────────────────────────
  for (const p of (raw.projects ?? [])) {
    const projectId = String(p.id)

    // Parse address into components (format: "123 Street, City, ST ZIP")
    const addressParts = (p.address ?? '').split(',').map(s => s.trim())
    const street = addressParts[0] ?? ''
    const city   = addressParts[1] ?? ''
    const stateZip = (addressParts[2] ?? '').trim()
    const state  = stateZip.split(' ')[0] ?? ''

    projectDocs.push({
      id: projectId,
      data: {
        projectName:          p.name ?? 'Unnamed Project',
        projectNumber:        '',                           // V1 didn't have a SO number field
        profile:              mapProfile(p.projectType),
        status:               mapStatus(p.status),
        currentPhase:         '',
        address:              street,
        city,
        state,
        country:              'USA',
        lat:                  p.latitude ?? null,
        lng:                  p.longitude ?? null,
        clientName:           'JPMorgan Chase',
        businessUnit:         '',
        projectManager:       '',                          // populated from projectTeam below
        teamMembers:          [],
        startDate:            '',
        targetCompletionDate: p.leaseExpiration ?? '',
        actualCompletionDate: null,
        warrantyStartDate:    p.warrantyStartDate ?? null,
        warrantyEndDate:      p.warrantyEndDate ?? null,
        totalBudget:          Number(p.approvedBudget ?? 0),
        committedCost:        0,
        forecastCost:         0,
        actualCost:           0,
        contingencyPercent:   10,
        rsf:                  Number(p.sqft ?? 0) || null,
        isActive:             p.status === 'active' || p.status === 'Active',
        hasMER:               false,
        archived:             Boolean(p.archived),
        _migratedFromV1:      true,
        _v1Id:                projectId,
        createdAt:            p.createdAt ?? now,
        updatedAt:            now,
        createdBy:            'migration',
      },
    })

    // ── Tasks ──────────────────────────────────────────────────────────────────
    for (const t of (p.tasks ?? [])) {
      taskDocs.push({
        id: `${projectId}_${t.id}`,
        data: {
          projectId,
          title:                t.task ?? '',
          description:          t.notes ?? '',
          status:               mapTaskStatus(t.completed),
          priority:             'medium',
          phase:                t.subdivision ?? '',
          category:             t.subdivision ?? 'General',
          assignedTo:           t.team ?? '',
          dueDate:              '',
          completedDate:        '',
          notes:                t.notes ?? '',
          order:                Number(t.id ?? 0),
          isFromMasterChecklist: true,
          masterTaskId:         String(t.id ?? ''),
          subtasks:             Array.isArray(t.subtasks) ? t.subtasks : [],
          _migratedFromV1:      true,
          createdAt:            t.createdAt ?? now,
          updatedAt:            t.updatedAt ?? now,
        },
      })
    }

    // ── Project team members ───────────────────────────────────────────────────
    for (const m of (p.projectTeam ?? [])) {
      teamDocs.push({
        id: `${projectId}_${m.id}`,
        data: {
          projectId,
          contactId:   m.contactId ? String(m.contactId) : null,
          name:        m.name ?? '',
          role:        m.role ?? '',
          email:       m.email ?? '',
          phone:       m.phone ?? '',
          company:     m.company ?? '',
          trades:      Array.isArray(m.trades) ? m.trades : [],
          addedAt:     m.addedAt ?? now,
          _migratedFromV1: true,
        },
      })
    }

    // ── Budget line items ──────────────────────────────────────────────────────
    const budgetArr = Array.isArray(p.budget)
      ? p.budget
      : Object.values(p.budget ?? {})

    for (const b of budgetArr) {
      const catMap = {
        'Hard Cost': 'hard-cost',
        'Soft Cost': 'soft-cost',
        'FF&E': 'ff-e',
        'IT/AV': 'it-av',
        'Contingency': 'contingency',
        "Owner's Reserve": 'owner-reserve',
      }
      budgetDocs.push({
        id: String(b.id),
        data: {
          projectId,
          category:        catMap[b.category] ?? 'soft-cost',
          description:     b.category ?? '',
          budgetAmount:    Number(b.baselineCost ?? 0),
          committedAmount: 0,
          forecastAmount:  Number(b.targetCost ?? 0),
          actualAmount:    0,
          variance:        Number(b.baselineCost ?? 0) - Number(b.targetCost ?? 0),
          notes:           '',
          _migratedFromV1: true,
          createdAt:       b.createdAt ?? now,
          updatedAt:       now,
        },
      })
    }
  }

  // ── Global contacts ──────────────────────────────────────────────────────────
  const contactDocs = (raw.contacts ?? []).map(c => ({
    id: String(c.id),
    data: {
      projectId:  null,
      name:       c.name ?? '',
      company:    c.company ?? '',
      role:       mapRole(c.role),
      email:      c.email ?? '',
      phone:      c.phone ?? '',
      trades:     Array.isArray(c.trades) ? c.trades : [],
      notes:      c.notes ?? '',
      _migratedFromV1: true,
      createdAt:  c.createdAt ?? now,
      updatedAt:  c.updatedAt ?? now,
    },
  }))

  // ── Master tasks ──────────────────────────────────────────────────────────────
  const masterTaskDocs = (raw.masterTasks ?? []).map((t, i) => ({
    id: String(t.id),
    data: {
      title:           t.task ?? '',
      category:        t.subdivision ?? 'General',
      phase:           t.subdivision ?? '',
      assignedTeam:    t.team ?? '',
      defaultPriority: 'medium',
      applicableTo:    ['L', 'S', 'E'],
      order:           Number(t.id ?? i),
      notes:           t.notes ?? '',
      subtasks:        Array.isArray(t.subtasks) ? t.subtasks : [],
      _migratedFromV1: true,
      createdAt:       t.createdAt ?? now,
      updatedAt:       t.updatedAt ?? now,
    },
  }))

  // ── Write all collections ─────────────────────────────────────────────────────
  console.log('📝 Writing to Firestore (portfolio-f86b9)...\n')
  await batchWrite('projects',     projectDocs)
  await batchWrite('tasks',        taskDocs)
  await batchWrite('projectTeam',  teamDocs)
  await batchWrite('budgetItems',  budgetDocs)
  await batchWrite('contacts',     contactDocs)
  await batchWrite('masterTasks',  masterTaskDocs)

  console.log('\n✅ Migration complete!')
  console.log(`   Projects:     ${projectDocs.length}`)
  console.log(`   Tasks:        ${taskDocs.length}`)
  console.log(`   Team members: ${teamDocs.length}`)
  console.log(`   Budget items: ${budgetDocs.length}`)
  console.log(`   Contacts:     ${contactDocs.length}`)
  console.log(`   Master Tasks: ${masterTaskDocs.length}`)
  console.log('\n🌐 Open Firebase Console → Firestore to verify.')
  console.log('   https://console.firebase.google.com/project/portfolio-f86b9/firestore')
}

migrate().catch(err => {
  console.error('\n❌ Migration failed:', err.message)
  process.exit(1)
})
