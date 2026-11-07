import crypto from 'crypto';

export interface TokenPayload {
  sub: string;       // user id
  role: string;
  un: string;        // username
  exp: number;       // expiry (epoch seconds)
}

export const TOKEN_TTL_SECONDS = 12 * 60 * 60;

function secret(): string {
  const explicit = String(process.env.AUTH_SECRET || '').trim();
  if (explicit) return explicit;
  // Fall back to a value derived from the server-only service key so no extra setup is required.
  const service = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (service) return crypto.createHash('sha256').update(`ra-audit-token:${service}`).digest('hex');
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    throw new Error('AUTH_SECRET (یا SUPABASE_SERVICE_ROLE_KEY) در تنظیمات سرور تعریف نشده است.');
  }
  return 'ra-audit-local-dev-secret';
}

const b64 = (buf: Buffer | string) => Buffer.from(buf).toString('base64url');

function sign(body: string): string {
  return crypto.createHmac('sha256', secret()).update(body).digest('base64url');
}

export function signToken(user: { id: string; role: string; username: string }): string {
  const payload: TokenPayload = {
    sub: String(user.id),
    role: String(user.role),
    un: String(user.username || ''),
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  const body = b64(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function verifyToken(token: string | undefined | null): TokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  let expected: string;
  try { expected = sign(body); } catch { return null; }
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TokenPayload;
    if (!payload.sub || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
