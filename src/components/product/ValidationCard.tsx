import { useQuery } from '@tanstack/react-query'
import { CircleAlert, CircleCheck } from 'lucide-react'

import { api } from '@/lib/api'
import type { ValidationIssue } from '@/lib/types'

/** 제출 전에 막히는 항목. 저장된 값 기준이라 고친 뒤 저장해야 갱신된다 */
export function ValidationCard({ tenantId, productId, dirty }: { tenantId: number; productId: number; dirty: boolean }) {
  const q = useQuery({
    queryKey: ['validation', tenantId, String(productId)],
    queryFn: () => api<{ ok: boolean; issues: ValidationIssue[] }>(`/api/tenants/${tenantId}/products/${productId}/validation?phase=INPUT`),
  })
  const issues = q.data?.issues ?? []
  return (
    <section className="rounded-lg border bg-background p-4 text-sm">
      <h2 className="mb-2 font-semibold">제출 전 검증</h2>
      {q.data?.ok ? (
        <p className="flex items-center gap-1.5 text-emerald-700">
          <CircleCheck className="size-4" /> 필수값이 모두 채워졌습니다
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {issues.map((i) => (
            <li key={i.field + i.code} className="flex gap-1.5 text-destructive">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
              {i.message}
            </li>
          ))}
        </ul>
      )}
      {dirty && <p className="mt-3 text-xs text-muted-foreground">저장하지 않은 변경이 있습니다. 저장해야 검증에 반영됩니다.</p>}
      <p className="mt-3 text-xs text-muted-foreground">상품명·상세설명은 비워 둬도 제출할 수 있습니다 (AI 가 생성).</p>
    </section>
  )
}
