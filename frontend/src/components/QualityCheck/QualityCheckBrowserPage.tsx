/**
 * Quality Check — question browser
 * Single unified view: browse all questions, see status, open to respond + analyse.
 */
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronDown, ChevronRight, Search, ShieldCheck,
  CheckCircle2, Clock, Circle, AlertTriangle, Zap,
} from 'lucide-react'
import {
  listQuestionStatuses, type DomainQuestionList, type QuestionStatusItem,
} from '../../api/responses'

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS = {
  not_started: { label: 'Not started', dot: 'bg-gray-300', text: 'text-gray-400', Icon: Circle },
  draft:       { label: 'Draft',       dot: 'bg-amber-400', text: 'text-amber-600', Icon: Clock },
  analysed:    { label: 'Analysed',    dot: 'bg-emerald-500', text: 'text-emerald-600', Icon: CheckCircle2 },
} as const

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS[status as keyof typeof STATUS] ?? STATUS.not_started
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

function VerdictBadge({ verdict }: { verdict: string | null }) {
  if (!verdict) return null
  const cfg = {
    compliant:     { cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200', label: 'Compliant' },
    partial:       { cls: 'bg-amber-50 text-amber-700 border border-amber-200',       label: 'Partial' },
    non_compliant: { cls: 'bg-red-50 text-red-700 border border-red-200',             label: 'Non-Compliant' },
  }[verdict]
  if (!cfg) return null
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

// ── Domain accordion ──────────────────────────────────────────────────────────
function DomainSection({
  domain, search, onOpen,
}: { domain: DomainQuestionList; search: string; onOpen: (q: QuestionStatusItem) => void }) {
  const [open, setOpen] = useState(true)

  const filtered = search
    ? domain.questions.filter(q =>
        q.question_text.toLowerCase().includes(search.toLowerCase()) ||
        q.question_id.toLowerCase().includes(search.toLowerCase())
      )
    : domain.questions

  if (!filtered.length) return null

  const pct = domain.total_count > 0
    ? Math.round(domain.analysed_count / domain.total_count * 100) : 0

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          {open ? <ChevronDown size={14} className="text-gray-500 shrink-0" />
                : <ChevronRight size={14} className="text-gray-500 shrink-0" />}
          <span className="text-xs font-bold text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded font-mono shrink-0">
            {domain.domain_id}
          </span>
          <span className="text-sm font-semibold text-gray-900 truncate">{domain.domain_name}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-3">
          <span className="text-xs text-gray-400">
            {domain.analysed_count}/{domain.total_count} analysed
          </span>
          <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden hidden sm:block">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </button>

      {open && (
        <div className="divide-y divide-gray-100 border-t border-gray-200">
          {filtered.map(q => (
            <div
              key={q.question_id}
              className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-gray-500">{q.question_id}</span>
                  <StatusPill status={q.response_status} />
                  <VerdictBadge verdict={q.ai_verdict} />
                  {q.ai_confidence_score != null && (
                    <span className="text-xs text-gray-400">{q.ai_confidence_score.toFixed(0)}% conf.</span>
                  )}
                  {q.evidence_count > 0 && (
                    <span className="text-xs text-gray-400">
                      {q.evidence_count} file{q.evidence_count !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 leading-snug">{q.question_text}</p>
              </div>
              <button
                onClick={() => onOpen(q)}
                className="shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg btn-primary mt-0.5"
              >
                <ShieldCheck size={12} />
                {q.response_status === 'not_started' ? 'Start' : q.response_status === 'draft' ? 'Continue' : 'Re-check'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Summary bar ───────────────────────────────────────────────────────────────
function SummaryBar({ domains }: { domains: DomainQuestionList[] }) {
  const total    = domains.reduce((s, d) => s + d.total_count, 0)
  const analysed = domains.reduce((s, d) => s + d.analysed_count, 0)
  const draft    = domains.reduce((s, d) => s + d.draft_count, 0)
  const pending  = total - analysed - draft
  const pct = total > 0 ? Math.round(analysed / total * 100) : 0

  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      {[
        { label: 'Total',    value: total,    color: 'text-gray-900' },
        { label: 'In Draft', value: draft,    color: 'text-amber-600' },
        { label: 'Analysed', value: analysed, color: 'text-emerald-600' },
      ].map(({ label, value, color }) => (
        <div key={label} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 text-center">
          <div className={`text-2xl font-bold ${color}`}>{value}</div>
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mt-1">{label}</div>
        </div>
      ))}
      <div className="col-span-3 bg-white border border-gray-200 rounded-xl shadow-sm px-5 py-3 flex items-center gap-4">
        <span className="text-xs text-gray-500 shrink-0">Analysis progress</span>
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-sm font-bold text-emerald-600 shrink-0">{pct}%</span>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function QualityCheckBrowserPage() {
  const { id: auditId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const { data, isLoading, error } = useQuery({
    queryKey: ['respond-list', auditId],
    queryFn: () => listQuestionStatuses(auditId!),
    enabled: !!auditId,
    refetchInterval: 10_000,
  })

  if (isLoading) return (
    <div className="flex items-center justify-center h-64"><div className="spinner" /></div>
  )
  if (error || !data) return (
    <div className="p-8 text-center">
      <AlertTriangle className="mx-auto mb-2 text-pink-600" size={32} />
      <p className="text-gray-400">Failed to load questions.</p>
    </div>
  )

  const filtered = statusFilter === 'all'
    ? data
    : data.map(d => ({
        ...d,
        questions: d.questions.filter(q => q.response_status === statusFilter),
      })).filter(d => d.questions.length > 0)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
            <Zap size={15} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Quality Check</h1>
        </div>
        <p className="text-sm text-gray-500">
          Enter your justification, upload evidence, and run AI analysis for each question.
          You can re-submit and re-analyse any question at any time.
        </p>
      </div>

      <SummaryBar domains={data} />

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search questions…"
            className="input-cosmos pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="input-cosmos w-auto cursor-pointer"
        >
          <option value="all">All</option>
          <option value="not_started">Not started</option>
          <option value="draft">Draft</option>
          <option value="analysed">Analysed</option>
        </select>
      </div>

      {filtered.map(domain => (
        <DomainSection
          key={domain.domain_id}
          domain={domain}
          search={search}
          onOpen={q => navigate(`/sessions/${auditId}/check/${q.question_id}`)}
        />
      ))}

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Search size={32} className="mx-auto mb-2" />
          <p>No questions match your filter.</p>
        </div>
      )}
    </div>
  )
}
