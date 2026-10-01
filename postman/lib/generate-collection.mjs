/**
 * Generates the Aceolution Finance Postman collection (v2.1) with folders + saved examples.
 * Run: npm run postman:generate   (builds first — samples come from src/common/swagger via dist)
 * Output: postman/Aceolution-Finance.postman_collection.json  ← share this file only
 */
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const postmanRoot = join(__dirname, '..');
const require = createRequire(import.meta.url);
const dist = join(postmanRoot, '..', 'dist', 'common', 'swagger');

const S = require(join(dist, 'sop-data-samples.js'));
const E = require(join(dist, 'common-examples.js'));
const { SWAGGER_TAG_DESCRIPTIONS } = require(join(dist, 'api-guide.js'));

const LOCAL = 'http://localhost:3001';
const LIVE =
  'https://ace-finance-api-f5hnhhd6c3bvffhj.southindia-01.azurewebsites.net';

// ─── Error bodies (same shape as ApiExceptionFilter for JSON clients) ───
const ERROR_NAMES = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
};
const err = (statusCode, message) => ({
  statusCode,
  message,
  error: ERROR_NAMES[statusCode],
});

function example(name, status, body, opts = {}) {
  return {
    name,
    status: ERROR_NAMES[status] || (status === 201 ? 'Created' : 'OK'),
    code: status,
    _postman_previewlanguage: 'json',
    header: [{ key: 'Content-Type', value: 'application/json' }],
    cookie: [],
    body: typeof body === 'string' ? body : JSON.stringify(body, null, 2),
    _requestBody: opts.requestBody,
  };
}

/** Standard error examples, mirroring ApiSopResponses options on the controller. */
function stdErrors(sop = {}) {
  const out = [];
  if (sop.badRequest)
    out.push(example('400 Bad Request', 400, err(400, sop.badRequest)));
  if (typeof sop.auth === 'string')
    out.push(example('401 Unauthorized', 401, err(401, sop.auth)));
  else if (sop.auth !== false)
    out.push(example('401 Unauthorized', 401, err(401, 'Unauthorized')));
  if (sop.forbidden)
    out.push(example('403 Forbidden', 403, err(403, sop.forbidden)));
  else if (sop.roles?.length) {
    out.push(
      example(
        '403 Forbidden',
        403,
        err(403, `Access denied. Required role: ${sop.roles.join(' or ')}`),
      ),
    );
  }
  if (sop.notFound)
    out.push(example('404 Not Found', 404, err(404, sop.notFound)));
  if (sop.conflict)
    out.push(example('409 Conflict', 409, err(409, sop.conflict)));
  return out;
}

