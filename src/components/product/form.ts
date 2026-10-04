import { noticeFields } from '@/lib/labels'
import type { Product } from '@/lib/types'

/** 화면 입력값 (모두 문자열). 저장할 때 toRequest 로 백엔드 ProductRequest 로 바꾼다 */
export interface ProductForm {
  code: string
  category: string
  salePrice: string
  name: string
  description: string
  keywords: string
  notice: Record<string, string>
}

export function emptyForm(prefix = ''): ProductForm {
  return { code: prefix, category: '', salePrice: '', name: '', description: '', keywords: '', notice: {} }
}

export function toForm(p: Product): ProductForm {
  const notice: Record<string, string> = {}
  for (const f of noticeFields) notice[f.key] = p.notice[f.key] ?? ''
  return {
    code: p.code,
    category: p.category ?? '',
    salePrice: p.salePrice == null ? '' : String(p.salePrice),
    name: p.name ?? '',
    description: p.description ?? '',
    keywords: p.searchKeywords.join(', '),
    notice,
  }
}

const camel = (key: string) => key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())

export function toRequest(f: ProductForm): Record<string, unknown> {
  const price = f.salePrice.replace(/[^0-9]/g, '')
  const req: Record<string, unknown> = {
    code: f.code.trim(),
    category: f.category.trim() || null,
    salePrice: price ? Number(price) : null,
    name: f.name.trim() || null,
    description: f.description.trim() || null,
    searchKeywords: f.keywords
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean),
  }
  for (const n of noticeFields) req[camel(n.key)] = (f.notice[n.key] ?? '').trim() || null
  return req
}

export function sameForm(a: ProductForm, b: ProductForm): boolean {
  return JSON.stringify(toRequest(a)) === JSON.stringify(toRequest(b))
}
