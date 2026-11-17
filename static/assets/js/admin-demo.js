/* Demo data for the dashboard so it works BEFORE your Django API exists.
   Active only when window.PHLOX_ADMIN.demo === true (see dashboard.html).
   When you build real endpoints, set demo:false and point `api` to your URL prefix. */
(() => {
  let seed = 7
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const pick = a => a[Math.floor(rnd() * a.length)]
  const day = n => new Date(Date.now() - n * 864e5 - Math.floor(rnd() * 8e7)).toISOString()
  const names = ['Aziza Karimova', 'Jasur Mirzaev', 'Sarah Lee', 'Timur Alimov', 'Nilufar Saidova', 'Daniel Brooks', 'Madina Yusupova', 'Omar Haddad', 'Elena Petrova', 'Bekzod Rahimov']
  const prods = (window.PRODUCTS || []).map(p => ({ id: p.id, name: p.name, category: p.category, price: p.price, stock: p.stock, image: p.image, description: p.description, active: 1 }))
  prods[3].stock = 3; prods[6].stock = 0

  const customers = names.map((n, i) => ({
    id: i + 1, name: n, email: n.toLowerCase().replace(/[^a-z]+/g, '.') + '@mail.com',
    created_at: day(60 - i * 5), last_login: day(i * 2), login_count: 3 + Math.floor(rnd() * 30),
    order_count: 0, spent: 0, cart_qty: Math.floor(rnd() * 3), abandoned: i % 4 === 1, notes: '', is_active: true
  }))
  const statuses = ['new', 'confirmed', 'processing', 'shipped', 'delivered', 'delivered', 'delivered', 'cancelled']
  const orders = Array.from({ length: 26 }, (_, i) => {
    const c = pick(customers), n = 1 + Math.floor(rnd() * 3)
    const items = Array.from({ length: n }, () => { const p = pick(prods); return { name: p.name, qty: 1 + Math.floor(rnd() * 2), price: p.price } })
    const total = items.reduce((s, x) => s + x.price * x.qty, 0), st = pick(statuses)
    if (st !== 'cancelled') { c.order_count++; c.spent += total }
    return { id: i + 1, reference: 'PX-' + (1042000 + i * 13), name: c.name, email: c.email, total, status: st, payment_status: st === 'delivered' ? 'paid' : st === 'cancelled' ? 'refunded' : pick(['unpaid', 'paid']), created_at: day(i), address: '12 Amir Temur St', city: 'Tashkent', postal_code: '100000', items, admin_note: '', customer_id: c.id }
  })
  const messages = [
    { id: 1, subject: 'Order delivery question', status: 'new', name: 'Sarah Lee', email: 'sarah@mail.com', message: 'Hi! Could you tell me when my order will arrive?', created_at: day(0) },
    { id: 2, subject: 'Warranty info', status: 'read', name: 'Timur Alimov', email: 'timur@mail.com', message: 'Does the laptop come with an international warranty?', created_at: day(2) },
    { id: 3, subject: 'Bulk purchase', status: 'new', name: 'Omar Haddad', email: 'omar@mail.com', message: 'We would like 15 smart watches for our team.', created_at: day(3) }
  ]
  const subscribers = Array.from({ length: 6 }, (_, i) => ({ email: `reader${i + 1}@mail.com`, created_at: day(i * 3) }))
  const events = ['page_view', 'product_view', 'add_to_cart', 'checkout_start', 'login', 'wishlist']
  const evs = Array.from({ length: 18 }, (_, i) => ({ event: pick(events), name: i % 3 ? pick(names) : '', detail: pick(prods).name, created_at: day(i / 4) }))
  const audit = [{ action: 'Updated order status', actor: 'admin', target: 'PX-1042013', created_at: day(0) }, { action: 'Edited product', actor: 'admin', target: 'Nova Laptop Pro', created_at: day(1) }]

  const live = () => orders.filter(o => o.status !== 'cancelled')
  const overview = days => {
    const set = orders.filter(o => Date.now() - new Date(o.created_at) < days * 864e5)
    const ok = set.filter(o => o.status !== 'cancelled'), rev = ok.reduce((s, o) => s + o.total, 0)
    const trend = Array.from({ length: Math.min(days, 14) }, (_, i) => { const d = new Date(Date.now() - (Math.min(days, 14) - 1 - i) * 864e5); return { date: d.toISOString().slice(5, 10), revenue: Math.round(300 + rnd() * 2200) } })
    const sc = {}; set.forEach(o => (sc[o.status] = (sc[o.status] || 0) + 1))
    const tp = {}; ok.forEach(o => o.items.forEach(i => { tp[i.name] = tp[i.name] || { name: i.name, units: 0, revenue: 0 }; tp[i.name].units += i.qty; tp[i.name].revenue += i.qty * i.price }))
    return {
      metrics: { revenue: rev, orders: set.length, customers: customers.length, buyers: customers.filter(c => c.order_count).length, non_buyers: customers.filter(c => !c.order_count).length, aov: ok.length ? rev / ok.length : 0, pending_orders: orders.filter(o => o.status === 'new').length, low_stock: prods.filter(p => p.stock > 0 && p.stock <= 5).length, out_of_stock: prods.filter(p => !p.stock).length, login_events: 142, active_users_7d: 7, abandoned_carts: customers.filter(c => c.abandoned).length, visitors: 1284 },
      trend, statuses: Object.entries(sc).map(([status, count]) => ({ status, count })),
      funnel: [{ name: 'page_view', value: 1284 }, { name: 'product_view', value: 612 }, { name: 'add_to_cart', value: 238 }, { name: 'checkout_start', value: 96 }, { name: 'orders', value: set.length }],
      top_products: Object.values(tp).sort((a, b) => b.revenue - a.revenue).slice(0, 5),
      recent_orders: [...set].slice(0, 6)
    }
  }
  const csv = rows => { if (!rows.length) return ''; const k = Object.keys(rows[0]).filter(x => typeof rows[0][x] !== 'object'); return k.join(',') + '\n' + rows.map(r => k.map(x => JSON.stringify(r[x] ?? '')).join(',')).join('\n') }

  window.PHLOX_DEMO_API = async (path, opt = {}) => {
    const m = (opt.method || 'GET').toUpperCase(), url = new URL(path, 'http://x'), q = url.searchParams, p = url.pathname
    const body = opt.body ? JSON.parse(opt.body) : {}
    await new Promise(r => setTimeout(r, 120))
    if (p === '/me') return { user: { name: 'Demo Admin', email: 'admin@phlox.local', role: 'admin' } }
    if (p === '/admin/overview') return overview(Number(q.get('days')) || 30)
    if (p === '/admin/customers') {
      const s = (q.get('search') || '').toLowerCase(), seg = q.get('segment') || 'all'
      return { items: customers.filter(c => (!s || (c.name + c.email).toLowerCase().includes(s)) && (seg === 'all' || (seg === 'buyers' && c.order_count) || (seg === 'non_buyers' && !c.order_count) || (seg === 'abandoned' && c.abandoned) || (seg === 'recent_login' && Date.now() - new Date(c.last_login) < 864e5 * 1.5))) }
    }
    let r
    if ((r = p.match(/^\/admin\/customers\/(\d+)$/))) {
      const c = customers.find(x => x.id === Number(r[1]))
      if (m === 'PATCH') { Object.assign(c, body); return c }
      return { ...c, orders: orders.filter(o => o.customer_id === c.id), cart: c.cart_qty ? [{ name: prods[0].name, qty: c.cart_qty }] : [], events: evs.slice(0, 5) }
    }
    if (p === '/admin/orders') { const s = (q.get('search') || '').toLowerCase(), st = q.get('status') || 'all'; return { items: orders.filter(o => (!s || (o.reference + o.name + o.email).toLowerCase().includes(s)) && (st === 'all' || o.status === st)) } }
    if ((r = p.match(/^\/admin\/orders\/(\d+)$/)) && m === 'PATCH') { Object.assign(orders.find(o => o.id === Number(r[1])), body); return {} }
    if (p === '/admin/products' && m === 'GET') return { items: prods }
    if (p === '/admin/products' && m === 'POST') { prods.push({ id: prods.length + 1, ...body, active: body.active ? 1 : 0 }); return {} }
    if ((r = p.match(/^\/admin\/products\/(\d+)$/)) && m === 'PUT') { Object.assign(prods.find(x => x.id === Number(r[1])), body, { active: body.active ? 1 : 0 }); return {} }
    if (p === '/admin/activity') return { events: evs, audit }
    if (p === '/admin/messages' && m === 'GET') return { items: messages, subscribers }
    if ((r = p.match(/^\/admin\/messages\/(\d+)$/)) && m === 'PATCH') { messages.find(x => x.id === Number(r[1])).status = 'read'; return {} }
    throw Error('Not available in demo mode')
  }
  window.PHLOX_DEMO_EXPORT = kind => {
    const rows = { customers, orders: orders.map(o => ({ ...o })), products: prods }[kind] || []
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv(rows)], { type: 'text/csv' })); a.download = kind + '.csv'; a.click()
  }
})()
