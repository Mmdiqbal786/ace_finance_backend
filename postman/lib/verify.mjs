#!/usr/bin/env node
/**
 * Aceolution Finance verify / smoke runner.
 *
 * Usage:
 *   node postman/lib/verify.mjs list
 *   node postman/lib/verify.mjs smoke|system|full
 *   node postman/lib/verify.mjs <scenario>
 *
 * Env:
 *   BASE_URL / API_BASE   default http://localhost:3001
 *   SKIP_CLEANUP=1        keep created test records
 *
 * WARNING: system/full scenarios CREATE records on the target DB (cleaned up afterwards)
 * and the expense flows send real notification emails to project approvers / processors.
 */
import { createClient, DEMO, TEST_PROJECT } from './api.mjs';

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n) =>
  new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const stamp = () => Date.now().toString().slice(-8);

// ─── Read-only scenarios ───

async function runHealth(c) {
  const r = await c.api(null, 'GET', '/health');
  c.expectStatus('GET /health', r, 200);
  c.assert('health status ok', r.json?.status === 'ok');
  const docs = await c.api(null, 'GET', '/api/docs-json');
  c.expectStatus('GET /api/docs-json (Swagger spec)', docs, 200);
  const ops = Object.values(docs.json?.paths || {}).reduce(
    (n, p) => n + Object.keys(p).length,
    0,
  );
  c.assert('Swagger documents all routes', ops >= 58, `${ops} operations`);
}

async function runNegatives(c) {
  c.expectStatus(
    'GET /expenses without token → 401',
    await c.api(null, 'GET', '/expenses'),
    401,
  );
  c.expectStatus(
    'GET /expenses with bad token → 401',
    await c.api('not-a-jwt', 'GET', '/expenses'),
    401,
  );
  const bad = await c.api(null, 'POST', '/auth/login', {
    email: DEMO.admin.email,
    password: 'wrong-password',
  });
  c.expectStatus('Login wrong password → 401', bad, 401);
  c.assert(
    'Login error message',
    bad.json?.message === 'Invalid email or password',
    bad.json?.message,
  );
  c.expectStatus(
    'Track unknown expense → 404',
    await c.api(null, 'GET', '/expenses/EXP-DOES-NOT-EXIST'),
    404,
  );
  c.expectStatus(
    'FX with non-numeric amount → 400',
    await c.api(null, 'GET', '/fx/convert?currency=INR&amount=abc'),
    400,
  );
  const noFile = await c.api(
    null,
    'POST',
    '/expenses',
    c.form({
      requesterName: 'API Test',
      requesterEmail: DEMO.requester.email,
      originalAmount: 10,
    }),
  );
  c.expectStatus('Submit expense without invoice → 400', noFile, 400);
  c.expectStatus(
    'Validate unknown reset token → 200 valid=false',
    await c.api(null, 'GET', '/auth/validate-reset-token?token=nope'),
    200,
  );
}

async function runAuthRoles(c) {
  for (const [key, acc] of Object.entries(DEMO)) {
    const token = await c.as(key);
    const me = await c.api(token, 'GET', '/users/me');
    c.expectStatus(`${key}: GET /users/me`, me, 200);
    c.assert(
      `${key}: role ${acc.role}`,
      me.json?.role === acc.role,
      me.json?.role,
    );
    c.assert(`${key}: email matches`, me.json?.email === acc.email);
    c.expectStatus(
      `${key}: GET /auth/totp/status`,
      await c.api(token, 'GET', '/auth/totp/status'),
      200,
    );
  }
}

