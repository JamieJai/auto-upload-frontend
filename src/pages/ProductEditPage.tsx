import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { NeedTenant, PageTitle } from '@/components/app/Layout'
import { ProductStatusBadge } from '@/components/app/StatusBadge'
import { emptyForm, sameForm, toForm, toRequest, type ProductForm } from '@/components/product/form'
import { ImagesCard } from '@/components/product/ImagesCard'
import { MeasurementsCard } from '@/components/product/MeasurementsCard'
import { OptionsCard } from '@/components/product/OptionsCard'
import { Section } from '@/components/product/Section'
import { SourcePanel } from '@/components/product/SourcePanel'
import { ValidationCard } from '@/components/product/ValidationCard'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { api, ApiError, errorMessage } from '@/lib/api'
import { noticeFields, textFieldLabel } from '@/lib/labels'
import { useTenant } from '@/lib/tenant'
import type { CategoryMapping, Product, TextField } from '@/lib/types'

const EDITABLE = new Set(['DRAFT', 'NEEDS_INPUT', 'PENDING_APPROVAL'])

export function ProductEditPage() {
  const { id } = useParams()
  const isNew = !id
  const { current } = useTenant()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const tenantId = current?.id

  const productQ = useQuery({
    queryKey: ['product', tenantId, id],
    queryFn: () => api<Product>(`/api/tenants/${tenantId}/products/${id}`),
    enabled: !!tenantId && !isNew,
    refetchInterval: (q) => (q.state.data?.status === 'GENERATING' ? 3_000 : false),
  })
  const mappingsQ = useQuery({
    queryKey: ['mappings', tenantId],
    queryFn: () => api<CategoryMapping[]>(`/api/tenants/${tenantId}/category-mappings`),
    enabled: !!tenantId,
  })
  const categories = useMemo(() => [...new Set((mappingsQ.data ?? []).map((m) => m.category))], [mappingsQ.data])

  const product = productQ.data
  const [form, setForm] = useState<ProductForm>(() => emptyForm(current?.productCodePrefix ?? ''))
  const [base, setBase] = useState<ProductForm | null>(null)
  const [generating, setGenerating] = useState<TextField | null>(null)

  // 서버 값이 바뀌면 (처음 로드·저장·생성) 폼을 다시 맞춘다
  useEffect(() => {
    if (product) {
      const f = toForm(product)
      setForm(f)
      setBase(f)
    }
  }, [product])

  const dirty = base ? !sameForm(form, base) : true
  const editable = isNew || (product ? EDITABLE.has(product.status) : false)

  function refresh(p: Product) {
    qc.setQueryData(['product', tenantId, id], p)
    qc.invalidateQueries({ queryKey: ['validation', tenantId, String(p.id)] })
    qc.invalidateQueries({ queryKey: ['products'] })
  }

  const save = useMutation({
    mutationFn: async () => {
      if (isNew) return api<Product>(`/api/tenants/${tenantId}/products`, { json: toRequest(form) })
      return api<Product>(`/api/tenants/${tenantId}/products/${id}`, { method: 'PUT', json: toRequest(form) })
    },
    onSuccess: (p) => {
      toast.success('저장했습니다')
      if (isNew) navigate(`/products/${p.id}`, { replace: true })
      else refresh(p)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  async function generate(field: TextField) {
    setGenerating(field)
    try {
      // 고친 내용이 있으면 먼저 저장해야 생성 결과와 섞이지 않는다
      if (dirty) refresh(await api<Product>(`/api/tenants/${tenantId}/products/${id}`, { method: 'PUT', json: toRequest(form) }))
      const p = await api<Product>(`/api/tenants/${tenantId}/products/${id}/generate`, { json: { field } })
      refresh(p)
      toast.success(`${textFieldLabel[field]}을(를) 생성했습니다. 확인하고 고쳐 쓰세요`)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setGenerating(null)
    }
  }

  const action = useMutation({
    mutationFn: async (kind: 'submit' | 'cancel' | 'reopen') => {
      if (kind === 'submit' && dirty) {
        refresh(await api<Product>(`/api/tenants/${tenantId}/products/${id}`, { method: 'PUT', json: toRequest(form) }))
      }
      return api<Product>(`/api/tenants/${tenantId}/products/${id}/${kind}`, { method: 'POST' })
    },
    onSuccess: (p, kind) => {
      refresh(p)
      const msg = { submit: p.status === 'GENERATING' ? '제출했습니다. 빈 문구를 생성하는 중입니다' : '제출했습니다. 승인 대기로 넘어갔습니다', cancel: '취소했습니다', reopen: '다시 열었습니다' }
      toast.success(msg[kind])
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 422) {
        toast.error('보완이 필요한 항목이 있습니다. 아래 검증 결과를 확인하세요')
        productQ.refetch()
        qc.invalidateQueries({ queryKey: ['validation'] })
      } else toast.error(errorMessage(e))
    },
  })

  const remove = useMutation({
    mutationFn: () => api(`/api/tenants/${tenantId}/products/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('삭제했습니다')
      qc.invalidateQueries({ queryKey: ['products'] })
      navigate('/products')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (!current) return <NeedTenant />
  if (!isNew && !product) return null

  const set = (patch: Partial<ProductForm>) => setForm((f) => ({ ...f, ...patch }))
  const setNotice = (key: string, value: string) => setForm((f) => ({ ...f, notice: { ...f.notice, [key]: value } }))
  const source = (f: TextField) => product?.fieldSources[f]

  return (
    <>
      <PageTitle title={isNew ? '새 상품' : `${product!.code}`}>
        {product && <ProductStatusBadge status={product.status} />}
        {!isNew && product && (product.status === 'DRAFT' || product.status === 'NEEDS_INPUT' || product.status === 'CANCELLED') && (
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => confirm('이 상품을 삭제할까요?') && remove.mutate()}>
            삭제
          </Button>
        )}
        {product && product.status !== 'CANCELLED' && product.status !== 'APPROVED' && product.status !== 'GENERATING' && (
          <Button variant="ghost" size="sm" onClick={() => action.mutate('cancel')}>
            취소
          </Button>
        )}
        {product && (product.status === 'APPROVED' || product.status === 'CANCELLED') && (
          <Button variant="outline" size="sm" onClick={() => action.mutate('reopen')}>
            다시 열기
          </Button>
        )}
        {editable && (
          <Button variant="outline" size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
            {isNew ? '만들기' : '저장'}
          </Button>
        )}
        {product && (product.status === 'DRAFT' || product.status === 'NEEDS_INPUT') && (
          <Button size="sm" disabled={action.isPending} onClick={() => action.mutate('submit')}>
            제출
          </Button>
        )}
      </PageTitle>

      {product?.reviewNote && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{product.reviewNote}</AlertDescription>
        </Alert>
      )}
      {product?.status === 'GENERATING' && (
        <Alert className="mb-4">
          <AlertDescription>비어 있는 문구를 생성하고 있습니다. 끝나면 승인 대기로 넘어갑니다.</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Section title="기본 정보">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="상품코드" required>
                <Input value={form.code} disabled={!isNew} onChange={(e) => set({ code: e.target.value })} placeholder="SS2609001" />
              </Field>
              <Field label="카테고리" required>
                <Input list="categories" value={form.category} disabled={!editable} onChange={(e) => set({ category: e.target.value })} placeholder="원피스" />
                <datalist id="categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <Field label="판매가 (원)" required locked>
                <Input inputMode="numeric" value={form.salePrice} disabled={!editable} onChange={(e) => set({ salePrice: e.target.value })} />
              </Field>
            </div>
          </Section>

          {!isNew && (
            <Section title="문구" description="비워 두고 제출하면 큐에서 한꺼번에 생성합니다. 버튼을 누르면 그 필드만 바로 생성합니다.">
              <TextRow label="상품명" source={source('NAME')} onGenerate={editable ? () => generate('NAME') : undefined} busy={generating === 'NAME'}>
                <Input value={form.name} disabled={!editable} onChange={(e) => set({ name: e.target.value })} maxLength={100} />
                <div className="text-right text-[11px] text-muted-foreground">{form.name.length}/100</div>
              </TextRow>
              <TextRow label="상세설명" source={source('DESCRIPTION')} onGenerate={editable ? () => generate('DESCRIPTION') : undefined} busy={generating === 'DESCRIPTION'}>
                <Textarea rows={8} value={form.description} disabled={!editable} onChange={(e) => set({ description: e.target.value })} />
              </TextRow>
              <TextRow label="검색키워드" source={source('SEARCH_KEYWORDS')} onGenerate={editable ? () => generate('SEARCH_KEYWORDS') : undefined} busy={generating === 'SEARCH_KEYWORDS'}>
                <Input value={form.keywords} disabled={!editable} onChange={(e) => set({ keywords: e.target.value })} placeholder="쉼표로 구분, 최대 10개, 각 한글 9자(29바이트) 이하" />
              </TextRow>
            </Section>
          )}

          <Section title="상품정보제공고시" description="잠금 표시는 AI 가 만들지 않는 항목입니다. 비워 두면 판매자 기본값이 생성 시 채워집니다.">
            <div className="grid gap-3 sm:grid-cols-2">
              {noticeFields.map((f) => (
                <Field key={f.key} label={f.label} required={f.required} locked={f.aiForbidden} wide={f.multiline}>
                  {f.multiline ? (
                    <Textarea rows={2} value={form.notice[f.key] ?? ''} disabled={!editable} onChange={(e) => setNotice(f.key, e.target.value)} />
                  ) : (
                    <Input value={form.notice[f.key] ?? ''} disabled={!editable} onChange={(e) => setNotice(f.key, e.target.value)} />
                  )}
                </Field>
              ))}
            </div>
          </Section>

          {product && (
            <>
              <OptionsCard product={product} tenantId={current.id} editable={editable} onChange={refresh} />
              <MeasurementsCard product={product} tenantId={current.id} editable={editable} onChange={refresh} />
              <ImagesCard product={product} tenantId={current.id} editable={editable} onChange={() => productQ.refetch()} />
            </>
          )}
          {isNew && <p className="text-sm text-muted-foreground">만들기를 누르면 문구·옵션·실측·이미지를 입력할 수 있습니다.</p>}
        </div>
        {product && (
          <div className="flex flex-col gap-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto">
            <ValidationCard tenantId={current.id} productId={product.id} dirty={dirty} />
            <SourcePanel tenantId={current.id} productId={product.id} />
          </div>
        )}
      </div>
    </>
  )
}

function Field({ label, required, locked, wide, children }: { label: string; required?: boolean; locked?: boolean; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={`grid gap-1.5 ${wide ? 'sm:col-span-2' : ''}`}>
      <Label className="text-xs">
        {label}
        {required && <span className="text-destructive">*</span>}
        {locked && (
          <span className="text-muted-foreground" title="AI 생성 금지 항목">
            🔒
          </span>
        )}
      </Label>
      {children}
    </div>
  )
}

function TextRow({ label, source, onGenerate, busy, children }: { label: string; source?: 'MANUAL' | 'AI' | 'SOURCE'; onGenerate?: () => void; busy: boolean; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5 py-1.5">
      <div className="flex items-center gap-2">
        <Label className="text-xs">{label}</Label>
        {source && <Badge variant={source === 'MANUAL' ? 'outline' : 'secondary'}>{{ AI: 'AI 생성', SOURCE: '도매처 원문', MANUAL: '직접 입력' }[source]}</Badge>}
        {onGenerate && (
          <Button variant="ghost" size="xs" className="ml-auto" onClick={onGenerate} disabled={busy}>
            <Sparkles /> {busy ? '생성 중…' : 'AI로 생성'}
          </Button>
        )}
      </div>
      {children}
    </div>
  )
}
