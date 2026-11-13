import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
async function api(path, method = 'GET', body) {
  const response = await fetch(`/api${path}`, {
    method, credentials: 'same-origin',
    headers: method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-Shop-Request': '1' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const result = await response.json().catch(() => ({ error: 'The server returned an unexpected response.' }));
  if (!response.ok) throw new Error(result.error || 'Request failed.');
  return result;
}
const emptyProduct = { name: '', description: '', category: 'Home', price: 1000, stock: 10, icon: '✦', color: '#e9d7bd' };

function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState({ items: [], subtotal: 0 });
  const [page, setPage] = useState('shop');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);
  const [quote, setQuote] = useState(null);
  const [code, setCode] = useState('');
  const [order, setOrder] = useState(null);
  const [editing, setEditing] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const checkoutKey = useRef(null);
  const lock = useRef(false);
  const loginDialog = useRef(null);

  useEffect(() => {
    api('/session').then(async result => {
      setUser(result.user);
      if (result.user) setCart(await api('/cart'));
    }).catch(e => setError(e.message)).finally(() => setReady(true));
  }, []);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      api(`/products?q=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}`)
        .then(result => { if (active) setProducts(result.products); })
        .catch(e => { if (active) setError(e.message); })
        .finally(() => { if (active) setLoading(false); });
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [search, category, refresh]);
  useEffect(() => {
    if (loginOpen) loginDialog.current?.showModal();
    else loginDialog.current?.close();
  }, [loginOpen]);
  useEffect(() => { setError(''); setNotice(''); }, [page]);

  async function action(work) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try { await work(); } catch (e) { setError(e.message); }
    finally { lock.current = false; setBusy(false); }
  }
  async function updateBag(productId, quantity) {
    if (!user) { setLoginOpen(true); return; }
    await action(async () => {
      setCart(await api('/cart', 'PUT', { productId, quantity }));
      setQuote(null); checkoutKey.current = null;
      setNotice(quantity ? 'Bag updated. A good choice.' : 'Item removed.');
    });
  }
  function navigate(target) {
    if ((target === 'bag' || target === 'checkout') && !user) { setLoginOpen(true); return; }
    setPage(target);
  }
  async function signIn(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action(async () => {
      const result = await api('/login', 'POST', Object.fromEntries(form));
      setUser(result.user); setCart(await api('/cart')); setLoginOpen(false);
      setNotice('Welcome back.');
    });
  }
  async function signOut() {
    await action(async () => {
      await api('/logout', 'POST', {});
      setUser(null); setCart({ items: [], subtotal: 0 }); setQuote(null);
      setOrder(null); setPage('shop'); setEditing(null);
    });
  }
  async function applyCode(event) {
    event.preventDefault();
    await action(async () => { setQuote(await api('/checkout/quote', 'POST', { discountCode: code })); setNotice('Your totals are up to date.'); });
  }
  async function startCheckout() {
    await action(async () => {
      const totals = await api('/checkout/quote', 'POST', { discountCode: code });
      setQuote(totals); checkoutKey.current = crypto.randomUUID(); setPage('checkout');
    });
  }
  async function checkout(event) {
    event.preventDefault();
    const delivery = Object.fromEntries(new FormData(event.currentTarget));
    await action(async () => {
      checkoutKey.current ||= crypto.randomUUID();
      const result = await api('/checkout', 'POST', { delivery, discountCode: code, idempotencyKey: checkoutKey.current });
      setOrder(result); setCart({ items: [], subtotal: 0 }); setQuote(null);
      setPage('success'); setRefresh(value => value + 1);
    });
  }
  async function saveProduct(event) {
    event.preventDefault();
    const input = Object.fromEntries(new FormData(event.currentTarget));
    input.price = Math.round(Number(input.price) * 100); input.stock = Number(input.stock);
    await action(async () => {
      await api(`/admin/products${editing.id ? `/${editing.id}` : ''}`, editing.id ? 'PUT' : 'POST', input);
      setEditing(null); setRefresh(value => value + 1);
      setCart(await api('/cart')); setQuote(null); setNotice('Product saved.');
    });
  }
  async function removeProduct(product) {
    if (!window.confirm(`Delete “${product.name}”? Existing orders will keep their product details.`)) return;
    await action(async () => {
      await api(`/admin/products/${product.id}`, 'DELETE', {});
      setRefresh(value => value + 1); setCart(await api('/cart')); setQuote(null); setNotice('Product deleted.');
    });
  }
  const count = cart.items.reduce((sum, line) => sum + line.quantity, 0);
  const totals = quote || { subtotal: cart.subtotal, discount: 0, shipping: cart.subtotal >= 7500 ? 0 : 500, total: cart.subtotal + (cart.subtotal >= 7500 ? 0 : 500) };

  return <>
    <div className="announcement">A little less ordinary. <span>Free shipping on orders $75+</span></div>
    <header>
      <button className="brand" onClick={() => navigate('shop')} aria-label="Little Goods home"><span className="brand-mark">✳</span> little goods<span className="brand-dot">.</span></button>
      <nav aria-label="Main navigation">
        <button className={page === 'shop' ? 'active' : ''} onClick={() => navigate('shop')}>The shop</button>
        {user?.role === 'admin' && <button className={page === 'admin' ? 'active' : ''} onClick={() => { setSearch(''); setCategory(''); navigate('admin'); }}>Manage products</button>}
      </nav>
      <div className="header-actions">
        {user ? <button onClick={signOut} disabled={busy}>Sign out</button> : <button onClick={() => setLoginOpen(true)} disabled={!ready}>Sign in ↗</button>}
        <button className="bag-button" onClick={() => navigate('bag')}>Bag <span>{count}</span></button>
      </div>
    </header>
    <main>
      <div aria-live="polite" className="messages">
        {error && <div className="message error" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
        {notice && <div className="message">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notification">×</button></div>}
      </div>
      {page === 'shop' && <>
        <section className="hero">
          <div><p className="eyebrow">THOUGHTFULLY CHOSEN · MADE FOR REAL LIFE</p><h1>Everyday things.<br /><em>A little more lovely.</em></h1><p className="hero-copy">Good design, simple pleasures, and the things you’ll reach for again and again. Welcome to your everyday edit.</p><a className="primary link-button" href="#collection">Explore the collection <span>↘</span></a><p className="hero-note">Fewer, better things. Always.</p></div>
          <div className="hero-art" aria-label="A curated collection of home essentials"><span className="art-label">THE EVERYDAY EDIT / 01</span><div className="art-circle"></div><span className="art-mug">☕</span><span className="art-book">📓</span><span className="art-yarn">🧶</span><div className="art-caption">Little details.<br />Big difference. <span>✳</span></div></div>
        </section>
        <div className="values"><span>✧ Considered design</span><span>♡ Small everyday joys</span><span>↺ Essentials that last</span></div>
        <section id="collection">
          <div className="section-top"><div><p className="eyebrow">THE COLLECTION</p><h2>Find your new everyday.</h2></div><span className="muted">{loading ? 'Finding good things…' : `${products.length} good things`}</span></div>
          <div className="catalog-tools">
            <div className="categories" aria-label="Product categories">{['', 'Home', 'Carry', 'Workspace'].map(value => <button key={value} className={category === value ? 'selected' : ''} onClick={() => setCategory(value)}>{value || 'All goods'}</button>)}</div>
            <label className="search"><span aria-hidden="true">⌕</span><input type="search" aria-label="Search products" placeholder="Find something lovely…" maxLength={100} value={search} onChange={e => setSearch(e.target.value)} /></label>
          </div>
          <div className="product-grid" aria-busy={loading}>
            {products.map(product => <article className="product-card" key={product.id}>
              <div className="product-art" style={{ background: product.color }}><span className="category-tag">{product.category}</span><span className="product-icon" aria-hidden="true">{product.icon}</span><span className="art-star">✳</span></div>
              <div className="product-heading"><h3>{product.name}</h3><span>{money(product.price)}</span></div><p>{product.description}</p>
              <button className="add-button" disabled={busy || !ready || !product.stock} onClick={() => updateBag(product.id, (cart.items.find(line => line.productId === product.id)?.quantity || 0) + 1)}>{product.stock ? 'Add to bag' : 'Out of stock'} <span>＋</span></button>
            </article>)}
          </div>
          {!loading && !products.length && <div className="empty"><h3>No good things found.</h3><p>Try another search or category.</p><button onClick={() => { setSearch(''); setCategory(''); }}>Clear filters</button></div>}
        </section>
        <section className="welcome-banner"><span>✳</span><div><h2>A little welcome gift.</h2><p>Take 10% off with code <strong>WELCOME10</strong> at checkout.</p></div><span className="muted">Good things start here ↗</span></section>
      </>}
      {page === 'bag' && <section className="inner-page"><p className="eyebrow">YOUR EVERYDAY EDIT</p><h1>Your bag<span className="small-count"> ({count})</span></h1>
        {!cart.items.length ? <div className="empty"><span className="empty-icon">👜</span><h2>A little room for good things.</h2><p>Your bag is empty. Let’s find something you’ll love.</p><button className="primary" onClick={() => navigate('shop')}>Explore the shop →</button></div> :
          <div className="checkout-layout"><div>{cart.items.map(line => <div className="bag-line" key={line.productId}>
            <div className="bag-art" style={{ background: line.product?.color || '#eee' }}>{line.product?.icon || '?'}</div>
            <div><h3>{line.product?.name || 'Unavailable product'}</h3><p className="muted">{line.product ? money(line.product.price) : 'Please remove this item.'}</p><button className="text-button" disabled={busy} onClick={() => updateBag(line.productId, 0)}>Remove</button></div>
            <label className="quantity">Qty<input aria-label={`Quantity for ${line.product?.name || 'unavailable product'}`} type="number" min="1" max={Math.min(10, line.product?.stock || 10)} value={line.quantity} disabled={busy} onChange={e => { const value = Number(e.target.value); if (Number.isInteger(value) && value >= 1 && value <= 10) updateBag(line.productId, value); }} /></label>
            <strong>{money((line.product?.price || 0) * line.quantity)}</strong>
          </div>)}<button className="text-button" onClick={() => navigate('shop')}>← Continue shopping</button></div>
          <aside className="summary"><h2>The little details</h2><form onSubmit={applyCode}><label htmlFor="discount">Discount code</label><div className="inline"><input id="discount" maxLength={30} value={code} onChange={e => { setCode(e.target.value); setQuote(null); }} placeholder="WELCOME10" /><button disabled={busy}>Apply</button></div></form><Summary totals={totals} /><p className="muted">Shipping is free after discounts on orders $75+.</p><button className="primary full" disabled={busy} onClick={startCheckout}>Continue to checkout →</button></aside></div>}
      </section>}
      {page === 'checkout' && <section className="inner-page"><p className="eyebrow">ONE LAST LITTLE STEP</p><h1>Make it yours.</h1><div className="checkout-layout"><form className="delivery-form" onSubmit={checkout}><h2>Delivery details</h2><label>Full name<input name="name" required minLength={2} maxLength={100} autoComplete="name" /></label><label>Email<input name="email" type="email" required maxLength={254} defaultValue={user?.email} autoComplete="email" /></label><label>Street address<input name="address" required minLength={5} maxLength={200} autoComplete="street-address" /></label><div className="form-grid"><label>City<input name="city" required minLength={2} maxLength={80} autoComplete="address-level2" /></label><label>Postal code<input name="postalCode" required minLength={2} maxLength={20} autoComplete="postal-code" /></label></div><div className="demo-note">This is a demo checkout. No payment is collected and no goods will be shipped.</div><button className="primary" disabled={busy}>{busy ? 'Placing your order…' : `Place demo order · ${money(totals.total)}`}</button><button type="button" className="text-button" onClick={() => navigate('bag')}>← Back to bag</button></form><aside className="summary"><h2>Your order</h2>{cart.items.map(line => <p className="summary-line" key={line.productId}><span>{line.product?.name} × {line.quantity}</span><span>{money((line.product?.price || 0) * line.quantity)}</span></p>)}<Summary totals={totals} /><p className="muted">{code ? `Discount code: ${code.toUpperCase()}` : 'No discount applied.'}</p></aside></div></section>}
      {page === 'success' && order && <section className="empty success"><span className="empty-icon">✳</span><p className="eyebrow">THANK YOU FOR SHOPPING SMALL</p><h1>Good things are on the way.</h1><p>Your demo order has been placed. No payment was collected.</p><p>Order <strong>{order.id.slice(0, 8)}</strong> · {money(order.total)}</p><button className="primary" onClick={() => navigate('shop')}>Back to the good things →</button></section>}
      {page === 'admin' && user?.role === 'admin' && <section className="inner-page">
        <div className="section-top"><div><p className="eyebrow">ADMIN WORKSPACE</p><h1>The product edit.</h1></div><button className="primary" onClick={() => setEditing({ ...emptyProduct })}>＋ New product</button></div>
        {editing && <form className="admin-form" key={editing.id || 'new'} onSubmit={saveProduct}><h2>{editing.id ? 'Edit product' : 'Add a good thing'}</h2><div className="form-grid">
          <label>Name<input name="name" defaultValue={editing.name} required minLength={2} maxLength={100} /></label><label>Category<input name="category" defaultValue={editing.category} required minLength={2} maxLength={40} /></label>
          <label>Price (USD)<input name="price" type="number" defaultValue={(editing.price / 100).toFixed(2)} required min="0.01" max="10000" step="0.01" /></label><label>Stock<input name="stock" type="number" defaultValue={editing.stock} required min="0" max="10000" step="1" /></label>
          <label>Symbol<input name="icon" defaultValue={editing.icon} required maxLength={8} /></label><label>Background color<input name="color" type="color" defaultValue={editing.color} required /></label>
        </div><label>Description<textarea name="description" defaultValue={editing.description} required minLength={5} maxLength={500} /></label><div className="inline"><button className="primary" disabled={busy}>Save product</button><button type="button" onClick={() => setEditing(null)}>Cancel</button></div></form>}
        <div className="admin-list">{products.map(product => <div className="admin-row" key={product.id}><span className="mini-art" style={{ background: product.color }}>{product.icon}</span><div><h3>{product.name}</h3><p className="muted">{product.category} · {money(product.price)} · {product.stock} in stock</p></div><button disabled={busy} onClick={() => setEditing({ ...product })}>Edit</button><button className="danger" disabled={busy} onClick={() => removeProduct(product)}>Delete</button></div>)}</div>
      </section>}
    </main>
    <footer><div className="brand">✳ little goods.</div><p>Thoughtful things. Everyday living.</p><span>Made with a little more care. © {new Date().getFullYear()}</span></footer>
    <dialog ref={loginDialog} onCancel={() => setLoginOpen(false)} onClose={() => setLoginOpen(false)}>
      <button className="close-dialog" onClick={() => setLoginOpen(false)} aria-label="Close sign in">×</button><span className="brand-mark">✳</span><h2>A little hello.</h2><p className="muted">Sign in to save your bag and make it yours.</p>
      <form onSubmit={signIn}><label>Email<input name="email" type="email" required maxLength={254} autoComplete="username" autoFocus /></label><label>Password<input name="password" type="password" required minLength={10} maxLength={128} autoComplete="current-password" /></label><p className="muted">Use an account provisioned by your shop administrator.</p>{error && <p role="alert" className="error-text">{error}</p>}<button className="primary full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in →'}</button></form>
    </dialog>
  </>;
}
function Summary({ totals }) {
  return <div className="totals"><p><span>Subtotal</span><span>{money(totals.subtotal)}</span></p><p><span>Discount</span><span>−{money(totals.discount)}</span></p><p><span>Shipping</span><span>{totals.shipping ? money(totals.shipping) : 'On us'}</span></p><p className="total"><span>Total</span><span>{money(totals.total)}</span></p></div>;
}
createRoot(document.getElementById('root')).render(<App />);