function url(path, query = []) {
  const raw = `{{baseUrl}}${path}`;
  return {
    raw: query.length
      ? `${raw}?${query.map((q) => `${q.key}=${q.value}`).join('&')}`
      : raw,
    host: ['{{baseUrl}}'],
    path: path.replace(/^\//, '').split('/').filter(Boolean),
    ...(query.length
      ? {
          query: query.map((q) => ({
            key: q.key,
            value: String(q.value),
            description:
              q.description || (q.required ? '[Required]' : '[Optional]'),
            disabled: q.disabled === true,
          })),
        }
      : {}),
  };
}

const q = (key, value, opts = {}) => ({ key, value, ...opts });
const text = (key, value, description) => ({
  key,
  value: String(value),
  type: 'text',
  description,
});
const file = (key, description) => ({
  key,
  type: 'file',
  src: [],
  description,
});

function req(opts) {
  const {
    name,
    method,
    path,
    body,
    formdata,
    query = [],
    description,
    examples = [],
    events,
    sop = {},
  } = opts;
  const request = { method, header: [], url: url(path, query) };
  if (sop.auth === false || typeof sop.auth === 'string')
    request.auth = { type: 'noauth' };
  if (body !== undefined) {
    request.header = [{ key: 'Content-Type', value: 'application/json' }];
    request.body = {
      mode: 'raw',
      raw: JSON.stringify(body, null, 2),
      options: { raw: { language: 'json' } },
    };
  }
  if (formdata) request.body = { mode: 'formdata', formdata };
  if (description) request.description = description;

  const item = { name, request };
  if (events)
    item.event = [
      { listen: 'test', script: { type: 'text/javascript', exec: events } },
    ];

  const all = [...examples, ...stdErrors(sop)];
  if (all.length) {
    item.response = all.map(({ _requestBody, ...ex }) => ({
      ...ex,
      originalRequest: {
        method,
        header: request.header,
        url: request.url,
        auth: request.auth,
        body:
          _requestBody !== undefined
            ? {
                mode: 'raw',
                raw: JSON.stringify(_requestBody, null, 2),
                options: { raw: { language: 'json' } },
              }
            : request.body,
      },
    }));
  }
  return item;
}

const howWhy = (why, how, extras) =>
  [
    `**Why:** ${why}`,
    '',
    `**How:** ${how}`,
    ...(extras ? ['', extras] : []),
  ].join('\n');

// ─── Tests scripts (save values into collection variables) ───
const saveTokens = [
  'const res = pm.response.json();',
  "if (res.access_token) { pm.collectionVariables.set('accessToken', res.access_token); console.log('accessToken saved'); }",
  "if (res.challengeToken) { pm.collectionVariables.set('challengeToken', res.challengeToken); console.log('2FA required: set otpCode, then run Verify 2FA'); }",
];
const saveId = (varName, expr) => [
  'const res = pm.response.json();',
  `const v = ${expr};`,
  `if (v) { pm.collectionVariables.set('${varName}', v); console.log('${varName} =', v); }`,
];
const saveReceipt = [
  'const receipts = (res && res.paymentReceipts) || [];',
  "if (receipts.length) pm.collectionVariables.set('receiptFileName', receipts[receipts.length - 1].fileName);",
];

const ADMIN = ['ADMIN'];
const EXP_NF = `Expense with ID ${S.EXPENSE_PENDING.id} not found`;
const folder = (name, when, item) => ({
  name,
  description: `${SWAGGER_TAG_DESCRIPTIONS[name]}\n**When:** ${when}`,
  item,
});

// ─── Collection ───
const collection = {
  info: {
    name: 'Aceolution Finance API',
    description: [
      '# Aceolution Finance API — Documentation SOP',
      '',
      'Kept in sync with Swagger (`/api/docs`). Generated by `npm run postman:generate`.',
      '',
      '## How & Why',
      'Each **folder** description explains Why / How / When to use those APIs.',
      'Full guide (flow, roles, statuses) is at the top of Swagger `/api/docs`.',
      '',
      'Flow: Login → Catalogs (projects / categories / countries) → Submit expense → Approve → Partial pay / Pay → Notifications.',
      '',
      '## Responses',
      'Success bodies are returned as-is (no envelope). Errors:',
      '```json',
      '{ "statusCode": 400, "message": "Cannot approve expense. Current status is PROCESSED", "error": "Bad Request" }',
      '```',
      '',
      '## Saved Examples on each request',
      '| Example | Meaning |',
      '|---------|---------|',
      '| **200 / 201** | Body you get back |',
      '| **400 Bad Request** | Business rule / missing field / wrong status |',
      '| **401 Unauthorized** | Missing or invalid Bearer token (or wrong password on Login) |',
      '| **403 Forbidden** | Signed in but role / project not allowed |',
      '| **404 Not Found** | Where applicable |',
      '| **409 Conflict** | Duplicate name / email |',
      '',
      '## Variables',
      '**Share for Teams / FE:** attach **only** `Aceolution-Finance.postman_collection.json` (one file).',
      'Collection already includes `baseUrl` and tokens — **no environment file required**.',
      '',
      '### Switch Local ↔ Azure (same collection)',
      'Postman → Collection → **Variables** → edit `baseUrl`:',
      '',
      '| Target | `baseUrl` value |',
      '|--------|-----------------|',
      `| Local | \`${LOCAL}\` |`,
      `| Azure (live) | \`${LIVE}\` |`,
      '',
      'Then run **Authentication → Login** — pick an account from the Login saved examples (Admin / Requester / Approver / Processor).',
      '',
      '| Variable | Purpose |',
      '|----------|---------|',
      '| `baseUrl` | API root (change this for Local vs Azure) |',
      '| `accessToken` | JWT — saved by Login / Verify 2FA Tests scripts |',
      '| `challengeToken` / `otpCode` | 2FA accounts: login saves the challenge, you type the code |',
      '| `expenseId` | Saved by Submit expense (or first row of List expenses) |',
      '| `receiptFileName` | Saved after a payment / when an expense has receipts |',
      '| `userId` / `projectId` / `categoryId` / `countryId` / `notificationId` | Saved by Create / List Tests scripts |',
      '',
      'Swagger: `{{baseUrl}}/api/docs`',
    ].join('\n'),
    schema:
      'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    { key: 'baseUrl', value: LOCAL },
    {
      key: 'baseUrlLocal',
      value: LOCAL,
      description: 'Copy into baseUrl for local testing',
    },
    {
      key: 'baseUrlAzure',
      value: LIVE,
      description: 'Copy into baseUrl for live Azure testing',
    },
    { key: 'accessToken', value: '' },
    { key: 'challengeToken', value: '' },
    {
      key: 'otpCode',
      value: '',
      description: '6-digit code from email / authenticator',
    },
    {
      key: 'resetToken',
      value: '',
      description: 'Token from the password reset link',
    },
    { key: 'expenseId', value: '' },
    { key: 'receiptFileName', value: '' },
    { key: 'userId', value: '' },
    { key: 'projectId', value: '' },
    { key: 'categoryId', value: '' },
    { key: 'countryId', value: '' },
    { key: 'notificationId', value: '' },
  ],
  auth: {
    type: 'bearer',
    bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }],
  },
  item: [],
};

