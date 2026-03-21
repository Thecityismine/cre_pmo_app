import { useMemo } from 'react'
import type { RaidItem } from '@/hooks/useRaidLog'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function msOf(iso: string): number {
  return new Date(iso).getTime()
}

/** Time at which the item became "closed" (closed/mitigated/accepted), or null if still open. */
function closeMs(item: RaidItem): number | null {
  const done = ['closed', 'mitigated', 'accepted']
  if (!done.includes(item.status)) return null
  if (item.closedDate) return msOf(item.closedDate)
  return msOf(item.updatedAt) // fallback
}

function isOpenAt(item: RaidItem, T: number): boolean {
  if (msOf(item.createdAt) > T) return false
  const c = closeMs(item)
  return c === null || c > T
}

// ─── Data builder ─────────────────────────────────────────────────────────────

interface TrajectoryPoint {
  date: Date
  total: number
  risk: number
  action: number
  issue: number
  decision: number
}

function buildTrajectory(items: RaidItem[]): TrajectoryPoint[] {
  if (items.length === 0) return []

  const allMs = items.map(i => msOf(i.createdAt))
  const spanStart = new Date(Math.min(...allMs))
  spanStart.setHours(0, 0, 0, 0)
  // Align to Monday
  const day = spanStart.getDay()
  spanStart.setDate(spanStart.getDate() - (day === 0 ? 6 : day - 1))

  const now = new Date()
  now.setHours(23, 59, 59, 999)

  const spanDays = (now.getTime() - spanStart.getTime()) / 86_400_000

  // Granularity: weekly < 120 days, biweekly < 270 days, else monthly
  const stepDays = spanDays < 120 ? 7 : spanDays < 270 ? 14 : 30

  const ticks: Date[] = []
  let cur = new Date(spanStart)
  while (cur <= now) {
    ticks.push(new Date(cur))
    cur = new Date(cur.getTime() + stepDays * 86_400_000)
  }
  // Always include today
  if (ticks[ticks.length - 1].getTime() < now.getTime()) {
    ticks.push(new Date(now))
  }

  return ticks.map(tick => {
    const T = tick.getTime()
    const open = items.filter(i => isOpenAt(i, T))
    return {
      date: tick,
      total:    open.length,
      risk:     open.filter(i => i.type === 'risk').length,
      action:   open.filter(i => i.type === 'action').length,
      issue:    open.filter(i => i.type === 'issue').length,
      decision: open.filter(i => i.type === 'decision').length,
    }
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

const SERIES = [
  { key: 'risk'     as const, label: 'Risks',     color: '#f87171' },
  { key: 'action'   as const, label: 'Actions',   color: '#60a5fa' },
  { key: 'issue'    as const, label: 'Issues',    color: '#fbbf24' },
  { key: 'decision' as const, label: 'Decisions', color: '#c084fc' },
]

export function RiskTrajectoryChart({ items }: { items: RaidItem[] }) {
  const data = useMemo(() => buildTrajectory(items), [items])

  // Need at least 2 distinct date points to draw a meaningful chart
  if (data.length < 2 || data.every(p => p.total === data[0].total && p.total === 0)) {
    return null
  }

  // SVG layout
  const W  = 800
  const H  = 220
  const ml = 40, mr = 16, mt = 16, mb = 40
  const cw = W - ml - mr
  const ch = H - mt - mb

  const maxVal = Math.max(...data.map(p => p.total), 1)
  const yMax   = Math.ceil(maxVal * 1.15) || 1

  const firstMs = data[0].date.getTime()
  const lastMs  = data[data.length - 1].date.getTime()
  const span    = Math.max(1, lastMs - firstMs)

  const toX = (d: Date) => ml + ((d.getTime() - firstMs) / span) * cw
  const toY = (v: number) => mt + ch - (v / yMax) * ch

  // Y-axis ticks — at most 5 nice round numbers
  const yStep = Math.max(1, Math.ceil(yMax / 4))
  const yTicks = Array.from({ length: Math.floor(yMax / yStep) + 1 }, (_, i) => i * yStep).filter(v => v <= yMax)

  // X-axis — show every 2nd tick if crowded
  const xStep = data.length > 24 ? 4 : data.length > 12 ? 2 : 1
  const xTicks = data.filter((_, i) => i % xStep === 0 || i === data.length - 1)

  const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  // Total-area path (filled background)
  const areaPoints =
    data.map(p => `${toX(p.date)},${toY(p.total)}`).join(' ') +
    ` ${toX(data[data.length - 1].date)},${toY(0)} ${toX(data[0].date)},${toY(0)}`

  // Series polylines
  const linePath = (key: keyof TrajectoryPoint) =>
    data.map(p => `${toX(p.date)},${toY(p[key] as number)}`).join(' ')

  // Current count labels
  const latest = data[data.length - 1]

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Risk Trajectory</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Open items over time</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {SERIES.map(s => (
            <span key={s.key} className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="inline-block w-5 border-t-2 rounded" style={{ borderColor: s.color }} />
              {s.label}
              <span className="font-semibold tabular-nums" style={{ color: s.color }}>
                {latest[s.key]}
              </span>
            </span>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 200 }}>
        {/* Y grid + labels */}
        {yTicks.map(v => (
          <g key={v}>
            <line x1={ml} y1={toY(v)} x2={ml + cw} y2={toY(v)}
              stroke={v === 0 ? '#334155' : '#1e293b'} strokeWidth="1" />
            <text x={ml - 5} y={toY(v)} textAnchor="end" dominantBaseline="middle"
              fill="#64748b" fontSize={10}>{v}</text>
          </g>
        ))}

        {/* X ticks + labels */}
        {xTicks.map((p, i) => {
          const x = toX(p.date)
          return (
            <g key={i}>
              <line x1={x} y1={mt + ch} x2={x} y2={mt + ch + 4} stroke="#334155" strokeWidth="1" />
              <text x={x} y={mt + ch + 15} textAnchor="middle" fill="#64748b" fontSize={9}>
                {fmtDate(p.date)}
              </text>
            </g>
          )
        })}

        {/* Axes */}
        <line x1={ml} y1={mt} x2={ml} y2={mt + ch} stroke="#334155" strokeWidth="1" />
        <line x1={ml} y1={mt + ch} x2={ml + cw} y2={mt + ch} stroke="#334155" strokeWidth="1" />

        {/* Total area fill */}
        <polygon points={areaPoints} fill="#64748b" fillOpacity="0.08" />

        {/* Total outline */}
        <polyline
          points={data.map(p => `${toX(p.date)},${toY(p.total)}`).join(' ')}
          fill="none" stroke="#475569" strokeWidth="1.5" strokeDasharray="5,3"
          strokeLinejoin="round"
        />

        {/* Per-type lines */}
        {SERIES.map(s => (
          <polyline
            key={s.key}
            points={linePath(s.key)}
            fill="none"
            stroke={s.color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {/* Dots at latest values */}
        {SERIES.map(s => {
          const v = latest[s.key] as number
          if (v === 0) return null
          return (
            <circle key={s.key}
              cx={toX(latest.date)} cy={toY(v)} r={3.5}
              fill={s.color} stroke="#0f172a" strokeWidth="2"
            />
          )
        })}

        {/* Total dot */}
        <circle cx={toX(latest.date)} cy={toY(latest.total)} r={3}
          fill="#94a3b8" stroke="#0f172a" strokeWidth="2" />
      </svg>
    </div>
  )
}