async function runRbac(c) {
  const req = await c.as('requester');
  const appr = await c.as('approver');
  const proc = await c.as('processor');
  const admin = await c.as('admin');
  c.expectStatus(
    'REQUESTER GET /users → 403',
    await c.api(req, 'GET', '/users'),
    403,
  );
  c.expectStatus(
    'REQUESTER POST /projects → 403',
    await c.api(req, 'POST', '/projects', { name: 'x' }),
    403,
  );
  c.expectStatus(
    'REQUESTER DELETE /expenses/:id → 403',
    await c.api(req, 'DELETE', '/expenses/EXP-X'),
    403,
  );
  c.expectStatus(
    'APPROVER GET /users → 403',
    await c.api(appr, 'GET', '/users'),
    403,
  );
  c.expectStatus(
    'APPROVER PATCH partial-pay → 403',
    await c.api(appr, 'PATCH', '/expenses/EXP-X/partial-pay'),
    403,
  );
  c.expectStatus(
    'PROCESSOR PATCH approve → 403',
    await c.api(proc, 'PATCH', '/expenses/EXP-X/approve', {}),
    403,
  );
  c.expectStatus(
    'PROCESSOR PUT /expenses/:id → 403',
    await c.api(proc, 'PUT', '/expenses/EXP-X', {}),
    403,
  );
  c.expectStatus(
    'ADMIN GET /users → 200',
    await c.api(admin, 'GET', '/users'),
    200,
  );
}

async function runCatalogRead(c) {
  const admin = await c.as('admin');
  for (const name of ['projects', 'categories', 'countries']) {
    const active = await c.api(null, 'GET', `/${name}/active`);
    c.expectStatus(`GET /${name}/active (public)`, active, 200);
    c.assert(
      `${name}: active list not empty`,
      Array.isArray(active.json) && active.json.length > 0,
      `${active.json?.length} rows`,
    );
    c.expectStatus(
      `ADMIN GET /${name}`,
      await c.api(admin, 'GET', `/${name}`),
      200,
    );
  }
}

async function runDashboards(c) {
  const admin = await c.as('admin');
  const stats = await c.api(admin, 'GET', '/expenses/stats');
  c.expectStatus('ADMIN GET /expenses/stats', stats, 200);
  c.assert(
    'stats has totalRequests',
    typeof stats.json?.totalRequests === 'number',
    `${stats.json?.totalRequests}`,
  );

  const appr = await c.as('approver');
  const me = (await c.apiOk(appr, 'GET', '/users/me')).json;
  const list = await c.api(appr, 'GET', '/expenses');
  c.expectStatus('APPROVER GET /expenses', list, 200);
  const allowed = new Set(me.assignedProjects || []);
  c.assert(
    'APPROVER only sees assigned projects',
    (list.json || []).every((e) => allowed.has(e.project)),
    `${list.json?.length} rows across ${allowed.size} projects`,
  );

  const req = await c.as('requester');
  const mine = await c.api(req, 'GET', '/expenses/mine');
  c.expectStatus('REQUESTER GET /expenses/mine', mine, 200);
  c.assert(
    'mine only has own requests',
    (mine.json || []).every((e) => e.requesterEmail === DEMO.requester.email),
    `${mine.json?.length} rows`,
  );
}

async function runFx(c) {
  const r = await c.api(null, 'GET', '/fx/convert?currency=INR&amount=1500');
  c.expectStatus('GET /fx/convert INR 1500', r, 200);
  c.assert(
    'amountUsd > 0',
    r.json?.amountUsd > 0,
    `$${r.json?.amountUsd} @ ${r.json?.exchangeRate}`,
  );
}

async function runNotifications(c) {
  for (const role of Object.keys(DEMO)) {
    const token = await c.as(role);
    const list = await c.api(token, 'GET', '/notifications?limit=5');
    c.expectStatus(`${role}: GET /notifications`, list, 200);
    const count = await c.api(token, 'GET', '/notifications/unread-count');
    c.assert(
      `${role}: unread-count is a number`,
      typeof count.json?.count === 'number',
      `${count.json?.count}`,
    );
  }
}

// ─── Write scenarios (cleaned up afterwards) ───

