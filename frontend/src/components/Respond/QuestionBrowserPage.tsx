/**
 * Stage 1 — Vendor Response Browser
 * Browse all audit questions grouped by domain. Vendor selects which to answer.
 */
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronDown, ChevronRight, Search, MessageSquarePlus,
  CheckCircle2, Clock, Circle, Send, AlertTriangle,
} from 'lucide-react'
import {
  listQuestionStatuses, type DomainQuestionList, type QuestionStatusItem,
} from '../../api/responses'

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS = {
  not_started: { label: 'Not started', dot: 'bg-gray-300',  text: 'text-gray-400', Icon: Circle },
  draft:       { label: 'Draft',       dot: 'bg-amber-400',              text: 'text-amber-600',             Icon: Clock },
  submitted:   { label: 'Submitted',   dot: 'bg-blue-500',             text: 'text-blue-600',            Icon: Send },
  validated:   { label: 'Validated',   dot: 'bg-emerald-500',              text: 'text-emerald-600',             Icon: CheckCircle2 },
  approved:    { label: 'Approved',    dot: 'bg-emerald-500',              text: 'text-emerald-600',             Icon: CheckCircle2 },
  rejected:    { label: 'Rejected',    dot: 'bg-pink-500',               text: 'text-pink-600',              Icon: AlertTriangle },
} as const

type StatusKey = keyof typeof STATUS

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS[status as StatusKey] ?? STATUS.not_started
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

// ── Stage indicator ───────────────────────────────────────────────────────────
function StageBar({ active }: { active: 'vendor' | 'ai' | 'client' }) {
  const stages = [
    { id: 'vendor', label: 'Vendor Response' },
    { id: 'ai',     label: 'AI Analysis' },
    { id: 'client', label: 'Client Review' },
  ]
  return (
    <div className="flex items-center gap-2 mb-6 bg-white border border-gray-200 rounded-xl shadow-sm px-5 py-3">
      {stages.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all
            ${s.id === active ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold
              ${s.id === active ? 'bg-blue-500 text-gray-900' : 'bg-gray-50 text-gray-400'}`}>
              {i + 1}
            </span>
            {s.label}
          </div>
          {i < stages.length - 1 && (
            <div className="w-8 h-px bg-gray-50" />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Domain accordion ──────────────────────────────────────────────────────────
function DomainSection({
  domain, search, onRespond,
}: { domain: DomainQuestionList; search: string; onRespond: (q: QuestionStatusItem) => void }) {
  const [open, setOpen] = useState(true)

  const filtered = search
    ? domain.questions.filter(q =>
        q.question_text.toLowerCase().includes(search.toLowerCase()) ||
        q.question_id.toLowerCase().includes(search.toLowerCase())
      )
    : domain.questions

  if (!filtered.length) return null

  const pct = domain.total_count > 0
    ? Math.round(domain.submitted_count / domain.total_count * 100) : 0

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-3">
      {/* Domain header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-blue-50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          {open
            ? <ChevronDown size={14} className="text-gray-500 shrink-0" />
            : <ChevronRight size={14} className="text-gray-500 shrink-0" />}
          <span className="text-xs font-bold text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded font-mono shrink-0">
            {domain.domain_id}
          </span>
          <span className="text-sm font-semibold text-gray-900 truncate">{domain.domain_name}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-3">
          <span className="text-xs text-gray-400">
            {domain.submitted_count}/{domain.total_count} submitted
          </span>
          <div className="w-20 h-1.5 bg-gray-50 rounded-full overflow-hidden hidden sm:block">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-pink-500 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </button>

      {/* Questions */}
      {open && (
        <div className="divide-y divide-gray-100 border-t border-gray-200">
          {filtered.map(q => {
            const canEdit = q.response_status === 'not_started' || q.response_status === 'draft'
            return (
              <div
                key={q.question_id}
                className="flex items-start gap-3 px-5 py-3.5 hover:bg-blue-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-gray-500">{q.question_id}</span>
                    <StatusPill status={q.response_status} />
                    {q.evidence_count > 0 && (
                      <span className="text-xs text-gray-400">
                        {q.evidence_count} file{q.evidence_count !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 leading-snug">{q.question_text}</p>
                  {q.focus_controls.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {q.focus_controls.slice(0, 2).join(' · ')}
                      {q.focus_controls.length > 2 ? ` +${q.focus_controls.length - 2}` : ''}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => onRespond(q)}
                  className={`shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all mt-0.5
                    ${canEdit
                      ? 'btn-primary text-xs py-1.5 px-3'
                      : 'btn-secondary text-xs py-1.5 px-3'}`}
                >
                  <MessageSquarePlus size={12} />
                  {canEdit ? (q.response_status === 'not_started' ? 'Respond' : 'Edit') : 'View'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Summary bar ───────────────────────────────────────────────────────────────
function SummaryBar({ domains }: { domains: DomainQuestionList[] }) {
  const total     = domains.reduce((s, d) => s + d.total_count, 0)
  const submitted = domains.reduce((s, d) => s + d.submitted_count, 0)
  const notStarted = total - domains.reduce((s, d) =>
    s + d.questions.filter(q => q.response_status !== 'not_started').length, 0)
  const pct = total > 0 ? Math.round(submitted / total * 100) : 0

  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      {[
        { label: 'Total Questions', value: total,      color: 'text-gray-900' },
        { label: 'Not Started',     value: notStarted, color: 'text-gray-400' },
        { label: 'Submitted',       value: submitted,  color: 'text-blue-600' },
      ].map(({ label, value, color }) => (
        <div key={label} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 text-center">
          <div className={`text-2xl font-bold ${color}`}>{value}</div>
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mt-1">{label}</div>
        </div>
      ))}
      {/* Full-width progress */}
      <div className="col-span-3 bg-white border border-gray-200 rounded-xl shadow-sm px-5 py-3 flex items-center gap-4">
        <span className="text-xs text-gray-500 shrink-0">Overall progress</span>
        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-sm font-bold text-emerald-600 shrink-0">{pct}%</span>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function QuestionBrowserPage() {
  const { id: auditId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

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

  const filtered = statusFilter === 'all'
    ? data
    : data.map(d => ({
        ...d,
        questions: d.questions.filter(q => q.response_status === statusFilter),
      })).filter(d => d.questions.length > 0)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <StageBar active="vendor" />

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Vendor Response</h1>
        <p className="text-sm text-gray-500">
          Select any question to provide your response and upload supporting evidence.
        </p>
      </div>

      <SummaryBar domains={data} />

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search questions..."
            className="input-cosmos pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="input-cosmos w-auto cursor-pointer"
        >
          <option value="all">All statuses</option>
          <option value="not_started">Not started</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
        </select>
      </div>

      {filtered.map(domain => (
        <DomainSection
          key={domain.domain_id}
          domain={domain}
          search={search}
          onRespond={q => navigate(`/sessions/${auditId}/respond/${q.question_id}`)}
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
