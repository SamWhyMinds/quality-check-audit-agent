import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { auditsApi } from '../../api/audits'
import { VerdictBadge, ConfidenceBadge } from '../common/StatusBadge'
import { ChevronDown, ChevronRight, Download, AlertTriangle } from 'lucide-react'
import type { AuditResult, Verdict } from '../../types'

type DomainGroup = { id: string; name: string; results: AuditResult[] }

export default function AuditResultsPage() {
  const { id } = useParams<{ id: string }>()
  const [filterVerdict, setFilterVerdict] = useState<string>('')
  const [filterDomain, setFilterDomain] = useState<string>('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const { data: audit } = useQuery({
    queryKey: ['audit', id],
    queryFn: () => auditsApi.get(id!).then(r => r.data),
    enabled: !!id,
  })

  const { data: results = [], isLoading } = useQuery({
    queryKey: ['results', id, filterVerdict, filterDomain],
    queryFn: () => auditsApi.results(id!, {
      verdict: filterVerdict || undefined,
      domain: filterDomain || undefined,
    }).then(r => r.data),
    enabled: !!id,
  })

  // Group by domain
  const groups: DomainGroup[] = []
  const domainMap = new Map<string, DomainGroup>()
  for (const r of results) {
    if (!domainMap.has(r.domain_id)) {
      const g = { id: r.domain_id, name: r.domain_id, results: [] }
      domainMap.set(r.domain_id, g)
      groups.push(g)
    }
    domainMap.get(r.domain_id)!.results.push(r)
  }

  const toggle = (id: string) =>
    setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const uniqueDomains = [...new Set(results.map(r => r.domain_id))].sort()

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{audit?.name ?? 'Audit Results'}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {audit?.compliant_count} compliant · {audit?.partial_count} partial · {audit?.non_compliant_count} non-compliant
            {audit?.overall_score != null && ` · ${audit.overall_score}% overall`}
          </p>
        </div>
        <Link
          to={`/audits/${id}/report`}
          className="flex items-center gap-2 bg-[#1e3a5f] text-gray-900 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#2a4f7f]"
        >
          <Download size={15} />
          Export Report
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <select
          value={filterVerdict} onChange={e => setFilterVerdict(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
        >
          <option value="">All Verdicts</option>
          <option value="compliant">Compliant</option>
          <option value="partial">Partial</option>
          <option value="non_compliant">Non-Compliant</option>
        </select>
        <select
          value={filterDomain} onChange={e => setFilterDomain(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
        >
          <option value="">All Domains</option>
          {uniqueDomains.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <span className="text-sm text-gray-400 self-center">{results.length} questions shown</span>
      </div>

      {/* Domain groups */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Loading results...</div>
      ) : (
        <div className="space-y-3">
          {groups.map(group => {
            const isOpen = expanded.has(group.id)
            const c = group.results.filter(r => r.verdict === 'compliant').length
            const p = group.results.filter(r => r.verdict === 'partial').length
            const nc = group.results.filter(r => r.verdict === 'non_compliant').length
            const score = Math.round(((c + p * 0.5) / group.results.length) * 100)
            // Get domain name from first result question_id
            return (
              <div key={group.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <button
                  onClick={() => toggle(group.id)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    {isOpen ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                    <span className="font-semibold text-gray-900">{group.id}</span>
                    <span className="text-sm text-gray-500">({group.results.length} questions)</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-green-700 font-medium">{c} ✓</span>
                    <span className="text-yellow-700 font-medium">{p} ~</span>
                    <span className="text-red-700 font-medium">{nc} ✗</span>
                    <span className="font-bold text-[#1e3a5f] text-sm">{score}%</span>
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50">
                    {group.results.map(r => (
                      <QuestionCard key={r.id} result={r} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function QuestionCard({ result }: { result: AuditResult }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="px-5 py-4">
      <div className="flex items-start justify-between gap-4 cursor-pointer" onClick={() => setOpen(o => !o)}>
        <div className="flex-1">
          <div className="text-xs text-gray-400 mb-1">{result.question_id}</div>
          <div className="text-sm font-medium text-gray-800">{result.question_text}</div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <ConfidenceBadge score={result.confidence_score} />
          <VerdictBadge verdict={result.verdict} />
        </div>
      </div>
      {open && (
        <div className="mt-3 space-y-2 text-sm">
          {result.conclusion && (
            <p className="text-gray-700 bg-gray-50 rounded-lg px-3 py-2">{result.conclusion}</p>
          )}
          {result.identified_gaps && result.identified_gaps.length > 0 && (
            <div>
              {result.identified_gaps.map((gap, i) => (
                <div key={i} className="flex items-start gap-2 text-red-600 text-xs mt-1">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  {gap}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
