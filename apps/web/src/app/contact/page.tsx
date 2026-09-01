import { PublicShell } from "@/components/public/PublicShell";

export default function ContactPage() {
  return (
    <PublicShell title="تماس با ما">
      <div className="space-y-5 leading-8 text-slate-300">
        <p>برای ارتباط با تیم Followa می‌توانید از مسیرهای ارتباطی رسمی محصول استفاده کنید.</p>
        <p>ما برای درخواست‌های پشتیبانی، پیشنهادهای توسعه و همکاری‌های سازمانی در کنار کاربران هستیم.</p>
        <p>اطلاعات ارتباطی رسمی پس از نهایی شدن کانال‌های پشتیبانی در همین بخش منتشر خواهد شد.</p>
      </div>
    </PublicShell>
  );
}
