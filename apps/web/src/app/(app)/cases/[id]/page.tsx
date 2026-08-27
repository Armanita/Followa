'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui';

export default function CaseDetailRoleRouter() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    let role = '';
    try {
      role = JSON.parse(localStorage.getItem('followa_user') ?? '{}').role ?? '';
    } catch {
      role = '';
    }

    if (role === 'COMPANY_MANAGER') {
      router.replace(`/manager/cases/${id}`);
      return;
    }

    if (role === 'EMPLOYEE') {
      router.replace(`/employee/cases/${id}`);
      return;
    }

    router.replace('/login');
  }, [id, router]);

  return <Spinner label="در حال انتقال به صفحه پرونده…" />;
}
