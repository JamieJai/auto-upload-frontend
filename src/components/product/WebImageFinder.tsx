import { useState } from 'react'
import { Globe } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, errorMessage } from '@/lib/api'
import { slots } from '@/lib/labels'
import type { Slot } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Candidate {
  url: string
  width: number
  height: number
}

/** 도매처 상품 페이지에서 후보를 뽑아 보여 주고, 사람이 고른 것만 가져온다 */
export function WebImageFinder({ tenantId, productId, onImported }: { tenantId: number; productId: number; onImported: () => void }) {
  const [url, setUrl] = useState('')
  const [pageUrl, setPageUrl] = useState('')
  const [candidates, setCandidates] = useState<Candidate[] | null>(null)
  const [picked, setPicked] = useState<Record<string, Slot>>({})
  const [busy, setBusy] = useState(false)

  async function find() {
    setBusy(true)
    setCandidates(null)
    setPicked({})
    try {
      const c = await api<Candidate[]>(`/api/tenants/${tenantId}/web-images/candidates`, { json: { url } })
      setCandidates(c)
      setPageUrl(url)
      if (!c.length) toast.info('긴 변 500px 이상인 이미지를 찾지 못했습니다')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function importPicked() {
    setBusy(true)
    try {
      const picks = Object.entries(picked).map(([u, slot]) => ({ url: u, slot }))
      await api(`/api/tenants/${tenantId}/products/${productId}/web-images`, { json: { pageUrl, picks } })
      toast.success(`${picks.length}장 가져왔습니다`)
      setPicked({})
      onImported()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const toggle = (u: string) =>
    setPicked((p) => {
      const n = { ...p }
      if (n[u]) delete n[u]
      else n[u] = 'detail'
      return n
    })

  return (
    <div className="mt-4 rounded-md bg-muted/50 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium">
        <Globe className="size-3.5" /> 웹에서 찾기
        <span className="font-normal text-muted-foreground">판매자 관리의 허용 도메인(사용권 확인된 도매처)만 가능</span>
      </div>
      <div className="flex gap-2">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="도매처 상품 페이지 주소" />
        <Button size="sm" variant="secondary" disabled={busy || !url.trim()} onClick={find}>
          {busy && !candidates ? '찾는 중…' : '후보 찾기'}
        </Button>
      </div>
      {candidates && candidates.length > 0 && (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {candidates.map((c) => {
              const slot = picked[c.url]
              return (
                <div key={c.url} className={cn('overflow-hidden rounded border bg-background', slot && 'ring-2 ring-primary')}>
                  <button type="button" className="block w-full" onClick={() => toggle(c.url)}>
                    <img src={c.url} alt="" referrerPolicy="no-referrer" className="aspect-square w-full object-cover" loading="lazy" />
                  </button>
                  <div className="flex items-center justify-between px-1.5 py-1 text-[10px] text-muted-foreground">
                    {c.width}×{c.height}
                    {slot && (
                      <select className="rounded border bg-background text-[11px]" value={slot} onChange={(e) => setPicked({ ...picked, [c.url]: e.target.value as Slot })}>
                        {slots.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-2 flex items-center justify-end gap-2 text-xs">
            {Object.keys(picked).length}장 선택
            <Button size="sm" disabled={busy || !Object.keys(picked).length} onClick={importPicked}>
              선택한 이미지 가져오기
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
