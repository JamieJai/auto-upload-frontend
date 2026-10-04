import { Badge } from '@/components/ui/badge'
import { jobStatus, listingStatus, productStatus } from '@/lib/labels'
import type { JobStatus, ListingStatus, ProductStatus } from '@/lib/types'

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  const s = productStatus[status]
  return <Badge variant={s.tone}>{s.label}</Badge>
}

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const s = jobStatus[status]
  return <Badge variant={s.tone}>{s.label}</Badge>
}

export function ListingStatusBadge({ status }: { status: ListingStatus }) {
  const s = listingStatus[status]
  return <Badge variant={s.tone}>{s.label}</Badge>
}
