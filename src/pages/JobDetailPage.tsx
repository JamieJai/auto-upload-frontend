import { Link, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { PageTitle } from '@/components/app/Layout'
import { JobStatusBadge, ListingStatusBadge } from '@/components/app/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api, errorMessage } from '@/lib/api'
import { channelLabel, jobType, when } from '@/lib/labels'
import type { JobDetail } from '@/lib/types'

export function JobDetailPage() {
  const { id } = useParams()
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: ['job', id],
    queryFn: () => api<JobDetail>(`/api/jobs/${id}`),
    refetchInterval: (query) => {
      const s = query.state.data?.job.status
      return s === 'QUEUED' || s === 'RUNNING' || s === 'FAILED_RETRYABLE' ? 3_000 : false
    },
  })
  const retry = useMutation({
    mutationFn: () => api<JobDetail>(`/api/jobs/${id}/retry`, { method: 'POST' }),
    onSuccess: (d) => {
      qc.setQueryData(['job', id], d)
      toast.success('다시 대기열에 넣었습니다')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const d = q.data
  if (!d) return null
  const j = d.job
  const canRetry = j.type === 'REGISTER' && (j.status === 'FAILED_INVALID' || j.status === 'FAILED_RETRYABLE')

  return (
    <>
      <PageTitle title={`작업 #${j.id} · ${jobType[j.type]}`}>
        <JobStatusBadge status={j.status} />
        {canRetry && (
          <Button size="sm" onClick={() => retry.mutate()} disabled={retry.isPending}>
            지금 다시 시도
          </Button>
        )}
      </PageTitle>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-background p-4 text-sm md:col-span-1">
          <Row k="판매자" v={j.tenantCode} />
          <Row
            k="상품"
            v={
              <Link className="hover:underline" to={`/products/${j.productId}`}>
                {j.productCode} {j.productName}
              </Link>
            }
          />
          <Row k="단계" v={j.step} />
          <Row k="시도" v={`${j.attempt}회`} />
          {j.status === 'FAILED_RETRYABLE' && <Row k="다음 시도" v={when(j.nextRunAt)} />}
          <Row k="생성" v={when(j.createdAt)} />
          {j.lastError && <p className="mt-3 rounded bg-destructive/10 p-2 text-destructive">{j.lastError}</p>}
        </div>
        {d.listing && (
          <div className="rounded-lg border bg-background p-4 text-sm md:col-span-2">
            <div className="mb-2 flex items-center gap-2 font-medium">
              {channelLabel[d.listing.channel]} · {d.listing.accountName}
              <ListingStatusBadge status={d.listing.status} />
            </div>
            <Row k="채널 상품번호" v={d.listing.channelProductNo ?? '-'} />
            <Row k="등록 시각" v={when(d.listing.registeredAt)} />
            {d.listing.lastResponse != null && (
              <details className="mt-2">
                <summary className="cursor-pointer text-muted-foreground">채널 응답 원문</summary>
                <pre className="mt-2 max-h-80 overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(d.listing.lastResponse, null, 2)}</pre>
              </details>
            )}
          </div>
        )}
      </div>
      <h2 className="mt-6 mb-2 text-sm font-medium">진행 이력</h2>
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">시각</TableHead>
              <TableHead className="w-28">단계</TableHead>
              <TableHead>내용</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {d.logs.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">{when(l.createdAt)}</TableCell>
                <TableCell>
                  <Badge variant={l.level === 'ERROR' ? 'destructive' : l.level === 'WARN' ? 'secondary' : 'outline'}>{l.step}</Badge>
                </TableCell>
                <TableCell className="whitespace-pre-wrap">{l.message}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-2 py-0.5">
      <span className="w-24 shrink-0 text-muted-foreground">{k}</span>
      <span className="min-w-0 break-all">{v}</span>
    </div>
  )
}
