import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import * as admin from 'firebase-admin'
import Anthropic from '@anthropic-ai/sdk'

admin.initializeApp()

const anthropicKey = defineSecret('ANTHROPIC_API_KEY')
const MODEL = 'claude-sonnet-4-6'

type Message = { role: 'user' | 'assistant'; content: string }

// ─── Non-streaming call (callable — Firebase handles auth automatically) ───────

export const claudeCall = onCall(
  { secrets: [anthropicKey], timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in to use AI features.')
    }

    const { messages, systemPrompt, maxTokens = 1024 } = request.data as {
      messages: Message[]
      systemPrompt: string
      maxTokens?: number
    }

    const client = new Anthropic({ apiKey: anthropicKey.value() })
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    })

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')

    return { text }
  }
)

// ─── Streaming call (HTTP + SSE — manual auth check) ──────────────────────────

export const claudeStream = onRequest(
  { secrets: [anthropicKey], cors: true, timeoutSeconds: 120 },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).end()
      return
    }

    // Verify Firebase ID token from Authorization header
    const authHeader = req.headers.authorization ?? ''
    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing auth token' })
      return
    }
    try {
      await admin.auth().verifyIdToken(authHeader.slice(7))
    } catch {
      res.status(401).json({ error: 'Invalid or expired auth token' })
      return
    }

    const { messages, systemPrompt, maxTokens = 1024 } = req.body as {
      messages: Message[]
      systemPrompt: string
      maxTokens?: number
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders()

    const client = new Anthropic({ apiKey: anthropicKey.value() })

    try {
      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages,
      })

      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`)
        }
      }
    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`)
    }

    res.write('data: [DONE]\n\n')
    res.end()
  }
)