async function runCatalogCrud(c) {
  const admin = await c.as('admin');
  const s = stamp();
  const specs = [
    {
      path: '/projects',
      create: { name: `API Test Project ${s}` },
      update: { name: `API Test Project ${s} (renamed)` },
    },
    {
      path: '/categories',
      create: { name: `API Test ${s}`, label: `API Test ${s}` },
      update: { label: 'Renamed' },
    },
    {
      path: '/countries',
      create: { name: `API Test Land ${s}`, currency: 'XTS' },
      update: { isActive: false },
    },
  ];
  for (const spec of specs) {
    const created = await c.api(admin, 'POST', spec.path, spec.create);
    if (!c.expectStatus(`POST ${spec.path}`, created, 201)) continue;
    const id = created.json._id;
    c.onCleanup(`${spec.path}/${id}`, () =>
      c.api(admin, 'DELETE', `${spec.path}/${id}`),
    );
    c.expectStatus(
      `POST ${spec.path} duplicate → 409`,
      await c.api(admin, 'POST', spec.path, spec.create),
      409,
    );
    const updated = await c.api(
      admin,
      'PUT',
      `${spec.path}/${id}`,
      spec.update,
    );
    c.expectStatus(`PUT ${spec.path}/:id`, updated, 200);
    c.expectStatus(
      `DELETE ${spec.path}/:id`,
      await c.api(admin, 'DELETE', `${spec.path}/${id}`),
      200,
    );
    c.expectStatus(
      `PUT ${spec.path}/:id after delete → 404`,
      await c.api(admin, 'PUT', `${spec.path}/${id}`, spec.update),
      404,
    );
  }
}

async function submitTestExpense(c, label) {
  const categories = (await c.apiOk(null, 'GET', '/categories/active')).json;
  const fields = {
    requesterName: 'API Test Requester',
    requesterEmail: DEMO.requester.email,
    originalAmount: 1000,
    country: 'India',
    category: categories[0].name,
    project: TEST_PROJECT,
    description: `[API TEST] ${label} — safe to delete`,
    date: today(),
    dueDate: plusDays(7),
    invoiceNumber: `API-${stamp()}`,
  };
  const created = await c.api(
    null,
    'POST',
    '/expenses',
    c.form(fields, { invoice: c.pdfFile('invoice.pdf') }),
  );
  if (!c.expectStatus('Submit expense (public multipart)', created, 201)) {
    throw new Error(`Submit failed: ${JSON.stringify(created.json)}`);
  }
  const id = created.json.id;
  const admin = await c.as('admin');
  c.onCleanup(`expense ${id}`, () => c.api(admin, 'DELETE', `/expenses/${id}`));
  c.assert(
    'status PENDING_APPROVER',
    created.json.status === 'PENDING_APPROVER',
    id,
  );
  c.assert(
    'converted to USD',
    created.json.amount > 0,
    `$${created.json.amount}`,
  );
  return id;
}

async function runExpenseFlow(c) {
  const id = await submitTestExpense(c, 'approve → partial pay → pay');
  const req = await c.as('requester');
  const appr = await c.as('approver');
  const proc = await c.as('processor');
  const admin = await c.as('admin');

  c.expectStatus(
    'Track expense (public)',
    await c.api(null, 'GET', `/expenses/${id}`),
    200,
  );
  c.expectStatus(
    'REQUESTER edit while pending → 400',
    await c.api(req, 'PUT', `/expenses/${id}`, { description: 'x' }),
    400,
  );
  c.expectStatus(
    'PROCESSOR reject before approval → 400',
    await c.api(proc, 'PATCH', `/expenses/${id}/processor-reject`, {
      notes: 'x',
    }),
    400,
  );

  const approved = await c.api(appr, 'PATCH', `/expenses/${id}/approve`, {
    notes: 'API test approve',
  });
  c.expectStatus('APPROVER approve', approved, 200);
  c.assert(
    'status APPROVED_APPROVER',
    approved.json?.status === 'APPROVED_APPROVER',
  );
  c.expectStatus(
    'Approve twice → 400',
    await c.api(appr, 'PATCH', `/expenses/${id}/approve`, {}),
    400,
  );

  const partial = await c.api(
    proc,
    'PATCH',
    `/expenses/${id}/partial-pay`,
    c.form(
      { amount: 1, notes: 'API test partial' },
      { receipt: c.pdfFile('receipt-1.pdf') },
    ),
  );
  c.expectStatus('PROCESSOR partial pay $1', partial, 200);
  c.assert(
    'status PARTIALLY_PAID',
    partial.json?.status === 'PARTIALLY_PAID',
    `paid $${partial.json?.paidAmount}`,
  );

  const paid = await c.api(
    proc,
    'PATCH',
    `/expenses/${id}/process`,
    c.form({ notes: 'API test paid' }, { receipt: c.pdfFile('receipt-2.pdf') }),
  );
  c.expectStatus('PROCESSOR pay remaining', paid, 200);
  c.assert('status PROCESSED', paid.json?.status === 'PROCESSED');
  c.assert(
    'fully paid',
    Math.abs((paid.json?.paidAmount || 0) - (paid.json?.amount || -1)) < 0.01,
  );

  const invoice = await c.api(admin, 'GET', `/expenses/${id}/invoice`);
  c.expectStatus('GET invoice (binary)', invoice, 200);
  c.assert(
    'invoice is a PDF',
    invoice.contentType.includes('application/pdf'),
    `${invoice.bytes} bytes`,
  );
  const receipt = paid.json?.paymentReceipts?.at(-1)?.fileName;
  const r = await c.api(
    admin,
    'GET',
    `/expenses/${id}/payment-receipt/${encodeURIComponent(receipt)}`,
  );
  c.expectStatus('GET payment receipt (binary)', r, 200);

  c.expectStatus(
    'ADMIN delete',
    await c.api(admin, 'DELETE', `/expenses/${id}`),
    200,
  );
  c.expectStatus(
    'Track after delete → 404',
    await c.api(null, 'GET', `/expenses/${id}`),
    404,
  );
}

