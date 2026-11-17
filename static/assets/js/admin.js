const $ = s => document.querySelector(s),
  $$ = s => [...document.querySelectorAll(s)]
const esc = s =>
  String(s ?? '').replace(
    /[&<>"']/g,
    c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[
        c
      ])
  )
const usd = n =>
  '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })
const date = s => (s ? new Date(s).toLocaleString() : '—')
const CFG = window.PHLOX_ADMIN || { api: '/api', demo: false, login: '/login/' }
const api = async (path, opt = {}) => {
  if (CFG.demo && window.PHLOX_DEMO_API) return window.PHLOX_DEMO_API(path, opt)
  let r = await fetch(CFG.api + path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...opt
  })
  let d = await r.json().catch(() => ({}))
  if (!r.ok) throw Error(d.detail || 'Request failed')
  return d
}
const patch = (path, obj) =>
  api(path, { method: 'PATCH', body: JSON.stringify(obj) })
const state = {
  tab: 'overview',
  charts: [],
  customers: [],
  orders: [],
  products: []
}
const empty = t =>
  `<div class="empty"><i class="bi bi-inbox fs-3 d-block mb-2"></i>${esc(
    t
  )}</div>`
const pill = v =>
  `<span class="pill ${
    ['buyer', 'delivered', 'paid'].includes(v)
      ? 'buyer'
      : ['new', 'unpaid', 'nonbuyer'].includes(v)
      ? 'nonbuyer'
      : esc(v)
  }">${esc(v)}</span>`
const table = (heads, rows) =>
  `<table class="table table-hover"><thead><tr>${heads
    .map(x => `<th>${esc(x)}</th>`)
    .join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`
