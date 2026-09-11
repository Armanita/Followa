import { createWriteStream, createReadStream, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { config } from '../../config.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { assertCanViewCase, logActivity } from '../cases/case-service.js';
import { notificationService } from '../notifications/notification-service.js';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/mp4',
  'video/mp4', // some phones record "voice notes" as mp4
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

const EXT_BY_MIME: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'audio/mpeg': '.mp3',
  'audio/ogg': '.ogg',
  'audio/wav': '.wav',
  'audio/mp4': '.m4a',
  'video/mp4': '.mp4',
};

function safeExt(filename: string, mimeType: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (/^\.[a-z0-9]{1,8}$/.test(ext)) return ext;
  return EXT_BY_MIME[mimeType] ?? '';
}

export async function fileRoutes(app: FastifyInstance): Promise<void> {
  const maxBytes = config.maxFileSizeMb * 1024 * 1024;

  app.post('/cases/:id/files', async (request, reply) => {
    const userId = request.actor.id;
    const caseId = (request.params as { id: string }).id;
    await assertCanViewCase(caseId, {
      userId,
      companyId: request.actor.companyId!,
      role: request.actor.role!,
    });
    const c = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
    if (c.status === 'DONE' || c.status === 'CANCELLED') {
      throw badRequest('به پرونده بسته شده نمی‌توان فایل اضافه کرد');
    }
    if (c.currentOwnerId !== userId && request.actor.role !== 'COMPANY_MANAGER' && c.createdById !== userId) {
      throw forbidden('فقط مسئول فعلی یا مدیر می‌تواند فایل اضافه کند');
    }

    const file = await request.file();
    if (!file) throw badRequest('فایلی ارسال نشده است');

    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw badRequest('نوع فایل مجاز نیست. فقط PDF، آفیس، تصویر و صوت مجاز است.');
    }

    // Buffer size check happens via stream limit below; also quick header check:
    const year = String(new Date().getFullYear());
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const dir = path.resolve(config.storageDir, year, month, caseId);
    mkdirSync(dir, { recursive: true });

    const stored = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${safeExt(file.filename, file.mimetype)}`;
    const filePath = path.join(dir, stored);

    let bytesWritten = 0;
    let tooLarge = false;
    file.file.on('data', (chunk: Buffer) => {
      bytesWritten += chunk.length;
      if (bytesWritten > maxBytes && !tooLarge) {
        tooLarge = true;
        file.file.destroy(new Error('FILE_TOO_LARGE'));
      }
    });

    try {
      await pipeline(file.file, createWriteStream(filePath));
    } catch (err) {
      try {
        (await import('node:fs')).unlinkSync(filePath);
      } catch {}
      if ((err as Error).message === 'FILE_TOO_LARGE') {
        throw badRequest(`حجم فایل بیش از ${config.maxFileSizeMb} مگابایت است`);
      }
      throw err;
    }
    if (tooLarge) {
      try {
        (await import('node:fs')).unlinkSync(filePath);
      } catch {}
      throw badRequest(`حجم فایل بیش از ${config.maxFileSizeMb} مگابایت است`);
    }

    const record = await prisma.file.create({
      data: {
        caseId,
        uploaderId: userId,
        filename: file.filename.slice(0, 200),
        storagePath: path.relative(path.resolve(config.storageDir), filePath),
        mimeType: file.mimetype,
        size: bytesWritten,
      },
    });
    await logActivity(caseId, 'FILE_UPLOADED', userId, {
      filename: record.filename,
      fileId: record.id,
    });

    if (request.actor.role === 'EMPLOYEE') {
      await notificationService.notifyActiveCompanyManagers({
        companyId: request.actor.companyId!,
        excludeUserId: userId,
        type: 'CASE_UPDATED',
        title: 'فایل جدید به پرونده افزوده شد',
        body: c.title,
        linkType: 'CASE',
        linkId: caseId,
      });
    }

    reply.status(201);
    return { message: 'فایل ذخیره شد', file: record };
  });

  app.get('/files/:fileId/download', async (request, reply) => {
    const { fileId } = request.params as { fileId: string };
    const record = await prisma.file.findUnique({
      where: { id: fileId },
      include: { case: true },
    });
    if (!record) throw notFound('فایل یافت نشد');

    await assertCanViewCase(record.caseId, {
      userId: request.actor.id,
      companyId: request.actor.companyId!,
      role: request.actor.role!,
    });

    const abs = path.resolve(config.storageDir, record.storagePath);
    if (!existsSync(abs)) throw notFound('فایل روی دیسک یافت نشد');

    reply.header('Content-Type', record.mimeType);
    reply.header(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(record.filename)}"`,
    );
    return reply.send(createReadStream(abs));
  });
}
