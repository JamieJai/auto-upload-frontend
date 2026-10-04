import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { FileSpreadsheet, Plus } from 'lucide-react'

import { ExcelImportDialog } from '@/components/app/ExcelImportDialog'
import { NeedTenant, PageTitle } from '@/components/app/Layout'
import { ProductStatusBadge } from '@/components/app/StatusBadge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'
import { when, won } from '@/lib/labels'
import { useTenant } from '@/lib/tenant'
import type { Page, ProductStatus, ProductSummary } from '@/lib/types'

const filters: { value: ProductStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: 'DRAFT', label: '입력 중' },
  { value: 'NEEDS_INPUT', label: '보완 필요' },
  { value: 'GENERATING', label: '생성 중' },
  { value: 'PENDING_APPROVAL', label: '승인 대기' },
  { value: 'APPROVED', label: '승인됨' },
  { value: 'CANCELLED', label: '취소' },
]

export function ProductsPage() {
  const { current } = useTenant()
  const navigate = useNavigate()
  const [status, setStatus] = useState<ProductStatus | 'ALL'>('ALL')
  const [page, setPage] = useState(0)
  const [excel, setExcel] = useState(false)

  const q = useQuery({
    queryKey: ['products', current?.id, status, page],
    queryFn: () =>
      api<Page<ProductSummary>>(
        `/api/tenants/${current!.id}/products?page=${page}&size=30` + (status === 'ALL' ? '' : `&status=${status}`),
      ),
    enabled: !!current,
    refetchInterval: 15_000,
  })

  if (!current) return <NeedTenant />
  const p = q.data?.page

  return (
    <>
      <PageTitle title={`상품 · ${current.name}`}>
        <Button variant="outline" size="sm" onClick={() => setExcel(true)}>
          <FileSpreadsheet /> 엑셀 업로드
        </Button>
        <Button size="sm" onClick={() => navigate('/products/new')}>
          <Plus /> 새 상품
        </Button>
      </PageTitle>
      <Tabs
        value={status}
        onValueChange={(v) => {
          setStatus(v as ProductStatus | 'ALL')
          setPage(0)
        }}
        className="mb-3"
      >
        <TabsList className="flex-wrap">
          {filters.map((f) => (
            <TabsTrigger key={f.value} value={f.value}>
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>상품코드</TableHead>
              <TableHead>상품명</TableHead>
              <TableHead>카테고리</TableHead>
              <TableHead className="text-right">판매가</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>수정</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data?.content.map((r) => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/products/${r.id}`)}>
                <TableCell className="font-medium">
                  <Link to={`/products/${r.id}`}>{r.code}</Link>
                </TableCell>
                <TableCell className="max-w-80 truncate">{r.name ?? <span className="text-muted-foreground">(비어 있음)</span>}</TableCell>
                <TableCell>{r.category}</TableCell>
                <TableCell className="text-right tabular-nums">{won(r.salePrice)}</TableCell>
                <TableCell>
                  <ProductStatusBadge status={r.status} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{when(r.updatedAt)}</TableCell>
              </TableRow>
            ))}
            {q.data?.content.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  상품이 없습니다
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {p && p.totalPages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
            이전
          </Button>
          {page + 1} / {p.totalPages}
          <Button variant="outline" size="sm" disabled={page + 1 >= p.totalPages} onClick={() => setPage(page + 1)}>
            다음
          </Button>
        </div>
      )}
      <ExcelImportDialog open={excel} onOpenChange={setExcel} tenantId={current.id} />
    </>
  )
}
