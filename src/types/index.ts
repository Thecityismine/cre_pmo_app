// ─── Project Types ───────────────────────────────────────────────────────────

export type ProjectProfile = string  // e.g. 'L' (Light), 'S' (Standard), 'E' (Enhanced) — configurable

export type ProjectStatus =
  | 'pre-project'
  | 'initiate'
  | 'planning'
  | 'design'
  | 'construction'
  | 'handover'
  | 'closeout'
  | 'defect-period'
  | 'closed'

export type ProjectPhaseCode =
  | 'C1.01' | 'C1.02' | 'C1.03' | 'C1.04' | 'C1.05' | 'C1.06'
  | 'C2.01' | 'C2.02' | 'C2.03' | 'C2.04' | 'C2.05' | 'C2.06' | 'C2.07' | 'C2.08'
  | 'C3.01' | 'C3.02' | 'C3.03' | 'C3.04' | 'C3.05' | 'C3.06' | 'C3.07' | 'C3.08'
  | 'C4.01' | 'C4.02' | 'C4.03' | 'C4.04' | 'C4.05' | 'C4.06' | 'C4.07' | 'C4.08'
  | 'C5.01' | 'C5.02' | 'C5.03' | 'C5.04' | 'C5.05' | 'C5.06' | 'C5.07' | 'C5.08'

export interface Project {
  id: string
  // Identity
  projectName: string
  projectNumber: string       // e.g., "SO09897"
  profile: ProjectProfile
  status: ProjectStatus
  currentPhase: string
  // Location
  address: string
  city: string
  state: string
  country: string
  lat?: number
  lng?: number
  // Client / Team
  clientName: string          // e.g., "JPMorgan Chase"
  businessUnit?: string
  projectManager: string
  teamMembers: string[]
  // Dates
  startDate: string           // ISO date string
  targetCompletionDate: string
  actualCompletionDate?: string
  // Budget
  totalBudget: number
  committedCost: number
  forecastCost: number
  actualCost: number
  contingencyPercent: number
  categoryBudgets?: Record<string, number>  // approved budget per category, e.g. { 'Hard Cost': 2331000 }
  // Size
  rsf?: number                // rentable square feet
  // Flags
  isActive: boolean
  hasMER: boolean
  // Meta
  createdAt: string
  updatedAt: string
  createdBy: string
}

// ─── Task Types ───────────────────────────────────────────────────────────────

export type TaskStatus = 'not-started' | 'in-progress' | 'complete' | 'on-hold' | 'blocked' | 'n-a'
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low'

export interface Task {
  id: string
  projectId: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  phase: string               // e.g., "C2" or stage gate name
  phaseCode?: ProjectPhaseCode
  category: string            // e.g., "Design", "Procurement", "Construction"
  assignedTo?: string
  dueDate?: string
  completedDate?: string
  notes?: string
  order: number               // for sorting within category
  isFromMasterChecklist: boolean
  masterTaskId?: string
  createdAt: string
  updatedAt: string
}

// ─── Contact Types ────────────────────────────────────────────────────────────

export type ContactRole =
  | 'project-manager'
  | 'project-executive'
  | 'architect'
  | 'general-contractor'
  | 'mep-engineer'
  | 'it-vendor'
  | 'client-rep'
  | 'facilities'
  | 'legal'
  | 'other'

export interface Contact {
  id: string
  projectId?: string          // undefined = global contact book
  name: string
  company: string
  role: ContactRole
  email: string
  phone?: string
  notes?: string
  createdAt: string
}

// ─── Budget Types ─────────────────────────────────────────────────────────────

export type BudgetCategory =
  | 'hard-cost'
  | 'soft-cost'
  | 'ff-e'
  | 'it-av'
  | 'contingency'
  | 'owner-reserve'

export interface BudgetLineItem {
  id: string
  projectId: string
  category: BudgetCategory
  costCode?: string           // e.g., "05-99-993100-00-00" for Owner's Reserve
  description: string
  budgetAmount: number
  committedAmount: number
  forecastAmount: number
  actualAmount: number
  variance: number            // budget - forecast
  notes?: string
  createdAt: string
  updatedAt: string
}

// ─── User / Auth Types ────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'project-manager' | 'viewer'

export interface AppUser {
  uid: string
  email: string
  displayName: string
  role: UserRole
  photoURL?: string
  createdAt: string
}

// ─── Master Checklist Types ───────────────────────────────────────────────────

export interface MasterTask {
  id: string
  title: string
  category: string
  phase: string
  defaultPriority: TaskPriority
  applicableTo: ProjectProfile[]  // which project profiles this applies to
  order: number
  notes?: string
}

// ─── Utility Types ────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data?: T
  error?: string
}
