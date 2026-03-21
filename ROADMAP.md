# ProjeX v2 Roadmap
> Based on product critique and rebuild recommendations. Items are ordered by impact and dependency.

---

## 🔴 PHASE 1 — Foundation Fixes ✅ COMPLETE
*These unlock everything else. Nothing downstream works without these.*

### 1.1 — Connected Data Model
**Problem:** Modules are isolated. Tasks don't affect schedule. Budget doesn't affect risk. Nothing reacts to anything.
**Goal:** Every module links to every other module.
- [x] Tasks linked to Milestones (completing a task auto-closes milestone when all linked tasks done)
- [x] Milestones linked to Health Score (missed milestone = health penalty)
- [x] Budget drift linked to Risk Engine (overrun triggers a RAID item)
- [x] Change Orders flow into Budget forecast automatically
- [x] RFIs and Submittals linked to Schedule (overdue items affect timeline)

---

### 1.2 — Health Engine (Auto-Calculate, Not Manual)
**Problem:** Health score exists but isn't reacting to real data.
**Goal:** 0–100 score that updates automatically based on live project state.
- [x] Budget performance component (forecast vs approved)
- [x] Schedule performance component (milestone hit rate)
- [x] Risk exposure component (open high/critical RAID items)
- [x] Task completion rate component
- [x] Weighted formula: budget 30% + schedule 30% + risk 20% + tasks 20%
- [x] Health score drives dashboard Red/Yellow/Green status

---

### 1.3 — Risk Engine (Auto-Generated RAID Items)
**Problem:** RAID log is passive and manually filled. It should be the app's nervous system.
**Goal:** App automatically creates risks when warning conditions are detected.
- [x] Trigger: Task overdue → auto-create Risk in RAID
- [x] Trigger: Milestone missed → auto-create Risk in RAID
- [x] Trigger: Budget variance > 10% → auto-create Risk in RAID
- [x] Trigger: RFI open > 14 days → auto-create Issue in RAID
- [x] Auto-risks are labeled "System Generated" and can be dismissed or promoted
- [x] RAID items show linked source (which task/milestone/budget line triggered it)

---

## 🟡 PHASE 2 — Module Upgrades ✅ MOSTLY COMPLETE
*Make each module actually functional as a PM tool.*

### 2.1 — RAID Log Upgrade ✅
- [x] Add Owner field (person responsible)
- [x] Add Impact fields: cost impact ($), schedule impact (days), scope impact
- [x] Add linked items: link to Tasks, Budget lines, RFIs
- [x] Add status workflow: Open → In Progress → Mitigated → Closed
- [x] Add due date + overdue detection
- [x] RAID dashboard widget: shows open risks count by severity on Overview tab
- [x] Export RAID to CSV

---

### 2.2 — Budget Engine Upgrade ✅
- [x] Committed = sum of all contract amounts
- [x] Forecast = committed + estimated remaining (editable per line)
- [x] Cost to Complete field per line item
- [x] Variance trend: show if forecast is trending up or down week over week
- [x] Change Orders automatically add to forecast
- [x] Budget health indicator: Green < 90%, Yellow 90–100%, Red > 100%
- [x] Contingency drawdown tracker: show how much contingency has been consumed
- [x] Vendor tracking: each line item tracks vendor name, contract #, contact
- [x] Budget envelope model — line items draw from approved total

---

### 2.3 — Schedule / Gantt Upgrade
**Problem:** Schedule is a task list pretending to be a schedule.
**Goal:** Visual timeline with dependencies and delay impact.
- [x] Gantt chart view (horizontal bar timeline)
- [x] Task dependencies: link activities (A must finish before B starts)
- [x] Critical path auto-detection (longest dependency chain)
- [x] Baseline vs actual comparison (original dates vs current dates)
- [x] Variance badge: show days ahead / behind per activity
- [x] Forecast completion date: calculated from current progress
- [x] Milestone markers on Gantt
- [x] Mark schedule activities as milestones via diamond (◆) toggle
- [x] 19-activity master template (seeded for all new projects)
- [x] Warranty Period highlighted as amber card
- [ ] Delay impact: if activity slips, flag downstream successor activities automatically

---

