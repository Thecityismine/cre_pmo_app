import type { Project } from '@/types'

export interface HealthBreakdown {
  total: number           // 0–100
  budget: number          // 0–40
  schedule: number        // 0–35
  stage: number           // 0–25
  budgetLabel: string
  scheduleLabel: string
  stageLabel: string
  color: 'emerald' | 'amber' | 'red'
  label: 'Healthy' | 'At Risk' | 'Critical'
  daysToCompletion: number | null
  budgetVariancePct: number | null
  spi: number | null
}

export interface HealthOptions {
  taskCompletionPct?: number   // 0–100, used for SPI (EV)
}

export function computeHealth(p: Project, opts: HealthOptions = {}): HealthBreakdown {
  // ── Budget component (40 pts) ────────────────────────────────────────────
  let budget = 0
  let budgetLabel = 'Budget not set'
  let budgetVariancePct: number | null = null

  if (p.totalBudget > 0) {
    const pct = (p.forecastCost - p.totalBudget) / p.totalBudget
    budgetVariancePct = Math.round(pct * 100)
    if (pct <= 0) {
      budget = 40; budgetLabel = 'Under budget'
    } else if (pct <= 0.03) {
      budget = 32; budgetLabel = '1–3% over budget'
    } else if (pct <= 0.07) {
      budget = 22; budgetLabel = '3–7% over budget'
    } else if (pct <= 0.15) {
      budget = 10; budgetLabel = '7–15% over budget'
    } else {
      budget = 0; budgetLabel = '>15% over budget'
    }
  }

  // ── Schedule component (35 pts) ─────────────────────────────────────────
  // Uses SPI = EV / PV when both task completion % and project dates are known.
  // EV = taskCompletionPct / 100
  // PV = elapsed time / total project duration (0–1)
  let schedule = 0
  let scheduleLabel = 'No schedule set'
  let daysToCompletion: number | null = null
  let spi: number | null = null

  const closedStatuses = ['closed', 'closeout', 'defect-period']
  if (closedStatuses.includes(p.status)) {
    schedule = p.targetCompletionDate ? 35 : 20; scheduleLabel = 'Project closing'
  } else if (p.startDate && p.targetCompletionDate) {
    const start = new Date(p.startDate).getTime()
    const end   = new Date(p.targetCompletionDate).getTime()
    const now   = Date.now()
    const totalDuration = end - start

    daysToCompletion = Math.ceil((end - now) / (1000 * 60 * 60 * 24))

    // Phases where task tracking is expected — no tasks = can't assess schedule
    const activeDeliveryPhase = ['design', 'construction', 'handover'].includes(p.status)

    if (totalDuration > 0 && opts.taskCompletionPct !== undefined) {
      const pv = Math.min(1, Math.max(0, (now - start) / totalDuration))  // planned progress
      const ev = opts.taskCompletionPct / 100                              // earned value
      if (pv > 0) {
        spi = Math.round((ev / pv) * 100) / 100
        if (spi >= 1.0) {
          schedule = 35; scheduleLabel = `SPI ${spi.toFixed(2)} — On schedule`
        } else if (spi >= 0.9) {
          schedule = 28; scheduleLabel = `SPI ${spi.toFixed(2)} — Slightly behind`
        } else if (spi >= 0.8) {
          schedule = 18; scheduleLabel = `SPI ${spi.toFixed(2)} — Behind schedule`
        } else {
          schedule = 6; scheduleLabel = `SPI ${spi.toFixed(2)} — Significantly behind`
        }
      } else {
        // Project just started, no elapsed time yet
        schedule = 35; scheduleLabel = 'Project started'
      }
    } else if (p.targetCompletionDate) {
      // No task data — penalize active delivery phases that should be tracking tasks
      if (activeDeliveryPhase) {
        schedule = 15; scheduleLabel = 'No tasks tracked'
      } else if (daysToCompletion > 60) {
        schedule = 35; scheduleLabel = 'On schedule'
      } else if (daysToCompletion > 30) {
        schedule = 28; scheduleLabel = `${daysToCompletion}d to completion`
      } else if (daysToCompletion > 0) {
        schedule = 18; scheduleLabel = `${daysToCompletion}d to completion`
      } else if (daysToCompletion > -14) {
        schedule = 8; scheduleLabel = `${Math.abs(daysToCompletion)}d past target`
      } else {
        schedule = 0; scheduleLabel = `${Math.abs(daysToCompletion)}d past target`
      }
    }
  } else if (p.targetCompletionDate) {
    const days = Math.ceil(
      (new Date(p.targetCompletionDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
    daysToCompletion = days
    const activeDeliveryPhase = ['design', 'construction', 'handover'].includes(p.status)
    if (activeDeliveryPhase) {
      schedule = 15; scheduleLabel = 'No tasks tracked'
    } else if (days > 60) {
      schedule = 35; scheduleLabel = 'On schedule'
    } else if (days > 30) {
      schedule = 28; scheduleLabel = `${days}d to completion`
    } else if (days > 0) {
      schedule = 18; scheduleLabel = `${days}d to completion`
    } else if (days > -14) {
      schedule = 8; scheduleLabel = `${Math.abs(days)}d past target`
    } else {
      schedule = 0; scheduleLabel = `${Math.abs(days)}d past target`
    }
  }

  // ── Stage component (25 pts) — early-stage projects penalized lightly ────
  let stage = 25
  let stageLabel = 'Active'
  switch (p.status) {
    case 'pre-project':   stage = 25; stageLabel = 'Pre-Project'; break
    case 'initiate':      stage = 25; stageLabel = 'Initiate'; break
    case 'planning':      stage = 25; stageLabel = 'Planning'; break
    case 'design':        stage = 25; stageLabel = 'Design'; break
    case 'construction':  stage = 22; stageLabel = 'Construction'; break
    case 'handover':      stage = 20; stageLabel = 'Handover'; break
    case 'closeout':      stage = 25; stageLabel = 'Closeout'; break
    case 'defect-period': stage = 18; stageLabel = 'Defect Period'; break
    case 'closed':        stage = 25; stageLabel = 'Closed'; break
  }

  const total = Math.min(100, budget + schedule + stage)
  const color = total >= 80 ? 'emerald' : total >= 60 ? 'amber' : 'red'
  const label = total >= 80 ? 'Healthy' : total >= 60 ? 'At Risk' : 'Critical'

  return {
    total, budget, schedule, stage,
    budgetLabel, scheduleLabel, stageLabel,
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
