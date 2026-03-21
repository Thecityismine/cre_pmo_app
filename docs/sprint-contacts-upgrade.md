# Sprint: Contacts Page Upgrade
**Goal:** Transform the Contacts page from a directory into a working PMO accountability tool.

---

## Current State (as of sprint start)

**File:** `src/pages/TeamPage.tsx`
**Hook:** `src/hooks/useContacts.ts`

### What exists:
- `Contact` schema: `id, name, company, role, email, phone, trades[], notes, projectId, createdAt`
- 9 hardcoded roles with color tags (`project-manager`, `architect`, `general-contractor`, etc.)
- Card grid: avatar, name, company, role badge, email/phone links, notes
- `AddContactModal` — already a proper modal overlay ✅
- Inline edit form within each card
- Search by name/company/email
- Role filter pills

### What's missing:
- `responsibility` field (e.g. "Owns budget", "Leads design")
- Expanded role list (LL Rep, AOR, Structural, Civil, Security, Owner's Rep, etc.)
- Task accountability layer (open tasks, overdue, last active)
- Team Summary Bar
- Grouping (by role or company)
- Filters by company, responsibility, overdue-only
- Copy-to-clipboard on email/phone
- Per-contact quick actions (Assign Task)

---

## Sprint 1 — Data Model & Role Expansion
**Effort:** Small | **Impact:** Foundation for everything else

### 1A. Expand roles list in `TeamPage.tsx`

Add to `ROLE_LABELS` / `ROLE_COLORS`:
```
'owners-rep'         → "Owner's Rep"         (emerald)
'aor'                → "Architect of Record"  (cyan)
'll-rep'             → "LL Rep"               (violet)
'structural'         → "Structural Engineer"  (teal)
'civil'              → "Civil Engineer"       (teal)
'security'           → "Security Vendor"      (rose)
'av-vendor'          → "AV Vendor"            (indigo)
'ff-and-e'           → "FF&E Vendor"          (amber)
'legal'              → "Legal"                (slate)
'accounting'         → "Accounting"           (slate)
```

### 1B. Add `responsibility` field to `Contact` interface

In `src/hooks/useContacts.ts`:
```typescript
export interface Contact {
  // ... existing fields ...
  responsibility?: string   // free-text: "Owns budget", "Leads design", "GC coordination"
  updatedAt?: string
}
```

### 1C. Add `responsibility` to Add form & Edit form

In `AddContactModal` — add a text input below Role:
- Label: "Responsibility"
- Placeholder: "e.g. Owns budget, Leads design, GC coordination"

In the inline edit form inside `ContactCard` — same field.

### 1D. Save `updatedAt` consistently

`addDoc` already saves `updatedAt`. Confirm `updateDoc` also writes it (it does — line 43).
No change needed here.

---

## Sprint 2 — Accountability Layer (Highest Impact)
**Effort:** Medium | **Impact:** This makes the page a daily-use tool

### 2A. Hook up task data

In `TeamPage.tsx`, pull cross-project task data:

```typescript
import { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'

// Fetch all projectTasks across all projects once
const [allTasks, setAllTasks] = useState<{ assignedTo: string; status: string; dueDate: string; updatedAt: string }[]>([])

useEffect(() => {
  getDocs(collection(db, 'projectTasks')).then(snap => {
    setAllTasks(snap.docs.map(d => d.data() as ...))
  })
}, [])
```

### 2B. Compute per-contact accountability stats

Build a helper `getContactStats(name, allTasks)`:
```typescript
function getContactStats(name: string, tasks: Task[]) {
  const today = new Date(); today.setHours(0,0,0,0)
  const mine = tasks.filter(t =>
    t.assignedTo?.trim().toLowerCase() === name.trim().toLowerCase()
  )
  const open    = mine.filter(t => t.status === 'open')
  const overdue = open.filter(t => t.dueDate && new Date(t.dueDate) < today)
  const lastUpdated = mine.length > 0
    ? mine.map(t => t.updatedAt).sort().reverse()[0]
    : null
  return { open: open.length, overdue: overdue.length, lastUpdated }
}
```

### 2C. Display on ContactCard

Below the role badge, add an accountability row:

```
12 tasks · 3 overdue ⚠️
Last active: Mar 14
```

- Show only if `open > 0` or `lastUpdated` exists
- `overdue > 0` → show count in `text-red-400`
- `lastUpdated` → format as "X days ago" or "Mar 14"
- No tasks → show nothing (keep card clean)

Pass `stats` as a prop to `ContactCard`:
```typescript
<ContactCard key={c.id} contact={c} onDelete={handleDelete} stats={getContactStats(c.name, allTasks)} />
```

### 2D. Team Summary Bar

Add a summary strip between the search bar and the card grid:

```
11 contacts  ·  8 active contributors  ·  3 overdue owners ⚠️  ·  6 internal / 5 external
```

- "active contributor" = has at least 1 open task
- "overdue owner" = has at least 1 overdue task (show in amber/red)
- "internal" = role is one of: pm, project-executive, facilities, accounting
- "external" = everyone else

Render as a single flex row of stat chips (similar to KPI cards elsewhere in the app).

---

## Sprint 3 — Card Visual Upgrade & Quick Actions
**Effort:** Small–Medium | **Impact:** Daily UX polish

### 3A. Role icon per card

Add a small icon to each role tag using lucide-react:
```
project-manager    → HardHat
architect          → Compass  (or Pencil)
general-contractor → HardHat
mep-engineer       → Zap
client-rep         → Building2
ll-rep             → KeyRound
owners-rep         → Shield
legal              → Scale
other              → User
```

Show as a tiny icon (10–11px) inside or next to the role badge.

### 3B. Responsibility line on card

Below the role badge, show responsibility in muted text:
```
<p className="text-[11px] text-slate-400 mt-1 italic">{contact.responsibility}</p>
```

### 3C. Copy-to-clipboard buttons on email/phone

Replace plain `<a href>` with a row that has both the link AND a copy icon:

```tsx
<div className="flex items-center gap-1">
  <a href={`mailto:${email}`}>...</a>
  <button onClick={() => navigator.clipboard.writeText(email)} title="Copy">
    <Copy size={10} />
  </button>
</div>
```

### 3D. Quick action: Assign Task

Add a small "Assign task" button that opens a dropdown/modal pre-filled with the contact's name. This button appears on hover (group-hover pattern already used in the card).

For MVP: clicking it navigates to the project's Tasks tab with the `assignedTo` field pre-filled.

```tsx
<button
  onClick={() => {/* set global assign-to context, navigate to tasks */}}
  className="p-1.5 text-slate-400 hover:text-blue-400 opacity-0 group-hover:opacity-100"
  title="Assign task"
>
  <ClipboardList size={13} />
</button>
```

---

## Sprint 4 — Grouping & Filtering
**Effort:** Small | **Impact:** High for large teams (30+ people)

### 4A. Group by toggle

Add a "Group by" pill above the grid:
```
[ None ]  [ Role ]  [ Company ]
```

- **Group by Role**: render a section header (`<h3>Project Managers (2)</h3>`) before each role group
- **Group by Company**: same, group by `contact.company`

### 4B. Extended filters

Add to the filter bar:
- **Company** dropdown — populated from distinct `contact.company` values
- **Overdue only** toggle — shows only contacts with `overdue > 0`
- **Has tasks** toggle — shows only contacts with `open > 0`

Keep existing Role pills. Company dropdown replaces the current `roleOptions` side-by-side layout — move both into a single filter row.

### 4C. Filter by Responsibility

Add a free-text "Responsibility" search field (or a dropdown if a fixed list is chosen in Sprint 1).

---

## Sprint 5 — Project Context per Person (Stretch)
**Effort:** Medium | **Impact:** Long-term value, less urgent

### 5A. Project assignments

Add `projectIds: string[]` to the `Contact` schema.

In the add/edit form: show a multi-select of active projects (fetched from `useProjects`).

On the card: show small project name chips — "Tenant Reno · HQ Build-Out"

### 5B. Phase involvement tags

Add `phases?: string[]` to Contact: `'design' | 'permitting' | 'construction' | 'closeout'`

Show as small phase pills on the card, similar to the role tag style.

---

## Implementation Order

| # | Sprint | Files changed | Estimated sessions |
|---|--------|---------------|-------------------|
| 1 | Data model + roles | `useContacts.ts`, `TeamPage.tsx` | 1 |
| 2 | Accountability layer | `TeamPage.tsx` | 1–2 |
| 3 | Card visual + quick actions | `TeamPage.tsx` | 1 |
| 4 | Grouping + filters | `TeamPage.tsx` | 1 |
| 5 | Project context | `useContacts.ts`, `TeamPage.tsx` | 1–2 |

---

## Key Design Decisions

- **Task matching by name** (not ID): Contacts and tasks are linked via `assignedTo` (free-text name). This is fuzzy — use `.trim().toLowerCase()` comparison. No schema migration needed.
- **Cross-project tasks**: Pull from the top-level `projectTasks` collection (no `projectId` filter), so accountability is global not per-project.
- **`allTasks` fetch**: Use a one-time `getDocs` on page load (not a real-time listener) — contacts page doesn't need live task updates. Keeps reads low.
- **Responsibility field**: Free-text string, not a dropdown. Keeps flexibility for real-world use ("GC coordination + budget review").
- **No breaking changes**: All new fields are optional (`?:`). Existing contacts display fine without them.