// ─── Health ───
collection.item.push({
  name: 'Health',
  description: `${SWAGGER_TAG_DESCRIPTIONS.Health}\n**When:** Uptime checks / "is the API up?"`,
  item: [
    req({
      name: 'Health Check',
      method: 'GET',
      path: '/health',
      sop: { auth: false },
      description: 'Public liveness probe.',
      examples: [example('200 OK', 200, S.HEALTH_DATA)],
    }),
  ],
});

// ─── Authentication ───
const loginExamples = Object.values(E.LOGIN_EXAMPLES).map((ex) =>
  example(
    `201 ${ex.summary}`,
    201,
    { ...S.LOGIN_DATA, user: { ...S.SESSION_USER, email: ex.value.email } },
    { requestBody: ex.value },
  ),
);
collection.item.push(
  folder('Authentication', 'First request every session.', [
    req({
      name: 'Login',
      method: 'POST',
      path: '/auth/login',
      body: E.LOGIN_EXAMPLES.admin.value,
      sop: { auth: 'Invalid email or password' },
      description: howWhy(
        'Get the JWT used by every protected request.',
        'Send `{ email, password }` → Tests script saves `accessToken`. 2FA accounts return `challengeToken` instead → set `otpCode` → run **Verify 2FA**.',
        '**Demo accounts (password only):** see the saved examples — Admin, Requester GAC, Approver Media, Processor Alisha.',
      ),
      events: saveTokens,
      examples: [
        ...loginExamples,
        example('201 2FA required', 201, S.LOGIN_2FA_DATA),
      ],
    }),
    req({
      name: 'Verify 2FA',
      method: 'POST',
      path: '/auth/verify-2fa',
      body: {
        challengeToken: '{{challengeToken}}',
        code: '{{otpCode}}',
        method: 'email',
      },
      sop: {
        auth: 'Invalid or expired verification code.',
        badRequest: 'Enter the 6-digit verification code.',
      },
      description: howWhy(
        'Second sign-in step for 2FA accounts.',
        '`method`: `email` (OTP) or `totp` (authenticator). Saves `accessToken`.',
      ),
      events: saveTokens,
      examples: [example('201 Signed in', 201, S.LOGIN_DATA)],
    }),
    req({
      name: 'Resend login OTP',
      method: 'POST',
      path: '/auth/resend-otp',
      body: { challengeToken: '{{challengeToken}}' },
      sop: {
        auth: false,
        badRequest: 'We could not send the verification email (SMTP error).',
      },
      description: howWhy(
        'Code did not arrive.',
        'Same `challengeToken` → new code emailed.',
      ),
      events: saveTokens,
      examples: [example('201 Code re-sent', 201, S.LOGIN_2FA_DATA)],
    }),
    req({
      name: 'Forgot password',
      method: 'POST',
      path: '/auth/forgot-password',
      body: { email: 'requester.gac@acefinance.com' },
      sop: { auth: false },
      description: howWhy(
        'User forgot their password.',
        'Reset link emailed (same response even if no account).',
      ),
      examples: [
        example('201 Sent', 201, {
          message:
            'If an account exists for that email, a password reset link has been sent. Please check your inbox.',
        }),
      ],
    }),
    req({
      name: 'Validate reset token',
      method: 'GET',
      path: '/auth/validate-reset-token',
      query: [q('token', '{{resetToken}}', { required: true })],
      sop: { auth: false },
      description: howWhy(
        'Show "link expired" early.',
        'Pass the token from the reset link.',
      ),
      examples: [example('200 OK', 200, { valid: true })],
    }),
    req({
      name: 'Reset password',
      method: 'POST',
      path: '/auth/reset-password',
      body: {
        token: '{{resetToken}}',
        newPassword: 'NewPassword@123',
        confirmPassword: 'NewPassword@123',
      },
      sop: {
        auth: false,
        badRequest: 'Invalid or expired reset link. Please request a new one.',
      },
      description: howWhy(
        'Finish forgot-password.',
        'Token from the email + new password twice.',
      ),
      examples: [
        example('201 Updated', 201, {
          message: 'Your password has been updated. You can sign in now.',
        }),
      ],
    }),
    req({
      name: 'Change password',
      method: 'POST',
      path: '/auth/change-password',
      body: E.CHANGE_PASSWORD_EXAMPLES.change.value,
      sop: { badRequest: 'Current password is incorrect.' },
      description: howWhy(
        'Replace a temporary password or rotate it.',
        'Returns a fresh token (saved automatically).',
      ),
      events: saveTokens,
      examples: [example('201 Changed', 201, S.LOGIN_DATA)],
    }),
    req({
      name: 'Authenticator status',
      method: 'GET',
      path: '/auth/totp/status',
      description: howWhy(
        'Which authenticator UI to show.',
        'GET → enabled / required / canReplace / canDisable.',
      ),
      examples: [example('200 OK', 200, S.TOTP_STATUS_DATA)],
    }),
    req({
      name: 'Authenticator setup (QR)',
      method: 'POST',
      path: '/auth/totp/setup',
      sop: {
        badRequest:
          'Authenticator is already enabled. Use Change authenticator to replace it.',
      },
      description: howWhy(
        'Enroll an authenticator app.',
        'Render `qrCodeDataUrl` → scan → **Authenticator enable**.',
      ),
      examples: [example('201 QR generated', 201, S.TOTP_SETUP_DATA)],
    }),
    req({
      name: 'Authenticator enable',
      method: 'POST',
      path: '/auth/totp/enable',
      body: { code: '{{otpCode}}' },
      sop: {
        badRequest: 'Enter the 6-digit code from your authenticator app.',
      },
      description: howWhy(
        'Confirm enrolment / replacement.',
        'Code from the app → fresh token (saved).',
      ),
      events: saveTokens,
      examples: [
        example('201 Enabled', 201, {
          enabled: true,
          replaced: false,
          message: 'Authenticator app enabled. You can use it at sign-in.',
          ...S.LOGIN_DATA,
        }),
      ],
    }),
    req({
      name: 'Authenticator replace — send code',
      method: 'POST',
      path: '/auth/totp/replace/send-code',
      body: { password: 'Admin@1234' },
      sop: { badRequest: 'Current password is incorrect.' },
      description: howWhy('New phone — step 1.', 'Password → code emailed.'),
      examples: [example('201 Code sent', 201, S.EMAIL_CODE_SENT_DATA)],
    }),
    req({
      name: 'Authenticator replace — setup',
      method: 'POST',
      path: '/auth/totp/replace/setup',
      body: { password: 'Admin@1234', code: '{{otpCode}}' },
      sop: { badRequest: 'Enter the 6-digit code from your email.' },
      description: howWhy(
        'New phone — step 2.',
        'Password + emailed code → new QR → **Authenticator enable**.',
      ),
      examples: [
        example('201 New QR', 201, { ...S.TOTP_SETUP_DATA, replacing: true }),
      ],
    }),
    req({
      name: 'Authenticator disable — send code',
      method: 'POST',
      path: '/auth/totp/disable/send-code',
      body: { password: 'Admin@1234' },
      sop: { badRequest: 'Current password is incorrect.' },
      description: howWhy(
        'Turn off authenticator (admin) — step 1.',
        'Password → code emailed.',
      ),
      examples: [example('201 Code sent', 201, S.EMAIL_CODE_SENT_DATA)],
    }),
    req({
      name: 'Authenticator disable (admin only)',
      method: 'POST',
      path: '/auth/totp/disable',
      body: { password: 'Admin@1234', code: '{{otpCode}}' },
      sop: { badRequest: 'Current password is incorrect.' },
      description: howWhy(
        'Turn off authenticator — step 2.',
        'Password + emailed code.',
      ),
      examples: [
        example('201 Disabled', 201, {
          enabled: false,
          message:
            'Authenticator app disabled. Admin sign-in is password only again.',
        }),
      ],
    }),
    req({
      name: 'Seed (empty database only)',
      method: 'POST',
      path: '/auth/seed',
      sop: { auth: false },
      description: howWhy(
        'Bootstrap an empty database.',
        'POST once on a fresh database. Safe to repeat — existing records are skipped.',
      ),
      examples: [
        example('201 Skipped', 201, {
          created: false,
          message: 'Users already exist. Seed skipped.',
        }),
      ],
    }),
  ]),
);