function notify (t, bad = false) {
  $('#adminAlert').innerHTML = `<div class="alert ${
    bad ? 'alert-danger' : 'alert-success'
  }">${esc(t)}</div>`
  setTimeout(() => $('#adminAlert').replaceChildren(), 4000)
}
function modal (title, body) {
  $('#modalTitle').textContent = title
  $('#modalBody').innerHTML = body
  bootstrap.Modal.getOrCreateInstance($('#detailModal')).show()
}
function closeModal () {
  bootstrap.Modal.getOrCreateInstance($('#detailModal')).hide()
}
function navigate (tab) {
  state.tab = tab
  $$('.dash-tab').forEach(x =>
    x.classList.toggle('hidden', x.id !== 'tab-' + tab)
  )
  $$('.side-link').forEach(x =>
    x.classList.toggle('active', x.dataset.tab === tab)
  )
  let t = $(`[data-tab="${tab}"] span`)?.textContent || tab
  $('#currentTitle').textContent = t
  $('#pageTitle').textContent = t
  $('#pageDescription').textContent = {
    overview: 'Monitor your store, customers and orders in one place.',
    customers: 'Understand your customers and their purchase history.',
    orders: 'Every order, payment and fulfillment stage.',
    products: 'Your entire product catalog and inventory.',
    activity: 'Customer journeys and administrative actions.',
    messages: 'Support requests and newsletter signups.',
    reports: 'Export data for your team.'
  }[tab]
  $('#mobileMenu')
    .closest('.admin-layout')
    .querySelector('.admin-sidebar')
    .classList.remove('open')
  load(tab)
}
async function load (tab = state.tab) {
  try {
    if (tab === 'overview') await overview()
    if (tab === 'customers') await customers()
    if (tab === 'orders') await orders()
    if (tab === 'products') await products()
    if (tab === 'activity') await activity()
    if (tab === 'messages') await messages()
  } catch (e) {
    notify(e.message, true)
  }
}
function metric (label, value, icon, hint) {
  return `<div class="metric"><div class="metric-top"><span>${label}</span><i class="bi bi-${icon}"></i></div><strong>${value}</strong><small>${hint}</small></div>`
}
function destroyCharts () {
  state.charts.forEach(x => x.destroy())
  state.charts = []
}
async function overview () {
  const d = await api('/admin/overview?days=' + $('#period').value),
    m = d.metrics
  $('#metrics').innerHTML = [
    metric('Revenue', usd(m.revenue), 'cash-stack', 'Excluding cancelled'),
    metric('Orders', m.orders, 'bag-check', 'Selected period'),
    metric('Registered customers', m.customers, 'people', 'All time'),
    metric('Customers who bought', m.buyers, 'person-check', 'All time'),
    metric('Never ordered', m.non_buyers, 'person-x', 'Registered customers'),
    metric(
      'Average order',
      usd(m.aov),
      'graph-up-arrow',
      'Non-cancelled orders'
    ),
    metric('Pending orders', m.pending_orders, 'hourglass-split', 'New status'),
    metric(
      'Low / out of stock',
      m.low_stock + ' / ' + m.out_of_stock,
      'exclamation-triangle',
      'Restock required'
    ),
    metric('Logins', m.login_events, 'box-arrow-in-right', 'Selected period'),
    metric(
      'Active users (7d)',
      m.active_users_7d,
      'person-heart',
      'Last login'
    ),
    metric(
      'Abandoned carts',
      m.abandoned_carts,
      'cart-x',
      'Older than 24 hours'
    ),
    metric('Recorded visitors', m.visitors, 'eye', 'Based on tracked visitors')
  ].join('')
  destroyCharts()
  if (window.Chart) {
    state.charts.push(
      new Chart($('#revenueChart'), {
        type: 'line',
        data: {
          labels: d.trend.map(x => x.date),
          datasets: [
            {
              label: 'Revenue ($)',
              data: d.trend.map(x => x.revenue),
              borderColor: '#7c3aed',
              backgroundColor: 'rgba(124,58,237,.1)',
              fill: true,
              tension: 0.4,
              pointRadius: 3
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true } }
        }
      })
    )
    state.charts.push(
      new Chart($('#statusChart'), {
        type: 'doughnut',
        data: {
          labels: d.statuses.map(x => x.status),
          datasets: [
            {
              data: d.statuses.map(x => x.count),
              backgroundColor: [
                '#7c3aed',
                '#262a32',
                '#f8b349',
                '#4fc69c',
                '#8c96e8',
                '#e8e9ed'
              ]
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '72%',
          plugins: { legend: { position: 'bottom' } }
        }
      })
    )
  }
  let mx = Math.max(1, ...d.funnel.map(x => x.value))
  $('#funnel').innerHTML = d.funnel
    .map(
      x =>
        `<div class="mb-3"><div class="d-flex justify-content-between small mb-2"><b>${esc(
          x.name.replaceAll('_', ' ')
        )}</b><span>${
          x.value
        }</span></div><div class="progress"><div class="progress-bar" style="width:${
          (x.value / mx) * 100
        }%"></div></div></div>`
    )
    .join('')
  $('#topProducts').innerHTML = d.top_products.length
    ? d.top_products
        .map(
          x =>
            `<div class="line-item"><span>${esc(x.name)}</span><b>${
              x.units
            } sold · ${usd(x.revenue)}</b></div>`
        )
        .join('')
    : empty('No sales in this period')
  $('#recentOrders').innerHTML = d.recent_orders.length
    ? table(
        ['Reference', 'Customer', 'Amount', 'Status', 'Created'],
        d.recent_orders.map(
          x =>
            `<tr><td><b>${esc(x.reference)}</b></td><td>${esc(
              x.name
            )}</td><td>${usd(x.total)}</td><td>${pill(x.status)}</td><td>${date(
              x.created_at
            )}</td></tr>`
        )
      )
    : empty('No orders yet')
}
async function customers () {
  let d = await api(
    '/admin/customers?search=' +
      encodeURIComponent($('#customerSearch').value) +
      '&segment=' +
      $('#customerSegment').value
  )
  state.customers = d.items
  $('#customerCount').textContent = d.items.length + ' customers'
  $('#customersTable').innerHTML = d.items.length
    ? table(
        [
          'Customer',
          'Registration',
          'Last login',
          'Logins',
          'Orders',
          'Spent',
          'Cart',
          'Segment',
          'Action'
        ],
        d.items.map(
          x =>
            `<tr><td><b>${esc(x.name)}</b><div class="muted">${esc(
              x.email
            )}</div></td><td>${date(x.created_at)}</td><td>${date(
              x.last_login
            )}</td><td>${x.login_count}</td><td>${
              x.order_count
            }</td><td><b>${usd(x.spent)}</b></td><td>${x.cart_qty}${
              x.abandoned ? ' ⚠️' : ''
            }</td><td>${pill(
              x.order_count ? 'buyer' : 'nonbuyer'
            )}</td><td><button class="table-action" data-customer="${
              x.id
            }">View profile</button></td></tr>`
        )
      )
    : empty('No customers match this filter')
}
async function customerDetail (id) {
  let x = await api('/admin/customers/' + id)
  modal(
    'Customer · ' + x.name,
    `<div class="detail-grid"><div><label>Email</label><b>${esc(
      x.email
    )}</b></div><div><label>Registered</label><b>${date(
      x.created_at
    )}</b></div><div><label>Last login</label><b>${date(
      x.last_login
    )}</b></div><div><label>Login count</label><b>${
      x.login_count
    }</b></div></div><hr><h6>Order history (${x.orders.length})</h6>${
      x.orders.length
        ? x.orders
            .map(
              o =>
                `<div class="line-item"><span>${esc(o.reference)} · ${pill(
                  o.status
                )}</span><b>${usd(o.total)}</b></div>`
            )
            .join('')
        : empty('Customer has never ordered')
    }<h6 class="mt-4">Current cart</h6>${
      x.cart.length
        ? x.cart
            .map(
              c =>
                `<div class="line-item"><span>${esc(c.name)}</span><b>× ${
                  c.qty
                }</b></div>`
            )
            .join('')
        : empty('Cart is empty')
    }<h6 class="mt-4">Recent events</h6>${
      x.events.length
        ? x.events
            .slice(0, 12)
            .map(
              e =>
                `<div class="line-item"><span>${esc(e.event)} · ${esc(
                  e.detail
                )}</span><small>${date(e.created_at)}</small></div>`
            )
            .join('')
        : empty('No events')
    }<hr><label class="form-label">Internal customer notes</label><textarea id="customerNotes" class="form-control" rows="3">${esc(
      x.notes || ''
    )}</textarea><label class="d-flex gap-2 align-items-center my-3"><input id="customerActive" type="checkbox" ${
      x.is_active ? 'checked' : ''
    }> Account active</label><button class="primary-btn" id="saveCustomer" data-id="${id}">Save changes</button>`
  )
}
async function orders () {
  let d = await api(
    '/admin/orders?search=' +
      encodeURIComponent($('#orderSearch').value) +
      '&status=' +
      $('#orderStatus').value
  )
  state.orders = d.items
  $('#orderCount').textContent = d.items.length + ' orders'
  $('#ordersTable').innerHTML = d.items.length
    ? table(
        [
          'Order',
          'Customer',
          'Total',
          'Fulfillment',
          'Payment',
          'Date',
          'Details'
        ],
        d.items.map(
          x =>
            `<tr><td><b>${esc(x.reference)}</b></td><td>${esc(
              x.name
            )}<div class="muted">${esc(x.email)}</div></td><td>${usd(
              x.total
            )}</td><td>${pill(x.status)}</td><td>${pill(
              x.payment_status
            )}</td><td>${date(
              x.created_at
            )}</td><td><button class="table-action" data-order="${
              x.id
            }">Manage</button></td></tr>`
        )
      )
    : empty('No orders match')
}
function orderDetail (id) {
  let x = state.orders.find(x => x.id === id)
  if (!x) return
  modal(
    'Order · ' + x.reference,
    `<div class="detail-grid"><div><label>Customer</label><b>${esc(
      x.name
    )} (${esc(x.email)})</b></div><div><label>Placed</label><b>${date(
      x.created_at
    )}</b></div><div><label>Shipping</label><b>${esc(x.address)}, ${esc(
      x.city
    )} ${esc(x.postal_code)}</b></div><div><label>Total</label><b>${usd(
      x.total
    )}</b></div></div><hr><h6>Purchased items</h6>${x.items
      .map(
        i =>
          `<div class="line-item"><span>${esc(i.name)} × ${
            i.qty
          }</span><b>${usd(i.price * i.qty)}</b></div>`
      )
      .join(
        ''
      )}<hr><div class="detail-grid"><div><label>Order status</label><select id="editOrderStatus" class="form-select">${[
      'new',
      'confirmed',
      'processing',
      'shipped',
      'delivered',
      'cancelled'
    ]
      .map(s => `<option ${x.status === s ? 'selected' : ''}>${s}</option>`)
      .join(
        ''
      )}</select></div><div><label>Payment status</label><select id="editPayment" class="form-select">${[
      'unpaid',
      'paid',
      'refunded'
    ]
      .map(
        s => `<option ${x.payment_status === s ? 'selected' : ''}>${s}</option>`
      )
      .join(
        ''
      )}</select></div></div><label class="form-label mt-3">Admin note</label><textarea id="orderNote" class="form-control">${esc(
      x.admin_note || ''
    )}</textarea><p class="muted mt-3">Cancelling restores stock. Reopening a cancelled order requires available stock. Mark paid only after verifying payment externally.</p><button class="primary-btn mt-2" data-save-order="${id}">Save order</button>`
  )
}
async function products () {
  let d = await api('/admin/products')
  state.products = d.items
  let q = $('#productSearch').value.toLowerCase(),
    f = $('#productFilter').value
  let a = d.items.filter(
    x =>
      x.name.toLowerCase().includes(q) &&
      (f === 'all' ||
        (f === 'low' && x.stock > 0 && x.stock <= 5) ||
        (f === 'out' && x.stock === 0) ||
        (f === 'hidden' && !x.active))
  )
  $('#productsTable').innerHTML = a.length
    ? table(
        ['Product', 'Category', 'Price', 'Stock', 'Visibility', 'Actions'],
        a.map(
          x =>
            `<tr><td><img class="mini-product" src="${esc(
              x.image
            )}" alt=""><b>${esc(x.name)}</b></td><td>${esc(
              x.category
            )}</td><td>${usd(x.price)}</td><td>${
              x.stock === 0 ? pill('out') : x.stock <= 5 ? pill('low') : x.stock
            }</td><td>${
              x.active ? pill('buyer') : pill('hidden')
            }</td><td><button class="table-action" data-product="${
              x.id
            }">Edit</button></td></tr>`
        )
      )
    : empty('No products match')
}
function productDetail (id) {
  let x = state.products.find(x => x.id === id) || {
    name: '',
    category: 'Audio',
    price: '',
    stock: 0,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e',
    description: '',
    active: 1
  }
  modal(
    id ? 'Edit product' : 'Add product',
    `<form id="productForm" data-id="${
      id || ''
    }"><div class="detail-grid"><div><label>Name</label><input name="name" required class="form-control" value="${esc(
      x.name
    )}"></div><div><label>Category</label><input name="category" required class="form-control" value="${esc(
      x.category
    )}"></div><div><label>Price ($)</label><input name="price" type="number" step="0.01" min="0.01" required class="form-control" value="${
      x.price
    }"></div><div><label>Stock</label><input name="stock" type="number" min="0" required class="form-control" value="${
      x.stock
    }"></div></div><label class="form-label mt-3">Image URL</label><input name="image" required class="form-control" value="${esc(
      x.image
    )}"><label class="form-label mt-3">Description</label><textarea name="description" class="form-control" rows="3">${esc(
      x.description || ''
    )}</textarea><label class="d-flex gap-2 align-items-center my-3"><input name="active" type="checkbox" ${
      x.active ? 'checked' : ''
    }> Visible in storefront</label><button class="primary-btn">Save product</button></form>`
  )
}
async function activity () {
  let d = await api('/admin/activity')
  $('#eventList').innerHTML = d.events.length
    ? d.events
        .map(
          x =>
            `<div class="timeline-item"><b>${esc(x.event)}</b> · ${esc(
              x.name || 'Guest'
            )}<div class="muted">${esc(x.detail || '')}</div><small>${date(
              x.created_at
            )}</small></div>`
        )
        .join('')
    : empty('No events')
  $('#auditList').innerHTML = d.audit.length
    ? d.audit
        .map(
          x =>
            `<div class="timeline-item"><b>${esc(x.action)}</b> · ${esc(
              x.actor || 'System'
            )}<div class="muted">${esc(x.target || '')}</div><small>${date(
              x.created_at
            )}</small></div>`
        )
        .join('')
    : empty('No admin changes')
}
async function messages () {
  let d = await api('/admin/messages')
  $('#messagesList').innerHTML = d.items.length
    ? d.items
        .map(
          x =>
            `<div class="timeline-item"><div class="d-flex justify-content-between"><b>${esc(
              x.subject || 'Customer message'
            )}</b>${pill(x.status)}</div><div>${esc(x.name)} · ${esc(
              x.email
            )}</div><p class="mt-2">${esc(x.message)}</p><small>${date(
              x.created_at
            )}</small>${
              x.status !== 'read'
                ? `<button class="table-action mt-2" data-read="${x.id}">Mark read</button>`
                : ''
            }</div>`
        )
        .join('')
    : empty('No messages')
  $('#subscriberList').innerHTML = d.subscribers.length
    ? d.subscribers
        .map(
          x =>
            `<div class="line-item"><span>${esc(x.email)}</span><small>${date(
              x.created_at
            )}</small></div>`
        )
        .join('')
    : empty('No subscribers')
}
let debounce
document.addEventListener('input', e => {
  if (
    ['customerSearch', 'orderSearch', 'productSearch'].includes(e.target.id)
  ) {
    clearTimeout(debounce)
    debounce = setTimeout(() => load(), 300)
  }
})
document.addEventListener('change', e => {
  if (
    ['period', 'customerSegment', 'orderStatus', 'productFilter'].includes(
      e.target.id
    )
  )
    load()
})
document.addEventListener('click', async e => {
  let b = e.target.closest('button')
  if (!b) return
  try {
    if (b.dataset.tab) navigate(b.dataset.tab)
    else if (b.dataset.goto) navigate(b.dataset.goto)
    else if (b.id === 'refresh') await load()
    else if (b.id === 'mobileMenu') $('.admin-sidebar').classList.toggle('open')
    else if (b.dataset.customer)
      await customerDetail(Number(b.dataset.customer))
    else if (b.dataset.order) orderDetail(Number(b.dataset.order))
    else if (b.dataset.product) productDetail(Number(b.dataset.product))
    else if (b.id === 'newProduct') productDetail(null)
    else if (b.dataset.export)
      CFG.demo ? window.PHLOX_DEMO_EXPORT(b.dataset.export) : (location.href = CFG.api + '/admin/export/' + b.dataset.export)
    else if (b.id === 'saveCustomer') {
      await patch('/admin/customers/' + b.dataset.id, {
        notes: $('#customerNotes').value,
        is_active: $('#customerActive').checked
      })
      closeModal()
      notify('Customer updated')
      await customers()
    } else if (b.dataset.saveOrder) {
      await patch('/admin/orders/' + b.dataset.saveOrder, {
        status: $('#editOrderStatus').value,
        payment_status: $('#editPayment').value,
        admin_note: $('#orderNote').value
      })
      closeModal()
      notify('Order updated')
      await orders()
    } else if (b.dataset.read) {
      await patch('/admin/messages/' + b.dataset.read, {})
      notify('Message marked read')
      await messages()
    }
  } catch (err) {
    notify(err.message, true)
  }
})
document.addEventListener('submit', async e => {
  if (e.target.id !== 'productForm') return
  e.preventDefault()
  let f = new FormData(e.target),
    id = e.target.dataset.id
  let payload = {
    name: f.get('name'),
    category: f.get('category'),
    price: Number(f.get('price')),
    stock: Number(f.get('stock')),
    image: f.get('image'),
    description: f.get('description'),
    active: f.has('active')
  }
  try {
    await api('/admin/products' + (id ? '/' + id : ''), {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    })
    closeModal()
    notify('Product saved')
    await products()
  } catch (err) {
    notify(err.message, true)
  }
})
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const d = await api('/me')
    if (!d.user || d.user.role !== 'admin') return location.replace(CFG.login)
    await overview()
  } catch (e) {
    if (CFG.demo) return notify(e.message, true)
    location.replace(CFG.login)
  }
})
