/**
 * Stage 2 — Client Review Browser
 * Client sees all submitted vendor responses and picks which to review + validate.
 */
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronDown, ChevronRight, Search, UserCheck,
  CheckCircle2, XCircle, Clock, AlertTriangle, ShieldCheck,
} from 'lucide-react'
import { listQuestionStatuses, type DomainQuestionList, type QuestionStatusItem } from '../../api/responses'

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG = {
  not_started: { label: 'No response',   color: 'text-gray-400', Icon: Clock },
  draft:       { label: 'Draft',         color: 'text-gray-400', Icon: Clock },
  submitted:   { label: 'Pending Review',color: 'text-amber-600',             Icon: Clock },
  validated:   { label: 'AI Validated',  color: 'text-blue-600',            Icon: ShieldCheck },
  approved:    { label: 'Approved',      color: 'text-emerald-600',             Icon: CheckCircle2 },
  rejected:    { label: 'Rejected',      color: 'text-pink-600',              Icon: XCircle },
} as const

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CFG[status as keyof typeof STATUS_CFG] ?? STATUS_CFG.not_started
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cfg.color}`}>
      <cfg.Icon size={11} /> {cfg.label}
    </span>
  )
}

function AIVerdictBadge({ verdict }: { verdict: string | null }) {
  if (!verdict) return null
  const cfg = {
    compliant:     { label: 'Compliant',     cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
    partial:       { label: 'Partial',       cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
    non_compliant: { label: 'Non-Compliant', cls: 'bg-red-50 text-red-700 border border-red-200' },
  }[verdict]
  if (!cfg) return null
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

// ── Stage bar ─────────────────────────────────────────────────────────────────
function StageBar() {
  const stages = [
    { id: 'vendor', label: 'Vendor Response', done: true },
    { id: 'ai',     label: 'AI Analysis',     done: false },
    { id: 'client', label: 'Client Review',   done: false },
  ]
  return (
    <div className="flex items-center gap-2 mb-6 bg-white border border-gray-200 rounded-xl shadow-sm px-5 py-3">
      {stages.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold
            ${s.id === 'client' ? 'bg-blue-50 border-blue-200 text-blue-700' : s.done ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold
              ${s.id === 'client' ? 'bg-pink-500 text-white' : s.done ? 'bg-emerald-500 text-white' : 'bg-gray-50 text-gray-400'}`}>
              {s.done ? '✓' : i + 1}
            </span>
            {s.label}
          </div>
          {i < stages.length - 1 && <div className="w-8 h-px bg-gray-50" />}
        </div>
      ))}
    </div>
  )
}

