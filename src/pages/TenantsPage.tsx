import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { PageTitle } from '@/components/app/Layout'
import { StyleCard } from '@/components/app/StyleCard'
import { Section } from '@/components/product/Section'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { api, errorMessage } from '@/lib/api'
import { channelCredentialKeys, channelLabel, noticeFields, when } from '@/lib/labels'
import { useTenant } from '@/lib/tenant'
import type { CategoryMapping, Channel, ChannelAccount, Tenant } from '@/lib/types'
import { cn } from '@/lib/utils'

export function TenantsPage() {
  const { tenants, current, select, loading } = useTenant()
  const [wantNew, setWantNew] = useState(false)
  // 판매자가 하나도 없으면 바로 추가 폼을 보여 준다 (목록이 늦게 와도 맞게 계산)
  const creating = wantNew || (!loading && tenants.length === 0)
  const editing = creating ? null : current
  const setCreating = setWantNew

  return (
    <>
      <PageTitle title="판매자 관리">
        <Button size="sm" variant={creating ? 'secondary' : 'default'} onClick={() => setCreating(!creating)}>
          <Plus /> 판매자 추가
        </Button>
      </PageTitle>
      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        <ul className="flex flex-col gap-1">
          {tenants.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => {
                  setCreating(false)
                  select(t.id)
                }}
                className={cn('w-full rounded-md border bg-background px-3 py-2 text-left text-sm hover:bg-muted', !creating && current?.id === t.id && 'border-primary')}
              >
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-muted-foreground">
                  {t.code}
                  {!t.active && ' · 비활성'}
                </div>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex min-w-0 flex-col gap-4">
          <TenantForm key={editing?.id ?? 'new'} tenant={editing} onSaved={(t) => {
            setCreating(false)
            select(t.id)
          }} />
          {editing && (
            <>
              <StyleCard key={editing.id} tenantId={editing.id} />
              <AccountsCard tenantId={editing.id} />
              <MappingsCard tenantId={editing.id} />
            </>
          )}
        </div>
      </div>
    </>
  )
}

