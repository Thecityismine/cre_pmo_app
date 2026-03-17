import { useState, useRef, useEffect } from 'react'
import { clsx } from 'clsx'
import { AlertTriangle, Info, Sparkles, X, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import { useAIInsights } from '@/hooks/useAIInsights'
import { generateInsights, type InsightInput } from '@/lib/insightEngine'

// ─── Config ───────────────────────────────────────────────────────────────────

const SEVERITY_CFG = {
  critical: {
    icon: AlertTriangle,
    border: 'border-red-700/50',
    bg: 'bg-red-900/20',
    icon_color: 'text-red-400',
    badge: 'bg-red-900/60 text-red-300',
  },
  warning: {
    icon: AlertTriangle,
    border: 'border-amber-700/50',
    bg: 'bg-amber-900/20',
    icon_color: 'text-amber-400',
    badge: 'bg-amber-900/60 text-amber-300',
  },
  info: {
    icon: Info,
    border: 'border-blue-700/50',
    bg: 'bg-blue-900/20',
    icon_color: 'text-blue-400',
    badge: 'bg-blue-900/60 text-blue-300',
  },
}

// ─── Single insight card ──────────────────────────────────────────────────────

function InsightCard({
  insight,
  onDismiss,
}: {
  insight: ReturnType<typeof useAIInsights>['insights'][number]
  onDismiss: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const cfg = SEVERITY_CFG[insight.severity]
  const Icon = cfg.icon

  return (
    <div className={clsx('rounded-xl border px-3 py-2.5', cfg.bg, cfg.border)}>
      <div className="flex items-start gap-2">
        <Icon size={14} className={clsx('shrink-0 mt-0.5', cfg.icon_color)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1.5 text-left group"
            >
              <p className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
                {insight.title}
              </p>
              {expanded
                ? <ChevronDown size={12} className="text-slate-500 shrink-0" />
                : <ChevronRight size={12} className="text-slate-500 shrink-0" />}
            </button>
            <button
              onClick={onDismiss}
              className="p-0.5 text-slate-600 hover:text-slate-400 transition-colors shrink-0"
              title="Dismiss"
            >
              <X size={12} />
            </button>
          </div>
          {expanded && (
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">{insight.body}</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function AIInsightsPanel({
  input,
  maxShow = 5,
  compact = false,
}: {
  input: InsightInput
  maxShow?: number
  compact?: boolean
}) {
  const { insights, loading, dismiss, addInsight, deleteInsight } = useAIInsights(input.project.id)
  const [refreshing, setRefreshing] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const autoTriggered = useRef(false)

  // Auto-generate on first load when no insights exist in Firestore
  useEffect(() => {
    if (!loading && !refreshing && insights.length === 0 && !autoTriggered.current) {
      autoTriggered.current = true
      const fresh = generateInsights(input)
      Promise.all(fresh.map(i => addInsight(i))).catch(() => {})
    }
  }, [loading, insights.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const refreshInsights = async () => {
    setRefreshing(true)
    try {
      // Delete old auto-generated insights
      for (const i of insights) {
        await deleteInsight(i.id)
      }
      // Generate fresh ones
      const fresh = generateInsights(input)
      for (const i of fresh) {
        await addInsight(i)
      }
    } finally {
      setRefreshing(false)
    }
  }

  const visible = showAll ? insights : insights.slice(0, maxShow)
  const hiddenCount = insights.length - maxShow

  if (loading) return null

  return (
    <div className={clsx('space-y-2', compact && 'space-y-1.5')}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles size={13} className="text-blue-400" />
          <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
            AI Insights
            {insights.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-400 text-[10px] font-normal normal-case">
                {insights.length}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={refreshInsights}
          disabled={refreshing}
          className="p-1 text-slate-600 hover:text-slate-400 transition-colors"
          title="Refresh insights"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {insights.length === 0 ? (
        <div className="text-center py-3 text-slate-600 text-xs">
          <p>No active insights.</p>
          <button
            onClick={refreshInsights}
            disabled={refreshing}
            className="mt-1 text-blue-500 hover:text-blue-400 transition-colors"
          >
            {refreshing ? 'Analyzing...' : 'Analyze now'}
          </button>
        </div>
      ) : (
        <>
          <div className={clsx('space-y-1.5', compact && 'space-y-1')}>
            {visible.map(i => (
              <InsightCard key={i.id} insight={i} onDismiss={() => dismiss(i.id)} />
            ))}
          </div>
          {hiddenCount > 0 && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="text-xs text-slate-500 hover:text-slate-400 transition-colors w-full text-center py-1"
            >
              +{hiddenCount} more insight{hiddenCount > 1 ? 's' : ''}
            </button>
          )}
        </>
      )}
    </div>
  )
}
