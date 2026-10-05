// 설정은 chrome.storage.local 에만 둔다 (토큰은 대시보드에서 언제든 폐기할 수 있다)
async function loadSettings() {
  const s = await chrome.storage.local.get(['dashboard', 'token', 'tenantId', 'sizeFilter', 'watermarkTemplate'])
  return {
    dashboard: (s.dashboard || '').replace(/\/+$/, ''),
    token: s.token || '',
    tenantId: s.tenantId || null,
    sizeFilter: s.sizeFilter || [],
    watermarkTemplate: s.watermarkTemplate || '',
  }
}

async function api(settings, path, init = {}) {
  const res = await fetch(settings.dashboard + path, {
    ...init,
    headers: { Authorization: 'Bearer ' + settings.token, ...(init.headers || {}) },
  })
  if (!res.ok) {
    let msg = `요청 실패 (${res.status})`
    try {
      const body = await res.json()
      if (body.message) msg = body.message
    } catch {}
    if (res.status === 401) msg = '토큰이 맞지 않거나 폐기되었습니다. 설정에서 새 토큰을 넣으세요'
    throw new Error(msg)
  }
  return res.status === 204 ? null : res.json()
}

function originPattern(url) {
  const u = new URL(url)
  return `${u.protocol}//${u.host}/*`
}
