import Link from 'next/link';

const modules = [
  { title: 'پرونده‌ها', text: 'مدیریت چرخه کامل پرونده، وضعیت‌ها و مسئولیت‌ها.' },
  { title: 'مشتریان', text: 'ثبت ارتباطات و دسترسی سریع به اطلاعات مرتبط.' },
  { title: 'اقدامات', text: 'پیگیری وظایف، یادآوری‌ها و گردش کار تیمی.' },
  { title: 'گزارش‌ها', text: 'دید عملیاتی برای تصمیم‌گیری بهتر مدیران.' },
];

export default function Home() {
  return (
    <main dir="rtl" className="min-h-screen bg-slate-950 text-white">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div className="text-2xl font-bold tracking-tight">Followa</div>
        <nav className="hidden gap-6 text-sm text-slate-300 md:flex">
          <Link href="/about">درباره ما</Link>
          <Link href="/contact">تماس با ما</Link>
          <Link href="/privacy">حریم خصوصی</Link>
          <Link href="/terms">شرایط استفاده</Link>
        </nav>
        <Link href="/login" className="rounded-xl bg-white px-5 py-2 font-medium text-slate-950">
          ورود به سامانه
        </Link>
      </header>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-16 lg:grid-cols-2 lg:py-24">
        <div>
          <div className="mb-5 inline-flex rounded-full border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300">
            سامانه مدیریت پرونده و عملیات سازمانی
          </div>
          <h1 className="text-4xl font-bold leading-relaxed md:text-6xl">
            همه پرونده‌ها، مشتریان و اقدامات تیم شما در یک فضای یکپارچه
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-9 text-slate-300">
            Followa یک محیط عملیاتی برای سازمان‌هاست تا فرآیندهای کاری را ثبت، پیگیری و مدیریت کنند.
          </p>
          <div className="mt-8 flex gap-4">
            <Link href="/login" className="rounded-xl bg-white px-7 py-3 text-slate-950">ورود به Followa</Link>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
          <div className="mb-5 flex justify-between rounded-2xl bg-slate-950 p-4">
            <span>داشبورد Followa</span>
            <span className="text-slate-400">Live</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {modules.map((item) => (
              <div key={item.title} className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-7xl border-t border-slate-800 px-6 py-8 text-sm text-slate-400">
        <div className="flex flex-wrap gap-6">
          <Link href="/about">درباره ما</Link>
          <Link href="/contact">تماس با ما</Link>
          <Link href="/privacy">حریم خصوصی</Link>
          <Link href="/terms">شرایط استفاده</Link>
        </div>
      </footer>
    </main>
  );
}
