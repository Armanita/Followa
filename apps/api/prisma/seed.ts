import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Followa database...');

  // --- System admin ---------------------------------------------------------
  const adminPassword = process.env.SYSTEM_ADMIN_PASSWORD ?? 'admin1234';
  const adminUsername = process.env.SYSTEM_ADMIN_USERNAME ?? 'admin';
  const existingAdmin = await prisma.systemAdmin.findUnique({
    where: { username: adminUsername },
  });
  if (!existingAdmin) {
    await prisma.systemAdmin.create({
      data: {
        username: adminUsername,
        passwordHash: await bcrypt.hash(adminPassword, 10),
      },
    });
    console.log(`✓ System admin created: ${adminUsername} / ${adminPassword}`);
  } else {
    console.log('• System admin already exists');
  }

  // --- Demo company ---------------------------------------------------------
  const companyName = 'شرکت نمونه فالوآ';
  let company = await prisma.company.findFirst({ where: { name: companyName } });

  if (company) {
    console.log('• Demo company already exists — skipping demo data');
    return;
  }
  company = await prisma.company.create({ data: { name: companyName } });

  const managerPassword = await bcrypt.hash('manager1234', 10);
  const employeePassword = await bcrypt.hash('employee1234', 10);

  const manager = await prisma.user.upsert({
    where: { mobile: '09120000001' },
    update: {},
    create: {
      mobile: '09120000001',
      firstName: 'مریم',
      lastName: 'مدیری',
      passwordHash: managerPassword,
      nationalId: '0012345678',
    },
  });
  await prisma.companyMembership.create({
    data: {
      userId: manager.id,
      companyId: company.id,
      role: 'COMPANY_MANAGER',
      jobTitle: 'مدیرعامل',
      employeeCode: 'M-001',
    },
  });

  const employeesData = [
    { mobile: '09120000002', firstName: 'آرمان', lastName: 'رضایی', jobTitle: 'کارشناس فروش' },
    { mobile: '09120000003', firstName: 'علی', lastName: 'کریمی', jobTitle: 'کارشناس پشتیبانی' },
    { mobile: '09120000004', firstName: 'مهسا', lastName: 'احمدی', jobTitle: 'کارشناس بازاریابی' },
  ];
  const employees = [] as { id: string }[];
  for (const e of employeesData) {
    const user = await prisma.user.upsert({
      where: { mobile: e.mobile },
      update: {},
      create: {
        mobile: e.mobile,
        firstName: e.firstName,
        lastName: e.lastName,
        passwordHash: employeePassword,
      },
    });
    await prisma.companyMembership.create({
      data: {
        userId: user.id,
        companyId: company.id,
        role: 'EMPLOYEE',
        jobTitle: e.jobTitle,
      },
    });
    employees.push(user);
  }

  const caseTypes = await Promise.all([
    prisma.caseType.create({ data: { companyId: company.id, name: 'پیگیری مشتری', color: '#2563eb' } }),
    prisma.caseType.create({ data: { companyId: company.id, name: 'قرارداد', color: '#7c3aed' } }),
    prisma.caseType.create({ data: { companyId: company.id, name: 'پشتیبانی', color: '#059669' } }),
    prisma.caseType.create({ data: { companyId: company.id, name: 'اداری', color: '#d97706' } }),
  ]);

  // --- Demo cases with realistic flow ---------------------------------------
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
  const nextWeek = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000);

  // Case 1: manager -> Arman accepted, in progress
  const c1 = await prisma.case.create({
    data: {
      companyId: company!.id,
      title: 'تماس با مشتری شرکت پیشرو برای پیش‌فاکتور',
      description:
        'مشتری درخواست پیش‌فاکتور ۵ دستگاه دارد. ابتدا تماس گرفته شود، سپس قیمت نهایی اعلام گردد.',
      caseTypeId: caseTypes[0].id,
      priority: 'HIGH',
      dueDate: tomorrow,
      status: 'IN_PROGRESS',
      currentOwnerId: employees[0].id,
      createdById: manager.id,
    },
  });
  await prisma.caseActivity.createMany({
    data: [
      { caseId: c1.id, type: 'CREATE', actorId: manager.id },
      {
        caseId: c1.id,
        type: 'ASSIGN',
        actorId: manager.id,
        payload: { toUserId: employees[0].id },
      },
      { caseId: c1.id, type: 'ACCEPT', actorId: employees[0].id },
      { caseId: c1.id, type: 'START_WORK', actorId: employees[0].id },
      { caseId: c1.id, type: 'END_WORK', actorId: employees[0].id, payload: { durationSeconds: 1800 } },
    ],
  });
  await prisma.workSession.create({
    data: {
      caseId: c1.id,
      userId: employees[0].id,
      startedAt: new Date(Date.now() - 3600 * 1000),
      endedAt: new Date(Date.now() - 1800 * 1000),
      durationSeconds: 1800,
    },
  });
  await prisma.reminder.create({
    data: {
      caseId: c1.id,
      assigneeId: employees[0].id,
      creatorId: employees[0].id,
      remindAt: new Date(Date.now() + 3 * 3600 * 1000),
      note: 'ارسال پیش‌فاکتور به مشتری',
    },
  });

  // Case 2: manager -> Ali waiting acceptance
  const c2 = await prisma.case.create({
    data: {
      companyId: company!.id,
      title: 'پیگیری قرارداد سالانه با فروشگاه نگین',
      description: 'قرارداد سالانه در انتظار امضای طرف مقابل است. وضعیت را پیگیری کنید.',
      caseTypeId: caseTypes[1].id,
      priority: 'URGENT',
      dueDate: nextWeek,
      status: 'WAITING_ACCEPTANCE',
      createdById: manager.id,
    },
  });
  await prisma.caseActivity.createMany({
    data: [
      { caseId: c2.id, type: 'CREATE', actorId: manager.id },
      {
        caseId: c2.id,
        type: 'ASSIGN',
        actorId: manager.id,
        payload: { toUserId: employees[1].id },
      },
    ],
  });

  // Case 3: Mahsa created and completed it herself
  const c3 = await prisma.case.create({
    data: {
      companyId: company!.id,
      title: 'ثبت سفارش لوازم اداری جدید',
      caseTypeId: caseTypes[3].id,
      status: 'DONE',
      currentOwnerId: employees[2].id,
      createdById: employees[2].id,
      result: 'سفارش ثبت شد و کالاها تا پایان هفته تحویل می‌شود.',
      resultAt: new Date(Date.now() - 3600 * 1000),
    },
  });
  await prisma.caseActivity.createMany({
    data: [
      { caseId: c3.id, type: 'CREATE', actorId: employees[2].id },
      { caseId: c3.id, type: 'RESULT_ADDED', actorId: employees[2].id },
      { caseId: c3.id, type: 'COMPLETE', actorId: employees[2].id },
    ],
  });

  // Case 4: overdue open case owned by Ali
  const c4 = await prisma.case.create({
    data: {
      companyId: company!.id,
      title: 'رفع مشکل سرور ایمیل مشتری آریا',
      caseTypeId: caseTypes[2].id,
      priority: 'HIGH',
      dueDate: yesterday,
      status: 'IN_PROGRESS',
      currentOwnerId: employees[1].id,
      createdById: manager.id,
    },
  });
  await prisma.caseActivity.createMany({
    data: [
      { caseId: c4.id, type: 'CREATE', actorId: manager.id },
      { caseId: c4.id, type: 'ACCEPT', actorId: employees[1].id },
    ],
  });

  console.log('✓ Demo company «شرکت نمونه فالوآ» created');
  console.log('  Manager : 09120000001 / manager1234');
  console.log('  Employees:');
  console.log('    09120000002 / employee1234');
  console.log('    09120000003 / employee1234');
  console.log('    09120000004 / employee1234');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
