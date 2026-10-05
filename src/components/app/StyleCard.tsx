import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Copy } from 'lucide-react'
import { toast } from 'sonner'

import { Section } from '@/components/product/Section'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { api, errorMessage } from '@/lib/api'
import { when } from '@/lib/labels'
import { useTenant } from '@/lib/tenant'

type Case = 'AS_IS' | 'LOWER' | 'UPPER'
type ImageGroup = 'MAIN_REST' | 'SUB' | 'DETAIL' | 'SIZE'
type DetailBlock = 'TEXT' | 'MAIN_IMAGES' | 'SUB_IMAGES' | 'DETAIL_IMAGES' | 'SIZE_TABLE' | 'SIZE_IMAGES'

export interface Style {
  copy: { namePrefix: string; nameSuffix: string; nameMaxLength: number; descriptionMinLength: number; descriptionMaxLength: number; bannedWords: string[]; instructions: string }
  tags: { min: number; max: number; textCase: Case; leadingRule: string }
  options: { groupName1: string; groupName2: string; colorCase: Case; sizeCase: Case; sizeAliases: Record<string, string> }
  images: { optionalOrder: ImageGroup[]; maxOptional: number }
  detail: { blocks: DetailBlock[] }
  registration: { displayStatus: 'SUSPENSION' | 'ON'; discountValue: number; discountUnit: 'PERCENT' | 'WON' }
}

interface StyleView {
  style: Style
  sourceTenantId: number | null
  sourceTenantName: string | null
  copiedAt: string | null
}

const caseLabel: Record<Case, string> = { AS_IS: '그대로', LOWER: '소문자', UPPER: '대문자' }
const imageGroups: Record<ImageGroup, string> = { MAIN_REST: '대표 슬롯의 나머지', SUB: '연출컷', DETAIL: '디테일컷', SIZE: '사이즈표' }
const detailBlocks: Record<DetailBlock, string> = {
  TEXT: '상세설명 문구',
  MAIN_IMAGES: '대표 이미지',
  SUB_IMAGES: '연출컷',
  DETAIL_IMAGES: '디테일컷',
  SIZE_TABLE: '실측표',
  SIZE_IMAGES: '사이즈표 이미지',
}

