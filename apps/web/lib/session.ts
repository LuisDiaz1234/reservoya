// apps/web/lib/session.ts
import crypto from 'crypto';

const secret = process.env.APP_SESSION_SECRET || 'dev-secret-change-me';

export type AppSession = {
  workspace_id: string;
  workspace_slug: string;
  role: 'admin' | 'operator';
};

export function signSession(data: AppSession): string {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySession(token?: string | null): AppSession | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
  } catch {
    return null;
  }
}
