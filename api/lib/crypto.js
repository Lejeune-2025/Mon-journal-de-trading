import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export function hashSecret(secret) {
  return createHash('sha256').update(String(secret)).digest('hex');
}

export function verifySecret(secret, hash) {
  if (!secret || !hash) return false;
  const a = Buffer.from(hashSecret(secret), 'utf8');
  const b = Buffer.from(String(hash), 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function newAccountId() {
  return `acc_${randomBytes(12).toString('hex')}`;
}

export function newSecret() {
  return randomBytes(24).toString('base64url');
}
