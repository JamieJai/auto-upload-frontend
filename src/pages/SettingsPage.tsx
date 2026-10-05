import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Download, KeyRound } from 'lucide-react'
import { toast } from 'sonner'

import { PageTitle } from '@/components/app/Layout'
import { Section } from '@/components/product/Section'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api, errorMessage } from '@/lib/api'
import { when } from '@/lib/labels'

interface TokenView {
  id: number
  name: string
  createdAt: string
  lastUsedAt: string | null
  revokedAt: string | null
}

export function SettingsPage() {
  const qc = useQueryClient()
  const tokens = useQuery({ queryKey: ['intake-tokens'], queryFn: () => api<TokenView[]>('/api/intake-tokens') })
  const [name, setName] = useState('')
  const [issued, setIssued] = useState<string | null>(null)

  async function issue() {
    try {
      const r = await api<{ token: string }>('/api/intake-tokens', { json: { name: name || '크롬' } })
      setIssued(r.token)
      setName('')
      qc.invalidateQueries({ queryKey: ['intake-tokens'] })
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  async function revoke(id: number) {
    await api(`/api/intake-tokens/${id}`, { method: 'DELETE' })
    qc.invalidateQueries({ queryKey: ['intake-tokens'] })
  }

  return (
    <>
      <PageTitle title="설정" />
      <Section
        title="브라우저 확장 — 도매처 페이지 보내기"
        description="크롬에서 로그인된 도매처(신상마켓 등) 상품 페이지를 보다가 확장 버튼을 누르면, 글과 이미지가 이 대시보드로 와서 상품 초안이 됩니다. 도매처 비밀번호는 어디에도 저장하지 않습니다."
      >
        <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm">
          <li>
            <a className="inline-flex items-center gap-1 underline" href="/autoreg-extension.zip" download>
              <Download className="size-3.5" /> 확장 내려받기
            </a>{' '}
            → 압축 풀기
          </li>
          <li>
            크롬 주소창에 <code>chrome://extensions</code> → 오른쪽 위 <b>개발자 모드</b> 켜기 → <b>압축해제된 확장 프로그램을 로드합니다</b> → 푼 폴더(autoreg-extension) 선택
          </li>
          <li>아래에서 토큰을 발급해 복사</li>
          <li>
            확장 아이콘 → <b>설정</b> → 대시보드 주소(<code>{window.location.origin}</code>)와 토큰 붙여넣기 → 저장 (사이트 접근 권한 허용)
          </li>
          <li>도매처 상품 페이지에서 확장 아이콘 → 판매자·이미지 슬롯 고르고 <b>보내기</b></li>
        </ol>
        {issued && (
          <Alert className="mb-3">
            <AlertDescription>
              <div className="mb-1 font-medium">새 토큰 — 지금만 보입니다. 확장 설정에 붙여넣으세요.</div>
              <div className="flex gap-2">
                <Input readOnly value={issued} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard?.writeText(issued).catch(() => undefined)
                    toast.success('복사했습니다')
                  }}
                >
                  <Copy /> 복사
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
        <div className="mb-3 flex gap-2">
          <Input className="max-w-xs" value={name} onChange={(e) => setName(e.target.value)} placeholder="토큰 이름 (예: 사무실 크롬)" />
          <Button size="sm" onClick={issue}>
            <KeyRound /> 토큰 발급
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead>발급</TableHead>
              <TableHead>마지막 사용</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tokens.data?.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{when(t.createdAt)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{when(t.lastUsedAt)}</TableCell>
                <TableCell className="text-right">
                  {t.revokedAt ? (
                    <Badge variant="outline">폐기됨</Badge>
                  ) : (
                    <Button size="xs" variant="ghost" className="text-destructive" onClick={() => confirm('이 토큰을 폐기할까요? 이 토큰을 쓰는 확장은 더 이상 보낼 수 없습니다') && revoke(t.id)}>
                      폐기
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>
    </>
  )
}
