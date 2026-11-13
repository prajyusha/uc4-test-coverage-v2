# Little Goods

A small React storefront with a Node/Express backend. Runs on system Node **18.18+**, including Node 18.20.8. Checkout places a demo order; it does not collect payment or ship goods.

## Run locally

Install dependencies and build the React frontend:

```sh
npm ci
npm run build
```

Before the first start, provision `SHOP_USER_PASSWORD` and `SHOP_ADMIN_PASSWORD` in your environment using a secret manager or your local environment settings. Both must be 10–128 characters. Passwords are never committed or sent to the browser. The initial accounts are `shopper@example.com` (customer) and `admin@example.com` (administrator).

Start the integrated frontend/API server:

```sh
npm start
```

Open `http://localhost:3000`. `PORT` can select another port. In this workspace, use `/usr/bin/node /usr/bin/npm ci`, `/usr/bin/node /usr/bin/npm run build`, and `/usr/bin/node server/index.js` to explicitly use system Node 18 instead of the isolated Node 22 installed earlier.

The server creates `data/shop.json` on first startup. Set `SHOP_DATA_FILE` to choose another location. Password variables are required only when initializing an empty store. Changing those variables does not reset existing accounts. Back up and protect the data directory; it contains password hashes, addresses, bags, and orders.

## Shop flows

- Browse the catalog, search by name/description/category, and filter categories.
- Sign in, add products to a persistent per-user bag, change quantities, and remove items.
- Apply `WELCOME10` for 10% off. Shipping is $5 or free when the discounted subtotal is at least $75.
- Enter delivery details and place a demo order. Server-calculated prices, stock checks, inventory updates, and checkout idempotency prevent client-side price manipulation and duplicate submissions.
- Sign in as an administrator to create, edit, or delete products. Customers cannot access admin mutations, even by calling the API directly.
- Deleted bag items remain visible as unavailable and can be removed. Orders retain product snapshots.

## Architecture and limits

The React client lives in `src/`. `server/index.js` contains only HTTP/security adapters; business modules do not import Express:

| Module | Responsibility |
| --- | --- |
| `server/auth.js` | Salted scrypt passwords, login, expiring sessions, role checks |
| `server/products.js` | Product lookup and bounded literal-text search |
| `server/cart.js` | Bag quantities, product/stock validation |
| `server/checkout.js` | Discounts, delivery validation, authoritative totals and orders |
| `server/admin.js` | Authorized product management and product validation |
| `server/store.js` | Local JSON storage, atomic replacement and rollback |
| `server/validation.js` | Shared validation and application errors |

Limits are enforced on the server as well as in forms:
- Passwords: 10–128 characters; search: at most 100 characters.
- Bag: 1–10 units per product, up to 30 different products, constrained by current stock. Quantity 0 removes an item.
- Product price: 1–1,000,000 integer cents; stock: 0–10,000; catalog: up to 500 products.
- JSON bodies: 16 KiB; login: 20 attempts per IP per 15 minutes.
- Sessions: eight hours, HTTP-only SameSite=Strict cookies; logout revokes the session.
- Writes require JSON and a custom request header; browser Origin is checked. CORS is not enabled.
- API errors use `{ "error": "..." }` with appropriate HTTP status codes.

## Deployment boundaries

This is a **single-process demonstration**, not a production payment platform. JSON writes are synchronous; multiple server processes must not share the file. Sessions and rate limits are in memory and reset on restart. No registration, password reset, payment gateway, tax calculation, email delivery, or fulfillment integration is included.

Use HTTPS and `NODE_ENV=production` in production so cookies are Secure. Do not set production mode for plain-HTTP local use. A production deployment also needs a database, shared session/rate-limit storage, monitoring, backup policies, and a supported Node release (Node 18 is end-of-life, but is supported by this code as requested).

No test suite is included. Earlier environment smoke fixtures have been removed.
