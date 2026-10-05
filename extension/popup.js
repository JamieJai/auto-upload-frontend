const $ = (id) => document.getElementById(id)
const SLOTS = [['main', '대표'], ['sub', '연출'], ['detail', '디테일'], ['size', '사이즈표']]
let settings
let page
let picks = [] // {url, w, h, slot, on}

$('openOptions').addEventListener('click', (e) => {
  e.preventDefault()
  chrome.runtime.openOptionsPage()
})

function show(text, kind) {
  $('msg').textContent = text
  $('msg').className = kind || ''
}

// 페이지 안에서 실행된다: 보이는 글과 큰 이미지를 모은다
function capturePage() {
  const abs = (u) => {
    try {
      return new URL(u, location.href).href
    } catch {
      return null
    }
  }
  const largest = (srcset) => {
    let best = null
    let bw = -1
    for (const part of (srcset || '').split(',')) {
      const [u, d] = part.trim().split(/\s+/)
      const w = parseFloat(d) || 1
      if (u && w > bw) {
        bw = w
        best = u
      }
    }
    return best
  }
  const seen = new Set()
  const images = []
  const add = (u, w, h) => {
    const a = abs(u)
    if (!a || !/^https?:/.test(a) || seen.has(a) || /\.(svg|gif)(\?|$)/i.test(a)) return
    seen.add(a)
    images.push({ url: a, w, h })
  }
  const og = document.querySelector('meta[property="og:image"]')
  if (og && og.content) add(og.content, 0, 0)
  for (const img of document.images) {
    const w = img.naturalWidth || 0
    const h = img.naturalHeight || 0
    if (Math.max(w, h) < 400) continue
    add(largest(img.getAttribute('srcset')) || img.currentSrc || img.src || img.dataset.src, w, h)
  }
  const text = (document.body.innerText || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, 60000)
  return { url: location.href, title: document.title, text, images: images.slice(0, 40) }
}

function defaultSlot(i) {
  return i === 0 ? 'main' : i <= 2 ? 'sub' : 'detail'
}

function renderImages() {
  const box = $('images')
  box.textContent = ''
  picks.forEach((p, i) => {
    const cell = document.createElement('div')
    cell.className = 'cell' + (p.on ? ' on' : '')
    const img = document.createElement('img')
    img.src = p.url
    img.referrerPolicy = 'no-referrer'
    img.addEventListener('click', () => {
      p.on = !p.on
      renderImages()
    })
    const sel = document.createElement('select')
    for (const [v, label] of SLOTS) {
      const o = document.createElement('option')
      o.value = v
      o.textContent = label
      o.selected = p.slot === v
      sel.appendChild(o)
    }
    sel.disabled = !p.on
    sel.addEventListener('change', () => (p.slot = sel.value))
    const meta = document.createElement('div')
    meta.className = 'meta'
    meta.textContent = p.w ? `${p.w}×${p.h}` : 'og'
    cell.append(img, meta, sel)
    box.appendChild(cell)
  })
  const n = picks.filter((p) => p.on).length
  $('imgInfo').textContent = `이미지 ${picks.length}장 중 ${n}장 선택`
  $('send').disabled = n === 0
}

async function init() {
  settings = await loadSettings()
  if (!settings.dashboard || !settings.token) {
    show('먼저 설정에서 대시보드 주소와 토큰을 넣으세요', 'err')
    return
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  try {
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: capturePage })
    page = res.result
  } catch (e) {
    show('이 페이지는 읽을 수 없습니다 (' + e.message + ')', 'err')
    return
  }
  try {
    const tenants = await api(settings, '/api/intake/tenants')
    const sel = $('tenant')
    for (const t of tenants) {
      const o = document.createElement('option')
      o.value = t.id
      o.textContent = `${t.name} (${t.code})`
      o.selected = String(t.id) === String(settings.tenantId)
      sel.appendChild(o)
    }
    if (!tenants.length) throw new Error('대시보드에 활성 판매자가 없습니다')
  } catch (e) {
    show(e.message, 'err')
    return
  }
  $('title').textContent = page.title
  $('textInfo').textContent = `글 ${page.text.length.toLocaleString()}자 — ${page.text.slice(0, 80).replace(/\n/g, ' ')}…`
  picks = page.images.map((im, i) => ({ ...im, slot: defaultSlot(i), on: i < 12 }))
  renderImages()
  $('form').hidden = false
}

$('all').addEventListener('click', () => {
  picks.forEach((p) => (p.on = true))
  renderImages()
})
$('none').addEventListener('click', () => {
  picks.forEach((p) => (p.on = false))
  renderImages()
})

$('send').addEventListener('click', async () => {
  const chosen = picks.filter((p) => p.on)
  const tenantId = Number($('tenant').value)
  $('send').disabled = true
  try {
    const origins = [...new Set(chosen.map((p) => originPattern(p.url)))]
    if (origins.length && !(await chrome.permissions.contains({ origins }))) {
      throw new Error('사이트 접근 권한이 없습니다. 설정에서 "저장하고 연결 확인"을 다시 눌러 허용하세요')
    }
    show(`이미지 ${chosen.length}장 받는 중…`)
    const blobs = []
    const failed = []
    for (const p of chosen) {
      try {
        const r = await fetch(p.url, { credentials: 'include' })
        if (!r.ok) throw new Error(r.status)
        blobs.push({ p, blob: await r.blob() })
      } catch (e) {
        failed.push(p.url)
      }
    }
    const form = new FormData()
    const meta = { tenantId, url: page.url, title: page.title, text: page.text, images: blobs.map(({ p }) => ({ url: p.url, slot: p.slot })) }
    form.append('meta', new Blob([JSON.stringify(meta)], { type: 'application/json' }))
    blobs.forEach(({ blob }, i) => form.append('files', blob, `image-${i + 1}.${(blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')}`))
    show('대시보드로 보내는 중…')
    const res = await api(settings, '/api/intake/products', { method: 'POST', body: form })
    await chrome.storage.local.set({ tenantId })
    $('form').hidden = true
    const done = $('done')
    done.hidden = false
    done.innerHTML = ''
    const p1 = document.createElement('p')
    p1.textContent = `상품 ${res.code} 초안을 만들었습니다 (이미지 ${res.imageCount}장). 잠시 뒤 AI 가 원문에서 값을 채웁니다.`
    const a = document.createElement('a')
    a.href = `${settings.dashboard}/products/${res.productId}`
    a.target = '_blank'
    a.textContent = '대시보드에서 열기'
    done.append(p1, a)
    const warn = [...failed.map((u) => '받지 못한 이미지: ' + u), ...(res.warnings || [])]
    if (warn.length) {
      const ul = document.createElement('ul')
      ul.className = 'muted'
      warn.forEach((w) => {
        const li = document.createElement('li')
        li.textContent = w
        ul.appendChild(li)
      })
      done.appendChild(ul)
    }
    show('')
  } catch (e) {
    show(e.message, 'err')
    $('send').disabled = false
  }
})

init()
