/**
 * Shared HTTP helpers for postman verify scenarios.
 */

/** Password-only demo accounts (no OTP / authenticator). */
export const DEMO = {
  admin: {
    email: 'finance@aceolution.com',
    password: 'Admin@1234',
    role: 'ADMIN',
  },
  requester: {
    email: 'requester.gac@acefinance.com',
    password: 'Requester@1234',
    role: 'REQUESTER',
  },
  approver: {
    email: 'approver.media@acefinance.com',
    password: 'Approver@1234',
    role: 'APPROVER',
  },
  processor: {
    email: 'alisha.processor@acefinance.com',
    password: 'Processor@1234',
    role: 'PROCESSOR',
  },
};

/** Project both demo requester (GAC) and demo approver (Media) are assigned to. */
export const TEST_PROJECT = 'Google Art and culture (GAC)';

export function createClient(
  baseUrl = process.env.BASE_URL ||
    process.env.API_BASE ||
    'http://localhost:3001',
) {
  const BASE = baseUrl.replace(/\/$/, '');
  /** Undo steps registered during a scenario — run in reverse in finally (success or fail). */
  const cleanups = [];
  const tokens = {};

  async function api(token, method, path, body) {
    const isForm = body instanceof FormData;
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && !isForm
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body:
        body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
    const contentType = res.headers.get('content-type') || '';
    let json = null;
    let bytes = 0;
    if (contentType.includes('application/json')) {
      const text = await res.text();
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = { raw: text };
      }
    } else {
      bytes = (await res.arrayBuffer()).byteLength;
    }
    return { status: res.status, ok: res.ok, json, contentType, bytes };
  }

  async function apiOk(token, method, path, body) {
    const result = await api(token, method, path, body);
    if (!result.ok) {
      throw new Error(
        `${method} ${path} → ${result.status} ${JSON.stringify(result.json)}`,
      );
    }
    return result;
  }

  async function login(email, password) {
    const result = await api(null, 'POST', '/auth/login', { email, password });
    if (!result.ok)
      throw new Error(
        `Login failed (${email}): ${JSON.stringify(result.json)}`,
      );
    if (result.json?.requires2fa) {
      throw new Error(
        `Login for ${email} needs 2FA — use a password-only demo account`,
      );
    }
    if (!result.json?.access_token)
      throw new Error(`No access_token for ${email}`);
    return result.json.access_token;
  }

  /** Cached token for a demo role: admin | requester | approver | processor */
  async function as(role) {
    if (!tokens[role])
      tokens[role] = await login(DEMO[role].email, DEMO[role].password);
    return tokens[role];
  }

  function assert(label, cond, detail = '') {
    const ok = Boolean(cond);
    console.log(
      `${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`,
    );
    if (!ok) process.exitCode = 1;
    return ok;
  }

  function expectStatus(label, result, status) {
    const msg = result.json?.message
      ? ` (${[].concat(result.json.message).join(' ')})`
      : '';
    return assert(
      label,
      result.status === status,
      `HTTP ${result.status}${result.status === status ? '' : ` expected ${status}${msg}`}`,
    );
  }

  function onCleanup(label, fn) {
    cleanups.push({ label, fn });
  }

  async function cleanupCreated() {
    if (
      process.env.SKIP_CLEANUP === '1' ||
      process.env.SKIP_CLEANUP === 'true'
    ) {
      if (cleanups.length)
        console.log(`SKIP_CLEANUP — leaving ${cleanups.length} record(s)`);
      cleanups.length = 0;
      return;
    }
    if (!cleanups.length) return;
    const batch = cleanups.splice(0, cleanups.length).reverse();
    let okCount = 0;
    for (const { label, fn } of batch) {
      try {
        const r = await fn();
        if (!r || r.ok || r.status === 404) okCount += 1;
        else console.log(`CLEANUP WARN ${label}: HTTP ${r.status}`);
      } catch (e) {
        console.log(`CLEANUP WARN ${label}: ${e.message}`);
      }
    }
    console.log(`CLEANUP removed ${okCount}/${batch.length} test record(s)`);
  }

  /** Smallest valid PDF — used for invoice / receipt uploads. */
  function pdfFile(name = 'api-test.pdf') {
    const pdf =
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
      '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n';
    return { blob: new Blob([pdf], { type: 'application/pdf' }), name };
  }

  function form(fields, files = {}) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields))
      if (v !== undefined) fd.append(k, String(v));
    for (const [k, f] of Object.entries(files)) fd.append(k, f.blob, f.name);
    return fd;
  }

  return {
    BASE,
    api,
    apiOk,
    login,
    as,
    assert,
    expectStatus,
    onCleanup,
    cleanupCreated,
    pdfFile,
    form,
  };
}
