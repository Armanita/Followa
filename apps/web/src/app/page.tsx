import Link from 'next/link';

const features = [
  'مدیریت پرونده و گردش کار سازمانی',
  'پیگیری مشتریان و درخواست‌ها',
  'داشبورد عملیاتی برای مدیران',
  'ساختار امن برای تیم‌های کاری',
];

export default function Home() {
  return (
    <main dir="rtl" className="min-h-screen bg-slate-950 text-white px-6 py-10">
      <header className="mx-auto flex max-w-6xl items-center justify-between">
        <div className="text-2xl font-bold">Followa</div>
        <nav className="flex gap-5 text-sm text-slate-300">
          <Link href="/about">درباره ما</Link>
          <Link href="/contact">تماس با ما</Link>
          <Link href="/privacy">حریم خصوصی</Link>
        </nav>
        <Link className="rounded-xl bg-white px-5 py-2 text-slate-950" href="/login">
          ورود به سامانه
        </Link>
      </header>

      <section className="mx-auto max-w-6xl py-24">
        <p className="mb-4 text-sm text-slate-400">سامانه مدیریت پرونده و پیگیری سازمانی</p>
        <h1 className="max-w-3xl text-5xl font-bold leading-tight">
          Followa؛ مسیر مدیریت پرونده‌ها، مشتریان و اقدامات تیم شما
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-slate-300">
          یک فضای یکپارچه برای ثبت، پیگیری و مدیریت فرآیندهای کاری سازمان‌ها.
        </p>
        <div className="mt-10 flex gap-4">
          <Link className="rounded-xl bg-white px-6 py-3 text-slate-950" href="/login">شروع کار</Link>
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-2">
          {features.map((item) => (
            <div key={item} className="rounded-2xl border border-slate-800 bg-slate-900 p-6">{item}</div>
          ))}
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap gap-5 border-t border-slate-800 pt-8 text-sm text-slate-400">
        <Link href="/terms">شرایط استفاده</Link>
        <Link href="/privacy">حریم خصوصی</Link>
        <Link href="/contact">تماس با ما</Link>
      </footer>
    </main>
  );
}
