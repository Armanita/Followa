import Link from "next/link";

export function PublicShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main dir="rtl" className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 px-6 py-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="text-xl font-bold">Followa</Link>
          <nav className="flex gap-5 text-sm text-slate-300">
            <Link href="/about">درباره ما</Link>
            <Link href="/contact">تماس با ما</Link>
            <Link href="/privacy">حریم خصوصی</Link>
            <Link href="/terms">شرایط استفاده</Link>
          </nav>
        </div>
      </header>
      <section className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl">
          <h1 className="mb-8 text-3xl font-bold">{title}</h1>
          {children}
        </div>
      </section>
      <footer className="border-t border-white/10 px-6 py-6 text-center text-sm text-slate-400">
        © Followa - سامانه مدیریت پرونده و عملیات سازمانی
      </footer>
    </main>
  );
}
