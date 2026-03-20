import { getFunctions, httpsCallable } from 'firebase/functions'
import { auth } from '@/lib/firebase'

export const CLAUDE_MODEL = 'claude-sonnet-4-6'

// API key lives server-side in Firebase Secret Manager — always available
export const hasClaudeKey = () => true
/** @deprecated key is now server-side; kept for compat */
export const getClaudeKey = () => ''

// ─── Shared system prompt ──────────────────────────────────────────────────────
export const CRE_SYSTEM_PROMPT = `You are an expert CRE (Commercial Real Estate) project manager assistant with 20+ years of experience in tenant improvement and commercial build-out projects. You help project managers at JLL manage their project portfolios.

Always:
- Be specific and cite actual project data when provided (amounts, dates, names)
- Prioritize lease-critical dates above all else
- Flag financial risks proactively (budget overruns, CO exposure)
- Format responses in clear, professional language suitable for executive reporting
- Keep responses concise and actionable

Never:
- Make up data not present in the project context
- Give generic advice that ignores the actual project state`

// ─── Non-streaming call via Firebase callable function ────────────────────────
export async function callClaude(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt = CRE_SYSTEM_PROMPT,
  maxTokens = 1024,
): Promise<string> {
  const fn = httpsCallable<
    { messages: typeof messages; systemPrompt: string; maxTokens: number },
    { text: string }
  >(getFunctions(), 'claudeCall')
  const result = await fn({ messages, systemPrompt, maxTokens })
  return result.data.text
}

// ─── Streaming call via Firebase HTTP function + SSE ──────────────────────────
export async function streamClaude(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  onChunk: (text: string) => void,
  systemPrompt = CRE_SYSTEM_PROMPT,
  maxTokens = 1024,
): Promise<void> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error('Not signed in')

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string
  const region = import.meta.env.VITE_FUNCTIONS_REGION as string || 'us-central1'
  const url = `https://${region}-${projectId}.cloudfunctions.net/claudeStream`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ messages, systemPrompt, maxTokens }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Claude function error ${res.status}: ${body}`)
  }
  if (!res.body) throw new Error('No response body from Claude function')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') return
      try {
        const parsed = JSON.parse(data) as { text?: string; error?: string }
        if (parsed.error) throw new Error(parsed.error)
        if (parsed.text) onChunk(parsed.text)
      } catch { /* ignore parse errors on malformed lines */ }
    }
  }
}
