import type { Project } from '@/types'
import type { RaidItem } from '@/hooks/useRaidLog'

export interface HealthBreakdown {
  total: number               // 0–100
  budget: number              // 0–30
  schedule: number            // 0–30
  risk: number                // 0–20  (was "stage")
  taskCompletion: number      // 0–20  (new)
  budgetLabel: string
  scheduleLabel: string
  riskLabel: string
  taskCompletionLabel: string
  // Legacy alias so existing callers don't break
  stage: number
  stageLabel: string
  color: 'emerald' | 'amber' | 'red'
  label: 'Healthy' | 'At Risk' | 'Critical'
  daysToCompletion: number | null
  budgetVariancePct: number | null
  spi: number | null
}

export interface MilestoneSnapshot {
  targetDate: string
  status: string   // 'pending' | 'complete' | 'delayed'
}

export interface HealthOptions {
  taskCompletionPct?: number       // 0–100
  raidItems?: RaidItem[]           // open RAID items for risk score
  milestones?: MilestoneSnapshot[] // for milestone hit-rate penalty
}

export function computeHealth(p: Project, opts: HealthOptions = {}): HealthBreakdown {
  const { taskCompletionPct, raidItems = [], milestones = [] } = opts

  // ── Budget component (30 pts) ────────────────────────────────────────────
  let budget = 0
  let budgetLabel = 'Budget not set'
  let budgetVariancePct: number | null = null

  if (p.totalBudget > 0) {
    const pct = (p.forecastCost - p.totalBudget) / p.totalBudget
    budgetVariancePct = Math.round(pct * 100)
    if (pct <= 0) {
      budget = 30; budgetLabel = 'Under budget'
    } else if (pct <= 0.03) {
      budget = 24; budgetLabel = '1–3% over budget'
    } else if (pct <= 0.07) {
      budget = 16; budgetLabel = '3–7% over budget'
    } else if (pct <= 0.15) {
      budget = 8;  budgetLabel = '7–15% over budget'
    } else {
      budget = 0;  budgetLabel = '>15% over budget'
    }
  }

  // ── Schedule component (30 pts) ─────────────────────────────────────────
  let schedule = 0
  let scheduleLabel = 'No schedule set'
  let daysToCompletion: number | null = null
  let spi: number | null = null

  const closedStatuses = ['closed', 'closeout', 'defect-period']
  if (closedStatuses.includes(p.status)) {
    schedule = p.targetCompletionDate ? 30 : 18; scheduleLabel = 'Project closing'
  } else if (p.startDate && p.targetCompletionDate) {
    const start = new Date(p.startDate).getTime()
    const end   = new Date(p.targetCompletionDate).getTime()
    const now   = Date.now()
    const totalDuration = end - start
    daysToCompletion = Math.ceil((end - now) / (1000 * 60 * 60 * 24))
    const activeDeliveryPhase = ['design', 'construction', 'handover'].includes(p.status)

    if (totalDuration > 0 && taskCompletionPct !== undefined) {
      const pv = Math.min(1, Math.max(0, (now - start) / totalDuration))
      const ev = taskCompletionPct / 100
      if (pv > 0) {
        spi = Math.round((ev / pv) * 100) / 100
        if (spi >= 1.0)  { schedule = 30; scheduleLabel = `SPI ${spi.toFixed(2)} — On schedule` }
        else if (spi >= 0.9) { schedule = 24; scheduleLabel = `SPI ${spi.toFixed(2)} — Slightly behind` }
        else if (spi >= 0.8) { schedule = 15; scheduleLabel = `SPI ${spi.toFixed(2)} — Behind schedule` }
        else                  { schedule = 5;  scheduleLabel = `SPI ${spi.toFixed(2)} — Significantly behind` }
      } else {
        schedule = 30; scheduleLabel = 'Project started'
      }
    } else if (p.targetCompletionDate) {
      if (activeDeliveryPhase) {
        schedule = 12; scheduleLabel = 'No tasks tracked'
      } else if (daysToCompletion > 60) {
        schedule = 30; scheduleLabel = 'On schedule'
      } else if (daysToCompletion > 30) {
        schedule = 24; scheduleLabel = `${daysToCompletion}d to completion`
      } else if (daysToCompletion > 0) {
        schedule = 15; scheduleLabel = `${daysToCompletion}d to completion`
      } else if (daysToCompletion > -14) {
        schedule = 6;  scheduleLabel = `${Math.abs(daysToCompletion)}d past target`
      } else {
        schedule = 0;  scheduleLabel = `${Math.abs(daysToCompletion)}d past target`
      }
    }
  } else if (p.targetCompletionDate) {
    const days = Math.ceil(
      (new Date(p.targetCompletionDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
    daysToCompletion = days
    const activeDeliveryPhase = ['design', 'construction', 'handover'].includes(p.status)
    if (activeDeliveryPhase) {
      schedule = 12; scheduleLabel = 'No tasks tracked'
    } else if (days > 60) {
      schedule = 30; scheduleLabel = 'On schedule'
    } else if (days > 30) {
      schedule = 24; scheduleLabel = `${days}d to completion`
    } else if (days > 0) {
      schedule = 15; scheduleLabel = `${days}d to completion`
    } else if (days > -14) {
      schedule = 6;  scheduleLabel = `${Math.abs(days)}d past target`
    } else {
      schedule = 0;  scheduleLabel = `${Math.abs(days)}d past target`
    }
  }

  // ── Milestone hit-rate penalty (applied to schedule score) ──────────────
  if (milestones.length > 0) {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const dated = milestones.filter(m => m.targetDate)
    const pastDue = dated.filter(m => m.status !== 'complete' && new Date(m.targetDate) < today)
    if (pastDue.length > 0) {
      const penaltyPer = pastDue.length >= 3 ? 8 : pastDue.length === 2 ? 6 : 4
      schedule = Math.max(0, schedule - penaltyPer)
      scheduleLabel = scheduleLabel + ` · ${pastDue.length} missed milestone${pastDue.length > 1 ? 's' : ''}`
    }
  }

  // ── Risk component (20 pts) — based on open RAID items ───────────────────
  let riskScore = 20
  let riskLabel = 'No open risks'

  const openItems  = raidItems.filter(i => i.status === 'open' || i.status === 'in-progress')
  const highRisks  = openItems.filter(i => i.priority === 'high')
  const medRisks   = openItems.filter(i => i.priority === 'medium')

  if (highRisks.length >= 3) {
    riskScore = 2;  riskLabel = `${highRisks.length} high-priority risks open`
  } else if (highRisks.length === 2) {
    riskScore = 6;  riskLabel = '2 high-priority risks open'
  } else if (highRisks.length === 1) {
    riskScore = 12; riskLabel = '1 high-priority risk open'
  } else if (medRisks.length >= 3) {
    riskScore = 12; riskLabel = `${medRisks.length} medium risks open`
  } else if (medRisks.length > 0) {
    riskScore = 16; riskLabel = `${medRisks.length} medium risk${medRisks.length > 1 ? 's' : ''} open`
  } else if (openItems.length > 0) {
    riskScore = 18; riskLabel = `${openItems.length} low-priority item${openItems.length > 1 ? 's' : ''} open`
  }

  // ── Task completion component (20 pts) ───────────────────────────────────
  let taskCompletion = 20
  let taskCompletionLabel = 'No tasks yet'

  const earlyStage = ['pre-project', 'initiate', 'planning'].includes(p.status)

  if (taskCompletionPct !== undefined) {
    if (taskCompletionPct >= 80) {
      taskCompletion = 20; taskCompletionLabel = `${taskCompletionPct}% complete`
    } else if (taskCompletionPct >= 60) {
      taskCompletion = 15; taskCompletionLabel = `${taskCompletionPct}% complete`
    } else if (taskCompletionPct >= 40) {
      taskCompletion = 10; taskCompletionLabel = `${taskCompletionPct}% complete`
    } else if (taskCompletionPct >= 20) {
      taskCompletion = 5;  taskCompletionLabel = `${taskCompletionPct}% complete`
    } else if (earlyStage) {
      taskCompletion = 20; taskCompletionLabel = 'Early stage'
    } else {
      taskCompletion = 2;  taskCompletionLabel = `${taskCompletionPct}% complete — low progress`
    }
  } else if (earlyStage) {
    taskCompletion = 20; taskCompletionLabel = 'Early stage'
  }

  const total = Math.min(100, budget + schedule + riskScore + taskCompletion)
  const color = total >= 80 ? 'emerald' : total >= 60 ? 'amber' : 'red'
  const label = total >= 80 ? 'Healthy' : total >= 60 ? 'At Risk' : 'Critical'

  return {
    total, budget, schedule, risk: riskScore, taskCompletion,
    budgetLabel, scheduleLabel, riskLabel, taskCompletionLabel,
    // Legacy aliases
    stage: riskScore,
    stageLabel: riskLabel,
    color, label,
    daysToCompletion, budgetVariancePct, spi,
  }
}

export function healthColor(score: number) {
  return score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-red-400'
}

export function healthBg(score: number) {
  return score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500'
}

export function healthBorder(score: number) {
  return score >= 80 ? 'border-emerald-700/40' : score >= 60 ? 'border-amber-700/40' : 'border-red-700/40'
}