// ── Domain accordion ──────────────────────────────────────────────────────────
function DomainSection({
  domain, search, onReview,
}: { domain: DomainQuestionList; search: string; onReview: (q: QuestionStatusItem) => void }) {
  const [open, setOpen] = useState(true)

  const filtered = search
    ? domain.questions.filter(q =>
        q.question_text.toLowerCase().includes(search.toLowerCase()) ||
        q.question_id.toLowerCase().includes(search.toLowerCase())
      )
    : domain.questions

  if (!filtered.length) return null

  const reviewable = domain.questions.filter(q =>
    ['submitted', 'validated', 'approved', 'rejected'].includes(q.response_status)
  ).length

  const pct = domain.total_count > 0
    ? Math.round(domain.approved_count / domain.total_count * 100) : 0

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-[rgba(255,77,141,0.03)] transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          {open ? <ChevronDown size={14} className="text-gray-500 shrink-0" />
                : <ChevronRight size={14} className="text-gray-500 shrink-0" />}
          <span className="text-xs font-bold text-pink-600 bg-pink-500/10 px-2 py-0.5 rounded font-mono shrink-0">
            {domain.domain_id}
          </span>
          <span className="text-sm font-semibold text-gray-900 truncate">{domain.domain_name}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-3">
          <span className="text-xs text-gray-400">
            {reviewable} to review · {domain.approved_count} approved
          </span>
          <div className="w-20 h-1.5 bg-gray-50 rounded-full overflow-hidden hidden sm:block">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </button>

      {open && (
        <div className="divide-y divide-gray-100 border-t border-gray-200">
          {filtered.map(q => {
            const canReview = ['submitted', 'validated', 'approved', 'rejected'].includes(q.response_status)
            return (
              <div key={q.question_id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-[rgba(255,77,141,0.03)] transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-gray-500">{q.question_id}</span>
                    <StatusPill status={q.response_status} />
                    <AIVerdictBadge verdict={q.ai_verdict} />
                    {q.ai_confidence_score != null && (
                      <span className="text-xs text-gray-400">
                        {q.ai_confidence_score.toFixed(0)}% conf.
                      </span>
                    )}
                    {q.evidence_count > 0 && (
                      <span className="text-xs text-gray-400">
                        {q.evidence_count} file{q.evidence_count !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 leading-snug">{q.question_text}</p>
                </div>
                <button
                  onClick={() => onReview(q)}
                  disabled={!canReview}
                  className={`shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all mt-0.5
                    ${canReview ? 'btn-primary py-1.5 px-3 text-xs' : 'opacity-30 cursor-not-allowed text-gray-400 border border-gray-200 rounded-lg'}`}
                >
                  <UserCheck size={12} />
                  {canReview ? 'Review' : 'No response'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Summary ───────────────────────────────────────────────────────────────────
function SummaryBar({ domains }: { domains: DomainQuestionList[] }) {
  const total     = domains.reduce((s, d) => s + d.total_count, 0)
  const submitted = domains.reduce((s, d) =>
    s + d.questions.filter(q => ['submitted','validated','approved','rejected'].includes(q.response_status)).length, 0)
  const approved  = domains.reduce((s, d) => s + d.approved_count, 0)
  const rejected  = domains.reduce((s, d) => s + d.rejected_count, 0)
  return (
    <div className="grid grid-cols-4 gap-3 mb-6">
      {[
        { label: 'Total',     value: total,     color: 'text-gray-900' },
        { label: 'To Review', value: submitted, color: 'text-amber-600' },
        { label: 'Approved',  value: approved,  color: 'text-emerald-600' },
        { label: 'Rejected',  value: rejected,  color: 'text-pink-600' },
      ].map(({ label, value, color }) => (
        <div key={label} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 text-center">
          <div className={`text-2xl font-bold ${color}`}>{value}</div>
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mt-1">{label}</div>
        </div>
      ))}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ClientBrowserPage() {
  const { id: auditId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('submitted')

  const { data, isLoading, error } = useQuery({
    queryKey: ['respond-list', auditId],
    queryFn: () => listQuestionStatuses(auditId!),
    enabled: !!auditId,
  })

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="spinner" />
    </div>
  )
  if (error || !data) return (
    <div className="p-8 text-center">
      <AlertTriangle className="mx-auto mb-2 text-pink-600" size={32} />
      <p className="text-gray-400">Failed to load questions.</p>
    </div>
  )

  const filtered = filter === 'all'
    ? data
    : data.map(d => ({
        ...d,
        questions: d.questions.filter(q => {
          if (filter === 'submitted') return ['submitted','validated','approved','rejected'].includes(q.response_status)
          return q.response_status === filter
        }),
      })).filter(d => d.questions.length > 0)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <StageBar />
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Client Review</h1>
        <p className="text-sm text-gray-500">
          Review submitted vendor responses, run AI validation, and approve or reject each question.
        </p>
      </div>

      <SummaryBar domains={data} />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search questions..." className="input-cosmos pl-9" />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="input-cosmos w-auto cursor-pointer">
          <option value="all">All</option>
          <option value="submitted">Submitted / Pending</option>
          <option value="validated">AI Validated</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {filtered.map(domain => (
        <DomainSection
          key={domain.domain_id}
          domain={domain}
          search={search}
          onReview={q => navigate(`/sessions/${auditId}/review/${q.question_id}`)}
        />
      ))}

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <UserCheck size={32} className="mx-auto mb-2" />
          <p>No submitted responses to review yet.</p>
          <p className="text-xs mt-1 text-gray-400">
            Vendor must submit responses before client review.
          </p>
        </div>
      )}
    </div>
  )
}
