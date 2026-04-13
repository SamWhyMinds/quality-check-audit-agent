import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { auditsApi } from '../../api/audits'
import { Loader2 } from 'lucide-react'

export default function AuditProgressPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: status } = useQuery({
    queryKey: ['audit-status', id],
    queryFn: () => auditsApi.status(id!).then(r => r.data),
    refetchInterval: 3000,
    enabled: !!id,
  })

  useEffect(() => {
    if (status?.status === 'completed') navigate(`/audits/${id}/results`)
    if (status?.status === 'failed') navigate(`/audits`)
  }, [status, id, navigate])

  const pct = status?.percent_complete ?? 0
  const completed = status?.completed_questions ?? 0
  const total = status?.total_questions ?? 0

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-10 text-center">
        <Loader2 size={48} className="mx-auto text-[#1e3a5f] animate-spin mb-6" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Audit in Progress</h2>
        <p className="text-sm text-gray-500 mb-8">
          Analyzing evidence against 95 audit questions using Claude AI
        </p>

        <div className="w-full bg-gray-100 rounded-full h-4 mb-3 overflow-hidden">
          <div
            className="bg-[#1e3a5f] h-4 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-sm font-semibold text-gray-700">
          {completed} / {total} questions analyzed ({Math.round(pct)}%)
        </div>

        <p className="text-xs text-gray-400 mt-6">
          This page refreshes automatically every 3 seconds
        </p>
      </div>
    </div>
  )
}
