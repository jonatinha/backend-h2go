import { randomBytes } from 'node:crypto';
import type { Order } from '../types/index.js';

export const DELIVERY_QR_PREFIX = 'H2GO:1:';

export function createDeliveryQrToken(): string {
  return randomBytes(24).toString('base64url');
}

/** Returns the opaque token, or null when the text is not an H2GO delivery QR. */
export function parseDeliveryQrPayload(raw: string): string | null {
  const text = raw.trim();
  if (!text.startsWith(DELIVERY_QR_PREFIX)) return null;
  const token = text.slice(DELIVERY_QR_PREFIX.length).trim();
  if (token.length < 16 || token.length > 200) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(token)) return null;
  return token;
}

export function withoutDeliveryQrToken<T extends { delivery_qr_token?: string }>(order: T): Omit<T, 'delivery_qr_token'> {
  const copy = { ...order };
  delete copy.delivery_qr_token;
  return copy;
}

export function deliveryQrCustomerName(order: Order): string {
  return order.pickup_contact_name || order.address?.name || 'Cliente';
}
