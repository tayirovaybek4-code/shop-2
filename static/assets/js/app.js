/* ==========================================================================
   PHLOX storefront — app.js
   • Works with ANY server-rendered HTML: it reads data-* attributes, not an API.
   • Cart + wishlist live in localStorage (so they work for guests, with or without Django).
   • Forms with data-demo="true" are intercepted for a working demo.
     REMOVE data-demo from a <form> when its Django view handles the POST.
   ========================================================================== */
(() => {
  'use strict'
  const $ = (s, r = document) => r.querySelector(s)
  const $$ = (s, r = document) => [...r.querySelectorAll(s)]
  const CFG = window.PHLOX || { urls: {}, freeShippingFrom: 500 }
  const KEY = { cart: 'phlox_cart_v2', wish: 'phlox_wish_v2', order: 'phlox_last_order', promo: 'phlox_promo' }

  /* ---------- helpers ---------- */
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }
  const money = n => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  const debounce = (fn, ms = 150) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms) } }
  const productUrl = id => `${CFG.urls.product || '/product/'}?id=${id}`

  let toastTimer
  function toast (msg, type = 'ok') {
    const t = $('#toast')
    if (!t) return
    t.className = type === 'err' ? 'err' : ''
    t.innerHTML = `<i class="bi ${type === 'err' ? 'bi-exclamation-circle-fill' : 'bi-check-circle-fill'}"></i><span>${esc(msg)}</span>`
    requestAnimationFrame(() => t.classList.add('show'))
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => t.classList.remove('show'), 3200)
  }
  window.phloxToast = toast

  /* ---------- state ---------- */
  const getCart = () => read(KEY.cart, [])
  const getWish = () => read(KEY.wish, [])
  const cartQty = () => getCart().reduce((s, i) => s + i.qty, 0)
  const cartTotal = () => getCart().reduce((s, i) => s + i.price * i.qty, 0)
  const discountRate = () => (read(KEY.promo, '') === 'PHLOX10' ? 0.1 : 0)

  function readProduct (el) {
    const d = el.dataset
    return {
      id: String(d.id), name: d.name, price: Number(d.price) || 0, image: d.image,
      category: d.category || '', stock: Number(d.stock) || 0, rating: d.rating || '4.8'
    }
  }

  /* ---------- badges / counters ---------- */
  function updateBadges (bump) {
    const n = cartQty(), w = getWish().length
    $$('[data-cart-count]').forEach(b => {
      b.textContent = n; b.classList.toggle('show', n > 0)
      if (bump) { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump') }
    })
    $$('[data-wish-count]').forEach(b => { b.textContent = w; b.classList.toggle('show', w > 0) })
    $$('[data-product] [data-wish], [data-wish-btn]').forEach(btn => {
      const host = btn.closest('[data-product],[data-product-page]')
      const on = host && getWish().some(x => x.id === String(host.dataset.id))
      btn.classList.toggle('active', !!on); btn.setAttribute('aria-pressed', !!on)
    })
  }

  /* ---------- cart actions ---------- */
  function addToCart (p, qty = 1, origin) {
    if (!p.stock) return toast('This product is sold out', 'err')
    const cart = getCart(), ex = cart.find(i => i.id === p.id)
    const next = (ex ? ex.qty : 0) + qty
    if (next > p.stock) return toast(`Only ${p.stock} in stock`, 'err')
    if (ex) ex.qty = next
    else cart.push({ id: p.id, name: p.name, price: p.price, image: p.image, category: p.category, stock: p.stock, qty })
    write(KEY.cart, cart)
    flyToCart(origin, p.image)
    updateBadges(true); renderCartViews()
    toast(`${p.name} added to bag`)
  }
  function setQty (id, qty) {
    let cart = getCart(); const it = cart.find(i => i.id === String(id))
    if (!it) return
    if (qty > it.stock) { toast(`Only ${it.stock} in stock`, 'err'); qty = it.stock }
    it.qty = qty
    cart = cart.filter(i => i.qty > 0)
    write(KEY.cart, cart); updateBadges(); renderCartViews()
  }
  const removeItem = id => setQty(id, 0)

  function toggleWish (p, btn) {
    let w = getWish()
    const has = w.some(x => x.id === p.id)
    w = has ? w.filter(x => x.id !== p.id) : [...w, p]
    write(KEY.wish, w)
    if (btn) { btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop') }
    updateBadges()
    toast(has ? 'Removed from wishlist' : 'Saved to wishlist')
    if ($('#wishlist-grid')) renderWishlist()
  }

  function flyToCart (origin, img) {
    const target = $('[data-open-drawer]')
    if (!origin || !target || !img || matchMedia('(prefers-reduced-motion:reduce)').matches) return
    const a = origin.getBoundingClientRect(), b = target.getBoundingClientRect()
    const f = document.createElement('img')
    f.src = img; f.className = 'fly'
    f.style.left = a.left + a.width / 2 - 32 + 'px'; f.style.top = a.top + a.height / 2 - 32 + 'px'
    document.body.appendChild(f)
    requestAnimationFrame(() => {
      f.style.transform = `translate(${b.left + b.width / 2 - a.left - a.width / 2}px,${b.top + b.height / 2 - a.top - a.height / 2}px) scale(.15)`
      f.style.opacity = '.3'
    })
    setTimeout(() => f.remove(), 850)
  }

  /* ---------- renderers ---------- */
  function shipBar (total) {
    const need = CFG.freeShippingFrom || 500, left = need - total
    const pct = Math.min(100, (total / need) * 100)
    return (left > 0
      ? `<i class="bi bi-truck"></i> Add <b>${money(left)}</b> more for <b>free shipping</b>`
      : `<i class="bi bi-stars"></i> You've unlocked <b>free shipping</b>!`) + `<div class="ship-bar"><i style="width:${pct}%"></i></div>`
  }

  const qtyControl = it => `<div class="qty" data-id="${esc(it.id)}"><button type="button" data-dec aria-label="Decrease">−</button><span>${it.qty}</span><button type="button" data-inc aria-label="Increase">+</button></div>`

  function renderDrawer () {
    const box = $('#drawer-items'); if (!box) return
    const cart = getCart()
    $('#drawer-count').textContent = cartQty()
    $('#drawer-total').textContent = money(cartTotal())
    $('#drawer-ship').innerHTML = shipBar(cartTotal())
    box.innerHTML = cart.length ? cart.map(i => `
      <div class="mini-item">
        <a href="${productUrl(i.id)}"><img src="${esc(i.image)}" alt="${esc(i.name)}"></a>
        <div class="flex-grow-1">
          <h6>${esc(i.name)}</h6><div class="text-muted small">${money(i.price)}</div>
          <div class="d-flex justify-content-between align-items-center">${qtyControl(i)}
          <button class="remove-btn" data-remove="${esc(i.id)}" aria-label="Remove"><i class="bi bi-trash3"></i></button></div>
        </div><b>${money(i.price * i.qty)}</b>
      </div>`).join('')
      : `<div class="empty-state"><i class="bi bi-bag"></i><h4>Your bag is empty</h4><p>Looks like you haven't added anything yet.</p><a class="btn-brand" href="${CFG.urls.shop || '#'}">Start shopping</a></div>`
  }

  function renderCartPage () {
    const items = $('#cart-items'); if (!items) return
    const cart = getCart(), sum = $('#cart-summary')
    items.innerHTML = cart.length ? cart.map((i, n) => `
      <div class="cart-row" style="animation-delay:${n * 60}ms">
        <a href="${productUrl(i.id)}"><img src="${esc(i.image)}" alt="${esc(i.name)}"></a>
        <div><div class="p-cat">${esc(i.category)}</div><h5><a href="${productUrl(i.id)}">${esc(i.name)}</a></h5>
          <div class="text-muted small mb-2">${money(i.price)} each</div>
          <div class="d-flex align-items-center gap-3">${qtyControl(i)}<button class="remove-btn" data-remove="${esc(i.id)}"><i class="bi bi-trash3"></i> Remove</button></div></div>
        <div class="line-total">${money(i.price * i.qty)}</div>
      </div>`).join('')
      : `<div class="empty-state panel-card"><i class="bi bi-bag-x"></i><h4>Your bag is empty</h4><p>Find something you'll love in our collection.</p><a class="btn-brand" href="${CFG.urls.shop || '#'}">Start shopping</a></div>`
    if (!sum) return
    const sub = cartTotal(), disc = sub * discountRate(), total = sub - disc
    sum.innerHTML = cart.length ? `
      <div class="summary"><h3>Order summary</h3>
        <div class="drawer-ship rounded-4 my-3">${shipBar(sub)}</div>
        <div class="promo"><input class="form-control" id="promo-input" placeholder="Promo code (try PHLOX10)" value="${esc(read(KEY.promo, ''))}"><button type="button" class="btn-dark-pill" id="promo-apply">Apply</button></div>
        <div class="sum-row"><span>Subtotal</span><b>${money(sub)}</b></div>
        ${disc ? `<div class="sum-row text-success"><span>Discount (10%)</span><b>−${money(disc)}</b></div>` : ''}
        <div class="sum-row"><span>Shipping</span><b>${sub >= (CFG.freeShippingFrom || 500) ? 'Free' : money(15)}</b></div>
        <div class="sum-row total"><span>Total</span><span>${money(total + (sub >= (CFG.freeShippingFrom || 500) ? 0 : 15))}</span></div>
        <a class="btn-brand w-100 mt-3" href="${CFG.urls.checkout || '#'}">Proceed to checkout <i class="bi bi-arrow-right"></i></a>
        <a class="btn-ghost w-100 mt-2" href="${CFG.urls.shop || '#'}">Continue shopping</a></div>` : ''
  }

  function renderCheckout () {
    const box = $('#checkout-summary'); if (!box) return
    const cart = getCart(), sub = cartTotal(), disc = sub * discountRate()
    const ship = sub >= (CFG.freeShippingFrom || 500) || !cart.length ? 0 : 15
    box.innerHTML = (cart.length ? cart.map(i => `
      <div class="co-item"><img src="${esc(i.image)}" alt=""><div>${esc(i.name)}<br><small>Qty ${i.qty}</small></div><b>${money(i.price * i.qty)}</b></div>`).join('')
      : '<p class="text-muted my-3">Your bag is empty. <a href="' + (CFG.urls.shop || '#') + '">Go shopping</a></p>') + `
      <div class="sum-row mt-3"><span>Subtotal</span><b>${money(sub)}</b></div>
      ${disc ? `<div class="sum-row text-success"><span>Discount</span><b>−${money(disc)}</b></div>` : ''}
      <div class="sum-row"><span>Shipping</span><b>${ship ? money(ship) : 'Free'}</b></div>
      <div class="sum-row total"><span>Total</span><span>${money(sub - disc + ship)}</span></div>`
    const hid = $('#cart-json'); if (hid) hid.value = JSON.stringify(cart.map(i => ({ id: i.id, qty: i.qty })))
  }

  function renderWishlist () {
    const g = $('#wishlist-grid'); if (!g) return
    const w = getWish()
    g.innerHTML = w.length ? w.map(p => `
      <div class="col-6 col-md-4 col-xl-3"><article class="p-card in" data-product data-id="${esc(p.id)}" data-name="${esc(p.name)}" data-price="${p.price}" data-image="${esc(p.image)}" data-category="${esc(p.category)}" data-stock="${p.stock}" data-rating="${esc(p.rating || '4.8')}">
        <div class="p-media"><a class="p-link" href="${productUrl(p.id)}"><img src="${esc(p.image)}" alt="${esc(p.name)}"></a>
          <button class="p-wish active" data-wish aria-label="Remove"><i class="bi bi-heart-fill"></i></button>
          ${p.stock ? '<button class="p-quick" data-add-to-cart><i class="bi bi-bag-plus"></i> Quick add</button>' : ''}</div>
        <div class="p-body"><div class="p-cat">${esc(p.category)}</div><h3 class="p-title"><a href="${productUrl(p.id)}">${esc(p.name)}</a></h3>
          <div class="p-meta"><div class="p-price">${money(p.price)}</div><div class="p-rate"><i class="bi bi-star-fill"></i> ${esc(p.rating || '4.8')}</div></div></div></article></div>`).join('')
      : `<div class="col-12"><div class="empty-state panel-card"><i class="bi bi-heart"></i><h4>Your wishlist is empty</h4><p>Tap the heart on any product to save it here.</p><a class="btn-brand" href="${CFG.urls.shop || '#'}">Browse products</a></div></div>`
    updateBadges()
  }

  function renderCartViews () { renderDrawer(); renderCartPage(); renderCheckout() }

  /* ---------- delegated clicks ---------- */
  document.addEventListener('click', e => {
    const t = e.target
    const addBtn = t.closest('[data-add-to-cart]')
    if (addBtn) {
      e.preventDefault()
      const host = addBtn.closest('[data-product],[data-product-page]')
      if (host) {
        const qtyEl = $('#pd-qty'), q = host.matches('[data-product-page]') && qtyEl ? Number(qtyEl.value) || 1 : 1
        addToCart(readProduct(host), q, addBtn)
      }
      return
    }
    const w = t.closest('[data-wish],[data-wish-btn]')
    if (w) {
      e.preventDefault()
      const host = w.closest('[data-product],[data-product-page]')
      if (host) toggleWish(readProduct(host), w)
      return
    }
    const q = t.closest('.qty[data-id]')
    if (q) {
      const id = q.dataset.id, it = getCart().find(i => i.id === id)
      if (it && t.closest('[data-inc]')) setQty(id, it.qty + 1)
      if (it && t.closest('[data-dec]')) setQty(id, it.qty - 1)
      return
    }
    const rm = t.closest('[data-remove]'); if (rm) return removeItem(rm.dataset.remove)
    if (t.closest('[data-open-drawer]')) return openDrawer()
    if (t.closest('[data-close-drawer]') || t.id === 'drawer-backdrop') return closeDrawer()
    if (t.closest('[data-open-search]')) return openSearch()
    if (t.closest('[data-close-search]')) return closeSearch()
    if (t.closest('#promo-apply')) {
      const v = ($('#promo-input').value || '').trim().toUpperCase()
      if (v === 'PHLOX10') { write(KEY.promo, v); toast('Promo applied: 10% off') }
      else { write(KEY.promo, ''); toast('Invalid promo code', 'err') }
      return renderCartViews()
    }
  })
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeDrawer(); closeSearch(); closeMenu(); closeFilters() } })

  /* ---------- drawer / search / menu ---------- */
  function openDrawer () { renderDrawer(); $('#cart-drawer').classList.add('open'); $('#drawer-backdrop').classList.add('open'); $('#cart-drawer').setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden' }
  function closeDrawer () { $('#cart-drawer')?.classList.remove('open'); $('#drawer-backdrop')?.classList.remove('open'); $('#cart-drawer')?.setAttribute('aria-hidden', 'true'); document.body.style.overflow = '' }
  function openSearch () { const o = $('#search-overlay'); o.classList.add('open'); o.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden'; setTimeout(() => $('#search-input').focus(), 250); suggest('') }
  function closeSearch () { const o = $('#search-overlay'); if (!o) return; o.classList.remove('open'); o.setAttribute('aria-hidden', 'true'); document.body.style.overflow = '' }
  function suggest (q) {
    const box = $('#search-suggest'); if (!box) return
    let list = []
    const cards = $$('[data-product]')
    const src = window.PRODUCTS && window.PRODUCTS.length ? window.PRODUCTS : cards.map(c => ({ ...readProduct(c), id: c.dataset.id }))
    q = q.trim().toLowerCase()
    list = src.filter(p => !q || (p.name + ' ' + p.category).toLowerCase().includes(q)).slice(0, 5)
    box.innerHTML = list.length ? list.map(p => `<a class="suggest-item" href="${productUrl(p.id)}"><img src="${esc(p.image)}" alt=""><div>${esc(p.name)}<br><small>${esc(p.category)}</small></div><b>${money(p.price)}</b></a>`).join('')
      : '<p class="text-center" style="color:#9c94b8">No matches — press Enter to search the shop.</p>'
  }
  const openMenu = () => { $('#nav-links').classList.add('open'); $('#burger').setAttribute('aria-expanded', 'true'); $('#drawer-backdrop').classList.add('open') }
  function closeMenu () { $('#nav-links')?.classList.remove('open'); $('#burger')?.setAttribute('aria-expanded', 'false'); if (!$('#cart-drawer.open')) $('#drawer-backdrop')?.classList.remove('open') }

  /* ---------- shop page: filters, search, sort, view ---------- */
  function closeFilters () { $('#filters')?.classList.remove('open'); if (!$('#cart-drawer.open') && !$('#nav-links.open')) $('#drawer-backdrop')?.classList.remove('open') }
  function initShop () {
    const grid = $('#shop-grid'); if (!grid) return
    const cols = () => $$('#shop-grid > [class*=col-]')
    const items = cols().map(col => ({ col, ...readProduct($('[data-product]', col)) }))
    const params = new URLSearchParams(location.search)
    const st = { q: params.get('q') || '', cat: params.get('category') || '', max: 0, sort: 'featured' }
    const maxPrice = Math.max(...items.map(i => i.price), 100)
    const range = $('#f-price'), out = $('#f-price-out')
    if (range) { range.max = Math.ceil(maxPrice / 10) * 10; range.value = range.max; st.max = Number(range.max) }
    const catBox = $('#f-cats')
    if (catBox) {
      const cats = [...new Set(items.map(i => i.category))].sort()
      catBox.innerHTML = `<button class="f-cat" data-cat="">All products <span>${items.length}</span></button>` +
        cats.map(c => `<button class="f-cat" data-cat="${esc(c)}">${esc(c)} <span>${items.filter(i => i.category === c).length}</span></button>`).join('')
    }
    const si = $('#shop-search'); if (si) si.value = st.q
    const apply = () => {
      let shown = items.filter(i => (!st.q || (i.name + ' ' + i.category).toLowerCase().includes(st.q.toLowerCase())) && (!st.cat || i.category === st.cat) && i.price <= st.max)
      if (st.sort === 'low') shown.sort((a, b) => a.price - b.price)
      if (st.sort === 'high') shown.sort((a, b) => b.price - a.price)
      if (st.sort === 'name') shown.sort((a, b) => a.name.localeCompare(b.name))
      items.forEach(i => i.col.classList.add('col-hide'))
      shown.forEach(i => { i.col.classList.remove('col-hide'); grid.appendChild(i.col) })
      $('#result-count').textContent = `${shown.length} product${shown.length === 1 ? '' : 's'}`
      $('#no-results').classList.toggle('show', !shown.length)
      $$('.f-cat').forEach(b => b.classList.toggle('active', b.dataset.cat === st.cat))
      if (out) out.textContent = money(st.max).replace('.00', '')
    }
    $('#shop-search')?.addEventListener('input', debounce(e => { st.q = e.target.value; apply() }))
    $('#shop-sort')?.addEventListener('change', e => { st.sort = e.target.value; apply() })
    range?.addEventListener('input', e => { st.max = Number(e.target.value); apply() })
    catBox?.addEventListener('click', e => { const b = e.target.closest('.f-cat'); if (b) { st.cat = b.dataset.cat; apply(); closeFilters() } })
    $('#clear-filters')?.addEventListener('click', () => { st.q = ''; st.cat = ''; st.max = Number(range.max); range.value = range.max; if (si) si.value = ''; apply() })
    $$('.view-toggle button').forEach(b => b.addEventListener('click', () => {
      $$('.view-toggle button').forEach(x => x.classList.toggle('active', x === b)); grid.classList.toggle('list-view', b.dataset.view === 'list')
    }))
    $('#open-filters')?.addEventListener('click', () => { $('#filters').classList.add('open'); $('#drawer-backdrop').classList.add('open') })
    $('#close-filters')?.addEventListener('click', closeFilters)
    apply()
  }

  /* ---------- product page ---------- */
  function initProductPage () {
    const page = $('[data-product-page]'); if (!page) return
    const id = new URLSearchParams(location.search).get('id')
    // DEMO hydration — only when the page is flagged data-demo (remove when Django renders the product)
    if (page.dataset.demo === 'true' && id && window.PRODUCTS) {
      const p = window.PRODUCTS.find(x => String(x.id) === String(id))
      if (p) {
        Object.assign(page.dataset, { id: p.id, name: p.name, price: p.price, image: p.image, category: p.category, stock: p.stock, rating: p.rating })
        $$('[data-bind="name"]').forEach(e => (e.textContent = p.name))
        $$('[data-bind="category"]').forEach(e => (e.textContent = p.category))
        $$('[data-bind="price"]').forEach(e => (e.textContent = money(p.price)))
        $$('[data-bind="description"]').forEach(e => (e.textContent = p.description))
        $$('[data-bind="stock"]').forEach(e => (e.textContent = p.stock ? `${p.stock} in stock — ships within 24h` : 'Out of stock'))
        const old = $('[data-bind="old"]'); if (old) old.textContent = p.oldPrice ? money(p.oldPrice) : ''
        const save = $('[data-bind="save"]'); if (save) save.textContent = p.oldPrice ? `Save ${Math.round((1 - p.price / p.oldPrice) * 100)}%` : ''
        $$('[data-gallery-img]').forEach(img => { img.src = p.image; img.alt = p.name })
        document.title = p.name + ' — PHLOX'
        $$('[data-bind="crumb"]').forEach(e => (e.textContent = p.name))
      }
    }
    // gallery
    const main = $('#g-main-img'), wrap = $('#g-main')
    $$('.g-thumb').forEach(t => t.addEventListener('click', () => {
      $$('.g-thumb').forEach(x => x.classList.toggle('active', x === t))
      main.style.opacity = 0; setTimeout(() => { main.src = $('img', t).src; main.style.opacity = 1 }, 140)
    }))
    if (wrap) {
      wrap.addEventListener('click', () => wrap.classList.toggle('zoom'))
      wrap.addEventListener('mousemove', e => { if (!wrap.classList.contains('zoom')) return; const r = wrap.getBoundingClientRect(); main.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%` })
      wrap.addEventListener('mouseleave', () => wrap.classList.remove('zoom'))
    }
    // qty
    const qi = $('#pd-qty')
    $('#pd-minus')?.addEventListener('click', () => (qi.value = Math.max(1, Number(qi.value) - 1)))
    $('#pd-plus')?.addEventListener('click', () => (qi.value = Math.min(Number(page.dataset.stock) || 99, Number(qi.value) + 1)))
    // tabs
    $$('.tab-nav button').forEach(b => b.addEventListener('click', () => {
      $$('.tab-nav button').forEach(x => x.classList.toggle('active', x === b))
      $$('.tab-pane').forEach(p => p.classList.toggle('active', p.id === b.dataset.tab))
    }))
    // sticky buy bar (mobile)
    const sticky = $('#sticky-buy'), buy = $('#buy-row')
    if (sticky && buy && 'IntersectionObserver' in window) new IntersectionObserver(([en]) => sticky.classList.toggle('show', !en.isIntersecting && en.boundingClientRect.top < 0)).observe(buy)
  }

  /* ---------- forms ---------- */
  function initForms () {
    $$('form[data-demo="true"]').forEach(f => f.addEventListener('submit', e => {
      e.preventDefault()
      if (!f.checkValidity()) { f.reportValidity(); return }
      const btn = f.querySelector('button[type=submit],button:not([type])'); const old = btn?.innerHTML
      if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>' }
      setTimeout(() => {
        if (btn) { btn.disabled = false; btn.innerHTML = old }
        const kind = f.dataset.kind || f.id
        if (kind === 'checkout-form') {
          if (!getCart().length) return toast('Your bag is empty', 'err')
          write(KEY.order, 'PX-' + Date.now().toString().slice(-7)); write(KEY.cart, []); write(KEY.promo, '')
          location.href = CFG.urls.success || '/order-success/'
        } else if (kind === 'login-form') { toast('Demo mode: connect this form to Django login'); }
        else if (kind === 'register-form') { toast('Demo mode: connect this form to Django registration') }
        else if (kind === 'contact-form') { f.reset(); toast('Message sent — we will reply within 24h') }
        else { f.reset(); toast('Thank you for subscribing!') }
      }, 700)
    }))
    $$('[data-pw-toggle]').forEach(b => b.addEventListener('click', () => {
      const i = b.parentElement.querySelector('input'); const show = i.type === 'password'
      i.type = show ? 'text' : 'password'; b.innerHTML = `<i class="bi bi-eye${show ? '-slash' : ''}"></i>`
    }))
    const pw = $('#pw-strength-input'), meter = $('#pw-meter')
    pw?.addEventListener('input', () => {
      const v = pw.value; let s = 0
      if (v.length >= 8) s++; if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++; if (/\d/.test(v)) s++; if (/[^A-Za-z0-9]/.test(v)) s++
      meter.dataset.level = v ? s : 0
    })
    const ref = $('#order-reference'); if (ref && !ref.textContent.trim()) ref.textContent = 'Order ' + read(KEY.order, 'PX-' + Date.now().toString().slice(-7))
  }

  /* ---------- visual effects ---------- */
  function initEffects () {
    const header = $('#site-header'), top = $('#to-top')
    const onScroll = () => { const y = scrollY; header?.classList.toggle('scrolled', y > 24); top?.classList.toggle('show', y > 700) }
    addEventListener('scroll', onScroll, { passive: true }); onScroll()
    top?.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }))
    $('#burger')?.addEventListener('click', () => ($('#nav-links').classList.contains('open') ? closeMenu() : openMenu()))
    $('#drawer-backdrop')?.addEventListener('click', () => { closeMenu(); closeFilters() })
    $('#search-input')?.addEventListener('input', debounce(e => suggest(e.target.value), 120))

    // scroll reveal
    const rv = $$('.reveal')
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(en => en.forEach(x => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target) } }), { threshold: .12, rootMargin: '0px 0px -40px 0px' })
      rv.forEach(el => io.observe(el))
      new MutationObserver(m => m.forEach(r => r.addedNodes.forEach(n => { if (n.nodeType === 1) { $$('.reveal', n).concat(n.matches?.('.reveal') ? [n] : []).forEach(el => io.observe(el)) } }))).observe(document.body, { childList: true, subtree: true })
    } else rv.forEach(el => el.classList.add('in'))

    // hero 3D tilt
    const hv = $('.hero-visual'), hc = $('.hero-card')
    if (hv && hc && matchMedia('(hover:hover)').matches) {
      hv.addEventListener('mousemove', e => { const r = hv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; hc.style.transform = `rotateY(${x * 14}deg) rotateX(${-y * 12}deg)` })
      hv.addEventListener('mouseleave', () => (hc.style.transform = ''))
    }
    // count-up
    $$('[data-count]').forEach(el => {
      const end = Number(el.dataset.count), suf = el.dataset.suffix || '', dec = Number(el.dataset.dec || 0)
      new IntersectionObserver(([en], ob) => {
        if (!en.isIntersecting) return; ob.disconnect()
        const t0 = performance.now(), dur = 1600
        const step = t => { const p = Math.min(1, (t - t0) / dur), v = end * (1 - Math.pow(1 - p, 3)); el.textContent = v.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + suf; if (p < 1) requestAnimationFrame(step) }
        requestAnimationFrame(step)
      }).observe(el)
    })
    // countdown (rolling 9-day sale so it never shows "0")
    const cd = $('[data-countdown]')
    if (cd) {
      let end = read('phlox_sale_end', 0)
      if (end < Date.now()) { end = Date.now() + 9 * 864e5 + 5 * 36e5; write('phlox_sale_end', end) }
      const tick = () => {
        let d = Math.max(0, end - Date.now()); const parts = { d: Math.floor(d / 864e5), h: Math.floor(d / 36e5) % 24, m: Math.floor(d / 6e4) % 60, s: Math.floor(d / 1e3) % 60 }
        Object.entries(parts).forEach(([k, v]) => { const e = $(`[data-cd="${k}"]`, cd); if (e) e.textContent = String(v).padStart(2, '0') })
      }
      tick(); setInterval(tick, 1000)
    }
    // confetti on success
    if ($('#confetti-trigger') && !matchMedia('(prefers-reduced-motion:reduce)').matches) {
      const cols = ['#7c3aed', '#ec4899', '#f59e0b', '#16a34a', '#3b82f6']
      for (let i = 0; i < 70; i++) {
        const c = document.createElement('i'); c.className = 'confetti'
        c.style.cssText = `left:${Math.random() * 100}vw;background:${cols[i % 5]};animation-duration:${2.4 + Math.random() * 2.2}s;animation-delay:${Math.random() * .8}s;border-radius:${Math.random() > .5 ? '50%' : '2px'}`
        document.body.appendChild(c); setTimeout(() => c.remove(), 5500)
      }
    }
    // Django messages -> toast
    $$('#django-messages span').forEach((s, i) => setTimeout(() => toast(s.textContent, /error|danger/.test(s.dataset.level) ? 'err' : 'ok'), 400 + i * 600))
  }

  /* ---------- boot ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    updateBadges(); renderCartViews(); renderWishlist()
    initShop(); initProductPage(); initForms(); initEffects()
    updateBadges()
  })
  addEventListener('storage', () => { updateBadges(); renderCartViews() })
})()
