import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { parseWith } from '../../lib/validation.js';
import { normalizePagination, paginated } from '../../lib/pagination.js';
import { conflict, forbidden, notFound } from '../../lib/errors.js';
import { changedFields, recordSensitiveAudit } from '../../lib/sensitive-audit.js';

const customerCreateSchema = z.object({
  type: z.enum(['INDIVIDUAL', 'LEGAL']),
  name: z.string().min(2).max(200),
  mobile: z.string().max(20).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  nationalId: z.string().max(30).nullable().optional(),
  economicCode: z.string().max(30).nullable().optional(),
  email: z.string().email().max(200).nullable().optional(),
  address: z.string().max(1000).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

const customerUpdateSchema = customerCreateSchema.partial();

const CUSTOMER_AUDIT_FIELDS = [
  'type',
  'name',
  'mobile',
  'phone',
  'nationalId',
  'economicCode',
  'email',
  'address',
  'notes',
  'isActive',
  'archivedAt',
];

const EMPLOYEE_QUICK_CREATE_FIELDS = new Set(['type', 'name', 'mobile', 'phone']);

function companyIdFrom(request: { actor: { companyId?: string } }): string {
  const companyId = request.actor.companyId;
  if (!companyId) throw forbidden('این بخش مخصوص کاربران شرکت است');
  return companyId;
}

function nullableText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeCustomerInput<T extends z.infer<typeof customerUpdateSchema>>(body: T) {
  return {
    ...(body.type !== undefined ? { type: body.type } : {}),
    ...(body.name !== undefined ? { name: body.name.trim() } : {}),
    ...(body.mobile !== undefined ? { mobile: nullableText(body.mobile) } : {}),
    ...(body.phone !== undefined ? { phone: nullableText(body.phone) } : {}),
    ...(body.nationalId !== undefined ? { nationalId: nullableText(body.nationalId) } : {}),
    ...(body.economicCode !== undefined ? { economicCode: nullableText(body.economicCode) } : {}),
    ...(body.email !== undefined ? { email: nullableText(body.email)?.toLowerCase() ?? null } : {}),
    ...(body.address !== undefined ? { address: nullableText(body.address) } : {}),
    ...(body.notes !== undefined ? { notes: nullableText(body.notes) } : {}),
  };
}

async function assertNoCustomerIdentityConflict(
  companyId: string,
  input: { mobile?: string | null; nationalId?: string | null; economicCode?: string | null },
  excludeId?: string,
): Promise<void> {
  const identities: Prisma.CustomerWhereInput[] = [];
  if (input.mobile) identities.push({ mobile: input.mobile });
  if (input.nationalId) identities.push({ nationalId: input.nationalId });
  if (input.economicCode) identities.push({ economicCode: input.economicCode });
  if (identities.length === 0) return;

  const duplicate = await prisma.customer.findFirst({
    where: {
      companyId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      OR: identities,
    },
    select: { id: true, isActive: true },
  });
  if (duplicate) {
    throw conflict(
      duplicate.isActive
        ? 'مشتری دیگری با اطلاعات شناسایی مشابه در همین شرکت وجود دارد'
        : 'مشتری بایگانی‌شده‌ای با اطلاعات شناسایی مشابه وجود دارد؛ ابتدا همان رکورد را بازیابی کنید',
    );
  }
}

async function getScopedCustomer(companyId: string, customerId: string) {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, companyId } });
  if (!customer) throw notFound('مشتری یافت نشد');
  return customer;
}