/** 쇼핑몰마다 다른 등록 규칙. 다른 판매자에서 복사해 와서 고친다 */
export function StyleCard({ tenantId }: { tenantId: number }) {
  const qc = useQueryClient()
  const { tenants } = useTenant()
  const q = useQuery({ queryKey: ['style', tenantId], queryFn: () => api<StyleView>(`/api/tenants/${tenantId}/style`) })
  const [s, setS] = useState<Style | null>(null)
  const [source, setSource] = useState<string>('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (q.data) setS(structuredClone(q.data.style))
  }, [q.data])

  if (!s || !q.data) return null
  const dirty = JSON.stringify(s) !== JSON.stringify(q.data.style)
  const set = <K extends keyof Style>(k: K, patch: Partial<Style[K]>) => setS({ ...s, [k]: { ...s[k], ...patch } })

  async function save() {
    setBusy(true)
    try {
      const v = await api<StyleView>(`/api/tenants/${tenantId}/style`, { method: 'PUT', json: s })
      qc.setQueryData(['style', tenantId], v)
      toast.success('특성을 저장했습니다')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function copyFrom(id: number) {
    const name = tenants.find((t) => t.id === id)?.name
    if (!confirm(`${name} 의 특성(문체·가격 규칙·고시 기본값 포함)으로 덮어쓸까요? A/S 담당·전화, 제조사는 그대로 둡니다.`)) return
    setBusy(true)
    try {
      const v = await api<StyleView>(`/api/tenants/${tenantId}/style/copy`, { json: { sourceTenantId: id } })
      qc.setQueryData(['style', tenantId], v)
      qc.invalidateQueries({ queryKey: ['tenants'] })
      toast.success(`${name} 의 특성을 가져왔습니다`)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const others = tenants.filter((t) => t.id !== tenantId)

  return (
    <Section
      title="특성 (이 쇼핑몰의 등록 규칙)"
      description="문구·태그·옵션 표기·이미지 순서·상세 구성·등록 기본값. AI 생성, 제출 전 검증, 네이버 등록 본문에 모두 적용됩니다."
      actions={
        <Button size="sm" disabled={!dirty || busy} onClick={save}>
          특성 저장
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md bg-muted/50 p-3 text-sm">
        <Copy className="size-4 text-muted-foreground" />
        {q.data.sourceTenantName ? (
          <span>
            원본: <b>{q.data.sourceTenantName}</b> ({when(q.data.copiedAt)} 복사)
          </span>
        ) : (
          <span className="text-muted-foreground">직접 만든 특성</span>
        )}
        {q.data.sourceTenantId && (
          <Button size="xs" variant="outline" disabled={busy} onClick={() => copyFrom(q.data.sourceTenantId!)}>
            원본에서 다시 덮어쓰기
          </Button>
        )}
        <span className="ml-auto flex items-center gap-1.5">
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger size="sm" className="w-56">
              <SelectValue placeholder="다른 판매자 특성 가져오기" />
            </SelectTrigger>
            <SelectContent>
              {others.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="xs" variant="secondary" disabled={!source || busy} onClick={() => copyFrom(Number(source))}>
            가져오기
          </Button>
        </span>
      </div>

      <Group title="문구">
        <Field label="상품명 앞에 붙일 말">
          <Input value={s.copy.namePrefix} onChange={(e) => set('copy', { namePrefix: e.target.value })} placeholder="[브랜드] " />
        </Field>
        <Field label="상품명 뒤에 붙일 말">
          <Input value={s.copy.nameSuffix} onChange={(e) => set('copy', { nameSuffix: e.target.value })} placeholder=" (2 color)" />
        </Field>
        <Field label="상품명 최대 글자 (앞뒤 포함)">
          <Num value={s.copy.nameMaxLength} onChange={(v) => set('copy', { nameMaxLength: v })} />
        </Field>
        <Field label="상세설명 글자 수 (최소~최대)">
          <div className="flex gap-1.5">
            <Num value={s.copy.descriptionMinLength} onChange={(v) => set('copy', { descriptionMinLength: v })} />
            <Num value={s.copy.descriptionMaxLength} onChange={(v) => set('copy', { descriptionMaxLength: v })} />
          </div>
        </Field>
        <Field label="금지 표현 (쉼표로 구분, 들어가면 제출이 막힘)" wide>
          <Input
            value={s.copy.bannedWords.join(', ')}
            onChange={(e) => set('copy', { bannedWords: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })}
            placeholder="최저가, 1위, 여리여리"
          />
        </Field>
        <Field label="AI 추가 지시 (상품명 스타일, 상세설명 구성 등)" wide>
          <Textarea rows={3} value={s.copy.instructions} onChange={(e) => set('copy', { instructions: e.target.value })} placeholder="상품명은 '아이템명 + 핏 + 소재' 순서. 상세설명 첫 문단은 착용 상황으로 시작." />
        </Field>
      </Group>

      <Group title="검색 태그">
        <Field label="개수 (최소~최대, 같으면 정확히)">
          <div className="flex gap-1.5">
            <Num value={s.tags.min} onChange={(v) => set('tags', { min: v })} />
            <Num value={s.tags.max} onChange={(v) => set('tags', { max: v })} />
          </div>
        </Field>
        <Field label="영문 표기">
          <CaseSelect value={s.tags.textCase} onChange={(v) => set('tags', { textCase: v })} />
        </Field>
        <Field label="앞쪽 태그 규칙" wide>
          <Input value={s.tags.leadingRule} onChange={(e) => set('tags', { leadingRule: e.target.value })} placeholder="앞 3개는 거래처명 + 핵심 특징" />
        </Field>
      </Group>

      <Group title="옵션 표기">
        <Field label="그룹명 1 (색상 자리)">
          <Input value={s.options.groupName1} onChange={(e) => set('options', { groupName1: e.target.value })} />
        </Field>
        <Field label="그룹명 2 (사이즈 자리)">
          <Input value={s.options.groupName2} onChange={(e) => set('options', { groupName2: e.target.value })} />
        </Field>
        <Field label="색상 영문 표기">
          <CaseSelect value={s.options.colorCase} onChange={(v) => set('options', { colorCase: v })} />
        </Field>
        <Field label="사이즈 영문 표기">
          <CaseSelect value={s.options.sizeCase} onChange={(v) => set('options', { sizeCase: v })} />
        </Field>
        <Field label="사이즈 바꿔 쓰기 (예: FREE=F, 프리=FREE)" wide>
          <Input
            defaultValue={Object.entries(s.options.sizeAliases).map(([k, v]) => `${k}=${v}`).join(', ')}
            onBlur={(e) =>
              set('options', {
                sizeAliases: Object.fromEntries(
                  e.target.value
                    .split(',')
                    .map((x) => x.split('=').map((y) => y.trim()))
                    .filter((x) => x.length === 2 && x[0] && x[1]),
                ),
              })
            }
          />
        </Field>
      </Group>

      <Group title="추가 이미지 (대표 옆 갤러리)">
        <Field label="채우는 순서 (체크한 것만, 위에서부터)" wide>
          <Ordered all={imageGroups} value={s.images.optionalOrder} onChange={(v) => set('images', { optionalOrder: v })} />
        </Field>
        <Field label="최대 장수 (0~9)">
          <Num value={s.images.maxOptional} onChange={(v) => set('images', { maxOptional: v })} />
        </Field>
      </Group>

      <Group title="상세페이지 구성">
        <Field label="블록 순서 (체크한 것만, 위에서부터)" wide>
          <Ordered all={detailBlocks} value={s.detail.blocks} onChange={(v) => set('detail', { blocks: v })} />
        </Field>
      </Group>

      <Group title="등록">
        <Field label="등록 후 전시 상태">
          <Select value={s.registration.displayStatus} onValueChange={(v) => set('registration', { displayStatus: v as 'SUSPENSION' | 'ON' })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SUSPENSION">전시 중지 (확인 후 직접 켜기)</SelectItem>
              <SelectItem value="ON">바로 전시</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="즉시할인 (0이면 없음)">
          <div className="flex gap-1.5">
            <Num value={s.registration.discountValue} onChange={(v) => set('registration', { discountValue: v })} />
            <Select value={s.registration.discountUnit} onValueChange={(v) => set('registration', { discountUnit: v as 'PERCENT' | 'WON' })}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PERCENT">%</SelectItem>
                <SelectItem value="WON">원</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Field>
      </Group>
    </Section>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="mb-2 text-xs font-semibold text-muted-foreground">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  )
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={`grid gap-1.5 ${wide ? 'sm:col-span-2' : ''}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  )
}

function Num({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return <Input inputMode="numeric" value={String(value)} onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, '')) || 0)} />
}

function CaseSelect({ value, onChange }: { value: Case; onChange: (v: Case) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Case)}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(caseLabel) as Case[]).map((c) => (
          <SelectItem key={c} value={c}>
            {caseLabel[c]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** 순서 있는 다중 선택: 체크한 항목이 위에서부터 순서대로 */
function Ordered<T extends string>({ all, value, onChange }: { all: Record<T, string>; value: T[]; onChange: (v: T[]) => void }) {
  const rest = (Object.keys(all) as T[]).filter((k) => !value.includes(k))
  const move = (i: number, d: number) => {
    const next = [...value]
    const j = i + d
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  return (
    <div className="flex flex-col gap-1 rounded-md border p-2">
      {value.map((k, i) => (
        <div key={k} className="flex items-center gap-2 text-sm">
          <Checkbox checked onCheckedChange={() => onChange(value.filter((x) => x !== k))} />
          <span className="w-5 text-xs text-muted-foreground">{i + 1}</span>
          <span className="flex-1">{all[k]}</span>
          <Button size="icon-xs" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)}>
            <ArrowUp />
          </Button>
          <Button size="icon-xs" variant="ghost" disabled={i === value.length - 1} onClick={() => move(i, 1)}>
            <ArrowDown />
          </Button>
        </div>
      ))}
      {rest.map((k) => (
        <div key={k} className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={false} onCheckedChange={() => onChange([...value, k])} />
          <span className="w-5" />
          <span className="flex-1">{all[k]}</span>
        </div>
      ))}
    </div>
  )
}
