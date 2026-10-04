import { useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'

import { PageTitle } from '@/components/app/Layout'
import { JobStatusBadge } from '@/components/app/StatusBadge'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import { jobType, when } from '@/lib/labels'
import { useTenant } from '@/lib/tenant'
import type { Dashboard } from '@/lib/types'

export function DashboardPage() {
  const { current } = useTenant()
  const [all, setAll] = useState(true)
  const tenantId = all ? undefined : current?.id
  const q = useQuery({
    queryKey: ['dashboard', tenantId ?? 'all'],
    queryFn: () => api<Dashboard>('/api/dashboard' + (tenantId ? `?tenantId=${tenantId}` : '')),
    refetchInterval: 10_000,
  })
  const t = q.data?.today

  return (
    <>
      <PageTitle title="작업 현황">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={all} onCheckedChange={setAll} />
          전체 판매자
        </label>
      </PageTitle>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="오늘 접수" value={t?.received} />
        <Stat label="오늘 등록 완료" value={t?.completed} />
        <Stat label="처리 중" value={t?.processing} hint="대기·실행·재시도 대기" />
        <Stat label="수정 필요" value={t?.failed} tone={t && t.failed > 0 ? 'bad' : undefined} />
        <Stat label="승인 대기" value={t?.pendingApproval} link="/approvals" />
      </div>

      <h2 className="mt-8 mb-2 text-sm font-medium">최근 작업</h2>
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>시각</TableHead>
              {all && <TableHead>판매자</TableHead>}
              <TableHead>상품</TableHead>
              <TableHead>작업</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>메시지</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data?.recent.map((j) => (
              <TableRow key={j.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">{when(j.updatedAt)}</TableCell>
                {all && <TableCell>{j.tenantCode}</TableCell>}
                <TableCell>
                  <Link to={`/products/${j.productId}`} className="hover:underline">
                    {j.productCode}
                  </Link>
                  <span className="ml-1 text-muted-foreground">{j.productName}</span>
                </TableCell>
                <TableCell>
                  <Link to={`/jobs/${j.id}`} className="hover:underline">
                    {jobType[j.type]}
                  </Link>
                </TableCell>
                <TableCell>
                  <JobStatusBadge status={j.status} />
                </TableCell>
                <TableCell className="max-w-72 truncate text-muted-foreground" title={j.lastError ?? ''}>
                  {j.lastError ?? j.step}
                </TableCell>
              </TableRow>
            ))}
            {q.data && q.data.recent.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  아직 작업이 없습니다. 상품을 등록하고 제출하면 여기에 나타납니다.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </>
  )
}

function Stat({ label, value, hint, tone, link }: { label: string; value?: number; hint?: string; tone?: 'bad'; link?: string }) {
  const body = (
    <div className="rounded-lg border bg-background p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone === 'bad' ? 'text-destructive' : ''}`}>{value ?? '–'}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  )
  return link ? <Link to={link}>{body}</Link> : body
}
