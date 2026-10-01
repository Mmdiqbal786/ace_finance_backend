/**
 * Representative response bodies for Swagger "Example Value" and the Postman saved examples.
 * Shapes mirror the live API (captured from real responses). Success bodies are returned as-is (no envelope).
 */

const TS = '2026-10-01T10:00:00.000Z';

export const DEMO_USERS = {
  admin: { email: 'finance@aceolution.com', password: 'Admin@1234' },
  requester: {
    email: 'requester.gac@acefinance.com',
    password: 'Requester@1234',
  },
  approver: {
    email: 'approver.media@acefinance.com',
    password: 'Approver@1234',
  },
  processor: {
    email: 'alisha.processor@acefinance.com',
    password: 'Processor@1234',
  },
};

export const SESSION_USER = {
  id: '6a50db2fa55b28bc2cbeae9e',
  name: 'Admin',
  email: 'finance@aceolution.com',
  role: 'ADMIN',
  mustChangePassword: false,
  mustSetupTotp: false,
  totpEnabled: false,
  assignedProjects: [],
  isDemo: false,
};

export const LOGIN_DATA = {
  access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  user: SESSION_USER,
};

export const LOGIN_2FA_DATA = {
  requires2fa: true,
  challengeToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  methods: ['email'],
  emailHint: 'iq***@gmail.com',
  message: 'Enter the 6-digit code we sent to your email.',
};

export const TOTP_STATUS_DATA = {
  available: true,
  enabled: false,
  pendingSetup: false,
  required: true,
  canDisable: false,
  canReplace: false,
  isDemo: false,
};

export const TOTP_SETUP_DATA = {
  secret: 'JBSWY3DPEHPK3PXP',
  otpauthUrl:
    'otpauth://totp/Aceolution%20Finance:user%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Aceolution%20Finance',
  qrCodeDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
  message:
    'Scan the QR code with your authenticator app, then enter a code to enable it.',
};

export const EMAIL_CODE_SENT_DATA = {
  sent: true,
  emailHint: 'iq***@gmail.com',
  message: 'We sent a 6-digit code to your email.',
};

export const PROFILE_DATA = {
  id: '6a50db2fa55b28bc2cbeae9e',
  name: 'Admin',
  email: 'finance@aceolution.com',
  role: 'ADMIN',
  assignedProjects: [],
  isDemo: false,
};

export const USER_ROW = {
  _id: '6a8d927f07ae621252b8c896',
  name: 'Priya Sharma',
  email: 'priya.processor@acefinance.com',
  role: 'PROCESSOR',
  isActive: true,
  mustChangePassword: false,
  totpEnabled: false,
  assignedProjects: [],
  isDemo: true,
  createdAt: '2026-08-25T13:02:55.671Z',
  updatedAt: '2026-08-25T13:02:55.671Z',
};

export const USER_CREATED_DATA = {
  _id: '6a9e1c2f07ae621252b8c9a1',
  name: 'Jane Doe',
  email: 'jane.doe@example.com',
  role: 'REQUESTER',
  isActive: true,
  mustChangePassword: true,
  assignedProjects: ['Google Art and culture (GAC)'],
  createdAt: TS,
  updatedAt: TS,
  welcomeEmailSent: true,
};

export const EXPENSE_PENDING = {
  _id: '6a9e1d0adf537180a3ec1900',
  id: 'EXP-1790000000000-1234',
  requesterName: 'Requester GAC',
  requesterEmail: 'requester.gac@acefinance.com',
  amount: 15.63,
  paidAmount: 0,
  originalAmount: 1500,
  country: 'India',
  currency: 'INR',
  exchangeRate: 0.010417,
  exchangeRateDate: 'Thu, 01 Oct 2026',
  category: 'Travel',
  project: 'Google Art and culture (GAC)',
  description: 'Client visit travel',
  date: '2026-10-01',
  dueDate: '2026-10-15',
  invoiceNumber: 'INV-1001',
  invoiceDate: '2026-09-30',
  status: 'PENDING_APPROVER',
  submittedAt: TS,
  invoiceFileName: 'EXP-1790000000000-1234_2026-10-01_10-00-00_000_invoice.pdf',
  invoiceOriginalName: 'invoice.pdf',
  invoiceMimeType: 'application/pdf',
  invoiceSize: 48213,
  paymentReceipts: [],
  history: [
    {
      action: 'Submitted Request',
      timestamp: TS,
      user: 'Public Requester',
      notes:
        'Expense of 1500 INR (≈ $15.63 USD @ 0.010417) submitted by Requester GAC. Invoice: invoice.pdf.',
    },
  ],
};

