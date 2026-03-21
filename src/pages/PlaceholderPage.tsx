import { Construction } from 'lucide-react'

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
      <Construction size={40} className="mb-4 opacity-40" />
      <p className="text-lg font-medium text-slate-400">{title}</p>
      <p className="text-sm mt-1">Coming soon — this module is in development.</p>
    </div>
  )
}
