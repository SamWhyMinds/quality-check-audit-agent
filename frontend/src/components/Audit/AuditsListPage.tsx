import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { auditsApi } from '../../api/audits'
import { StatusBadge } from '../common/StatusBadge'
import { PlusCircle, MessageSquare, CheckCircle2, Clock, XCircle } from 'lucide-react'

export default function AuditsListPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['audits'],
    queryFn: () => auditsApi.list({ page_size: 50 }).then(r => r.data),
    refetchInterval: 8000,
  })

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Sessions</h1>
          <p className="text-sm text-gray-500">Manage your quality check audit sessions</p>
        </div>
        <Link to="/sessions/new" className="btn-primary">
          <PlusCircle size={15} />
          New Session
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="spinner" />
          </div>
        ) : !data?.items.length ? (
          <div className="p-20 text-center">
            <p className="text-gray-400 text-sm mb-4">No sessions yet.</p>
            <Link to="/sessions/new" className="btn-primary text-sm py-2">
              Create first session →
            </Link>
          </div>
        ) : (
          <div>
            {/* Table header */}
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-6 py-3 border-b border-gray-200">
              {['Name', 'Status', 'Score', 'Progress', 'Created', ''].map(h => (
                <div key={h} className="text-xs font-semibold uppercase tracking-wider text-gray-500">{h}</div>
              ))}
            </div>
            {/* Rows */}
            <div className="divide-y divide-gray-100">
              {data.items.map(audit => {
                const answered = audit.compliant_count + audit.partial_count + audit.non_compliant_count
                const pct = audit.total_questions ? Math.round(answered / audit.total_questions * 100) : 0
                return (
                  <div
                    key={audit.id}
                    className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 items-center px-6 py-4 hover:bg-blue-50 transition-colors"
                  >
                    {/* Name + icon */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${
                        audit.status === 'completed' ? 'bg-emerald-500 shadow-sm'
                        : audit.status === 'running'  ? 'bg-blue-500 animate-pulse'
                        : audit.status === 'failed'   ? 'bg-pink-500'
                        : 'bg-gray-300'
                      }`} />
                      <span className="text-sm font-medium text-gray-900 truncate">{audit.name}</span>
                    </div>

                    {/* Status */}
                    <div><StatusBadge status={audit.status} /></div>

                    {/* Score */}
                    <div>
                      {audit.overall_score != null
                        ? <span className="text-sm font-bold text-emerald-600">{audit.overall_score}%</span>
                        : <span className="text-sm text-gray-400">—</span>}
                    </div>

                    {/* Progress bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-pink-500 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 w-7 text-right">{pct}%</span>
                    </div>

                    {/* Date */}
                    <div className="text-xs text-gray-400">
                      {new Date(audit.created_at).toLocaleDateString()}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        to={`/sessions/${audit.id}/check`}
                        className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-violet-600 transition-colors"
                        title="Quality Check"
                      >
                        <MessageSquare size={12} /> Quality Check
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
