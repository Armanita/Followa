import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white px-6 py-16">
      <div className="mx-auto max-w-4xl space-y-8">
        <Link href="/" className="text-sm text-slate-300">بازگشت</Link>
        <h1 className="text-4xl font-bold">حریم خصوصی</h1>
        <p className="text-lg leading-9 text-slate-300">
          Followa متعهد است اطلاعات کاربران و داده‌های ثبت‌شده در سامانه را با رویکرد امنیت، محرمانگی و کنترل دسترسی مدیریت کند.
        </p>
        <p className="text-lg leading-9 text-slate-300">
          اطلاعات کاربران تنها برای ارائه خدمات سامانه و بهبود تجربه استفاده پردازش می‌شود.
        </p>
      </div>
    </main>
  );
}
