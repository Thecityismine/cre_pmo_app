/**
 * CRE PMO V1 → V2 Migration Script
 *
 * Usage:
 *   1. Export your JSON backup from the V1 app (Settings → Export Data)
 *   2. Place the file at: scripts/v1-backup.json
 *   3. Set your Firebase credentials in .env.local
 *   4. Run: node scripts/migrate-v1-data.mjs
 *
 * What this migrates:
 *   - Projects → /projects/{id}
 *   - Tasks per project → /tasks/{id}
 *   - Contacts → /contacts/{id}
 *   - Master tasks → /masterTasks/{id}
 */

import { readFileSync } from 'fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

// ─── Load service account ────────────────────────────────────────────────────
// Download from Firebase Console → Project Settings → Service Accounts → Generate new private key
// Place at: scripts/serviceAccountKey.json (NEVER commit this file)
let serviceAccount
try {
  serviceAccount = require('./serviceAccountKey.json')
} catch {
  console.error('❌ Missing scripts/serviceAccountKey.json')
  console.error('   Download from Firebase Console → Project Settings → Service Accounts')
  process.exit(1)
}

initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

// ─── Load V1 backup ──────────────────────────────────────────────────────────
let v1Data
try {
  const raw = readFileSync('./scripts/v1-backup.json', 'utf-8')
  v1Data = JSON.parse(raw)
} catch {
  console.error('❌ Missing scripts/v1-backup.json')
  console.error('   Export your data from the V1 app first.')
  process.exit(1)
}

const now = new Date().toISOString()

// ─── Helpers ─────────────────────────────────────────────────────────────────
function sanitize(val, fallback = '') {
  return val !== undefined && val !== null ? val : fallback
}

function mapStatus(v1Status) {
  const statusMap = {
    'Pre-Project': 'pre-project',
    'Initiate': 'initiate',
    'Planning': 'planning',
    'Design': 'design',
    'Construction': 'construction',
    'Handover': 'handover',
    'Closeout': 'closeout',
    'Defect Period': 'defect-period',
    'Closed': 'closed',
    'Active': 'construction',
    'On Hold': 'planning',
  }
  return statusMap[v1Status] ?? 'planning'
}

function mapTaskStatus(v1Status) {
  const map = {
    'Complete': 'complete',
    'In Progress': 'in-progress',
    'Not Started': 'not-started',
    'On Hold': 'on-hold',
    'Blocked': 'blocked',
    'N/A': 'n-a',
    true: 'complete',
    false: 'not-started',
  }
  return map[v1Status] ?? 'not-started'
}

async function batchWrite(collectionName, docs) {
  const BATCH_SIZE = 400  // Firestore limit is 500 per batch
  let count = 0

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch()
    const chunk = docs.slice(i, i + BATCH_SIZE)

    for (const { id, data } of chunk) {
      const ref = id ? db.collection(collectionName).doc(id) : db.collection(collectionName).doc()
      batch.set(ref, data, { merge: true })
    }

    await batch.commit()
    count += chunk.length
    console.log(`  ✓ Wrote ${count}/${docs.length} ${collectionName}`)
  }
}

