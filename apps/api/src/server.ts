import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { config } from './config.js';
import { registerErrorHandler } from './lib/errors.js';
import { registerAuth } from './plugins/auth.js';
import { authRoutes } from './modules/auth/auth-routes.js';
import { adminRoutes } from './modules/admin/admin-routes.js';
import { memberRoutes } from './modules/members/members-routes.js';
import { transferCandidateRoutes } from './modules/members/transfer-candidate-routes.js';
import { companyRoutes } from './modules/companies/company-routes.js';
import { customerRoutes } from './modules/customers/customer-routes.js';
import { caseRoutes } from './modules/cases/case-routes.js';
import { assignmentRoutes } from './modules/assignments/assignment-routes.js';
import { workSessionRoutes } from './modules/work-sessions/work-session-routes.js';
import { reminderRoutes } from './modules/reminders/reminder-routes.js';
import { notificationRoutes } from './modules/notifications/notification-routes.js';
import { fileRoutes } from './modules/files/file-routes.js';
import { dashboardRoutes } from './modules/dashboard/dashboard-routes.js';

export async function buildServer() {
  const app = Fastify({
    logger: {
      level: config.nodeEnv === 'development' ? 'info' : 'warn',
      ...(config.nodeEnv === 'development'
        ? { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss' } } }
        : {}),
    },
    bodyLimit: 2 * 1024 * 1024,
  });

  await app.register(cors, { origin: true, credentials: true });
  await app.register(multipart, {
    limits: {
      fileSize: config.maxFileSizeMb * 1024 * 1024,
      files: 1,
    },
  });

  registerErrorHandler(app);
  await registerAuth(app);

  app.get('/api/v1/health', async () => ({ status: 'ok', time: new Date().toISOString() }));

  const apiPrefix = '/api/v1';
  await app.register(authRoutes, { prefix: apiPrefix });
  await app.register(adminRoutes, { prefix: `${apiPrefix}/admin` });
  await app.register(transferCandidateRoutes, { prefix: apiPrefix });
  await app.register(memberRoutes, { prefix: apiPrefix });
  await app.register(companyRoutes, { prefix: apiPrefix });
  await app.register(customerRoutes, { prefix: apiPrefix });
  await app.register(caseRoutes, { prefix: apiPrefix });
  await app.register(assignmentRoutes, { prefix: apiPrefix });
  await app.register(workSessionRoutes, { prefix: apiPrefix });
  await app.register(reminderRoutes, { prefix: apiPrefix });
  await app.register(notificationRoutes, { prefix: apiPrefix });
  await app.register(fileRoutes, { prefix: apiPrefix });
  await app.register(dashboardRoutes, { prefix: apiPrefix });

  return app;
}

const isDirectRun = process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop() ?? '');

if (isDirectRun || process.env.START_SERVER === 'true') {
  const app = await buildServer();
  app
    .listen({ port: config.port, host: config.host })
    .then(() => {
      app.log.info(`Followa API listening on ${config.host}:${config.port}`);
    })
    .catch((err) => {
      app.log.error(err);
      process.exit(1);
    });
}