export async function customerRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Company-scoped picker/list endpoint.
   * Employees only receive active records. Managers can explicitly include archived records.
   */
  app.get('/customers', async (request) => {
    const companyId = companyIdFrom(request);
    const query = request.query as Record<string, string | undefined>;
    const { skip, take, page, pageSize } = normalizePagination(query);
    const managerCanSeeArchived = request.actor.role === 'COMPANY_MANAGER' && query.active === 'all';
    const search = query.search?.trim();

    const where: Prisma.CustomerWhereInput = {
      companyId,
      ...(managerCanSeeArchived ? {} : { isActive: true }),
      ...(query.type === 'INDIVIDUAL' || query.type === 'LEGAL' ? { type: query.type } : {}),
      ...(search
        ? {
            OR:
              request.actor.role === 'COMPANY_MANAGER'
                ? [
                    { name: { contains: search, mode: 'insensitive' } },
                    { mobile: { contains: search } },
                    { phone: { contains: search } },
                    { nationalId: { contains: search } },
                    { economicCode: { contains: search } },
                  ]
                : [
                    { name: { contains: search, mode: 'insensitive' } },
                    { mobile: { contains: search } },
                    { phone: { contains: search } },
                  ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
        skip,
        take,
        select: {
          id: true,
          type: true,
          name: true,
          mobile: true,
          phone: true,
          nationalId: request.actor.role === 'COMPANY_MANAGER',
          economicCode: request.actor.role === 'COMPANY_MANAGER',
          email: request.actor.role === 'COMPANY_MANAGER',
          address: request.actor.role === 'COMPANY_MANAGER',
          notes: request.actor.role === 'COMPANY_MANAGER',
          isActive: true,
          archivedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.customer.count({ where }),
    ]);

    return paginated(items, total, page, pageSize);
  });

  /**
   * Both roles may quick-create a customer for case creation. Employees are limited
   * to the minimal contact fields; full master-data creation remains Manager-only.
   */
  app.post('/customers', async (request) => {
    const companyId = companyIdFrom(request);
    const body = parseWith(customerCreateSchema, request.body);

    if (request.actor.role !== 'COMPANY_MANAGER') {
      const supplied = Object.entries(body)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key]) => key);
      const forbiddenFields = supplied.filter((key) => !EMPLOYEE_QUICK_CREATE_FIELDS.has(key));
      if (forbiddenFields.length > 0) {
        throw forbidden('کارمند فقط می‌تواند مشتری را با نام و اطلاعات تماس اولیه ثبت کند');
      }
    }

    const data = normalizeCustomerInput(body);
    await assertNoCustomerIdentityConflict(companyId, data);

    const customer = await prisma.customer.create({
      data: {
        companyId,
        type: body.type,
        name: body.name.trim(),
        mobile: data.mobile,
        phone: data.phone,
        nationalId: data.nationalId,
        economicCode: data.economicCode,
        email: data.email,
        address: data.address,
        notes: data.notes,
      },
    });

    await recordSensitiveAudit({
      companyId,
      actorId: request.actor.id,
      entityType: 'CUSTOMER',
      entityId: customer.id,
      action: request.actor.role === 'COMPANY_MANAGER' ? 'MANAGER_CUSTOMER_CREATED' : 'EMPLOYEE_CUSTOMER_QUICK_CREATED',
      changedFields: CUSTOMER_AUDIT_FIELDS.filter((key) => key in data || key === 'type' || key === 'name'),
    });

    return { message: 'مشتری ثبت شد', customer };
  });

  /** Full customer history is Manager-only to avoid exposing unrelated company case history. */
  app.get('/customers/:id/history', async (request) => {
    if (request.actor.role !== 'COMPANY_MANAGER') {
      throw forbidden('فقط مدیر می‌تواند تاریخچه کامل مشتری را مشاهده کند');
    }
    const companyId = companyIdFrom(request);
    const { id } = request.params as { id: string };
    const customer = await getScopedCustomer(companyId, id);

    const [items, totalCases, openCases, doneCases] = await Promise.all([
      prisma.case.findMany({
        where: { companyId, customerId: id },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          number: true,
          title: true,
          status: true,
          priority: true,
          result: true,
          resultAt: true,
          createdAt: true,
          updatedAt: true,
          currentOwner: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      prisma.case.count({ where: { companyId, customerId: id } }),
      prisma.case.count({
        where: { companyId, customerId: id, status: { notIn: ['DONE', 'CANCELLED'] } },
      }),
      prisma.case.count({ where: { companyId, customerId: id, status: 'DONE' } }),
    ]);

    return {
      customer,
      summary: { totalCases, openCases, doneCases },
      items,
    };
  });

  app.patch('/customers/:id', async (request) => {
    if (request.actor.role !== 'COMPANY_MANAGER') {
      throw forbidden('فقط مدیر می‌تواند اطلاعات مشتری را ویرایش کند');
    }
    const companyId = companyIdFrom(request);
    const { id } = request.params as { id: string };
    const before = await getScopedCustomer(companyId, id);
    const body = parseWith(customerUpdateSchema, request.body);
    const data = normalizeCustomerInput(body);

    await assertNoCustomerIdentityConflict(
      companyId,
      {
        mobile: data.mobile !== undefined ? data.mobile : before.mobile,
        nationalId: data.nationalId !== undefined ? data.nationalId : before.nationalId,
        economicCode: data.economicCode !== undefined ? data.economicCode : before.economicCode,
      },
      id,
    );

    const updated = await prisma.customer.update({ where: { id }, data });
    const fields = changedFields(before, updated, CUSTOMER_AUDIT_FIELDS);
    if (fields.length > 0) {
      await recordSensitiveAudit({
        companyId,
        actorId: request.actor.id,
        entityType: 'CUSTOMER',
        entityId: id,
        action: 'MANAGER_CUSTOMER_UPDATED',
        changedFields: fields,
      });
    }
    return { message: 'اطلاعات مشتری به‌روزرسانی شد', customer: updated };
  });

  app.post('/customers/:id/archive', async (request) => {
    if (request.actor.role !== 'COMPANY_MANAGER') {
      throw forbidden('فقط مدیر می‌تواند مشتری را بایگانی کند');
    }
    const companyId = companyIdFrom(request);
    const { id } = request.params as { id: string };
    const customer = await getScopedCustomer(companyId, id);
    if (!customer.isActive) return { message: 'مشتری از قبل بایگانی شده است', customer };

    const updated = await prisma.customer.update({
      where: { id },
      data: { isActive: false, archivedAt: new Date() },
    });
    await recordSensitiveAudit({
      companyId,
      actorId: request.actor.id,
      entityType: 'CUSTOMER',
      entityId: id,
      action: 'MANAGER_CUSTOMER_ARCHIVED',
      changedFields: ['archivedAt', 'isActive'],
    });
    return { message: 'مشتری بایگانی شد', customer: updated };
  });

  app.post('/customers/:id/restore', async (request) => {
    if (request.actor.role !== 'COMPANY_MANAGER') {
      throw forbidden('فقط مدیر می‌تواند مشتری را از بایگانی خارج کند');
    }
    const companyId = companyIdFrom(request);
    const { id } = request.params as { id: string };
    const customer = await getScopedCustomer(companyId, id);
    if (customer.isActive) return { message: 'مشتری فعال است', customer };

    const updated = await prisma.customer.update({
      where: { id },
      data: { isActive: true, archivedAt: null },
    });
    await recordSensitiveAudit({
      companyId,
      actorId: request.actor.id,
      entityType: 'CUSTOMER',
      entityId: id,
      action: 'MANAGER_CUSTOMER_RESTORED',
      changedFields: ['archivedAt', 'isActive'],
    });
    return { message: 'مشتری فعال شد', customer: updated };
  });
}