// ─── Expenses ───
collection.item.push(
  folder(
    'Expenses',
    'Request form, dashboard, approver and processor actions.',
    [
      req({
        name: 'Submit expense (public, multipart)',
        method: 'POST',
        path: '/expenses',
        formdata: [
          text('requesterName', 'Requester GAC', '[Required]'),
          text(
            'requesterEmail',
            'requester.gac@acefinance.com',
            '[Required] Requesters must be assigned to the project',
          ),
          text(
            'originalAmount',
            1500,
            '[Required] Amount in the country currency',
          ),
          text(
            'country',
            'India',
            '[Required] Name from GET /countries/active',
          ),
          text(
            'category',
            'Travel',
            '[Required] Name from GET /categories/active',
          ),
          text(
            'project',
            'Google Art and culture (GAC)',
            '[Required] Name from GET /projects/active',
          ),
          text('description', 'Client visit travel', '[Required]'),
          text('date', '2026-10-01', '[Required] YYYY-MM-DD'),
          text('dueDate', '2026-10-15', '[Required] On/after date'),
          text('invoiceNumber', 'INV-1001', '[Optional]'),
          text('invoiceDate', '2026-09-30', '[Optional]'),
          file(
            'invoice',
            '[Required] PDF / JPG / PNG / WEBP / GIF, max 5 MB — click "Select Files"',
          ),
        ],
        sop: {
          auth: false,
          badRequest: 'Invoice attachment is required.',
          forbidden:
            'You are not assigned to project "Google News Lab (GNL)". Contact an administrator.',
        },
        description: howWhy(
          'Requester raises a new expense with its invoice.',
          'Pick a file for `invoice`, Send → Tests script saves `expenseId`. Approvers of the project are emailed.',
        ),
        events: saveId('expenseId', 'res.id'),
        examples: [example('201 Created', 201, S.EXPENSE_PENDING)],
      }),
      req({
        name: 'Track expense by ID (public)',
        method: 'GET',
        path: '/expenses/{{expenseId}}',
        sop: { auth: false, notFound: EXP_NF },
        description: howWhy(
          'Public tracking page / request detail.',
          'No auth. Includes the `history` timeline.',
        ),
        events: ['const res = pm.response.json();', ...saveReceipt],
        examples: [example('200 OK', 200, S.EXPENSE_APPROVED)],
      }),
      req({
        name: 'List expenses (role-scoped)',
        method: 'GET',
        path: '/expenses',
        query: [
          q('email', 'requester.gac@acefinance.com', {
            disabled: true,
            description: '[Optional] Filter by requester',
          }),
        ],
        description: howWhy(
          'Dashboard table.',
          'Approvers only see assigned projects. Saves the first `expenseId` if empty.',
        ),
        events: [
          'const res = pm.response.json();',
          "if (Array.isArray(res) && res.length && !pm.collectionVariables.get('expenseId')) pm.collectionVariables.set('expenseId', res[0].id);",
        ],
        examples: [
          example('200 OK', 200, [S.EXPENSE_PENDING, S.EXPENSE_PROCESSED]),
        ],
      }),
      req({
        name: 'My expenses',
        method: 'GET',
        path: '/expenses/mine',
        description: howWhy(
          'Requester → "My requests".',
          'Expenses where requesterEmail = you.',
        ),
        examples: [example('200 OK', 200, [S.EXPENSE_CHANGES_REQUESTED])],
      }),
      req({
        name: 'Dashboard stats',
        method: 'GET',
        path: '/expenses/stats',
        description: howWhy(
          'Dashboard cards + chart.',
          'Scoped like List expenses. Amounts in USD.',
        ),
        examples: [example('200 OK', 200, S.STATS_DATA)],
      }),
      req({
        name: 'View invoice (binary)',
        method: 'GET',
        path: '/expenses/{{expenseId}}/invoice',
        sop: { notFound: 'No invoice attached to this expense.' },
        description: howWhy(
          'Open the invoice.',
          'Returns the file (PDF / image). Use "Send and Download".',
        ),
      }),
      req({
        name: 'View payment receipt (binary)',
        method: 'GET',
        path: '/expenses/{{expenseId}}/payment-receipt/{{receiptFileName}}',
        sop: { notFound: 'Payment receipt not found on this expense.' },
        description: howWhy(
          'Open a processor receipt.',
          '`receiptFileName` is saved after a payment or Track expense.',
        ),
      }),
      req({
        name: 'Approve (APPROVER / ADMIN)',
        method: 'PATCH',
        path: '/expenses/{{expenseId}}/approve',
        body: E.APPROVE_EXAMPLES.withNotes.value,
        sop: {
          roles: ['APPROVER', 'ADMIN'],
          badRequest: 'Cannot approve expense. Current status is PROCESSED',
          notFound: EXP_NF,
        },
        description: howWhy(
          'Accept → goes to processors.',
          'Status must be PENDING_APPROVER; approvers only for assigned projects.',
        ),
        examples: [example('200 Approved', 200, S.EXPENSE_APPROVED)],
      }),
      req({
        name: 'Reject (APPROVER / ADMIN)',
        method: 'PATCH',
        path: '/expenses/{{expenseId}}/reject',
        body: E.REJECT_EXAMPLES.withNotes.value,
        sop: {
          roles: ['APPROVER', 'ADMIN'],
          badRequest:
            'Cannot reject expense. Current status is APPROVED_APPROVER',
          notFound: EXP_NF,
        },
        description: howWhy(
          'Decline (final).',
          'Status must be PENDING_APPROVER.',
        ),
        examples: [example('200 Rejected', 200, S.EXPENSE_REJECTED)],
      }),
      req({
        name: 'Request changes',
        method: 'PATCH',
        path: '/expenses/{{expenseId}}/request-changes',
        body: E.REQUEST_CHANGES_EXAMPLES.toRequester.value,
        sop: {
          roles: ['APPROVER', 'PROCESSOR', 'ADMIN'],
          badRequest: 'Notes are required when requesting changes.',
          notFound: EXP_NF,
        },
        description: howWhy(
          'Send back for fixes.',
          '`target`: `requester` (approver / processor) or `approver` (processor only, undoes approval). `notes` required.',
        ),
        examples: [
          example('200 Sent to requester', 200, S.EXPENSE_CHANGES_REQUESTED, {
            requestBody: E.REQUEST_CHANGES_EXAMPLES.toRequester.value,
          }),
          example(
            '200 Sent back to approver',
            200,
            {
              ...S.EXPENSE_PENDING,
              changeRequestNotes: 'Amount does not match the invoice',
            },
            {
              requestBody: E.REQUEST_CHANGES_EXAMPLES.toApprover.value,
            },
          ),
        ],
      }),
      req({
        name: 'Partial pay (PROCESSOR / ADMIN, multipart)',
        method: 'PATCH',
        path: '/expenses/{{expenseId}}/partial-pay',
        formdata: [
          text('amount', 5, '[Required] USD paid now (less than remaining)'),
          text('notes', 'First instalment', '[Optional]'),
          file('receipt', '[Required] Payment receipt — PDF / image, max 5 MB'),
        ],
        sop: {
          roles: ['PROCESSOR', 'ADMIN'],
          badRequest: 'Payment amount must be greater than $0.00',
          notFound: EXP_NF,
        },
        description: howWhy(
          'Pay in instalments.',
          'Status APPROVED_APPROVER or PARTIALLY_PAID. Saves `receiptFileName`.',
        ),
        events: ['const res = pm.response.json();', ...saveReceipt],
        examples: [
          example('200 Partially paid', 200, S.EXPENSE_PARTIALLY_PAID),
        ],
      }),
      req({
        name: 'Pay remaining (PROCESSOR / ADMIN, multipart)',
        method: 'PATCH',
        path: '/expenses/{{expenseId}}/process',
        formdata: [
          text('notes', 'Paid via bank transfer', '[Optional]'),
          file('receipt', '[Required] Payment receipt — PDF / image, max 5 MB'),
        ],
        sop: {
          roles: ['PROCESSOR', 'ADMIN'],
          badRequest: 'Payment receipt attachment is required.',
          notFound: EXP_NF,
        },
        description: howWhy(
          'Complete payment → PROCESSED.',
          'Pays whatever USD is still owed. Saves `receiptFileName`.',
        ),
        events: ['const res = pm.response.json();', ...saveReceipt],
        examples: [example('200 Processed', 200, S.EXPENSE_PROCESSED)],
      }),
      req({
        name: 'Reject at payment (PROCESSOR / ADMIN)',
        method: 'PATCH',
        path: '/expenses/{{expenseId}}/processor-reject',
        body: { notes: 'Bank details missing' },
        sop: {
          roles: ['PROCESSOR', 'ADMIN'],
          badRequest: 'Cannot reject expense. Current status is PROCESSED',
          notFound: EXP_NF,
        },
        description: howWhy(
          'Processor cannot pay (final).',
          'Status APPROVED_APPROVER or PARTIALLY_PAID.',
        ),
        examples: [example('200 Rejected', 200, S.EXPENSE_PROCESSOR_REJECTED)],
      }),
      req({
        name: 'Edit / resubmit expense (REQUESTER own / ADMIN)',
        method: 'PUT',
        path: '/expenses/{{expenseId}}',
        body: E.UPDATE_EXPENSE_EXAMPLES.resubmit.value,
        sop: {
          roles: ['ADMIN', 'REQUESTER'],
          badRequest:
            'You can only edit a request after staff has requested changes.',
          notFound: EXP_NF,
        },
        description: howWhy(
          'Fix a request after "changes requested".',
          'Any subset of JSON fields → back to PENDING_APPROVER. Only while status is CHANGES_REQUESTED.',
        ),
        examples: [example('200 Resubmitted', 200, S.EXPENSE_PENDING)],
      }),
      req({
        name: 'Replace invoice (multipart)',
        method: 'PATCH',
        path: '/expenses/{{expenseId}}/invoice',
        formdata: [
          file('invoice', '[Required] New invoice — PDF / image, max 5 MB'),
        ],
        sop: {
          roles: ['ADMIN', 'REQUESTER'],
          badRequest:
            'You can only edit a request after staff has requested changes.',
          notFound: EXP_NF,
        },
        description: howWhy(
          'Attach a corrected invoice while editing.',
          'Only while CHANGES_REQUESTED — do this before Edit / resubmit.',
        ),
        examples: [example('200 Replaced', 200, S.EXPENSE_CHANGES_REQUESTED)],
      }),
      req({
        name: 'Delete expense (ADMIN / APPROVER / PROCESSOR)',
        method: 'DELETE',
        path: '/expenses/{{expenseId}}',
        sop: { roles: ['ADMIN', 'APPROVER', 'PROCESSOR'], notFound: EXP_NF },
        description: howWhy(
          'Remove a duplicate / test request.',
          'Deletes whatever `expenseId` is set — run **Submit expense** first so it points at a test record. Deletes invoice + receipts too. Empty 200 body.',
        ),
        examples: [example('200 Deleted (empty body)', 200, '')],
      }),
    ],
  ),
);

