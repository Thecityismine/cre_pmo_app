# ProjeX v2 Roadmap
> Based on product critique and rebuild recommendations. Items are ordered by impact and dependency.

---

## 🔴 PHASE 1 — Foundation Fixes (Do First)
*These unlock everything else. Nothing downstream works without these.*

### 1.1 — Connected Data Model
**Problem:** Modules are isolated. Tasks don't affect schedule. Budget doesn't affect risk. Nothing reacts to anything.
**Goal:** Every module links to every other module.
- [ ] Tasks linked to Milestones (completing a task can close a milestone)
- [ ] Milestones linked to Health Score (missed milestone = health penalty)
- [ ] Budget drift linked to Risk Engine (overrun triggers a RAID item)
- [ ] Change Orders flow into Budget forecast automatically
- [ ] RFIs and Submittals linked to Schedule (overdue items affect timeline)

---

### 1.2 — Health Engine (Auto-Calculate, Not Manual)
**Problem:** Health score exists but isn't reacting to real data.
**Goal:** 0–100 score that updates automatically based on live project state.
- [ ] Budget performance component (forecast vs approved)
- [ ] Schedule performance component (milestone hit rate)
- [ ] Risk exposure component (open high/critical RAID items)
- [ ] Task completion rate component
- [ ] Weighted formula: budget 30% + schedule 30% + risk 20% + tasks 20%
- [ ] Health score drives dashboard Red/Yellow/Green status

---

### 1.3 — Risk Engine (Auto-Generated RAID Items)
**Problem:** RAID log is passive and manually filled. It should be the app's nervous system.
**Goal:** App automatically creates risks when warning conditions are detected.
- [ ] Trigger: Task overdue → auto-create Risk in RAID
- [ ] Trigger: Milestone missed → auto-create Risk in RAID
- [ ] Trigger: Budget variance > 10% → auto-create Risk in RAID
- [ ] Trigger: RFI open > 14 days → auto-create Issue in RAID
- [ ] Auto-risks are labeled "System Generated" and can be dismissed or promoted
- [ ] RAID items show linked source (which task/milestone/budget line triggered it)

---

## 🟡 PHASE 2 — Module Upgrades
*Make each module actually functional as a PM tool.*

### 2.1 — RAID Log Upgrade
**Problem:** RAID is a table with no teeth.
**Goal:** RAID becomes the project's central risk register with real PM workflow.
- [x] Add Owner field (person responsible)
- [x] Add Impact fields: cost impact ($), schedule impact (days), scope impact
- [ ] Add linked items: link to Tasks, Budget lines, RFIs
- [x] Add status workflow: Open → In Progress → Mitigated → Closed
- [x] Add due date + overdue detection
- [x] RAID dashboard widget: shows open risks count by severity on Overview tab
- [x] Export RAID to CSV

---

### 2.2 — Budget Engine Upgrade
**Problem:** Budget is a static ledger, not a financial engine.
**Goal:** Real PM financial math with live forecast and variance tracking.
- [ ] Committed = sum of all contract amounts
- [ ] Forecast = committed + estimated remaining (editable per line)
- [ ] Cost to Complete field per line item
- [ ] Variance trend: show if forecast is trending up or down week over week
- [ ] Change Orders automatically add to forecast (already partially done)
- [ ] Budget health indicator: Green < 90%, Yellow 90–100%, Red > 100%
- [ ] Contingency drawdown tracker: show how much contingency has been consumed
- [ ] Vendor tracking: each line item tracks vendor name, contract #, contact

---

### 2.3 — Schedule / Gantt Upgrade
**Problem:** Schedule is a task list pretending to be a schedule.
**Goal:** Visual timeline with dependencies and delay impact.
- [ ] Gantt chart view (horizontal bar timeline)
- [ ] Task dependencies: link activities (A must finish before B starts)
- [ ] Critical path auto-detection (longest dependency chain)
- [ ] Baseline vs actual comparison (original dates vs current dates)
- [ ] Delay impact: if activity slips, show downstream impact
- [ ] Forecast completion date: calculated from current progress
- [ ] Milestone markers on Gantt

---