async function runChangesFlow(c) {
  const id = await submitTestExpense(c, 'request changes → resubmit → reject');
  const req = await c.as('requester');
  const appr = await c.as('approver');

  c.expectStatus(
    'Request changes without notes → 400',
    await c.api(appr, 'PATCH', `/expenses/${id}/request-changes`, {
      target: 'requester',
    }),
    400,
  );
  const back = await c.api(appr, 'PATCH', `/expenses/${id}/request-changes`, {
    notes: 'API test — please fix the description',
    target: 'requester',
  });
  c.expectStatus('APPROVER request changes', back, 200);
  c.assert(
    'status CHANGES_REQUESTED',
    back.json?.status === 'CHANGES_REQUESTED',
  );

  const replaced = await c.api(
    req,
    'PATCH',
    `/expenses/${id}/invoice`,
    c.form({}, { invoice: c.pdfFile('invoice-v2.pdf') }),
  );
  c.expectStatus('REQUESTER replace invoice', replaced, 200);
  c.assert(
    'still CHANGES_REQUESTED after invoice replace',
    replaced.json?.status === 'CHANGES_REQUESTED',
  );

  const edited = await c.api(req, 'PUT', `/expenses/${id}`, {
    description: '[API TEST] fixed description',
  });
  c.expectStatus('REQUESTER edit + resubmit', edited, 200);
  c.assert(
    'status back to PENDING_APPROVER',
    edited.json?.status === 'PENDING_APPROVER',
  );
  c.expectStatus(
    'REQUESTER edit again after resubmit → 400',
    await c.api(req, 'PUT', `/expenses/${id}`, { description: 'x' }),
    400,
  );

  const rejected = await c.api(appr, 'PATCH', `/expenses/${id}/reject`, {
    notes: 'API test reject',
  });
  c.expectStatus('APPROVER reject', rejected, 200);
  c.assert(
    'status REJECTED_APPROVER',
    rejected.json?.status === 'REJECTED_APPROVER',
  );
}

async function runUsersCrud(c) {
  const admin = await c.as('admin');
  const email = `api.test.${stamp()}@example.com`;
  const created = await c.api(admin, 'POST', '/users', {
    name: 'API Test User',
    email,
    role: 'REQUESTER',
    assignedProjects: [TEST_PROJECT],
  });
  if (!c.expectStatus('ADMIN create user', created, 201)) return;
  const id = created.json._id;
  c.onCleanup(`user ${email}`, () => c.api(admin, 'DELETE', `/users/${id}`));
  c.assert(
    'mustChangePassword on new user',
    created.json.mustChangePassword === true,
  );
  c.expectStatus(
    'Create duplicate email → 409',
    await c.api(admin, 'POST', '/users', {
      name: 'Dup',
      email,
      role: 'REQUESTER',
    }),
    409,
  );
  const updated = await c.api(admin, 'PUT', `/users/${id}`, {
    role: 'APPROVER',
  });
  c.expectStatus('ADMIN update role', updated, 200);
  c.assert('role is APPROVER', updated.json?.role === 'APPROVER');
  c.expectStatus(
    'ADMIN delete user',
    await c.api(admin, 'DELETE', `/users/${id}`),
    200,
  );
}

