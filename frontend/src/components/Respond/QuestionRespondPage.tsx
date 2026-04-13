/**
 * Stage 1 — Vendor Response Page
 * Single "Response" field + per-question evidence upload + Submit button.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Upload, Trash2, FileText, Loader2,
  CheckCircle2, Send, Clock, AlertCircle,
} from 'lucide-react'
import {
  vendorRespond, uploadResponseEvidence, deleteResponseEvidence,
  getQuestionResponse, type QuestionResponseOut,
} from '../../api/responses'
import { listQuestionStatuses, type QuestionStatusItem } from '../../api/responses'

// ── Stage bar ─────────────────────────────────────────────────────────────────
function StageBar({ status }: { status: string }) {
  const active = status === 'not_started' || status === 'draft' ? 'vendor'
    : status === 'submitted' || status === 'validated' ? 'ai' : 'client'
  const stages = [
    { id: 'vendor', label: 'Vendor Response' },
    { id: 'ai',     label: 'AI Analysis' },
    { id: 'client', label: 'Client Review' },
  ]
  const order = ['vendor', 'ai', 'client']
  const activeIdx = order.indexOf(active)
  return (
    <div className="flex items-center gap-2 mb-6 bg-white border border-gray-200 rounded-xl shadow-sm px-5 py-3">
      {stages.map((s, i) => {
        const done    = i < activeIdx
        const current = i === activeIdx
        return (
          <div key={s.id} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all
              ${current ? 'bg-blue-50 border-blue-200 text-blue-700' : done ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold
                ${current ? 'bg-blue-500 text-white' : done ? 'bg-emerald-500 text-white' : 'bg-gray-50 text-gray-400'}`}>
                {done ? '✓' : i + 1}
              </span>
              {s.label}
            </div>
            {i < stages.length - 1 && <div className="w-8 h-px bg-gray-50" />}
          </div>
        )
      })}
    </div>
  )
}

// ── Evidence file row ─────────────────────────────────────────────────────────
function EvidenceRow({
  file, onDelete, deleting, readonly,
}: {
  file: QuestionResponseOut['evidence_files'][0]
  onDelete?: () => void
  deleting?: boolean
  readonly?: boolean
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 border border-blue-200">
      <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
        <FileText size={14} className="text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{file.original_filename}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs font-mono text-gray-500 uppercase">{file.file_type}</span>
          {file.file_size_bytes && (
            <span className="text-xs text-gray-400">{(file.file_size_bytes / 1024).toFixed(1)} KB</span>
          )}
          {file.extraction_error && (
            <span className="text-xs text-pink-600 flex items-center gap-1">
              <AlertCircle size={10} /> Parse error
            </span>
          )}
          {!file.extraction_error && file.extraction_method && (
            <span className="text-xs text-emerald-600">✓ Parsed</span>
          )}
        </div>
      </div>
      {!readonly && onDelete && (
        <button
          onClick={onDelete}
          disabled={deleting}
          className="shrink-0 p-1.5 text-gray-400 hover:text-pink-600 hover:bg-pink-500/10 rounded-lg transition-colors"
        >
          {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
        </button>
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
      className={`dropzone p-8 text-center ${over ? 'over' : ''}`}
    >
      <Upload size={22} className="mx-auto mb-2 text-blue-600/60" />
      <p className="text-sm text-gray-400 font-medium">Drop files or click to browse</p>
      <p className="text-xs text-gray-400 mt-1">DOCX · XLSX · CSV · PDF · PNG · JPEG</p>
      <input ref={ref} type="file" multiple accept=".docx,.xlsx,.xlsm,.csv,.pdf,.png,.jpg,.jpeg"
        className="hidden" onChange={e => { const f = Array.from(e.target.files || []); if (f.length) onFiles(f); e.target.value = '' }} />
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function QuestionRespondPage() {
  const { id: auditId, questionId } = useParams<{ id: string; questionId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [response, setResponse] = useState('')
  const [dirty, setDirty]       = useState(false)
  const [deletingId, setDelId]  = useState<string | null>(null)

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
    if (resp) { setResponse(resp.user_response ?? ''); setDirty(false) }
  }, [resp])

  const isSubmitted = resp && ['submitted', 'validated', 'approved', 'rejected'].includes(resp.status)
  const readonly    = !!isSubmitted

  const saveMut = useMutation({
    mutationFn: (submit: boolean) =>
      vendorRespond(auditId!, questionId!, { user_response: response, submit }),
    onSuccess: () => {
      setDirty(false)
      qc.invalidateQueries({ queryKey: ['response', auditId, questionId] })
      qc.invalidateQueries({ queryKey: ['respond-list', auditId] })
    },
  })

  const uploadMut = useMutation({
    mutationFn: (files: File[]) => uploadResponseEvidence(auditId!, questionId!, files),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['response', auditId, questionId] }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteResponseEvidence(auditId!, questionId!, id),
    onSuccess: () => {
      setDelId(null)
      qc.invalidateQueries({ queryKey: ['response', auditId, questionId] })
    },
  })

  const handleFiles = async (files: File[]) => {
    if (!resp) await saveMut.mutateAsync(false)
    uploadMut.mutate(files)
  }

  const handleDelete = (id: string) => { setDelId(id); deleteMut.mutate(id) }

  const currentStatus = resp?.status ?? 'not_started'

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <button
        onClick={() => navigate(`/sessions/${auditId}/respond`)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 mb-5 transition-colors"
      >
        <ArrowLeft size={13} /> Back to Questions
      </button>

      <StageBar status={currentStatus} />

      {/* Question context */}
      {meta && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 mb-6 border-l-4 border-violet-400">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold font-mono text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded">
              {meta.question_id}
            </span>
            <span className="text-xs text-gray-500">{meta.domain_name}</span>
          </div>
          <p className="text-base font-semibold text-gray-900 leading-snug mb-4">{meta.question_text}</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {meta.focus_controls.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Focus Controls</p>
                <ul className="space-y-0.5">
                  {meta.focus_controls.map((c, i) => (
                    <li key={i} className="text-xs text-gray-500 flex gap-1.5">
                      <span className="text-blue-600/50 mt-px shrink-0">▸</span>{c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {meta.evidence_types.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Expected Evidence</p>
                <ul className="space-y-0.5">
                  {meta.evidence_types.map((e, i) => (
                    <li key={i} className="text-xs text-gray-500 flex gap-1.5">
                      <span className="text-pink-600/50 mt-px shrink-0">▸</span>{e}
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
          {/* Response input */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-2">
                Response <span className="text-pink-600">*</span>
              </label>
              <textarea
                rows={10}
                value={response}
                onChange={e => { if (!readonly) { setResponse(e.target.value); setDirty(true) } }}
                readOnly={readonly}
                placeholder={readonly ? '' : 'State your compliance position and how your organisation addresses this requirement. Include references to relevant policies, systems, or processes...'}
                className={`textarea-cosmos ${readonly ? 'opacity-70 cursor-default' : ''}`}
              />
            </div>

            {!readonly && (
              <div className="space-y-2">
                <button
                  onClick={() => saveMut.mutate(false)}
                  disabled={saveMut.isPending || !response.trim()}
                  className="btn-secondary w-full justify-center"
                >
                  {saveMut.isPending && !saveMut.variables
                    ? <><Loader2 size={13} className="animate-spin" /> Saving…</>
                    : dirty ? <><Clock size={13} /> Save Draft</> : <><CheckCircle2 size={13} /> Draft Saved</>}
                </button>

                <button
                  onClick={() => saveMut.mutate(true)}
                  disabled={saveMut.isPending || !response.trim() || dirty}
                  className="btn-primary w-full justify-center"
                >
                  {saveMut.isPending
                    ? <><Loader2 size={13} className="animate-spin" /> Submitting…</>
                    : <><Send size={13} /> Submit Response</>}
                </button>

                {dirty && response.trim() && (
                  <p className="text-xs text-amber-600 text-center">
                    Save your draft before submitting.
                  </p>
                )}
              </div>
            )}

            {/* Status chips */}
            {resp?.status === 'submitted' && (
              <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-500/10 border border-blue-200 rounded-xl px-4 py-2.5">
                <Send size={13} /> Response submitted — awaiting client review
              </div>
            )}
            {resp?.status === 'validated' && (
              <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-500/10 border border-emerald-200 rounded-xl px-4 py-2.5">
                <CheckCircle2 size={13} /> AI validation complete — awaiting client decision
              </div>
            )}
            {resp?.status === 'approved' && (
              <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-500/10 border border-emerald-200 rounded-xl px-4 py-2.5">
                <CheckCircle2 size={13} /> Approved by client
                {resp.client_notes && <span className="text-gray-400"> — {resp.client_notes}</span>}
              </div>
            )}
            {resp?.status === 'rejected' && (
              <div className="flex items-center gap-2 text-xs text-pink-600 bg-pink-500/10 border border-pink-200 rounded-xl px-4 py-2.5">
                <AlertCircle size={13} /> Rejected by client
                {resp.client_notes && <span className="text-gray-400"> — {resp.client_notes}</span>}
              </div>
            )}
          </div>

          {/* Evidence */}
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-2">Evidence Files</h3>
              <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                Upload documents supporting your response. The AI will extract and validate each file against the controls framework.
              </p>
              {!readonly && <DropZone onFiles={handleFiles} />}
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
                    onDelete={() => handleDelete(ef.id)}
                    deleting={deletingId === ef.id && deleteMut.isPending}
                    readonly={readonly}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
