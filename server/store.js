import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const filename = path.resolve(process.env.SHOP_DATA_FILE || fileURLToPath(new URL('../data/shop.json', import.meta.url)));
const initialProducts = [
  { id: 'canvas-tote', name: 'Everyday canvas tote', category: 'Carry', description: 'Heavyweight natural cotton. A little room for everything.', price: 2800, stock: 30, icon: '👜', color: '#e9d7bd' },
  { id: 'stone-mug', name: 'Slow morning mug', category: 'Home', description: 'A generous ceramic cup for your unhurried mornings.', price: 2400, stock: 24, icon: '☕', color: '#d7e2d6' },
  { id: 'linen-notebook', name: 'Linen notebook', category: 'Workspace', description: 'Blank pages, bound in linen. Make something yours.', price: 1800, stock: 40, icon: '📓', color: '#e4d9ed' },
  { id: 'desk-light', name: 'Little desk light', category: 'Workspace', description: 'A warm glow for late ideas and quiet corners.', price: 6500, stock: 12, icon: '💡', color: '#f4dfae' },
  { id: 'glass-carafe', name: 'Sunday glass carafe', category: 'Home', description: 'Simple, clear glass. Bring a little ritual to the table.', price: 3200, stock: 18, icon: '🍶', color: '#d5e5e9' },
  { id: 'wool-throw', name: 'Cloud knit throw', category: 'Home', description: 'Soft texture, easy warmth. Your sofa’s new favorite.', price: 7800, stock: 10, icon: '🧶', color: '#e9cec4' }
];
export const state = fs.existsSync(filename)
  ? JSON.parse(fs.readFileSync(filename, 'utf8'))
  : { users: [], products: initialProducts, carts: {}, orders: [] };

export function transaction(work) {
  const before = structuredClone(state);
  try {
    const result = work();
    fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
    const temp = `${filename}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(state, null, 2), { mode: 0o600 });
    fs.renameSync(temp, filename);
    return result;
  } catch (error) {
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, before);
    throw error;
  }
}