### 2.4 — Tasks "Daily Driver" Upgrade
**Problem:** No concept of "what do I need to do today."
**Goal:** Tasks become the daily workflow tool.
- [x] "Assigned to Me" filter (filter by logged-in user's name)
- [x] "Due Today" quick filter
- [x] "Overdue" badge on Tasks tab label (red count badge)
- [x] Task priority sorting (Urgent → High → Medium → Low)
- [x] Tasks linked to Milestones (completing tasks auto-advances milestone)
- [x] In-app notification bell: overdue + due-soon tasks shown in dropdown, links to project
- [x] Sort checklist tasks: incomplete first, complete at bottom
- [ ] Recurring tasks (daily standup, weekly report)
- [ ] Push / email notification when task goes overdue (requires SendGrid or FCM)

---

## 🟠 PHASE 3 — Experience Upgrades ✅ MOSTLY COMPLETE
*Make the app feel alive and intelligent.*

### 3.1 — Dashboard → Action Center ✅
- [x] "Attention Required" panel: auto-populated from risks, overdue items, budget alerts
- [x] Traffic light summary: 🔴 At Risk / 🟡 Watch / 🟢 On Track per project
- [x] "Pending Decisions" section: open RFIs + Change Orders awaiting approval
- [x] "My Tasks Today" widget: tasks assigned to me due today/overdue
- [x] Remove empty/zero cards when no data — replace with contextual prompts
- [x] Portfolio burn rate: total $ committed across all projects
- [x] 30-day milestone panel: upcoming flagged milestones across all projects

---

### 3.2 — Project Overview → War Room ✅
- [x] "Attention Required" section at top: auto-populated alerts
- [x] Active risks count (from RAID) with severity breakdown
- [x] Pending approvals: open RFIs + COs requiring action
- [x] Budget alert banner if forecast > approved budget
- [x] Next milestone countdown: "Schematic Design due in 12 days"
- [x] Recent activity feed: last 5 changes across all modules
- [x] Milestone mini-timeline driven by schedule items flagged as milestones

---

### 3.3 — Executive / Analytics View Upgrade
**Problem:** Analytics shows numbers but not narrative.
**Goal:** One-page view a VP can read in 60 seconds.
- [x] Portfolio health matrix: project name × health score × status (table view)
- [x] Budget utilization across all projects (stacked bar)
- [x] "Off-track projects" summary card
- [x] Export analytics to PDF
- [ ] Forecast vs baseline trend chart per project (schedule S-curve)
- [ ] Risk trajectory: number of open risks over time (line chart)

---

## 🤖 PHASE 4 — AI Upgrades
*Make AI the co-PM, not a side button.*

### 4.1 — AI Risk Detection
- [x] AI scans project data weekly and flags risks not yet in RAID
- [x] AI suggests risk mitigation for existing RAID items
- [ ] AI compares project to similar past projects and flags anomalies

### 4.2 — AI Status Report Generator ✅
- [x] One-click: pulls budget, schedule, risks, tasks → outputs executive summary
- [x] Formats as: "Summary · Accomplishments · Risks · Next Steps"
- [x] Copies to clipboard or exports as PDF
- [x] Tailored for OAC meetings, owner updates, internal reviews

### 4.3 — AI Daily Briefing ✅
- [x] On dashboard load: AI generates a 3-bullet "Today's Focus" summary
- [x] Pulls from: overdue tasks, upcoming milestones, open risks
- [x] Refreshes daily

### 4.4 — Natural Language Project Queries
- [ ] "What's the biggest risk on Las Olas?"
- [ ] "How much contingency is left?"
- [ ] "What's overdue this week?"
- [ ] AI answers from live Firestore data, not just context window

---

## 🏁 PHASE 5 — Killer Feature

### 5.1 — Auto Weekly Report
- [x] Scheduled or on-demand: click "Generate Weekly Report"
- [x] Pulls: budget status, schedule, risks, completed tasks, upcoming milestones
- [x] Outputs formatted report: Executive Summary + Action Items + Talking Points
- [x] Export as PDF or copy as formatted email
- [ ] Distribute via email directly from the app (SendGrid / Resend integration)

---

## 📋 Remaining Work (Open Items)

| Priority | Item | Phase |
|----------|------|-------|
| High | Schedule delay impact: flag downstream activities when predecessor slips | 2.3 |
| Medium | Recurring tasks (daily standup, weekly report) | 2.4 |
| Medium | Forecast vs baseline trend chart per project (schedule S-curve) | 3.3 |
| Medium | Risk trajectory chart: open risks over time | 3.3 |
| Low | Push / email notification when task goes overdue | 2.4 |
| Low | AI: compare project to similar past projects | 4.1 |
| Low | AI natural language queries from live Firestore data | 4.4 |
| Low | Email distribution via SendGrid / Resend | 5.1 |

---

## 📌 Notes
- Each item should be built, tested, and deployed before moving to the next
- Firestore rules must be updated whenever a new collection is added
- All new collections need to be added to the Data Audit in Settings
- Keep TypeScript strict — Vercel build must pass before marking any item done
