import Link from 'next/link';

const features = [
  'مدیریت پرونده و گردش کار سازمانی',
  'پیگیری مشتریان، مسئولیت‌ها و اقدامات',
  'یادآوری‌ها و کنترل وضعیت فعالیت‌ها',
  'داشبورد عملیاتی برای مدیران و کارکنان',
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white" dir="rtl">
      <section className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-20 lg:flex-row lg:items-center">
        <div className="flex-1 space-y-6">
          <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
            Followa | سامانه مدیریت و پیگیری پرونده‌ها
          </div>
          <h1 className="text-4xl font-bold leading-tight lg:text-6xl">
            مدیریت پرونده‌ها، مشتریان و فرآیندهای کاری در یک فضای یکپارچه
          </h1>
          <p className="max-w-2xl text-lg leading-9 text-slate-300">
            Followa یک سامانه عملیاتی برای تیم‌هایی است که می‌خواهند پرونده‌ها،
            وظایف، پیگیری‌ها و ارتباط با مشتریان را دقیق و قابل گزارش مدیریت کنند.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link href="/login" className="rounded-xl bg-indigo-500 px-6 py-3 font-semibold hover:bg-indigo-400">
              ورود به سامانه
            </Link>
          </div>
        </div>

        <div className="flex-1 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl">
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-6">
            <div className="mb-6 text-xl font-semibold">Followa Workspace</div>
            <div className="grid gap-4 sm:grid-cols-2">
              {features.map((feature) => (
                <div key={feature} className="rounded-xl bg-white/5 p-4 text-slate-200">
                  {feature}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-20 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-3 text-xl font-semibold">برای مدیران</h2>
          <p className="text-slate-300">دید کامل روی پرونده‌ها، عملکرد تیم و وضعیت عملیات.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-3 text-xl font-semibold">برای کارکنان</h2>
          <p className="text-slate-300">دسترسی شفاف به مسئولیت‌ها، اقدامات و پیگیری‌های روزانه.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-3 text-xl font-semibold">امن و سازمان‌یافته</h2>
          <p className="text-slate-300">ساختار مناسب برای مدیریت داده‌های کاری و دسترسی‌ها.</p>
        </div>
      </section>
    </main>
  );
}
