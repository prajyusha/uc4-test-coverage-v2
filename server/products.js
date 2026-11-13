import { state } from './store.js';
import { text, ensure, id } from './validation.js';

export function findProduct(productId) {
  const product = state.products.find(item => item.id === id(productId));
  ensure(product, 404, 'Product not found.');
  return product;
}
export function searchProducts(query = '', category = '') {
  const search = text(query, 'Search', 0, 100).toLowerCase();
  const selected = text(category, 'Category', 0, 40);
  return state.products.filter(product =>
    (!selected || product.category === selected) &&
    `${product.name} ${product.description} ${product.category}`.toLowerCase().includes(search)
  ).map(product => ({ ...product }));
}
