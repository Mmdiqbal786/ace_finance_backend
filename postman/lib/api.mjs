/**
 * Shared HTTP helpers for postman verify / VAPT scenarios.
 */

/** Password-only demo accounts (no OTP / authenticator). Prefer Demo Access login. */
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
  /** Second requester for IDOR / peer checks (News projects). */
  requesterNews: {
    email: 'requester.news@acefinance.com',
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

export function demoAccessCode() {
  return (process.env.DEMO_ACCESS_CODE || 'Aceolution_2024').trim();
}

/** Prefer demo store for automated writes against shared Azure. */
export function testStore() {
  const s = (process.env.TEST_STORE || 'demo').trim().toLowerCase();
  return s === 'live' ? 'live' : 'demo';
}

export function createClient(
  baseUrl = process.env.BASE_URL ||
    process.env.API_BASE ||
    'http://localhost:3001',
) {
  const BASE = baseUrl.replace(/\/$/, '');
  /** Undo steps registered during a scenario — run in reverse in finally (success or fail). */
  const cleanups = [];
  const tokens = {};

  async function api(
    token,
    method,
    path,
    body,
    extraHeaders = {},
    fetchOpts = {},
  ) {
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
    const res = await fetch(`${BASE}${path}`, {
      method,
      redirect: fetchOpts.redirect || 'follow',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && !isForm
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...extraHeaders,
      },
      body:
        body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
    const contentType = res.headers.get('content-type') || '';
    const headers = {};
    res.headers.forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });
    let json = null;
    let bytes = 0;
    let text = '';
    if (contentType.includes('application/json')) {
      text = await res.text();
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = { raw: text };
      }
    } else {
      const buf = await res.arrayBuffer();
      bytes = buf.byteLength;
      text = '';
    }
    return {
      status: res.status,
      ok: res.ok,
      json,
      contentType,
      bytes,
      headers,
      text,
    };
  }

  async function apiOk(token, method, path, body, extraHeaders) {
    const result = await api(token, method, path, body, extraHeaders);
    if (!result.ok) {
      throw new Error(
        `${method} ${path} → ${result.status} ${JSON.stringify(result.json)}`,
      );
    }
    return result;
  }

  /**
   * Admin password login → choose Live/Demo when dual-store.
   * Demo personas → Demo Access login (requires DEMO_ACCESS_CODE on live).
   */
  async function loginRole(roleKey) {
    const acc = DEMO[roleKey];
    if (!acc) throw new Error(`Unknown demo role: ${roleKey}`);

    if (roleKey === 'admin') {
      const result = await api(null, 'POST', '/auth/login', {
        email: acc.email,
        password: acc.password,
      });
      if (!result.ok) {
        throw new Error(
          `Admin login failed: ${JSON.stringify(result.json)}`,
        );
      }
      if (result.json?.requires2fa) {
        throw new Error('Admin login needs 2FA — unexpected for this account');
      }
      if (result.json?.requiresWorkspaceChoice && result.json?.workspaceToken) {
        const sel = await api(null, 'POST', '/auth/select-workspace', {
          workspaceToken: result.json.workspaceToken,
          store: testStore(),
        });
        if (!sel.ok || !sel.json?.access_token) {
          throw new Error(
            `Admin select-workspace failed: ${JSON.stringify(sel.json)}`,
          );
        }
        return sel.json.access_token;
      }
      if (!result.json?.access_token) {
        throw new Error(`No access_token for admin: ${JSON.stringify(result.json)}`);
      }
      return result.json.access_token;
    }

    const code = demoAccessCode();
    const result = await api(
      null,
      'POST',
      '/auth/demo-login',
      {
        email: acc.email,
        password: acc.password,
        accessCode: code,
      },
      { 'X-Demo-Access-Code': code },
    );
    if (!result.ok || !result.json?.access_token) {
      throw new Error(
        `Demo login failed (${acc.email}): ${JSON.stringify(result.json)}`,
      );
    }
    return result.json.access_token;
  }

  /** Cached token for a demo role key in DEMO */
  async function as(role) {
    if (!tokens[role]) tokens[role] = await loginRole(role);
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

  /** Smallest valid PDF — unique body so hard-hash duplicate checks stay independent. */
  function pdfFile(name = 'api-test.pdf', unique = `${Date.now()}-${Math.random()}`) {
    const pdf =
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
      `3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n` +
      `4 0 obj<</Length 20>>stream\n${unique}\nendstream\nendobj\n` +
      'trailer<</Root 1 0 R>>\n%%EOF\n';
    return { blob: new Blob([pdf], { type: 'application/pdf' }), name };
  }

  /** Fake EXE bytes with .pdf name — should fail magic-byte check. */
  function fakeExeAsPdf(name = 'not-a-pdf.pdf') {
    const bytes = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    return { blob: new Blob([bytes], { type: 'application/pdf' }), name };
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
    as,
    assert,
    expectStatus,
    onCleanup,
    cleanupCreated,
    pdfFile,
    fakeExeAsPdf,
    form,
  };
}
