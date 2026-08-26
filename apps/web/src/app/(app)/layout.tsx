'use client';

import { AppShell } from '@/components/app-shell';
import { ConfirmProvider, ToastProvider } from '@/components/ui';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AppShell>{children}</AppShell>
      </ConfirmProvider>
    </ToastProvider>
  );
}
