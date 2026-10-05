import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api, errorMessage } from '@/lib/api'
import { measureParts } from '@/lib/labels'
import type { Product } from '@/lib/types'
import { Section } from './Section'

type Grid = Record<string, Record<string, string>>

/** 옵션의 사이즈마다 한 줄, 부위마다 한 칸 (cm). AI 생성 금지 */
export function MeasurementsCard({ product, tenantId, editable, onChange }: { product: Product; tenantId: number; editable: boolean; onChange: (p: Product) => void }) {
  const sizes = useMemo(() => {
    const s = [...new Set(product.options.map((o) => o.size))]
    for (const m of product.measurements) if (!s.includes(m.size)) s.push(m.size)
    return s
  }, [product.options, product.measurements])

  const initial = useMemo(() => {
    const g: Grid = {}
    for (const size of sizes) g[size] = {}
    for (const m of product.measurements) for (const [k, v] of Object.entries(m.measures)) g[m.size][k] = String(v)
    return g
  }, [sizes, product.measurements])

  const initialParts = useMemo(() => {
    const used = new Set(product.measurements.flatMap((m) => Object.keys(m.measures)))
    const parts = measureParts.filter((p) => used.has(p))
    for (const p of used) if (!parts.includes(p)) parts.push(p)
    return parts.length ? parts : ['총장', '어깨너비', '가슴단면', '소매길이']
  }, [product.measurements])

  const [grid, setGrid] = useState<Grid>(initial)
  const [parts, setParts] = useState<string[]>(initialParts)
  const [newPart, setNewPart] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => setGrid(initial), [initial])
  useEffect(() => setParts(initialParts), [initialParts])
  const dirty = JSON.stringify(grid) !== JSON.stringify(initial)

  async function save() {
    setBusy(true)
    try {
      const measurements = sizes
        .map((size) => ({
          size,
          measures: Object.fromEntries(
            Object.entries(grid[size] ?? {})
              .filter(([, v]) => v.trim() !== '')
              .map(([k, v]) => [k, Number(v)]),
          ),
        }))
        .filter((m) => Object.keys(m.measures).length > 0)
      if (measurements.some((m) => Object.values(m.measures).some((v) => Number.isNaN(v)))) throw new Error('숫자만 입력하세요')
      onChange(await api<Product>(`/api/tenants/${tenantId}/products/${product.id}/measurements`, { method: 'PUT', json: { measurements } }))
      toast.success('실측을 저장했습니다')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section
      title="실측 (cm)"
      description="선택 항목입니다 (특성에서 필수로 바꿀 수 있음). 입력하면 상세페이지에 실측표가 들어갑니다."
      actions={
        editable && (
          <Button size="xs" variant="outline" disabled={busy || !dirty} onClick={save}>
            실측 저장
          </Button>
        )
      }
    >
      {sizes.length === 0 ? (
        <p className="text-sm text-muted-foreground">옵션을 먼저 만드세요.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>사이즈</TableHead>
                {parts.map((p) => (
                  <TableHead key={p} className="min-w-20">
                    {p}
                  </TableHead>
                ))}
                {editable && (
                  <TableHead>
                    <div className="flex gap-1">
                      <Input className="h-7 w-24" placeholder="부위 추가" value={newPart} onChange={(e) => setNewPart(e.target.value)} />
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        disabled={!newPart.trim() || parts.includes(newPart.trim())}
                        onClick={() => {
                          setParts([...parts, newPart.trim()])
                          setNewPart('')
                        }}
                      >
                        <Plus />
                      </Button>
                    </div>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sizes.map((size) => (
                <TableRow key={size}>
                  <TableCell className="font-medium">{size}</TableCell>
                  {parts.map((p) => (
                    <TableCell key={p}>
                      <Input
                        className="h-7 w-20"
                        inputMode="decimal"
                        disabled={!editable}
                        value={grid[size]?.[p] ?? ''}
                        onChange={(e) => setGrid((g) => ({ ...g, [size]: { ...g[size], [p]: e.target.value.replace(/[^\d.]/g, '') } }))}
                      />
                    </TableCell>
                  ))}
                  {editable && <TableCell />}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Section>
  )
}
