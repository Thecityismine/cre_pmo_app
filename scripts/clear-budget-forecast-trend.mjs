/**
 * Clear forecastTrend / forecastPrev on all budgetItems so the variance
 * change badge no longer appears from previous fee revisions.
 * Run: node scripts/clear-budget-forecast-trend.mjs
 */
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const serviceAccount = JSON.parse(readFileSync(resolve(__dirname, 'serviceAccountKey.json'), 'utf8'))
initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

async function run() {
  const snap = await db.collection('budgetItems').get()
  const affected = snap.docs.filter(d => {
    const data = d.data()
    return data.forecastTrend === 'up' || data.forecastTrend === 'down' || data.forecastPrev != null
  })

  console.log(`Found ${snap.size} total budgetItems, ${affected.length} with trend data to clear`)

  const CHUNK = 400
  for (let i = 0; i < affected.length; i += CHUNK) {
    const batch = db.batch()
    affected.slice(i, i + CHUNK).forEach(d => {
      const data = d.data()
      console.log(`  Clearing trend on: ${data.description || '(no description)'} — was ${data.forecastTrend}, prev ${data.forecastPrev}`)
      batch.update(d.ref, {
        forecastTrend: 'flat',
        forecastPrev: FieldValue.delete(),
        updatedAt: new Date().toISOString(),
      })
    })
    await batch.commit()
  }

  console.log('\nDone — all forecast trend badges cleared.')
}
run().catch(console.error)
