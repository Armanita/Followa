import Link from 'next/link';

const modules = [
  { title: 'پرونده‌ها', text: 'مدیریت چرخه کامل پرونده، وضعیت‌ها و مسئولیت‌ها.' },
  { title: 'مشتریان', text: 'ثبت ارتباطات و دسترسی سریع به اطلاعات مرتبط.' },
  { title: 'اقدامات', text: 'پیگیری وظایف، یادآوری‌ها و گردش کار تیم.' },
  { title: 'گزارش‌ها', text: 'دید عملیاتی برای تصمیم‌گیری بهتر مدیران.' },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#050b18] px-6 py-8 text-white" dir="rtl">
      <header className="mx-auto flex max-w-6xl items-center justify-between">
        <div className="text-xl font-black">Followa</div>
        <nav className="hidden gap-8 text-sm text-slate-300 md:flex">
          <Link href="/about">درباره ما</Link><Link href="/contact">تماس با ما</Link><Link href="/privacy">حریم خصوصی</Link><Link href="/terms">شرایط استفاده</Link>
        </nav>
        <Link className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold" href="/login">ورود به سامانه</Link>
      </header>
      <section className="mx-auto grid max-w-6xl gap-10 py-24 lg:grid-cols-2 lg:items-center">
        <div>
          <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-4 py-2 text-xs text-violet-200">سامانه مدیریت پرونده و عملیات سازمانی</span>
          <h1 className="mt-8 text-4xl font-black leading-tight md:text-6xl">همه پرونده‌ها، مشتریان و اقدامات تیم شما در یک فضای یکپارچه</h1>
          <p className="mt-6 leading-8 text-slate-300">Followa یک محیط عملیاتی برای ثبت، پیگیری و مدیریت فرآیندهای کاری سازمان است.</p>
        </div>
        <div className="rounded-3xl border border-slate-800 bg-[#0b1426] p-6 shadow-2xl">
          <div className="mb-5 rounded-2xl border border-slate-800 bg-[#07101f] p-4">داشبورد Followa</div>
          <div className="grid gap-4 sm:grid-cols-2">{modules.map((m)=><div key={m.title} className="rounded-2xl border border-slate-800 bg-[#101b30] p-5"><h3 className="font-bold">{m.title}</h3><p className="mt-3 text-xs leading-6 text-slate-400">{m.text}</p></div>)}</div>
        </div>
      </section>
    </main>
  );
}
