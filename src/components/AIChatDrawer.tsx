import { useState, useEffect, useRef, useCallback } from 'react'
import { clsx } from 'clsx'
import { X, Sparkles, Send, Loader2, Copy, Check, Trash2, ChevronDown } from 'lucide-react'
import { streamClaude, hasClaudeKey, CRE_SYSTEM_PROMPT } from '@/lib/claude'
import { useProjects } from '@/hooks/useProjects'
import { usePortfolioTasks } from '@/hooks/usePortfolioTasks'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

// ─── Suggested prompts ────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'What projects are most at risk right now?',
  'Which projects are over budget?',
  'Summarize the portfolio health across all active projects.',
  'What tasks are overdue across the portfolio?',
  'Which projects have the most upcoming milestones?',
]

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(msg.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isUser = msg.role === 'user'

  return (
    <div className={clsx('flex gap-2.5', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles size={13} className="text-white" />
        </div>
      )}
      <div className={clsx(
        'group max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
        isUser
          ? 'bg-blue-600 text-white rounded-br-sm'
          : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-bl-sm'
      )}>
        <p className="whitespace-pre-wrap">{msg.content}</p>
        {!isUser && (
          <button
            onClick={copy}
            className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            {copied ? <Check size={10} /> : <Copy size={10} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Build portfolio context string ──────────────────────────────────────────

function buildPortfolioContext(
  projects: ReturnType<typeof useProjects>['projects'],
  overdue: ReturnType<typeof usePortfolioTasks>['overdue'],
  upcoming: ReturnType<typeof usePortfolioTasks>['upcoming'],
): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

  const active = projects.filter(p => p.isActive)
  const projectSummaries = active.map(p => {
    const variance = p.totalBudget - p.forecastCost
    const overBudget = variance < 0
    return [
      `Project: ${p.projectName} (${p.projectNumber || 'no number'})`,
      `  Status: ${p.status} | Profile: ${p.profile} | Location: ${[p.city, p.state].filter(Boolean).join(', ')}`,
      `  Budget: ${fmt(p.totalBudget)} | Forecast: ${fmt(p.forecastCost)} ${overBudget ? `— OVER by ${fmt(Math.abs(variance))}` : `— under by ${fmt(variance)}`}`,
      `  PM: ${p.projectManager || 'N/A'} | Client: ${p.clientName || 'N/A'}`,
      p.targetCompletionDate ? `  Target Completion: ${p.targetCompletionDate}` : '',
    ].filter(Boolean).join('\n')
  }).join('\n\n')

  const overdueText = overdue.slice(0, 10).map(t =>
    `  - "${t.title}" (due ${t.dueDate})`
  ).join('\n')

  const upcomingText = upcoming.slice(0, 10).map(t =>
    `  - "${t.title}" (due ${t.dueDate})`
  ).join('\n')

  return `
=== PORTFOLIO OVERVIEW ===
Today: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
Active Projects: ${active.length} | Total Projects: ${projects.length}
Total Portfolio Budget: ${fmt(active.reduce((s, p) => s + p.totalBudget, 0))}
Projects Over Budget: ${active.filter(p => p.forecastCost > p.totalBudget).length}

=== ACTIVE PROJECTS ===
${projectSummaries || 'No active projects.'}

=== OVERDUE TASKS (${overdue.length} total) ===
${overdueText || 'None'}

=== UPCOMING TASKS — 14 DAYS (${upcoming.length} total) ===
${upcomingText || 'None'}
`.trim()
}

// ─── Main AIChatDrawer ────────────────────────────────────────────────────────

export function AIChatDrawer({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { projects } = useProjects()
  const { overdue, upcoming } = usePortfolioTasks()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const noKey = !hasClaudeKey()

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150)
  }, [open])

  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const portfolioContext = buildPortfolioContext(projects, overdue, upcoming)

  const systemPrompt = `${CRE_SYSTEM_PROMPT}

${portfolioContext}

Answer questions about this portfolio. Be specific, cite project names and numbers. Keep responses concise.`

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    }

    const aiMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg, aiMsg])
    setInput('')
    setStreaming(true)

    try {
      const history = [...messages, userMsg].map(m => ({
        role: m.role,
        content: m.content,
      }))

      await streamClaude(
        history,
        (chunk) => {
          setMessages(prev => prev.map(m =>
            m.id === aiMsg.id ? { ...m, content: m.content + chunk } : m
          ))
        },
        systemPrompt,
        1024,
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setMessages(prev => prev.map(m =>
        m.id === aiMsg.id
          ? { ...m, content: `Error: ${msg.includes('API key') ? 'Invalid API key. Check Settings → AI API Keys.' : msg}` }
          : m
      ))
    } finally {
      setStreaming(false)
    }
  }, [messages, streaming, systemPrompt])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 md:hidden"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className={clsx(
        'fixed right-0 top-0 h-full w-full sm:w-[420px] bg-slate-950 border-l border-slate-800 z-50',
        'flex flex-col shadow-2xl',
        'transition-transform duration-300',
        open ? 'translate-x-0' : 'translate-x-full'
      )}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center">
              <Sparkles size={14} className="text-white" />
            </div>
            <div>
              <p className="text-slate-100 font-semibold text-sm">AI Assistant</p>
              <p className="text-slate-500 text-[10px]">Powered by Claude · Portfolio context loaded</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
                title="Clear conversation"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* No key warning */}
        {noKey && (
          <div className="mx-4 mt-3 p-3 bg-amber-900/20 border border-amber-700/40 rounded-lg text-xs text-amber-300">
            Add your Anthropic API key in <strong>Settings → AI API Keys</strong> to enable the AI assistant.
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && !noKey ? (
            <div className="space-y-4">
              <div className="text-center py-6">
                <Sparkles size={28} className="mx-auto mb-3 text-blue-500 opacity-60" />
                <p className="text-slate-300 font-medium text-sm">Ask me anything about your portfolio</p>
                <p className="text-slate-500 text-xs mt-1">I have full context on all active projects, tasks, and budgets.</p>
              </div>
              <div className="space-y-2">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="w-full text-left text-xs px-3 py-2.5 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700 hover:border-slate-600 rounded-xl text-slate-300 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)
          )}

          {/* Streaming indicator */}
          {streaming && messages[messages.length - 1]?.content === '' && (
            <div className="flex gap-2.5">
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                <Sparkles size={13} className="text-white" />
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-slate-800 shrink-0">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about projects, budgets, tasks..."
              rows={1}
              disabled={noKey || streaming}
              className="flex-1 resize-none bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none disabled:opacity-50 max-h-32 overflow-y-auto"
              style={{ minHeight: '42px' }}
            />
            <button
              type="submit"
              disabled={!input.trim() || noKey || streaming}
              className="p-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors shrink-0"
            >
              {streaming
                ? <Loader2 size={16} className="animate-spin" />
                : <Send size={16} />
              }
            </button>
          </div>
          <p className="text-[10px] text-slate-600 mt-1.5 text-center">Press Enter to send · Shift+Enter for new line</p>
        </form>
      </div>
    </>
  )
}

// ─── Trigger button (shown in topbar) ────────────────────────────────────────

export function AIChatButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/40 hover:border-blue-500/60 text-blue-300 hover:text-blue-200 rounded-lg text-xs font-medium transition-colors"
      title="Open AI Assistant (⌘K)"
    >
      <Sparkles size={13} />
      <span className="hidden sm:inline">AI Assistant</span>
      <kbd className="hidden sm:inline text-[9px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded ml-0.5">⌘K</kbd>
    </button>
  )
}

// ─── Keyboard shortcut hook ───────────────────────────────────────────────────

export function useAIChatShortcut(onToggle: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onToggle()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onToggle])
}

// Suppress unused import warning
const _unused = ChevronDown
void _unused
