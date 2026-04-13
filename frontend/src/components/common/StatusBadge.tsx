import type { Verdict, AuditStatus } from '../../types'

const VERDICT_CFG: Record<string, { cls: string; label: string }> = {
  compliant:     { cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200',     label: 'Compliant' },
  partial:       { cls: 'bg-amber-50 text-amber-700 border border-amber-200',       label: 'Partial' },
  non_compliant: { cls: 'bg-red-50 text-red-700 border border-red-200', label: 'Non-Compliant' },
}

const STATUS_CFG: Record<string, { cls: string }> = {
  pending:   { cls: 'bg-gray-50 text-gray-400 border border-gray-200' },
  running:   { cls: 'bg-blue-500/10 text-blue-600 border border-blue-200' },
  completed: { cls: 'bg-emerald-500/10 text-emerald-600 border border-emerald-200' },
  failed:    { cls: 'bg-pink-500/10 text-pink-600 border border-pink-200' },
}

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const cfg = VERDICT_CFG[verdict]
  if (!cfg) return null
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.pending
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.cls}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

export function ConfidenceBadge({ score }: { score: number }) {
  const color = score >= 75 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-pink-600'
  return <span className={`text-sm font-bold ${color}`}>{Math.round(score)}%</span>
}
