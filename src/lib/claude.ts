import Anthropic from '@anthropic-ai/sdk'

// Key priority: localStorage (set via Settings) → env var
export const getClaudeKey = () =>
  localStorage.getItem('anthropic_api_key') || import.meta.env.VITE_CLAUDE_API_KEY || ''

export const hasClaudeKey = () => Boolean(getClaudeKey())

// Fresh client each call so it always picks up the current key
export const getClaude = () =>
  new Anthropic({ apiKey: getClaudeKey(), dangerouslyAllowBrowser: true })

export const CLAUDE_MODEL = 'claude-sonnet-4-6'

// ─── Shared system prompt for all CRE PM features ─────────────────────────────
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

// ─── Simple streaming text call ───────────────────────────────────────────────
export async function streamClaude(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  onChunk: (text: string) => void,
  systemPrompt = CRE_SYSTEM_PROMPT,
  maxTokens = 1024,
): Promise<void> {
  const client = getClaude()
  const stream = client.messages.stream({
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
  })

  for await (const chunk of stream) {
    if (
      chunk.type === 'content_block_delta' &&
      chunk.delta.type === 'text_delta'
    ) {
      onChunk(chunk.delta.text)
    }
  }
}

// ─── Non-streaming call (returns full text) ───────────────────────────────────
export async function callClaude(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt = CRE_SYSTEM_PROMPT,
  maxTokens = 1024,
): Promise<string> {
  const client = getClaude()
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
  })
  return response.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('')
}
