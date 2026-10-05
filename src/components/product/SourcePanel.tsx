import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'

import { api, ApiError } from '@/lib/api'
import { when } from '@/lib/labels'
import { Section } from './Section'

interface Source {
  sourceUrl: string | null
  title: string | null
  rawText: string
  notes: string | null
  capturedAt: string
  extractedAt: string | null
}

/** 확장으로 받은 도매처 원문. 자동으로 채운 값을 여기와 대조한다 */
export function SourcePanel({ tenantId, productId }: { tenantId: number; productId: number }) {
  const q = useQuery({
    queryKey: ['source', tenantId, productId],
    queryFn: async () => {
      try {
        return await api<Source>(`/api/tenants/${tenantId}/products/${productId}/source`)
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null
        throw e
      }
    },
    refetchInterval: (query) => (query.state.data && !query.state.data.extractedAt ? 3_000 : false),
  })
  const s = q.data
  const qc = useQueryClient()
  const extractedAt = s?.extractedAt
  // 추출이 끝나면 채워진 값을 다시 불러온다
  useEffect(() => {
    if (extractedAt) qc.invalidateQueries({ queryKey: ['product'] })
  }, [extractedAt, qc])
  if (!s) return null
  return (
    <Section title="도매처 원문" description={s.extractedAt ? `받음 ${when(s.capturedAt)} · AI 추출 ${when(s.extractedAt)}` : 'AI 가 원문에서 값을 뽑는 중입니다…'}>
      {s.sourceUrl && (
        <a href={s.sourceUrl} target="_blank" rel="noreferrer" className="mb-2 inline-flex items-center gap-1 text-xs underline">
          <ExternalLink className="size-3" /> {s.title || s.sourceUrl}
        </a>
      )}
      <pre className="max-h-96 overflow-auto rounded bg-muted/60 p-3 text-xs whitespace-pre-wrap">{s.rawText}</pre>
    </Section>
  )
}
