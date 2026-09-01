import Link from 'next/link';

const modules = [
  { title: 'پرونده‌ها', value: '128', text: 'مدیریت چرخه کامل پرونده، وضعیت‌ها و مسئولیت‌ها.', tone: 'text-brand-300' },
  { title: 'مشتریان', value: '54', text: 'ثبت ارتباطات و دسترسی سریع به اطلاعات مرتبط.', tone: 'text-emerald-300' },
  { title: 'اقدامات', value: '23', text: 'پیگیری وظایف، یادآوری‌ها و گردش کار تیم.', tone: 'text-amber-300' },
  { title: 'گزارش‌ها', value: '12', text: 'دید عملیاتی برای تصمیم‌گیری بهتر مدیران.', tone: 'text-violet-300' },
];

export default function Home() {
  return (
    <main dir="rtl" className="min-h-screen bg-[#050b18] text-white">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div className="text-2xl font-black">Followa</div>
        <nav className="hidden gap-7 text-sm text-slate-300 md:flex">
          <Link href="/about">درباره ما</Link>
          <Link href="/contact">تماس با ما</Link>
          <Link href="/privacy">حریم خصوصی</Link>
          <Link href="/terms">شرایط استفاده</Link>
        </nav>
        <Link href="/login" className="rounded-xl border border-violet-400/30 bg-violet-500/20 px-5 py-2.5 text-sm font-bold text-violet-100">
          ورود به سامانه
        </Link>
      </header>

      <section className="mx-auto grid max-w-7xl gap-12 px-6 py-16 lg:grid-cols-2 lg:py-24">
        <div>
          <span className="inline-flex rounded-full border border-violet-400/20 bg-violet-400/10 px-4 py-2 text-xs font-semibold text-violet-200">
            Workspace مدیریت عملیات سازمانی
          </span>
          <h1 className="mt-8 text-4xl font-black leading-[1.7] md:text-6xl">
            همه پرونده‌ها، مشتریان و اقدامات تیم شما در یک فضای کاری یکپارچه
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-9 text-slate-300">
            Followa محیط عملیاتی سازمان برای ثبت، پیگیری و مدیریت فرآیندهای کاری با کنترل وضعیت و مسئولیت‌هاست.
          </p>
          <Link href="/login" className="mt-8 inline-flex rounded-xl border border-violet-400/30 bg-violet-600 px-7 py-3 font-bold">
            ورود به Followa
          </Link>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-[#0b1426] p-6 shadow-2xl">
          <div className="mb-5 flex items-center justify-between rounded-2xl border border-slate-800 bg-[#07101f] p-4">
            <span className="font-bold">داشبورد Followa</span>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">فعال</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {modules.map((item) => (
              <div key={item.title} className="rounded-2xl border border-slate-800 bg-[#101b30] p-5 shadow-lg">
                <div className={`text-3xl font-black ${item.tone}`}>{item.value}</div>
                <h3 className="mt-3 font-bold">{item.title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-400">{item.text}</p>
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
