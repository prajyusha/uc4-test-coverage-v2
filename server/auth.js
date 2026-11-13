import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash, randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { state, transaction } from './store.js';
import { ensure, object, email, password } from './validation.js';

const scrypt = promisify(scryptCallback);
const sessions = new Map();
export const sessionDuration = 8 * 60 * 60 * 1000;
const digest = value => createHash('sha256').update(value).digest('hex');
const publicUser = ({ id, email, role }) => ({ id, email, role });

async function hash(value, salt) { return Buffer.from(await scrypt(value, salt, 64)); }
export async function initializeUsers() {
  if (state.users.length) return;
  const accounts = [
    { email: 'shopper@example.com', role: 'customer', password: process.env.SHOP_USER_PASSWORD },
    { email: 'admin@example.com', role: 'admin', password: process.env.SHOP_ADMIN_PASSWORD }
  ];
  const users = [];
  for (const account of accounts) {
    password(account.password);
    const salt = randomBytes(16).toString('hex');
    users.push({ id: randomUUID(), email: account.email, role: account.role, salt, hash: (await hash(account.password, salt)).toString('hex') });
  }
  transaction(() => { state.users = users; });
}
export async function login(input) {
  object(input);
  const address = email(input.email);
  const secret = password(input.password);
  const user = state.users.find(item => item.email === address);
  const computed = await hash(secret, user?.salt || 'unrecognized-user-salt');
  ensure(user && timingSafeEqual(computed, Buffer.from(user.hash, 'hex')), 401, 'Email or password is incorrect.');
  const now = Date.now();
  for (const [key, session] of sessions) if (session.expires <= now) sessions.delete(key);
  ensure(sessions.size < 10000, 503, 'Too many active sessions. Please try again later.');
  const token = randomBytes(32).toString('hex');
  sessions.set(digest(token), { userId: user.id, expires: now + sessionDuration });
  return { token, user: publicUser(user) };
}
export function currentUser(token) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const key = digest(token);
  const session = sessions.get(key);
  if (!session || session.expires <= Date.now()) { sessions.delete(key); return null; }
  const user = state.users.find(item => item.id === session.userId);
  return user ? publicUser(user) : null;
}
export function requireUser(user) {
  ensure(user, 401, 'Please sign in to continue.');
  return user;
}
export function requireAdmin(user) {
  requireUser(user);
  ensure(user.role === 'admin', 403, 'Administrator access required.');
}
export function logout(token) { if (token) sessions.delete(digest(token)); }
