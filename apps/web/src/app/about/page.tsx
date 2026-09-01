import { PublicShell } from "@/components/public/PublicShell";

export default function AboutPage() {
  return (
    <PublicShell title="درباره Followa">
      <div className="space-y-5 leading-8 text-slate-300">
        <p>Followa یک سامانه نرم‌افزاری برای مدیریت پرونده‌ها، مشتریان، اقدامات و فرآیندهای کاری سازمان‌ها است.</p>
        <p>هدف Followa ایجاد یک فضای یکپارچه برای تیم‌هایی است که نیاز دارند اطلاعات، مسئولیت‌ها و پیگیری‌های روزانه خود را ساختارمند مدیریت کنند.</p>
        <p>تمرکز محصول بر سادگی استفاده، شفافیت عملیات و ایجاد دید بهتر برای مدیران و اعضای تیم است.</p>
      </div>
    </PublicShell>
  );
}
