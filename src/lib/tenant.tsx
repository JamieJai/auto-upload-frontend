import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'

import { api } from './api'
import type { Tenant } from './types'

interface TenantState {
  tenants: Tenant[]
  /** 지금 작업 중인 판매자. 없으면 null (판매자를 먼저 만들어야 한다) */
  current: Tenant | null
  select: (id: number) => void
  loading: boolean
}

const Ctx = createContext<TenantState | null>(null)
const KEY = 'autoreg.tenant'

function stored(): number | null {
  try {
    const v = localStorage.getItem(KEY)
    return v ? Number(v) : null
  } catch {
    return null
  }
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const q = useQuery({ queryKey: ['tenants'], queryFn: () => api<Tenant[]>('/api/tenants') })
  const [selected, setSelected] = useState<number | null>(stored)
  const tenants = useMemo(() => q.data ?? [], [q.data])
  const current = tenants.find((t) => t.id === selected) ?? tenants.find((t) => t.active) ?? tenants[0] ?? null

  useEffect(() => {
    if (current && current.id !== selected) setSelected(current.id)
  }, [current, selected])

  const value: TenantState = {
    tenants,
    current,
    loading: q.isLoading,
    select: (id) => {
      setSelected(id)
      try {
        localStorage.setItem(KEY, String(id))
      } catch {
        // 저장 못 해도 이번 세션에서는 동작한다
      }
    },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTenant(): TenantState {
  const v = useContext(Ctx)
  if (!v) throw new Error('TenantProvider 밖에서 useTenant 호출')
  return v
}
