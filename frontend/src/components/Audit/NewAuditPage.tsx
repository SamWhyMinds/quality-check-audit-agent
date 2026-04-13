import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { auditsApi } from '../../api/audits'
import { frameworkApi } from '../../api/framework'
import { Upload, X, CheckSquare, Square, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react'

const STEPS = ['Details', 'Domains', 'Review']

export default function NewAuditPage() {
  const navigate  = useNavigate()
  const [step, setStep]             = useState(0)
  const [name, setName]             = useState('')
  const [description, setDesc]      = useState('')
  const [selectedDomains, setDoms]  = useState<string[]>(
    Array.from({ length: 19 }, (_, i) => `D${String(i + 1).padStart(2, '0')}`)
  )

  const { data: domains } = useQuery({
    queryKey: ['framework-domains'],
    queryFn: () => frameworkApi.domains().then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: () =>
      auditsApi.create({ name, description, selected_domains: selectedDomains }).then(r => r.data),
    onSuccess: (audit) => navigate(`/sessions/${audit.id}/respond`),
  })

  const toggle = (id: string) =>
    setDoms(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id])

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">New Session</h1>
      <p className="text-sm text-gray-500 mb-8">
        Create an audit session to start the vendor response workflow.
      </p>

      {/* Stepper */}
      <div className="flex items-center gap-3 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
                ${i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-blue-500 text-white shadow-sm' : 'bg-gray-50 text-gray-400'}`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`text-sm transition-colors ${i === step ? 'text-gray-900 font-semibold' : 'text-gray-400'}`}>
                {s}
              </span>
            </div>
            {i < STEPS.length - 1 && <div className="w-8 h-px bg-gray-50" />}
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-6">
        {/* Step 0: Details */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-2">Session Name <span className="text-pink-600">*</span></label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Q2 2025 Vendor Assessment"
                className="input-cosmos"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-2">Description</label>
              <textarea
                value={description} onChange={e => setDesc(e.target.value)} rows={3}
                placeholder="Describe the scope and purpose of this assessment..."
                className="textarea-cosmos"
              />
            </div>
          </div>
        )}

        {/* Step 1: Domains */}
        {step === 1 && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-gray-500">
                {selectedDomains.length} of {domains?.length ?? 19} domains selected
              </span>
              <div className="flex gap-3">
                <button onClick={() => setDoms(domains?.map(d => d.id) ?? [])}
                  className="text-xs text-blue-600 hover:text-pink-600 transition-colors font-medium">
                  Select All
                </button>
                <button onClick={() => setDoms([])}
                  className="text-xs text-gray-400 hover:text-gray-900 transition-colors">
                  Clear
                </button>
              </div>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {(domains ?? []).map(d => (
                <label
                  key={d.id}
                  onClick={() => toggle(d.id)}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all
                    ${selectedDomains.includes(d.id)
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-gray-50 border-gray-200 hover:border-blue-200'}`}
                >
                  <div className="mt-0.5 shrink-0">
                    {selectedDomains.includes(d.id)
                      ? <CheckSquare size={16} className="text-blue-600" />
                      : <Square size={16} className="text-gray-400" />}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">{d.id}: {d.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{d.question_count} questions</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Review */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Session Summary</p>
            {[
              { label: 'Name',             value: name },
              { label: 'Description',      value: description || '—' },
              { label: 'Domains selected', value: `${selectedDomains.length} of 19` },
              { label: 'Total questions',  value: `${selectedDomains.length * 5} questions` },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between py-2 border-b border-gray-200 text-sm">
                <span className="text-gray-500">{label}</span>
                <span className="text-gray-900 font-medium">{value}</span>
              </div>
            ))}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-4">
              <p className="text-xs text-gray-500 leading-relaxed">
                After creating this session, vendors can navigate to <strong className="text-blue-600">Vendor Response</strong> to answer each question and upload evidence files. Clients can then review responses in the <strong className="text-pink-600">Client Review</strong> stage.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => setStep(s => s - 1)}
          disabled={step === 0}
          className="btn-secondary disabled:opacity-30"
        >
          <ArrowLeft size={14} /> Back
        </button>

        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={step === 0 && !name.trim()}
            className="btn-primary"
          >
            Next <ArrowRight size={14} />
          </button>
        ) : (
          <button
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending}
            className="btn-primary"
          >
            {createMut.isPending
              ? <><Loader2 size={14} className="animate-spin" /> Creating…</>
              : <>Create Session <ArrowRight size={14} /></>}
          </button>
        )}
      </div>
    </div>
  )
}