// ─── Users ───
collection.item.push(
  folder('Users', 'Profile screen; Admin → Users.', [
    req({
      name: 'My profile',
      method: 'GET',
      path: '/users/me',
      description: howWhy('Profile / header.', 'Any role.'),
      examples: [example('200 OK', 200, S.PROFILE_DATA)],
    }),
    req({
      name: 'Update my name',
      method: 'PUT',
      path: '/users/me',
      body: { name: 'Jane Doe' },
      sop: {
        badRequest: 'Name is required.',
        conflict: 'Name must be at least 2 characters.',
      },
      description: howWhy('Profile → edit name.', 'Any role.'),
      examples: [
        example('200 Updated', 200, { ...S.PROFILE_DATA, name: 'Jane Doe' }),
      ],
    }),
    req({
      name: 'List users (ADMIN)',
      method: 'GET',
      path: '/users',
      sop: { roles: ADMIN },
      description: howWhy('Admin → Users table.', 'Password never returned.'),
      examples: [example('200 OK', 200, [S.USER_ROW])],
    }),
    req({
      name: 'Create user (ADMIN)',
      method: 'POST',
      path: '/users',
      body: E.CREATE_USER_EXAMPLES.requiredOnly.value,
      sop: {
        roles: ADMIN,
        conflict: 'User with email jane.doe@example.com already exists',
      },
      description: howWhy(
        'Invite a user.',
        'Omit `password` to auto-generate + email a temporary one. Saves `userId`.',
        'Required: name, email, role. REQUESTER / APPROVER also need assignedProjects.',
      ),
      events: saveId('userId', 'res._id'),
      examples: Object.values(E.CREATE_USER_EXAMPLES).map((ex) =>
        example(
          `201 ${ex.summary}`,
          201,
          { ...S.USER_CREATED_DATA, ...ex.value, password: undefined },
          {
            requestBody: ex.value,
          },
        ),
      ),
    }),
    req({
      name: 'Update user (ADMIN)',
      method: 'PUT',
      path: '/users/{{userId}}',
      body: E.UPDATE_USER_EXAMPLES.changeRole.value,
      sop: { roles: ADMIN, notFound: `User ${S.USER_ROW._id} not found` },
      description: howWhy(
        'Change role / projects / active flag / reset password.',
        'Any subset of fields.',
      ),
      examples: Object.values(E.UPDATE_USER_EXAMPLES).map((ex) =>
        example(
          `200 ${ex.summary}`,
          200,
          { ...S.USER_ROW, ...ex.value, password: undefined },
          { requestBody: ex.value },
        ),
      ),
    }),
    req({
      name: 'Delete user (ADMIN)',
      method: 'DELETE',
      path: '/users/{{userId}}',
      sop: { roles: ADMIN, notFound: `User ${S.USER_ROW._id} not found` },
      description: howWhy(
        'Remove an account.',
        'Permanent. Deletes whatever `userId` is set (saved by Create user).',
      ),
      examples: [
        example('200 Deleted', 200, { message: 'User deleted successfully' }),
      ],
    }),
  ]),
);

