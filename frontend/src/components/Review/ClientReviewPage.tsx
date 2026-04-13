/**
 * Stage 2 — Client Review Page
 * Client reviews vendor response + evidence, triggers AI validation,
 * then approves or rejects with optional notes.
 */
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, ShieldCheck, CheckCircle2, XCircle,
  FileText, Loader2, ChevronDown, ChevronUp,
  AlertCircle, AlertTriangle, UserCheck,
} from 'lucide-react'
import {
  getQuestionResponse, validateResponse, clientReview,
  type QuestionResponseOut, type EvidenceAssessment,
} from '../../api/responses'
import { listQuestionStatuses, type QuestionStatusItem } from '../../api/responses'

// ── Verdict pill ──────────────────────────────────────────────────────────────
function VerdictPill({ verdict }: { verdict: string }) {
  const cfg = {
    compliant:     { cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200',     label: 'Compliant',     Icon: CheckCircle2 },
    partial:       { cls: 'bg-amber-50 text-amber-700 border border-amber-200',       label: 'Partial',       Icon: AlertTriangle },
    non_compliant: { cls: 'bg-red-50 text-red-700 border border-red-200', label: 'Non-Compliant', Icon: XCircle },
  }[verdict]
  if (!cfg) return null
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${cfg.cls}`}>
      <cfg.Icon size={13} /> {cfg.label}
    </span>
  )
}

function ConfidenceBar({ score }: { score: number }) {
  const cls = score >= 70 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : score >= 40 ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-red-400 to-red-500'
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${cls}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-sm font-bold text-gray-900 w-10 text-right">{score.toFixed(0)}%</span>
    </div>
  )
}

// ── Evidence file row (read-only with AI assessment) ──────────────────────────
function EvidenceRow({
  file, assessment,
}: {
  file: QuestionResponseOut['evidence_files'][0]
  assessment?: EvidenceAssessment
}) {
  const hasAssessment = !!assessment
  const good = hasAssessment && assessment.relevant && assessment.supports_answer
  const partial = hasAssessment && assessment.relevant && !assessment.supports_answer
  return (
    <div className={`rounded-xl p-3 border transition-all ${
      !hasAssessment ? 'bg-blue-50 border-blue-200'
      : good ? 'bg-emerald-50 border-emerald-200'
      : partial ? 'bg-amber-50 border-amber-200'
      : 'bg-pink-50 border-pink-200'
    }`}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
          <FileText size={13} className="text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{file.original_filename}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs font-mono text-gray-500 uppercase">{file.file_type}</span>
            {file.file_size_bytes && (
              <span className="text-xs text-gray-400">{(file.file_size_bytes / 1024).toFixed(1)} KB</span>
            )}
            {file.extraction_error
              ? <span className="text-xs text-pink-600 flex items-center gap-1"><AlertCircle size={10} /> OCR error</span>
              : <span className="text-xs text-emerald-600">✓ Parsed</span>}
          </div>
        </div>
        {hasAssessment && (
          <div className="shrink-0">
            {good    && <CheckCircle2 size={16} className="text-emerald-600" />}
            {partial && <AlertTriangle size={16} className="text-amber-600" />}
            {!good && !partial && <XCircle size={16} className="text-pink-600" />}
          </div>
        )}
      </div>
      {assessment?.notes && (
        <p className={`mt-2 text-xs px-2 leading-relaxed ${
          good ? 'text-emerald-600/80' : partial ? 'text-amber-600/80' : 'text-pink-600/80'
        }`}>
          {assessment.notes}
        </p>
      )}
    </div>
  )
}

// ── AI Validation panel ───────────────────────────────────────────────────────
function AIValidationPanel({ resp }: { resp: QuestionResponseOut }) {
  const [showGaps, setShowGaps] = useState(true)

  if (!resp.ai_verdict) return null
  const assessMap: Record<string, EvidenceAssessment> = {}
  for (const ea of resp.ai_evidence_assessments ?? []) {
    assessMap[ea.filename] = ea
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden ${
      resp.ai_verdict === 'compliant'     ? 'border-emerald-200'
      : resp.ai_verdict === 'partial'     ? 'border-amber-200'
      : 'border-pink-200'
    }`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-5 py-3.5 border-b border-gray-200 ${
        resp.ai_verdict === 'compliant'     ? 'bg-emerald-50'
        : resp.ai_verdict === 'partial'     ? 'bg-amber-50'
        : 'bg-pink-50'
      }`}>
        <div className="flex items-center gap-2">
          <ShieldCheck size={15} className="text-gray-500" />
          <span className="text-sm font-semibold text-gray-900">AI Analysis Result</span>
          {resp.ai_model_used && (
            <span className="text-xs font-mono text-gray-400">({resp.ai_model_used})</span>
          )}
        </div>
        <VerdictPill verdict={resp.ai_verdict} />
      </div>

      <div className="p-5 space-y-5">
        {/* Confidence */}
        <div>
          <div className="flex justify-between mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Confidence Score</span>
          </div>
          <ConfidenceBar score={resp.ai_confidence_score ?? 0} />
        </div>

        {/* Summary */}
        {resp.ai_validation_summary && (
          <p className="text-sm text-gray-400 leading-relaxed border-l-2 border-blue-300 pl-3">
            {resp.ai_validation_summary}
          </p>
        )}

        {/* Answer + Justification assessment */}
        {resp.ai_answer_assessment && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Response Assessment</p>
            <p className="text-sm text-gray-400">{resp.ai_answer_assessment}</p>
          </div>
        )}

        {/* Evidence file assessments */}
        {resp.evidence_files.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Evidence Assessment</p>
            <div className="space-y-2">
              {resp.evidence_files.map(ef => (
                <EvidenceRow key={ef.id} file={ef} assessment={assessMap[ef.original_filename]} />
              ))}
            </div>
          </div>
        )}

        {/* Gaps */}
        {resp.ai_gaps && resp.ai_gaps.length > 0 && (
          <div>
            <button
              onClick={() => setShowGaps(g => !g)}
              className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-pink-600 transition-colors mb-1.5"
            >
              {showGaps ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              Gaps Identified ({resp.ai_gaps.length})
            </button>
            {showGaps && (
              <ul className="space-y-1">
                {resp.ai_gaps.map((g, i) => (
                  <li key={i} className="flex gap-2 text-sm text-pink-600/80">
                    <span className="text-pink-600/50 mt-0.5 shrink-0">▸</span>{g}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Recommendation */}
        {resp.ai_recommendation && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">AI Recommendation</p>
            <p className="text-sm text-gray-500">{resp.ai_recommendation}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Client decision section ───────────────────────────────────────────────────
function ClientDecisionPanel({
  resp, auditId, questionId,
}: { resp: QuestionResponseOut; auditId: string; questionId: string }) {
  const qc = useQueryClient()
  const [notes, setNotes]       = useState(resp.client_notes ?? '')
  const [selected, setSelected] = useState<'approved' | 'rejected' | null>(
    resp.client_verdict as 'approved' | 'rejected' ?? null
  )

  const decided = ['approved', 'rejected'].includes(resp.status)

  const reviewMut = useMutation({
    mutationFn: () => clientReview(auditId, questionId, {
      client_verdict: selected!,
      client_notes: notes,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['response', auditId, questionId] })
      qc.invalidateQueries({ queryKey: ['respond-list', auditId] })
    },
  })

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <UserCheck size={15} className="text-pink-600" />
        <h3 className="text-sm font-semibold text-gray-900">Client Decision</h3>
      </div>

      {decided ? (
        <div className={`flex items-start gap-3 rounded-xl p-4 border ${
          resp.status === 'approved'
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-pink-50 border-pink-200'
        }`}>
          {resp.status === 'approved'
            ? <CheckCircle2 size={18} className="text-emerald-600 mt-0.5 shrink-0" />
            : <XCircle size={18} className="text-pink-600 mt-0.5 shrink-0" />}
          <div>
            <p className={`text-sm font-semibold ${resp.status === 'approved' ? 'text-emerald-600' : 'text-pink-600'}`}>
              {resp.status === 'approved' ? 'Response Approved' : 'Response Rejected'}
            </p>
            {resp.client_notes && (
              <p className="text-xs text-gray-400 mt-1">{resp.client_notes}</p>
            )}
            {resp.client_reviewed_at && (
              <p className="text-xs text-gray-400 mt-1">
                {new Date(resp.client_reviewed_at).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setSelected('approved')}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold transition-all ${
                selected === 'approved'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-600 shadow-sm'
                  : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-emerald-200 hover:text-emerald-600/70'
              }`}
            >
              <CheckCircle2 size={15} /> Approve
            </button>
            <button
              onClick={() => setSelected('rejected')}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold transition-all ${
                selected === 'rejected'
                  ? 'bg-pink-50 border-pink-300 text-pink-600'
                  : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-pink-200 hover:text-pink-600/70'
              }`}
            >
              <XCircle size={15} /> Reject
            </button>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1.5">Notes (optional)</label>
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add comments, reasons, or required actions..."
              className="textarea-cosmos"
            />
          </div>

          <button
            onClick={() => reviewMut.mutate()}
            disabled={!selected || reviewMut.isPending}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              selected === 'approved' ? 'btn-success' : selected === 'rejected' ? 'btn-danger' : 'btn-secondary'
            }`}
          >
            {reviewMut.isPending
              ? <><Loader2 size={13} className="animate-spin" /> Submitting…</>
              : <><UserCheck size={13} /> Submit Decision</>}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ClientReviewPage() {
  const { id: auditId, questionId } = useParams<{ id: string; questionId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: allDomains } = useQuery({
    queryKey: ['respond-list', auditId],
    queryFn: () => listQuestionStatuses(auditId!),
    enabled: !!auditId,
  })
  const meta: QuestionStatusItem | undefined = allDomains
    ?.flatMap(d => d.questions).find(q => q.question_id === questionId)

  const { data: resp, isLoading } = useQuery({
    queryKey: ['response', auditId, questionId],
    queryFn: () => getQuestionResponse(auditId!, questionId!),
    enabled: !!auditId && !!questionId,
  })

  const validateMut = useMutation({
    mutationFn: () => validateResponse(auditId!, questionId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['response', auditId, questionId] })
      qc.invalidateQueries({ queryKey: ['respond-list', auditId] })
    },
  })

  const canValidate = resp && ['submitted', 'validated'].includes(resp.status)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <button
        onClick={() => navigate(`/sessions/${auditId}/review`)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-pink-600 mb-5 transition-colors"
      >
        <ArrowLeft size={13} /> Back to Review Queue
      </button>

      {/* Stage bar — client stage active */}
      <div className="flex items-center gap-2 mb-6 bg-white border border-gray-200 rounded-xl shadow-sm px-5 py-3">
        {[
          { id: 'vendor', label: 'Vendor Response', done: true },
          { id: 'ai',     label: 'AI Analysis',     done: !!resp?.ai_verdict },
          { id: 'client', label: 'Client Review',   done: false, active: true },
        ].map((s, i, arr) => (
          <div key={s.id} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all
              ${s.active ? 'bg-blue-50 border-blue-200 text-blue-700' : s.done ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold
                ${s.active ? 'bg-pink-500 text-white' : s.done ? 'bg-emerald-500 text-white' : 'bg-gray-50 text-gray-400'}`}>
                {s.done ? '✓' : i + 1}
              </span>
              {s.label}
            </div>
            {i < arr.length - 1 && <div className="w-8 h-px bg-gray-50" />}
          </div>
        ))}
      </div>

      {/* Question context */}
      {meta && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 mb-6 border-l-4 border-pink-400">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold font-mono text-pink-600 bg-pink-500/10 px-2 py-0.5 rounded">
              {meta.question_id}
            </span>
            <span className="text-xs text-gray-500">{meta.domain_name}</span>
          </div>
          <p className="text-base font-semibold text-gray-900 leading-snug">{meta.question_text}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16"><div className="spinner" /></div>
      ) : !resp ? (
        <div className="text-center py-16 text-gray-400">
          <AlertTriangle size={32} className="mx-auto mb-2" />
          <p>No response found for this question.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Vendor response (read-only) */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Vendor Response</p>
            <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap">
              {resp.user_response || <span className="italic text-gray-400">No response provided</span>}
            </p>
            {resp.vendor_submitted_at && (
              <p className="text-xs text-gray-400 mt-3">
                Submitted: {new Date(resp.vendor_submitted_at).toLocaleString()}
              </p>
            )}
          </div>

          {/* Evidence files */}
          {resp.evidence_files.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                Uploaded Evidence ({resp.evidence_files.length} file{resp.evidence_files.length !== 1 ? 's' : ''})
              </p>
              <div className="space-y-2">
                {resp.evidence_files.map(ef => {
                  const assessMap: Record<string, EvidenceAssessment> = {}
                  for (const ea of resp.ai_evidence_assessments ?? []) assessMap[ea.filename] = ea
                  return <EvidenceRow key={ef.id} file={ef} assessment={assessMap[ef.original_filename]} />
                })}
              </div>
            </div>
          )}

          {/* AI Validate button */}
          {canValidate && (
            <button
              onClick={() => validateMut.mutate()}
              disabled={validateMut.isPending}
              className="btn-primary w-full justify-center py-3"
            >
              {validateMut.isPending
                ? <><Loader2 size={14} className="animate-spin" /> Running AI Analysis…</>
                : <><ShieldCheck size={14} /> {resp.ai_verdict ? 'Re-run AI Analysis' : 'Run AI Analysis'}</>}
            </button>
          )}

          {validateMut.isError && (
            <p className="text-xs text-pink-600 text-center">
              Validation failed — {String(validateMut.error)}
            </p>
          )}

          {/* AI results */}
          {resp.ai_verdict && <AIValidationPanel resp={resp} />}

          {/* Client decision */}
          {['submitted', 'validated', 'approved', 'rejected'].includes(resp.status) && (
            <ClientDecisionPanel resp={resp} auditId={auditId!} questionId={questionId!} />
          )}
        </div>
      )}
    </div>
  )
}
