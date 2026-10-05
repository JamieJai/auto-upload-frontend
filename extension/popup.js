const $ = (id) => document.getElementById(id)
const SLOTS = [['main', '대표'], ['sub', '연출'], ['detail', '디테일'], ['size', '사이즈표']]
let settings
let page
let picks = [] // {url, w, h, slot, on}
let sizeFilter = [] // ['1500x2000'] — 비어 있으면 모든 크기
const sizeKey = (p) => (p.w ? `${p.w}x${p.h}` : '?')
const visible = (p) => p.w && Math.max(p.w, p.h) >= 400 && (!sizeFilter.length || sizeFilter.includes(sizeKey(p)))

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
    // 아직 안 불러온 지연 로딩 이미지(0)는 남기고 팝업에서 크기를 잰다. 불러온 작은 이미지만 뺀다
    if (w && Math.max(w, h) < 400) continue
    add(largest(img.getAttribute('srcset')) || img.dataset.src || img.dataset.original || img.currentSrc || img.src, w, h)
  }
  const text = (document.body.innerText || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, 60000)
  return { url: location.href, title: document.title, text, images: images.slice(0, 80) }
}

/** 실제 원본 크기를 잰다 (페이지에서 아직 안 불러온 지연 로딩 이미지 포함) */
function measure(images) {
  return Promise.all(
    images.map(
      (im) =>
        new Promise((resolve) => {
          const img = new Image()
          img.referrerPolicy = 'no-referrer'
          const done = () => resolve({ ...im, w: img.naturalWidth || im.w, h: img.naturalHeight || im.h, on: false, slot: 'detail' })
          img.onload = done
          img.onerror = done
          setTimeout(done, 8000)
          img.src = im.url
        }),
    ),
  )
}

function defaultSlot(i) {
  return i === 0 ? 'main' : i <= 2 ? 'sub' : 'detail'
}

function renderSizes() {
  const box = $('sizes')
  box.textContent = ''
  const counts = {}
  for (const p of picks) if (p.w && Math.max(p.w, p.h) >= 400) counts[sizeKey(p)] = (counts[sizeKey(p)] || 0) + 1
  const keys = Object.keys(counts).sort((a, b) => counts[b] - counts[a])
  const all = document.createElement('button')
  all.className = 'chip' + (sizeFilter.length ? '' : ' on')
  all.textContent = '모든 크기'
  all.addEventListener('click', () => setFilter([]))
  box.appendChild(all)
  for (const k of keys) {
    const b = document.createElement('button')
    b.className = 'chip' + (sizeFilter.includes(k) ? ' on' : '')
    b.textContent = `${k.replace('x', '×')} (${counts[k]})`
    b.addEventListener('click', () => setFilter(sizeFilter.includes(k) ? sizeFilter.filter((x) => x !== k) : [...sizeFilter, k]))
    box.appendChild(b)
  }
}

async function setFilter(next) {
  sizeFilter = next
  await chrome.storage.local.set({ sizeFilter })
  assignSlots()
  renderSizes()
  renderImages()
}

/** 보이는 이미지 기준으로 기본 슬롯을 다시 매긴다 (첫 장 대표, 다음 두 장 연출, 나머지 디테일) */
function assignSlots() {
  let i = 0
  for (const p of picks) {
    if (!visible(p)) continue
    if (!p.touched) {
      p.slot = defaultSlot(i)
      p.on = true
    }
    i++
  }
}

function renderImages() {
  const box = $('images')
  box.textContent = ''
  picks.filter(visible).forEach((p) => {
    const cell = document.createElement('div')
    cell.className = 'cell' + (p.on ? ' on' : '')
    const img = document.createElement('img')
    img.src = p.url
    img.referrerPolicy = 'no-referrer'
    img.addEventListener('click', () => {
      p.on = !p.on
      p.touched = true
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
    sel.addEventListener('change', () => {
      p.slot = sel.value
      p.touched = true
    })
    const meta = document.createElement('div')
    meta.className = 'meta'
    meta.textContent = p.w ? `${p.w}×${p.h}` : 'og'
    cell.append(img, meta, sel)
    box.appendChild(cell)
  })
  const shown = picks.filter(visible)
  const n = shown.filter((p) => p.on).length
  $('imgInfo').textContent = `보이는 ${shown.length}장 중 ${n}장 선택`
  $('send').disabled = n === 0
}

async function init() {
  settings = await loadSettings()
  if (!settings.dashboard || !settings.token) {
    show('먼저 설정에서 대시보드 주소와 토큰을 넣으세요', 'err')
    return
  }
  // 자동 테스트용: popup.html?target=<주소 앞부분> 이면 그 탭을 읽는다
  const target = new URLSearchParams(location.search).get('target')
  const [tab] = target
    ? (await chrome.tabs.query({})).filter((t) => (t.url || '').startsWith(target))
    : await chrome.tabs.query({ active: true, currentWindow: true })
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
  try {
    const templates = await api(settings, '/api/intake/watermarks')
    const sel = $('watermark')
    for (const t of templates) {
      const o = document.createElement('option')
      o.value = t.name
      o.textContent = `${t.name} (${t.width}×${t.height} 사진에만)`
      o.selected = t.name === settings.watermarkTemplate
      sel.appendChild(o)
    }
  } catch {
    // 템플릿이 없어도 보내기는 된다
  }
  $('title').textContent = page.title
  $('textInfo').textContent = `글 ${page.text.length.toLocaleString()}자 — ${page.text.slice(0, 80).replace(/\n/g, ' ')}…`
  show('사진 크기 확인 중…')
  picks = await measure(page.images)
  show('')
  sizeFilter = settings.sizeFilter || []
  assignSlots()
  renderSizes()
  renderImages()
  $('form').hidden = false
}

$('all').addEventListener('click', () => {
  picks.filter(visible).forEach((p) => ((p.on = true), (p.touched = true)))
  renderImages()
})
$('none').addEventListener('click', () => {
  picks.filter(visible).forEach((p) => ((p.on = false), (p.touched = true)))
  renderImages()
})
$('watermark').addEventListener('change', () => chrome.storage.local.set({ watermarkTemplate: $('watermark').value }))

$('send').addEventListener('click', async () => {
  const chosen = picks.filter((p) => visible(p) && p.on)
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
    const watermarkTemplate = $('watermark').value || null
    const meta = { tenantId, url: page.url, title: page.title, text: page.text, images: blobs.map(({ p }) => ({ url: p.url, slot: p.slot })), watermarkTemplate }
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
    p1.textContent = `상품 ${res.code} 초안을 만들었습니다 (이미지 ${res.imageCount}장). 잠시 뒤 ${watermarkTemplate ? '워터마크를 지우고 ' : ''}AI 가 원문에서 값을 채웁니다.`
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
