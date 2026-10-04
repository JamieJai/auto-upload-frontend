import { NavLink, Outlet, useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { ClipboardCheck, Gauge, Images, LogOut, Package, Store } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { useTenant } from '@/lib/tenant'
import { cn } from '@/lib/utils'

const nav = [
  { to: '/', label: '작업 현황', icon: Gauge, end: true },
  { to: '/products', label: '상품', icon: Package },
  { to: '/images', label: '이미지', icon: Images },
  { to: '/approvals', label: '승인 대기', icon: ClipboardCheck },
  { to: '/tenants', label: '판매자 관리', icon: Store },
]

export function Layout({ username }: { username: string }) {
  const { tenants, current, select } = useTenant()
  const qc = useQueryClient()
  const navigate = useNavigate()

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' })
    qc.clear()
    navigate('/login')
    window.location.reload()
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden w-52 shrink-0 border-r bg-background md:flex md:flex-col">
        <div className="px-4 py-4 text-sm font-semibold">상품등록 자동화</div>
        <nav className="flex flex-col gap-0.5 px-2">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground',
                  isActive && 'bg-muted font-medium text-foreground',
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
          {username}
          <Button variant="ghost" size="icon-sm" onClick={logout} title="로그아웃">
            <LogOut className="size-4" />
          </Button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b bg-background px-4 py-2.5">
          <nav className="flex gap-1 overflow-x-auto md:hidden">
            {nav.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => cn('rounded px-2 py-1 text-xs whitespace-nowrap', isActive && 'bg-muted font-medium')}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">판매자</span>
            {tenants.length ? (
              <Select value={current ? String(current.id) : undefined} onValueChange={(v) => select(Number(v))}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="판매자 선택" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name} <span className="text-muted-foreground">({t.code})</span>
                      {!t.active && ' · 비활성'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Button size="sm" variant="outline" onClick={() => navigate('/tenants')}>
                판매자 추가
              </Button>
            )}
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

/** 판매자가 필요한 화면에서 판매자가 없을 때 */
export function NeedTenant() {
  const navigate = useNavigate()
  return (
    <div className="rounded-lg border bg-background p-8 text-center text-sm text-muted-foreground">
      먼저 판매자를 추가하세요.
      <div className="mt-3">
        <Button size="sm" onClick={() => navigate('/tenants')}>
          판매자 관리로
        </Button>
      </div>
    </div>
  )
}

export function PageTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <h1 className="text-lg font-semibold">{title}</h1>
      <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}
