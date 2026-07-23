import { UserRole } from './user.schema';
import { REQUIRED_PROJECT_NAMES } from '../projects/projects.service';

const P = REQUIRED_PROJECT_NAMES;

export type DemoSeedUser = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  assignedProjects: string[];
  /** When true: password-only login (skip email OTP + authenticator). */
  isDemo?: boolean;
};

/**
 * Idempotent demo accounts for project scoping.
 * Keep in sync with ace_finance_frontend/lib/demo-guide.ts
 */
export const DEMO_SCOPED_USERS: DemoSeedUser[] = [
  // —— Primary live accounts (real inboxes — normal OTP + authenticator) ——
  {
    name: 'Demo Requester (Media)',
    email: 'iqbal.ace786@gmail.com',
    password: 'Aceolution_2024',
    role: 'REQUESTER',
    assignedProjects: [P[0], P[1]],
    isDemo: false,
  },
  {
    name: 'Demo Approver (Media)',
    email: 'iqbal.dev98@gmail.com',
    password: 'Approver@1234',
    role: 'APPROVER',
    assignedProjects: [P[0], P[1], P[2]],
    isDemo: false,
  },
  {
    name: 'Demo Processor',
    email: 'mmdiqbal786@gmail.com',
    password: 'Processor@1234',
    role: 'PROCESSOR',
    assignedProjects: [],
    isDemo: false,
  },
  {
    name: 'Admin',
    email: 'finance@aceolution.com',
    password: 'Admin@1234',
    role: 'ADMIN',
    assignedProjects: [],
    isDemo: false,
  },

  // —— Project-scoped demo personas (isDemo: skip 2FA) ——
  {
    name: 'Requester GAC',
    email: 'requester.gac@acefinance.com',
    password: 'Requester@1234',
    role: 'REQUESTER',
    assignedProjects: [P[0]],
    isDemo: true,
  },
  {
    name: 'Requester News',
    email: 'requester.news@acefinance.com',
    password: 'Requester@1234',
    role: 'REQUESTER',
    assignedProjects: [P[1], P[2]],
    isDemo: true,
  },
  {
    name: 'Requester Systems',
    email: 'requester.systems@acefinance.com',
    password: 'Requester@1234',
    role: 'REQUESTER',
    assignedProjects: [P[3], P[4], P[5]],
    isDemo: true,
  },
  {
    name: 'Requester Ops',
    email: 'requester.ops@acefinance.com',
    password: 'Requester@1234',
    role: 'REQUESTER',
    assignedProjects: [P[6], P[7], P[8], P[9]],
    isDemo: true,
  },
  {
    name: 'Approver Media',
    email: 'approver.media@acefinance.com',
    password: 'Approver@1234',
    role: 'APPROVER',
    assignedProjects: [P[0], P[1], P[2]],
    isDemo: true,
  },
  {
    name: 'Approver Systems',
    email: 'approver.systems@acefinance.com',
    password: 'Approver@1234',
    role: 'APPROVER',
    assignedProjects: [P[3], P[4], P[5]],
    isDemo: true,
  },
  {
    name: 'Approver Ops',
    email: 'approver.ops@acefinance.com',
    password: 'Approver@1234',
    role: 'APPROVER',
    assignedProjects: [P[6], P[7], P[8], P[9]],
    isDemo: true,
  },
  {
    name: 'Priya Sharma',
    email: 'priya.processor@acefinance.com',
    password: 'Processor@1234',
    role: 'PROCESSOR',
    assignedProjects: [],
    isDemo: true,
  },
];
