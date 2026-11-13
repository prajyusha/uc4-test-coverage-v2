import { randomUUID } from 'node:crypto';
import { requireAdmin } from './auth.js';
import { state, transaction } from './store.js';
import { findProduct } from './products.js';
import { object, text, integer, ensure } from './validation.js';

function productInput(input) {
  object(input);
  const color = text(input.color, 'Color', 7, 7);
  ensure(/^#[a-f0-9]{6}$/i.test(color), 400, 'Color must be a six-digit hex color.');
  return {
    name: text(input.name, 'Product name', 2, 100),
    description: text(input.description, 'Description', 5, 500),
    category: text(input.category, 'Category', 2, 40),
    price: integer(input.price, 'Price in cents', 1, 1000000),
    stock: integer(input.stock, 'Stock', 0, 10000),
    icon: text(input.icon, 'Product symbol', 1, 8),
    color
  };
}
export function saveProduct(user, productId, input) {
  requireAdmin(user);
  const fields = productInput(input);
  return transaction(() => {
    if (productId) {
      const product = findProduct(productId);
      Object.assign(product, fields);
      return { ...product };
    }
    ensure(state.products.length < 500, 400, 'Catalog limit reached (500 products).');
    const product = { id: randomUUID(), ...fields };
    state.products.push(product);
    return product;
  });
}
export function deleteProduct(user, productId) {
  requireAdmin(user);
  return transaction(() => {
    const product = findProduct(productId);
    state.products = state.products.filter(item => item.id !== product.id);
    return { message: 'Product deleted.' };
  });
}
