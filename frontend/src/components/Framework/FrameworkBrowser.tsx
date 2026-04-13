import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { frameworkApi } from '../../api/framework'
import { ChevronDown, ChevronRight, Tag } from 'lucide-react'

export default function FrameworkBrowser() {
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data: domains = [], isLoading } = useQuery({
    queryKey: ['framework-domains'],
    queryFn: () => frameworkApi.domains().then(r => r.data),
  })

  const { data: detail } = useQuery({
    queryKey: ['domain-detail', expanded],
    queryFn: () => frameworkApi.domain(expanded!).then(r => r.data),
    enabled: !!expanded,
  })

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Audit Framework</h1>
      <p className="text-sm text-gray-500 mb-6">19 domains · 95 audit questions</p>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
      ) : (
        <div className="space-y-2">
          {domains.map(d => (
            <div key={d.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <button
                onClick={() => setExpanded(expanded === d.id ? null : d.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 text-left"
              >
                <div className="flex items-center gap-3">
                  {expanded === d.id
                    ? <ChevronDown size={16} className="text-gray-400" />
                    : <ChevronRight size={16} className="text-gray-400" />}
                  <span className="font-semibold text-[#1e3a5f] text-sm">{d.id}</span>
                  <span className="text-gray-800">{d.name}</span>
                </div>
                <span className="text-xs text-gray-400 shrink-0">{d.question_count} questions</span>
              </button>

              {expanded === d.id && detail && (
                <div className="border-t border-gray-100 px-5 py-4 space-y-4 text-sm">
                  <div>
                    <div className="font-semibold text-gray-700 mb-2">Key Controls</div>
                    <ul className="space-y-1">
                      {detail.key_controls.map((c, i) => (
                        <li key={i} className="flex gap-2 text-gray-600">
                          <span className="text-[#1e3a5f] shrink-0">•</span>{c}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700 mb-2">Audit Questions</div>
                    <div className="space-y-2">
                      {detail.audit_questions.map(q => (
                        <div key={q.id} className="bg-gray-50 rounded-lg px-3 py-2">
                          <span className="text-xs font-mono text-gray-400 mr-2">{q.id}</span>
                          {q.text}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700 mb-2 flex items-center gap-1">
                      <Tag size={14} /> Keywords
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {detail.keywords.map(k => (
                        <span key={k} className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">{k}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
