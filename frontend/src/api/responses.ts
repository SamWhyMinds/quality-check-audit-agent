import apiClient from './client'

export interface ResponseEvidenceOut {
  id: string
  response_id: string
  original_filename: string
  file_type: string
  file_size_bytes: number | null
  upload_time: string
  extraction_method: string | null
  extraction_error: string | null
}

export interface EvidenceAssessment {
  filename: string
  relevant: boolean
  supports_answer: boolean
  notes: string
}

export interface QuestionResponseOut {
  id: string
  audit_id: string
  domain_id: string
  question_id: string
  question_text: string
  user_response: string | null
  status: 'not_started' | 'draft' | 'analysed'
  // AI analysis results
  ai_verdict: 'compliant' | 'partial' | 'non_compliant' | null
  ai_confidence_score: number | null
  ai_validation_summary: string | null
  ai_answer_assessment: string | null
  ai_justification_assessment: string | null
  ai_evidence_assessments: EvidenceAssessment[] | null
  ai_gaps: string[] | null
  ai_significant_gaps: string[] | null
  ai_recommendation: string | null
  ai_model_used: string | null
  validated_at: string | null
  created_at: string
  updated_at: string | null
  evidence_files: ResponseEvidenceOut[]
}

export interface QuestionStatusItem {
  question_id: string
  domain_id: string
  domain_name: string
  question_text: string
  focus_controls: string[]
  evidence_types: string[]
  response_status: 'not_started' | 'draft' | 'analysed'
  ai_verdict: string | null
  ai_confidence_score: number | null
  response_id: string | null
  evidence_count: number
}

export interface DomainQuestionList {
  domain_id: string
  domain_name: string
  questions: QuestionStatusItem[]
  total_count: number
  analysed_count: number
  draft_count: number
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const listQuestionStatuses = (auditId: string) =>
  apiClient.get<DomainQuestionList[]>(`/audits/${auditId}/respond`).then(r => r.data)

export const getQuestionResponse = (auditId: string, questionId: string) =>
  apiClient.get<QuestionResponseOut>(`/audits/${auditId}/respond/${questionId}`).then(r => r.data)

/** Save or update the justification (always allowed, no locking) */
export const saveResponse = (
  auditId: string,
  questionId: string,
  payload: { user_response: string }
) =>
  apiClient.post<QuestionResponseOut>(`/audits/${auditId}/respond/${questionId}`, payload).then(r => r.data)

/** Upload evidence files */
export const uploadResponseEvidence = (auditId: string, questionId: string, files: File[]) => {
  const form = new FormData()
  files.forEach(f => form.append('files', f))
  return apiClient
    .post<ResponseEvidenceOut[]>(`/audits/${auditId}/respond/${questionId}/evidence`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then(r => r.data)
}

/** Delete an evidence file */
export const deleteResponseEvidence = (auditId: string, questionId: string, fileId: string) =>
  apiClient.delete(`/audits/${auditId}/respond/${questionId}/evidence/${fileId}`)

/** Run (or re-run) AI analysis */
export const runAnalysis = (auditId: string, questionId: string) =>
  apiClient.post<QuestionResponseOut>(`/audits/${auditId}/respond/${questionId}/analyse`).then(r => r.data)
