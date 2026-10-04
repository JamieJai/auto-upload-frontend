import { useRef, useState } from 'react'
import { Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { api, errorMessage, fileUrl } from '@/lib/api'
import { slots } from '@/lib/labels'
import type { Product, Slot } from '@/lib/types'
import { Section } from './Section'

export function ImagesCard({ product, tenantId, editable, onChange }: { product: Product; tenantId: number; editable: boolean; onChange: () => void }) {
  const [busy, setBusy] = useState<Slot | null>(null)
  const inputs = useRef<Partial<Record<Slot, HTMLInputElement | null>>>({})

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
    <Section title="이미지" description={`여러 상품을 한꺼번에 올릴 때는 이미지 화면에서 파일명 규칙(${product.code}_detail_01.jpg)으로 올리세요.`}>
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
                    <a href={fileUrl(img.path)} target="_blank" rel="noreferrer">
                      <img src={fileUrl(img.thumbPath ?? img.path)} alt={`${s.label} ${img.seq}`} className="size-24 rounded border object-cover" loading="lazy" />
                    </a>
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
    </Section>
  )
}
