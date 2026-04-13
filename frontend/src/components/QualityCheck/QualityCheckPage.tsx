/**
 * Quality Check — single question page
 * Unified: justification input + evidence upload + AI analysis results.
 * Fully re-submittable — edit and re-analyse at any time.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Upload, Trash2, FileText, Loader2,
  CheckCircle2, AlertCircle, ShieldCheck, Zap,
  ChevronDown, ChevronUp, XCircle, AlertTriangle,
} from 'lucide-react'
import {
  saveResponse, runAnalysis, uploadResponseEvidence, deleteResponseEvidence,
  getQuestionResponse, listQuestionStatuses,
  type QuestionResponseOut, type EvidenceAssessment, type QuestionStatusItem,
} from '../../api/responses'

// ── Verdict helpers ───────────────────────────────────────────────────────────
function VerdictBadge({ verdict }: { verdict: string }) {
  const cfg = {
    compliant:     { cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200', label: 'Compliant',     Icon: CheckCircle2 },
    partial:       { cls: 'bg-amber-50 text-amber-700 border border-amber-200',       label: 'Partial',       Icon: AlertTriangle },
    non_compliant: { cls: 'bg-red-50 text-red-700 border border-red-200',             label: 'Non-Compliant', Icon: XCircle },
  }[verdict]
  if (!cfg) return null
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${cfg.cls}`}>
      <cfg.Icon size={13} /> {cfg.label}
    </span>
  )
}

function ConfidenceBar({ score }: { score: number }) {
  const cls = score >= 70 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
    : score >= 40 ? 'bg-gradient-to-r from-amber-400 to-amber-500'
    : 'bg-gradient-to-r from-red-400 to-red-500'
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${cls}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-sm font-bold text-gray-900 w-10 text-right">{score.toFixed(0)}%</span>
    </div>
  )
}

// ── Evidence row ──────────────────────────────────────────────────────────────
function EvidenceRow({
  file, assessment, onDelete, deleting, readonly,
}: {
  file: QuestionResponseOut['evidence_files'][0]
  assessment?: EvidenceAssessment
  onDelete?: () => void
  deleting?: boolean
  readonly?: boolean
}) {
  const good    = !!assessment?.relevant && !!assessment?.supports_answer
  const partial = !!assessment?.relevant && !assessment?.supports_answer
  return (
    <div className={`rounded-xl p-3 border transition-all ${
      !assessment ? 'bg-blue-50 border-blue-200'
      : good ? 'bg-emerald-50 border-emerald-200'
      : partial ? 'bg-amber-50 border-amber-200'
      : 'bg-pink-50 border-pink-200'
    }`}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0 shadow-sm">
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
              ? <span className="text-xs text-pink-600 flex items-center gap-1"><AlertCircle size={10} /> Parse error</span>
              : file.extraction_method
                ? <span className="text-xs text-emerald-600">✓ Parsed</span>
                : null}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {assessment && (
            good ? <CheckCircle2 size={15} className="text-emerald-600" />
            : partial ? <AlertTriangle size={15} className="text-amber-600" />
            : <XCircle size={15} className="text-pink-600" />
          )}
          {!readonly && onDelete && (
            <button
              onClick={onDelete}
              disabled={deleting}
              className="p-1.5 text-gray-400 hover:text-pink-600 hover:bg-pink-50 rounded-lg transition-colors ml-1"
            >
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            </button>
          )}
        </div>
      </div>
      {assessment?.notes && (
        <p className={`mt-2 text-xs px-1 leading-relaxed ${
          good ? 'text-emerald-700' : partial ? 'text-amber-700' : 'text-pink-700'
        }`}>
          {assessment.notes}
        </p>
      )}
    </div>
  )
}

// ── Drop zone ─────────────────────────────────────────────────────────────────
function DropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [over, setOver] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setOver(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length) onFiles(files)
  }, [onFiles])
  return (
    <div
      onDragOver={e => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
      onClick={() => ref.current?.click()}
      className={`dropzone ${over ? 'over' : ''}`}
    >
      <Upload size={20} className="mx-auto mb-2 text-blue-500" />
      <p className="text-sm text-gray-500 font-medium">Drop files or click to browse</p>
      <p className="text-xs text-gray-400 mt-1">DOCX · XLSX · CSV · PDF · PNG · JPEG</p>
      <input ref={ref} type="file" multiple
        accept=".docx,.xlsx,.xlsm,.csv,.pdf,.png,.jpg,.jpeg"
        className="hidden"
        onChange={e => { const f = Array.from(e.target.files || []); if (f.length) onFiles(f); e.target.value = '' }}
      />
    </div>
  )
}

// ── AI Results panel ──────────────────────────────────────────────────────────
function AIResultsPanel({ resp }: { resp: QuestionResponseOut }) {
  const [showGaps, setShowGaps] = useState(true)
  const [showSigGaps, setShowSigGaps] = useState(true)
  if (!resp.ai_verdict) return null

  const assessMap: Record<string, EvidenceAssessment> = {}
  for (const ea of resp.ai_evidence_assessments ?? []) assessMap[ea.filename] = ea

  const hasSigGaps = (resp.ai_significant_gaps?.length ?? 0) > 0

  const headerBg = resp.ai_verdict === 'compliant' ? 'bg-emerald-50'
    : resp.ai_verdict === 'partial' ? 'bg-amber-50' : 'bg-red-50'
  const borderCls = resp.ai_verdict === 'compliant' ? 'border-emerald-200'
    : resp.ai_verdict === 'partial' ? 'border-amber-200' : 'border-red-200'

  return (
    <div className={`bg-white border rounded-xl shadow-sm overflow-hidden ${borderCls}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-5 py-3.5 border-b border-gray-200 ${headerBg}`}>
        <div className="flex items-center gap-2">
          <ShieldCheck size={15} className="text-gray-600" />
          <span className="text-sm font-semibold text-gray-900">AI Analysis Result</span>
          {resp.ai_model_used && (
            <span className="text-xs font-mono text-gray-400">({resp.ai_model_used})</span>
          )}
        </div>
        <VerdictBadge verdict={resp.ai_verdict} />
      </div>

      <div className="p-5 space-y-5">
        {/* Confidence */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Confidence Score</p>
          <ConfidenceBar score={resp.ai_confidence_score ?? 0} />
        </div>

        {/* Summary */}
        {resp.ai_validation_summary && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Summary</p>
            <p className="text-sm text-gray-600 leading-relaxed border-l-2 border-blue-300 pl-3">
              {resp.ai_validation_summary}
            </p>
          </div>
        )}

        {/* Response assessment */}
        {resp.ai_answer_assessment && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Response Assessment</p>
            <p className="text-sm text-gray-500 leading-relaxed">{resp.ai_answer_assessment}</p>
          </div>
        )}

        {/* Evidence assessments */}
        {resp.evidence_files.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Evidence Assessment</p>
            <div className="space-y-2">
              {resp.evidence_files.map(ef => (
                <EvidenceRow
                  key={ef.id}
                  file={ef}
                  assessment={assessMap[ef.original_filename]}
                  readonly
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Significant Gaps (critical / blocking) ──────────────────────── */}
        {hasSigGaps && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <button
              onClick={() => setShowSigGaps(g => !g)}
              className="flex items-center gap-2 w-full text-left"
            >
              <AlertTriangle size={14} className="text-red-600 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wider text-red-700 flex-1">
                Significant Gaps — Blocking Compliance ({resp.ai_significant_gaps!.length})
              </span>
              {showSigGaps ? <ChevronUp size={13} className="text-red-500" /> : <ChevronDown size={13} className="text-red-500" />}
            </button>
            {showSigGaps && (
              <ul className="mt-3 space-y-2">
                {resp.ai_significant_gaps!.map((g, i) => (
                  <li key={i} className="flex gap-2 text-sm text-red-700 font-medium">
                    <span className="text-red-400 mt-0.5 shrink-0">▸</span>
                    {g.replace(/^CRITICAL:\s*/i, '')}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* All Gaps */}
        {(resp.ai_gaps?.length ?? 0) > 0 && (
          <div>
            <button
              onClick={() => setShowGaps(g => !g)}
              className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-pink-600 transition-colors mb-1.5 w-full text-left"
            >
              {showGaps ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              All Gaps ({resp.ai_gaps!.length})
            </button>
            {showGaps && (
              <ul className="space-y-1">
                {resp.ai_gaps!.map((g, i) => (
                  <li key={i} className="flex gap-2 text-sm text-pink-600/80">
                    <span className="text-pink-400 mt-0.5 shrink-0">▸</span>{g}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Recommendation */}
        {resp.ai_recommendation && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 mb-1.5">
              AI Recommendation
            </p>
            <p className="text-sm text-gray-600 leading-relaxed">{resp.ai_recommendation}</p>
          </div>
        )}

        {resp.validated_at && (
          <p className="text-xs text-gray-400 text-right">
            Last analysed: {new Date(resp.validated_at).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function QualityCheckPage() {
  const { id: auditId, questionId } = useParams<{ id: string; questionId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [responseText, setResponseText] = useState('')
  const [dirty, setDirty] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Question metadata
  const { data: allDomains } = useQuery({
    queryKey: ['respond-list', auditId],
    queryFn: () => listQuestionStatuses(auditId!),
    enabled: !!auditId,
  })
  const meta: QuestionStatusItem | undefined = allDomains
    ?.flatMap(d => d.questions).find(q => q.question_id === questionId)

  // Existing response
  const { data: resp, isLoading } = useQuery({
    queryKey: ['response', auditId, questionId],
    queryFn: () => getQuestionResponse(auditId!, questionId!),
    enabled: !!auditId && !!questionId,
    retry: false,
  })

  useEffect(() => {
    if (resp) { setResponseText(resp.user_response ?? ''); setDirty(false) }
  }, [resp])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['response', auditId, questionId] })
    qc.invalidateQueries({ queryKey: ['respond-list', auditId] })
  }

  const saveMut = useMutation({
    mutationFn: () => saveResponse(auditId!, questionId!, { user_response: responseText }),
    onSuccess: () => { setDirty(false); invalidate() },
  })

  const analyseMut = useMutation({
    mutationFn: async () => {
      // Auto-save first if there are unsaved changes
      if (dirty) await saveResponse(auditId!, questionId!, { user_response: responseText })
      return runAnalysis(auditId!, questionId!)
    },
    onSuccess: () => { setDirty(false); invalidate() },
  })

  const uploadMut = useMutation({
    mutationFn: (files: File[]) => uploadResponseEvidence(auditId!, questionId!, files),
    onSuccess: () => invalidate(),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteResponseEvidence(auditId!, questionId!, id),
    onSuccess: () => { setDeletingId(null); invalidate() },
  })

  const handleFiles = async (files: File[]) => {
    // Ensure a draft exists before uploading
    if (!resp) await saveResponse(auditId!, questionId!, { user_response: responseText || ' ' })
    uploadMut.mutate(files)
  }

  // Build assessment map for evidence rows
  const assessMap: Record<string, EvidenceAssessment> = {}
  for (const ea of resp?.ai_evidence_assessments ?? []) assessMap[ea.filename] = ea

  const isAnalysed = resp?.status === 'analysed'
  const canAnalyse = !!responseText.trim()

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Back */}
      <button
        onClick={() => navigate(`/sessions/${auditId}/check`)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 mb-5 transition-colors"
      >
        <ArrowLeft size={13} /> Back to Questions
      </button>

      {/* Question context */}
      {meta && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 mb-6 border-l-4 border-blue-400">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
              {meta.question_id}
            </span>
            <span className="text-xs text-gray-500">{meta.domain_name}</span>
            {isAnalysed && resp?.ai_verdict && <VerdictBadge verdict={resp.ai_verdict} />}
          </div>
          <p className="text-base font-semibold text-gray-900 leading-snug mb-4">{meta.question_text}</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {meta.focus_controls.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Focus Controls</p>
                <ul className="space-y-0.5">
                  {meta.focus_controls.map((c, i) => (
                    <li key={i} className="text-xs text-gray-500 flex gap-1.5">
                      <span className="text-blue-400 mt-px shrink-0">▸</span>{c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {meta.evidence_types.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Expected Evidence</p>
                <ul className="space-y-0.5">
                  {meta.evidence_types.map((e, i) => (
                    <li key={i} className="text-xs text-gray-500 flex gap-1.5">
                      <span className="text-violet-400 mt-px shrink-0">▸</span>{e}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16"><div className="spinner" /></div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">

          {/* ── Left column: Input ──────────────────────────────────────── */}
          <div className="space-y-5">

            {/* Justification textarea */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-2">
                Justification / Response <span className="text-pink-500">*</span>
              </label>
              <textarea
                rows={10}
                value={responseText}
                onChange={e => { setResponseText(e.target.value); setDirty(true) }}
                placeholder="State your compliance position and how your organisation addresses this requirement. Include references to relevant policies, systems, or processes…"
                className="textarea-cosmos"
              />
            </div>

            {/* Action buttons */}
            <div className="space-y-2">
              <button
                onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending || !responseText.trim() || !dirty}
                className="btn-secondary w-full justify-center"
              >
                {saveMut.isPending
                  ? <><Loader2 size={13} className="animate-spin" /> Saving…</>
                  : dirty ? 'Save Draft' : '✓ Draft Saved'}
              </button>

              <button
                onClick={() => analyseMut.mutate()}
                disabled={analyseMut.isPending || !canAnalyse}
                className="btn-primary w-full justify-center"
              >
                {analyseMut.isPending
                  ? <><Loader2 size={13} className="animate-spin" /> Running AI Analysis…</>
                  : isAnalysed
                    ? <><Zap size={13} /> Re-run AI Analysis</>
                    : <><ShieldCheck size={13} /> Run AI Analysis</>}
              </button>

              {dirty && responseText.trim() && (
                <p className="text-xs text-amber-600 text-center">
                  Unsaved changes — analysis will auto-save before running.
                </p>
              )}
              {analyseMut.isError && (
                <p className="text-xs text-pink-600 text-center">
                  Analysis failed — {String(analyseMut.error)}
                </p>
              )}
            </div>

            {/* Evidence upload */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Evidence Files</h3>
              <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                Upload supporting documents. The AI will extract and validate each file against the controls framework.
                You can add or remove files at any time.
              </p>
              <DropZone onFiles={handleFiles} />
            </div>

            {uploadMut.isPending && (
              <div className="flex items-center gap-2 text-xs text-blue-600">
                <Loader2 size={12} className="animate-spin" /> Uploading and extracting text…
              </div>
            )}

            {resp && resp.evidence_files.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">
                  {resp.evidence_files.length} file{resp.evidence_files.length !== 1 ? 's' : ''} attached
                </p>
                {resp.evidence_files.map(ef => (
                  <EvidenceRow
                    key={ef.id}
                    file={ef}
                    assessment={isAnalysed ? assessMap[ef.original_filename] : undefined}
                    onDelete={() => { setDeletingId(ef.id); deleteMut.mutate(ef.id) }}
                    deleting={deletingId === ef.id && deleteMut.isPending}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Right column: AI Results ─────────────────────────────────── */}
          <div>
            {isAnalysed && resp ? (
              <AIResultsPanel resp={resp} />
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400 h-full flex flex-col items-center justify-center min-h-[300px]">
                <ShieldCheck size={40} className="mb-3 text-gray-200" />
                <p className="font-medium text-sm text-gray-500">AI Analysis Results</p>
                <p className="text-xs mt-1 text-gray-400">
                  Enter your justification and click<br />"Run AI Analysis" to see results here.
                </p>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}
