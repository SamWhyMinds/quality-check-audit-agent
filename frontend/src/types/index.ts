// ── Audit ────────────────────────────────────────────────────────────────────
export type AuditStatus = 'pending' | 'running' | 'completed' | 'failed'
export type Verdict = 'compliant' | 'partial' | 'non_compliant'

export interface Audit {
  id: string
  name: string
  description?: string
  status: AuditStatus
  selected_domains: string[]
  created_at: string
  completed_at?: string
  overall_score?: number
  total_questions: number
  compliant_count: number
  partial_count: number
  non_compliant_count: number
}

export interface AuditStatus_ {
  audit_id: string
  status: AuditStatus
  total_questions: number
  completed_questions: number
  percent_complete: number
}

export interface EvidenceFile {
  id: string
  audit_id: string
  original_filename: string
  file_type: string
  file_size_bytes?: number
  upload_time: string
  extraction_method?: string
  extraction_error?: string
  page_count?: number
  sheet_names?: string[]
  text_preview?: string
}

export interface EvidenceDomainMapping {
  evidence_file_id: string
  domain_id: string
  match_score?: number
  matched_keywords?: string[]
  mapping_method?: string
}

export interface AuditResult {
  id: string
  audit_id: string
  domain_id: string
  question_id: string
  question_text: string
  verdict: Verdict
  confidence_score: number
  context_summary?: string
  evidence_analysis?: EvidenceAnalysisItem[]
  identified_gaps?: string[]
  conclusion?: string
  evidence_refs?: EvidenceRef[]
  matched_controls?: string[]
  unmatched_controls?: string[]
  created_at: string
}

export interface EvidenceAnalysisItem {
  filename: string
  relevant: boolean
  findings: string
  location: string
}

export interface EvidenceRef {
  file_id: string
  filename: string
  location?: string
}

export interface AuditTrailEntry {
  id: string
  timestamp: string
  step_type: string
  domain_id?: string
  question_id?: string
  evidence_file_id?: string
  input_summary?: string
  output_summary?: string
  prompt_tokens?: number
  completion_tokens?: number
  model_used?: string
  duration_ms?: number
}

// ── Framework ─────────────────────────────────────────────────────────────────
export interface AuditQuestion {
  id: string
  text: string
  focus_controls: string[]
  evidence_types: string[]
  domain_id?: string
  domain_name?: string
}

export interface DomainSummary {
  id: string
  name: string
  question_count: number
  keywords: string[]
  relevant_evidence_types: string[]
}

export interface DomainDetail extends DomainSummary {
  key_controls: string[]
  audit_questions: AuditQuestion[]
}

// ── Report ─────────────────────────────────────────────────────────────────────
export interface QuestionReport {
  question_id: string
  question_text: string
  verdict: Verdict
  confidence_score: number
  context_summary?: string
  evidence_analysis?: EvidenceAnalysisItem[]
  identified_gaps?: string[]
  matched_controls?: string[]
  unmatched_controls?: string[]
  conclusion?: string
  evidence_refs?: EvidenceRef[]
}

export interface DomainReport {
  domain_id: string
  domain_name: string
  questions: QuestionReport[]
  domain_score: number
  compliant_count: number
  partial_count: number
  non_compliant_count: number
}

export interface AuditReport {
  audit_id: string
  audit_name: string
  generated_at: string
  overall_score: number
  total_questions: number
  compliant_count: number
  partial_count: number
  non_compliant_count: number
  domains: DomainReport[]
  framework_version: string
}
