import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppError, ensure } from './validation.js';
import { initializeUsers, currentUser, requireUser, login, logout, sessionDuration } from './auth.js';
import { searchProducts } from './products.js';
import { getCart, setQuantity } from './cart.js';
import { quote, placeOrder } from './checkout.js';
import { saveProduct, deleteProduct } from './admin.js';

await initializeUsers();
const app = express();
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: { directives: { 'script-src-attr': ["'none'"] } } }));
app.use(express.json({ limit: '16kb', strict: true }));
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  try {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      ensure(req.get('X-Shop-Request') === '1', 403, 'Invalid request origin.');
      ensure(req.is('application/json'), 415, 'Use application/json.');
      const origin = req.get('Origin');
      if (origin) {
        let parsed;
        try { parsed = new URL(origin); } catch { throw new AppError(403, 'Invalid request origin.'); }
        ensure(['http:', 'https:'].includes(parsed.protocol) && parsed.host === req.get('Host'), 403, 'Cross-origin requests are not allowed.');
      }
    }
    const token = req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith('shop_session='))?.slice(13);
    req.sessionToken = token;
    req.user = currentUser(token);
    next();
  } catch (error) { next(error); }
});
const attempts = new Map();
const rateLimit = (req, res, next) => {
  const now = Date.now();
  for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
  const key = req.ip;
  const value = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
  if (value.count >= 20 || attempts.size >= 10000) {
    res.set('Retry-After', String(Math.max(1, Math.ceil((value.until - now) / 1000))));
    return next(new AppError(429, 'Too many login attempts. Please try again later.'));
  }
  value.count++;
  attempts.set(key, value);
  next();
};
const route = fn => (req, res, next) => Promise.resolve().then(() => fn(req, res)).catch(next);
const cookieOptions = { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/' };
app.get('/api/session', (req, res) => res.json({ user: req.user }));
app.post('/api/login', rateLimit, route(async (req, res) => {
  const result = await login(req.body);
  logout(req.sessionToken);
  res.cookie('shop_session', result.token, { ...cookieOptions, maxAge: sessionDuration }).json({ user: result.user });
}));
app.post('/api/logout', (req, res) => {
  logout(req.sessionToken);
  res.clearCookie('shop_session', cookieOptions).json({ message: 'Signed out.' });
});
app.get('/api/products', route((req, res) => res.json({ products: searchProducts(req.query.q, req.query.category) })));
app.get('/api/cart', route((req, res) => res.json(getCart(requireUser(req.user)))));
app.put('/api/cart', route((req, res) => res.json(setQuantity(req.user, req.body))));
app.post('/api/checkout/quote', route((req, res) => res.json(quote(req.user, req.body))));
app.post('/api/checkout', route((req, res) => res.status(201).json(placeOrder(req.user, req.body))));
app.post('/api/admin/products', route((req, res) => res.status(201).json(saveProduct(req.user, null, req.body))));
app.put('/api/admin/products/:id', route((req, res) => res.json(saveProduct(req.user, req.params.id, req.body))));
app.delete('/api/admin/products/:id', route((req, res) => res.json(deleteProduct(req.user, req.params.id))));
app.use('/api', (req, res, next) => next(new AppError(404, 'API endpoint not found.')));
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
app.use(express.static(dist));
app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error instanceof AppError ? error.status : error.type === 'entity.too.large' ? 413 : error.type === 'entity.parse.failed' ? 400 : 500;
  if (status === 500) console.error(error);
  res.status(status).json({ error: status === 500 ? 'Something went wrong. Please try again.' : status === 413 ? 'Request is too large.' : status === 400 && !(error instanceof AppError) ? 'Invalid JSON request.' : error.message });
});
const server = app.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log(`Shop listening on port ${server.address().port}`));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));
