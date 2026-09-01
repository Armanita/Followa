import Link from 'next/link';

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white px-6 py-16">
      <div className="mx-auto max-w-4xl space-y-8">
        <Link href="/" className="text-sm text-slate-300">بازگشت</Link>
        <h1 className="text-4xl font-bold">درباره Followa</h1>
        <p className="text-lg leading-9 text-slate-300">
          Followa یک سامانه مدیریت پرونده و پیگیری سازمانی است که به تیم‌ها کمک می‌کند اطلاعات، اقدامات و روندهای کاری خود را ساختارمند مدیریت کنند.
        </p>
        <p className="text-lg leading-9 text-slate-300">
          هدف Followa ایجاد یک فضای ساده، امن و قابل پیگیری برای مدیران و کارکنان است تا هیچ درخواست، پرونده یا اقدامی بدون مسئول و وضعیت مشخص باقی نماند.
        </p>
      </div>
    </main>
  );
}
