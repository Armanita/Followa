import { ZodError, type ZodTypeAny } from 'zod';
import type { FastifySchema } from 'fastify';
import { badRequest } from './errors.js';

// Converts a zod object into a Fastify schema-compatible shape and provides a
// parse helper that throws our standard AppError on failure.

export function zodSchema<T extends ZodTypeAny>(schema: T): FastifySchema {
  return schema as unknown as FastifySchema;
}

export function parseWith<T>(schema: { parse: (data: unknown) => T }, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      const first = error.issues[0];
      throw badRequest(
        first ? `${first.path.join('.')}: ${first.message}` : 'داده‌های ورودی نامعتبر است',
      );
    }
    throw error;
  }
}
