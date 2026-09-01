import { PublicShell } from "@/components/public/PublicShell";

export default function TermsPage() {
  return (
    <PublicShell title="شرایط استفاده">
      <div className="space-y-5 leading-8 text-slate-300">
        <p>استفاده از Followa به معنی پذیرش قوانین و شرایط استفاده از سرویس است.</p>
        <p>کاربران مسئول حفظ اطلاعات ورود، صحت داده‌های ثبت‌شده و استفاده صحیح از امکانات سامانه هستند.</p>
        <p>Followa ممکن است برای بهبود عملکرد، امنیت و تجربه کاربری تغییراتی در سرویس ایجاد کند.</p>
      </div>
    </PublicShell>
  );
}
