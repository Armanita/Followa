import type { Metadata } from 'next';
import './globals.css';
import 'vazirmatn/Vazirmatn-font-face.css';

export const metadata: Metadata = {
  title: 'فالوآ — سیستم پیگیری شرکت',
  description: 'سیستم مدیریت پرونده و پیگیری‌های داخلی شرکت',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="font-sans bg-slate-100 text-slate-900 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