function TenantForm({ tenant, onSaved }: { tenant: Tenant | null; onSaved: (t: Tenant) => void }) {
  const qc = useQueryClient()
  const { tenants } = useTenant()
  const [styleFrom, setStyleFrom] = useState('')
  const [code, setCode] = useState(tenant?.code ?? '')
  const [name, setName] = useState(tenant?.name ?? '')
  const [prefix, setPrefix] = useState(tenant?.productCodePrefix ?? '')
  const [tone, setTone] = useState(tenant?.brandTone ?? '')
  const [domains, setDomains] = useState((tenant?.allowedImageDomains ?? []).join('\n'))
  const [notice, setNotice] = useState<Record<string, string>>(tenant?.noticeDefaults ?? {})
  const [active, setActive] = useState(tenant?.active ?? true)
  const [busy, setBusy] = useState(false)
  const pr = tenant?.priceRule ?? {}
  const [rule, setRule] = useState({
    multiplier: pr.multiplier != null ? String(pr.multiplier) : '',
    roundUnit: pr.roundUnit != null ? String(pr.roundUnit) : '',
    subtract: pr.subtract != null ? String(pr.subtract) : '',
    defaultStock: pr.defaultStock != null ? String(pr.defaultStock) : '',
  })
  const sample = 18000
  const preview = (() => {
    const m = Number(rule.multiplier)
    if (!m) return null
    let v = sample * m
    const u = Number(rule.roundUnit)
    if (u > 0) v = Math.ceil(v / u) * u
    return v - (Number(rule.subtract) || 0)
  })()

  async function save() {
    setBusy(true)
    try {
      const body = {
        code: code.trim(),
        name: name.trim(),
        productCodePrefix: prefix.trim() || null,
        brandTone: tone.trim() || null,
        noticeDefaults: Object.fromEntries(Object.entries(notice).filter(([, v]) => v.trim())),
        allowedImageDomains: domains.split(/\s+/).filter(Boolean),
        priceRule: rule.multiplier ? Object.fromEntries(Object.entries(rule).filter(([, v]) => v.trim() !== '').map(([k, v]) => [k, Number(v)])) : null,
        active,
      }
      const t = tenant ? await api<Tenant>(`/api/tenants/${tenant.id}`, { method: 'PUT', json: body }) : await api<Tenant>('/api/tenants', { json: body })
      if (!tenant && styleFrom) {
        // 새 판매자: 고른 판매자의 특성(문체·가격 규칙·고시 기본값 포함)을 바로 복사
        await api(`/api/tenants/${t.id}/style/copy`, { json: { sourceTenantId: Number(styleFrom) } })
      }
      await qc.invalidateQueries({ queryKey: ['tenants'] })
      toast.success('저장했습니다')
      onSaved(t)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section
      title={tenant ? `${tenant.name} 설정` : '새 판매자'}
      actions={
        <>
          {tenant && (
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={active} onCheckedChange={setActive} /> 사용
            </label>
          )}
          <Button size="sm" disabled={busy || !code || !name} onClick={save}>
            저장
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label className="text-xs">판매자 코드 (폴더명, 변경 불가)</Label>
          <Input value={code} disabled={!!tenant} onChange={(e) => setCode(e.target.value.toLowerCase())} placeholder="shop-a" />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">이름</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        {!tenant && tenants.length > 0 && (
          <div className="grid gap-1.5 sm:col-span-3">
            <Label className="text-xs">특성 복제 (다듬어 둔 판매자의 규칙을 그대로 가져오기)</Label>
            <Select value={styleFrom} onValueChange={setStyleFrom}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="복제하지 않음" />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((x) => (
                  <SelectItem key={x.id} value={String(x.id)}>
                    {x.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="grid gap-1.5">
          <Label className="text-xs">상품코드 접두어</Label>
          <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="SS26" />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label className="text-xs">브랜드 문체 기준 (AI 문구 생성에 쓰임)</Label>
          <Textarea rows={3} value={tone} onChange={(e) => setTone(e.target.value)} placeholder="존댓말, 이모지 금지, '여리여리' 같은 표현 금지…" />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">이미지 가져오기 허용 도메인 (줄마다 하나)</Label>
          <Textarea rows={3} value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="wholesale.example.com" />
        </div>
      </div>
      <h3 className="mt-4 mb-2 text-xs font-medium">가격 규칙 (확장으로 받은 상품의 판매가 = 도매가 × 배수 → 단위 올림 → 차감)</h3>
      <div className="grid gap-3 sm:grid-cols-5">
        {(
          [
            ['multiplier', '배수', '2'],
            ['roundUnit', '올림 단위(원)', '1000'],
            ['subtract', '차감(원)', '100'],
            ['defaultStock', '옵션당 기본 재고', '10'],
          ] as const
        ).map(([k, label, ph]) => (
          <div key={k} className="grid gap-1.5">
            <Label className="text-xs">{label}</Label>
            <Input inputMode="decimal" value={rule[k]} placeholder={ph} onChange={(e) => setRule({ ...rule, [k]: e.target.value.replace(/[^\d.]/g, '') })} />
          </div>
        ))}
        <div className="flex items-end pb-2 text-xs text-muted-foreground">
          {preview != null ? `예: 도매가 18,000원 → ${preview.toLocaleString('ko-KR')}원` : '배수를 비우면 판매가는 직접 입력'}
        </div>
      </div>
      <h3 className="mt-4 mb-2 text-xs font-medium">고시정보 기본값 (새 상품의 빈 칸에 채워짐)</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        {noticeFields
          .filter((f) => f.key !== 'material')
          .map((f) => (
            <div key={f.key} className="grid gap-1.5">
              <Label className="text-xs">{f.label}</Label>
              <Input value={notice[f.key] ?? ''} onChange={(e) => setNotice({ ...notice, [f.key]: e.target.value })} />
            </div>
          ))}
      </div>
    </Section>
  )
}

function AccountsCard({ tenantId }: { tenantId: number }) {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['accounts', tenantId], queryFn: () => api<ChannelAccount[]>(`/api/tenants/${tenantId}/channel-accounts`) })
  const [editing, setEditing] = useState<ChannelAccount | 'new' | null>(null)
  const [channel, setChannel] = useState<Channel>('SMARTSTORE')
  const [displayName, setDisplayName] = useState('')
  const [creds, setCreds] = useState<Record<string, string>>({})
  const [active, setActive] = useState(true)
  const [dryRun, setDryRun] = useState(true)
  const [templateNo, setTemplateNo] = useState('')

  useEffect(() => {
    if (editing && editing !== 'new') {
      setChannel(editing.channel)
      setDisplayName(editing.displayName)
      setActive(editing.active)
      setDryRun(editing.settings.dryRun !== false)
    } else if (editing === 'new') {
      setDisplayName('')
      setActive(true)
    }
    setCreds({})
  }, [editing])

  async function save() {
    try {
      const filled = Object.fromEntries(Object.entries(creds).filter(([, v]) => v.trim()))
      // 수정 때 인증정보를 비워 두면 기존 값을 유지한다
      const base = editing && editing !== 'new' ? editing.settings : {}
      const settings =
        channel === 'SMARTSTORE'
          ? { ...base, dryRun }
          : base
      if (channel === 'SMARTSTORE' && !dryRun && !confirm('DRY RUN 을 끄면 승인한 상품이 실제 스마트스토어에 등록됩니다. 계속할까요?')) return
      const body = { channel, displayName, active, settings, credentials: Object.keys(filled).length ? filled : editing === 'new' ? {} : null }
      if (editing === 'new') await api(`/api/tenants/${tenantId}/channel-accounts`, { json: body })
      else if (editing) await api(`/api/tenants/${tenantId}/channel-accounts/${editing.id}`, { method: 'PUT', json: body })
      toast.success('저장했습니다')
      setEditing(null)
      qc.invalidateQueries({ queryKey: ['accounts', tenantId] })
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <Section
      title="채널 계정"
      description="인증정보는 암호화해 저장하고 다시 보여 주지 않습니다. 승인하면 활성 계정마다 등록 작업이 생깁니다."
      actions={
        <Button size="xs" variant="outline" onClick={() => setEditing('new')}>
          <Plus /> 계정 추가
        </Button>
      }
    >
      <Table>
        <TableBody>
          {q.data?.map((a) => (
            <TableRow key={a.id}>
              <TableCell>{channelLabel[a.channel]}</TableCell>
              <TableCell>{a.displayName}</TableCell>
              <TableCell>
                <Badge variant={a.hasCredentials ? 'outline' : 'destructive'}>{a.hasCredentials ? '인증정보 있음' : '인증정보 없음'}</Badge>
                {!a.active && <Badge variant="secondary" className="ml-1">비활성</Badge>}
              </TableCell>
              <TableCell className="text-xs">
                {a.channel === 'SMARTSTORE' && (
                  <>
                    <Badge variant={a.settings.dryRun === false ? 'default' : 'secondary'}>{a.settings.dryRun === false ? '실제 등록' : 'DRY RUN'}</Badge>{' '}
                    {!a.settings.deliveryInfo && <Badge variant="destructive">템플릿 필요</Badge>}
                  </>
                )}
                <span className="ml-1 text-muted-foreground">{when(a.updatedAt)}</span>
              </TableCell>
              <TableCell className="text-right">
                <Button size="xs" variant="ghost" onClick={() => setEditing(a)}>
                  수정
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {q.data?.length === 0 && (
            <TableRow>
              <TableCell className="text-sm text-muted-foreground">채널 계정이 없습니다</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {editing && (
        <div className="mt-3 grid gap-3 rounded-md bg-muted/50 p-3 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label className="text-xs">채널</Label>
            <Select value={channel} disabled={editing !== 'new'} onValueChange={(v) => setChannel(v as Channel)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(channelLabel) as Channel[]).map((c) => (
                  <SelectItem key={c} value={c}>
                    {channelLabel[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">표시 이름</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <label className="flex items-end gap-2 pb-2 text-xs">
            <Switch checked={active} onCheckedChange={setActive} /> 사용
          </label>
          {channelCredentialKeys[channel].map((k) => (
            <div key={k} className="grid gap-1.5">
              <Label className="text-xs">{k}</Label>
              <Input type="password" autoComplete="off" value={creds[k] ?? ''} placeholder={editing !== 'new' ? '바꿀 때만 입력' : ''} onChange={(e) => setCreds({ ...creds, [k]: e.target.value })} />
            </div>
          ))}
          {channel === 'SMARTSTORE' && (
            <>
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={dryRun} onCheckedChange={setDryRun} /> DRY RUN (등록 직전에 멈추고 보낼 본문만 기록)
              </label>
              <p className="text-xs text-muted-foreground sm:col-span-2">옵션 표기·전시 상태·할인은 위 &quot;특성&quot;에서 정합니다.</p>
              {editing !== 'new' && (
                <div className="grid gap-1.5">
                  <Label className="text-xs">예전 방식 템플릿 (품목 레퍼런스가 없을 때만 사용)</Label>
                  <div className="flex gap-1.5">
                    <Input value={templateNo} onChange={(e) => setTemplateNo(e.target.value.replace(/\D/g, ''))} placeholder="13677412599" />
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!templateNo}
                      onClick={async () => {
                        try {
                          const a = await api<ChannelAccount>(`/api/tenants/${tenantId}/channel-accounts/${(editing as ChannelAccount).id}/template`, { json: { originProductNo: templateNo } })
                          toast.success('배송·원산지·브랜드 설정을 가져왔습니다')
                          setEditing(a)
                          qc.invalidateQueries({ queryKey: ['accounts', tenantId] })
                        } catch (e) {
                          toast.error(errorMessage(e))
                        }
                      }}
                    >
                      가져오기
                    </Button>
                  </div>
                </div>
              )}
              {editing !== 'new' && Object.keys(editing.settings).length > 0 && (
                <details className="sm:col-span-3">
                  <summary className="cursor-pointer text-xs text-muted-foreground">현재 설정 (배송·원산지 등)</summary>
                  <pre className="mt-1 max-h-60 overflow-auto rounded bg-background p-2 text-[11px]">{JSON.stringify(editing.settings, null, 2)}</pre>
                </details>
              )}
            </>
          )}
          <div className="flex items-end gap-2 sm:col-span-3">
            <Button size="sm" disabled={!displayName.trim()} onClick={save}>
              저장
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
              닫기
            </Button>
          </div>
        </div>
      )}
    </Section>
  )
}

function MappingsCard({ tenantId }: { tenantId: number }) {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['mappings', tenantId], queryFn: () => api<CategoryMapping[]>(`/api/tenants/${tenantId}/category-mappings`) })
  const [channel, setChannel] = useState<Channel>('SMARTSTORE')
  const [category, setCategory] = useState('')
  const [channelCategoryId, setChannelCategoryId] = useState('')

  async function add() {
    try {
      await api(`/api/tenants/${tenantId}/category-mappings`, { method: 'PUT', json: { channel, category, channelCategoryId } })
      setCategory('')
      setChannelCategoryId('')
      qc.invalidateQueries({ queryKey: ['mappings', tenantId] })
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  async function remove(id: number) {
    await api(`/api/tenants/${tenantId}/category-mappings/${id}`, { method: 'DELETE' })
    qc.invalidateQueries({ queryKey: ['mappings', tenantId] })
  }

  return (
    <Section
      title="카테고리 매핑"
      description="상품의 카테고리 이름을 채널 카테고리 ID 로 바꿉니다. 스마트스토어는 품목마다 같은 판매자의 일반 상품(테스트·세일·품절 제외)을 레퍼런스로 지정하면 배송·반품·원산지·카테고리 속성을 그대로 복제합니다."
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>채널</TableHead>
            <TableHead>카테고리</TableHead>
            <TableHead>채널 카테고리 ID</TableHead>
            <TableHead>레퍼런스 상품 (판매 설정 복제)</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {q.data?.map((m) => (
            <TableRow key={m.id}>
              <TableCell>{channelLabel[m.channel]}</TableCell>
              <TableCell>{m.category}</TableCell>
              <TableCell className="font-mono text-xs">{m.channelCategoryId}</TableCell>
              <TableCell>{m.channel === 'SMARTSTORE' ? <ReferenceCell tenantId={tenantId} mapping={m} /> : <span className="text-xs text-muted-foreground">-</span>}</TableCell>
              <TableCell className="text-right">
                <Button size="icon-xs" variant="ghost" onClick={() => remove(m.id)}>
                  <Trash2 />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell>
              <Select value={channel} onValueChange={(v) => setChannel(v as Channel)}>
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(channelLabel) as Channel[]).map((c) => (
                    <SelectItem key={c} value={c}>
                      {channelLabel[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>
              <Input className="h-7" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="원피스" />
            </TableCell>
            <TableCell>
              <Input className="h-7" value={channelCategoryId} onChange={(e) => setChannelCategoryId(e.target.value)} placeholder="50000807" />
            </TableCell>
            <TableCell />
            <TableCell className="text-right">
              <Button size="xs" disabled={!category.trim() || !channelCategoryId.trim()} onClick={add}>
                추가
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Section>
  )
}

function ReferenceCell({ tenantId, mapping }: { tenantId: number; mapping: CategoryMapping }) {
  const qc = useQueryClient()
  const [no, setNo] = useState('')
  const [busy, setBusy] = useState(false)

  async function fetchRef(force: boolean) {
    setBusy(true)
    try {
      await api(`/api/tenants/${tenantId}/category-mappings/${mapping.id}/reference`, { json: { originProductNo: no, force } })
      toast.success('레퍼런스를 가져왔습니다')
      setNo('')
      qc.invalidateQueries({ queryKey: ['mappings', tenantId] })
    } catch (e) {
      const msg = errorMessage(e)
      // 테스트·세일 등 특이 상품이면 한 번 더 확인하고 강제로 쓴다
      if (!force && msg.includes('특이 상태') && confirm(msg + '\n\n그래도 이 상품을 레퍼런스로 쓸까요?')) {
        setBusy(false)
        return fetchRef(true)
      }
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {mapping.referenceProductNo ? (
        <div className="text-xs">
          <span className="font-mono">{mapping.referenceProductNo}</span> {mapping.referenceName}
          <span className="ml-1 text-muted-foreground">({when(mapping.referenceFetchedAt)})</span>
        </div>
      ) : (
        <Badge variant="destructive" className="w-fit">
          레퍼런스 없음
        </Badge>
      )}
      <div className="flex gap-1">
        <Input className="h-7 w-36" value={no} onChange={(e) => setNo(e.target.value.replace(/\D/g, ''))} placeholder="원상품번호" />
        <Button size="xs" variant="secondary" disabled={!no || busy} onClick={() => fetchRef(false)}>
          {mapping.referenceProductNo ? '교체' : '가져오기'}
        </Button>
      </div>
    </div>
  )
}
