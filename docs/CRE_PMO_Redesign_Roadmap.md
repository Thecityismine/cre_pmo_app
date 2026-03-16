# CRE PMO Platform — Complete Redesign Roadmap
**Version:** 2.0 Planning Document
**Date:** March 2026
**Author:** Jorge Medina, JLL
**Status:** Active Planning

---

## TABLE OF CONTENTS

1. [Vision & Goals](#1-vision--goals)
2. [Current State Assessment](#2-current-state-assessment)
3. [Target Architecture](#3-target-architecture)
4. [Database Schema](#4-database-schema)
5. [Phase 1 — Foundation Rebuild (Weeks 1–6)](#5-phase-1--foundation-rebuild-weeks-16)
6. [Phase 2 — AI Core (Weeks 7–12)](#6-phase-2--ai-core-weeks-712)
7. [Phase 3 — Advanced Modules (Weeks 13–20)](#7-phase-3--advanced-modules-weeks-1320)
8. [Phase 4 — Scale & Mobile (Weeks 21–30)](#8-phase-4--scale--mobile-weeks-2130)
9. [UI/UX Design System](#9-uiux-design-system)
10. [AI Integration Specifications](#10-ai-integration-specifications)
11. [Tech Stack — Final Decisions](#11-tech-stack--final-decisions)
12. [Testing Strategy](#12-testing-strategy)
13. [Deployment & DevOps](#13-deployment--devops)
14. [Feature Flag & Release Plan](#14-feature-flag--release-plan)
15. [KPIs for the New Platform](#15-kpis-for-the-new-platform)

---

## 1. VISION & GOALS

### North Star
> Build the PMO copilot that a senior CRE project manager trusts to run their entire portfolio — surfacing risks before they happen, drafting communications, extracting data from documents, and letting the PM spend time making decisions instead of updating spreadsheets.

### Core Goals for V2
| Goal | Success Metric |
|------|---------------|
| Eliminate manual data entry | 80% of data enters via upload/integration/AI extraction |
| Proactive risk management | AI flags risk 2+ weeks before it becomes a problem |
| Executive-ready reporting | One-click PDF report in under 10 seconds |
| Mobile field access | Full task/photo/punch list workflow on phone |
| Multi-client scalability | Support 20+ concurrent projects across 3+ clients |
| Document intelligence | Any PDF/drawing processed and linked automatically |

---

## 2. CURRENT STATE ASSESSMENT

### What Works — Keep and Enhance
- ✅ 194-task master checklist with team/subdivision tagging
- ✅ Financial tracking (Baseline → Target → Change Orders → Net)
- ✅ PMO health scoring concept
- ✅ Lease expiration alerts
- ✅ Bid schedule with overdue tracking
- ✅ Team directory
- ✅ Geographic portfolio map
- ✅ Per-project tabs with full lifecycle coverage

### Critical Bugs to Fix First
| Bug | Impact | Fix |
|-----|--------|-----|
| SPI shows 0 for Las Olas | Misleading health score | Implement proper EVM calculation |
| Change Orders not linked to Budget categories | Manual reconciliation required | Auto-rollup CO → budget line |
| No cascade when milestone shifts | Gantt is cosmetic only | Add dependency engine |
| Backup is single-point export | Risk of data loss | Move to Supabase with automatic backups |

### Modules to Completely Rebuild
- Gantt Chart → Full CPM engine
- Budget → Vendor-level line items
- Documents → Structured hub with AI extraction
- RFIs → Full workflow (not just a counter)
- Submittals → Full workflow
- Analytics → Predictive AI-powered scorecard

---

## 3. TARGET ARCHITECTURE

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                         │
│  React Web App (Desktop)   |   React Native (Mobile)    │
│  shadcn/ui + Tailwind      |   Expo + NativeWind        │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS / WebSocket
┌────────────────────▼────────────────────────────────────┐
│                    API GATEWAY                           │
│              Node.js / Express + tRPC                    │
│         (Type-safe end-to-end API contracts)             │
└───┬──────────────┬──────────────┬──────────────┬────────┘
    │              │              │              │
┌───▼──┐    ┌─────▼────┐   ┌────▼────┐   ┌─────▼─────┐
│Auth  │    │Business  │   │AI       │   │Real-time  │
│Supa- │    │Logic     │   │Service  │   │WebSocket  │
│base  │    │Layer     │   │(Claude) │   │(Supabase) │
└───┬──┘    └─────┬────┘   └────┬────┘   └─────┬─────┘
    │              │              │              │
┌───▼──────────────▼──────────────▼──────────────▼──────┐
│                    DATA LAYER                           │
│  PostgreSQL (Supabase)  |  pgvector  |  Storage (S3)  │
│  Row Level Security     |  RAG Index |  Files/Docs     │
└────────────────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│               EXTERNAL INTEGRATIONS                      │
│  Claude API  |  Outlook  |  QuickBooks  |  DocuSign    │
└────────────────────────────────────────────────────────┘
```

### Key Architecture Decisions

**1. Supabase as the backend platform**
- Postgres database with Row Level Security (multi-tenant safety)
- Built-in auth (email, SSO, magic link)
- Real-time subscriptions (live dashboard updates)
- Storage for documents and floor plans
- Edge Functions for serverless logic
- pgvector extension for AI document search

**2. tRPC for the API layer**
- Full TypeScript type safety from database → API → UI
- No need to write/maintain separate API schemas
- Eliminates entire class of type mismatch bugs

**3. Claude API (claude-sonnet-4-6) for all AI features**
- Best reasoning model for complex PM documents
- Tool use / function calling for structured data extraction
- 200K context window — can process entire project history

**4. React + shadcn/ui for the web app**
- shadcn gives you copy-paste components you own (not a black box)
- Tailwind for utility-first styling
- Recharts for analytics and budget charts
- DHTMLX Gantt Professional for CPM Gantt (~$149/developer one-time license)

**5. Expo (React Native) for mobile**
- Share business logic and types with the web app
- Expo Go for fast iteration
- EAS Build for production iOS/Android

---

## 4. DATABASE SCHEMA

### Core Tables

```sql
-- ORGANIZATIONS (multi-tenant)
organizations
  id uuid PRIMARY KEY
  name text
  slug text UNIQUE
  settings jsonb
  created_at timestamptz

-- USERS
users (extends Supabase auth.users)
  id uuid PRIMARY KEY
  org_id uuid REFERENCES organizations
  full_name text
  role text  -- 'admin' | 'pm' | 'viewer' | 'stakeholder'
  avatar_url text

-- PROJECTS
projects
  id uuid PRIMARY KEY
  org_id uuid REFERENCES organizations
  name text
  address text
  city text
  state text
  lat decimal
  lng decimal
  type text  -- 'standard' | 'relocation' | 'renovation'
  sqft integer
  status text  -- 'active' | 'on_hold' | 'completed' | 'archived'
  lease_expiration date
  approved_budget numeric
  baseline_budget numeric
  target_budget numeric
  health_score integer  -- 0-100, AI-calculated daily
  ai_risk_flags jsonb   -- AI-generated risk summary
  created_at timestamptz
  updated_at timestamptz

-- MILESTONES
milestones
  id uuid PRIMARY KEY
  project_id uuid REFERENCES projects
  name text
  type text  -- 'funding_approval' | 'design_start' | 'construction_start' | etc.
  target_date date
  approved_date date
  actual_date date
  baseline_date date
  sort_order integer

-- TASKS (master template + per-project instances)
tasks
  id uuid PRIMARY KEY
  project_id uuid REFERENCES projects  -- null = template
  template_id uuid REFERENCES tasks    -- points to master template task
  name text
  description text
  team text   -- 'Architect' | 'Owner' | 'GTI' | 'Contractor' | etc.
  subdivision text  -- 'Design' | 'Permitting' | 'Construction' | etc.
  status text  -- 'pending' | 'active' | 'completed' | 'blocked'
  assigned_to uuid REFERENCES users
  due_date date
  completed_at timestamptz
  predecessor_id uuid REFERENCES tasks  -- dependency engine
  lag_days integer DEFAULT 0
  sort_order integer
  ai_notes text  -- AI-generated context or risk note
  created_at timestamptz

-- TASK CHECKLIST ITEMS
task_checklist_items
  id uuid PRIMARY KEY
  task_id uuid REFERENCES tasks
  content text
  is_complete boolean DEFAULT false
  completed_by uuid REFERENCES users
  completed_at timestamptz

-- BUDGET CATEGORIES
budget_categories
  id uuid PRIMARY KEY
  project_id uuid REFERENCES projects
  name text  -- 'Hard Cost' | 'Soft Cost' | 'FF&E' | etc.
  baseline_amount numeric
  target_amount numeric
  sort_order integer

-- BUDGET LINE ITEMS (vendor-level)
budget_line_items
  id uuid PRIMARY KEY
  category_id uuid REFERENCES budget_categories
  project_id uuid REFERENCES projects
  vendor_name text
  description text
  contract_amount numeric
  invoiced_amount numeric
  paid_amount numeric
  status text  -- 'pending' | 'approved' | 'invoiced' | 'paid'
  notes text
  created_at timestamptz

-- CHANGE ORDERS
change_orders
  id uuid PRIMARY KEY
  project_id uuid REFERENCES projects
  budget_line_item_id uuid REFERENCES budget_line_items  -- links to budget
  number integer  -- CO#1, CO#2...
  requested_by text
  description text
  amount numeric
  status text  -- 'pending' | 'approved' | 'rejected'
  approved_by uuid REFERENCES users
  approved_at timestamptz
  notes text
  created_at timestamptz

-- COST SAVINGS
cost_savings
  id uuid PRIMARY KEY
  project_id uuid REFERENCES projects
  budget_line_item_id uuid REFERENCES budget_line_items
  description text
  amount numeric
  notes text
  created_at timestamptz

-- DOCUMENTS (unified document hub)
documents
  id uuid PRIMARY KEY
  project_id uuid REFERENCES projects
  type text  -- 'contract' | 'rfi' | 'submittal' | 'permit' | 'drawing' | 'photo' | 'invoice' | 'meeting_note' | 'change_order' | 'floor_plan'
  title text
  file_path text  -- Supabase Storage path
  file_size integer
  mime_type text
  version integer DEFAULT 1
  status text  -- 'draft' | 'in_review' | 'approved' | 'rejected' | 'superseded'
  ai_extracted_data jsonb  -- AI-parsed fields from the document
  ai_summary text          -- AI-generated one-paragraph summary
  embedding vector(1536)   -- pgvector for semantic search
  uploaded_by uuid REFERENCES users
  created_at timestamptz

-- RFIs
rfis
  id uuid PRIMARY KEY
  project_id uuid REFERENCES projects
  number integer
  subject text
  question text
  submitted_by text
  assigned_to uuid REFERENCES users
  status text  -- 'open' | 'answered' | 'closed'
  priority text  -- 'low' | 'medium' | 'high' | 'critical'
  due_date date
  answered_at timestamptz
  answer text
  cost_impact numeric DEFAULT 0
  schedule_impact_days integer DEFAULT 0
  document_id uuid REFERENCES documents
  created_at timestamptz

-- SUBMITTALS
submittals
  id uuid PRIMARY KEY
  project_id uuid REFERENCES projects
  number text  -- '03-001', '15-002', etc.
  title text
  spec_section text
  type text  -- 'shop_drawing' | 'product_data' | 'sample'
  submitted_by text
  status text  -- 'pending' | 'submitted' | 'approved' | 'approved_as_noted' | 'revise_and_resubmit' | 'rejected'
  submitted_date date
  required_by date
  reviewed_by uuid REFERENCES users
  reviewed_at timestamptz
  review_notes text
  document_id uuid REFERENCES documents
  created_at timestamptz

-- SCHEDULE ITEMS
schedule_items
  id uuid PRIMARY KEY
  project_id uuid REFERENCES projects
  name text
  start_date date
  end_date date
  baseline_start date
  baseline_end date
  predecessor_id uuid REFERENCES schedule_items
  lag_days integer DEFAULT 0
  percent_complete integer DEFAULT 0
  is_critical_path boolean DEFAULT false  -- calculated
  sort_order integer

-- BID SCHEDULE
bid_schedule_items
  id uuid PRIMARY KEY
  project_id uuid REFERENCES projects
  phase text  -- 'Bid Publish Date' | 'Pre-Bid Walk' | etc.
  scheduled_date date
  actual_date date
  offset_days integer  -- relative to Pre-Bid Walk
  sort_order integer

-- TEAM / CONTACTS
project_team
  id uuid PRIMARY KEY
  project_id uuid REFERENCES projects
  user_id uuid REFERENCES users  -- null if external contact
  name text
  role text
  company text
  email text
  phone text
  trade text
  performance_score integer  -- 0-100
  notes text

-- FLOOR PLANS
floor_plans
  id uuid PRIMARY KEY
  project_id uuid REFERENCES projects
  title text
  document_id uuid REFERENCES documents
  annotations jsonb  -- pinned RFI/issue markers
  sort_order integer
  created_at timestamptz

-- MEETING NOTES
meeting_notes
  id uuid PRIMARY KEY
  project_id uuid REFERENCES projects
  title text
  meeting_date date
  attendees text[]
  transcript text  -- raw audio transcript (AI-generated)
  action_items jsonb  -- AI-extracted: [{item, owner, due_date}]
  decisions jsonb    -- AI-extracted decisions
  risks jsonb        -- AI-extracted risks
  raw_notes text
  document_id uuid REFERENCES documents
  created_at timestamptz

-- PERMIT COMMENTS
permit_comments
  id uuid PRIMARY KEY
  project_id uuid REFERENCES projects
  comment_number text
  description text
  status text  -- 'open' | 'responded' | 'closed'
  assigned_to uuid REFERENCES users
  due_date date
  response text
  document_id uuid REFERENCES documents
  created_at timestamptz

-- ACTIVITY FEED
activity_log
  id uuid PRIMARY KEY
  project_id uuid REFERENCES projects
  org_id uuid REFERENCES organizations
  user_id uuid REFERENCES users
  type text  -- 'task_completed' | 'co_added' | 'document_uploaded' | 'ai_flag' | etc.
  entity_type text
  entity_id uuid
  description text
  metadata jsonb
  created_at timestamptz

-- AI INSIGHTS
ai_insights
  id uuid PRIMARY KEY
  project_id uuid REFERENCES projects
  org_id uuid REFERENCES organizations
  type text  -- 'risk' | 'opportunity' | 'anomaly' | 'recommendation'
  severity text  -- 'info' | 'warning' | 'critical'
  title text
  body text
  dismissed_at timestamptz
  dismissed_by uuid REFERENCES users
  created_at timestamptz
  expires_at timestamptz

-- LESSONS LEARNED
lessons_learned
  id uuid PRIMARY KEY
  project_id uuid REFERENCES projects
  category text  -- 'Schedule' | 'Budget' | 'Design' | 'Vendor' | 'Process'
  what_happened text
  root_cause text
  recommendation text
  ai_generated boolean DEFAULT false
  created_at timestamptz
```

---

## 5. PHASE 1 — FOUNDATION REBUILD (WEEKS 1–6)

**Goal:** Solid, bug-free core with proper data model before adding AI.
**Team:** 1-2 developers

### Week 1 — Project Setup & Infrastructure

#### 1.1 Initialize New Project
- [ ] Create new GitHub repo: `cre-pmo-v2`
- [ ] Initialize React app with Vite + TypeScript
- [ ] Configure Tailwind CSS v4
- [ ] Install and configure shadcn/ui
- [ ] Set up ESLint + Prettier + Husky pre-commit hooks
- [ ] Configure absolute imports (`@/components`, `@/lib`, etc.)

#### 1.2 Supabase Setup
- [ ] Create Supabase project (production + staging environments)
- [ ] Run database migrations for all tables above
- [ ] Enable pgvector extension: `CREATE EXTENSION vector;`
- [ ] Configure Row Level Security policies for multi-tenancy
- [ ] Set up Supabase Storage buckets: `documents`, `floor-plans`, `avatars`
- [ ] Configure Supabase Auth: email + magic link
- [ ] Enable Supabase Realtime on: `activity_log`, `tasks`, `ai_insights`

#### 1.3 tRPC API Setup
- [ ] Install tRPC + Zod
- [ ] Create routers: `projects`, `tasks`, `budget`, `documents`, `team`
- [ ] Set up authentication middleware (verify Supabase JWT)
- [ ] Create base CRUD procedures for all entities

#### 1.4 State Management
- [ ] Install TanStack Query v5 (data fetching + caching)
- [ ] Install Zustand (UI state: sidebar, modals, filters)
- [ ] Create project store: `useProjectStore`
- [ ] Create auth store: `useAuthStore`

---

### Week 2 — Authentication & Multi-Tenancy

#### 2.1 Auth Flow
- [ ] Login page (email + password, magic link option)
- [ ] Invite flow (PM invites stakeholder via email)
- [ ] Role-based access: Admin | PM | Viewer | Stakeholder
- [ ] First-time onboarding wizard (org name, first project)
- [ ] Session management + auto-refresh

#### 2.2 Multi-Tenant Setup
- [ ] Org context provider (wraps entire app)
- [ ] RLS policies enforce `org_id` on every query
- [ ] User can belong to multiple orgs (for consulting PMs)
- [ ] Org switcher in sidebar

#### 2.3 User Profile
- [ ] Profile page: name, avatar, notification preferences
- [ ] Change password flow
- [ ] Activity history

---

### Week 3 — Dashboard & Projects List

#### 3.1 Dashboard Rebuild
- [ ] **KPI Cards (top row):** Budget Health, Active Projects, Total Budget, Avg Completion
  - Pull from Supabase with TanStack Query
  - Real-time update via Supabase subscription
- [ ] **Portfolio Map** (Mapbox GL JS)
  - Cluster markers for multiple projects in same area
  - Click marker → project summary popover
  - Color-coded: green (healthy), amber (at risk), red (critical)
- [ ] **Project Health Cards**
  - Health score (0-100), calculated server-side nightly
  - Status badge with drill-down to reason
  - Budget burn bar (actual vs. approved)
  - Task completion donut
  - Lease countdown (red < 30 days)
- [ ] **AI Insights Panel** (new)
  - Shows top 3 AI-generated risk flags across portfolio
  - Each dismissible, with "view details" link
- [ ] **Next 30-Day Milestones**
- [ ] **Budget Summary** — horizontal bars per project
- [ ] **Recent Activity Feed** — real-time, filterable

#### 3.2 Projects List
- [ ] Card view + List/table view toggle
- [ ] Sort by: health score, budget, completion, lease date
- [ ] Filter by: status, type, city
- [ ] Search by name/address
- [ ] Create New Project modal (trigger AI template generation)
- [ ] Archive / restore
- [ ] Bulk status update

---

### Week 4 — Project Detail: Core Tabs

#### 4.1 Project Header (persistent across all tabs)
- [ ] Breadcrumb navigation
- [ ] Health score badge with tooltip breakdown
- [ ] Quick stats: Tasks %, Budget used %, Lease countdown
- [ ] Export Project Summary → PDF button
- [ ] Tab navigation bar (sticky on scroll)

#### 4.2 Summary Tab
- [ ] Project Info card (editable inline)
- [ ] Financial Summary (6 metric tiles — match current design)
- [ ] Key Milestones with visual timeline bar
- [ ] Progress overview
- [ ] Project Activity (real-time feed)
- [ ] AI Risk Summary card (top 3 flags for this project)
- [ ] Documents Quick Access (recently uploaded)

#### 4.3 Active Tasks Tab
- [ ] Virtual scrolling list (handles 500+ tasks without lag)
- [ ] Filter: team, subdivision, status, assignee, due date
- [ ] Sort: due date, priority, team
- [ ] Inline task completion (checkbox → immediate DB update)
- [ ] Expand task → see sub-checklist, notes, attachments
- [ ] Assign task to team member
- [ ] Set due date on any task
- [ ] Block/unblock task (reason required)
- [ ] Bulk complete selected tasks

#### 4.4 Completed Tasks Tab
- [ ] Same structure as Active Tasks
- [ ] Can reopen completed task (with comment required)
- [ ] Completion timeline — chart showing tasks completed per week

---

### Week 5 — Budget, Change Orders & Cost Savings

#### 5.1 Budget — Full Rebuild

**Category Level View:**
- [ ] Category cards (Hard Cost, Soft Cost, FF&E, Expenses, Contingency, Tax)
- [ ] Each card: Baseline | Target | Actual | Variance | % Used
- [ ] Expand category → show vendor line items
- [ ] Progress bar showing spend vs. target (color: green < 85%, amber < 100%, red > 100%)

**Vendor Line Item Level:**
- [ ] Add vendor line item form: vendor, description, contract amount
- [ ] Track: Contract Amount | Invoiced | Paid | Pending
- [ ] Link invoices (documents) to line items
- [ ] Status: Pending | Under Contract | Invoiced | Paid

**Financial Summary Bar (always visible at bottom):**
- [ ] Baseline Budget | Target Budget | Total COs | Total Savings | Current Total | vs. Approved

**Budget Charts:**
- [ ] Baseline vs. Actual bar chart (by category)
- [ ] Cash flow projection chart (monthly spend forecast)
- [ ] Budget burn rate over time (line chart)

**Auto-rollup logic:**
- [ ] Approved Change Orders auto-add to relevant budget category
- [ ] Cost Savings auto-subtract from relevant category
- [ ] Net Project Cost = Target + Approved COs - Savings (calculated, not manual)

#### 5.2 Change Orders — Enhanced

- [ ] CO form: requested by, description, amount, category link, notes, attach document
- [ ] CO status workflow: Pending → Under Review → Approved / Rejected
- [ ] Approval requires PM sign-off (if role = admin)
- [ ] CO number auto-increments
- [ ] Pending COs shown as "exposure" on budget (different color)
- [ ] Export COs to PDF (formatted log)
- [ ] CO history shows who approved and when

#### 5.3 Cost Savings — Enhanced

- [ ] Same structure as COs
- [ ] Link savings to specific budget line item
- [ ] Category for savings type: Negotiation | Value Engineering | Scope Reduction | Other
- [ ] Savings tracker chart (cumulative savings over time)

---

### Week 6 — Schedule, Gantt & Bid Schedule

#### 6.1 Schedule Tab — Enhanced

- [ ] Schedule items with baseline vs. actual dates
- [ ] On-track / behind indicators (calculated, not manual)
- [ ] Predecessor linking (item B depends on item A)
- [ ] Delay cascade: when A slips, B and all dependents recalculate
- [ ] Variance column: actual days vs. baseline
- [ ] SPI calculation fix: SPI = Earned Value / Planned Value (proper EVM)
- [ ] Warranty period tracker (start/end dates, 30/60/90-day inspection reminders)
- [ ] Baseline lock (lock current schedule as baseline for comparison)
- [ ] Export schedule to Excel

#### 6.2 Gantt — Full Rebuild

**Gantt Engine (DHTMLX Gantt Professional):**
- [ ] Task-level bars (not just milestones)
- [ ] Predecessor/successor dependencies with arrows
- [ ] Critical path highlighted in red
- [ ] Drag-and-drop to reschedule (auto-cascades dependents)
- [ ] Baseline bars shown as ghost behind current bars
- [ ] Milestone diamonds
- [ ] Today marker (vertical red line)
- [ ] Zoom levels: Day | Week | Month | Quarter
- [ ] Resource allocation row per team

**AI Narrative:**
- [ ] "Critical path summary" — AI generates 2-sentence explanation of critical path
- [ ] "What-if" analysis: drag a milestone → AI instantly narrates the downstream impact

**Export:**
- [ ] Export Gantt to PDF (formatted, landscape)
- [ ] Export to Smartsheet-compatible CSV

#### 6.3 Bid Schedule — Enhanced

- [ ] Timeline visualization (horizontal bar per phase)
- [ ] Overdue calculation automatic (vs. today's date)
- [ ] Add/edit dates inline (click to edit)
- [ ] Pre-Bid Walk is the anchor; all other phases offset from it
- [ ] Add custom phases
- [ ] Email blast button: "Notify all bidders of schedule"

---

## 6. PHASE 2 — AI CORE (WEEKS 7–12)

**Goal:** Embed Claude AI throughout the app as a genuine productivity multiplier.

### Week 7 — AI Infrastructure Setup

#### 7.1 AI Service Architecture

```
/services/ai/
  claude.ts          — Claude API client wrapper
  embeddings.ts      — Generate + store vector embeddings
  rag.ts             — Retrieval Augmented Generation over project docs
  extraction.ts      — Structured data extraction from documents
  insights.ts        — Project risk scoring and insight generation
  reports.ts         — AI narrative generation for reports
```

#### 7.2 Project RAG Index
- [ ] On document upload: extract text → chunk → embed → store in pgvector
- [ ] Chunking strategy: 512 tokens, 50-token overlap
- [ ] Metadata: project_id, doc_type, doc_date per chunk
- [ ] Similarity search function: `match_documents(query, project_id, limit)`
- [ ] Index refreshes incrementally (not full rebuild)

#### 7.3 AI System Prompt Foundation
```
You are an expert CRE (Commercial Real Estate) project manager assistant with 20+ years
of experience in tenant improvement and build-out projects. You have full context of the
user's project portfolio including all tasks, budgets, schedules, change orders, and documents.

Always:
- Be specific and cite actual project data (amounts, dates, names)
- Prioritize lease-critical dates above all else
- Flag financial risks proactively (budget overruns, CO exposure)
- Reference industry benchmarks when comparing performance
- Format responses in clear, executive-friendly language

Never:
- Make up data not present in the project context
- Give generic advice that ignores the actual project state
```

---

### Week 8 — AI Assistant (Chat Interface)

#### 8.1 Global AI Assistant Panel

**UI:** Slide-out drawer, accessible from every screen via keyboard shortcut (Cmd+K)

**Context awareness:** AI automatically receives:
- Current project data (tasks, budget, schedule, COs)
- Recent activity (last 30 days)
- Relevant documents (via RAG search)
- Portfolio summary (all projects health + KPIs)

**Capabilities:**
- [ ] Natural language project queries
  - "What's the total CO exposure across all active projects?"
  - "Which tasks are blocking substantial completion on Las Olas?"
  - "How many days until the Worth Ave lease expires and what's not started?"
- [ ] Draft communications
  - "Draft a follow-up email to JRM about the outstanding permit sworn document"
  - "Write a weekly status update for the Las Olas project"
  - "Compose a change order request to the landlord for $17,500 pre-construction work"
- [ ] Decision support
  - "Should I issue a NTP to the furniture vendor given current schedule?"
  - "Given the CO exposure, will we stay under the approved budget?"
- [ ] Document queries
  - "What did the GC say about long lead times in their last proposal?"
  - "What permit comments are still open?"

**Chat features:**
- [ ] Message history (persisted per project)
- [ ] Copy response to clipboard
- [ ] Insert response into a note/task/meeting note
- [ ] Thumbs up/down feedback (trains prompt tuning)
- [ ] "Share conversation" generates a formatted summary

---

### Week 9 — Document Intelligence

#### 9.1 Document Hub (New Module)

**Structure:**
```
Documents
  ├── Contracts
  ├── Proposals / RFPs
  ├── Permits & Approvals
  ├── Drawings & Floor Plans
  ├── RFIs
  ├── Submittals
  ├── Change Orders
  ├── Invoices
  ├── Meeting Notes
  ├── Photos
  └── Reports
```

**Document Card:**
- Title, type badge, upload date, size
- AI summary (1-2 sentences generated on upload)
- Status badge
- Link to related entity (RFI, CO, budget line)
- Version history

#### 9.2 AI Document Extraction

**On every document upload, AI automatically:**

**GC Proposal / Contract:**
- [ ] Extracts: contract value, payment schedule, milestone commitments, scope inclusions, exclusions
- [ ] Pre-fills: budget line item (vendor, amount), schedule items (dates)
- [ ] Flags: liquidated damages clauses, change order thresholds, insurance requirements

**Permit Comment Letter:**
- [ ] Extracts: each comment number, description, required action
- [ ] Creates: a task for each open comment in the Active Tasks tab
- [ ] Assigns: task to the relevant team (Architect, Engineer, Expeditor)

**Invoice:**
- [ ] Extracts: vendor name, invoice number, date, line items, total
- [ ] Matches to: existing budget line item
- [ ] Flags: discrepancies vs. contract amount (> 5% difference)
- [ ] Creates: approval workflow (PM must approve before payment)

**Lease (New Upload):**
- [ ] Extracts: tenant name, premises address, square footage, commencement date, expiration date, TI allowance, holdover provisions, renewal options
- [ ] Pre-fills: project details, lease expiration alert
- [ ] Highlights: TI disbursement conditions and deadlines

**Change Order Request:**
- [ ] Extracts: CO number, description, amount, reason code
- [ ] Categorizes: into Hard Cost / Soft Cost / etc. based on description
- [ ] Creates: CO record in the change order log

**Meeting Minutes (uploaded PDF):**
- [ ] Extracts: attendees, date, action items (with owner + due date), decisions, risks
- [ ] Creates: task for each action item
- [ ] Adds: risk entries to AI insights panel

#### 9.3 AI Meeting Notes (Audio → Structured Notes)

- [ ] Record meeting audio in-app (or upload MP3/M4A)
- [ ] Whisper API transcribes audio → raw text
- [ ] Claude structures transcript into:
  - Meeting summary
  - Attendees (auto-detected from transcript)
  - Action items (person → task → due date)
  - Key decisions
  - Risks/issues raised
- [ ] One-click: all action items become tasks in the Active Tasks tab
- [ ] Meeting note saved to Documents hub

---

### Week 10 — AI Insights & Risk Engine

#### 10.1 Nightly AI Risk Scoring Job

**Runs every night at midnight per project:**

```
Input: All project data (tasks, budget, schedule, COs, documents, activity)
Output: Updated health_score (0-100) + ai_insights records

Scoring Formula:
  Schedule Score (30%):
    - SPI ≥ 1.0 → 100
    - SPI 0.9-1.0 → 70
    - SPI 0.8-0.9 → 40
    - SPI < 0.8 → 0
    - Lease within 60 days and <80% tasks complete → -20

  Budget Score (30%):
    - Actual < 85% of Baseline → 100
    - Actual 85-95% → 80
    - Actual 95-100% → 60
    - Actual > 100% → 20
    - Pending COs + Actual > Baseline → -10

  Task Velocity Score (20%):
    - Tasks completed last 7 days / tasks overdue → ratio → 0-100

  Risk Exposure Score (20%):
    - Open RFIs with high priority: -5 each
    - Open permit comments overdue: -10 each
    - Blocked tasks: -5 each
    - CO exposure > 10% of budget: -15
```

#### 10.2 AI-Generated Risk Flags

**Triggers and examples:**

| Trigger | AI Insight Generated |
|---------|---------------------|
| Budget burn > 90% with > 30% work remaining | "⚠️ Las Olas is tracking to exceed the approved budget by $142K. Hard Costs are the primary driver (+18%). Recommend reviewing JRM contract scope with Zachary Strauss." |
| Lease expiry < 45 days and tasks < 80% | "🔴 Worth Ave lease expires in 38 days. Only 12% of tasks are complete. Holdover exposure: ~$47K/month. Escalation required immediately." |
| No activity logged in 7 days | "⚠️ No activity logged on Las Olas in 7 days. Last action: Permit site visit (3/9). Recommend checking permit status." |
| RFI open > 14 days | "⚠️ RFI #003 (MEP coordination) has been open 18 days without a response. This may impact the MER Freeze #2 milestone." |
| Change order % > 8% of budget | "ℹ️ Change order volume has reached 8.4% of the Target Budget. Watch for scope creep — consider a scope freeze with the design team." |
| Long lead item task not started | "⚠️ 'Long Lead Items / PO' task is still active with construction start 12 weeks away. Based on typical lead times, orders should be placed within 2 weeks." |

#### 10.3 Insights Panel

- [ ] Dashboard shows top 5 portfolio-level insights (sorted by severity)
- [ ] Project detail shows project-specific insights (sidebar card)
- [ ] Each insight: dismiss, snooze (3/7/14 days), escalate (creates task)
- [ ] Insights history (what was flagged, when, was it acted on)

---

### Week 11 — AI-Powered Project Creation

#### 11.1 New Project Wizard (AI-Assisted)

**Step 1 — Project Basics:**
- Project name, address (geocoded automatically via Mapbox)
- Client/tenant name
- Building type, square footage
- Delivery method (Design-Bid-Build, Design-Build, CM-at-Risk)
- Budget envelope ($)
- Target Go Live date

**Step 2 — AI Task List Generation:**
```
AI generates customized task list based on:
- Project type and size
- Delivery method (different tasks for DBB vs. DB)
- Historical projects (what tasks always appear for similar projects)
- Lead times (what needs to start NOW given Go Live date)
- Client-specific requirements (if JPMC, include JPMC-specific checklist items)
```

- [ ] Show AI-generated task list for PM review before saving
- [ ] PM can add/remove/edit tasks before confirming
- [ ] AI explains why each task was included

**Step 3 — AI Schedule Generation:**
- Based on Go Live target date, AI back-calculates a draft milestone schedule
- Shows: Funding Approval → Design Start → Permit → Construction → Go Live
- Highlights: critical milestones that must be hit to make Go Live
- PM adjusts then locks baseline

**Step 4 — AI Budget Template:**
- Based on $/SF benchmarks from your portfolio history
- Pre-fills budget categories with estimated amounts
- PM adjusts then locks baseline

---

### Week 12 — RFI & Submittal Workflows

#### 12.1 RFI Workflow

**Create RFI:**
- [ ] Number (auto), subject, question, spec section, submitted by
- [ ] Attach drawing markup or document
- [ ] Priority: Low | Medium | High | Critical
- [ ] Required by date
- [ ] AI drafts the RFI question from a brief description

**RFI Review:**
- [ ] Assign to reviewer (architect, engineer, landlord)
- [ ] Email notification to reviewer (with link)
- [ ] Reviewer responds in portal or via email reply
- [ ] AI summarizes response and flags cost/schedule impact
- [ ] RFI closed with formal answer logged

**RFI Log:**
- [ ] Table view: all RFIs with status, age, responsible party
- [ ] Filter: open, answered, overdue
- [ ] Export to PDF or Excel for owner/GC submittal

#### 12.2 Submittal Workflow

**Create Submittal:**
- [ ] Number, title, spec section, type (shop drawing/product data/sample)
- [ ] Submitted by vendor/GC
- [ ] Required by date (reverse-engineered from construction schedule)
- [ ] Upload document

**Review Workflow:**
- [ ] Architect/engineer review in portal
- [ ] Status: Approved | Approved as Noted | Revise and Resubmit | Rejected
- [ ] Review stamp on document
- [ ] Revision tracking (Rev 1, Rev 2...)
- [ ] AI compares submittal to spec section and flags non-conformances before review

**Submittal Log:**
- [ ] Status dashboard: pie chart of approved vs. pending vs. rejected
- [ ] Overdue flag (past required-by date)
- [ ] Export log

---

## 7. PHASE 3 — ADVANCED MODULES (WEEKS 13–20)

### Week 13-14 — Executive Reporting Engine

#### 13.1 Report Builder

**Standard Reports:**
1. **Project Status Report** — 1-page per project, executive-ready
   - Health score + trend arrow
   - Budget status bar
   - Schedule status + critical milestones
   - Top 3 risks (AI-generated)
   - Next 2-week action items
   - Photo of space (from floor plans)

2. **Portfolio Summary Report** — All projects on one page
   - KPI scorecards
   - Budget rollup
   - Health score ranking table
   - Map of all locations

3. **Change Order Log** — Formatted PDF
4. **Budget Summary** — Category breakdown with charts
5. **RFI / Submittal Log**
6. **Lessons Learned Summary**

**AI Narrative Generation:**
- [ ] Each report includes an AI-written executive summary (2-3 paragraphs)
- [ ] Tone: professional, data-backed, action-oriented
- [ ] AI highlights what changed since last report (delta analysis)
- [ ] Example: "Since the last report (March 9), Las Olas has completed 14 tasks and added 2 change orders totaling $9,050. The project remains at risk of a schedule delay due to the outstanding permit comment response. The critical path now runs through the permit response deadline (March 20). Recommend immediate follow-up with the expeditor."

**Report Scheduling:**
- [ ] Configure automatic email delivery (weekly, bi-weekly, monthly)
- [ ] Stakeholder distribution list per project
- [ ] Reports stored in Documents hub automatically

#### 13.2 Analytics Dashboard — Rebuild

**Portfolio Analytics:**
- [ ] PMO Scorecard (On-Time %, Budget Adherence %, CO%, Quality)
- [ ] Health score trends (line chart over time per project)
- [ ] Budget vs. actual (all projects, grouped bar chart)
- [ ] Task velocity chart (tasks completed per week, portfolio-wide)
- [ ] CO exposure dashboard (pending + approved by project)

**Benchmarking:**
- [ ] $/SF by project type (your portfolio vs. industry benchmark)
- [ ] Schedule SPI trend (are you improving over time?)
- [ ] CO% trend by project (which projects generate most COs)
- [ ] Vendor performance (who delivers on time/budget)

**AI Insights Tab (in Analytics):**
- [ ] "What's working" — AI identifies top-performing patterns
- [ ] "What's not working" — AI identifies systemic issues
- [ ] "Recommendations" — 3-5 specific actions to improve portfolio health

---

### Week 15-16 — Stakeholder Portal

#### 15.1 Limited-Access Portal

**Purpose:** Give clients/vendors a read-only (or limited) window into the project without full app access.

**Stakeholder view includes:**
- [ ] Project health summary (score, status)
- [ ] Milestone timeline (Gantt view, simplified)
- [ ] Budget summary (high-level only, no line items)
- [ ] Active issues (blocked tasks, open RFIs)
- [ ] Meeting notes (PM selects which ones to share)
- [ ] Document sharing (PM selects which documents to share)
- [ ] Next milestones (30-day view)

**Stakeholder actions:**
- [ ] Review and approve documents
- [ ] Respond to RFIs (if assigned)
- [ ] Upload documents
- [ ] Comment on tasks (not edit)

**Invite flow:**
- [ ] PM enters email → stakeholder gets magic link (no password)
- [ ] Access expires after configured time (30/60/90 days)
- [ ] PM can revoke access at any time
- [ ] Audit log of all stakeholder views and actions

---

### Week 17-18 — Lessons Learned Engine

#### 17.1 Lessons Learned Module

**Per-Project Input:**
- [ ] Manual entry: category, what happened, root cause, recommendation
- [ ] AI-assisted: "Analyze this project and suggest lessons learned"
- [ ] Pull from: COs (what caused them), delayed tasks (why), closed RFIs (recurring issues)

**AI Post-Project Analysis:**
```
After marking project as Complete, Claude analyzes entire project history:
  - Change order patterns → "Hard costs consistently exceeded estimates by 15-20%. Root cause: insufficient pre-bid site investigation."
  - Schedule slippage patterns → "Permit phase slipped 8 weeks. Contributing factors: permit comments on MEP coordination."
  - Vendor performance → "JRM delivered on schedule but had 4 change orders. Pre-negotiate CO limits in future contracts."
  - Process gaps → "No submittal log was maintained until Week 12. Recommend establishing submittal register at project kick-off."
```

**Cross-Project Learning:**
- [ ] Lessons learned library (searchable across all closed projects)
- [ ] When creating a new similar project, AI surfaces relevant lessons
- [ ] Example: "For a Standard 7,000 SF build in South Florida, past projects flagged: (1) Allow 6 weeks for permit — average is 9 weeks in Broward County. (2) Include UPS capacity study in early electrical scope."

---

### Week 19-20 — Integrations

#### 19.1 Microsoft Outlook / Gmail Integration

- [ ] OAuth connection to PM's email account
- [ ] Sync incoming emails to project (by address or domain)
- [ ] AI reads email thread → suggests logging as: Meeting Note | RFI | CO | Document
- [ ] Send emails from within app (reply to stakeholders)
- [ ] Calendar sync: meeting invites → meeting notes auto-created

#### 19.2 QuickBooks Integration

- [ ] Connect to QuickBooks Online API
- [ ] Sync vendor invoices → budget line items
- [ ] Match payments → mark budget line items as "Paid"
- [ ] Export budget summary → QuickBooks job costing

#### 19.3 DocuSign Integration

- [ ] Send contracts for signature from within app
- [ ] Auto-log signed document to Documents hub
- [ ] Trigger: when contract signed → create budget line item + unlock tasks

---

## 8. PHASE 4 — SCALE & MOBILE (WEEKS 21–30)

### Week 21-24 — Mobile App (React Native / Expo)

#### 21.1 Core Mobile Features

**Home Screen:**
- [ ] Portfolio health at a glance (card per project)
- [ ] My tasks (assigned to me, due this week)
- [ ] AI insight notifications (push)
- [ ] Quick action buttons: Log Photo | Add Task | Log Meeting

**Site Walk Mode:**
- [ ] Camera integration: photo → auto-attached to project
- [ ] Tag photo: task, location, issue type
- [ ] Voice note: transcribed and attached to task
- [ ] Punch list builder: walk room by room, add items per room

**Task Management (mobile-optimized):**
- [ ] Swipe to complete task
- [ ] Tap to expand → see checklist items
- [ ] Offline mode: changes queue and sync when connected
- [ ] Filter: "My Tasks" | "Due Today" | "Overdue"

**Voice-to-Task:**
- [ ] Hold microphone button
- [ ] "Add punch list item — missing ceiling tile in conference room B, contractor responsible"
- [ ] AI parses → creates task with correct team tag and description

**QR/Barcode Scanner:**
- [ ] Scan equipment barcode → log serial number in technology checklist
- [ ] Scan location QR code → opens that room's punch list

#### 21.2 Mobile-Specific Features

- [ ] Push notifications (task due, AI risk flag, document uploaded, CO approved)
- [ ] Biometric login (Face ID / fingerprint)
- [ ] Dark mode
- [ ] Offline-first architecture (all data cached via TanStack Query)

---

### Week 25-27 — Enterprise & White Label

#### 25.1 Enterprise Features

**Multi-Client Support:**
- [ ] PM can manage projects across multiple client orgs
- [ ] Switch between client contexts without re-logging
- [ ] Billing per org (Stripe integration)

**Audit Log:**
- [ ] Every data change logged: who, what, when, previous value
- [ ] Exportable for compliance
- [ ] 7-year retention (CRE contract standard)

**Advanced Permissions:**
- [ ] Custom roles with granular permissions
- [ ] "Finance Only" role: can see budget but not tasks
- [ ] "Contractor" role: can see their tasks and submittals only
- [ ] Field-level access control (hide budget amounts from contractors)

#### 25.2 White Label

- [ ] Custom logo + color scheme per org
- [ ] Custom domain (cre.jll.com instead of cre-pmo.app)
- [ ] Email branding (reports sent from @jll.com)
- [ ] Custom AI persona name ("JLL PMO Assistant" instead of generic)

---

### Week 28-30 — Performance, Security & Launch

#### 28.1 Performance
- [ ] All list views virtualized (react-virtual) — handle 10,000+ tasks
- [ ] Image optimization (WebP, lazy loading, progressive)
- [ ] Code splitting: each major module is a lazy-loaded chunk
- [ ] CDN for static assets (Cloudflare)
- [ ] Database query optimization (indexes on all foreign keys and filter fields)
- [ ] API response caching (TanStack Query stale-while-revalidate)

#### 28.2 Security
- [ ] All API endpoints require authenticated JWT
- [ ] RLS enforces org isolation at database level
- [ ] File uploads: virus scan before storage
- [ ] No sensitive data in URL params or localStorage
- [ ] HTTPS only, HSTS enabled
- [ ] SOC 2 Type I prep (access logs, encryption at rest, MFA)
- [ ] GDPR compliance (data export, right to delete)

#### 28.3 Launch Checklist
- [ ] Production Supabase environment configured
- [ ] Domain + SSL configured
- [ ] Sentry error monitoring
- [ ] PostHog product analytics (feature usage, funnel analysis)
- [ ] Uptime monitoring (Better Uptime or Checkly)
- [ ] Backup verification (Supabase point-in-time recovery)
- [ ] Load test (simulate 50 concurrent users)
- [ ] User acceptance testing with 3 real PMs
- [ ] Migration script: import V1 data → V2 schema

---

## 9. UI/UX DESIGN SYSTEM

### Color System
```css
/* Brand */
--primary: #1e40af       /* Deep Blue — trust, professional */
--primary-light: #3b82f6
--secondary: #0d9488     /* Teal — CRE/property color */

/* Status */
--success: #16a34a       /* Green — on track, healthy */
--warning: #d97706       /* Amber — at risk, needs attention */
--danger: #dc2626        /* Red — critical, overdue */
--info: #7c3aed          /* Purple — AI insights */

/* Neutral */
--gray-50 to --gray-950  /* Tailwind slate scale */

/* Financial */
--budget-under: #16a34a  /* Under budget */
--budget-near: #d97706   /* 85-100% used */
--budget-over: #dc2626   /* Over budget */
```

### Typography
```css
/* Using Inter (already in Tailwind) */
--font-display: 600 24px    /* Dashboard KPI numbers */
--font-heading: 600 18px    /* Card headers */
--font-body: 400 14px       /* Default body */
--font-label: 500 12px      /* Tags, badges, metadata */
--font-mono: 400 13px       /* Amounts, codes */
```

### Component Standards

**Health Score Badge:**
```
80-100: 🟢 bg-green-100 text-green-800 "HEALTHY"
60-79:  🟡 bg-amber-100 text-amber-800 "AT RISK"
0-59:   🔴 bg-red-100   text-red-800   "CRITICAL"
```

**Budget Bars:**
```
< 85% used: green bar
85-100% used: amber bar with pulse animation
> 100% used: red bar with overflow indicator
```

**AI-Generated Content:**
- Always marked with a subtle purple border-left
- "✦ AI" label in top-right corner
- Dismiss (×) button always present

### Page Layout
```
┌─────────────────────────────────────────────────┐
│  Sidebar (240px)    │  Main Content Area         │
│  - Logo             │  - Page Header (breadcrumb)│
│  - Nav items        │  - Content (scrollable)    │
│  - Project switcher │                            │
│  - AI chat (Cmd+K)  │                            │
│  - User profile     │                            │
└─────────────────────┴────────────────────────────┘
```

---

## 10. AI INTEGRATION SPECIFICATIONS

### Claude API Usage Patterns

#### Pattern 1: Document Extraction
```typescript
async function extractDocumentData(document: string, docType: string) {
  const response = await claude.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    tools: [
      {
        name: 'extract_contract_data',
        description: 'Extract structured data from a GC contract',
        input_schema: {
          type: 'object',
          properties: {
            vendor_name: { type: 'string' },
            contract_amount: { type: 'number' },
            start_date: { type: 'string', format: 'date' },
            completion_date: { type: 'string', format: 'date' },
            payment_schedule: { type: 'array', items: { ... } },
            scope_inclusions: { type: 'array', items: { type: 'string' } },
            scope_exclusions: { type: 'array', items: { type: 'string' } },
            ld_clause: { type: 'string' },
            co_threshold: { type: 'number' }
          }
        }
      }
    ],
    messages: [
      { role: 'user', content: `Extract all key data from this ${docType}:\n\n${document}` }
    ]
  });
  return response.content[0].input;
}
```

#### Pattern 2: Project Health Analysis
```typescript
async function analyzeProjectHealth(project: ProjectContext) {
  const systemPrompt = buildPMSystemPrompt(project);
  const response = await claude.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: 'Analyze this project and return 3-5 specific, actionable risk flags with severity levels.'
    }]
  });
  return parseInsights(response.content[0].text);
}
```

#### Pattern 3: RAG Query
```typescript
async function queryProjectDocuments(query: string, projectId: string) {
  // 1. Embed the query
  const embedding = await generateEmbedding(query);

  // 2. Find relevant document chunks
  const chunks = await supabase.rpc('match_documents', {
    query_embedding: embedding,
    match_project_id: projectId,
    match_count: 5
  });

  // 3. Pass chunks + question to Claude
  const response = await claude.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Based on these project documents:\n\n${chunks.map(c => c.content).join('\n\n')}\n\nAnswer: ${query}`
    }]
  });

  return response.content[0].text;
}
```

### Cost Management
- Nightly health analysis: ~$0.05/project/night (claude-sonnet-4-6)
- Document extraction: ~$0.10/document
- Chat queries: ~$0.02/query average
- Estimated monthly AI cost for 20 projects: ~$40-80/month

---

## 11. TECH STACK — FINAL DECISIONS

| Layer | Choice | Version | Justification |
|-------|--------|---------|---------------|
| Web Framework | React | 19 | Industry standard, team familiarity |
| Framework | Next.js | 14+ | Full-stack App Router, Vercel AI SDK, better than Vite for SSR |
| Language | TypeScript | 5.5 | End-to-end type safety |
| Styling | Tailwind CSS | 4 | Utility-first, zero CSS bloat |
| Components | shadcn/ui | Latest | Copy-owned components, not black-box |
| Data Tables | TanStack Table | 8 | Headless, works with shadcn |
| Charts | Recharts | 2.13 | React-native, customizable |
| Gantt | DHTMLX Gantt Professional | 8.x | Full CPM, $149/dev one-time — most affordable with critical path |
| Maps | Mapbox GL JS + react-map-gl | 3.x | WebGL rendering, best CRE visual quality |
| Geocoding | Google Geocoding API only | N/A | Best address accuracy; use only geocoding, not full Maps embed |
| Icons | Lucide React | Latest | Consistent, MIT licensed |
| Backend Platform | Supabase | Latest | Postgres + Auth + Realtime + Storage |
| API Layer | tRPC | 11 | Type-safe, no schema drift |
| Data Fetching | TanStack Query | 5 | Best-in-class cache management |
| UI State | Zustand | 5 | Lightweight, TypeScript-first |
| Forms | React Hook Form + Zod | Latest | Performance + validation |
| PDF (complex reports) | Puppeteer / Playwright HTML→PDF | Latest | Reuses existing React components + Tailwind styles exactly |
| PDF (data exports) | @react-pdf/renderer | 4 | Lightweight JSX-based PDF for tables/lists |
| PDF (merging) | pdf-lib | Latest | Combine cover pages, sections, Gantt snapshots |
| AI (reasoning) | Claude API (claude-sonnet-4-6) | Latest | Best reasoning for PM tasks; 200K context; structured output via tool use |
| AI (embeddings) | OpenAI text-embedding-3-small | Latest | Anthropic has no embeddings API; $0.02/1M tokens, pairs with pgvector |
| Audio Transcription | OpenAI Whisper API | Latest | Best accuracy for meeting audio |
| Mobile | Expo (React Native) + EAS Build | 52 | Offline, native camera, push notifications; EAS handles iOS/Android builds |
| Monorepo | Turborepo | Latest | Share types and API clients between web + mobile |
| ORM | Drizzle ORM | Latest | Type-safe, works seamlessly with Supabase |
| Testing | Vitest + React Testing Library | Latest | Vite-native, fast unit + component tests |
| E2E Testing | Playwright | Latest | Cross-browser, reliable |
| CI/CD | GitHub Actions | N/A | Automated on every PR |
| Hosting | Vercel (web) + Supabase (backend) | N/A | Zero-config deployment |
| Monitoring | Sentry + PostHog | Latest | Errors + product analytics |

---

## 12. TESTING STRATEGY

### Unit Tests (Vitest)
- All utility functions (health score calc, EVM/SPI calc, date calculations)
- AI extraction parsers (verify correct field extraction)
- Budget rollup calculations
- Dependency cascade logic

### Component Tests (React Testing Library)
- KPI cards render correct values
- Budget bars show correct colors at thresholds
- Task filtering works correctly
- Form validation messages appear correctly

### Integration Tests
- Supabase database operations (using test database)
- tRPC endpoints return correct shapes
- AI service responses parse correctly
- File upload → extraction → data creation pipeline

### E2E Tests (Playwright)
- Create project → AI generates task list → verify tasks created
- Upload contract → verify budget line item created
- Complete task → verify health score updates
- Add change order → verify budget rollup updates
- Export report → verify PDF downloads

### Performance Tests
- Dashboard loads with 20 projects in < 2 seconds
- Task list renders 500 tasks in < 100ms (virtual scrolling)
- Document upload + AI extraction completes in < 30 seconds
- Gantt renders 200-task project in < 500ms

---

## 13. DEPLOYMENT & DEVOPS

### Environments
```
development  → local (Supabase local via CLI, Vite dev server)
staging      → staging.cre-pmo.app (auto-deploy from main branch)
production   → app.cre-pmo.app (manual promote from staging)
```

### CI/CD Pipeline (GitHub Actions)
```yaml
On every PR:
  1. Type check (tsc --noEmit)
  2. Lint (ESLint)
  3. Unit + component tests (Vitest)
  4. Build check (Vite build)
  5. Preview deployment (Vercel Preview URL)

On merge to main:
  1. All above checks
  2. Database migration (Supabase migrations)
  3. Deploy to staging
  4. Run E2E tests against staging
  5. Notify Slack on success/failure

On manual promote:
  1. Deploy to production
  2. Run smoke tests
  3. Notify team
```

### Database Migrations
- All schema changes as versioned SQL migration files
- Never modify production schema manually
- Staging gets migrations first (test before prod)
- Supabase point-in-time recovery enabled (7-day window)

---

## 14. FEATURE FLAG & RELEASE PLAN

Use PostHog feature flags to control rollout:

| Flag | Phase | Description |
|------|-------|-------------|
| `ai_assistant` | Phase 2 | Global AI chat panel |
| `document_extraction` | Phase 2 | AI extraction on upload |
| `ai_insights` | Phase 2 | Nightly risk scoring |
| `rfi_workflow` | Phase 2 | Full RFI module |
| `submittal_workflow` | Phase 2 | Full submittal module |
| `executive_reports` | Phase 3 | One-click PDF reports |
| `stakeholder_portal` | Phase 3 | External stakeholder access |
| `outlook_integration` | Phase 3 | Email sync |
| `mobile_app` | Phase 4 | Mobile companion |
| `lessons_learned_ai` | Phase 3 | Post-project AI analysis |

---

## 15. KPIs FOR THE NEW PLATFORM

### PM Productivity KPIs
| Metric | V1 Baseline | V2 Target |
|--------|------------|-----------|
| Time to create a new project | ~45 minutes | < 5 minutes (AI) |
| Time to generate a status report | ~2 hours | < 30 seconds |
| % of data entered manually | ~95% | < 20% |
| Time from document upload to data in system | Hours | < 2 minutes |
| # of risk issues caught before becoming problems | Unknown | Track quarterly |

### Platform Health KPIs
| Metric | Target |
|--------|--------|
| Page load time (P95) | < 2 seconds |
| AI response time | < 5 seconds |
| Document processing time | < 30 seconds |
| Uptime | > 99.5% |
| Mobile crash rate | < 0.1% |

### Business KPIs
| Metric | Target (Year 1) |
|--------|----------------|
| Active projects managed | 20+ |
| Documents processed by AI | 500+ |
| AI insights generated | 1,000+ |
| Reports generated | 200+ |
| Time saved per PM per week | 5+ hours |

---

## IMMEDIATE NEXT STEPS (THIS WEEK)

1. **Decision:** Confirm Supabase as backend (vs. building custom API)
2. **Decision:** Purchase DHTMLX Gantt Professional license (~$149/developer, one-time)
3. **Decision:** Set up Claude API account (Anthropic Console) + OpenAI API account (for embeddings only)
4. **Action:** Create GitHub repo as a Turborepo monorepo (`apps/web`, `apps/mobile`, `packages/shared`)
5. **Action:** Initialize Next.js 14 App Router in `apps/web` with TypeScript + Tailwind + shadcn/ui
5. **Action:** Create Supabase project (production + staging)
6. **Action:** Run database migrations for Phase 1 schema
7. **Action:** Export V1 data to JSON for migration to V2
8. **Action:** Design new dashboard wireframes in Figma before building

---

## 16. VERSION 2.1 ADDITIONS — EXTERNAL REVIEW GAPS

*Added March 2026 after review of external PMO Feature Roadmap recommendation.*
*30 gaps identified. All mapped to phases below.*

---

### 16.1 BUILD SEQUENCE CORRECTION

**Critical finding:** The original roadmap moves to AI (Phase 2, Weeks 7–12) before the system of record is fully stable. The external review correctly identifies the right sequence:

```
Foundation & Master Data
  → System of Record (core PM tools, no AI)
    → Controls & Governance (RAID, stage gates, procurement)
      → Documents & Collaboration
        → Portfolio Control Tower
          → AI Copilots (now operating on clean, complete data)
            → Automation & Rules Engine
              → Enterprise Integrations
```

**Action:** AI features (Phase 2) should not be treated as production-ready until Phases 1 and the Controls layer have been in use for 4+ weeks and the data is trustworthy. AI is only as good as the data it reads.

---

### 16.2 PHASE 0 — MASTER DATA FOUNDATION (PRE-WORK, WEEK 0)

This phase was entirely missing. It must happen before any feature development starts or you will rebuild it later.

**Goal:** One clean, standardized dataset. No features until this is done.

#### Master Data Taxonomy (Lookup Tables in DB)
Define and lock these before Week 1 development:

| Lookup Table | Values |
|---|---|
| Project Type | Standard Build-Out, Relocation, Renovation, Capital Improvement, Infrastructure |
| Project Status | Draft, Intake, Funding, Design, Bid, Permit, Construction, Turnover, Go-Live, Closeout, On-Hold, Cancelled, Archived |
| Delivery Method | Design-Bid-Build, Design-Build, CM-at-Risk, Owner-Managed |
| Region / Market | South Florida, New York, Chicago, etc. (configurable per org) |
| Budget Categories | Hard Cost, Soft Cost, FF&E, Expenses, Contingency, Tax, TI Allowance |
| Milestone Names | Funding Approval, Design Start, Permit Submission, Permit Issuance, Construction Start, Substantial Completion, Handover, Go-Live |
| Team Roles | PM, APM, Architect, MEP Engineer, GC, Expeditor, FM, Technology, Security, AV, Furniture, Low Voltage, Landlord, Legal |
| Task Subdivisions | Initiate, Design, Bidding, Permitting, Construction, Coordination, PO, Schedule, Closeout, Handover, Lesson Learned |
| Document Types | Contract, Proposal, RFI, Submittal, Permit, Drawing, Photo, Invoice, Meeting Note, Change Order, Floor Plan, Report, Transmittal |
| Risk Categories | Schedule, Budget, Design, Vendor, Permit, Scope, Legal, Environmental |
| AHJ (Authority Having Jurisdiction) | Per project (city/county/fire marshal) — configurable |

#### Data Separation & Import
- [ ] Create `test_org` flag on organizations to isolate test data from production
- [ ] Build CSV import pipeline: projects, contacts, checklist templates, historical budgets
- [ ] Write migration script for all V1 data → V2 schema with field mapping doc
- [ ] Validate migrated data (task counts, budget totals, date fields) before go-live

#### Notification Framework (Formal Spec)
Before building any feature, define the notification system architecture:

| Notification Type | Trigger | Recipients | Channel |
|---|---|---|---|
| Task due reminder | 3 days before due date | Assigned user | Email + in-app |
| Task overdue | 1 day after due date | Assigned user + PM | Email + in-app |
| CO pending approval | CO submitted | Approver | Email + in-app |
| CO approval overdue | SLA breach (3 days) | PM + Admin | Email + in-app + Teams/Slack |
| Lease expiry alert | 90 / 60 / 30 / 14 / 7 days | PM + PMO Lead | Email + in-app |
| RFI response overdue | SLA breach | PM + RFI owner | Email + in-app |
| AI risk flag | Nightly scoring job | PM | In-app |
| Stage gate ready | All gate criteria met | PM + Approver | Email + in-app |
| Document uploaded | Upload event | PM + tagged team | In-app |
| Permit comment added | New comment | Expeditor + PM | Email + in-app |

- [ ] Build unified `notifications` table in DB (type, recipient, entity_id, read_at, dismissed_at)
- [ ] Build in-app notification bell (real-time via Supabase subscription)
- [ ] Email delivery via Resend or SendGrid (transactional templates per type)
- [ ] User notification preferences (which types, which channels)

#### Global Search
- [ ] Cmd+K opens search palette (not just AI chat)
- [ ] Search across: projects (name, address), tasks (name), contacts (name, company), documents (title, AI summary), RFIs (subject), COs (description)
- [ ] Results grouped by type with project context shown
- [ ] Recent searches remembered per user
- [ ] Keyboard navigation through results

#### API Architecture
- [ ] Define public API contract before feature sprawl (versioned: `/api/v1/`)
- [ ] Webhooks for integrations: POST to external URL on events (task complete, CO approved, document uploaded)
- [ ] API key management for external integrations
- [ ] Rate limiting on all API endpoints

**Exit Criteria for Phase 0:**
- One clean dataset (no test data mixed with production)
- All lookup tables defined and seeded
- V1 data migrated and validated
- Notification framework delivering reliably
- Global search returning accurate results

---

### 16.3 MISSING DATABASE OBJECTS — SCHEMA ADDITIONS

Add these tables to the schema in Section 4:

```sql
-- RAID: RISK REGISTER
risks
  id uuid PRIMARY KEY
  project_id uuid REFERENCES projects
  title text
  description text
  category text  -- 'Schedule' | 'Budget' | 'Design' | 'Vendor' | 'Permit' | 'Scope'
  probability text  -- 'Low' | 'Medium' | 'High'
  impact text       -- 'Low' | 'Medium' | 'High'
  risk_score integer  -- probability * impact, 1-9
  status text  -- 'open' | 'mitigating' | 'closed' | 'realized'
  mitigation_plan text
  contingency_plan text
  owner_id uuid REFERENCES users
  trigger_event text  -- "What would cause this risk to realize?"
  due_date date
  last_reviewed_at timestamptz
  age_days integer  -- calculated: days since opened
  created_at timestamptz

-- RAID: ISSUE LOG
issues
  id uuid PRIMARY KEY
  project_id uuid REFERENCES projects
  title text
  description text
  category text
  priority text  -- 'Low' | 'Medium' | 'High' | 'Critical'
  status text  -- 'open' | 'in_progress' | 'resolved' | 'closed'
  owner_id uuid REFERENCES users
  linked_milestone_id uuid REFERENCES milestones
  linked_vendor text
  resolution text
  resolved_at timestamptz
  created_at timestamptz

-- RAID: DECISION LOG
decisions
  id uuid PRIMARY KEY
  project_id uuid REFERENCES projects
  title text
  description text
  decision_made text  -- what was decided
  decided_by text
  decided_at date
  rationale text
  impact text
  alternatives_considered text
  linked_milestone_id uuid REFERENCES milestones
  document_id uuid REFERENCES documents
  created_at timestamptz

-- RAID: ASSUMPTIONS & DEPENDENCIES
assumptions
  id uuid PRIMARY KEY
  project_id uuid REFERENCES projects
  type text  -- 'assumption' | 'dependency' | 'constraint'
  description text
  owner_id uuid REFERENCES users
  status text  -- 'active' | 'validated' | 'invalidated' | 'closed'
  impact_if_wrong text
  linked_risk_id uuid REFERENCES risks
  created_at timestamptz

-- STAGE GATES
stage_gates
  id uuid PRIMARY KEY
  project_id uuid REFERENCES projects
  stage text  -- 'intake' | 'funding' | 'design' | 'bid' | 'permit' | 'construction' | 'turnover' | 'go_live' | 'closeout'
  status text  -- 'pending' | 'in_review' | 'approved' | 'rejected'
  criteria jsonb  -- [{criterion, is_met, evidence}]
  submitted_by uuid REFERENCES users
  submitted_at timestamptz
  reviewed_by uuid REFERENCES users
  reviewed_at timestamptz
  notes text

-- PROCUREMENT PACKAGES
procurement_packages
  id uuid PRIMARY KEY
  project_id uuid REFERENCES projects
  name text  -- "General Contractor", "MEP", "Low Voltage", "Furniture"
  trade text
  status text  -- 'planning' | 'rfp_published' | 'bid_walk' | 'rfi_open' | 'proposals_due' | 'leveling' | 'bafo' | 'awarded' | 'contracted' | 'ntp_issued'
  rfp_publish_date date
  bid_walk_date date
  rfi_deadline date
  proposal_due_date date
  leveling_date date
  bafo_date date
  award_date date
  awarded_vendor text
  contract_amount numeric
  ntp_issued_date date
  notes text
  created_at timestamptz

-- VENDOR BIDS (per procurement package)
vendor_bids
  id uuid PRIMARY KEY
  package_id uuid REFERENCES procurement_packages
  vendor_name text
  contact_name text
  bid_amount numeric
  exclusions text
  alternates text
  leveling_notes text
  is_awarded boolean DEFAULT false
  submitted_at timestamptz

-- SLA RULES
sla_rules
  id uuid PRIMARY KEY
  org_id uuid REFERENCES organizations
  rule_name text
  trigger_type text  -- 'co_pending' | 'rfi_open' | 'permit_comment_open' | 'risk_not_reviewed' | 'approval_pending'
  sla_days integer   -- breach threshold in days
  escalation_action text  -- 'notify_pm' | 'notify_admin' | 'create_task' | 'change_priority'
  escalation_target_role text
  is_active boolean DEFAULT true

-- TRANSMITTALS
transmittals
  id uuid PRIMARY KEY
  project_id uuid REFERENCES projects
  number text  -- T-001, T-002...
  sent_by uuid REFERENCES users
  sent_to text  -- names/companies
  purpose text  -- 'For Review' | 'For Record' | 'For Approval' | 'For Construction'
  transmitted_at timestamptz
  response_required_by date
  response_received_at timestamptz
  documents jsonb  -- [{document_id, title}]
  notes text

-- CLOSEOUT CHECKLIST
closeout_items
  id uuid PRIMARY KEY
  project_id uuid REFERENCES projects
  category text  -- 'Punch List' | 'Documentation' | 'Training' | 'Legal' | 'Systems'
  item text
  is_complete boolean DEFAULT false
  completed_by uuid REFERENCES users
  completed_at timestamptz
  notes text

-- LOOKUP / MASTER DATA TABLES
lookup_values
  id uuid PRIMARY KEY
  org_id uuid REFERENCES organizations  -- null = system default
  category text  -- 'project_type' | 'region' | 'team_role' | etc.
  value text
  label text
  sort_order integer
  is_active boolean DEFAULT true

-- AUTOMATION RULES
automation_rules
  id uuid PRIMARY KEY
  org_id uuid REFERENCES organizations
  rule_name text
  is_active boolean DEFAULT true
  trigger_event text  -- 'stage_gate_approved' | 'task_completed' | 'milestone_missed' | 'document_uploaded' | 'lease_threshold'
  trigger_conditions jsonb  -- {field, operator, value}
  action_type text  -- 'create_task' | 'send_notification' | 'escalate' | 'change_status' | 'create_risk'
  action_config jsonb  -- action-specific parameters
  run_count integer DEFAULT 0
  last_run_at timestamptz
  created_at timestamptz
```

---

### 16.4 PHASE 1 ADDITIONS — SYSTEM OF RECORD GAPS

Add to Week 4 (Project Detail Core Tabs):

#### RAID Log Tab (new tab on project detail)
- [ ] **Risk Register** — table view with: risk title, category, probability, impact, score (P×I), owner, status, age (days open), last reviewed
  - Color-coded score: 1-3 green, 4-6 amber, 7-9 red
  - Add/edit risk inline
  - "Mark as Reviewed" button (resets age clock)
  - Realized risk → creates Issue automatically
- [ ] **Issue Log** — active issues with priority, owner, linked milestone, days open
  - Issue → resolution → close workflow
- [ ] **Decision Log** — decisions with who decided, when, rationale
  - Searchable: "find all decisions about MEP"
- [ ] **Assumptions & Dependencies Log** — with invalidation tracking

#### Stage Gate Tab (new tab on project detail)
- [ ] Stage progress bar (Intake → Funding → Design → ... → Closeout)
- [ ] Current stage gate criteria checklist (PM checks off each criterion)
- [ ] "Submit for Approval" button when all criteria met
- [ ] Approver reviews and approves/rejects with notes
- [ ] Approved gate → auto-creates tasks for next stage (from template)
- [ ] Gate rejection → creates issue with rejection reason

#### Task Enhancement (Week 4.3 additions)
- [ ] **Predecessor field** on task (link to another task, with lag days)
- [ ] **Evidence of completion** — attach photo, document, or typed note when completing a task
- [ ] **Required evidence flag** — mark tasks that require proof before they can be closed
- [ ] **Blocker reason required** — when blocking a task, must select reason (waiting on vendor, design change, etc.)
- [ ] Stage-based task filtering ("show only Construction stage tasks")

#### Project List Additions (Week 3.2)
- [ ] **Tags** — multiple custom labels per project (e.g., "JPMC", "Priority", "Q3")
- [ ] **PM ownership** field — filter "My Projects"
- [ ] **Region / Market** field — filter by geography
- [ ] **Client / Business Unit** field
- [ ] Saved filter sets (save "My Active JPMC Projects" as a named filter)

---

### 16.5 PHASE 2 ADDITIONS — CONTROLS & GOVERNANCE

Add these modules between current Phase 1 and Phase 2 (AI Core). These should come before AI.

#### Full Procurement Lifecycle (New Module — Week 7)

Replace the simple Bid Schedule tab with a full Procurement Command Center:

**Procurement Package Cards:**
- One card per trade (GC, MEP, Low Voltage, Furniture, AV, Security, etc.)
- Each card shows current status in the procurement pipeline
- Status pipeline: Planning → RFP Published → Bid Walk → RFI Open → Proposals Due → Leveling → BAFO → Awarded → Under Contract → NTP Issued

**Per-Package Detail:**
- [ ] RFP document attached and date published
- [ ] Bid walk date and attendee list
- [ ] RFI log specific to this package
- [ ] Vendor bid tracking table: vendor name | contact | bid amount | exclusions | alternates | notes
- [ ] Leveling/comparison matrix (side-by-side bid comparison)
- [ ] BAFO round (who received BAFO, revised amounts)
- [ ] Award decision: selected vendor, award amount, rationale
- [ ] Contract: linked to Documents hub, execution date (DocuSign trigger)
- [ ] NTP: issued date → auto-unlocks construction-phase tasks

**Procurement Dashboard (portfolio-level):**
- [ ] Heat map: which projects have procurement stalled and at what stage
- [ ] Average bid-to-award cycle time by trade
- [ ] Vendor participation rate (who bids on what)

#### Executive Exception Queue (New Module — Week 8)

A dedicated weekly action queue showing what requires leadership decisions RIGHT NOW:

**Queue Items (auto-populated by system):**
- COs pending approval > 3 days
- Stage gates submitted but not approved > 5 days
- RFIs overdue > 14 days (high priority)
- Permit comments with no response > 7 days
- Risks rated 7-9 (high severity) with no mitigation plan
- Lease expiry < 30 days with < 80% task completion
- Budget overrun projects with no approved recovery plan

**Each queue item shows:**
- Project name, issue description, days overdue, who needs to act
- One-click action: Approve | Assign | Dismiss (with reason required)
- Escalation chain: if not acted on in X days → notify next level

#### SLA Rules Engine (New Module — Week 8)

- [ ] Visual rule builder: "IF CO is pending approval AND days_pending > 3 THEN notify [approver] AND notify [PM]"
- [ ] Pre-built default rules (configurable per org):
  - CO approval SLA: 3 business days
  - RFI response SLA: 10 business days (configurable by priority)
  - Permit comment response SLA: 7 days
  - Risk review SLA: 14 days (any open risk)
  - Stage gate review SLA: 5 business days
- [ ] SLA breach dashboard: all current breaches across portfolio with age
- [ ] SLA performance trend: are average cycle times improving?

#### Budget: Committed Cost States (Enhancement to Week 5)

The current budget model needs clearer cost states. Replace "Actual" with the full cost stack:

```
For each budget line item, track 5 states:
  Approved Contract    → what you've committed to pay (signed contract)
  Approved Change Orders → approved scope additions
  Pending COs          → submitted but not yet approved (exposure)
  Invoiced             → billed by vendor (accounts payable)
  Paid                 → disbursed

  Estimate at Completion (EAC) = Approved Contract + Approved COs + Pending COs
  Budget Variance = Approved Budget - EAC
```

- [ ] Budget tab shows all 5 columns per line item
- [ ] "Pending exposure" shown in orange (distinct from committed)
- [ ] EAC chart: projected final cost vs. budget (updates in real-time as COs come in)
- [ ] Cash flow forecast: based on contract payment schedules, when will money go out?

---

### 16.6 PHASE 3 ADDITIONS — DOCUMENTS & COLLABORATION GAPS

Add to the existing Documents module (Week 9):

#### Transmittals (New Object)
- [ ] Create transmittal: number (auto), sent to, purpose, attach documents
- [ ] Transmittal log per project (searchable)
- [ ] Response tracking: was it acknowledged? By whom? When?
- [ ] Export transmittal as formal PDF (formatted with project header)

#### Document Version Control (Enhancement)
- [ ] When uploading a document with same title → prompt: "New version of [doc]?"
- [ ] Version history tab per document: V1, V2, V3... with date and uploader
- [ ] "Superseded" badge on old versions
- [ ] Compare versions (for contracts: show what changed)
- [ ] Set current version flag

#### Vendor Portal (Enhancement to Stakeholder Portal)
Extend the existing stakeholder portal with vendor-specific features:
- [ ] Vendor sees ONLY their assigned packages (GC sees GC package, not MEP)
- [ ] Vendor can upload: bid proposals, submittals, RFI responses, invoices
- [ ] Vendor sees their tasks and due dates
- [ ] Vendor receives NTP notification with formal letter
- [ ] Vendor portal has its own branding section (org logo, project name)

#### Photo Log (Enhancement to Documents)
- [ ] Photo log per project with date, location, uploader, notes
- [ ] Photo tagging: link photo to task, room, or issue
- [ ] Grid view and list view
- [ ] Filter by date range, uploader, tag
- [ ] Export photo log to PDF (progress report format)

---

### 16.7 PHASE 4 ADDITIONS — PORTFOLIO CONTROL TOWER GAPS

Add these views to the existing Analytics/Dashboard (Week 13-14):

#### Portfolio Heat Maps (New View)

Cross-project filterable status views with color-coded cells:

| Heat Map | X-axis | Y-axis | Cell Color |
|---|---|---|---|
| Schedule Heat Map | Project | Milestone | Green/Amber/Red by delay |
| Budget Heat Map | Project | Category | % of budget used |
| Risk Heat Map | Project | Risk Category | Count × severity |
| Procurement Heat Map | Project | Trade | Procurement stage |
| Permit Heat Map | Project | AHJ | Days since submission |

- [ ] Click any cell → drill into that project/category
- [ ] Filter by region, PM, client, project type
- [ ] Export heat map as image for executive presentations

#### Resource & Capacity View (New View)
- [ ] PM workload: active projects per PM, task count, % overdue
- [ ] Reviewer capacity: architect reviewing how many active submittals/RFIs
- [ ] GC bandwidth: concurrent projects by GC firm across portfolio
- [ ] Vendor engagement: how many open items per vendor
- [ ] PM capacity planning: if we add Project X, who has bandwidth?

#### Approval Bottleneck Dashboard (New View)
- [ ] All pending approvals across portfolio in one table (CO, stage gate, submittal, document)
- [ ] Average cycle time by approval type and by approver
- [ ] Slowest approver ranking (accountability tool for leadership)
- [ ] Escalation button directly from the dashboard

#### Closeout Readiness Dashboard (New View)
For each project approaching closeout:
- [ ] Punch list completion % (room by room)
- [ ] Outstanding submittals blocking closeout
- [ ] Outstanding RFIs blocking closeout
- [ ] Warranty documentation received? (Y/N per trade)
- [ ] As-built drawings received?
- [ ] Training completed? (IT, facilities, security)
- [ ] Certificate of Occupancy received?
- [ ] Final lien waivers received?
- [ ] Certificate of Substantial Completion issued?
- [ ] Overall closeout readiness score (0-100%)

#### Capital Plan Alignment (New View)
- [ ] Portfolio budget rollup by fiscal quarter
- [ ] Forecast spend by quarter (based on schedule + payment terms)
- [ ] Alignment to approved CapEx plan (enter annual CapEx budget per org)
- [ ] Over/under CapEx budget by quarter
- [ ] Export capital plan summary to Excel for Finance

---

### 16.8 AI ADDITIONS — MISSING COPILOTS & GUARDRAILS

Add to Phase 2 AI Core (currently Weeks 7-12):

#### AI Bid Analysis (New Copilot — Week 10)
- [ ] Upload 2-5 GC/vendor proposals
- [ ] AI normalizes scope across proposals (maps each bid's inclusions/exclusions to a standard line item list)
- [ ] AI identifies gaps: "JRM did not include MEP coordination in their base bid — this is typically $35K-50K"
- [ ] AI highlights alternates and their pricing
- [ ] AI generates leveling matrix draft (tabular comparison, PM reviews and finalizes)
- [ ] AI recommendation: "Based on scope coverage, schedule commitment, and pricing, [Vendor] is most competitive. Key risk: [Vendor] has a 25% CO rate on similar projects per your portfolio history."
- [ ] Leveling matrix exported to Excel or PDF

#### AI Permit Assistant (New Copilot — Week 11)
- [ ] Upload AHJ comment letter (PDF)
- [ ] AI categorizes each comment: Architectural | MEP | Structural | Life Safety | Zoning | Other
- [ ] AI assigns responsible party per comment (Architect for architectural, MEP engineer for MEP, etc.)
- [ ] AI proposes response timeline for each comment
- [ ] AI identifies recurring comment patterns: "This AHJ (Broward County) flags MEP coordination in 78% of submitted packages — pre-coordinate before next submission"
- [ ] AI drafts response language for each comment (PM reviews and edits)
- [ ] Creates task per comment in Active Tasks tab, pre-assigned to responsible party

#### AI Drawing/Document Assistant (Enhancement)
- [ ] Search across all uploaded floor plans and specifications: "Where is the MER room on the 23rd floor?"
- [ ] AI flags missing coordination between drawings: "The electrical plan shows a panel in column G but structural drawings show a beam at that location"
- [ ] AI surfaces lessons learned relevant to current drawings: "Prior projects flagged: check ADA clearance at lactation room door per JPMC standards"

#### AI Guardrails (New Section — applies to all AI features)
These rules must be enforced across every AI-generated output:

**Source Citations:**
- Every AI response that references project data must cite the source
- Format: "[Statement]. *Source: Change Order #3, added 2/14/2026.*"
- If AI cannot cite a source, it must say "I don't have data to support this" rather than hallucinate

**Confidence Scores:**
- AI-extracted data from documents includes a confidence field (High / Medium / Low)
- Low-confidence extractions are flagged for PM review before saving
- Example: "Extracted contract amount: $1,450,000 (Medium confidence — verify against signature page)"

**Human Approval Gates for High-Impact AI Actions:**
| AI Action | Approval Required |
|---|---|
| Auto-create tasks from document | PM reviews list before saving |
| Extract and save budget line item | PM confirms amount before saving |
| Close an RFI based on email content | PM explicitly confirms |
| Update milestone dates from schedule analysis | PM approves each date change |
| Mark risk as mitigated | PM confirms |
| Send communication drafted by AI | PM reviews and sends manually |

**Audit Log for AI-Generated Changes:**
- Every AI-generated record tagged with: `created_by = 'ai'`, `ai_model`, `ai_prompt_hash`, `source_document_id`
- AI activity visible in audit log with "AI" badge
- Admin can bulk-review all AI-generated records

**AI Suggestion Acceptance Rate Tracking:**
- Track: suggestions made, suggestions accepted, suggestions edited, suggestions rejected
- Surface acceptance rate as a KPI (target > 70%)
- Low acceptance rate → review and improve prompts

---

### 16.9 PHASE 5 ADDITIONS — AUTOMATION RULES ENGINE

Add as a new module between Phase 3 and Phase 4 (Weeks 20-22):

#### Rules Engine (New Module)

**Visual Rule Builder:**
```
WHEN  [trigger event]
AND   [conditions met]
THEN  [take action]
```

**Available Triggers:**
- Task completed / overdue / blocked
- Milestone date reached / missed
- Stage gate approved / rejected
- Document uploaded (by type)
- CO submitted / approved / rejected
- Budget threshold crossed (85%, 100%)
- Lease date threshold (90/60/30 days)
- Risk score changes
- Permit comment added
- Project status changed

**Available Actions:**
- Create task (with pre-filled template: name, team, subdivision, due date offset)
- Send notification (to role, specific user, or email)
- Escalate (add to executive exception queue)
- Change project status
- Create risk item (with pre-filled fields)
- Webhook (POST to external URL for integrations)

**Pre-Built Rule Templates (enabled by default):**
| Rule Name | Trigger | Action |
|---|---|---|
| Lease Alert — Critical | Lease expiry = 30 days AND tasks < 80% | Escalate + notify PM + notify PMO Lead |
| Long Lead Procurement | Construction Start = 16 weeks | Create task "Issue Long Lead POs" |
| Stage Gate Auto-Tasks | Design stage gate approved | Create all Bid stage tasks from template |
| Permit Comment Response | Permit comment added | Create task per comment, assign to Expeditor |
| CO Over Threshold | CO amount > $25K | Require additional approver |
| Stale Risk | Risk not reviewed > 14 days | Notify risk owner + create task |
| Closeout Trigger | Substantial Completion approved | Auto-generate closeout task list |

#### Portfolio Scenario Planning (New Module — Week 22)

**What-If Scenarios:**
- [ ] Budget scenario: "If we cut $500K from Las Olas, what can we defer?"
- [ ] Schedule scenario: "If landlord delays TI approval by 6 weeks, what moves?"
- [ ] Capacity scenario: "If we take on a 4th project in Q3, which PM has bandwidth?"
- [ ] Capital scenario: "If we defer 2 projects to Q1, how does CapEx land for the year?"

**How it works:**
- PM creates a named scenario (doesn't affect live data)
- Adjusts inputs (budget, dates, resources)
- System shows impact on: health scores, lease risk, CapEx plan, PM workload
- AI narrates: "In this scenario, Worth Ave drops to CRITICAL status because..."
- PM saves scenario and shares with leadership for decision-making

#### Lessons Learned → Template Feedback Loop (Enhancement)

Add to existing Week 17-18 Lessons Learned module:

- [ ] AI identifies recurring lesson across 3+ projects → proposes template update
- [ ] Example: "UPS capacity study has been added as a CO on 3 of your last 4 Standard builds. Recommend adding it to the Standard Build checklist template under 'Initiate' stage."
- [ ] PM approves → task added to master checklist template
- [ ] Future projects using that template automatically inherit the new task
- [ ] Track: how many lessons were converted to template improvements (governance metric)

---

### 16.10 ENTERPRISE INTEGRATION ADDITIONS (Phase 4)

Add to the existing Integrations module (Week 19-20):

#### Microsoft Teams / Slack (New Integration)
- [ ] Connect Teams or Slack workspace per org
- [ ] Daily digest to designated channel: portfolio health summary, items due today
- [ ] Approval notifications in Teams/Slack with Approve/Reject buttons inline
- [ ] Milestone achieved → automated celebration/status message to channel
- [ ] PM can create tasks by @mentioning the bot: "@CRE-PMO add task: order ceiling tiles, due Friday"
- [ ] Alert channel for critical events (lease < 14 days, budget overrun, SLA breach)

#### PMWeb / Oracle P6 Integration
- [ ] Sync cost data from PMWeb → budget line items
- [ ] Sync schedule from P6 → schedule tab (read-only import)
- [ ] Bi-directional CO sync
- [ ] Vendor/contract records import from PMWeb

#### Procore / ACC Integration
- [ ] Import RFIs and submittals from Procore (for GC-managed projects)
- [ ] Sync drawings from Autodesk Construction Cloud
- [ ] Daily log entries from Procore → activity feed
- [ ] Punch list items from Procore → closeout module

#### ERP Integration (Oracle, SAP)
- [ ] Import committed costs from ERP (approved purchase orders)
- [ ] Sync invoice status (approved, paid) from ERP accounts payable
- [ ] Export budget commitments to ERP for CapEx tracking
- [ ] Eliminate double-entry between PMO system and finance system

#### SCIM & Enterprise SSO
- [ ] SAML 2.0 / OIDC for enterprise SSO (Azure AD, Okta, Ping)
- [ ] SCIM 2.0 for automated user provisioning/deprovisioning
- [ ] Group-to-role mapping (AD Group "CRE-PMs" → PM role; "CRE-Finance" → Finance role)
- [ ] MFA enforcement policy per org

#### GIS & Location Services
- [ ] Parcel data overlay on portfolio map (from county assessor API)
- [ ] Zoning information per project site
- [ ] Flood zone / hazard overlay
- [ ] Market data overlay: vacancy rates, market rents per submarket (from CoStar/CBRE API if licensed)

#### Data Warehouse Export
- [ ] Nightly export to Snowflake / BigQuery / Azure Synapse
- [ ] Pre-built Power BI connector (semantic model)
- [ ] Custom SQL read-only access for Finance team analysts
- [ ] Export schema documentation published for BI team

---

### 16.11 COMPLETE KPI LIST — ADDITIONS

Add to Section 15 (KPIs):

#### PMO Process KPIs (Missing from Original)
| KPI | Definition | Target | How to Measure |
|-----|-----------|--------|----------------|
| Average Permit Cycle Time | Days from permit submission to issuance | Benchmark vs. AHJ average | schedule_items WHERE type = 'permit' |
| Average Approval Cycle Time | Days from CO/stage gate submission to approval | < 3 business days | (approved_at - submitted_at) per approval type |
| Forecast Accuracy | How close was 50%-completion EAC to final actual cost | ±10% | Compare EAC at 50% milestone vs. final cost |
| Checklist Completion by Stage | % of stage tasks complete when stage gate is submitted | > 90% | tasks WHERE stage = current stage |
| Risk Aging | Average days a risk stays open before mitigation | < 21 days | AVG(days_since_open) WHERE status = 'open' |
| Closeout Cycle Time | Days from Substantial Completion to Final Closeout | < 45 days | closeout_items completion tracking |
| PM Capacity Utilization | Active projects per PM vs. target (e.g., 3-4 per PM) | 80-100% capacity | COUNT(projects) GROUP BY pm_owner |
| AI Suggestion Acceptance Rate | % of AI-generated content PM accepts without rejection | > 70% | ai_logs tracking accepted/rejected |
| SLA Breach Rate | % of approval/response events that breach SLA | < 10% | sla_rules vs. actual cycle times |
| Procurement Cycle Time | Days from RFP publish to NTP issued, by trade | Benchmark by trade | procurement_packages date fields |
| Vendor CO Rate | Change orders as % of original contract by vendor | Track by vendor | COs grouped by vendor across all projects |
| Stage Gate Cycle Time | Days from gate submission to gate approval | < 5 business days | stage_gates (reviewed_at - submitted_at) |

---

### 16.12 UPDATED BUILD SEQUENCE (CORRECTED)

The recommended external roadmap's sequence is correct and supersedes the original:

```
Phase 0  (Week 0)       — Master Data Foundation, Import, Notifications, Search
Phase 1  (Weeks 1-6)    — System of Record: core PM tools, RAID, stage gates, budget
Phase 2  (Weeks 7-10)   — Controls & Governance: procurement, SLA engine, exception queue
Phase 3  (Weeks 11-16)  — Documents & Collaboration: full doc hub, vendor portal, transmittals
Phase 4  (Weeks 17-22)  — Portfolio Control Tower: heat maps, capacity, closeout, capital plan
Phase 5  (Weeks 23-30)  — AI Copilots: assistant, bid analysis, permit AI, guardrails
Phase 6  (Weeks 31-36)  — Automation: rules engine, scenario planning, lessons→templates
Phase 7  (Weeks 37-42)  — Enterprise: PMWeb, Procore, ERP, SCIM, GIS, data warehouse
```

**Why AI moves to Phase 5 (not Phase 2):**
The AI copilots are only valuable when they have:
- Clean, standardized project data (Phase 0)
- A complete system of record (Phase 1)
- Governance data: risks, decisions, stage gates (Phase 2)
- A full document corpus to reason over (Phase 3)

Rushing AI onto incomplete data produces unreliable outputs and destroys user trust in the feature.

---

*Version 2.1 — Updated March 2026 following external PMO Feature Roadmap review.*
*30 gaps identified and resolved. Build sequence corrected.*

---

## 17. D&C PLAYBOOK INTEGRATION — CORPORATE PROJECT KNOWLEDGE

*Source: GRE D&C Playbook, Version 12, January 2026, 91 pages.*
*Primary focus: Corporate & Data Center projects (Jorge's primary program).*
*All workflow logic, terminology, thresholds, and process steps below are derived directly from the playbook and must be encoded into the app.*

---

### 17.1 CORPORATE PROJECT LIFECYCLE — AUTHORITATIVE PHASE DEFINITIONS

The app's phase/status system must match the D&C Playbook exactly for corporate projects.
This supersedes the generic phase names used earlier in this document.

**Corporate Project Status State Machine:**
```
Pre-Project → Initiate → Planning → Design → Construction/Execution → Handover → Closeout → [Defect Period] → Closed
```

**Corporate Profile Types** (set at project creation, drives which steps are required):
| Profile | Code | Description | Key Difference |
|---|---|---|---|
| Light | L | Reduced activities | Skips Design phase entirely; jumps Planning → Construction |
| Standard | S | Full standard workflow | All phases; no internal design team reviews |
| Enhanced | E | Full + internal design team | All phases; Global Design Team reviews at every stage |

**App behavior by profile:**
- On project creation, PM selects L/S/E profile
- Each task in the master checklist is tagged L/S/E (some apply to all, some only to S/E)
- Tasks not applicable to the selected profile are auto-hidden (not deleted — can be shown if needed)
- Profile can be upgraded (L→S, S→E) but not downgraded once construction starts

---

### 17.2 CORPORATE PHASE DETAIL — STEP-LEVEL TASK TEMPLATES

The master checklist must include all corporate phase steps with their codes. Each step becomes a task with an owner role and profile applicability tag.

#### Phase C1 — Initiate (Corporate)
| Step | Task | Owner Role | Profile |
|---|---|---|---|
| C1.01 | Identify Project Team | D&C Regional Lead | ALL |
| C1.02 | Identify Stakeholders | PM | ALL |
| C1.03 | Establish Requirements (Programming) | Program Manager / Transaction Manager / PM | ALL |
| C1.04 | Due Diligence Funding (CERP) | PM | S/E |
| C1.05 | Due Diligence — legal/lease obligations, environmental, zoning | Transaction Manager / PM | S/E |
| C1.06 | Test Fits (max 1 per site, max 3 per project) | Program Manager / PM | S/E |
| C1.07 | Sustainability Checklist (data tracking only) | PM | L |
| C1.08 | LEED Certification + Zero Carbon feasibility evaluation; BIM if >10,000 SF | PM | S/E |
| C1.09 | HLE Cost & Duration estimate (using benchmarking data) | PM | S/E |
| C1.10 | Procurement Strategy — hold meeting, engage sourcing (GSS) | PM | S/E |
| C1.11 | Phased Project approach (if applicable) | PM | S/E |

#### Phase C2 — Planning (Corporate)
| Step | Task | Owner Role | Profile |
|---|---|---|---|
| C2.01 | Scope Definition & Agreement | Program Manager / Transaction Manager / PM | ALL |
| C2.02 | Assumptions & Risks — register into Early Warnings (Forecast Elements) | PM | S/E |
| C2.03 | Test Fits (max 3 per project; cannot change without justification) | PM | S/E |
| C2.04 | Project Schedule (baseline) | PM | ALL |
| C2.05 | Project Cost Estimate | PM | ALL |
| C2.06 | EHS Planning — asbestos survey if required | PM | S/E |
| C2.07 | Set Baselines for Scope, Budget & Schedule | PM | ALL |
| C2.08 | Full Funding (CERP) — present at Governance/Capital Committee | Program Manager / PM | ALL |
| C2.09 | Owner's Reserve — cost code 05-99-993100-00-00 | PM | S/E |
| C2.10 | Procure Design Consultants / Furniture Vendor — engage Legal for all redlines; NAMR/APAC >$10MM or EMEA/LATAM any value | PM | S/E |
| C2.11 | Change Status to "Design" | PM | S/E |
| C2.12 | Change Status to "Construction" (Light projects skip Design) | PM | L |

#### Phase C3 — Design (Corporate)
| Step | Task | Owner Role | Profile |
|---|---|---|---|
| C3.01 | Design Kick-Off Meeting — review design brief, guidelines, landlord obligations | Project Design Team | S/E |
| C3.02 | Concept Design | Project Design Team | S/E |
| C3.03 | Schematic Design — review cost/schedule/quality opportunities | Project Design Team | S/E |
| C3.04 | Design Guidelines Compliance Review | PM | S only |
| C3.05 | Design Exceptions Review | PM / Internal Design Team | S only |
| C3.06 | Design Development (~60% completion) — BIM model if required per EIR; Value Engineering | AoR | S/E |
| C3.07 | Plan Procurement of Furniture — mock-ups if new furniture type | PM | S/E |
| C3.08 | Create Construction Drawings — page turn sign-off with stakeholders; BIM coordination | AoR | S/E |
| C3.09 | Landlord Approval (if required) | PM | ALL |
| C3.10 | Procure GC and/or Vendors — PO threshold $50K; Legal engagement per threshold rules | PM | ALL |
| C3.11 | Apply for Permits — AoR/GC/Expeditor/PM using AHJ information; Sworn Document Procedure | AoR / GC / Expeditor / PM | S/E |
| C3.12 | GC Kick-Off Meeting — agree information flow, safety plans, access, vendor onboarding | GC | S/E |
| C3.13 | Review GC schedule, cost plan, long lead items, H&S methodology | PM | S/E |
| C3.14 | Constructability Review — identify cost/time savings opportunities | PM | S/E |
| C3.15 | Procurement of Long Lead Items | GC / Vendors / PM | S/E |
| C3.16 | Coordinate Start on Site (SOS) date — confirm with FM; confirm site ready | PM | ALL |
| C3.17 | Update Status to "Construction/Execution" | PM | S/E |
| C3.18 | Update Status (Light) | PM | L |

#### Phase C4 — Construction/Execution (Corporate)
| Step | Task | Owner Role | Profile |
|---|---|---|---|
| C4.01 | Contract Administration — FCA Change Order Process for all field changes | PM | ALL |
| C4.02 | Enterprise Change Management — notify business of any infrastructure-impacting activities | PM | ALL |
| C4.03 | Handover Site to GC/Vendor — coordinate LOB item removal | PM | S/E |
| C4.04 | Mobilization & Site Set-Up | GC / Vendor | S/E |
| C4.05 | Approval of Submittals — save in ACC Folder 9 | Project Design Team | S/E |
| C4.06 | Agree T&C and Training approach — GC proposes as line item in schedule | PM / GC / FM | S/E |
| C4.07 | Construction Activities — Structure, MEP & Fit-Out | GC | S/E |
| C4.08 | GTI/AV Coordination — scope/cost/schedule changes through Change Management | PM | S/E |
| C4.09 | Global Security Coordination | PM | S/E |
| C4.10 | Arts & History Coordination | PM | S/E |
| C4.11 | Amenities Coordination | PM | ALL |
| C4.12 | FF&E — coordinate installation (may omit if 3rd party engaged post-construction) | PM | ALL |
| C4.13 | Testing & Commissioning — prepare and issue asset registers | GC | S/E |
| C4.14 | Training — GC runs training sessions (FM on MEP systems) | GC | S/E |
| C4.15 | Punch List — site walkthrough; documented in PMWeb; NO "Day 2" items | GC / AoR / PM | ALL |
| C4.16 | Closeout of Punch List Items — exceptions noted in gateway documents | GC / AoR / PM | ALL |
| C4.17 | Permits & Approvals — upload CO copies to project folders | GC | S/E |
| C4.18 | Prepare for Closeout — begin financial reconciliation and document closeout | PM | S/E |
| C4.19 | Certificate of Practical/Substantial Completion — PM signs and issues to GC | PM | S/E |
| C4.20 | Change Status to "Handover" | PM | ALL |
| C4.21 | All Vendor Final Punch List & Defects Closeout | GC / PM / Vendors | S/E |
| C4.22 | Handover from GC/Vendor to FM — floor walks with LOB, GS, GT; D&C remains POC until punch list complete | GC / PM | S/E |
| C4.23 | Handover — submit Handover Checklist for approval | PM | L |
| C4.24 | Move In — Move Manager leads; PM supports | Move Manager | ALL |
| C4.25 | Change Status to "Closeout" | PM | ALL |

#### Phase C5 — Closeout (Corporate)
| Step | Task | Owner Role | Profile |
|---|---|---|---|
| C5.01 | Final Application for Payment — includes all Lien Waivers | GC | ALL |
| C5.02 | Closeout documentation in PMIS — upload to ACC Folder 9 or PMWeb Folder 10; verify Architectural As-Builts; verify BIM As-Built models | PM | ALL |
| C5.03 | Update Space Conditions (Tririga Property Portal) with renovation dates | PM | ALL |
| C5.04 | Financial Reconciliation — close all commitments | PM | ALL |
| C5.05 | Lessons Learned — hold workshops with all stakeholders; update central lessons learned site | PM | S/E |
| C5.06 | Move Project into Defect/Retention Period (if monies retained) | PM | S/E |
| C5.07 | Close Project in Systems — change status to "Closed" | PM | ALL |
| C5.08 | Warranty Walkthrough & Retention Release — release retained monies if no defects (11 months after Substantial Completion) | AoR / FM | S/E |

---

### 17.3 MANDATORY DOCUMENT ARTIFACTS — BY PHASE

The document hub must enforce these mandatory artifacts per project phase and profile. Missing mandatory documents should block stage gate advancement.

| Phase | Document | PMWeb/ACC Location | Profile |
|---|---|---|---|
| **Initiate** | Due Diligence Funding (CERP) | PMWeb Folder 01.05 - Budget Estimate | S/E |
| **Initiate** | Key Milestones | PMWeb Key Milestones | ALL |
| **Planning** | Early Warnings (Forecast Elements) | PMWeb (tracked Ph2–Ph4) | S/E |
| **Planning** | Scope Funding (CERP) | PMWeb Folder 01.05.01 | S/E |
| **Planning** | TFA (Transaction Funding Approval) | Spotlight; uploaded to PMWeb by PM | If applicable |
| **Planning** | Baseline Schedule | PMWeb Folder 09 - Schedules | ALL |
| **Planning** | Full Funding (CERP) | PMWeb Folder 01.05.02 - Final Funding | S/E |
| **Design** | Design Service Agreement | PMWeb Folder 02.01 | S/E |
| **Design** | Accessibility Design Requirements Checklist | ACC Folder 2 | S/E |
| **Design** | ADA AoR Certification Letter | PMWeb Folder 04 - Contract Administration | NAMR S/E |
| **Design** | Full Funding (CERP) final version | PMWeb Folder 01.05.02 | S/E |
| **Design** | Landlord Approval | PMWeb Folder 01.02.03 | If required |
| **Design** | Permits | PMWeb Folder 05.08 | S/E |
| **Design** | Bid Waiver (if applicable) | PMWeb Form | If applicable |
| **Construction** | Executed Contracts (POs, MSAs, Legal review email) | PMWeb Folder 04 | ALL |
| **Construction** | Approved Submittals | ACC Folder 9 > Submittals | S/E |
| **Construction** | Certificate of Substantial Completion / CO | PMWeb Folder 10.05 - Certificates | S/E |
| **Construction** | Project Progress Updates (meeting minutes, daily reports, monthly reports, progress photos) | PMWeb Folder 05 | ALL |
| **Closeout** | Final Application for Payment (lien waivers) | PMWeb Folder 11.02 - Vendor Invoices - Pay Apps | ALL |
| **Closeout** | Closeout Checklist | PMWeb Folder (Closeout Checklist) | ALL |
| **Closeout** | Space Conditions Form | Tririga | ALL |
| **Closeout** | Closeout Documentation (no financial info) | ACC Folder 9 AND PMWeb Folder 10 | ALL |
| **Closeout** | As-Built Drawings | ACC Folder 9 > As-Built 2D Drawings | ALL |

**Critical rule to enforce in app:** Financial documents (contracts, budgets, pay apps) are stored in PMWeb ONLY. No financial documents go into ACC. The app must enforce this separation in its folder structure.

---

### 17.4 FINANCIAL MODEL — CORPORATE-SPECIFIC

#### Budget Instruments (must be separate fields in the app)
| Instrument | Abbreviation | Definition | When Created |
|---|---|---|---|
| High Level Estimate | HLE | Initial cost estimate using benchmarking data | Initiate/Planning phase |
| Due Diligence CERP | CERP-DD | Funds for site investigation before full approval | Initiate phase |
| Scope Funding CERP | CERP-Scope | Partial funding approval for design phase | Planning phase |
| Full CERP | CERP-Full | Complete capital funding for entire project | Planning/Design phase |
| Supplemental CERP | CERP-Supp | Additional funding for scope changes or unforeseen | Construction phase |
| Owner's Reserve | — | JPMC-held contingency (cost code: 05-99-993100-00-00) | Planning phase (S/E) |
| TFA | TFA | Transaction Funding Approval (real estate transaction) | As applicable |
| ACR | ACR | Anticipated Cost Report — tracks budget, actual, and forecast | Ongoing |

#### Approval Thresholds (must be enforced as workflow rules)
| Threshold | Rule |
|---|---|
| Any contract redline | Legal engagement required (all regions) |
| NAMR/APAC contract > $10MM | Legal engagement required |
| EMEA/LATAM any contract value | Legal engagement required |
| GC commitment > $1MM | Performance bond required |
| Payment application > $250K | AoR/Engineer review required before payment |
| PO value > $50K | Elevated PO approval routing |
| BIR budget < $25K | PM approval only |
| BIR budget > $25K | CERP required |
| CO/Supplemental < $5K | Email approval through National PM |
| CO/Supplemental > $5K | Formal Business Case required |
| BAU Refresh > 15% over Bulk CERP | Project Charter Review by leadership |

#### Change Order Process — Corporate (FCA)
- In the app, corporate change orders are called **FCAs (Field Change Authorizations)**
- All FCAs must be approved BEFORE instructing contractor to proceed
- Enterprise Change Management notification required if FCA affects: electrical service, UPS systems, generators, cooling, fire protection, or data center raised floor
- A **Change Log** is a mandatory artifact maintained throughout Phase C4 (Construction)

---

### 17.5 CORPORATE KEY ROLES — FULL ROLE DIRECTORY

The Team Directory must include all of these roles as selectable options:

**D&C Internal Roles:**
- Project Manager (PjM) — project owner and team leader
- Project Coordinator / BOA (PC) — administrative; routes invoices, validates closeout
- Architecture Design & Engineering (AD&E) — design standards and compliance
- D&C Regional Lead — team identification, project profile validation
- Regional Program Manager — overall program management
- PMO — standardizes processes and risk controls
- Global Design Team (GDT) — workplace, design, FF&E guidance (S/E reviews)

**Client/Owner Roles:**
- Transaction Manager — due diligence, site selection, test fits
- Program Manager — requirements, stakeholder management
- Client Manager — LOB requirements, sponsorship
- Finance / CFO (Regional) — funding approval
- Move Manager — leads move-in (PM supports)
- Legal — contract T&C review

**External Roles:**
- Architect of Record (AoR) — design delivery, permit submissions, ADA certification
- General Contractor (GC) — construction execution, subcontractor management
- GSS (Global Supplier Sourcing) — procurement administration
- Expeditor — permit applications
- EHS Consultant — environmental, asbestos survey

**Partner/Technology Roles:**
- GTI (Global Technology Infrastructure) — technology SOW via SPM/ServiceNow
- GS (Global Security) — physical and technical security SOW
- FM (Facilities Management) — site acceptance, receives training, attends warranty walk
- AV (Audio Visual) — audio/visual coordination
- Amenities Services — amenities spaces SOW
- Arts & History — artwork and legacy branding

---

### 17.6 MILESTONES — AUTHORITATIVE DEFINITIONS

Replace the generic milestone names in the app with these D&C Playbook definitions:

| Milestone | Playbook Definition | Corporate SLA |
|---|---|---|
| Project Initiation (PIF) | Act of opening/initiating a project in PMWeb | Day 0 |
| Due Diligence Funding Approved | Pre-funding for site investigation activities | Before site visits |
| HLE Complete | High Level Estimate created using benchmarking data | Initiate phase |
| Full CERP Approved | Complete capital funding approved at Governance Committee | Planning phase |
| Baseline Set | Scope, Budget, and Schedule baselines locked | Planning phase |
| Design Kick-Off | Project design team briefed on requirements | Start of Design |
| 60% Design Development | Design Development complete; Value Engineering complete | Design phase |
| Page Turn Complete | Stakeholder sign-off on construction drawings | Before permit submission |
| Construction Drawings Complete | 90%/100% CDs signed off | Design phase |
| Landlord Approval Received | Landlord approves design (if required) | Before permit submission |
| Permit Submitted | AoR/GC/Expeditor submits to AHJ | Design phase |
| Permit Issued | AHJ issues permit | Before construction |
| GC Kick-Off Meeting | Contractor mobilization begins; information flow agreed | Start of Construction |
| Long Lead Items Ordered | All long lead items PO'd | Design/Early Construction |
| Start on Site (SOS) | Physical work begins | Construction phase |
| Submittals Approved | All submittals reviewed and approved in ACC Folder 9 | Construction phase |
| T&C Complete | Testing & Commissioning complete; asset registers issued | Late Construction |
| Training Complete | FM team trained on all MEP systems | Before Handover |
| Substantial Completion | AoR signs Certificate of Practical/Substantial Completion | Construction phase |
| Certificate of Occupancy | Final CO received from AHJ | After Substantial Completion |
| Punch List Complete | All punch list items closed; no exceptions | Handover |
| Handover | GC/Vendor hands over to FM; floor walks complete | 0 days after Substantial Completion |
| Move In | End users move in; Move Manager leads | Handover + move schedule |
| Financial Reconciliation Complete | All commitments closed; final invoices paid | Closeout |
| Lessons Learned Complete | Workshop held; documented to central site | Closeout (S/E) |
| As-Builts Uploaded | As-Built drawings in ACC Folder 9 | Closeout |
| Space Conditions Updated | Tririga Property Portal updated with renovation dates | Closeout |
| Project Closed | Status 08 — 100% financially reconciled | After Closeout |
| Warranty Walk | 11 months after Substantial Completion | 11 months |
| Retention Released | Retained monies released if no defects at Warranty Walk | After Warranty Walk |

---

### 17.7 COMPLIANCE & STANDARDS TRACKING

The app must track compliance status for each of these requirements per project:

#### ADA Compliance
- [ ] Accessibility Design Requirements Checklist (reviewed with Global Design Team — S/E)
- [ ] ADA AoR Certification Letter (NAMR only; in PMWeb Folder 04)
- [ ] Path of Travel compliance confirmed
- **Rule:** Project CANNOT close without ADA Certification Letter

#### LEED / Sustainability
- [ ] Sustainability Checklist (required for ALL corporate projects for data tracking)
- [ ] LEED Certification target confirmed (S/E)
- [ ] Zero Carbon feasibility evaluated (S/E)
- [ ] BIM required flag (if project > 10,000 SF)

#### BIM Requirements
- [ ] BIM Exchange Information Requirements (EIR) reviewed and agreed
- [ ] BIM model built adherent to EIR during Design Development
- [ ] BIM As-Built models verified and uploaded to ACC Folder 9 at closeout
- **Rule:** BIM is mandatory for all projects > 10,000 SF

#### Permits & AHJ
- [ ] AHJ (Authority Having Jurisdiction) identified and documented
- [ ] Sworn Document Procedure completed (if applicable)
- [ ] Permit submitted date logged
- [ ] Permit issued date logged
- [ ] Permit closure evidence uploaded (PMWeb)
- [ ] Certificate of Occupancy obtained

#### H&S (Health & Safety)
- [ ] GC H&S plan reviewed at Pre-Construction Meeting
- [ ] Asbestos survey completed (if required — S/E via EHS)
- [ ] Environmental review performed (if required)

#### Lien Waivers (NAMR Projects)
- [ ] Lien waivers collected from all vendors before final payment
- [ ] Lien waivers attached to Final Application for Payment (PMWeb Folder 11.02)
- **Rule:** Project CANNOT close without all lien waivers collected

#### Retainage
- [ ] Retainage % defined in GC contract
- [ ] Retainage amount tracked as a budget line
- [ ] Retainage release approved at Warranty Walk (if no defects)
- [ ] Retention released and final payment processed

---

### 17.8 REPORTING CADENCE — CORPORATE

The app must support or generate these reports on this schedule:

| Report | Owner | Frequency | Where |
|---|---|---|---|
| Project Progress Updates | PM | All construction phases | PMWeb Folder 05 |
| Construction Meeting Notes | PM | Weekly (or as agreed) | PMWeb Folder 05 |
| Early Warnings (Forecast Elements) | PM | Ongoing (Ph2–Ph4) | PMWeb |
| Monthly Progress Reports | PM | Monthly | PMWeb Folder 05 |
| Progress Photos | PM / GC | Throughout construction | PMWeb Folder 05 |
| PDR (Project Delivery Report) | PM | 14 days after opening | PMWeb + email to stakeholders |
| Lessons Learned Report | PM | At Closeout | Central Lessons Learned site |
| Warranty Walk Report | PM / FM | 11 months after Substantial Completion | PMWeb |
| Warranty Walk Reminder | PM | 1 month before walk | Email to MDC and Team Lead |

---

### 17.9 PLAYBOOK-SPECIFIC DATABASE ADDITIONS

Add these fields/tables to the schema in Section 4:

```sql
-- CORPORATE PROJECT PROFILE (add to projects table)
ALTER TABLE projects ADD COLUMN profile text;  -- 'L' | 'S' | 'E'
ALTER TABLE projects ADD COLUMN sub_type text; -- 'Corporate' | 'Data Center'
ALTER TABLE projects ADD COLUMN bim_required boolean DEFAULT false;
ALTER TABLE projects ADD COLUMN leed_required boolean DEFAULT false;
ALTER TABLE projects ADD COLUMN sustainability_checklist_complete boolean DEFAULT false;
ALTER TABLE projects ADD COLUMN ada_certificate_received boolean DEFAULT false;
ALTER TABLE projects ADD COLUMN lien_waivers_complete boolean DEFAULT false;
ALTER TABLE projects ADD COLUMN aor_certificate_received boolean DEFAULT false;

-- CERP FUNDING INSTRUMENTS (separate from general budget)
cerp_funding
  id uuid PRIMARY KEY
  project_id uuid REFERENCES projects
  type text  -- 'due_diligence' | 'scope' | 'full' | 'supplemental' | 'owner_reserve'
  cerp_number text
  amount numeric
  status text  -- 'requested' | 'in_review' | 'approved' | 'rejected'
  submitted_date date
  approved_date date
  approved_by text
  cost_code text  -- e.g., '05-99-993100-00-00' for Owner's Reserve
  notes text
  created_at timestamptz

-- EARLY WARNINGS / FORECAST ELEMENTS (corporate risk tracking)
early_warnings
  id uuid PRIMARY KEY
  project_id uuid REFERENCES projects
  title text
  description text
  category text  -- 'Schedule' | 'Budget' | 'Scope' | 'Design' | 'Vendor' | 'Permit'
  source text    -- 'Assumption' | 'Risk' | 'Issue' | 'Dependency'
  probability text  -- 'Low' | 'Medium' | 'High'
  impact text       -- 'Low' | 'Medium' | 'High' | 'Critical'
  mitigation text
  status text   -- 'open' | 'monitoring' | 'realized' | 'closed'
  phase_identified text  -- 'Planning' | 'Design' | 'Construction'
  owner_id uuid REFERENCES users
  created_at timestamptz
  last_reviewed_at timestamptz

-- FCA (FIELD CHANGE AUTHORIZATIONS — corporate change orders)
fcas
  id uuid PRIMARY KEY
  project_id uuid REFERENCES projects
  fca_number text   -- auto-incremented
  description text
  requested_by text
  amount numeric
  reason_code text  -- 'Scope Change' | 'Unforeseen Condition' | 'Owner Request' | 'Design Change' | 'Regulatory'
  requires_enterprise_change_mgmt boolean DEFAULT false  -- if it affects infrastructure
  enterprise_change_mgmt_ticket text  -- ServiceNow ticket number
  status text  -- 'pending' | 'approved' | 'rejected'
  approved_by uuid REFERENCES users
  approved_at timestamptz
  budget_line_item_id uuid REFERENCES budget_line_items
  document_id uuid REFERENCES documents
  notes text
  created_at timestamptz

-- COMPLIANCE TRACKING (ADA, LEED, BIM, Lien Waivers, Retainage)
compliance_items
  id uuid PRIMARY KEY
  project_id uuid REFERENCES projects
  category text  -- 'ADA' | 'LEED' | 'BIM' | 'Lien Waiver' | 'Retainage' | 'H&S' | 'Permit'
  item text      -- specific requirement
  is_required boolean DEFAULT true
  is_complete boolean DEFAULT false
  completed_at timestamptz
  completed_by uuid REFERENCES users
  document_id uuid REFERENCES documents
  notes text

-- RETAINAGE TRACKING (per vendor contract)
retainage
  id uuid PRIMARY KEY
  project_id uuid REFERENCES projects
  budget_line_item_id uuid REFERENCES budget_line_items
  vendor_name text
  contract_amount numeric
  retainage_percentage numeric  -- e.g., 10.0 = 10%
  retainage_amount numeric      -- calculated
  status text  -- 'held' | 'released' | 'partial_release'
  released_amount numeric DEFAULT 0
  release_date date
  warranty_walk_approved boolean DEFAULT false
  notes text

-- PERFORMANCE BONDS
performance_bonds
  id uuid PRIMARY KEY
  project_id uuid REFERENCES projects
  vendor_name text
  contract_amount numeric
  bond_required boolean DEFAULT false  -- true if contract > $1MM
  bond_number text
  bond_amount numeric
  bond_company text
  received_date date
  expiry_date date

-- AHJ (AUTHORITY HAVING JURISDICTION) per project
ahj_records
  id uuid PRIMARY KEY
  project_id uuid REFERENCES projects
  jurisdiction_name text   -- e.g., "City of Fort Lauderdale", "Broward County"
  jurisdiction_type text   -- 'City' | 'County' | 'Fire Marshal' | 'State'
  permit_type text
  expeditor_name text
  permit_submitted_date date
  permit_issued_date date
  sworn_document_required boolean DEFAULT false
  sworn_document_submitted boolean DEFAULT false
  notes text

-- LEGAL ENGAGEMENT TRACKING
legal_reviews
  id uuid PRIMARY KEY
  project_id uuid REFERENCES projects
  contract_name text
  vendor_name text
  contract_value numeric
  region text  -- 'NAMR' | 'APAC' | 'EMEA' | 'LATAM'
  legal_required boolean  -- auto-calculated based on thresholds
  legal_required_reason text  -- 'NAMR/APAC >$10MM' | 'EMEA/LATAM any value' | 'T&C redline'
  legal_engaged_date date
  legal_approved_date date
  status text  -- 'not_required' | 'pending' | 'in_review' | 'approved'
  notes text

-- WARRANTY TRACKING
warranties
  id uuid PRIMARY KEY
  project_id uuid REFERENCES projects
  vendor_name text
  trade text
  warranty_period_months integer
  start_date date   -- = Substantial Completion date
  end_date date     -- calculated
  warranty_walk_date date  -- = start_date + 11 months
  warranty_walk_reminder_sent boolean DEFAULT false
  defects_found text
  retention_released boolean DEFAULT false
  document_id uuid REFERENCES documents  -- warranty certificate
```

---

### 17.10 GTI / TECHNOLOGY ENGAGEMENT WORKFLOW

The app must support the GTI engagement process:

- [ ] GTI engaged via **SPM (ServiceNow)** demand request — app generates the demand request template
- [ ] GTI provides: Technology SOW, switchport availability, IP assignment, JPMC-approved cable vendor name
- [ ] Enterprise Change Management required for ANY activity affecting:
  - UPS systems
  - Generator availability
  - Electrical service
  - Cooling systems
  - Fire protection
  - Data center raised floor
- [ ] MER (Mechanical & Electrical Room) and TR (Telecom Room) access requires **Smart Access request**
- [ ] AV (Audio Visual) engaged as a Chase Partner in Design and Construction phases
- [ ] All GTI scope/cost/schedule changes must go through Change Management (not just a verbal approval)
- [ ] BIM required for projects >10,000 SF — flag set on project creation

**App feature:** When PM ticks "Construction activities affecting MER/TR or infrastructure systems", the app auto-creates a task: "Submit Enterprise Change Management notification" and "Request Smart Access for MER/TR" — both tagged as blocking tasks.

---

### 17.11 PUNCH LIST RULES (CRITICAL)

The playbook is explicit about punch list rules. These must be enforced in the app:

1. **No "Day 2" items on the punch list.** Any new work discovered after Substantial Completion that was NOT in the original scope must be raised as a NEW project — not added to the punch list. App must warn the PM if a punch list item looks like new scope.
2. Punch list documented during site walkthrough with: GC, PM, FM, AoR, LOB representatives
3. D&C PM remains Point of Contact (POC) for LOB until ALL punch list items are closed — even after Handover
4. Exceptions to punch list completion must be noted in the gateway documents
5. Punch list = completion evidence for Stage Gate advancement to Closeout

---

### 17.12 DESIGN EXCEPTION PROCESS

For projects where the design deviates from JPMC Design Guidelines:

- [ ] Design Exceptions Review performed by PM and Internal Design Team (S only)
- [ ] Exceptions documented with justification
- [ ] Design exceptions approved before proceeding with Construction Drawings
- App should track design exceptions as a sub-type of document with approval workflow

---

### 17.13 TEST FIT RULES

The playbook specifies strict limits on test fits — the app must enforce:
- Maximum **1 test fit per site** (C1.06)
- Maximum **3 test fits per project** across all sites (C2.03)
- Test fits cannot be changed without written justification once set in Planning (C2.03)
- App tracks test fit count per project and per site; alerts PM when approaching limits

---

### 17.14 KEY TERMS GLOSSARY — ENCODE IN APP

All of these terms should appear as contextual definitions, dropdown options, and field labels throughout the app (not generic PM terms):

| App Context | Use Playbook Term (not generic) |
|---|---|
| Change Order (Corporate) | FCA (Field Change Authorization) |
| Risk Register (Corporate) | Early Warnings / Forecast Elements |
| Project Initiation | PIF (Project Initiation Form / Project creation) |
| Budget Approval | CERP (Capital Expenditure Request Package) |
| Initial estimate | HLE (High Level Estimate) |
| Financial tracking report | ACR (Anticipated Cost Report) |
| Contingency held by owner | Owner's Reserve (cost code 05-99-993100-00-00) |
| Permit jurisdiction | AHJ (Authority Having Jurisdiction) |
| Technology engagement | GTI via SPM (ServiceNow) |
| Site handover date | Start on Site (SOS) |
| Warranty period start | 11 months after Substantial Completion |
| Post-project report | PDR (Project Delivery Report) |
| Design document storage | ACC Folder 9 (Closeout) |
| Financial document storage | PMWeb (NEVER in ACC) |
| Contract framework | MSA (Master Service Agreement) |

---

### 17.15 SYSTEM INTEGRATIONS — PLAYBOOK IDENTIFIED

The playbook identifies these systems the app must integrate with (added to Phase 7 roadmap):

| System | Purpose | Priority |
|---|---|---|
| PMWeb | Primary PMIS — budget, POs, invoices, approvals, milestone tracking, documents | HIGH — Phase 7 |
| ACC (Autodesk Construction Cloud) | Design document storage; Folder 9 for submittals and as-builts | HIGH — Phase 7 |
| SAP | Fund loading, PO management, invoicing, financial reconciliation | HIGH — Phase 7 |
| Tririga | Property management; Space Conditions form; location status updates | MEDIUM — Phase 7 |
| ServiceNow / SPM | GTI engagement; demand requests | MEDIUM — Phase 7 |
| Optima | CERP business case submission | MEDIUM — Phase 7 |
| Spotlight | TFA uploads, Signage Asset Books | LOW |
| Space Management Portal | CAD/As-Built drawing submissions | LOW |
| Quickbase / PPT | Project creation and initiation | MEDIUM |
| Prism | Signage work order management | LOW |

---

*Version 2.2 — Updated March 2026 with D&C Playbook (v12, Jan 2026) corporate project knowledge.*
*91-page playbook fully analyzed. Corporate phases, tasks, thresholds, roles, compliance requirements, and terminology encoded.*

---

## 18. STANDARD PROJECT SCHEDULE TEMPLATE — DERIVED FROM ACTUAL PROJECT

*Source: SO09897 — 411 S County Rd Palm Beach, JPMA Suite. Standard corporate project.*
*This is a real schedule used as the authoritative template baseline for all Standard corporate projects.*
*136 tasks, 13 phases, ~120-week total duration.*

This section defines the default schedule template the app generates when a PM creates a Standard corporate project. The AI schedule generator uses these durations and sequences as its baseline, then adjusts based on project-specific inputs (SF, location, AHJ complexity, delivery method).

---

### 18.1 PHASE STRUCTURE AND DEFAULT DURATIONS

The following phases and durations are the default Standard template. The app pre-populates these when a Standard project is created.

| # | Phase Name | Default Duration | Notes |
|---|---|---|---|
| 1 | Initiation / Programming | 1 day | Project Initiated milestone |
| 2 | Programming and Design | 3.4 wks | Requirements, leadership approval, scope agreement |
| 3 | CERP Funding | 10.4 wks (core) + 21-day PMWeb gate | Runs parallel with RFP; approval adds ~21 days |
| 4 | RFP — A&E Design | 30.6 wks | Full competitive A&E procurement |
| 5 | A&E Design | 32.8 wks | AoR onboarding through 100% CDs |
| — | ↳ Concept / Test Fit Design | 6.8 wks | Test fits + GDT approval |
| — | ↳ Schematic Design | 6.6 wks | 7 parallel deliverables + GDT approval |
| — | ↳ Design Development | 8.2 wks | 10 parallel deliverables + GDT approval |
| — | ↳ Construction Documents | 10.6 wks | 4 parallel deliverables + CD review + 100% issue |
| 6 | GC RFP | 13.8 wks | Starts parallel with CD phase (based on DD/I-GMP) |
| 7 | Permitting | 13 wks | 60-day expedited permit + pickup |
| 8 | Long Lead Items | 36.4 wks | Furniture 30 wks; AV 25 wks; GC Materials 30 wks; Café 25 wks |
| 9 | Pre-Construction | 1 day | Pre-construction checklist, scope review, MOP |
| 10 | Construction | 44.2 wks | Mobilize/Demo + 35 wks construction + closeout prep |
| 11 | Occupancy | 8.8 wks | CO, Handover, Move-in, Go Live |
| 12 | Close Out | 18 wks | As-Builts, Lessons Learned, Financial Reconciliation |

**Total Standard project duration (Initiation to Closeout Checklist): ~118–120 weeks (approx. 2 years 9 months)**

---

### 18.2 COMPLETE TASK TEMPLATE — ALL 136 TASKS

The Gantt module pre-loads these tasks when a Standard project is created. PMs edit dates, remove inapplicable tasks, and add project-specific items.

#### PHASE 1: Initiation / Programming
| Task | Default Duration | Owner |
|---|---|---|
| Project Initiated | 1 day | PM |

#### PHASE 2: Programming and Design
| Task | Default Duration | Owner |
|---|---|---|
| Project Profile | 2 days | PM |
| Due Diligence and Programming | 2 days | PM / Transaction Manager |
| Requirements Documentation Approved | 5 days | PM |
| Leadership Review Approval | 10 days | Leadership (Rina / Anna) |
| Program Stakeholder Intake Call / Program Requirements / Property Mgmt. / Bldg. Resiliency | 1 day | PM |
| Scope Agreement | 10 days | PM |

#### PHASE 3: CERP Funding (runs parallel with RFP phases)
| Task | Default Duration | Owner |
|---|---|---|
| Develop CERP / PMO Review | 4 days | PM / PMO |
| Governance Review | 1 day | Governance Committee |
| Regional Review *(0-day milestone)* | 0 days | Regional Lead |
| Steerco Review | 1 day | SteerCo |
| PMWeb Funding Approval | **21 days** | Finance / PMWeb |

#### PHASE 4: RFP — A&E Design
| Task | Default Duration | Owner |
|---|---|---|
| Procurement Strategy Plan (Submittal and Approval) | 10 days | PM / GSS |
| Architect List (Submittal / Review and Approval) | 5 days | PM / AD&E |
| A&E Bid Package (Submittal / Approval) | 5 days | PM |
| Supplier Review Bids | 5 days | PM / GSS |
| Bid Walk Thru | 1 day | PM |
| RFI Submissions | 1 day | Architects |
| RFI Responses | 2 days | PM |
| Suppliers Finalize Bids | 5 days | Architects |
| Bids Due | 1 day | All Architects |
| Supplier Interviews | 5 days | PM / AD&E |
| BAFO Due | 2 days | Selected Architects |
| Bid Level | 3 days | PM / GSS |
| Letter of Recommendation / Review / Approval | 5 days | PM |
| Draft Contract | 1 day | Legal / PM |
| Route Contract / Approval | **13 days** | Legal |
| Contract PO | 2 days | PC / PM |

#### PHASE 5: A&E Design
| Task | Default Duration | Owner |
|---|---|---|
| Preliminary A&E / Review Schedule / Set up Recurring Meetings | 2 days | PM / AoR |
| AoR Onboarding — Schedule, Budget, Journey | 3 days | PM / AoR |
| **Concept / Test Fit Design** | | |
| Design Workplan | 1 day | AoR |
| Test Fits / Concept Floor Plan | **30 days** | AoR |
| Mood Board | 1 day | AoR / GDT |
| Test Fits Approval — GDT | 1 day | GDT |
| Test Fits Awareness — LOB | 3 days | PM / LOB |
| **Schematic Design** (all run parallel, 30 days each) | | |
| Accessibility Scope Checklist | 30 days | AoR |
| Acoustic Space Assignment | 30 days | AoR / MEP Engineer |
| Partition Plan | 30 days | AoR |
| Furniture Plan | 30 days | AoR / GDT |
| Ceiling and Lighting Plan | 30 days | AoR / MEP |
| Preliminary Colors & Materials | 30 days | AoR / GDT |
| Preliminary Engineering | 30 days | MEP Engineer |
| Schematic Budget Review | 1 day | PM |
| Schematic Design Approval — GDT | 2 days | GDT |
| **Design Development** (all run parallel, 35 days each) | | |
| Finish Plan | 35 days | AoR / GDT |
| Furniture & Fabric Selections | 35 days | AoR / GDT |
| AV Elevations | 35 days | AoR / AV |
| Café, Wellness & Pantry Elevations | 35 days | AoR |
| Signage & Wayfinding | 35 days | AoR / Signage |
| Branding / Environmental Graphics | 35 days | AoR / GDT |
| Accessibility Technical Checklist Review | 35 days | AoR |
| Sound Masking Assessment | 35 days | AoR / MEP |
| Occupancy Sensor Design | 35 days | AoR / GTI |
| Sensory Enhancement | 35 days | AoR / GDT |
| GDT Design Approval | 1 day | GDT |
| LOB Awareness | 2 days | PM / LOB |
| **Construction Documents** (all run parallel, 35 days each) | | |
| Architectural Plans | 35 days | AoR |
| Engineering Plans | 35 days | MEP Engineer |
| Architectural Elevations / Sections / Details / Schedules | 35 days | AoR |
| Furniture Specifications | 35 days | AoR / GDT |
| CD Review — Property Mgmt. / Eng / Tel Data / AV / Facilities | 10 days | PM + reviewers |
| Incorporate Final Client Comments | 7 days | AoR |
| 100% CD Issue *(milestone)* | 1 day | AoR |

#### PHASE 6: GC RFP *(starts parallel with CD phase — based on DD/I-GMP)*
| Task | Default Duration | Owner |
|---|---|---|
| GC Bid Package Submittal (based on DD / I-GMP) | 5 days | PM |
| Supplier Review Bids | **15 days** | PM / GSS |
| Bid Walk Thru | 1 day | PM / GC candidates |
| RFI Submissions | 2 days | GC candidates |
| RFI Responses | 2 days | PM / AoR |
| Suppliers Finalize Bids | 12 days | GC candidates |
| Bids Due | 1 day | All GCs |
| Supplier Interviews | 5 days | PM / GSS |
| BAFO Due | 1 day | Selected GCs |
| Bid Level | 5 days | PM / GSS |
| Letter of Recommendation / Approval | 5 days | PM |
| Draft Contract | 2 days | Legal / PM |
| Route Contract | **12 days** | Legal |
| Contract PO | 1 day | PC / PM |

#### PHASE 7: Permitting *(starts after 100% CD Issue)*
| Task | Default Duration | Owner |
|---|---|---|
| Expedite Building Permit | **60 days** | Expeditor / AoR / GC |
| Permit Approval / Payment / Pickup | 5 days | PM / Expeditor |

#### PHASE 8: Long Lead Items *(starts parallel with GC RFP and before GC contract is signed)*
| Task | Default Duration | Owner |
|---|---|---|
| Furniture | **30 weeks** | PM / GC |
| AV Equipment | **25 weeks** | PM / AV Vendor |
| GC Materials | **30 weeks** | GC |
| Café Equipment | **25 weeks** | PM |

#### PHASE 9: Pre-Construction
| Task | Default Duration | Owner |
|---|---|---|
| Pre-Construction Checklist / Review Scope / Building Rules / MOP | 1 day | PM / GC |

#### PHASE 10: Construction
| Task | Default Duration | Owner |
|---|---|---|
| Mobilize / Demo (Safe Off / Flooring / Ceiling / Misc.) | 2 days | GC |
| Construction (Elec / Cable / Paint / Flooring / MER Readiness / Ceiling / Walls / Sensors / Security / Mechanical / Factory Startup / T&C) | **35 weeks** | GC |
| Security Equipment Delivery & Install / T&C | 25 days | Security Vendor |
| *MER Sub-Track:* | | |
| MER Shell Ready *(milestone)* | 1 day | GC / PM |
| Carrier Survey | 10 days | Carrier |
| Carrier Fiber Pull | 10 days | Carrier |
| MER Room Ready *(milestone)* | 1 day | GC / PM |
| Permanent Power / Factory Startup / T&C (UPS / Splits / Albireo) | 5 days | GC / FM |
| MER Handover to GTI *(milestone)* | 1 day | PM / GTI |
| Carry Equipment Install | 5 days | GTI |
| GTI Rack and Stack Equipment | 5 days | GTI |
| GTI Burn In (Carrier and Network) | 10 days | GTI |
| Security on Line | 6 days | Security Vendor |
| MER Production Ready *(milestone)* | 1 day | GTI / PM |
| *Installation Sub-Track:* | | |
| Furniture Delivery & Install / Accessories / Silk Plants | 20 days | Furniture Vendor |
| Desktop Delivery & Install | 10 days | GTI / IT |
| AV Equipment Delivery & Install / T&C | 25 days | AV Vendor |
| Signage / Branding / Artwork | 5 days | Signage / Arts |
| Amenities Surface Equipment Delivery / Install | 5 days | Amenities |
| Inspections | **30 days** | GC / PM / AoR |
| Punchlist / Reinspection | 10 days | GC / AoR / PM |
| Substantial Completion *(milestone)* | 1 day | AoR / PM |

#### PHASE 11: Occupancy
| Task | Default Duration | Owner |
|---|---|---|
| Building 360 Updates / Milestone Updates | 5 days | PM |
| Final Substantial Completion *(milestone)* | 1 day | PM / AoR |
| Go Live *(milestone — precedes Substantial Completion)* | 1 day | LOB / PM |
| Certificate of Occupancy / Completion | 2 days | GC / PM |
| Handover | 1 day | PM / GC |
| Relocate (from previous space) | 1 day | Move Manager |
| Final Building Handover / Property Mgmt. Acceptance / Milestone Updated / All Moves Complete | 1 day | PM / Property Mgmt. |
| Handover Checklist | 1 day | PM |

#### PHASE 12: Close Out
| Task | Default Duration | Owner |
|---|---|---|
| As-Built / Warranty / Maintenance Info | 65 days | GC / AoR / PM |
| Lessons Learned | 1 day | PM |
| Documentation Uploaded in PMWeb | 10 days | PM |
| Final Invoices Reconciled | **89 days** | PC / PM |
| Closeout Checklist | 1 day | PM |

---

### 18.3 KEY DURATION BENCHMARKS (AI SCHEDULE GENERATOR DEFAULTS)

These durations become the AI's starting assumptions when generating a schedule. The AI adjusts these based on project-specific variables (AHJ complexity, SF, delivery method, market).

| Activity | Default Duration | Adjust If... |
|---|---|---|
| PMWeb Funding Approval | **21 days** | Never reduce — this is a governance SLA |
| Expedited Building Permit | **60 days** | +30 days if complex AHJ; +15 days if large SF; -0 (can't reduce) |
| Main Construction | **35 weeks** | +4 wks per 5,000 SF above 7,000 SF baseline |
| Financial Reconciliation | **89 days** | +30 days if >10 vendors |
| Furniture Lead Time | **30 weeks** | +6 wks if custom/new furniture type |
| AV Equipment Lead Time | **25 weeks** | +4 wks if large AV scope |
| A&E Contract Routing | **13 days** | +5 days if Legal redlines required |
| GC Contract Routing | **12 days** | +5 days if Legal redlines required |
| Test Fits / Concept Floor Plan | **30 days** | Fixed |
| Schematic Design deliverables | **30 days** (parallel) | Fixed |
| Design Development deliverables | **35 days** (parallel) | +7 days if BIM required |
| Construction Documents | **35 days** (parallel) | +7 days if BIM coordination |
| CD Review | **10 days** | +5 days if >10 reviewers |
| Incorporate Final Comments | **7 days** | Fixed |
| GTI Burn In | **10 days** | Fixed — GTI SLA |
| Punchlist / Reinspection | **10 days** | +5 days if large SF |
| Inspections | **30 days** | Varies by AHJ; default 30 |

---

### 18.4 PARALLEL TRACK RULES (CRITICAL SCHEDULING LOGIC)

The app's schedule engine must know these parallel track rules:

**Rule 1: GC RFP starts parallel with CD production, not after.**
GC Bid Package is issued based on Design Development documents (I-GMP strategy) — NOT 100% CDs. This saves ~14 weeks on the overall schedule. Do not sequence GC RFP after 100% CD Issue.

**Rule 2: Long Lead Items procurement starts before GC contract is executed.**
Furniture and AV Equipment orders begin while GC is still in contract routing. The PM has pre-authorization (or uses a separate PO) to order long lead items early. Do not sequence Long Lead Items after GC Contract PO.

**Rule 3: CERP Funding runs parallel with the A&E RFP.**
These are independent tracks. CERP development and approval does not block A&E procurement and does not block A&E design start (though full funding must be confirmed before construction contracts are signed).

**Rule 4: All design deliverables within a sub-phase are parallel.**
- All 7 Schematic Design tasks run simultaneously (30 days each)
- All 10 Design Development tasks run simultaneously (35 days each)
- All 4 Construction Document tasks run simultaneously (35 days each)
The gate at the end of each sub-phase (GDT Approval, 100% CD Issue) depends on ALL parallel tasks completing.

**Rule 5: MER sub-track runs inside the Construction phase but on its own dependency chain.**
MER Shell Ready → Carrier Survey → Carrier Fiber Pull → MER Room Ready → MER Handover to GTI → GTI Rack & Stack + Carry Equipment Install (parallel) → GTI Burn In → Security on Line → MER Production Ready
This track must complete before Go Live. It is the most technically critical sub-track and often the source of schedule delays.

**Rule 6: Occupancy phase starts while Construction is still active.**
Building 360 Updates, Final Substantial Completion, and Go Live occur while Punchlist / Reinspection is still in progress. This overlap is intentional — operational go-live precedes formal construction Substantial Completion by ~2 weeks.

**Rule 7: Go Live precedes Substantial Completion.**
Go Live (operational) occurs approximately 2 weeks before formal Substantial Completion (contractual). The app must model these as separate milestones with different owners.

---

### 18.5 PROCUREMENT SEQUENCE TEMPLATES

The bidding module must implement these exact sequences as templates for A&E and GC procurement:

**A&E Procurement Sequence:**
```
Procurement Strategy Plan (10 days)
  → Architect List Review / Approval (5 days)
    → A&E Bid Package Submittal / Approval (5 days)
      → Supplier Review Bids (5 days)
        → Bid Walk Thru (1 day)
          → RFI Submissions (1 day)
            → RFI Responses (2 days)
              → Suppliers Finalize Bids (5 days)
                → Bids Due (1 day)
                  → Supplier Interviews (5 days)
                    → BAFO Due (2 days)
                      → Bid Level (3 days)
                        → Letter of Recommendation / Review / Approval (5 days)
                          → Draft Contract (1 day)
                            → Route Contract / Approval (13 days)
                              → Contract PO (2 days)
Total A&E Procurement: ~30 weeks (includes lead time)
```

**GC Procurement Sequence (I-GMP strategy off DD documents):**
```
GC Bid Package Submittal — based on DD / I-GMP (5 days)
  → Supplier Review Bids (15 days)
    → Bid Walk Thru (1 day)
      → RFI Submissions (2 days)
        → RFI Responses (2 days)
          → Suppliers Finalize Bids (12 days)
            → Bids Due (1 day)
              → Supplier Interviews (5 days)
                → BAFO Due (1 day)
                  → Bid Level (5 days)
                    → Letter of Recommendation / Approval (5 days)
                      → Draft Contract (2 days)
                        → Route Contract (12 days)
                          → Contract PO (1 day)
Total GC Procurement: ~14 weeks
```

**Note on GC Bid Strategy:** The schedule shows the GC RFP is issued **"based off of DD / I-GMP"** (Indicative GMP). This means:
- GC is procured based on Design Development documents, not 100% CDs
- The GC provides an Indicative GMP (not a final GMP) at award
- GC GMP is finalized after 100% CDs are issued
- The app's procurement module must support this I-GMP workflow, not just a fixed-price bid model

---

### 18.6 MER SUB-TRACK — FULL DEPENDENCY CHAIN

This sub-track is the most complex technical dependency chain in the construction phase. It must be modeled explicitly in the Gantt:

```
MER Shell Ready (milestone — GC delivers empty room with power)
  └→ Carrier Survey (10 days — Carrier/Telecom)
       └→ Carrier Fiber Pull (10 days — Carrier)
            └→ MER Room Ready (milestone — room complete, MEP commissioned)
                 ├→ Permanent Power / Factory Startup / T&C — UPS, Splits, Albireo (5 days — GC/FM)
                 └→ MER Handover to GTI (milestone — GTI takes possession)
                      ├→ Carry Equipment Install (5 days — GTI, parallel)
                      └→ GTI Rack and Stack Equipment (5 days — GTI, parallel)
                           └→ GTI Burn In — Carrier and Network (10 days — GTI)
                                └→ Security on Line (6 days — Security Vendor)
                                     └→ MER Production Ready (milestone)
```

**App behavior:**
- These tasks auto-generate when a project has an MER (set at project creation)
- MER Shell Ready feeds into the overall Handover milestone chain
- GTI Burn In is a hard dependency — no Go Live until GTI Burn In passes
- MER Production Ready is a prerequisite for Go Live

---

### 18.7 APPROVAL GATE SEQUENCES AND NAMED APPROVERS

The app must track these specific approval sequences with named approvers:

| Gate | Approver | Default Duration | Blocking? |
|---|---|---|---|
| Requirements Documentation Approved | Leadership (Rina/Anna equivalent) | 5 days | Yes — blocks Procurement Strategy |
| Leadership Review Approval | Named leadership sponsors | 10 days | Yes — runs parallel, must complete before CERP |
| Scope Agreement | PM + Stakeholders | 10 days | Yes — blocks CERP development |
| Regional Review | Regional Lead | 0 days (milestone) | Yes — blocks Steerco |
| Steerco Review | SteerCo | 1 day | Yes — blocks PMWeb Funding |
| PMWeb Funding Approval | Finance / PMWeb system | 21 days | Yes — blocks construction contracts |
| Test Fits Approval | GDT | 1 day | Yes — blocks Schematic Design |
| Test Fits Awareness | LOB | 3 days | Notification (not blocking) |
| Schematic Design Approval | GDT | 2 days | Yes — blocks Design Development |
| GDT Design Approval | GDT | 1 day | Yes — blocks Construction Documents |
| LOB Awareness | LOB | 2 days | Notification (not blocking) |
| CD Review (stakeholder round) | Property Mgmt. / Eng / Tel Data / AV / Facilities | 10 days | Yes — blocks Final Comments |
| 100% CD Issue | AoR | 1 day | Yes — blocks Permit submission |
| Letter of Recommendation (A&E) | PM + Leadership | 5 days | Yes — blocks Contract |
| Letter of Recommendation (GC) | PM + Leadership | 5 days | Yes — blocks Contract |
| Contract Routing / Legal Approval | Legal | 12–13 days | Yes — blocks Contract PO |
| Permit Approval / Pickup | AHJ | (included in 60-day permit) | Yes — blocks Construction Start |
| Substantial Completion sign-off | AoR | 1 day | Yes — blocks CO / Handover |
| Final Building Handover / Property Mgmt. Acceptance | Property Management | 1 day | Yes — blocks Closeout |
| Closeout Checklist | PM | 1 day | Yes — project cannot close without this |

---

### 18.8 SCHEDULING RULES DERIVED FROM THIS SCHEDULE

The following rules must be encoded into the AI schedule generator and schedule validation engine:

1. **A&E RFP must start before CERP is fully approved.** Both run in parallel from early in the project. Waiting for full funding before starting A&E procurement adds 10+ weeks of delay.

2. **GC RFP starts at the same time as Construction Documents production** — not after. The I-GMP bid strategy enables this overlap.

3. **Long Lead Items must be ordered before the GC contract is executed.** Furniture lead time is 30 weeks. If you wait for GC award, you push Go Live by months. The PM should issue purchase authority for furniture and AV during the GC bid phase.

4. **Permit submission happens immediately after 100% CD Issue (next day).** Do not create a gap between 100% CDs and permit submission. The expeditor should be engaged during Design Development.

5. **The Occupancy phase and final Construction tasks overlap.** Building 360 updates, Final Substantial Completion, and Go Live run concurrent with final inspections and punchlist closeout.

6. **Go Live is a LOB/business milestone; Substantial Completion is a contractual/construction milestone.** They are different events owned by different parties. Go Live happens approximately 2 weeks before formal Substantial Completion in this schedule.

7. **Financial reconciliation takes 89 days after Handover.** Final Invoices Reconciled is the longest closeout task and the one most likely to delay formal project closure. Budget this time in all project plans.

8. **MER Shell Ready is the trigger for the entire GTI technology track.** Delays to MER Shell Ready cascade directly into Go Live. This must be on the critical path and flagged as a high-priority milestone.

9. **CD Review involves 5 distinct parties** (Property Mgmt., Engineering, Telecom/Data, AV, Facilities). The PM must coordinate all 5 reviewers simultaneously, not sequentially, to keep the 10-day review window.

10. **Schematic Budget Review occurs at the end of Schematic Design**, before Design Development begins. If the budget is significantly over, Design Development direction changes — this is a cost control gate, not just a milestone.

---

### 18.9 LIGHT PROJECT SCHEDULE — ESTIMATED TEMPLATE

The schedule PDF contains only the Standard project schedule. Based on the D&C Playbook profile definitions and what Light projects skip, the following estimated template applies for Light projects. **Validate against an actual Light project schedule when one becomes available.**

| Phase | Standard | Light | Notes |
|---|---|---|---|
| Initiation / Programming | 1 day | 1 day | Same |
| Programming and Design | 3.4 wks | 2 wks | Reduced — no full programming required |
| CERP Funding | 10.4 wks | 6 wks | Reduced governance cycle (Regional approval only) |
| RFP — A&E Design | 30.6 wks | None | Light projects use pre-qualified AoR or internal design team |
| A&E Design (full) | 32.8 wks | None | Light projects skip full design phase |
| Concept / Test Fit only | 6.8 wks | 4 wks | Limited test fit only |
| GC RFP | 13.8 wks | 6-8 wks | Simplified procurement; possibly sole-source |
| Permitting | 13 wks | 8-10 wks | Simpler scope = shorter permit |
| Long Lead Items | 36.4 wks | 10-15 wks | Reduced scope; standard FF&E only |
| Pre-Construction | 1 day | 1 day | Same |
| Construction | 44.2 wks | 20-24 wks | Light scope = shorter construction |
| Occupancy | 8.8 wks | 4 wks | Simplified move/handover |
| Close Out | 18 wks | 12 wks | Fewer vendors to reconcile |
| **Total Estimated** | **~120 wks** | **~55–65 wks** | **Light ≈ 1 year 1 month – 1 year 3 months** |

---

### 18.10 APP FEATURES DRIVEN BY THIS SCHEDULE

The following specific app features are required based on this schedule analysis:

**1. I-GMP Bid Strategy support in Procurement Module**
The GC is procured on an Indicative GMP (not a fixed-price bid). The procurement module must support:
- Initial bid = I-GMP based on DD documents
- GMP finalization = after 100% CDs are issued
- Two contract amount fields: Indicative GMP and Final GMP
- The variance between I-GMP and Final GMP is tracked and reported

**2. MER Milestone Sub-Track as a standard template**
MER Shell Ready → Room Ready → GTI Handover → Production Ready must be a pre-built task group that auto-generates for any project with an MER build. These four milestones sync with the main schedule automatically.

**3. Albireo as a tagged technology system**
Albireo appears in the Permanent Power / Factory Startup task. The app's technology checklist should include Albireo (building automation / BMS system) as a specific commissioning item.

**4. Silk Plants as a furniture/accessories line item**
"Furniture Delivery & Install / Accessories / Silk Plants" — silk plants appear as a standard checklist item under FF&E, not an afterthought. Include in the default FF&E checklist.

**5. "Building 360 Updates" as a closeout milestone**
Building 360 Updates / Milestone Updates appears as a task in the Occupancy phase. This likely refers to updating JPMC's building information system. Add as a standard closeout task.

**6. Move Manager coordination task**
"Relocate from [previous space]" is a task in the Occupancy phase owned by Move Manager. The app must support assigning a Move Manager role to this task and linking it to the handover milestone.

**7. Carrier Survey and Fiber Pull as distinct tasks**
These are two separate tasks in the MER sub-track, each 10 days. The carrier (telecom provider) must survey before pulling fiber. Do not combine these — they have different owners (Carrier and PM must coordinate access).

**8. Schematic Budget Review as a cost control gate**
This 1-day task at the end of Schematic Design is a cost/scope control gate. If the budget review shows the schematic design is over budget, design direction must change before Design Development begins. The app should flag this gate and require a PM sign-off with budget confirmation before SD→DD transition is approved.

**9. "Building Rules / MOP" in Pre-Construction Checklist**
Method of Procedure (MOP) — a JPMC-specific document defining how construction will be executed without disrupting existing building operations. Add MOP as a required pre-construction artifact.

**10. Parallel approval required from 5 parties for CD Review**
CD Review requires simultaneous review from: Property Management, Engineering, Telecom/Data, AV, and Facilities. The app's approval workflow for CD Review must support multi-party parallel review with a 10-day deadline. All 5 must respond before comments are incorporated.

---

*Version 2.3 — Updated March 2026 with Standard project schedule template (SO09897).*
*136 tasks, 13 phases, all durations, parallel tracks, procurement sequences, and MER sub-track fully documented.*
*Scheduling rules and AI generator defaults defined.*

---

*This document is the master plan for CRE PMO V2. Update as decisions are made and phases complete.*

*Last updated: March 2026*