// ─── Catalogs (Projects / Categories / Countries) ───
function catalogFolder({
  name,
  path,
  row,
  varName,
  label,
  createBody,
  updateBody,
  createBad,
  updateBad,
}) {
  const nf = `${label} ${row._id} not found`;
  const dup = `${label} "${row.name}" already exists`;
  return folder(name, 'Request form dropdowns; Admin → ' + name + '.', [
    req({
      name: `Active ${name.toLowerCase()} (public)`,
      method: 'GET',
      path: `${path}/active`,
      sop: { auth: false },
      description: howWhy(
        'Dropdown on the request form.',
        'No auth. Send the `name` on POST /expenses.',
      ),
      examples: [example('200 OK', 200, [row])],
    }),
    req({
      name: `All ${name.toLowerCase()} (ADMIN)`,
      method: 'GET',
      path,
      sop: { roles: ADMIN },
      description: howWhy(`Admin → ${name} table.`, 'Active + inactive.'),
      examples: [example('200 OK', 200, [row])],
    }),
    req({
      name: `Create ${label.toLowerCase()} (ADMIN)`,
      method: 'POST',
      path,
      body: createBody,
      sop: { roles: ADMIN, badRequest: createBad, conflict: dup },
      description: howWhy(
        `Add a ${label.toLowerCase()}.`,
        `Saves \`${varName}\`.`,
      ),
      events: saveId(varName, 'res._id'),
      examples: [example('201 Created', 201, { ...row, ...createBody })],
    }),
    req({
      name: `Update ${label.toLowerCase()} (ADMIN)`,
      method: 'PUT',
      path: `${path}/{{${varName}}}`,
      body: updateBody,
      sop: { roles: ADMIN, badRequest: updateBad, notFound: nf, conflict: dup },
      description: howWhy(
        'Rename / change / deactivate.',
        `Any subset of fields. Uses \`${varName}\`.`,
      ),
      examples: [example('200 Updated', 200, { ...row, ...updateBody })],
    }),
    req({
      name: `Delete ${label.toLowerCase()} (ADMIN)`,
      method: 'DELETE',
      path: `${path}/{{${varName}}}`,
      sop: { roles: ADMIN, notFound: nf },
      description: howWhy(
        'Remove one created by mistake.',
        `Deletes whatever \`${varName}\` is set (saved by Create). Prefer deactivating if expenses already use it.`,
      ),
      examples: [
        example('200 Deleted', 200, {
          message: `${label} deleted successfully`,
        }),
      ],
    }),
  ]);
}

