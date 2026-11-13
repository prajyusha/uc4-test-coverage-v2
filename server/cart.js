import { state, transaction } from './store.js';
import { requireUser } from './auth.js';
import { findProduct } from './products.js';
import { ensure, integer, object, id } from './validation.js';

export function getCart(user) {
  requireUser(user);
  const items = (state.carts[user.id] || []).map(line => {
    const product = state.products.find(item => item.id === line.productId);
    return { productId: line.productId, quantity: line.quantity, product: product ? { ...product } : null };
  });
  return { items, subtotal: items.reduce((sum, line) => sum + (line.product?.price || 0) * line.quantity, 0) };
}
export function setQuantity(user, input) {
  requireUser(user);
  object(input);
  const productId = id(input.productId);
  const quantity = integer(input.quantity, 'Quantity', 0, 10);
  return transaction(() => {
    const lines = state.carts[user.id] || [];
    const remaining = lines.filter(line => line.productId !== productId);
    if (quantity) {
      const product = findProduct(productId);
      ensure(quantity <= product.stock, 409, 'Not enough stock for that quantity.');
      ensure(remaining.length < 30, 400, 'Your bag can contain at most 30 different products.');
      remaining.push({ productId, quantity });
    }
    state.carts[user.id] = remaining;
    return getCart(user);
  });
}
