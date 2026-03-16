import OpenAI from 'openai'

export const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
})

export const hasOpenAIKey = () =>
  Boolean(import.meta.env.VITE_OPENAI_API_KEY) &&
  import.meta.env.VITE_OPENAI_API_KEY !== 'your-openai-api-key-here'