collection.item.push(
  catalogFolder({
    name: 'Projects',
    path: '/projects',
    row: S.PROJECT_ROW,
    varName: 'projectId',
    label: 'Project',
    createBody: E.CREATE_PROJECT_EXAMPLES.create.value,
    updateBody: E.UPDATE_PROJECT_EXAMPLES.rename.value,
    createBad: 'Name is required',
    updateBad: 'Name cannot be empty',
  }),
  catalogFolder({
    name: 'Categories',
    path: '/categories',
    row: S.CATEGORY_ROW,
    varName: 'categoryId',
    label: 'Category',
    createBody: E.CREATE_CATEGORY_EXAMPLES.create.value,
    updateBody: E.UPDATE_CATEGORY_EXAMPLES.relabel.value,
    createBad: 'Name and label are required',
    updateBad: 'Label cannot be empty',
  }),
  catalogFolder({
    name: 'Countries',
    path: '/countries',
    row: S.COUNTRY_ROW,
    varName: 'countryId',
    label: 'Country',
    createBody: E.CREATE_COUNTRY_EXAMPLES.create.value,
    updateBody: E.UPDATE_COUNTRY_EXAMPLES.currency.value,
    createBad: 'Currency must be a 3-letter code like USD, INR, or AED',
    updateBad: 'Currency must be a 3-letter code like USD, INR, or AED',
  }),
);

