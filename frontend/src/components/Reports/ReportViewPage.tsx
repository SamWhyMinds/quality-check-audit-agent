import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '../../api/reports'
import { Download, FileText, FileSpreadsheet } from 'lucide-react'

export default function ReportViewPage() {
  const { id } = useParams<{ id: string }>()

  const { data: report, isLoading } = useQuery({
    queryKey: ['report', id],
    queryFn: () => reportsApi.json(id!).then(r => r.data),
    enabled: !!id,
  })

  if (isLoading) return <div className="p-8 text-center text-gray-400">Loading report...</div>
  if (!report) return <div className="p-8 text-center text-red-500">Report not found</div>

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{report.audit_name}</h1>
          <p className="text-sm text-gray-500">Framework v{report.framework_version} · Generated {new Date(report.generated_at).toLocaleString()}</p>
        </div>
        <div className="flex gap-3">
          <a href={reportsApi.htmlUrl(id!)} target="_blank" rel="noreferrer"
            className="flex items-center gap-2 border border-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
            <FileText size={15} /> HTML
          </a>
          <a href={reportsApi.csvUrl(id!)} download
            className="flex items-center gap-2 border border-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
            <FileSpreadsheet size={15} /> CSV
          </a>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Overall Score', value: `${report.overall_score}%`, color: 'text-[#1e3a5f]' },
          { label: 'Compliant', value: report.compliant_count, color: 'text-green-700' },
          { label: 'Partial', value: report.partial_count, color: 'text-yellow-700' },
          { label: 'Non-Compliant', value: report.non_compliant_count, color: 'text-red-700' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm text-center">
            <div className={`text-3xl font-bold ${color}`}>{value}</div>
            <div className="text-sm text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Domain summaries */}
      <div className="space-y-3">
        {report.domains.map(domain => (
          <div key={domain.domain_id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <div className="font-semibold text-gray-900">{domain.domain_id}: {domain.domain_name}</div>
              <div className="text-sm font-bold text-[#1e3a5f]">{domain.domain_score}%</div>
            </div>
            <div className="flex gap-4 text-xs text-gray-500">
              <span className="text-green-700">{domain.compliant_count} compliant</span>
              <span className="text-yellow-700">{domain.partial_count} partial</span>
              <span className="text-red-700">{domain.non_compliant_count} non-compliant</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
