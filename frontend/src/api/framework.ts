import client from './client'
import type { DomainSummary, DomainDetail, AuditQuestion } from '../types'

export const frameworkApi = {
  domains: () => client.get<DomainSummary[]>('/framework/domains'),
  domain: (id: string) => client.get<DomainDetail>(`/framework/domains/${id}`),
  questions: (domain?: string) =>
    client.get<AuditQuestion[]>('/framework/questions', { params: domain ? { domain } : {} }),
  evidenceTypes: () => client.get<string[]>('/framework/evidence-types'),
}
