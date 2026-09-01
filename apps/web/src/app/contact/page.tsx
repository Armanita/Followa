import Link from 'next/link';

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white px-6 py-16">
      <div className="mx-auto max-w-4xl space-y-8">
        <Link href="/" className="text-sm text-slate-300">بازگشت</Link>
        <h1 className="text-4xl font-bold">تماس با ما</h1>
        <p className="text-lg leading-9 text-slate-300">
          برای دریافت اطلاعات بیشتر، پشتیبانی و ارتباط با تیم Followa از مسیرهای ارتباطی معرفی‌شده استفاده کنید.
        </p>
        <div className="rounded-2xl border border-slate-800 p-6 text-slate-300">
          پشتیبانی Followa در حال آماده‌سازی کانال‌های ارتباطی رسمی است.
        </div>
      </div>
    </main>
  );
}
