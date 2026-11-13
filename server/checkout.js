import { randomUUID } from 'node:crypto';
import { state, transaction } from './store.js';
import { getCart } from './cart.js';
import { requireUser } from './auth.js';
import { ensure, object, text, email, integer } from './validation.js';

function calculate(user, code) {
  const discountCode = text(code ?? '', 'Discount code', 0, 30).toUpperCase();
  ensure(!discountCode || discountCode === 'WELCOME10', 400, 'That discount code is not valid.');
  const cart = getCart(user);
  ensure(cart.items.length > 0, 400, 'Your bag is empty.');
  for (const line of cart.items) {
    integer(line.quantity, 'Quantity', 1, 10);
    ensure(line.product && line.product.stock >= line.quantity, 409, 'A bag item is unavailable. Please update your bag.');
  }
  const discount = discountCode ? Math.round(cart.subtotal * 0.1) : 0;
  const shipping = cart.subtotal - discount >= 8500 ? 0 : 500;
  return { ...cart, discountCode, discount, shipping, total: cart.subtotal - discount + shipping };
}
export function quote(user, input) {
  requireUser(user);
  object(input);
  return calculate(user, input.discountCode);
}
export function placeOrder(user, input) {
  requireUser(user);
  object(input);
  const key = text(input.idempotencyKey, 'Checkout key', 36, 36);
  ensure(/^[a-f0-9-]{36}$/i.test(key), 400, 'Invalid checkout key.');
  const previous = state.orders.find(order => order.userId === user.id && order.key === key);
  if (previous && Date.now() - Date.parse(previous.createdAt) < 24 * 60 * 60 * 1000) return previous;
  const delivery = object(input.delivery);
  const address = {
    name: text(delivery.name, 'Full name', 2, 100),
    email: email(delivery.email),
    address: text(delivery.address, 'Address', 5, 200),
    city: text(delivery.city, 'City', 2, 80),
    postalCode: text(delivery.postalCode, 'Postal code', 2, 20)
  };
  return transaction(() => {
    const summary = calculate(user, input.discountCode);
    for (const line of summary.items) state.products.find(product => product.id === line.productId).stock -= line.quantity;
    const order = { id: randomUUID(), userId: user.id, key, createdAt: new Date().toISOString(), delivery: address, ...summary };
    state.orders.push(order);
    state.carts[user.id] = [];
    return order;
  });
}
