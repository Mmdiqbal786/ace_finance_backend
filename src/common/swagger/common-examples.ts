/**
 * Request body examples for Swagger's "Examples" dropdown (and Postman saved examples).
 * Keys become the dropdown entries; keep values valid JSON (no comments).
 */
import { DEMO_USERS } from './sop-data-samples';

type Examples = Record<string, { summary: string; value: unknown }>;

export const LOGIN_EXAMPLES: Examples = {
  admin: { summary: 'Admin (password only)', value: DEMO_USERS.admin },
  requester: {
    summary: 'Requester GAC (password only)',
    value: DEMO_USERS.requester,
  },
  approver: {
    summary: 'Approver Media (password only)',
    value: DEMO_USERS.approver,
  },
  processor: {
    summary: 'Processor Alisha (password only)',
    value: DEMO_USERS.processor,
  },
};

export const VERIFY_2FA_EXAMPLES: Examples = {
  email: {
    summary: 'Email OTP',
    value: {
      challengeToken: '<challengeToken from login>',
      code: '123456',
      method: 'email',
    },
  },
  totp: {
    summary: 'Authenticator app',
    value: {
      challengeToken: '<challengeToken from login>',
      code: '123456',
      method: 'totp',
    },
  },
};

export const CHANGE_PASSWORD_EXAMPLES: Examples = {
  change: {
    summary: 'Change password',
    value: {
      currentPassword: 'TempPass@123',
      newPassword: 'NewPassword@123',
      confirmPassword: 'NewPassword@123',
    },
  },
};

export const RESEND_OTP_EXAMPLES: Examples = {
  resend: {
    summary: 'Resend sign-in code',
    value: { challengeToken: '<challengeToken from login>' },
  },
};

export const TOTP_CODE_EXAMPLES: Examples = {
  confirm: {
    summary: 'Code from authenticator app',
    value: { code: '123456' },
  },
};

export const PASSWORD_CONFIRM_EXAMPLES: Examples = {
  admin: {
    summary: 'Admin demo password',
    value: { password: DEMO_USERS.admin.password },
  },
};

export const PASSWORD_WITH_CODE_EXAMPLES: Examples = {
  admin: {
    summary: 'Password + emailed code',
    value: { password: DEMO_USERS.admin.password, code: '123456' },
  },
};

export const FORGOT_PASSWORD_EXAMPLES: Examples = {
  admin: {
    summary: 'Admin account',
    value: { email: DEMO_USERS.admin.email },
  },
  requester: {
    summary: 'Requester GAC',
    value: { email: DEMO_USERS.requester.email },
  },
};

export const RESET_PASSWORD_EXAMPLES: Examples = {
  reset: {
    summary: 'Token from reset link',
    value: {
      token: '<token from reset email link>',
      newPassword: 'NewPassword@123',
      confirmPassword: 'NewPassword@123',
    },
  },
};

export const UPDATE_ME_EXAMPLES: Examples = {
  rename: { summary: 'Change display name', value: { name: 'Jane Doe' } },
};

export const CREATE_USER_EXAMPLES: Examples = {
  requiredOnly: {
    summary: 'Required only (temporary password emailed)',
    value: {
      name: 'Jane Doe',
      email: 'jane.doe@example.com',
      role: 'REQUESTER',
      assignedProjects: ['Google Art and culture (GAC)'],
    },
  },
  approverWithPassword: {
    summary: 'Approver with a set temporary password',
    value: {
      name: 'Arun Kumar',
      email: 'arun.kumar@example.com',
      role: 'APPROVER',
      password: 'TempPass@123',
      assignedProjects: [
        'Google Art and culture (GAC)',
        'Google News Lab (GNL)',
      ],
    },
  },
  processor: {
    summary: 'Processor (all projects)',
    value: {
      name: 'Priya Sharma',
      email: 'priya@example.com',
      role: 'PROCESSOR',
      assignedProjects: [],
    },
  },
};

export const UPDATE_USER_EXAMPLES: Examples = {
  changeRole: {
    summary: 'Change role + projects',
    value: { role: 'APPROVER', assignedProjects: ['Google News Lab (GNL)'] },
  },
  deactivate: { summary: 'Deactivate', value: { isActive: false } },
  resetPassword: {
    summary: 'Admin reset password (user must change it next login)',
    value: { password: 'TempPass@123' },
  },
};

export const APPROVE_EXAMPLES: Examples = {
  withNotes: { summary: 'With notes', value: { notes: 'Looks good' } },
  empty: { summary: 'No notes', value: {} },
};

export const REJECT_EXAMPLES: Examples = {
  withNotes: {
    summary: 'With reason',
    value: { notes: 'Not a valid business expense' },
  },
};

export const REQUEST_CHANGES_EXAMPLES: Examples = {
  toRequester: {
    summary: 'Send back to requester (approver / processor)',
    value: { notes: 'Please attach a clearer invoice', target: 'requester' },
  },
  toApprover: {
    summary: 'Undo approval — back to approver (processor only)',
    value: { notes: 'Amount does not match the invoice', target: 'approver' },
  },
};

export const UPDATE_EXPENSE_EXAMPLES: Examples = {
  resubmit: {
    summary: 'Fix description + amount and resubmit',
    value: {
      description: 'Client visit travel (corrected)',
      originalAmount: 1600,
    },
  },
  dates: {
    summary: 'Change dates',
    value: { date: '2026-10-02', dueDate: '2026-10-20' },
  },
};

export const CREATE_PROJECT_EXAMPLES: Examples = {
  create: {
    summary: 'Create project',
    value: { name: 'Google News Lab (GNL)' },
  },
};

export const UPDATE_PROJECT_EXAMPLES: Examples = {
  rename: { summary: 'Rename', value: { name: 'Google News Lab' } },
  deactivate: { summary: 'Deactivate', value: { isActive: false } },
};

export const CREATE_CATEGORY_EXAMPLES: Examples = {
  create: {
    summary: 'Create category',
    value: { name: 'Training', label: 'Training', icon: '📚' },
  },
};

export const UPDATE_CATEGORY_EXAMPLES: Examples = {
  relabel: { summary: 'Change label', value: { label: 'Training & Courses' } },
  deactivate: { summary: 'Deactivate', value: { isActive: false } },
};

export const CREATE_COUNTRY_EXAMPLES: Examples = {
  create: {
    summary: 'Create country',
    value: { name: 'Japan', currency: 'JPY' },
  },
};

export const UPDATE_COUNTRY_EXAMPLES: Examples = {
  currency: { summary: 'Change currency', value: { currency: 'JPY' } },
  deactivate: { summary: 'Deactivate', value: { isActive: false } },
};
