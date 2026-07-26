const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+()\-\s]{7,20}$/;

function cleanText(value, { max = 500, required = false } = {}) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (required && !text) return null;
  return text.slice(0, max);
}

function normalizeEmail(value) {
  return cleanText(value, { max: 254 }).toLowerCase();
}

function isValidEmail(value) {
  return EMAIL_PATTERN.test(normalizeEmail(value));
}

function isValidPhone(value) {
  if (!value) return true;
  return PHONE_PATTERN.test(String(value).trim());
}

function positiveNumber(value, { min = 0.01, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

function optionalDate(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function safeRole(value, allowed = ['buyer', 'farmer']) {
  return allowed.includes(value) ? value : null;
}

function isSafeImage(value) {
  if (typeof value !== 'string') return false;
  if (/^https?:\/\//i.test(value)) return value.length <= 2048;
  return /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(value) && value.length <= 1_500_000;
}

function cleanImages(images) {
  if (!Array.isArray(images)) return [];
  return images.filter(isSafeImage).slice(0, 3);
}

function timingSafeEqualText(left, right) {
  const crypto = require('crypto');
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = {
  cleanText,
  normalizeEmail,
  isValidEmail,
  isValidPhone,
  positiveNumber,
  optionalDate,
  safeRole,
  cleanImages,
  timingSafeEqualText
};
