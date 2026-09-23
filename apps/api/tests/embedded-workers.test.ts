import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  resolveEmbeddedWorkers,
  startEmbeddedWorkers,
} from '../src/server.js';

const notificationRunner = vi.fn(async () => {});
const reminderRunner = vi.fn(async () => {});
const runners = {
  notification: notificationRunner,
  reminderDue: reminderRunner,
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('embedded worker selection', () => {
  it('starts nothing when both flags are disabled (local default)', () => {
    const selected = resolveEmbeddedWorkers({
      notificationWorkerEnabled: false,
      reminderDueWorkerEnabled: false,
    });
    expect(selected).toEqual([]);

    const started = startEmbeddedWorkers(
      { notificationWorkerEnabled: false, reminderDueWorkerEnabled: false },
      runners,
    );
    expect(started).toEqual([]);
    expect(notificationRunner).not.toHaveBeenCalled();
    expect(reminderRunner).not.toHaveBeenCalled();
  });

  it('starts only the notification worker when reminder flag is off', () => {
    const selected = resolveEmbeddedWorkers({
      notificationWorkerEnabled: true,
      reminderDueWorkerEnabled: false,
    });
    expect(selected).toEqual(['notification']);

    const started = startEmbeddedWorkers(
      { notificationWorkerEnabled: true, reminderDueWorkerEnabled: false },
      runners,
    );
    expect(started).toHaveLength(1);
    expect(notificationRunner).toHaveBeenCalledTimes(1);
    expect(reminderRunner).not.toHaveBeenCalled();
  });

  it('starts only the reminder worker when notification flag is off', () => {
    const selected = resolveEmbeddedWorkers({
      notificationWorkerEnabled: false,
      reminderDueWorkerEnabled: true,
    });
    expect(selected).toEqual(['reminderDue']);

    const started = startEmbeddedWorkers(
      { notificationWorkerEnabled: false, reminderDueWorkerEnabled: true },
      runners,
    );
    expect(started).toHaveLength(1);
    expect(reminderRunner).toHaveBeenCalledTimes(1);
    expect(notificationRunner).not.toHaveBeenCalled();
  });

  it('starts both workers together exactly once each', () => {
    const selected = resolveEmbeddedWorkers({
      notificationWorkerEnabled: true,
      reminderDueWorkerEnabled: true,
    });
    expect(selected).toEqual(['notification', 'reminderDue']);

    const started = startEmbeddedWorkers(
      { notificationWorkerEnabled: true, reminderDueWorkerEnabled: true },
      runners,
    );
    expect(started).toHaveLength(2);
    expect(notificationRunner).toHaveBeenCalledTimes(1);
    expect(reminderRunner).toHaveBeenCalledTimes(1);
  });

  it('keeps notification-first order for stable shutdown pairing', () => {
    expect(
      resolveEmbeddedWorkers({
        notificationWorkerEnabled: true,
        reminderDueWorkerEnabled: true,
      }),
    ).toEqual(['notification', 'reminderDue']);
  });
});

describe('embedded worker env flags', () => {
  it('defaults both embedded workers to disabled without env flags', async () => {
    vi.resetModules();
    delete process.env.NOTIFICATION_WORKER_ENABLED;
    delete process.env.REMINDER_DUE_WORKER_ENABLED;
    const { config } = await import('../src/config.js');
    expect(config.notificationWorkerEnabled).toBe(false);
    expect(config.reminderDueWorkerEnabled).toBe(false);
  });

  it('enables each worker independently when its env flag is true', async () => {
    vi.resetModules();
    process.env.NOTIFICATION_WORKER_ENABLED = 'true';
    process.env.REMINDER_DUE_WORKER_ENABLED = 'true';
    const { config } = await import('../src/config.js');
    expect(config.notificationWorkerEnabled).toBe(true);
    expect(config.reminderDueWorkerEnabled).toBe(true);
    delete process.env.NOTIFICATION_WORKER_ENABLED;
    delete process.env.REMINDER_DUE_WORKER_ENABLED;
    vi.resetModules();
  });

  it('treats non-true values as disabled', async () => {
    vi.resetModules();
    process.env.REMINDER_DUE_WORKER_ENABLED = '1';
    const { config } = await import('../src/config.js');
    expect(config.reminderDueWorkerEnabled).toBe(false);
    delete process.env.REMINDER_DUE_WORKER_ENABLED;
    vi.resetModules();
  });
});
