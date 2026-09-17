import type { FastifyInstance } from 'fastify';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (message: string) => new AppError(400, 'BAD_REQUEST', message);
export const unauthorized = (message = 'احراز هویت لازم است') =>
  new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'دسترسی مجاز نیست') => new AppError(403, 'FORBIDDEN', message);
export const notFound = (message = 'موردی یافت نشد') => new AppError(404, 'NOT_FOUND', message);
export const conflict = (message: string) => new AppError(409, 'CONFLICT', message);

type HttpError = Error & { statusCode?: number; validation?: unknown };

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((rawError, request, reply) => {
    const error = rawError as HttpError;
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        code: error.code,
        message: error.message,
      });
    }

    if (error.validation) {
      return reply.status(400).send({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: error.message,
      });
    }

    if (error.statusCode === 413) {
      return reply.status(400).send({
        statusCode: 400,
        code: 'FILE_TOO_LARGE',
        message: 'حجم فایل بیش از حد مجاز است',
      });
    }

    app.log.error({
      err: error,
      route: request.routeOptions.url,
      method: request.method,
      message: error.message,
      stack: error.stack,
    }, 'temporary internal error debug trace');
    return reply.status(500).send({
      statusCode: 500,
      code: 'INTERNAL',
      message: 'خطای داخلی سرور',
    });
  });
}