const SCENARIOS = {
  health: { title: 'Health + Swagger spec reachable', run: runHealth },
  negatives: { title: 'Auth / validation negative checks', run: runNegatives },
  'auth-roles': {
    title: 'Login as each demo role + profile',
    run: runAuthRoles,
  },
  rbac: { title: 'Role guards (403 for wrong role)', run: runRbac },
  'catalog-read': {
    title: 'Public dropdowns + admin catalog lists',
    run: runCatalogRead,
  },
  dashboards: { title: 'Stats + role-scoped lists', run: runDashboards },
  fx: { title: 'FX conversion preview', run: runFx },
  notifications: {
    title: 'Notifications list + unread count per role',
    run: runNotifications,
  },
  'catalog-crud': {
    title: '[writes] Project / category / country create → update → delete',
    run: runCatalogCrud,
  },
  'expense-flow': {
    title:
      '[writes + emails] Submit → approve → partial pay → pay → files → delete',
    run: runExpenseFlow,
  },
  'changes-flow': {
    title: '[writes + emails] Submit → request changes → resubmit → reject',
    run: runChangesFlow,
  },
  'users-crud': {
    title: '[writes + email] User create → update → delete',
    run: runUsersCrud,
  },
};

/** Read-only — safe against live. */
const SUITE_SMOKE = [
  'health',
  'negatives',
  'auth-roles',
  'rbac',
  'catalog-read',
  'dashboards',
  'fx',
  'notifications',
];
/** Pre-push gate — smoke + write flows (cleaned up). */
const SUITE_SYSTEM = [
  ...SUITE_SMOKE,
  'catalog-crud',
  'expense-flow',
  'changes-flow',
];
/** Everything. */
const SUITE_FULL = [...SUITE_SYSTEM, 'users-crud'];

function printHelp() {
  console.log(
    'Usage: node postman/lib/verify.mjs <scenario|smoke|system|full|list>\n',
  );
  console.log('Scenarios:');
  for (const [name, s] of Object.entries(SCENARIOS))
    console.log(`  ${name.padEnd(14)} ${s.title}`);
  console.log(
    `\nSuites:\n  smoke   ${SUITE_SMOKE.join(', ')}\n  system  smoke + catalog-crud, expense-flow, changes-flow\n  full    system + users-crud`,
  );
  console.log(
    `\nBASE_URL=${process.env.BASE_URL || process.env.API_BASE || 'http://localhost:3001'}`,
  );
}

async function runOne(c, name) {
  console.log(`\n=== ${name} — ${SCENARIOS[name].title} ===`);
  try {
    await SCENARIOS[name].run(c);
  } catch (e) {
    c.assert(`${name} completed without error`, false, e.message);
  } finally {
    await c.cleanupCreated();
  }
}

export async function run(arg) {
  const key = String(arg || '')
    .toLowerCase()
    .trim();
  if (!key || ['list', 'help', '-h', '--help'].includes(key))
    return printHelp();

  const suites = { smoke: SUITE_SMOKE, system: SUITE_SYSTEM, full: SUITE_FULL };
  const names = suites[key] || (SCENARIOS[key] ? [key] : null);
  if (!names) {
    console.error(`Unknown scenario: ${key}`);
    printHelp();
    process.exitCode = 1;
    return;
  }

  const c = createClient();
  console.log(`Target: ${c.BASE}`);
  for (const name of names) await runOne(c, name);
  console.log(process.exitCode ? '\nRESULT: FAILED' : '\nRESULT: ALL PASSED');
}

run(process.argv[2]).catch((err) => {
  console.error(err);
  process.exit(1);
});