// ─── Main migration ───────────────────────────────────────────────────────────
async function migrate() {
  console.log('🚀 Starting CRE PMO V1 → V2 migration...\n')

  const projects = Array.isArray(v1Data?.projects) ? v1Data.projects :
                   Array.isArray(v1Data) ? v1Data : []

  if (projects.length === 0) {
    console.warn('⚠️  No projects found in backup. Check the JSON structure.')
    console.log('   Top-level keys:', Object.keys(v1Data ?? {}))
    process.exit(0)
  }

  console.log(`📦 Found ${projects.length} projects to migrate\n`)

  // ── Projects ──────────────────────────────────────────────────────────────
  const projectDocs = []
  const taskDocs = []
  const contactDocs = []

  for (const p of projects) {
    const projectId = String(p.id ?? p.projectId ?? `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`)

    const projectData = {
      projectName:          sanitize(p.projectName ?? p.name, 'Unnamed Project'),
      projectNumber:        sanitize(p.projectNumber ?? p.jobNumber ?? p.so_number, ''),
      profile:              sanitize(p.profile ?? p.projectProfile, 'S'),
      status:               mapStatus(p.status ?? p.projectStatus),
      currentPhase:         sanitize(p.currentPhase ?? p.phase, ''),
      address:              sanitize(p.address ?? p.location, ''),
      city:                 sanitize(p.city, ''),
      state:                sanitize(p.state, ''),
      country:              sanitize(p.country, 'USA'),
      lat:                  p.lat ?? p.latitude ?? null,
      lng:                  p.lng ?? p.longitude ?? null,
      clientName:           sanitize(p.clientName ?? p.client ?? p.tenant, ''),
      businessUnit:         sanitize(p.businessUnit ?? p.bu, ''),
      projectManager:       sanitize(p.projectManager ?? p.pm, ''),
      teamMembers:          Array.isArray(p.teamMembers) ? p.teamMembers : [],
      startDate:            sanitize(p.startDate ?? p.start_date, ''),
      targetCompletionDate: sanitize(p.targetCompletionDate ?? p.endDate ?? p.end_date, ''),
      actualCompletionDate: p.actualCompletionDate ?? null,
      totalBudget:          Number(p.totalBudget ?? p.budget ?? 0),
      committedCost:        Number(p.committedCost ?? p.committed ?? 0),
      forecastCost:         Number(p.forecastCost ?? p.forecast ?? 0),
      actualCost:           Number(p.actualCost ?? p.actual ?? 0),
      contingencyPercent:   Number(p.contingencyPercent ?? p.contingency ?? 10),
      rsf:                  Number(p.rsf ?? p.squareFeet ?? 0) || null,
      isActive:             p.isActive !== false && p.status !== 'Closed',
      hasMER:               Boolean(p.hasMER ?? p.has_mer ?? false),
      _migratedFromV1:      true,
      _v1Id:                String(p.id ?? ''),
      createdAt:            sanitize(p.createdAt ?? p.created_at, now),
      updatedAt:            now,
      createdBy:            sanitize(p.createdBy ?? p.pm, 'migration'),
    }

    projectDocs.push({ id: projectId, data: projectData })

    // ── Tasks per project ──────────────────────────────────────────────────
    const v1Tasks = Array.isArray(p.tasks)
      ? p.tasks
      : Array.isArray(p.checklist)
      ? p.checklist
      : []

    v1Tasks.forEach((t, idx) => {
      const taskId = String(t.id ?? `${projectId}_task_${idx}`)
      taskDocs.push({
        id: taskId,
        data: {
          projectId,
          title:                sanitize(t.title ?? t.name ?? t.task, 'Unnamed Task'),
          description:          sanitize(t.description ?? t.notes, ''),
          status:               mapTaskStatus(t.status ?? t.completed),
          priority:             sanitize(t.priority, 'medium'),
          phase:                sanitize(t.phase ?? t.category, ''),
          category:             sanitize(t.category ?? t.subdivision ?? t.phase, 'General'),
          assignedTo:           sanitize(t.assignedTo ?? t.assigned_to, ''),
          dueDate:              sanitize(t.dueDate ?? t.due_date, ''),
          completedDate:        sanitize(t.completedDate ?? t.completed_date, ''),
          notes:                sanitize(t.notes ?? t.comments, ''),
          order:                Number(t.order ?? t.sort ?? idx),
          isFromMasterChecklist: Boolean(t.isFromMasterChecklist ?? t.master ?? false),
          masterTaskId:         sanitize(t.masterTaskId ?? t.master_task_id, ''),
          _migratedFromV1:      true,
          createdAt:            sanitize(t.createdAt ?? t.created_at, now),
          updatedAt:            now,
        },
      })
    })

    // ── Contacts per project ───────────────────────────────────────────────
    const v1Contacts = Array.isArray(p.contacts) ? p.contacts : []
    v1Contacts.forEach((c, idx) => {
      const contactId = String(c.id ?? `${projectId}_contact_${idx}`)
      contactDocs.push({
        id: contactId,
        data: {
          projectId,
          name:        sanitize(c.name ?? c.fullName, ''),
          company:     sanitize(c.company ?? c.firm ?? c.organization, ''),
          role:        sanitize(c.role ?? c.type, 'other'),
          email:       sanitize(c.email, ''),
          phone:       sanitize(c.phone ?? c.phoneNumber, ''),
          notes:       sanitize(c.notes, ''),
          _migratedFromV1: true,
          createdAt:   sanitize(c.createdAt, now),
        },
      })
    })
  }

  // ── Master tasks (global) ────────────────────────────────────────────────
  const masterTasks = Array.isArray(v1Data?.masterTasks ?? v1Data?.master_tasks)
    ? (v1Data.masterTasks ?? v1Data.master_tasks)
    : []

  const masterTaskDocs = masterTasks.map((t, idx) => ({
    id: String(t.id ?? `master_${idx}`),
    data: {
      title:           sanitize(t.title ?? t.name, ''),
      category:        sanitize(t.category ?? t.subdivision, 'General'),
      phase:           sanitize(t.phase, ''),
      defaultPriority: sanitize(t.priority ?? t.defaultPriority, 'medium'),
      applicableTo:    Array.isArray(t.applicableTo) ? t.applicableTo : ['L', 'S', 'E'],
      order:           Number(t.order ?? idx),
      notes:           sanitize(t.notes, ''),
      _migratedFromV1: true,
    },
  }))

  // ── Write to Firestore ────────────────────────────────────────────────────
  console.log('📝 Writing to Firestore...\n')

  if (projectDocs.length > 0) {
    process.stdout.write('Projects: ')
    await batchWrite('projects', projectDocs)
  }

  if (taskDocs.length > 0) {
    process.stdout.write('\nTasks: ')
    await batchWrite('tasks', taskDocs)
  }

  if (contactDocs.length > 0) {
    process.stdout.write('\nContacts: ')
    await batchWrite('contacts', contactDocs)
  }

  if (masterTaskDocs.length > 0) {
    process.stdout.write('\nMaster Tasks: ')
    await batchWrite('masterTasks', masterTaskDocs)
  }

  console.log('\n✅ Migration complete!')
  console.log(`   Projects:     ${projectDocs.length}`)
  console.log(`   Tasks:        ${taskDocs.length}`)
  console.log(`   Contacts:     ${contactDocs.length}`)
  console.log(`   Master Tasks: ${masterTaskDocs.length}`)
  console.log('\n🌐 Check your Firebase Console to verify the data.')
}

migrate().catch((err) => {
  console.error('\n❌ Migration failed:', err)
  process.exit(1)
})
