import { useState } from 'react'
import { Link } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { NeedTenant, PageTitle } from '@/components/app/Layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api, errorMessage } from '@/lib/api'
import { slots, when } from '@/lib/labels'
import { useTenant } from '@/lib/tenant'
import type { Page, ProductSummary, Slot, UnmatchedFile, UploadResult } from '@/lib/types'

export function ImagesPage() {
  const { current } = useTenant()
  const qc = useQueryClient()
  const [result, setResult] = useState<UploadResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)

  const unmatched = useQuery({
    queryKey: ['unmatched', current?.id],
    queryFn: () => api<UnmatchedFile[]>(`/api/tenants/${current!.id}/images/unmatched`),
    enabled: !!current,
  })

  if (!current) return <NeedTenant />

  async function upload(files: File[]) {
    if (!files.length) return
    // 한 요청이 너무 커지지 않게 30장씩 나눈다
    const merged: UploadResult = { matched: [], unmatched: [] }
    setBusy(true)
    try {
      for (let i = 0; i < files.length; i += 30) {
        const form = new FormData()
        files.slice(i, i + 30).forEach((f) => form.append('files', f))
        const r = await api<UploadResult>(`/api/tenants/${current!.id}/images`, { form })
        merged.matched.push(...r.matched)
        merged.unmatched.push(...r.unmatched)
      }
      setResult(merged)
      toast.success(`매칭 ${merged.matched.length}장 · 미매칭 ${merged.unmatched.length}장`)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
      qc.invalidateQueries({ queryKey: ['unmatched'] })
      qc.invalidateQueries({ queryKey: ['product'] })
    }
  }

  return (
    <>
      <PageTitle title={`이미지 · ${current.name}`} />
      <label
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          upload(Array.from(e.dataTransfer.files))
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-background p-10 text-sm ${drag ? 'border-primary bg-primary/5' : ''}`}
      >
        <Upload className="size-6 text-muted-foreground" />
        <div>{busy ? '올리는 중…' : '여기에 이미지를 끌어 놓거나 눌러서 고르세요'}</div>
        <div className="text-xs text-muted-foreground">
          파일명 규칙: <code>{'{상품코드}_{슬롯}_{순번}.jpg'}</code> — 슬롯은 main · sub · detail · size (예: SS2609001_detail_01.jpg)
        </div>
        <input type="file" multiple accept="image/jpeg,image/png,image/webp" hidden disabled={busy} onChange={(e) => upload(Array.from(e.target.files ?? []))} />
      </label>

      {result && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border bg-background p-3 text-sm">
            <div className="mb-2 font-medium">매칭됨 {result.matched.length}</div>
            <ul className="max-h-60 overflow-auto text-xs">
              {result.matched.map((m) => (
                <li key={m.filename + m.imageId}>
                  {m.filename} →{' '}
                  <Link className="hover:underline" to={`/products/${m.productId}`}>
                    {m.productCode}
                  </Link>{' '}
                  {m.slot} {m.seq}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border bg-background p-3 text-sm">
            <div className="mb-2 font-medium text-destructive">매칭 안 됨 {result.unmatched.length}</div>
            <ul className="max-h-60 overflow-auto text-xs">
              {result.unmatched.map((u) => (
                <li key={u.filename}>
                  {u.filename} — <span className="text-muted-foreground">{u.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <h2 className="mt-8 mb-2 text-sm font-medium">수동 배정 대기 ({unmatched.data?.length ?? 0})</h2>
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>파일</TableHead>
              <TableHead>올린 시각</TableHead>
              <TableHead>배정</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {unmatched.data?.map((f) => (
              <AssignRow key={f.filename} file={f} tenantId={current.id} onDone={() => qc.invalidateQueries({ queryKey: ['unmatched'] })} />
            ))}
            {unmatched.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                  없습니다
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </>
  )
}

function AssignRow({ file, tenantId, onDone }: { file: UnmatchedFile; tenantId: number; onDone: () => void }) {
  const [code, setCode] = useState(file.filename.split('_')[0] ?? '')
  const [slot, setSlot] = useState<Slot>('detail')
  const [seq, setSeq] = useState('1')
  const [busy, setBusy] = useState(false)

  async function assign() {
    setBusy(true)
    try {
      // 상품코드로 상품을 찾는다 (같은 판매자 안에서만)
      const page = await api<Page<ProductSummary>>(`/api/tenants/${tenantId}/products?size=200`)
      const p = page.content.find((x) => x.code === code.trim())
      if (!p) throw new Error(`상품코드 ${code} 를 찾을 수 없습니다`)
      await api(`/api/tenants/${tenantId}/images/unmatched/assign`, { json: { filename: file.filename, productId: p.id, slot, seq: Number(seq) || 1 } })
      toast.success(`${p.code} ${slot} ${seq} 로 배정했습니다`)
      onDone()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    try {
      await api(`/api/tenants/${tenantId}/images/unmatched?filename=${encodeURIComponent(file.filename)}`, { method: 'DELETE' })
      onDone()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <TableRow>
      <TableCell className="text-xs">{file.filename}</TableCell>
      <TableCell className="text-xs text-muted-foreground">{when(file.modifiedAt)}</TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-1.5">
          <Input className="h-7 w-32" value={code} onChange={(e) => setCode(e.target.value)} placeholder="상품코드" />
          <Select value={slot} onValueChange={(v) => setSlot(v as Slot)}>
            <SelectTrigger size="sm" className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {slots.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input className="h-7 w-14" inputMode="numeric" value={seq} onChange={(e) => setSeq(e.target.value.replace(/\D/g, ''))} />
          <Button size="xs" disabled={busy || !code.trim()} onClick={assign}>
            배정
          </Button>
          <Button size="icon-xs" variant="ghost" onClick={() => confirm('이 파일을 지울까요?') && remove()}>
            <Trash2 />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}
