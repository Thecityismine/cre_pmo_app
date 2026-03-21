import { useMemo } from 'react'
import type { ScheduleItem } from '@/hooks/useScheduleItems'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseD(s: string): Date {
  if (!s) return new Date(NaN)
  if (s.includes('T')) return new Date(s)
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d)
  r.setMonth(r.getMonth() + n)
  return r
}

function monthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

// ─── S-Curve computation ──────────────────────────────────────────────────────

interface SCPoint { date: Date; baseline: number; actual: number }

function buildSCurve(items: ScheduleItem[]): SCPoint[] {
  const usable = items.filter(i => i.baselineStart && i.baselineEnd)
  if (usable.length === 0) return []

  // Weight each activity by its baseline duration (longer = more weight)
  const durations = usable.map(i =>
    Math.max(1, (parseD(i.baselineEnd).getTime() - parseD(i.baselineStart).getTime()) / 86_400_000)
  )
  const totalDur = durations.reduce((a, b) => a + b, 0)
  const weights = durations.map(d => d / totalDur)

  // Chart date range: earliest baseline start → latest baseline end + 1 month
  const allStarts = usable.map(i => parseD(i.baselineStart).getTime())
  const allEnds   = usable.map(i => parseD(i.baselineEnd).getTime())
  const rangeStart = monthStart(new Date(Math.min(...allStarts)))
  const rangeEnd   = monthStart(addMonths(new Date(Math.max(...allEnds)), 1))

  // Monthly tick points
  const ticks: Date[] = []
  let cur = new Date(rangeStart)
  while (cur <= rangeEnd) {
    ticks.push(new Date(cur))
    cur = addMonths(cur, 1)
  }

  const todayMs = Date.now()

  return ticks.map(tick => {
    const T = tick.getTime()
    let baseline = 0
    let actual   = 0

    usable.forEach((item, idx) => {
      const w      = weights[idx]
      const bStart = parseD(item.baselineStart).getTime()
      const bEnd   = parseD(item.baselineEnd).getTime()
      const aStart = item.startDate ? parseD(item.startDate).getTime() : bStart
      const pct    = item.percentComplete / 100

      // ── Baseline ──────────────────────────────────────────────────────────
      if (T <= bStart)     baseline += 0
      else if (T >= bEnd)  baseline += w
      else                 baseline += w * (T - bStart) / (bEnd - bStart)

      // ── Actual / Forecast ─────────────────────────────────────────────────
      if (pct >= 1) {
        // Fully complete — use actual end if available, otherwise baseline end
        const doneMs = item.endDate ? parseD(item.endDate).getTime() : bEnd
        if (T <= aStart) actual += 0
        else if (T >= doneMs) actual += w
        else actual += w * (T - aStart) / Math.max(1, doneMs - aStart)
        return
      }

      if (T <= aStart) { actual += 0; return }

      // Estimate forecast completion date
      let forecastEnd: number
      if (item.endDate) {
        forecastEnd = parseD(item.endDate).getTime()
      } else if (pct > 0) {
        // Time-based extrapolation: elapsed / pct = total → end = start + total
        const elapsed = todayMs - aStart
        forecastEnd = aStart + elapsed / pct
      } else {
        forecastEnd = bEnd
      }
      // Ensure forecast end is at least 1 day past today to avoid divide-by-zero
      forecastEnd = Math.max(forecastEnd, todayMs + 86_400_000)

      if (T >= forecastEnd) actual += w
      else actual += w * clamp((T - aStart) / (forecastEnd - aStart), 0, 1)
    })

    return {
      date: tick,
      baseline: clamp(baseline * 100, 0, 100),
      actual:   clamp(actual   * 100, 0, 100),
    }
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SCurveChart({ items }: { items: ScheduleItem[] }) {
  const data = useMemo(() => buildSCurve(items), [items])

  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 bg-slate-900 border border-slate-800 rounded-xl">
        <p className="text-sm">Add baseline start & end dates to activities to see the S-Curve.</p>
      </div>
    )
  }

  // SVG layout constants
  const W  = 800
  const H  = 300
  const ml = 48, mr = 16, mt = 20, mb = 48
  const cw = W - ml - mr
  const ch = H - mt - mb

  const firstMs = data[0].date.getTime()
  const lastMs  = data[data.length - 1].date.getTime()
  const span    = Math.max(1, lastMs - firstMs)

  const toX = (d: Date) => ml + ((d.getTime() - firstMs) / span) * cw
  const toY = (v: number) => mt + ch - (v / 100) * ch

  // Today marker
  const todayMs  = Date.now()
  const todayX   = todayMs > firstMs && todayMs < lastMs
    ? ml + ((todayMs - firstMs) / span) * cw
    : null

  // X-axis label density
  const step   = data.length > 20 ? 3 : data.length > 12 ? 2 : 1
  const xTicks = data.filter((_, i) => i % step === 0)
  const yTicks = [0, 25, 50, 75, 100]

  const fmtTick = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })

  // Polyline points
  const baselinePts = data.map(p => `${toX(p.date)},${toY(p.baseline)}`).join(' ')
  const actualPts   = data.map(p => `${toX(p.date)},${toY(p.actual)}`).join(' ')

  // Area fill for actual curve
  const areaFill = actualPts
    + ` ${toX(data[data.length - 1].date)},${toY(0)}`
    + ` ${toX(data[0].date)},${toY(0)}`

  // Variance label at last data point
  const last = data[data.length - 1]
  const variance = Math.round(last.actual - last.baseline)
  const varColor = variance >= 0 ? '#34d399' : '#f87171'
  const varLabel = variance >= 0 ? `+${variance}%` : `${variance}%`

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
        <div>
          <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
            S-Curve — Forecast vs Baseline
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Cumulative % complete over time · weighted by activity duration
          </p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="inline-block w-6 border-t-2 border-dashed border-blue-500" />
            Baseline
          </span>
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="inline-block w-6 border-t-2 border-emerald-400" />
            Actual / Forecast
          </span>
          {todayX && (
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="inline-block w-0.5 h-3 bg-amber-400" />
              Today
            </span>
          )}
          {/* Variance badge */}
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: variance >= 0 ? '#064e3b' : '#450a0a', color: varColor }}
          >
            {varLabel} vs baseline
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 260 }}>
        {/* Horizontal grid + Y labels */}
        {yTicks.map(v => (
          <g key={v}>
            <line x1={ml} y1={toY(v)} x2={ml + cw} y2={toY(v)}
              stroke={v === 0 ? '#334155' : '#1e293b'} strokeWidth="1" />
            <text x={ml - 6} y={toY(v)} textAnchor="end" dominantBaseline="middle"
              fill="#64748b" fontSize={10}>
              {v}%
            </text>
          </g>
        ))}

        {/* X-axis ticks + labels */}
        {xTicks.map((p, i) => {
          const x = toX(p.date)
          return (
            <g key={i}>
              <line x1={x} y1={mt + ch} x2={x} y2={mt + ch + 4} stroke="#334155" strokeWidth="1" />
              <text x={x} y={mt + ch + 16} textAnchor="middle" fill="#64748b" fontSize={9}>
                {fmtTick(p.date)}
              </text>
            </g>
          )
        })}

        {/* Today vertical line */}
        {todayX && (
          <>
            <line x1={todayX} y1={mt} x2={todayX} y2={mt + ch}
              stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="4,3" />
            <text x={todayX + 4} y={mt + 10} fill="#fbbf24" fontSize={9} fontWeight="500">
              Today
            </text>
          </>
        )}

        {/* Axes */}
        <line x1={ml} y1={mt} x2={ml} y2={mt + ch} stroke="#334155" strokeWidth="1" />
        <line x1={ml} y1={mt + ch} x2={ml + cw} y2={mt + ch} stroke="#334155" strokeWidth="1" />

        {/* Baseline area (very faint) */}
        <polygon
          points={`${data.map(p => `${toX(p.date)},${toY(p.baseline)}`).join(' ')} ${toX(data[data.length - 1].date)},${toY(0)} ${toX(data[0].date)},${toY(0)}`}
          fill="#3b82f6" fillOpacity="0.04"
        />

        {/* Baseline line (dashed blue) */}
        <polyline points={baselinePts} fill="none"
          stroke="#3b82f6" strokeWidth="2" strokeDasharray="7,4" strokeLinejoin="round" />

        {/* Actual/Forecast area fill */}
        <polygon points={areaFill} fill="#34d399" fillOpacity="0.07" />

        {/* Actual/Forecast line (solid emerald) */}
        <polyline points={actualPts} fill="none"
          stroke="#34d399" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

        {/* Dot at last actual point */}
        <circle cx={toX(last.date)} cy={toY(last.actual)} r={4}
          fill="#34d399" stroke="#0f172a" strokeWidth="2" />
        <circle cx={toX(last.date)} cy={toY(last.baseline)} r={3}
          fill="#3b82f6" stroke="#0f172a" strokeWidth="2" />
      </svg>
    </div>
  )
}
