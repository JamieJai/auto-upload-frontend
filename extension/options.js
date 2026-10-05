const $ = (id) => document.getElementById(id)

loadSettings().then((s) => {
  $('dashboard').value = s.dashboard
  $('token').value = s.token
})

$('save').addEventListener('click', async () => {
  const status = $('status')
  status.textContent = ''
  status.className = ''
  const dashboard = $('dashboard').value.trim().replace(/\/+$/, '')
  const token = $('token').value.trim()
  try {
    if (!/^https?:\/\//.test(dashboard)) throw new Error('주소는 http:// 또는 https:// 로 시작해야 합니다')
    if (!token.startsWith('ar_')) throw new Error('토큰은 ar_ 로 시작합니다')
    // 대시보드와 도매처 이미지 서버를 읽으려면 사이트 접근 권한이 필요하다. 팝업에서 물으면 팝업이 닫히므로 여기서 한 번 받는다
    const granted = await chrome.permissions.request({ origins: ['https://*/*', 'http://*/*'] })
    if (!granted) throw new Error('사이트 접근을 허용해야 대시보드와 이미지 서버를 읽을 수 있습니다')
    await chrome.storage.local.set({ dashboard, token })
    const tenants = await api({ dashboard, token }, '/api/intake/tenants')
    status.textContent = `연결됨 — 판매자 ${tenants.length}곳`
    status.className = 'ok'
  } catch (e) {
    status.textContent = e.message
    status.className = 'err'
  }
})
