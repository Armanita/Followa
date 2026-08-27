import { randomInt } from 'node:crypto';
import { buildServer } from '../src/server.js';
import { prisma } from '../src/lib/prisma.js';
import bcrypt from 'bcryptjs';

let app: Awaited<ReturnType<typeof buildServer>> | null = null;

export async function getTestApp() {
  if (!app) {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
    app = await buildServer();
    await app.ready();
  }
  return app;
}

export async function closeTestApp() {
  if (app) {
    await app.close();
    app = null;
  }
  await prisma.$disconnect();
}

const counters = { n: 0 };
// per-process random prefix keeps mobiles unique across runs even if cleanup missed
const runTag = randomInt(1000, 9999);

function fakeMobile(seed: number): string {
  // valid Iranian mobile: 0912 + 7 digits
  const n = (runTag * 10000 + seed) % 10000000;
  return `0912${String(n).padStart(7, '0')}`;
}

/** Creates a fresh company with a manager + N employees; returns tokens & ids. */
export async function seedFixture(employeeCount = 2) {
  counters.n += 1;
  const tag = `t${Date.now()}_${counters.n}_${runTag}`;
  const passwordHash = await bcrypt.hash('Passw0rd!', 4);

  const manager = await prisma.user.create({
    data: {
      mobile: fakeMobile(counters.n * 100),
      firstName: 'مدیر',
      lastName: `تستی ${tag}`,
      passwordHash,
    },
  });
  const company = await prisma.company.create({ data: { name: `شرکت تست ${tag}` } });
  const membership = await prisma.companyMembership.create({
    data: { userId: manager.id, companyId: company.id, role: 'COMPANY_MANAGER' },
  });

  const employees: { id: string; membershipId: string; token: string }[] = [];
  for (let i = 1; i <= employeeCount; i++) {
    const e = await prisma.user.create({
      data: {
        mobile: fakeMobile(counters.n * 100 + i),
        firstName: `کارمند${i}`,
        lastName: `تستی ${tag}`,
        passwordHash,
      },
    });
    const em = await prisma.companyMembership.create({
      data: { userId: e.id, companyId: company.id, role: 'EMPLOYEE' },
    });
    const token = await login(app!, e.mobile, 'Passw0rd!');
    employees.push({ id: e.id, membershipId: em.id, token });
  }

  const managerToken = await login(app!, manager.mobile, 'Passw0rd!');
  return {
    company,
    manager: { id: manager.id, membershipId: membership.id, token: managerToken },
    employees,
    cleanup,
  };
}

async function login(app: NonNullable<Awaited<ReturnType<typeof buildServer>>>, mobile: string, password: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { mobile, password },
  });
  if (res.statusCode !== 200) throw new Error(`login failed for ${mobile}: ${res.body}`);
  return res.json().token;
}

export async function cleanup() {
  const testCompanies = await prisma.company.findMany({
    where: { name: { contains: `_${runTag}` } },
    select: { id: true },
  });
  const ids = testCompanies.map((c) => c.id);
  // audit rows use RESTRICT by design; remove test-only audit evidence before fixture teardown.
  if (ids.length > 0) {
    await prisma.sensitiveAuditLog.deleteMany({ where: { companyId: { in: ids } } });
    // cases first (case→company FK has no cascade), children of cases cascade
    await prisma.case.deleteMany({ where: { companyId: { in: ids } } });
    await prisma.company.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.user.deleteMany({
    where: { lastName: { contains: `_${runTag}` } },
  });
}
