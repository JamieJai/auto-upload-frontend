import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { PageTitle } from '@/components/app/Layout'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { api, ApiError, errorMessage, fileUrl } from '@/lib/api'
import { noticeFields, won } from '@/lib/labels'
import type { ApprovalItem, Page, Product, ValidationIssue } from '@/lib/types'
import { cn } from '@/lib/utils'

/** 생성된 문안을 검토하고 그 자리에서 고친 뒤 승인/반려한다. 판매자를 섞어서 보여 준다 */
export function ApprovalsPage() {
  const qc = useQueryClient()
  const list = useQuery({
    queryKey: ['approvals'],
    queryFn: () => api<Page<ApprovalItem>>('/api/approvals?size=100'),
    refetchInterval: 15_000,
  })
  const items = list.data?.content ?? []
  const [selectedId, setSelectedId] = useState<number | null>(null)
  // 승인·반려로 목록에서 빠지면 다음 항목으로 넘어간다
  const selected = items.find((i) => i.productId === selectedId) ?? items[0] ?? null

  return (
    <>
      <PageTitle title={`승인 대기 (${items.length})`} />
      {items.length === 0 ? (
        <div className="rounded-lg border bg-background p-8 text-center text-sm text-muted-foreground">승인을 기다리는 상품이 없습니다</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-[260px_1fr]">
          <ul className="flex max-h-[75vh] flex-col gap-1 overflow-auto">
            {items.map((i) => (
              <li key={i.productId}>
                <button
                  type="button"
                  onClick={() => setSelectedId(i.productId)}
                  className={cn('w-full rounded-md border bg-background px-3 py-2 text-left text-sm hover:bg-muted', selected?.productId === i.productId && 'border-primary')}
                >
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline">{i.tenantCode}</Badge>
                    <span className="font-medium">{i.code}</span>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">{i.name ?? '(이름 없음)'}</div>
                </button>
              </li>
            ))}
          </ul>
          {selected && (
            <Review
              key={selected.productId}
              item={selected}
              onDone={() => {
                qc.invalidateQueries({ queryKey: ['approvals'] })
                qc.invalidateQueries({ queryKey: ['dashboard'] })
              }}
            />
          )}
        </div>
      )}
    </>
  )
}

function Review({ item, onDone }: { item: ApprovalItem; onDone: () => void }) {
  const base = `/api/tenants/${item.tenantId}/products/${item.productId}`
  const q = useQuery({ queryKey: ['product', item.tenantId, String(item.productId)], queryFn: () => api<Product>(base) })
  const p = q.data
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [keywords, setKeywords] = useState('')
  const [note, setNote] = useState('')
  const [issues, setIssues] = useState<ValidationIssue[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (p) {
      setName(p.name ?? '')
      setDescription(p.description ?? '')
      setKeywords(p.searchKeywords.join(', '))
    }
  }, [p])

  if (!p) return null
  const dirty = name !== (p.name ?? '') || description !== (p.description ?? '') || keywords !== p.searchKeywords.join(', ')

  async function saveTexts(): Promise<void> {
    const camel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
    const req: Record<string, unknown> = {
      code: p!.code,
      category: p!.category,
      salePrice: p!.salePrice,
      name,
      description,
      searchKeywords: keywords.split(',').map((s) => s.trim()).filter(Boolean),
    }
    for (const f of noticeFields) req[camel(f.key)] = p!.notice[f.key]
    await api<Product>(base, { method: 'PUT', json: req })
  }

  async function decide(kind: 'approve' | 'reject') {
    setBusy(true)
    setIssues([])
    try {
      if (dirty) await saveTexts()
      await api(`${base}/${kind}`, { json: kind === 'reject' ? { note } : {} })
      toast.success(kind === 'approve' ? '승인했습니다. 채널 등록을 시작합니다' : '반려했습니다')
      onDone()
    } catch (e) {
      if (e instanceof ApiError && e.issues.length) setIssues(e.issues)
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const main = p.images.find((i) => i.slot === 'main')
  const colors = [...new Map(p.options.map((o) => [o.color, o.colorDisplay])).entries()]

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-background p-4">
      <div className="flex flex-wrap items-start gap-4">
        {main && <img src={fileUrl(main.thumbPath ?? main.path)} alt="" className="size-32 rounded border object-cover" />}
        <div className="min-w-0 flex-1 text-sm">
          <div className="text-xs text-muted-foreground">
            {item.tenantName} · {p.code} · {p.category} · {won(p.salePrice)}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {colors.map(([c, d]) => (
              <Badge key={c} variant="outline">
                {d ? `${d} (${c})` : c}
              </Badge>
            ))}
            <Badge variant="outline">{[...new Set(p.options.map((o) => o.size))].join(' / ')}</Badge>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">소재: {p.notice.material} · 제조국: {p.notice.origin_country}</div>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label className="text-xs">
          상품명 {p.fieldSources.NAME === 'AI' && <Badge variant="secondary">AI</Badge>}
        </Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs">
          상세설명 {p.fieldSources.DESCRIPTION === 'AI' && <Badge variant="secondary">AI</Badge>}
        </Label>
        <Textarea rows={10} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs">
          검색키워드 {p.fieldSources.SEARCH_KEYWORDS === 'AI' && <Badge variant="secondary">AI</Badge>}
        </Label>
        <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} />
      </div>

      <div className="flex flex-wrap gap-1">
        {p.images.map((img) => (
          <img key={img.id} src={fileUrl(img.thumbPath ?? img.path)} alt="" className="size-16 rounded border object-cover" loading="lazy" title={`${img.slot} ${img.seq}`} />
        ))}
      </div>

      {issues.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            <ul className="list-disc pl-4">
              {issues.map((i) => (
                <li key={i.field + i.code}>{i.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-end gap-2 border-t pt-4">
        <div className="grid flex-1 gap-1.5">
          <Label className="text-xs">반려 사유</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="반려할 때만 (예: 상품명에 색상 빼기)" />
        </div>
        <Button variant="outline" disabled={busy} onClick={() => decide('reject')}>
          반려
        </Button>
        <Button disabled={busy} onClick={() => decide('approve')}>
          {dirty ? '고친 내용 저장 후 승인' : '승인'}
        </Button>
      </div>
    </div>
  )
}