### 2.4 — Tasks "Daily Driver" Upgrade
**Problem:** No concept of "what do I need to do today."
**Goal:** Tasks become the daily workflow tool.
- [ ] "Assigned to Me" filter (filter by logged-in user's name)
- [ ] "Due Today" quick filter
- [ ] "Overdue" badge on Tasks tab label
- [ ] Task priority sorting (Urgent → High → Medium → Low)
- [ ] Recurring tasks (daily standup, weekly report)
- [ ] Tasks linked to Milestones (completing tasks advances milestone %)
- [ ] Push notification / in-app alert when task goes overdue

---

## 🟠 PHASE 3 — Experience Upgrades
*Make the app feel alive and intelligent.*

### 3.1 — Dashboard → Action Center
**Problem:** Dashboard shows data but doesn't tell you what to do.
**Goal:** First thing every morning you open the app and know exactly what needs attention.
- [ ] "Attention Required" panel: auto-populated from risks, overdue items, budget alerts
- [ ] Traffic light summary: 🔴 At Risk / 🟡 Watch / 🟢 On Track per project
- [ ] "Pending Decisions" section: open RFIs + Change Orders awaiting approval
- [ ] "My Tasks Today" widget: tasks assigned to me due today/overdue
- [ ] Remove empty/zero cards when no data — replace with contextual prompts
- [ ] Portfolio burn rate: total $ committed across all projects this month

---

### 3.2 — Project Overview → War Room
**Problem:** Overview shows static fields. It should show live project pulse.
**Goal:** Open a project and immediately see what needs attention.
- [ ] "Attention Required" section at top: auto-populated alerts
- [ ] Active risks count (from RAID) with severity breakdown
- [ ] Pending approvals: open RFIs + COs requiring action
- [ ] Budget alert banner if forecast > approved budget
- [ ] Next milestone countdown: "Schematic Design due in 12 days"
- [ ] Recent activity feed: last 5 changes across all modules

---

### 3.3 — Executive / Analytics View Upgrade
**Problem:** Analytics shows numbers but not narrative.
**Goal:** One-page view a VP can read in 60 seconds.
- [ ] Portfolio health matrix: project name × health score × status (table view)
- [ ] Forecast vs baseline trend chart per project
- [ ] Budget utilization across all projects (stacked bar)
- [ ] Risk trajectory: number of open risks over time
- [ ] "Off-track projects" summary card
- [ ] Export analytics to PDF

---

## 🤖 PHASE 4 — AI Upgrades
*Make AI the co-PM, not a side button.*

### 4.1 — AI Risk Detection
- [ ] AI scans project data weekly and flags risks not yet in RAID
- [ ] AI suggests risk mitigation for existing RAID items
- [ ] AI compares project to similar past projects and flags anomalies

### 4.2 — AI Status Report Generator
- [ ] One-click: pulls budget, schedule, risks, tasks → outputs executive summary
- [ ] Formats as: "This week · Accomplishments · Risks · Next Steps"
- [ ] Copies to clipboard or exports as PDF
- [ ] Tailored for OAC meetings, owner updates, internal reviews

### 4.3 — AI Daily Briefing
- [ ] On dashboard load: AI generates a 3-bullet "Today's Focus" summary
- [ ] Pulls from: overdue tasks, upcoming milestones, open risks
- [ ] Refreshes daily

### 4.4 — Natural Language Project Queries
- [ ] "What's the biggest risk on Las Olas?"
- [ ] "How much contingency is left?"
- [ ] "What's overdue this week?"
- [ ] AI answers from live Firestore data, not just context

---

## 🏁 PHASE 5 — Killer Feature
*The one thing that makes people use this daily.*

### 5.1 — Auto Weekly Report
- [ ] Scheduled or on-demand: click "Generate Weekly Report"
- [ ] Pulls: budget status, schedule, risks, completed tasks, upcoming milestones
- [ ] Outputs formatted report: Executive Summary + Action Items + Talking Points
- [ ] Export as PDF or copy as formatted email
- [ ] Distribute via email directly from the app (SendGrid / Resend integration)

---

## 📋 Implementation Order (Suggested Sprint Plan)

| Sprint | Items | Why |
|--------|-------|-----|
| 1 | 1.2 Health Engine + 1.3 Risk Engine | Makes the app reactive |
| 2 | 2.1 RAID Upgrade + 1.1 Data Connections | Connects the modules |
| 3 | 2.2 Budget Engine + 3.2 War Room | Financial intelligence |
| 4 | 2.4 Tasks Daily Driver + 3.1 Action Center Dashboard | Drives daily usage |
| 5 | 2.3 Schedule Gantt | Visual scheduling |
| 6 | 4.1–4.3 AI Upgrades | Intelligence layer |
| 7 | 3.3 Executive View + 5.1 Weekly Report | Leadership buy-in |

---

## 📌 Notes
- Each item should be built, tested, and deployed before moving to the next
- Firestore rules must be updated whenever a new collection is added
- All new collections need to be added to the Data Audit in Settings
- Keep TypeScript strict — Vercel build must pass before marking any item done
