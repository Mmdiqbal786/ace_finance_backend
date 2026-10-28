import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';

function safeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Gate Demo Access list/login.
 * - Production: DEMO_ACCESS_CODE must be set; request must send matching code.
 * - Non-production: if DEMO_ACCESS_CODE is unset, allow (local convenience).
 */
export function assertDemoAccessCode(provided?: string | null): void {
  const expected = (process.env.DEMO_ACCESS_CODE || '').trim();
  const isProd = process.env.NODE_ENV === 'production';

  if (!expected) {
    if (isProd) {
      throw new ForbiddenException(
        'Demo Access is disabled. Set DEMO_ACCESS_CODE on the API.',
      );
    }
    return;
  }

  const got = (provided || '').trim();
  if (!got || !safeEqualString(got, expected)) {
    throw new UnauthorizedException(
      'Invalid or missing demo access code. Unlock the demo guide first, or send X-Demo-Access-Code.',
    );
  }
}

export function assertSeedSecret(provided?: string | null): void {
  const expected = (process.env.SEED_SECRET || '').trim();
  if (!expected) {
    throw new ForbiddenException(
      'Seed is disabled. Set SEED_SECRET on the API to enable bootstrap.',
    );
  }
  const got = (provided || '').trim();
  if (!got || !safeEqualString(got, expected)) {
    throw new ForbiddenException('Invalid or missing X-Seed-Secret.');
  }
}

export function readDemoAccessCode(params: {
  header?: string | string[];
  bodyCode?: string;
  queryCode?: string;
}): string | undefined {
  const headerRaw = params.header;
  const fromHeader = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;
  return (
    fromHeader?.trim() ||
    params.bodyCode?.trim() ||
    params.queryCode?.trim() ||
    undefined
  );
}