// ─── Notifications ───
collection.item.push(
  folder('Notifications', 'Bell icon + badge.', [
    req({
      name: 'List notifications',
      method: 'GET',
      path: '/notifications',
      query: [q('limit', 30, { description: '[Optional] Default 30' })],
      description: howWhy(
        'Bell dropdown.',
        'Newest first. Saves the first `notificationId`.',
      ),
      events: saveId(
        'notificationId',
        'Array.isArray(res) && res[0] && res[0].id',
      ),
      examples: [example('200 OK', 200, [S.NOTIFICATION_ROW])],
    }),
    req({
      name: 'Unread count',
      method: 'GET',
      path: '/notifications/unread-count',
      description: howWhy('Bell badge.', 'Poll this.'),
      examples: [example('200 OK', 200, { count: 3 })],
    }),
    req({
      name: 'Mark all read',
      method: 'PATCH',
      path: '/notifications/read-all',
      description: howWhy(
        '"Mark all as read".',
        'Returns how many were updated.',
      ),
      examples: [example('200 OK', 200, { updated: 3 })],
    }),
    req({
      name: 'Mark one read',
      method: 'PATCH',
      path: '/notifications/{{notificationId}}/read',
      sop: { notFound: 'Notification not found' },
      description: howWhy(
        'User opened a notification.',
        'Uses `notificationId`.',
      ),
      examples: [
        example('200 OK', 200, { id: S.NOTIFICATION_ROW.id, isRead: true }),
      ],
    }),
  ]),
);

// ─── FX ───
collection.item.push(
  folder('FX', 'Typing an amount on the request form.', [
    req({
      name: 'Convert to USD (public)',
      method: 'GET',
      path: '/fx/convert',
      query: [
        q('currency', 'INR', { required: true }),
        q('amount', 1500, { required: true }),
      ],
      sop: { auth: false, badRequest: 'amount query must be a number' },
      description: howWhy(
        '"≈ $15.63 USD" preview.',
        "Today's rate — same conversion stored on submit.",
      ),
      examples: [example('200 OK', 200, S.FX_DATA)],
    }),
  ]),
);

const outCollection = join(
  postmanRoot,
  'Aceolution-Finance.postman_collection.json',
);
writeFileSync(outCollection, JSON.stringify(collection, null, 2) + '\n');

const countRequests = (items) =>
  items.reduce((n, it) => n + (it.item ? countRequests(it.item) : 1), 0);
const countExamples = (items) =>
  items.reduce(
    (n, it) =>
      n + (it.item ? countExamples(it.item) : it.response?.length || 0),
    0,
  );

console.log(`Wrote ${outCollection}`);
console.log(`Requests: ${countRequests(collection.item)}`);
console.log(`Saved examples: ${countExamples(collection.item)}`);
console.log(
  'Collection is self-contained (no separate env files). Switch Local/Azure via the baseUrl variable.',
);
