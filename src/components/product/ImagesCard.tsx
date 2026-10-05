import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Eraser, RotateCcw, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { api, errorMessage, fileUrl } from '@/lib/api'
import { slots } from '@/lib/labels'
import type { Product, Slot } from '@/lib/types'
import { Section } from './Section'
import { WebImageFinder } from './WebImageFinder'

export function ImagesCard({ product, tenantId, editable, onChange }: { product: Product; tenantId: number; editable: boolean; onChange: () => void }) {
  const [busy, setBusy] = useState<Slot | null>(null)
  const [wmBusy, setWmBusy] = useState(false)
  const [template, setTemplate] = useState('')
  const [redo, setRedo] = useState(false)
  const inputs = useRef<Partial<Record<Slot, HTMLInputElement | null>>>({})
  const templates = useQuery({
    queryKey: ['watermarks'],
    queryFn: () => api<{ name: string; width: number; height: number }[]>('/api/watermarks'),
    enabled: editable,
  })
  const ver = (img: { sha256: string | null }) => (img.sha256 ? `?v=${img.sha256.slice(0, 10)}` : '')

  /** 사진당 20초 안팎이라 워커 작업으로 돌리고 끝날 때까지 기다린다 */
  async function removeWatermark() {
    setWmBusy(true)
    try {
      const { jobId } = await api<{ jobId: number }>(`/api/tenants/${tenantId}/products/${product.id}/watermark`, { json: { template, redo } })
      toast.info(`워터마크 제거를 시작했습니다 (작업 #${jobId}, 사진당 20초 안팎)`)
      for (let i = 0; i < 180; i++) {
        await new Promise((r) => setTimeout(r, 5000))
        const d = await api<{ job: { status: string; lastError: string | null }; logs: { message: string }[] }>(`/api/jobs/${jobId}`)
        if (d.job.status === 'SUCCEEDED') {
          toast.success(d.logs[d.logs.length - 1]?.message ?? '완료')
          break
        }
        if (d.job.status === 'FAILED_INVALID' || d.job.status === 'CANCELLED') {
          toast.error(d.job.lastError ?? '실패')
          break
        }
      }
      onChange()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setWmBusy(false)
    }
  }

  async function restore(imageId: number) {
    try {
      await api(`/api/tenants/${tenantId}/products/${product.id}/images/${imageId}/restore`, { method: 'POST' })
      onChange()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  async function upload(slot: Slot, files: FileList | null) {
    if (!files?.length) return
    const form = new FormData()
    for (const f of Array.from(files)) form.append('files', f)
    setBusy(slot)
    try {
      await api(`/api/tenants/${tenantId}/products/${product.id}/images?slot=${slot}`, { form })
      toast.success(`${files.length}장 올렸습니다`)
      onChange()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(null)
      const el = inputs.current[slot]
      if (el) el.value = ''
    }
  }

  async function remove(imageId: number) {
    try {
      await api(`/api/tenants/${tenantId}/products/${product.id}/images/${imageId}`, { method: 'DELETE' })
      onChange()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <Section
      title="이미지"
      description={`여러 상품을 한꺼번에 올릴 때는 이미지 화면에서 파일명 규칙(${product.code}_detail_01.jpg)으로 올리세요.`}
      actions={
        editable &&
        (templates.data?.length ?? 0) > 0 && (
          <div className="flex items-center gap-1.5">
            <select className="h-7 rounded-md border bg-background px-2 text-xs" value={template} onChange={(e) => setTemplate(e.target.value)}>
              <option value="">워터마크 템플릿</option>
              {templates.data!.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name} ({t.width}×{t.height})
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-[11px] text-muted-foreground" title="이미 처리한 사진도 보관한 원본에서 다시 처리">
              <input type="checkbox" checked={redo} onChange={(e) => setRedo(e.target.checked)} /> 원본에서 다시
            </label>
            <Button size="xs" variant="outline" disabled={!template || wmBusy} onClick={removeWatermark}>
              <Eraser /> {wmBusy ? '지우는 중…' : '워터마크 제거'}
            </Button>
          </div>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {slots.map((s) => {
          const imgs = product.images.filter((i) => i.slot === s.value)
          const short = imgs.length < s.min
          return (
            <div key={s.value}>
              <div className="mb-1.5 flex items-center gap-2 text-xs">
                <span className="font-medium">{s.label}</span>
                <span className={short ? 'text-destructive' : 'text-muted-foreground'}>
                  {imgs.length}/{s.min}장 이상
                </span>
                {editable && (
                  <>
                    <input ref={(el) => void (inputs.current[s.value] = el)} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => upload(s.value, e.target.files)} />
                    <Button variant="ghost" size="xs" className="ml-auto" disabled={busy !== null} onClick={() => inputs.current[s.value]?.click()}>
                      <Upload /> {busy === s.value ? '올리는 중…' : '추가'}
                    </Button>
                  </>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {imgs.map((img) => (
                  <div key={img.id} className="group relative">
                    <a href={fileUrl(img.path) + ver(img)} target="_blank" rel="noreferrer">
                      <img src={fileUrl(img.thumbPath ?? img.path) + ver(img)} alt={`${s.label} ${img.seq}`} className="size-24 rounded border object-cover" loading="lazy" />
                    </a>
                    {img.watermarkTemplate && (
                      <span className="absolute top-1 left-1 rounded bg-emerald-600/90 px-1 text-[9px] text-white" title={`${img.watermarkTemplate} 로 워터마크 제거됨`}>
                        WM 제거
                      </span>
                    )}
                    {editable && img.originalPath && (
                      <button
                        type="button"
                        title="원본으로 되돌리기"
                        className="absolute right-1 bottom-5 hidden rounded bg-background/90 p-0.5 group-hover:block"
                        onClick={() => restore(img.id)}
                      >
                        <RotateCcw className="size-3.5" />
                      </button>
                    )}
                    <span className="absolute bottom-1 left-1 rounded bg-background/80 px-1 text-[10px]">
                      {img.seq} · {img.width}×{img.height}
                    </span>
                    {editable && (
                      <button
                        type="button"
                        className="absolute top-1 right-1 hidden rounded bg-background/90 p-0.5 text-destructive group-hover:block"
                        onClick={() => confirm('이 이미지를 지울까요?') && remove(img.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {imgs.length === 0 && <div className="flex size-24 items-center justify-center rounded border border-dashed text-[11px] text-muted-foreground">없음</div>}
              </div>
            </div>
          )
        })}
      </div>
      {editable && <WebImageFinder tenantId={tenantId} productId={product.id} onImported={onChange} />}
    </Section>
  )
}
