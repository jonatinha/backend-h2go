import crypto from 'crypto';

export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(6).toString('hex');
  return `req_${timestamp}${random}`;
}
