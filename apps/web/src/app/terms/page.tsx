import Link from 'next/link';

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white px-6 py-16">
      <div className="mx-auto max-w-4xl space-y-8">
        <Link href="/" className="text-sm text-slate-300">بازگشت</Link>
        <h1 className="text-4xl font-bold">شرایط استفاده</h1>
        <p className="text-lg leading-9 text-slate-300">
          استفاده از Followa به معنی پذیرش قوانین استفاده از سامانه، مسئولیت حفظ اطلاعات حساب و رعایت سیاست‌های سرویس است.
        </p>
        <p className="text-lg leading-9 text-slate-300">
          کاربران موظف هستند اطلاعات صحیح وارد کرده و از سامانه در چارچوب خدمات ارائه‌شده استفاده کنند.
        </p>
      </div>
    </main>
  );
}
