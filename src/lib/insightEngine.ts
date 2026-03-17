/**
 * Heuristic-based insight engine.
 * Runs client-side and generates AIInsight records for a project.
 * Called when opening a project or on demand.
 */
import type { Project } from '@/types'
import type { AIInsight, InsightSeverity, InsightType } from '@/hooks/useAIInsights'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Math.abs(n))

// Expires in 24 hours
const expires24h = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

export interface InsightInput {
  project: Project
  taskCount: number
  completedTaskCount: number
  blockedTaskCount: number
  openRfiCount: number
  overdueRfiCount: number
  approvedCOs: number
  pendingCOs: number
  openPunchCount: number
}

export function generateInsights(input: InsightInput): Omit<AIInsight, 'id' | 'createdAt'>[] {
  const {
    project, taskCount, completedTaskCount, blockedTaskCount,
    overdueRfiCount, approvedCOs, pendingCOs, openPunchCount,
  } = input

  const insights: Omit<AIInsight, 'id' | 'createdAt'>[] = []
  const push = (
    type: InsightType, severity: InsightSeverity, title: string, body: string,
  ) => insights.push({ projectId: project.id, type, severity, title, body, expiresAt: expires24h() })

  const budget = project.totalBudget || 0
  const forecast = project.forecastCost || 0
  const taskPct = taskCount > 0 ? Math.round((completedTaskCount / taskCount) * 100) : 0

  // ── Budget overrun ────────────────────────────────────────────────────────
  if (budget > 0) {
    const overPct = ((forecast - budget) / budget) * 100
    if (overPct > 15) {
      push('budget', 'critical',
        `Budget overrun — ${Math.round(overPct)}% over`,
        `Forecast of ${fmt(forecast)} is ${fmt(forecast - budget)} over the approved budget of ${fmt(budget)}. Immediate corrective action required.`)
    } else if (overPct > 5) {
      push('budget', 'warning',
        `Budget trending over — ${Math.round(overPct)}% over`,
        `Forecast of ${fmt(forecast)} is tracking ${fmt(forecast - budget)} over budget. Review hard cost line items.`)
    }
  }

  // ── Pending CO exposure ────────────────────────────────────────────────────
  if (pendingCOs > 0 && budget > 0) {
    const exposurePct = (pendingCOs / budget) * 100
    if (exposurePct > 8) {
      push('budget', 'warning',
        `High CO exposure — ${fmt(pendingCOs)} pending`,
        `Pending change orders represent ${Math.round(exposurePct)}% of the approved budget. Consider a scope freeze until resolved.`)
    }
  }

  // ── Approved CO creep ─────────────────────────────────────────────────────
  if (approvedCOs > 0 && budget > 0) {
    const coPct = (approvedCOs / budget) * 100
    if (coPct > 10) {
      push('risk', 'warning',
        `Change order volume at ${Math.round(coPct)}% of budget`,
        `Approved COs total ${fmt(approvedCOs)}, representing ${Math.round(coPct)}% of the approved budget. Monitor for scope creep.`)
    }
  }

  // ── Schedule: target completion ────────────────────────────────────────────
  if (project.targetCompletionDate) {
    const daysLeft = Math.ceil(
      (new Date(project.targetCompletionDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
    if (daysLeft < 0) {
      push('schedule', 'critical',
        `Target completion passed — ${Math.abs(daysLeft)} days overdue`,
        `The project target completion date of ${project.targetCompletionDate} has passed. Update the schedule or escalate.`)
    } else if (daysLeft <= 30 && taskPct < 80) {
      push('schedule', 'critical',
        `${daysLeft} days to completion — only ${taskPct}% tasks done`,
        `With ${daysLeft} days remaining, only ${taskPct}% of tasks are complete. ${completedTaskCount}/${taskCount} tasks closed. Accelerated pace required.`)
    } else if (daysLeft <= 60 && taskPct < 60) {
      push('schedule', 'warning',
        `Schedule risk — ${daysLeft} days left, ${taskPct}% complete`,
        `Project is ${taskPct}% complete with ${daysLeft} days remaining. Consider reviewing critical path tasks.`)
    }
  }

  // ── Blocked tasks ─────────────────────────────────────────────────────────
  if (blockedTaskCount >= 3) {
    push('risk', 'critical',
      `${blockedTaskCount} tasks blocked`,
      `${blockedTaskCount} tasks are currently blocked. Blocked tasks may be delaying critical path work.`)
  } else if (blockedTaskCount > 0) {
    push('risk', 'warning',
      `${blockedTaskCount} task${blockedTaskCount > 1 ? 's' : ''} blocked`,
      `${blockedTaskCount} task${blockedTaskCount > 1 ? 's are' : ' is'} currently blocked. Review and clear blockers to maintain schedule.`)
  }

  // ── Overdue RFIs ──────────────────────────────────────────────────────────
  if (overdueRfiCount > 0) {
    push('risk', 'warning',
      `${overdueRfiCount} overdue RFI${overdueRfiCount > 1 ? 's' : ''}`,
      `${overdueRfiCount} RFI${overdueRfiCount > 1 ? 's are' : ' is'} past the required response date. Outstanding RFIs may impact construction schedule.`)
  }

  // ── Open punch list items ─────────────────────────────────────────────────
  if (openPunchCount > 10 && ['handover', 'closeout'].includes(project.status)) {
    push('risk', 'warning',
      `${openPunchCount} open punch list items`,
      `${openPunchCount} punch list items remain open. Closeout may be delayed if not resolved promptly.`)
  }

  // ── Low task velocity (no recent progress) ────────────────────────────────
  if (taskPct < 20 && taskCount > 10 && !['pre-project', 'initiate'].includes(project.status)) {
    push('task', 'info',
      `Low task completion — ${taskPct}%`,
      `Only ${taskPct}% of checklist tasks are complete (${completedTaskCount}/${taskCount}). Review task assignments and due dates.`)
  }

  return insights
}
