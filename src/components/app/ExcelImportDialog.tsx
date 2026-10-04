import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api, errorMessage } from '@/lib/api'
import type { ExcelImportResult, ExcelPreview } from '@/lib/types'

/** 1) 파일 선택 → 2) 미리보기(저장 안 함) → 3) 확인 후 등록. 엑셀이 한 번에 잘못 들어가는 것을 막는다 */
export function ExcelImportDialog({ open, onOpenChange, tenantId }: { open: boolean; onOpenChange: (o: boolean) => void; tenantId: number }) {
  const qc = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ExcelPreview | null>(null)
  const [result, setResult] = useState<ExcelImportResult | null>(null)
  const [busy, setBusy] = useState(false)

  function reset() {
    setFile(null)
    setPreview(null)
    setResult(null)
  }

  async function send(kind: 'preview' | 'import') {
    if (!file) return
    const form = new FormData()
    form.append('file', file)
    setBusy(true)
    try {
      if (kind === 'preview') {
        setPreview(await api<ExcelPreview>(`/api/tenants/${tenantId}/excel/preview`, { form }))
      } else {
        const r = await api<ExcelImportResult>(`/api/tenants/${tenantId}/excel/import`, { form })
        setResult(r)
        toast.success(`${r.created}건 등록`)
        qc.invalidateQueries({ queryKey: ['products'] })
      }
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>엑셀 일괄 등록</DialogTitle>
          <DialogDescription>
            템플릿을 채워 올리면 먼저 검증 결과를 보여 줍니다. 확인 후 &quot;등록&quot;을 눌러야 상품이 만들어집니다.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="/api/excel/template">
              <Download /> 템플릿 받기
            </a>
          </Button>
          <Input
            type="file"
            accept=".xlsx"
            className="max-w-xs"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
              setPreview(null)
              setResult(null)
            }}
          />
          <Button size="sm" variant="secondary" disabled={!file || busy} onClick={() => send('preview')}>
            검증
          </Button>
        </div>

        {preview && !result && (
          <>
            <div className="flex gap-3 text-sm">
              <span>전체 {preview.total}행</span>
              <span className="text-emerald-700">등록 가능 {preview.importable}</span>
              <span className="text-destructive">등록 불가 {preview.blocked}</span>
            </div>
            {preview.notes.length > 0 && (
              <ul className="list-disc pl-5 text-xs text-muted-foreground">
                {preview.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
            <div className="max-h-96 overflow-auto rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>행</TableHead>
                    <TableHead>상품코드</TableHead>
                    <TableHead>옵션</TableHead>
                    <TableHead>결과</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((r) => (
                    <TableRow key={r.rowNumber}>
                      <TableCell>{r.rowNumber}</TableCell>
                      <TableCell className="font-medium">{r.product.code}</TableCell>
                      <TableCell className="text-xs">
                        {r.colors.length}색 × {r.sizes.length}사이즈 · 재고 {r.stock}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.errors.length > 0 ? (
                          <span className="text-destructive">{r.errors.join(' · ')}</span>
                        ) : r.warnings.length > 0 ? (
                          <span>
                            <Badge variant="secondary">등록 후 보완</Badge> {r.warnings.map((w) => w.message).join(' · ')}
                          </span>
                        ) : (
                          <Badge>OK</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">이미지는 엑셀이 아니라 이미지 화면에서 파일명 규칙으로 올립니다.</p>
          </>
        )}

        {result && (
          <div className="text-sm">
            <p>
              등록 {result.created}건 · 건너뜀 {result.skipped}건
            </p>
            {result.rows.filter((r) => r.error).length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-xs text-destructive">
                {result.rows
                  .filter((r) => r.error)
                  .map((r) => (
                    <li key={r.rowNumber}>
                      {r.rowNumber}행 {r.code}: {r.error}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}

        <DialogFooter>
          {preview && !result && (
            <Button disabled={busy || preview.importable === 0} onClick={() => send('import')}>
              {preview.importable}건 등록
            </Button>
          )}
          {result && <Button onClick={() => onOpenChange(false)}>닫기</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
