import client from './client'
import type { EvidenceFile, EvidenceDomainMapping } from '../types'

export const evidenceApi = {
  upload: (auditId: string, files: File[]) => {
    const form = new FormData()
    files.forEach(f => form.append('files', f))
    return client.post<EvidenceFile[]>(`/audits/${auditId}/evidence`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  list: (auditId: string) =>
    client.get<EvidenceFile[]>(`/audits/${auditId}/evidence`),

  get: (auditId: string, fileId: string) =>
    client.get<EvidenceFile>(`/audits/${auditId}/evidence/${fileId}`),

  delete: (auditId: string, fileId: string) =>
    client.delete(`/audits/${auditId}/evidence/${fileId}`),

  map: (auditId: string) =>
    client.get<EvidenceDomainMapping[]>(`/audits/${auditId}/evidence-map`),
}
