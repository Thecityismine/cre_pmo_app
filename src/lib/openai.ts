import OpenAI from 'openai'

// Key priority: localStorage (set via Settings page) → env var
export const getOpenAIKey = () =>
  localStorage.getItem('openai_api_key') || import.meta.env.VITE_OPENAI_API_KEY || ''

export const hasOpenAIKey = () => Boolean(getOpenAIKey())

// Create a fresh client each call so it always picks up the current key
export const getOpenAI = () =>
  new OpenAI({ apiKey: getOpenAIKey(), dangerouslyAllowBrowser: true })

// Backwards-compatible default export (uses env key at module load time — use getOpenAI() for fresh key)
export const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY || 'placeholder',
  dangerouslyAllowBrowser: true,
})
