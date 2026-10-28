import { Response } from 'express';

export const AUTH_COOKIE_NAME = 'ace_af_token';

function cookieSecure(): boolean {
  return process.env.NODE_ENV === 'production';
}

/** Cross-site FE (SWA) → API needs SameSite=None; local same-site can use Lax. */
function cookieSameSite(): 'none' | 'lax' {
  if (!cookieSecure()) return 'lax';
  const frontend = (process.env.FRONTEND_URL || '').trim().toLowerCase();
  if (
    frontend.includes('localhost') ||
    frontend.includes('127.0.0.1')
  ) {
    return 'lax';
  }
  return 'none';
}

export function attachAccessCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: cookieSecure() || cookieSameSite() === 'none',
    sameSite: cookieSameSite(),
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearAccessCookie(res: Response): void {
  res.cookie(AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    secure: cookieSecure() || cookieSameSite() === 'none',
    sameSite: cookieSameSite(),
    path: '/',
    maxAge: 0,
  });
}

/** If the handler result includes access_token, mirror it into an httpOnly cookie. */
export function maybeAttachAccessCookie(res: Response, body: unknown): void {
  if (!body || typeof body !== 'object') return;
  const token = (body as { access_token?: unknown }).access_token;
  if (typeof token === 'string' && token.trim()) {
    attachAccessCookie(res, token.trim());
  }
}
