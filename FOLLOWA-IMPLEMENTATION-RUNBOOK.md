# FOLLOWA-IMPLEMENTATION-RUNBOOK.md

# Followa Implementation Runbook

## Purpose

این سند دستور اجرای پروژه Followa را برای تیم توسعه یا Agent توسعه‌دهنده
مشخص می‌کند.

این فایل به همراه:

-   FOLLOWA-PRODUCT-SPEC-COMPLETE.md
-   FOLLOWA-ARCHITECTURE-v1.3-COMPLETE.md

منابع اصلی تصمیم‌گیری هستند.

------------------------------------------------------------------------

# 1. Rules Before Implementation

الزامی:

-   قبل از کدنویسی تمام اسناد مرجع خوانده شوند.
-   معماری تغییر نکند.
-   MVP خارج از Scope توسعه داده نشود.
-   Feature ناقص تحویل داده نشود.
-   Skeleton به عنوان محصول نهایی پذیرفته نیست.

ممنوع:

-   Microservice
-   Redis
-   Kubernetes
-   Workflow Builder
-   AI
-   SaaS Billing
-   Permission Engine پیچیده

------------------------------------------------------------------------

# 2. Implementation Strategy

ترتیب توسعه:

1.  Infrastructure
2.  Database
3.  Backend Foundation
4.  Authentication
5.  Company Management
6.  Employee Management
7.  Case Engine
8.  Assignment Flow
9.  Work Session
10. Reminder
11. Notification
12. Dashboard
13. Web UI
14. Android App
15. Testing

هیچ مرحله‌ای قبل از تکمیل مرحله قبل شروع نشود.

------------------------------------------------------------------------

# 3. Phase Completion Criteria

## Infrastructure

باید آماده باشد:

-   Monorepo
-   pnpm workspace
-   TypeScript configuration
-   Docker Compose
-   PostgreSQL connection

معیار پایان:

-   Environment بالا می‌آید.
-   Database قابل اتصال است.

------------------------------------------------------------------------

## Database

اجرا:

-   Prisma schema
-   Format
-   Validate
-   Migration

معیار پایان:

-   Migration موفق
-   Database سالم

------------------------------------------------------------------------

## Backend

باید شامل:

-   Fastify setup
-   Configuration
-   Error handling
-   Validation
-   Routing
-   Database provider

باشد.

------------------------------------------------------------------------

## Authentication

باید کار کند:

System Admin:

-   Login

Company User:

-   OTP flow
-   Password creation
-   Login
-   JWT

معیار پایان:

کاربر بتواند وارد سیستم شود.

------------------------------------------------------------------------

# 4. Business Features

## Company

System Admin:

-   Create Company
-   Create Manager

Manager:

-   Manage employees

------------------------------------------------------------------------

## Cases

باید کامل باشد:

-   Create
-   View
-   Detail
-   Update
-   Result
-   Files

------------------------------------------------------------------------

## Assignment

باید کامل باشد:

-   Assign
-   Accept
-   Reject
-   Reason

History نباید حذف شود.

------------------------------------------------------------------------

## Work Session

باید ثبت کند:

-   Start
-   End
-   Duration

------------------------------------------------------------------------

## Reminder

باید:

-   Create
-   View
-   Complete
-   Recreate

را پشتیبانی کند.

------------------------------------------------------------------------

# 5. UI Requirements

محصول نهایی باید شبیه نرم‌افزار واقعی باشد.

الزام:

-   Persian language
-   RTL
-   Jalali Calendar
-   Persian Font
-   Responsive
-   Mobile First

استفاده شود.

اجباری:

-   Loading state
-   Empty state
-   Error state
-   Success feedback

------------------------------------------------------------------------

# 6. Dashboard Requirements

## Manager

نمایش:

-   Total cases
-   Open cases
-   In progress
-   Waiting acceptance
-   Late cases
-   Active employees

بخش‌ها:

-   Recent activity
-   Urgent cases
-   Employee status

------------------------------------------------------------------------

## Employee

نمایش:

-   My cases
-   Today's reminders
-   Assignments
-   Active work
-   History

------------------------------------------------------------------------

# 7. Testing Requirements

قبل از اعلام پایان:

اجرا شود:

-   Backend tests
-   API tests
-   Permission tests
-   Database tests
-   Build tests

سناریوی اجباری:

1.  SystemAdmin شرکت بسازد.
2.  Manager ساخته شود.
3.  Employee ساخته شود.
4.  Employee وارد شود.
5.  Case ساخته شود.
6.  Assignment انجام شود.
7.  Employee قبول کند.
8.  Work session ثبت شود.
9.  Case به فرد دیگر منتقل شود.
10. History کامل باقی بماند.

------------------------------------------------------------------------

# 8. Security Checklist

بررسی شود:

-   Password hashing
-   JWT security
-   Input validation
-   Authorization
-   Company isolation

هرگز:

-   .env واقعی
-   Secret
-   Password
-   Token

در Repository قرار نگیرد.

------------------------------------------------------------------------

# 9. Final Verification

قبل از تحویل:

اجرا شود:

-   Install
-   Migration
-   Docker startup
-   API build
-   Web build
-   Tests

اگر خطا وجود داشت:

رفع شود.

گزارش پایان فقط بعد از موفقیت Verification ارائه شود.

------------------------------------------------------------------------

# 10. Final Delivery Report

گزارش نهایی شامل:

-   Completed features
-   Project structure
-   Run instructions
-   Environment setup
-   Build status
-   Test status
-   Remaining limitations

باشد.

هدف:

تحویل یک نرم‌افزار قابل اجرا، نه فقط کد اولیه.
