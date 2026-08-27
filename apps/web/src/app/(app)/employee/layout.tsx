'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui';

export default function EmployeeAreaLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let role = '';
    try {
      role = JSON.parse(localStorage.getItem('followa_user') ?? '{}').role ?? '';
    } catch {
      role = '';
    }

    if (role !== 'EMPLOYEE') {
      router.replace('/dashboard');
      return;
    }

    setAllowed(true);
  }, [router]);

  if (!allowed) return <Spinner label="در حال بررسی دسترسی کارمند…" />;
  return <>{children}</>;
}
