import type { Metadata } from 'next';
import './globals.css';
import './orgawork-compat.css';
import 'vazirmatn/Vazirmatn-font-face.css';

export const metadata: Metadata = {
  title: 'فالوآ — سیستم پیگیری شرکت',
  description: 'سیستم مدیریت پرونده و پیگیری‌های داخلی شرکت',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