export const EXPENSE_APPROVED = {
  ...EXPENSE_PENDING,
  status: 'APPROVED_APPROVER',
  approverNotes: 'Looks good',
  approvedAt: '2026-10-02T09:00:00.000Z',
  history: [
    ...EXPENSE_PENDING.history,
    {
      action: 'Approved by Manager',
      timestamp: '2026-10-02T09:00:00.000Z',
      user: 'Approver Media (approver.media@acefinance.com)',
      notes: 'Looks good',
    },
  ],
};

const RECEIPT = {
  fileName:
    'EXP-1790000000000-1234_2026-10-03_12-00-00_15.63USD_000_receipt.pdf',
  originalName: 'receipt.pdf',
  mimeType: 'application/pdf',
  size: 30211,
  uploadedAt: '2026-10-03T12:00:00.000Z',
  uploadedBy: 'Alisha (alisha.processor@acefinance.com)',
  paymentAmount: 15.63,
};

export const EXPENSE_PARTIALLY_PAID = {
  ...EXPENSE_APPROVED,
  status: 'PARTIALLY_PAID',
  paidAmount: 5,
  paymentReceipts: [{ ...RECEIPT, paymentAmount: 5 }],
};

export const EXPENSE_PROCESSED = {
  ...EXPENSE_APPROVED,
  status: 'PROCESSED',
  paidAmount: 15.63,
  processorNotes: 'Paid via bank transfer',
  processedAt: '2026-10-03T12:00:00.000Z',
  paymentReceipts: [RECEIPT],
};

export const EXPENSE_REJECTED = {
  ...EXPENSE_PENDING,
  status: 'REJECTED_APPROVER',
  approverNotes: 'Not a valid business expense',
};

export const EXPENSE_CHANGES_REQUESTED = {
  ...EXPENSE_PENDING,
  status: 'CHANGES_REQUESTED',
  changeRequestNotes: 'Please attach a clearer invoice',
  changeRequestedAt: '2026-10-02T09:00:00.000Z',
  changeRequestedBy: 'Approver Media (approver.media@acefinance.com)',
};

export const EXPENSE_PROCESSOR_REJECTED = {
  ...EXPENSE_APPROVED,
  status: 'REJECTED_PROCESSOR',
  processorNotes: 'Bank details missing',
};

export const STATS_DATA = {
  totalRequests: 32,
  pendingApproval: 11,
  pendingProcessing: 1,
  processed: 12,
  rejected: 2,
  totalRequestedAmount: 90478.99,
  totalProcessedAmount: 35966.47,
  byCategory: {
    Meals: 41949.27,
    Software: 34274.3,
    Office: 4188.69,
    Travel: 103.81,
  },
  recentActivity: [
    {
      expenseId: 'EXP-1790000000000-1234',
      requesterName: 'Requester GAC',
      action: 'Processed & Paid',
      timestamp: '2026-10-03T12:00:00.000Z',
      user: 'Alisha (alisha.processor@acefinance.com)',
    },
  ],
};

export const PROJECT_ROW = {
  _id: '6a5745d2408cd7f95174c401',
  name: 'Google Art and culture (GAC)',
  code: 'ACE-PR-000002',
  isActive: true,
  createdAt: '2026-07-15T08:33:22.751Z',
  updatedAt: '2026-07-15T08:33:22.751Z',
};

export const CATEGORY_ROW = {
  _id: '6a574343408cd7f95174c3fe',
  name: 'Travel',
  label: 'Travel',
  icon: '✈️',
  isActive: true,
  createdAt: '2026-07-15T08:22:27.385Z',
  updatedAt: '2026-07-15T08:22:27.385Z',
};

export const COUNTRY_ROW = {
  _id: '6a574e50b8fba9585e700b2c',
  name: 'India',
  currency: 'INR',
  isActive: true,
  createdAt: '2026-07-15T09:09:36.806Z',
  updatedAt: '2026-07-15T09:09:36.806Z',
};

export const NOTIFICATION_ROW = {
  id: '6a9e1d0adf537180a3ec1a11',
  type: 'EXPENSE_PENDING_APPROVAL',
  title: 'New expense awaiting approval',
  message:
    'Requester GAC submitted EXP-1790000000000-1234 ($15.63) for Google Art and culture (GAC).',
  expenseId: 'EXP-1790000000000-1234',
  project: 'Google Art and culture (GAC)',
  isRead: false,
  createdAt: TS,
};

export const FX_DATA = {
  currency: 'INR',
  originalAmount: 1500,
  exchangeRate: 0.010417,
  amountUsd: 15.63,
  rateDate: 'Thu, 01 Oct 2026',
};

export const HEALTH_DATA = {
  status: 'ok',
  service: 'Aceolution Finance API',
  timestamp: TS,
};
