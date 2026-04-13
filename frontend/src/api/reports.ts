import client from './client'
import type { AuditReport } from '../types'

export const reportsApi = {
  json: (auditId: string) => client.get<AuditReport>(`/audits/${auditId}/report`),

  htmlUrl: (auditId: string) => `/api/audits/${auditId}/report/html`,
  csvUrl: (auditId: string) => `/api/audits/${auditId}/report/csv`,
}
