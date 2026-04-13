import client from './client'
import type { Audit, AuditStatus_, AuditResult, AuditTrailEntry } from '../types'

export const auditsApi = {
  list: (params?: { page?: number; page_size?: number; status?: string }) =>
    client.get<{ total: number; page: number; page_size: number; items: Audit[] }>('/audits', { params }),

  get: (id: string) => client.get<Audit>(`/audits/${id}`),

  create: (body: { name: string; description?: string; selected_domains: string[] }) =>
    client.post<Audit>('/audits', body),

  delete: (id: string) => client.delete(`/audits/${id}`),

  start: (id: string) => client.post<AuditStatus_>(`/audits/${id}/start`),

  status: (id: string) => client.get<AuditStatus_>(`/audits/${id}/status`),

  results: (id: string, params?: { domain?: string; verdict?: string }) =>
    client.get<AuditResult[]>(`/audits/${id}/results`, { params }),

  result: (id: string, questionId: string) =>
    client.get<AuditResult>(`/audits/${id}/results/${questionId}`),

  trail: (id: string) => client.get<AuditTrailEntry[]>(`/audits/${id}/trail`),
}
