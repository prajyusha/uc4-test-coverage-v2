export class AppError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function ensure(condition, status, message) {
  if (!condition) throw new AppError(status, message);
}
export function object(value) {
  ensure(value && typeof value === 'object' && !Array.isArray(value), 400, 'Expected a JSON object.');
  return value;
}
export function text(value, label, min, max) {
  ensure(typeof value === 'string', 400, `${label} must be text.`);
  const result = value.trim();
  ensure(result.length >= min && result.length <= max, 400, `${label} must be ${min}–${max} characters.`);
  ensure(!/[\u0000-\u001f\u007f]/u.test(result), 400, `${label} contains invalid characters.`);
  return result;
}
export function integer(value, label, min, max) {
  ensure(Number.isSafeInteger(value) && value >= min && value <= max, 400, `${label} must be an integer from ${min} to ${max}.`);
  return value;
}
export function email(value) {
  const result = text(value, 'Email', 3, 254).toLowerCase();
  ensure(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result), 400, 'Enter a valid email.');
  return result;
}
export function password(value) {
  ensure(typeof value === 'string' && value.length >= 10 && value.length <= 128, 400, 'Password must be 10–128 characters.');
  return value;
}
export function id(value) { return text(value, 'Product ID', 1, 80); }
