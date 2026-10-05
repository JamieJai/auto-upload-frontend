import type { Channel, JobStatus, ListingStatus, ProductStatus, Slot, TextField } from './types'

type Tone = 'default' | 'secondary' | 'destructive' | 'outline'

export const productStatus: Record<ProductStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: '입력 중', tone: 'outline' },
  NEEDS_INPUT: { label: '보완 필요', tone: 'destructive' },
  GENERATING: { label: '문구 생성 중', tone: 'secondary' },
  PENDING_APPROVAL: { label: '승인 대기', tone: 'default' },
  APPROVED: { label: '승인됨', tone: 'secondary' },
  CANCELLED: { label: '취소', tone: 'outline' },
}

export const jobStatus: Record<JobStatus, { label: string; tone: Tone }> = {
  QUEUED: { label: '대기', tone: 'outline' },
  RUNNING: { label: '실행 중', tone: 'secondary' },
  SUCCEEDED: { label: '완료', tone: 'default' },
  FAILED_RETRYABLE: { label: '재시도 대기', tone: 'secondary' },
  FAILED_INVALID: { label: '수정 필요', tone: 'destructive' },
  CANCELLED: { label: '취소', tone: 'outline' },
}

export const listingStatus: Record<ListingStatus, { label: string; tone: Tone }> = {
  PENDING: { label: '대기', tone: 'outline' },
  REGISTERING: { label: '등록 중', tone: 'secondary' },
  COMPLETED: { label: '등록 완료', tone: 'default' },
  FAILED_RETRYABLE: { label: '재시도 대기', tone: 'secondary' },
  FAILED_INVALID: { label: '수정 필요', tone: 'destructive' },
  CANCELLED: { label: '취소', tone: 'outline' },
}

export const jobType = { GENERATE: '문구 생성', REGISTER: '채널 등록' } as const

export const channelLabel: Record<Channel, string> = {
  SMARTSTORE: '스마트스토어',
  CAFE24: '카페24',
  ZIGZAG: '지그재그',
}

/** 채널별 인증정보 입력 칸. 값은 서버에서 암호화되고 다시 보여 주지 않는다 */
export const channelCredentialKeys: Record<Channel, string[]> = {
  SMARTSTORE: ['clientId', 'clientSecret'],
  CAFE24: ['mallId', 'clientId', 'clientSecret'],
  ZIGZAG: ['apiKey'],
}

export const slots: { value: Slot; label: string; min: number }[] = [
  { value: 'main', label: '대표', min: 1 },
  { value: 'sub', label: '연출컷', min: 2 },
  { value: 'detail', label: '디테일', min: 2 },
  { value: 'size', label: '사이즈표', min: 0 },
]

/** 상품정보제공고시(의류). 키는 백엔드 NoticeField.key 와 같다 */
export const noticeFields: { key: string; label: string; required: boolean; aiForbidden: boolean; multiline?: boolean }[] = [
  { key: 'material', label: '소재·혼용률', required: true, aiForbidden: true },
  { key: 'manufacturer', label: '제조자/수입자', required: true, aiForbidden: true },
  { key: 'origin_country', label: '제조국', required: true, aiForbidden: true },
  { key: 'wash_care', label: '세탁방법·취급 주의', required: true, aiForbidden: true, multiline: true },
  { key: 'quality_assurance', label: '품질보증기준', required: true, aiForbidden: false, multiline: true },
  { key: 'as_manager', label: 'A/S 책임자', required: true, aiForbidden: false },
  { key: 'as_phone', label: 'A/S 전화번호', required: true, aiForbidden: false },
  { key: 'manufactured_ym', label: '제조연월', required: false, aiForbidden: false },
  { key: 'kc_certification', label: 'KC 인증정보', required: false, aiForbidden: true },
]

export const textFieldLabel: Record<TextField, string> = {
  NAME: '상품명',
  DESCRIPTION: '상세설명',
  SEARCH_KEYWORDS: '검색키워드',
  OPTION_DISPLAY: '옵션 표시명',
}

export const measureParts = ['총장', '어깨너비', '가슴단면', '소매길이', '허리단면', '엉덩이단면', '허벅지단면', '밑위', '밑단']

export function won(n: number | null | undefined): string {
  return n == null ? '-' : n.toLocaleString('ko-KR') + '원'
}

export function when(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  return sameDay
    ? d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
