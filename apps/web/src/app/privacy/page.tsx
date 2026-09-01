import { PublicShell } from "@/components/public/PublicShell";

export default function PrivacyPage() {
  return (
    <PublicShell title="حریم خصوصی">
      <div className="space-y-5 leading-8 text-slate-300">
        <p>Followa متعهد است اطلاعات کاربران و داده‌های سازمانی را با رویکرد مسئولانه مدیریت کند.</p>
        <p>اطلاعات مورد نیاز برای ایجاد حساب، مدیریت فرآیندها و ارائه خدمات در چارچوب عملکرد سامانه استفاده می‌شود.</p>
        <p>دسترسی به اطلاعات بر اساس ساختار حساب‌ها و سطح دسترسی کاربران کنترل خواهد شد.</p>
      </div>
    </PublicShell>
  );
}
