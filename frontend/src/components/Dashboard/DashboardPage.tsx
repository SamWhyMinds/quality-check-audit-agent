import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { auditsApi } from '../../api/audits'
import { PlusCircle, ArrowRight, CheckCircle2, Clock, XCircle, BarChart3 } from 'lucide-react'

function StatCard({
  label, value, sub, color,
}: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['audits'],
    queryFn: () => auditsApi.list({ page_size: 10 }).then(r => r.data),
    refetchInterval: 10_000,
  })

  const sessions = data?.items ?? []
  const completed  = sessions.filter(a => a.status === 'completed').length
  const running    = sessions.filter(a => a.status === 'running').length
  const avgScore   = sessions.filter(a => a.overall_score != null).length
    ? Math.round(sessions.reduce((s, a) => s + (a.overall_score ?? 0), 0) / sessions.filter(a => a.overall_score != null).length)
    : null

  return (
    <div className="p-8 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-10">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Quality Check Audit</h1>
          <p className="text-sm text-gray-500">
            Vendor response &amp; client validation across 19 control domains
          </p>
        </div>
        <Link to="/sessions/new" className="btn-primary">
          <PlusCircle size={15} />
          New Session
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard label="Total Sessions"  value={data?.total ?? 0}   color="text-gray-900"              sub="across all domains" />
        <StatCard label="Completed"       value={completed}          color="text-emerald-600"       sub="AI validated sessions" />
        <StatCard label="In Progress"     value={running}            color="text-blue-600"      sub="currently running" />
        <StatCard label="Avg Score"       value={avgScore != null ? `${avgScore}%` : '—'} color="text-pink-600" sub="compliance score" />
      </div>

      {/* Workflow explainer */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={15} className="text-blue-600" />
          <h2 className="text-sm font-semibold text-gray-700">Quality Check Workflow</h2>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { step: '01', title: 'Justification',  desc: 'Enter your compliance response and justification for each audit question',  color: 'text-blue-600',    border: 'border-blue-200',    bg: 'bg-blue-50' },
            { step: '02', title: 'Evidence Upload', desc: 'Upload supporting documents — DOCX, XLSX, CSV, PDF, or images for each question', color: 'text-violet-600',  border: 'border-violet-200',  bg: 'bg-violet-50' },
            { step: '03', title: 'AI Analysis',     desc: 'Run AI analysis to validate evidence, identify gaps, and get a compliance verdict', color: 'text-emerald-600', border: 'border-emerald-200', bg: 'bg-emerald-50' },
          ].map(({ step, title, desc, color, border, bg }) => (
            <div key={step} className={`rounded-xl p-4 border ${border} ${bg}`}>
              <div className={`text-xs font-bold mb-2 ${color}`}>STEP {step}</div>
              <div className="text-sm font-semibold text-gray-900 mb-1">{title}</div>
              <div className="text-xs text-gray-400 leading-relaxed">{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent sessions */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Recent Sessions</h2>
          <Link to="/sessions" className="text-xs text-blue-600 hover:text-pink-600 transition-colors">
            View all →
          </Link>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="spinner" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-16 text-center">
            <p className="text-gray-400 mb-4 text-sm">No sessions yet.</p>
            <Link to="/sessions/new" className="btn-primary text-sm py-2">
              Start first session →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sessions.map(s => {
              const answered = s.compliant_count + s.partial_count + s.non_compliant_count
              const pct = s.total_questions ? Math.round(answered / s.total_questions * 100) : 0
              return (
                <div key={s.id} className="px-6 py-4 flex items-center gap-4 hover:bg-blue-50 transition-colors">
                  {/* Status icon */}
                  <div className="shrink-0">
                    {s.status === 'completed' ? (
                      <CheckCircle2 size={18} className="text-emerald-600" />
                    ) : s.status === 'running' ? (
                      <Clock size={18} className="text-blue-600 animate-pulse" />
                    ) : s.status === 'failed' ? (
                      <XCircle size={18} className="text-pink-600" />
                    ) : (
                      <Clock size={18} className="text-gray-400" />
                    )}
                  </div>

                  {/* Name + meta */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {s.selected_domains.length} domains · {new Date(s.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Score */}
                  <div className="shrink-0 text-right">
                    {s.overall_score != null ? (
                      <span className="text-sm font-bold text-emerald-600">{s.overall_score}%</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-pink-500 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 w-8">{pct}%</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="shrink-0 flex items-center gap-2">
                    <Link
                      to={`/sessions/${s.id}/check`}
                      className="text-xs text-blue-600 hover:text-violet-600 transition-colors font-medium"
                    >
                      Quality Check
                    </Link>
                    <ArrowRight size={13} className="text-gray-400" />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
