import type { ValidationIssue } from './types'

/** 백엔드 오류. status 로 분기하고 message 는 그대로 사용자에게 보여 줄 수 있다 */
export class ApiError extends Error {
  readonly status: number
  readonly issues: ValidationIssue[]
  readonly fields: { field: string; message: string }[]

  constructor(status: number, message: string, issues: ValidationIssue[] = [], fields: { field: string; message: string }[] = []) {
    super(message)
    this.status = status
    this.issues = issues
    this.fields = fields
  }
}

function xsrfToken(): string | undefined {
  return document.cookie
    .split('; ')
    .find((c) => c.startsWith('XSRF-TOKEN='))
    ?.split('=')[1]
}

type Options = { method?: string; json?: unknown; form?: FormData; signal?: AbortSignal }

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const method = opts.method ?? (opts.json !== undefined || opts.form ? 'POST' : 'GET')
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (method !== 'GET') {
    const token = xsrfToken()
    if (token) headers['X-XSRF-TOKEN'] = decodeURIComponent(token)
  }
  let body: BodyInit | undefined
  if (opts.json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.json)
  } else if (opts.form) {
    body = opts.form
  }
  const res = await fetch(path, { method, headers, body, credentials: 'same-origin', signal: opts.signal })
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    window.dispatchEvent(new Event('autoreg:unauthorized'))
  }
  if (!res.ok) {
    let message = `요청 실패 (${res.status})`
    let issues: ValidationIssue[] = []
    let fields: { field: string; message: string }[] = []
    try {
      const err = await res.json()
      message = err.message ?? message
      issues = err.issues ?? []
      fields = err.fields ?? []
      if (fields.length) message += ': ' + fields.map((f) => `${f.field} ${f.message}`).join(', ')
    } catch {
      if (res.status === 401) message = '로그인이 필요합니다'
      if (res.status === 403) message = '권한이 없거나 세션이 만료되었습니다. 새로고침 후 다시 시도하세요'
      if (res.status === 413) message = '파일이 너무 큽니다'
    }
    throw new ApiError(res.status, message, issues, fields)
  }
  if (res.status === 204) return undefined as T
  const type = res.headers.get('Content-Type') ?? ''
  return (type.includes('json') ? res.json() : res.text()) as Promise<T>
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** /data/images 상대경로 → 브라우저 URL */
export function fileUrl(path: string | null | undefined): string | undefined {
  return path ? `/files/${path.split('/').map(encodeURIComponent).join('/')}` : undefined
}
