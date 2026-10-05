// 백엔드 DTO 와 1:1. 필드 이름을 바꾸면 백엔드도 같이 바꾼다.

export type ProductStatus = 'DRAFT' | 'NEEDS_INPUT' | 'GENERATING' | 'PENDING_APPROVAL' | 'APPROVED' | 'CANCELLED'
export type JobStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED_RETRYABLE' | 'FAILED_INVALID' | 'CANCELLED'
export type ListingStatus = 'PENDING' | 'REGISTERING' | 'COMPLETED' | 'FAILED_RETRYABLE' | 'FAILED_INVALID' | 'CANCELLED'
export type Channel = 'SMARTSTORE' | 'CAFE24' | 'ZIGZAG'
export type TextField = 'NAME' | 'DESCRIPTION' | 'SEARCH_KEYWORDS' | 'OPTION_DISPLAY'
export type Slot = 'main' | 'sub' | 'detail' | 'size'

export interface Page<T> {
  content: T[]
  page: { size: number; number: number; totalElements: number; totalPages: number }
}

export interface Tenant {
  id: number
  code: string
  name: string
  productCodePrefix: string | null
  brandTone: string | null
  noticeDefaults: Record<string, string>
  allowedImageDomains: string[]
  priceRule: { multiplier?: number; add?: number; roundUnit?: number; subtract?: number; defaultStock?: number } | null
  active: boolean
}

export interface ValidationIssue {
  field: string
  code: string
  message: string
}

export interface ProductOption {
  id?: number
  color: string
  size: string
  colorDisplay: string | null
  stock: number
  extraPrice: number
  sku: string | null
}

export interface Measurement {
  size: string
  measures: Record<string, number>
}

export interface ProductImage {
  id: number
  slot: Slot
  seq: number
  path: string
  thumbPath: string | null
  sourceType: 'UPLOAD' | 'WEB'
  sourceUrl: string | null
  width: number | null
  height: number | null
  sha256: string | null
  originalPath: string | null
  watermarkTemplate: string | null
}

export interface Product {
  id: number
  tenantId: number
  code: string
  category: string | null
  status: ProductStatus
  reviewNote: string | null
  name: string | null
  description: string | null
  searchKeywords: string[]
  fieldSources: Partial<Record<TextField, 'MANUAL' | 'AI' | 'SOURCE'>>
  salePrice: number | null
  notice: Record<string, string | null>
  options: ProductOption[]
  measurements: Measurement[]
  images: ProductImage[]
  createdAt: string
  updatedAt: string
}

export interface ProductSummary {
  id: number
  code: string
  name: string | null
  category: string | null
  status: ProductStatus
  salePrice: number | null
  updatedAt: string
}

export interface ChannelAccount {
  id: number
  channel: Channel
  displayName: string
  hasCredentials: boolean
  settings: Record<string, unknown>
  active: boolean
  updatedAt: string
}

export interface CategoryMapping {
  id: number
  channel: Channel
  category: string
  channelCategoryId: string
  referenceProductNo: string | null
  referenceName: string | null
  referenceFetchedAt: string | null
  reference: Record<string, unknown> | null
}

export interface JobSummary {
  id: number
  tenantId: number
  tenantCode: string | null
  productId: number
  productCode: string | null
  productName: string | null
  type: 'GENERATE' | 'REGISTER'
  status: JobStatus
  step: string | null
  attempt: number
  nextRunAt: string
  lastError: string | null
  createdAt: string
  updatedAt: string
}

export interface JobDetail {
  job: JobSummary
  logs: { id: number; step: string | null; level: 'INFO' | 'WARN' | 'ERROR'; message: string; createdAt: string }[]
  listing: {
    id: number
    channel: Channel
    accountName: string
    status: ListingStatus
    channelProductNo: string | null
    lastResponse: unknown
    registeredAt: string | null
  } | null
}

export interface Dashboard {
  today: { received: number; completed: number; processing: number; failed: number; pendingApproval: number }
  recent: JobSummary[]
}

export interface ApprovalItem {
  productId: number
  tenantId: number
  tenantCode: string
  tenantName: string
  code: string
  name: string | null
  category: string | null
  salePrice: number | null
  status: ProductStatus
  updatedAt: string
}

export interface UploadResult {
  matched: { filename: string; productId: number; productCode: string; slot: Slot; seq: number; imageId: number }[]
  unmatched: { filename: string; reason: string }[]
}

export interface UnmatchedFile {
  filename: string
  size: number
  modifiedAt: string
}

export interface ExcelRow {
  rowNumber: number
  product: { code: string; category: string | null; name: string | null; salePrice: number | null }
  colors: string[]
  sizes: string[]
  stock: number
  measurements: Record<string, Record<string, number>>
  errors: string[]
  warnings: ValidationIssue[]
}

export interface ExcelPreview {
  total: number
  importable: number
  blocked: number
  notes: string[]
  rows: ExcelRow[]
}

export interface ExcelImportResult {
  created: number
  skipped: number
  rows: { rowNumber: number; code: string; productId: number | null; error: string | null }[]
}
