import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { Layout } from '@/components/app/Layout'
import { api } from '@/lib/api'
import { TenantProvider } from '@/lib/tenant'
import { ApprovalsPage } from '@/pages/ApprovalsPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ImagesPage } from '@/pages/ImagesPage'
import { JobDetailPage } from '@/pages/JobDetailPage'
import { LoginPage } from '@/pages/LoginPage'
import { ProductEditPage } from '@/pages/ProductEditPage'
import { ProductsPage } from '@/pages/ProductsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { TenantsPage } from '@/pages/TenantsPage'

export default function App() {
  const qc = useQueryClient()
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api<{ authenticated: boolean; username: string | null }>('/api/auth/me'),
  })
  const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    if (me.data?.authenticated) setUsername(me.data.username)
  }, [me.data])

  // 세션이 만료되면 어느 화면에서든 로그인으로 보낸다
  useEffect(() => {
    const onUnauthorized = () => {
      setUsername(null)
      qc.clear()
    }
    window.addEventListener('autoreg:unauthorized', onUnauthorized)
    return () => window.removeEventListener('autoreg:unauthorized', onUnauthorized)
  }, [qc])

  if (me.isLoading) return null
  if (!username) {
    return (
      <LoginPage
        onLogin={(u) => {
          qc.clear()
          setUsername(u)
        }}
      />
    )
  }

  return (
    <TenantProvider>
      <Routes>
        <Route element={<Layout username={username} />}>
          <Route index element={<DashboardPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="products/new" element={<ProductEditPage />} />
          <Route path="products/:id" element={<ProductEditPage />} />
          <Route path="images" element={<ImagesPage />} />
          <Route path="approvals" element={<ApprovalsPage />} />
          <Route path="jobs/:id" element={<JobDetailPage />} />
          <Route path="tenants" element={<TenantsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </TenantProvider>
  )
}
