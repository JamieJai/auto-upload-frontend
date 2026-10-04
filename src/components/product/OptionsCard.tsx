import { useEffect, useState } from 'react'
import { Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api, errorMessage } from '@/lib/api'
import type { Product, ProductOption } from '@/lib/types'
import { Section } from './Section'

export function OptionsCard({ product, tenantId, editable, onChange }: { product: Product; tenantId: number; editable: boolean; onChange: (p: Product) => void }) {
  const base = `/api/tenants/${tenantId}/products/${product.id}`
  const [rows, setRows] = useState<ProductOption[]>(product.options)
  const [colors, setColors] = useState('')
  const [sizes, setSizes] = useState('')
  const [stock, setStock] = useState('0')
  const [busy, setBusy] = useState(false)

  useEffect(() => setRows(product.options), [product.options])
  const dirty = JSON.stringify(rows) !== JSON.stringify(product.options)

  async function run(fn: () => Promise<Product>, ok: string) {
    setBusy(true)
    try {
      onChange(await fn())
      toast.success(ok)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const combine = () => {
    if (product.options.length && !confirm('기존 옵션을 지우고 새 조합으로 바꿀까요?')) return
    run(
      () => api<Product>(`${base}/options/combine`, { json: { colors: split(colors), sizes: split(sizes), stock: Number(stock) || 0 } }),
      '옵션을 만들었습니다',
    )
  }
  const save = () =>
    run(
      () =>
        api<Product>(`${base}/options`, {
          method: 'PUT',
          json: { options: rows.map(({ color, size, colorDisplay, stock, extraPrice, sku }) => ({ color, size, colorDisplay, stock, extraPrice, sku })) },
        }),
      '옵션을 저장했습니다',
    )
  const generate = () => run(() => api<Product>(`${base}/generate`, { json: { field: 'OPTION_DISPLAY' } }), '색상 표시명을 생성했습니다')

  const update = (i: number, patch: Partial<ProductOption>) => setRows((r) => r.map((o, j) => (j === i ? { ...o, ...patch } : o)))
  const src = product.fieldSources.OPTION_DISPLAY

  return (
    <Section
      title={`옵션 (${product.options.length})`}
      description="실제 색상·사이즈·재고는 입력값 그대로 씁니다. AI 는 고객에게 보일 색상 표시명만 만듭니다."
      actions={
        editable && (
          <>
            {src && <Badge variant="outline">표시명 {src === 'AI' ? 'AI' : '직접'}</Badge>}
            <Button variant="ghost" size="xs" disabled={busy || !product.options.length} onClick={generate}>
              <Sparkles /> 표시명 AI로 생성
            </Button>
            <Button size="xs" variant="outline" disabled={busy || !dirty} onClick={save}>
              옵션 저장
            </Button>
          </>
        )
      }
    >
      {editable && (
        <div className="mb-3 grid gap-2 rounded-md bg-muted/50 p-3 sm:grid-cols-[1fr_1fr_90px_auto]">
          <Input placeholder="색상: 블랙, 아이보리" value={colors} onChange={(e) => setColors(e.target.value)} />
          <Input placeholder="사이즈: S, M, L" value={sizes} onChange={(e) => setSizes(e.target.value)} />
          <Input placeholder="재고" inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} />
          <Button size="sm" variant="secondary" disabled={busy || !split(colors).length || !split(sizes).length} onClick={combine}>
            조합 생성
          </Button>
        </div>
      )}
      {rows.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>색상</TableHead>
              <TableHead>사이즈</TableHead>
              <TableHead>표시명</TableHead>
              <TableHead className="w-24">재고</TableHead>
              <TableHead className="w-28">추가금</TableHead>
              <TableHead>SKU</TableHead>
              {editable && <TableHead className="w-8" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((o, i) => (
              <TableRow key={o.id ?? `${o.color}-${o.size}-${i}`}>
                <TableCell>{o.color}</TableCell>
                <TableCell>{o.size}</TableCell>
                <TableCell>
                  <Input className="h-7" value={o.colorDisplay ?? ''} placeholder={o.color} disabled={!editable} onChange={(e) => update(i, { colorDisplay: e.target.value || null })} />
                </TableCell>
                <TableCell>
                  <Input className="h-7" inputMode="numeric" value={o.stock} disabled={!editable} onChange={(e) => update(i, { stock: Number(e.target.value.replace(/\D/g, '')) || 0 })} />
                </TableCell>
                <TableCell>
                  <Input className="h-7" inputMode="numeric" value={o.extraPrice} disabled={!editable} onChange={(e) => update(i, { extraPrice: Number(e.target.value.replace(/[^\d-]/g, '')) || 0 })} />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{o.sku}</TableCell>
                {editable && (
                  <TableCell>
                    <Button variant="ghost" size="icon-xs" onClick={() => setRows((r) => r.filter((_, j) => j !== i))}>
                      <Trash2 />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Section>
  )
}

function split(s: string): string[] {
  return s
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean)
}
