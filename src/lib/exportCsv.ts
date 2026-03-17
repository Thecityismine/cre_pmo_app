import type { Project } from '@/types'

function esc(val: unknown): string {
  const s = String(val ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function exportProjectsCsv(projects: Project[], filename = 'projects.csv') {
  const headers = [
    'Project Name', 'Project Number', 'Status', 'Profile', 'Active',
    'City', 'State', 'Client', 'Business Unit', 'Project Manager',
    'Total Budget', 'Committed', 'Forecast Cost', 'Actual Cost', 'Variance',
    'RSF', 'Start Date', 'Target Completion',
  ]

  const rows = projects.map(p => [
    p.projectName,
    p.projectNumber,
    p.status,
    p.profile === 'L' ? 'Light' : p.profile === 'S' ? 'Standard' : 'Enhanced',
    p.isActive ? 'Yes' : 'No',
    p.city,
    p.state,
    p.clientName,
    p.businessUnit,
    p.projectManager,
    p.totalBudget,
    p.committedCost,
    p.forecastCost,
    p.actualCost,
    p.totalBudget - p.forecastCost,
    p.rsf ?? '',
    p.startDate ?? '',
    p.targetCompletionDate ?? '',
  ])

  const csv = [headers, ...rows].map(r => r.map(esc).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
