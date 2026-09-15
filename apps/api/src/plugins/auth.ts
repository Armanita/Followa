import fastifyJwt from '@fastify/jwt';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config.js';
import { prisma } from '../lib/prisma.js';
import { forbidden, unauthorized } from '../lib/errors.js';

export type ActorKind = 'SYSTEM_ADMIN' | 'COMPANY_USER';

export interface JwtPayload {
  sub: string;
  kind: ActorKind;
  // company user context (resolved at login)
  membershipId?: string;
  companyId?: string;
  role?: 'COMPANY_MANAGER' | 'EMPLOYEE';
}

declare module 'fastify' {
  interface FastifyRequest {
    actor: {
      kind: ActorKind;
      id: string;
      membershipId?: string;
      companyId?: string;
      role?: 'COMPANY_MANAGER' | 'EMPLOYEE';
    };
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

export async function registerAuth(app: FastifyInstance): Promise<void> {
  await app.register(fastifyJwt, { secret: config.jwtSecret });

  app.decorateRequest('actor');

  app.addHook('preHandler', async (request) => {
    if (request.routeOptions.url === undefined || !request.routeOptions.url.startsWith('/api/')) {
      return;
    }
    const publicRoutes = new Set([
      '/api/v1/auth/admin/login',
      '/api/v1/auth/login',
      '/api/v1/auth/otp/request',
      '/api/v1/auth/otp/verify',
      '/api/v1/auth/password',
      '/api/v1/auth/forgot-password/request',
      '/api/v1/auth/forgot-password/verify',
      '/api/v1/auth/forgot-password/reset',
      '/api/v1/telegram/webhook',
      '/api/v1/health',
    ]);
    if (publicRoutes.has(request.routeOptions.url)) return;

    try {
      const payload = await request.jwtVerify<JwtPayload>();
      request.actor = {
        kind: payload.kind,
        id: payload.sub,
        membershipId: payload.membershipId,
        companyId: payload.companyId,
        role: payload.role,
      };
      // Enforce live membership and company state so suspension takes effect immediately.
      if (payload.kind === 'COMPANY_USER' && payload.membershipId) {
        const membership = await prisma.companyMembership.findUnique({
          where: { id: payload.membershipId },
          select: { isActive: true, role: true, companyId: true, company: { select: { isActive: true } } },
        });
        if (!membership || !membership.isActive) {
          throw forbidden('عضویت شما غیرفعال است. با مدیر شرکت تماس بگیرید.');
        }
        if (!membership.company.isActive) {
          throw forbidden('شرکت شما غیرفعال است. با مدیر سیستم تماس بگیرید.');
        }
        request.actor.role = membership.role;
        request.actor.companyId = membership.companyId;
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('غیرفعال')) throw err;
      if ((err as { statusCode?: number }).statusCode === 403) throw err;
      throw unauthorized('توکن نامعتبر یا منقضی شده است');
    }
  });
}

type Reply = FastifyReply;
type Req = FastifyRequest;

/** Guard: system admin only. */
export function requireSystemAdmin(req: Req, _reply: Reply): void {
  if (req.actor?.kind !== 'SYSTEM_ADMIN') {
    throw forbidden('این عملیات مخصوص مدیر سیستم است');
  }
}

/** Guard: any active company user. */
export function requireCompanyUser(req: Req, _reply: Reply): void {
  if (req.actor?.kind !== 'COMPANY_USER') {
    throw forbidden('دسترسی فقط برای کاربران شرکت مجاز است');
  }
  if (!req.actor.companyId || !req.actor.membershipId) {
    throw unauthorized('عضویت شرکتی یافت نشد');
  }
}

/** Guard: manager only. */
export function requireManager(req: Req, _reply: Reply): void {
  requireCompanyUser(req, _reply);
  if (req.actor.role !== 'COMPANY_MANAGER') {
    throw forbidden('این عملیات مخصوص مدیر شرکت است');
  }
}

/** Reloads membership and company state so suspensions / role changes take effect immediately. */
export async function refreshMembership(req: Req): Promise<void> {
  if (req.actor?.kind !== 'COMPANY_USER' || !req.actor.membershipId) return;
  const membership = await prisma.companyMembership.findUnique({
    where: { id: req.actor.membershipId },
    include: { company: { select: { isActive: true } } },
  });
  if (!membership || !membership.isActive) {
    throw forbidden('عضویت شما غیرفعال است. با مدیر شرکت تماس بگیرید.');
  }
  if (!membership.company.isActive) {
    throw forbidden('شرکت شما غیرفعال است. با مدیر سیستم تماس بگیرید.');
  }
  req.actor.role = membership.role;
}
