import { useEffect, useRef } from 'react'
import type { RaidItem } from '@/hooks/useRaidLog'
import type { ProjectTask } from '@/hooks/useProjectTasks'
import type { Milestone } from '@/hooks/useMilestones'
import type { BudgetItem } from '@/hooks/useBudgetItems'
import type { Project } from '@/types'

interface RiskEngineInput {
  project: Project | null
  projectTasks: ProjectTask[]
  milestones: Milestone[]
  budgetItems: BudgetItem[]
  overdueRfis: number
  coApproved: number
  raidItems: RaidItem[]
  addRaidItem: (data: Omit<RaidItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateRaidItem: (id: string, data: Partial<RaidItem>) => Promise<void>
  raidLoading: boolean
}

// Auto-generates and auto-resolves RAID items based on project conditions.
// Uses systemKey for deduplication — one RAID item per condition per project.
export function useRiskEngine({
  project,
  projectTasks,
  milestones,
  budgetItems,
  overdueRfis,
  coApproved,
  raidItems,
  addRaidItem,
  updateRaidItem,
  raidLoading,
}: RiskEngineInput) {
  // Track in-flight writes so we don't double-create on fast re-renders
  const pendingKeys = useRef(new Set<string>())

  useEffect(() => {
    if (!project || raidLoading) return

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const existing = new Map(
      raidItems.filter(i => i.systemKey).map(i => [i.systemKey!, i])
    )

    const ensure = async (
      key: string,
      condition: boolean,
      itemData: Omit<RaidItem, 'id' | 'createdAt' | 'updatedAt' | 'systemKey' | 'isSystemGenerated'>
    ) => {
      const current = existing.get(key)

      if (condition) {
        if (!current) {
          // Create new system risk
          if (pendingKeys.current.has(key)) return
          pendingKeys.current.add(key)
          try {
            await addRaidItem({
              ...itemData,
              systemKey: key,
              isSystemGenerated: true,
            })
          } finally {
            pendingKeys.current.delete(key)
          }
        } else if (current.title !== itemData.title && current.status !== 'closed') {
          // Update title if count changed (e.g. "2 overdue" → "3 overdue")
          await updateRaidItem(current.id, { title: itemData.title, description: itemData.description })
        }
      } else {
        // Condition resolved — auto-close if still open
        if (current && (current.status === 'open' || current.status === 'in-progress')) {
          await updateRaidItem(current.id, {
            status: 'closed',
            closedDate: new Date().toISOString(),
          })
        }
      }
    }

    const pid = project.id

    // ── 1. Overdue project tasks ─────────────────────────────────────────────
    const overdueTasks = projectTasks.filter(
      t => t.status === 'open' && t.dueDate && new Date(t.dueDate) < today
    )
    ensure(
      `proj-tasks-overdue-${pid}`,
      overdueTasks.length > 0,
      {
        projectId: pid,
        type: 'risk',
        title: `${overdueTasks.length} overdue project task${overdueTasks.length > 1 ? 's' : ''}`,
        description: `${overdueTasks.length} task${overdueTasks.length > 1 ? 's are' : ' is'} past due: ${overdueTasks.slice(0, 3).map(t => t.title).join(', ')}${overdueTasks.length > 3 ? '…' : ''}`,
        owner: '',
        priority: overdueTasks.length >= 3 ? 'high' : 'medium',
        status: 'open',
        dueDate: '',
        closedDate: '',
      }
    )

    // ── 2. Missed milestones ─────────────────────────────────────────────────
    const missedMilestones = milestones.filter(
      m => m.status !== 'complete' && m.targetDate && new Date(m.targetDate) < today
    )
    ensure(
      `milestones-missed-${pid}`,
      missedMilestones.length > 0,
      {
        projectId: pid,
        type: 'risk',
        title: `${missedMilestones.length} milestone${missedMilestones.length > 1 ? 's' : ''} past target date`,
        description: `Missed: ${missedMilestones.slice(0, 3).map(m => m.name).join(', ')}${missedMilestones.length > 3 ? '…' : ''}`,
        owner: '',
        priority: 'high',
        status: 'open',
        dueDate: '',
        closedDate: '',
      }
    )

    // ── 3. Budget overrun > 10% ──────────────────────────────────────────────
    const totalBudget = project.totalBudget || 0
    const netBudget   = totalBudget + coApproved
    const forecast    = project.forecastCost || 0
    const overrunPct  = netBudget > 0 ? ((forecast - netBudget) / netBudget) * 100 : 0
    const budgetOverrun = netBudget > 0 && overrunPct > 10

    ensure(
      `budget-overrun-${pid}`,
      budgetOverrun,
      {
        projectId: pid,
        type: 'risk',
        title: `Budget overrun — ${Math.round(overrunPct)}% over forecast`,
        description: `Project forecast ($${forecast.toLocaleString()}) exceeds net budget ($${netBudget.toLocaleString()}) by ${Math.round(overrunPct)}%.`,
        owner: '',
        priority: overrunPct > 15 ? 'high' : 'medium',
        status: 'open',
        dueDate: '',
        closedDate: '',
      }
    )

    // ── 4. Overdue RFIs ──────────────────────────────────────────────────────
    ensure(
      `rfis-overdue-${pid}`,
      overdueRfis > 0,
      {
        projectId: pid,
        type: 'issue',
        title: `${overdueRfis} overdue RFI${overdueRfis > 1 ? 's' : ''} awaiting response`,
        description: `${overdueRfis} RFI${overdueRfis > 1 ? 's are' : ' is'} past their due date and still open.`,
        owner: '',
        priority: overdueRfis >= 3 ? 'high' : 'medium',
        status: 'open',
        dueDate: '',
        closedDate: '',
      }
    )

    // ── 5. Budget items not started (no line items entered) ──────────────────
    const hasAnyBudget = budgetItems.length > 0
    const inDelivery   = ['design', 'construction', 'handover', 'closeout'].includes(project.status)
    ensure(
      `budget-not-started-${pid}`,
      !hasAnyBudget && inDelivery,
      {
        projectId: pid,
        type: 'action',
        title: 'Budget not set up — no line items entered',
        description: 'Project is in an active delivery phase but the budget module has no line items. Add budget items to enable financial tracking.',
        owner: '',
        priority: 'medium',
        status: 'open',
        dueDate: '',
        closedDate: '',
      }
    )

  }, [project, projectTasks, milestones, budgetItems, overdueRfis, coApproved, raidItems, raidLoading])
}
