# Followa — Multi Messaging Roadmap

> سند پیگیری اجرای چندپیام‌رسانی؛ مرجع ادامهٔ کار در جلسات آینده.
> ایجاد این سند مجوز اجرای مراحل کدنویسی یا استقرار نیست.

## 1. وضعیت فعلی و نقطهٔ ادامه

- تاریخ آخرین به‌روزرسانی: 2026-09-14
- Repository: [Armanita/Followa](https://github.com/Armanita/Followa)
- شاخهٔ مبنا: `main`
- آخرین Commit کد بررسی‌شده: `701fdbd1f0994633cc813cf475abd84637bc74c3`
- آخرین مرحلهٔ انجام‌شده در این مسیر: بررسی معماری و ثبت این Roadmap.
- مرحلهٔ در حال اجرای کد: هیچ‌کدام.
- مرحلهٔ بعدی پیشنهادی: **P1 — امنیت اتصال فعلی تلگرام**.
- مجوز فعلی: فقط ایجاد این مستند و Commit مستقل آن.
- P1 و تمام مراحل بعدی: نیازمند تأیید مالک پیش از شروع.
- وضعیت استقرار، تنظیمات واقعی ربات و تست زنده: تأیید نشده؛ وضعیت Repository معادل وضعیت سرور نیست.
- هیچ Provider واقعی بله، مدل عمومی هویت یا ارسال چندکاناله در این مسیر پیاده نشده است.

اصلاح شرط شرکت فعال در Auth قبلاً در Commit بالا انجام شده است؛ این اصلاح یکی از مراحل انجام‌شدهٔ Multi Messaging محسوب نمی‌شود و باید حفظ شود.

### ادامهٔ کار در جلسهٔ بعد

1. ابتدا همین سند، جدول پیشرفت و آخرین رکورد جلسه را بخوان.
2. وضعیت working tree، شاخه و HEAD را بررسی کن؛ هیچ تغییر شخص دیگری را بازنویسی نکن.
3. HEAD را با آخرین Commit کد بررسی‌شده یا Checkpoint ثبت‌شده مقایسه کن.
4. اگر تنها این مستند تغییر کرده، بررسی کامل پروژه را تکرار نکن. اگر کد تغییر کرده، Diff و فقط وابستگی‌های متاثر را بررسی و این سند را به‌روز کن.
5. مجوز مرحلهٔ بعد، محدودهٔ فایل‌ها و تصمیم‌های باز آن را بررسی کن. درج مرحله در Roadmap به معنی تأیید اجرا نیست.
6. قبل از ویرایش، SHA مبنا، Branch و فهرست دقیق فایل‌های مجاز را در رکورد مرحله ثبت کن.
7. مرحله را کوچک نگه دار؛ نیاز به فایل خارج از محدوده یا تغییر رفتار اضافی را پیش از اجرا گزارش بده.
8. نتیجهٔ تست، Commit، استقرار، آزمون دستی مالک و Rollback را جدا ثبت کن. سپس توقف کن تا مرحلهٔ بعد تأیید شود.

دستورهای خواندنی پیشنهادی برای ادامه:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git log -5 --oneline
git diff --stat 701fdbd1f0994633cc813cf475abd84637bc74c3..HEAD
git log --oneline -- docs/multi-messaging-roadmap.md
```

در جلسات بعد SHA مبنا را از Checkpoint جدید بخوان؛ مقدار بالا فقط مبنای اولیه است.

## 2. تصمیم محصول و حدود اختیار

### تصمیم قطعی محصول

- Telegram باقی می‌ماند؛ هدف تبدیل Telegram به Bale نیست.
- هدف اعلان‌ها: فقط Telegram، فقط Bale، هر دو به‌طور مستقل، و کانال‌های آینده.
- اعلان داخل برنامه مستقل از انتخاب کانال خارجی باقی می‌ماند.
- هر مرحله Commit مستقل، روش برگشت و تست دستی دارد.
- عبور به مرحلهٔ بعد فقط پس از تأیید مالک انجام می‌شود.

### معماری پیشنهادی؛ نیازمند تصویب جزئیات هر مرحله

- مقصد نهایی: مدل عمومی `MessagingIdentity` و Adapterهای مستقل.
- راه رسیدن: مهاجرت افزایشی و مرحله‌ای، با لایهٔ سازگاری تلگرام.
- مالک هویت: `User`؛ ترجیح اعلان شرکتی: `CompanyMembership`.
- System Admin: فعال‌سازی سراسری و توقف اضطراری کانال؛ جدا برای OTP و اعلان.
- Company Manager: کانال‌های مجاز و پیش‌فرض اعلان شرکت.
- User: اتصال حساب شخصی و انتخاب کانال‌های مجاز.
- نبود ترجیح شخصی با انتخاب صریح «هیچ کانال خارجی» متفاوت است.
- OTP سیاست مستقل دارد؛ انتخاب هر دو کانال اعلان، OTP را خودکار چندکاناله نمی‌کند.
- شروع OTP چندپیام‌رسانی با یک مقصد منتخب؛ Fallback خودکار و ارسال هم‌زمان OTP نیازمند تصمیم مستقل‌اند.
- PostgreSQL و Worker سبک کافی‌اند؛ Redis، microservice یا تغییر معماری اصلی در این برنامه نیست.

### محدودیت‌های ثابت

- فایل‌های `cases`، `assignments`، `files` و منطق کسب‌وکار در این برنامه تغییر نمی‌کنند.
- تولید و اعتبار OTP، تعداد تلاش، Purposeها، JWT، Password Flow و ورود System Admin حفظ می‌شوند.
- `auth-service.ts` خارج از محدودهٔ مراحل ارسال است؛ نیاز به تغییر آن باید پیشاپیش گزارش و تأیید شود.
- Migration قدیمی ویرایش یا حذف نمی‌شود؛ جدول و دادهٔ قدیمی یکباره حذف نمی‌شوند.
- رویدادهای تاریخی بازپخش یا اعلان‌های قبلی مجدداً ارسال نمی‌شوند.
- Token ربات، رمز، OTP خام و Challenge خام وارد Git و Log نمی‌شوند.
- تغییر مدیر یا شماره، مجوز انتقال هویت شخص دیگر نیست.
- UI فارسی و RTL و جداسازی نقش‌ها حفظ می‌شود.
- اجرای واقعی Migration، Backfill، پیام آزمایشی و Deploy باید در مجوز همان مرحله صریح باشد.

## 3. معماری واقعی در مبنا

| بخش | فایل/مسیر واقعی | وضعیت |
|---|---|---|
| Telegram Client | `apps/api/src/modules/telegram/telegram-client.ts` | تنها محل تماس مستقیم sendMessage؛ متن و کیبورد؛ بدون Timeout صریح و Retry |
| اتصال ربات | `telegram-routes.ts` و `telegram-service.ts` در همان پوشه | start، Contact، Pending و تأیید؛ بدون صدور JWT |
| Repository تلگرام | `telegram-repository.ts` | جست‌وجوی User و ثبت دو مدل اختصاصی تلگرام |
| Type و ثابت‌ها | `telegram-types.ts` و `telegram-constants.ts` | در بررسی مبنا مصرف اجرایی پیدا نشد |
| ارسال OTP | `apps/api/src/modules/auth/otp-providers.ts` | انتخاب یک Provider سراسری؛ Telegram واقعی، Bale/Eitaa/SMS نمایشی |
| منطق OTP | `apps/api/src/modules/auth/auth-service.ts` | کد ۵ دقیقه، ۵ تلاش نامعتبر؛ ACTIVATION/PASSWORD_RESET؛ توکن عملیاتی ۱۰ دقیقه؛ Store حافظه‌ای |
| اعلان | `apps/api/src/modules/notifications/notification-service.ts` | ابتدا Notification؛ سپس یک Adapter در صورت تعریف body؛ شکست خارجی فقط Log |
| خواندن اعلان | `notification-routes.ts` در همان پوشه | اعلان داخلی و وضعیت خواندن، مستقل از Telegram |
| کسب‌وکار | `case-service.ts`، `assignment-service.ts` و `file-routes.ts` | استفاده از Notification Service؛ بدون API مستقیم Telegram |
| یادآوری | `apps/api/src/modules/reminders/reminder-routes.ts` | due-check وابسته به درخواست؛ Worker زمان‌بندی مستقل ندارد |
| وضعیت مدیر | `apps/api/src/modules/admin/admin-routes.ts` | خروجی telegramConnected |
| UI مدیر | `apps/web/src/app/admin/page.tsx` | متن و وضعیت اتصال مخصوص Telegram |
| تنظیمات | `apps/api/src/config.ts` | OTP_PROVIDER و NOTIFICATION_PROVIDER سراسری؛ Token/Username/Secret تلگرام |
| راه‌اندازی | `apps/api/src/server.ts` و `plugins/auth.ts` | ثبت Routeها؛ webhook و confirm در Allowlist عمومی |
| مدل‌ها | `apps/api/prisma/schema.prisma` | User با TelegramIdentity اختیاری؛ Notification بدون companyId و Delivery |
| استقرار | `docker-compose.prod.yml` | migrate جدا؛ API فقط منتظر سلامت PostgreSQL است، نه موفقیت migrate |

### مدل فعلی هویت

- `TelegramIdentity.userId` و `telegramUserId` هر دو یکتا هستند.
- `telegramUserId` رشته است؛ `phoneNumber` اختیاری است.
- هویت به User متصل است، نه Company یا نقش.
- `TelegramPendingConnection` با کلید telegramUserId و expiresAt ذخیره می‌شود؛ TTL فعلی ۱۰ دقیقه.
- مدل اصلی User فیلد isActive ندارد؛ وضعیت دسترسی از عضویت و شرکت می‌آید.
- تعویض رسمی مدیر، User جدید می‌سازد و عضویت قدیمی را غیرفعال می‌کند؛ هویت را کپی نمی‌کند.
- تغییر موبایل مدیر در مسیر ویرایش، اتصال قبلی را خودکار بازتأیید یا لغو نمی‌کند.

### یافته‌های امنیتی باز

1. Contact.user_id با فرستنده تطبیق داده نمی‌شود؛ خصوصی بودن چت کنترل نمی‌شود.
2. Secret وب‌هوک فقط در صورت تنظیم بررسی می‌شود؛ مقدار واقعی Production نامعلوم است.
3. مسیر عمومی /telegram/confirm اثبات اختیار مستقل ندارد.
4. ایجاد و تأیید اتصال عضویت و شرکت فعال را بررسی نمی‌کند.
5. بررسی، مصرف Pending و ثبت هویت کاملاً اتمیک نیست.
6. Callback ثابت به Challenge خاص متصل نیست؛ مسیر Callback می‌تواند برای نتیجهٔ rejected نیز پیام موفقیت بفرستد.
7. Adapter اعلان، وضعیت جاری گیرنده و شرکت را پیش از ارسال بازبینی نمی‌کند.
8. دادهٔ قدیمی اتصال را نمی‌توان صرفاً با انتقال جدول «تأییدشدهٔ امن» نامید.

این‌ها یافتهٔ بررسی کد هستند؛ تست نفوذ یا تأیید بهره‌برداری روی سرور واقعی انجام نشده است.

## 4. جدول پیگیری مراحل

وضعیت‌ها: **باقی‌مانده، در حال انجام، منتظر تأیید، انجام‌شده، مسدود، برگشت‌داده‌شده**.
«انجام‌شده» برای مرحلهٔ اجرایی یعنی کد و شواهد ثبت شده و پذیرش دستی مالک ثبت شده باشد؛ Build تنها کافی نیست.

| ID | مرحله | وضعیت | مجوز اجرا | Commit اجرا | پذیرش مالک | Migration |
|---|---|---|---|---|---|---|
| P0 | بررسی و ثبت Roadmap | انجام‌شده — مستندات | فقط مستندات مجاز | Commit ایجاد همین فایل؛ روش یافتن در بخش 10 | مراحل کد تأیید نشده‌اند | خیر |
| P1 | امنیت اتصال فعلی Telegram | باقی‌مانده | لازم | — | — | خیر |
| P2 | قرارداد مشترک Provider | باقی‌مانده | لازم | — | — | خیر |
| P3 | مدل عمومی هویت، بدون مصرف عملیاتی | باقی‌مانده | لازم | — | — | افزایشی |
| P4 | Backfill و همگام‌سازی آزمایشی Telegram | باقی‌مانده | لازم | — | — | انتقال داده؛ بدون Schema جدید |
| P5 | اتصال امن Bale و پیام آزمایشی | باقی‌مانده | لازم | — | — | خیر؛ استفاده از P3 |
| P6 | تنظیمات سیستم، شرکت و User | باقی‌مانده | لازم | — | — | افزایشی |
| P7 | ذخیرهٔ مستقل وضعیت تحویل | باقی‌مانده | لازم | — | — | افزایشی |
| P8 | Notification چندکاناله و Worker | باقی‌مانده | لازم | — | — | خیر؛ استفاده از P7 |
| P9 | انتخاب کانال OTP | باقی‌مانده | لازم | — | — | خیر |
| P10 | خواندن Telegram از مدل عمومی | باقی‌مانده | لازم | — | — | بدون Migration تخریبی |

هیچ مرحلهٔ کدنویسی شروع نشده است. مرحلهٔ در حال انجام، Branch، وضعیت Deployment و Feature Flag واقعی: **هیچ مورد ثبت‌شده‌ای ندارد**.

## 5. قرارداد اجرای هر مرحله

- قبل از شروع: تاریخ، مجوز مالک، SHA مبنا، Branch، Allowlist فایل‌ها و موارد باز را ثبت کن.
- فایل‌های زیر برنامهٔ پیشنهادی‌اند؛ مسیرهای جدید هنوز وجود ندارند. Allowlist نهایی باید دقیق باشد.
- خود این Roadmap در Allowlist هر مرحله قرار می‌گیرد تا وضعیت واقعی ثبت شود.
- ترجیحاً یک Commit متمرکز برای هر مرحله؛ اگر مرحله بزرگ شد، آن را با تأیید مالک به زیرمرحله‌های مستقل تقسیم کن.
- Merge/Deploy از صرف آماده‌سازی کد متمایز است؛ مجوز معتبر جلسه را رعایت کن.
- قبل از Commit: Diff فایل‌ها، Migration، عدم وجود Secret و عدم تغییر بخش ممنوع بررسی شود.
- پس از Commit: SHA و لینک آن را در Checkpoint مستنداتی ثبت کن. SHA خود Commit را نمی‌توان داخل همان Commit جاسازی کرد؛ از Commit مستنداتی بعدی یا Checkpoint بعدی استفاده کن، نه Amend صرفاً برای خودارجاعی.
- ثبت نتیجهٔ تست دستی نباید پیش از دریافت گزارش مالک انجام شود.
- پس از هر مرحله، سند باید وضعیت واقعی، محدودیت‌ها و قدم بعدی را نشان دهد؛ سپس برای شروع مرحلهٔ بعد توقف شود.

### P1 — امنیت اتصال فعلی Telegram

**هدف:** ایمن‌سازی اتصال‌های جدید؛ حفظ ارسال معمول Telegram و منطق OTP.

**فایل‌های پیشنهادی:**
- تغییر: `apps/api/src/modules/telegram/telegram-routes.ts`
- تغییر: `apps/api/src/modules/telegram/telegram-service.ts`
- تغییر: `apps/api/src/modules/telegram/telegram-repository.ts`
- مشروط به نیاز Type: `apps/api/src/modules/telegram/telegram-client.ts`
- فقط Allowlist مسیر تأیید: `apps/api/src/plugins/auth.ts`
- جدید: `apps/api/tests/telegram-linking.test.ts`

**ممنوع:** Auth Service، OTP Provider، Notification Service، Schema و کسب‌وکار.

**Database:** بدون Migration. قفل/تراکنش و مصرف شرطی Pending با امکانات فعلی طراحی شود؛ اگر کافی نبود، توقف و پیشنهاد تغییر محدوده.

**کارها:** اصالت Webhook، Contact متعلق به فرستنده و چت خصوصی، کنترل عضویت/شرکت در شروع و تأیید، بستن تأیید عمومی فاقد اختیار، ثبت اتمیک و موفقیت واقعی. رفتار دقیق شکست در نبود Secret پیش از Deploy نهایی شود؛ کل API نباید بی‌دلیل از کار بیفتد.

**ریسک:** متوسط؛ اتصال‌های قبلاً پذیرفته‌شدهٔ نامعتبر رد خواهند شد.

**Rollback:** برگشت کد از نظر فنی ممکن است ولی ضعف امنیتی را برمی‌گرداند. راه عملیاتی پیشنهادی توقف موقت اتصال جدید با حفظ ارسال موجود است؛ امکان و دستور این توقف باید در اجرای مرحله آماده و ثبت شود. DB rollback لازم نیست.

**تست دستی:** اتصال Contact خود کاربر موفق؛ Contact دیگری/چت عمومی/درخواست فاقد اصالت رد؛ تأیید تکراری و هم‌زمان هویت دوم نسازد؛ غیرفعال‌سازی شرکت بین Pending و تأیید مانع شود؛ OTP و اعلان حساب متصل قبلی کار کند؛ مدیر جدید هویت قبلی را نگیرد.

**شرط خروج:** امنیت اتصال و عدم رگرسیون ارسال با شواهد و تأیید مالک.

### P2 — قرارداد مشترک Provider

**هدف:** جداسازی قرارداد عمومی ارسال از Telegram، بدون تغییر رفتار انتخاب فعلی.

**فایل‌های پیشنهادی:**
- جدید در `apps/api/src/modules/messaging/`: `messaging-types.ts`، `provider-registry.ts`، `providers/telegram-provider.ts`
- تغییر: `apps/api/src/modules/auth/otp-providers.ts`
- تغییر: `apps/api/src/modules/notifications/notification-service.ts`
- جدید: `apps/api/tests/messaging-providers.test.ts`
- تست سازگاری: `apps/api/tests/auth-otp.test.ts`

**ممنوع:** auth-service.ts، Schema، UI، مسیر اتصال امن P1 و کسب‌وکار.
**Database:** ندارد.
**ریسک:** کم تا متوسط؛ تغییر ناخواستهٔ متن، کیبورد یا قرارداد خطا.
**Rollback:** revert مرحله و Deploy؛ داده‌ای تغییر نمی‌کند.
**تست دستی:** یک اعلان دقیقاً یک بار در Telegram؛ متن و کیبورد OTP قبلی؛ فعال‌سازی/فراموشی رمز؛ خطای ارسال و Mock؛ هیچ ارسال چندکاناله آغاز نشود.
**شرط خروج:** رفتار تک‌کانالهٔ قبلی حفظ شده باشد.

### P3 — Schema عمومی هویت

**هدف:** ایجاد ساختار جدید بدون تغییر منبع خواندن ارسال فعلی.

**فایل‌های پیشنهادی:**
- `apps/api/prisma/schema.prisma`
- جدید: `apps/api/prisma/migrations/<timestamp>_add_messaging_identity/migration.sql`
- جدید: `apps/api/src/modules/messaging/messaging-repository.ts`
- جدید: `apps/api/tests/messaging-identity.test.ts`

**ممنوع:** تغییر مدل‌های قدیمی Telegram، OTP/Notification عملیاتی، Routeها و UI.
**Database:** افزایشی؛ MessagingIdentity و MessagingLinkChallenge.
**ریسک:** متوسط؛ Index، یکتایی و زمان Migration.
**Rollback:** نسخهٔ قبلی API با حفظ جدول جدید؛ حذف جدول برای برگشت لازم نیست. Backup و آزمون نسخهٔ قبلی روی Schema توسعه‌یافته ضروری است.
**تست دستی:** ورود و اعلان قبلی سالم؛ دادهٔ قدیمی ثابت؛ شناسهٔ یکسان در دو کانال مستقل؛ اتصال تکراری در یک کانال رد؛ نسخهٔ قبلی API اجرا شود.
**شرط خروج:** Migration روی کپی دیتابیس و سازگاری نسخهٔ قبلی تأیید شود.

### P4 — انتقال و همگام‌سازی هویت Telegram

**هدف:** ساخت نسخهٔ تطبیق‌پذیر از هویت‌های Telegram در مدل عمومی؛ خواندن عملیاتی همچنان قدیمی.

**فایل‌های پیشنهادی:**
- جدید: `apps/api/scripts/backfill-messaging-identities.ts`
- `apps/api/src/modules/telegram/telegram-repository.ts`
- `apps/api/src/modules/messaging/messaging-repository.ts`
- `apps/api/src/config.ts`
- جدید: `apps/api/tests/messaging-compatibility.test.ts`
- جدید: `docs/messaging-migration-runbook.md` فقط پس از تأیید همان مرحله

**ممنوع:** تغییر ارسال OTP/Notification، Schema تخریبی و کسب‌وکار.
**Database:** Backfill دسته‌ای، Dry-run، idempotency و checkpoint؛ Schema جدید ندارد.
**ریسک:** متوسط؛ دو منبع ناسازگار یا verified تلقی کردن دادهٔ قدیمی.
**Rollback:** توقف Backfill/همگام‌سازی و ادامهٔ خواندن قدیمی؛ دادهٔ جدید حفظ شود. ثبت اتصال جدید در دورهٔ گذار در هر دو ساختار باید اتمیک باشد؛ پس از برگشت، پیش از استفادهٔ مجدد مدل جدید تطبیق دوباره لازم است.
**تست دستی:** تعداد و نگاشت userId/externalId تطبیق؛ اجرای دوباره بدون duplicate؛ قطع و ادامهٔ اسکریپت؛ اتصال جدید حین انتقال؛ صفر پیام ناشی از Backfill؛ OTP قبلی سالم.
**شرط خروج:** گزارش تطبیق، تعارض‌ها و سیاست legacy verification ثبت شود.

### P5 — Bale واقعی، فقط اتصال و پیام آزمایشی

**هدف:** اتصال امن Bale و ارسال به مقصد تأییدشدهٔ خود کاربر؛ ارسال عادی و OTP دست‌نخورده.

**فایل‌های پیشنهادی:**
- جدید در `apps/api/src/modules/bale/`: `bale-client.ts`، `bale-routes.ts`، `bale-service.ts`
- جدید در `apps/api/src/modules/messaging/`: `messaging-link-service.ts`، `messaging-routes.ts`، `providers/bale-provider.ts`
- `provider-registry.ts` در همان پوشه
- `apps/api/src/server.ts`، `apps/api/src/config.ts`
- `.env.example`، `.env.prod.example`، `docker-compose.prod.yml`
- جدید: `apps/api/tests/bale-linking.test.ts`

**ممنوع:** Auth Service، ارسال معمول Notification، تغییر Telegram و کسب‌وکار.
**Database:** استفاده از P3؛ Migration تازه ندارد.
**ریسک:** متوسط؛ روش اصالت Webhook و اثبات مالکیت Bale باید با مستندات رسمی و محیط آزمایشی تایید شود، نه کپی فرضی Telegram.
**Rollback:** خاموش کردن Bale و Route جدید؛ حفظ هویت‌های Bale. Secret و ثبت Webhook بیرون Git است و وضعیت بازگرداندن آن جدا ثبت شود.
**تست دستی:** اتصال معتبر و پیام آزمایشی؛ مقصد دلخواه/Contact دیگر/Challenge تکراری و منقضی رد؛ شرکت/عضویت غیرفعال رد؛ اختلال Bale روی Telegram اثر نگذارد.
**شرط خروج:** ربات آزمایشی، مقصد معتبر و عدم اثر روی ارسال فعلی.
**تصمیم باز:** رابط اتصال برای حساب بدون رمز نباید نیازمند Login با OTP همان پیام‌رسان باشد؛ bootstrap امن پیش از اجرا مشخص شود.

### P6 — سیاست‌ها و تنظیمات دریافت

**هدف:** ذخیرهٔ تنظیمات سه‌سطحی؛ Dispatcher جدید هنوز فعال نشود.

**فایل‌های پیشنهادی:**
- `apps/api/prisma/schema.prisma`
- جدید: `apps/api/prisma/migrations/<timestamp>_add_messaging_preferences/migration.sql`
- جدید: `apps/api/src/modules/messaging/messaging-policy.ts` و `messaging-settings-routes.ts`
- `apps/api/src/server.ts`
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/app/(app)/settings/page.tsx`
- جدید: `apps/web/src/components/messaging-settings.tsx`
- جدید: `apps/api/tests/messaging-policy.test.ts`

**ممنوع:** منطق OTP، ارسال فعلی Notification، کسب‌وکار و اپ موبایل.
**Database:** افزایشی؛ سیاست سیستم/شرکت، ترجیح عضویت و ترجیح OTP شخص. محل تنظیمات سراسری (DB یا config) پیش از اجرا نهایی شود.
**ریسک:** متوسط؛ تقدم اشتباه سیاست‌ها و نشت بین شرکت‌ها.
**Rollback:** خاموش کردن مصرف و UI تنظیمات؛ داده‌ها باقی بمانند، رفتار قبلی اجرا شود.
**تست دستی:** مدیر فقط شرکت خود؛ انتخاب Telegram/Bale/both/none؛ تفاوت unset و none؛ ممنوعیت تغییر هویت/مقصد OTP دیگری؛ ذخیرهٔ تنظیمات هنوز ارسال قبلی را تغییر ندهد.
**شرط خروج:** ماتریس سیاست و مجوزها تأیید شود. UI نباید ادعا کند انتخابی که هنوز فعال نشده روی ارسال اثر دارد.
**خارج محدوده:** UI Flutter در مرحلهٔ مستقل آینده با تأیید جدا اضافه می‌شود.

### P7 — ذخیرهٔ وضعیت تحویل بدون ارسال جدید

**هدف:** آماده کردن NotificationDelivery قبل از راه‌اندازی Worker.

**فایل‌های پیشنهادی:**
- `apps/api/prisma/schema.prisma`
- جدید: `apps/api/prisma/migrations/<timestamp>_add_notification_delivery/migration.sql`
- جدید: `apps/api/src/modules/messaging/delivery-repository.ts`
- جدید: `apps/api/tests/notification-delivery.test.ts`

**ممنوع:** مسیر عملیاتی ارسال، OTP، UI و کسب‌وکار.
**Database:** افزایشی؛ NotificationDelivery و زمینهٔ nullable شرکت برای سازگاری اعلان‌های تاریخی.
**ریسک:** کم تا متوسط؛ طراحی کلید یکتا و تاریخچهٔ تلاش‌ها.
**Rollback:** برگشت API و حفظ Schema جدید؛ حذف ستون/جدول لازم نیست.
**تست دستی:** اعلان قدیمی و read/unread سالم؛ Delivery مستقل دو کانال؛ ثبت تکراری کار duplicate نسازد؛ نسخهٔ قبلی API کار کند؛ هیچ ارسال جدید فعال نباشد.
**شرط خروج:** سازگاری Schema و یکتایی کار ارسال.

### P8 — Notification چندکاناله

**هدف:** Telegram-only، Bale-only، both و none برای گروه آزمایشی؛ یک Notification داخلی و Delivery مستقل هر کانال.

**فایل‌های پیشنهادی:**
- `apps/api/src/modules/notifications/notification-service.ts`
- جدید در `apps/api/src/modules/messaging/`: `notification-dispatcher.ts`، `notification-context.ts`، `delivery-worker.ts`
- `delivery-repository.ts` و `messaging-policy.ts` در همان پوشه
- `apps/api/src/config.ts`، `apps/api/package.json`، `docker-compose.prod.yml`
- جدید: `apps/api/tests/multi-channel-notifications.test.ts`

**ممنوع:** Case، Assignment، File، Reminder و Auth Service.
**Database:** استفاده از P7؛ Migration تازه ندارد.
**ریسک:** متوسط تا بالا؛ duplicate، مقصد اشتباه، Timeout و رقابت Workerها.
**طراحی:** زمینهٔ شرکت از linkType/linkId معتبر (Case یا Reminder مرتبط) در لایهٔ اعلان استخراج شود؛ برای موارد مبهم حدس نزن. active بودن عضویت همان شرکت، وضعیت هویت و سیاست قبل از ارسال و Retry کنترل شوند. ارسال فوری قدیمی و Worker برای یک اعلان هم‌زمان فعال نشوند. کار صف‌شده به شناسه/نسخهٔ اتصال مشخص مقید باشد؛ به اتصال جدید منحرف نشود.
**Rollback:** توقف ایجاد کار جدید، توقف/تخلیهٔ کنترل‌شده Worker، تعیین تکلیف in-flight، فعال کردن مسیر قبلی؛ صف حفظ و خودکار بازپخش نشود. revert تنها کافی نیست. پیام ارسال‌شده قابل پس‌گرفتن با revert نیست.
**تست دستی:** فقط Telegram؛ فقط Bale؛ هر دو و یک اعلان داخلی؛ هیچ‌کدام؛ شکست Bale فقط Bale را Retry کند؛ غیرفعال‌سازی شرکت قبل از ارسال مانع شود؛ تغییر هویت مقصد پیام قدیمی را عوض نکند؛ Restart و rollback موجب ارسال کنترل‌نشده نشوند.
**شرط خروج:** شواهد هر چهار حالت، شکست جزئی و آزمون rollback.
**محدودیت:** ثبت Notification و Delivery اتمیک می‌شود؛ شکاف موجود بین عملیات کسب‌وکار و فراخوانی Notification با ممنوعیت تغییر Case/Assignment رفع کامل نمی‌شود. تضمین exactly-once خارجی در Timeout ادعا نشود. ایجاد Scheduler جدید یادآوری در این مرحله نیست.

### P9 — کانال منتخب OTP

**هدف:** تغییر مسیر تحویل کد با حفظ تولید، اعتبارسنجی و Password Flow.

**فایل‌های پیشنهادی:**
- `apps/api/src/modules/auth/otp-providers.ts`
- جدید: `apps/api/src/modules/messaging/otp-dispatcher.ts`
- `apps/api/src/modules/messaging/messaging-policy.ts`
- `apps/api/src/config.ts`
- `apps/api/tests/auth-otp.test.ts`
- جدید: `apps/api/tests/multi-channel-otp.test.ts`
- بخش OTP در فایل‌های UI تنظیمات P6، فقط در صورت نیاز و تأیید

**ممنوع:** auth-service.ts، JWT، Password Flow، Notification و کسب‌وکار. نیاز به تغییر قرارداد Auth باید پیشاپیش گزارش شود.
**Database:** از ترجیحات P6 استفاده می‌کند؛ Migration جدید ندارد.
**ریسک:** بالا؛ قفل شدن فعال‌سازی یا بازیابی رمز.
**طراحی:** مقصد از هویت معتبر انتخاب شود، نه chatId دلخواه درخواست. ارسال یک‌کاناله در شروع؛ fallback خودکار و OTP هم‌زمان خارج محدوده. انتخاب کانال نباید TTL/attempts را reset کند. روش bootstrap حساب passwordless پیش از rollout نهایی شود. OTP کوتاه‌عمر را وارد صف Retry دیرهنگام اعلان‌ها نکن.
**Rollback:** خاموش کردن routing جدید و بازگشت انتخاب قبلی؛ کاربران Bale-only باید مسیر بازیابی تاییدشده داشته باشند، نباید به کانال ناموجود برگردند. Restart، OTP و pending token حافظه‌ای را پاک می‌کند و درخواست کد تازه لازم است؛ DB rollback نیست.
**تست دستی:** فعال‌سازی و فراموشی رمز در هر کانال؛ wrong/expired/reused؛ جداسازی Purpose؛ غیرفعال‌سازی شرکت پس از دریافت کد؛ خطای ارسال؛ ورود با رمز و System Admin؛ rollback با کاربران آزمایشی.
**شرط خروج:** پذیرش کامل جریان‌های Auth و مسیر بازیابی کاربران بدون Telegram.

### P10 — خواندن Telegram از مدل عمومی

**هدف:** تکمیل معماری عمومی، با حفظ ساختار قدیمی در دورهٔ برگشت.

**فایل‌های پیشنهادی:**
- `apps/api/src/modules/messaging/messaging-repository.ts`
- `apps/api/src/modules/messaging/providers/telegram-provider.ts`
- `apps/api/src/modules/telegram/telegram-repository.ts`
- `apps/api/src/modules/admin/admin-routes.ts`
- `apps/api/src/config.ts`
- `apps/api/tests/messaging-compatibility.test.ts`
- `docs/messaging-migration-runbook.md`

**ممنوع:** حذف Telegram، جدول قدیمی، داده، کسب‌وکار و الگوریتم OTP.
**Database:** بدون Migration تخریبی؛ تطبیق نهایی داده و تغییر منبع خواندن.
**ریسک:** متوسط تا بالا؛ اختلاف داده یا احیای هویت لغوشده.
**Rollback:** بازگشت منبع خواندن فقط پس از تضمین همگامی ثبت/تغییر/لغو هویت؛ tombstone نباید با fallback به جدول قدیمی نادیده گرفته شود. dual-write باید در دورهٔ rollback باقی بماند.
**تست دستی:** تطبیق هویت؛ OTP و اعلان Telegram از مدل عمومی؛ اتصال/قطع/اتصال مجدد؛ مدیر قدیمی/جدید مستقل؛ rollback هویت revoked را احیا نکند؛ Admin وضعیت درست نشان دهد.
**شرط خروج:** صحت منبع عمومی، بازتأیید لازم داده‌های قدیمی و تمرین برگشت.
**خارج محدوده:** حذف جدول قدیمی و پایان dual-write نیازمند مرحله و تأیید جداگانه است.

## 6. توصیهٔ مدل و Migration

### مدل‌های هدف پیشنهادی

| مدل | اطلاعات مهم |
|---|---|
| MessagingIdentity | userId، channel، externalUserId، مقصد ارسال در صورت تفاوت، status، verifiedAt/method، legacy provenance، revokedAt، نسخهٔ اتصال |
| MessagingLinkChallenge | User، channel، مقصد، Hash توکن تصادفی، expiresAt، consumedAt |
| CompanyMessagingPolicy | companyId، channel، مجاز بودن و پیش‌فرض اعلان |
| MembershipNotificationPreference | membershipId، channel، انتخاب دریافت |
| UserOtpPreference | انتخاب مستقل کانال OTP برای User |
| NotificationDelivery | notificationId، company context، identity/version، channel، status، attempts، nextAttemptAt، providerMessageId |

Channel با شرکت ارائه‌دهنده یکی نیست: SMS یک کانال است و پنل پیامک یک driver اجرایی؛ تغییر پنل نباید هویت کاربر را عوض کند. قابلیت‌های Provider مانند متن، قالب و رسید تحویل باید صریح باشند؛ ویژگی‌های Telegram عمومی فرض نشوند.

قواعد حداقلی: یک هویت خارجی فعال در یک کانال متعلق به یک User؛ حداکثر یک اتصال فعال User در هر کانال برای شروع. جزئیات unique/partial index و نگهداری تاریخچه پیش از P3 نهایی شود. شناسهٔ Telegram هرگز به عنوان Bale ID کپی نشود.

### راهبرد منتخب پیشنهادی

**C: مهاجرت مرحله‌ای به B (مدل عمومی)**. مدل جدا برای هر پیام‌رسان شروع ساده‌تری دارد ولی با هدف دائمی چندپیام‌رسانی، کنترل امنیت و تنظیمات را تکرار می‌کند.

1. Expand: جدول عمومی افزوده شود.
2. Backfill: کپی دسته‌ای، قابل توقف/ادامه، بدون ارسال پیام.
3. Compare: شمارش و نگاشت‌ها و تعارض‌ها بررسی شوند.
4. Compatible writes: نوشتن Telegram در دورهٔ گذار در هر دو ساختار اتمیک باشد.
5. Switch reads: تنها پس از پذیرش، منبع عمومی خوانده شود.
6. Contract: حذف قدیمی در این Roadmap مجاز نیست.

Pending قدیمی به‌عنوان هویت دائمی یا Challenge جدید مهاجرت نمی‌شود. مهلت محدودش در مسیر معتبر قبلی تمام شود یا اتصال دوباره آغاز شود.

Backfill، legacy را verified جدید نمی‌کند. سیاست بازتأیید پیش از استفادهٔ عمومی برای OTP باید توسط مالک تایید و ثبت شود؛ تشدید یکبارهٔ سیاست نباید بدون مسیر بازیابی کاربران را قفل کند.

### Rollback دیتابیس

- git revert دیتابیس را برنمی‌گرداند.
- راه معمول: rollback برنامه با باقی گذاشتن Schema افزایشی.
- Migration اعمال‌شده ویرایش/حذف نمی‌شود.
- حذف جدول جدیدِ دارای داده، rollback امن نیست.
- Restore Backup ممکن است تغییرات جدید کاربران را از بین ببرد؛ راه عادی برگشت این طرح نیست.
- پیش از Migration: Backup، آزمون بازیابی روی محیط جدا، تست نسخهٔ قبلی API و ثبت نسخهٔ schema.
- Production با مسیر migrate deploy موجود پروژه و اجرای کنترل‌شده؛ migrate dev/reset، db push تخریبی یا seed مجدد راه اجرای این برنامه نیستند.
- Compose فعلی، API را به موفقیت سرویس migrate وابسته نکرده؛ ترتیب موفقیت Migration و سپس API جدید باید صریح کنترل شود.
- استقرار/خاموشی Worker، Webhook و Feature Flag مستقل از SHA کد ثبت شود.

## 7. تست‌ها و شواهد مشترک

دستورهای موجود در package فعلی (فقط راهنما؛ اکنون اجرا نشده‌اند):

```bash
pnpm --filter @followa/api build
pnpm --filter @followa/api typecheck
pnpm --filter @followa/api test
```

تست‌های DB فقط روی دیتابیس تست ایزوله با بررسی تنظیمات helpers اجرا شوند؛ اعتبارنامهٔ Production برای تست استفاده نشود.

- مراحل بدون رفتار جدید: تست‌های متمرکز و smoke؛ کل تست‌ها صرفاً برای مصرف وقت تکرار نشوند.
- مراحل هویت: مالکیت، انقضا، تکرار، race و isolation.
- مراحل Schema: اعتبارسنجی Migration و نسخهٔ قبلی برنامه.
- مراحل ارسال: شکست جزئی، مقصد لغوشده، Timeout و restart.
- مرحلهٔ OTP: Purpose isolation، one-time use و عدم تغییر TTL/attempts/JWT.
- تست دستی مالک: حساب مدیر و کارمند آزمایشی، دو شرکت آزمایشی و حساب‌های پیام‌رسان متعلق به تست‌کننده.
- وضعیت‌ها را صادقانه ثبت کن: PASS / FAIL / NOT RUN / BLOCKED. Mock موفق به معنی ارسال واقعی موفق نیست.
- آزمون فعلی این Roadmap: فقط بررسی مستند/محدوده؛ هیچ تست API، دیتابیس یا ارسال زنده در مرحلهٔ مستندات انجام نشده است.

## 8. تصمیم‌های باز پیش از اجرا

| موضوع | زمان تعیین تکلیف | وضعیت |
|---|---|---|
| رفتار در نبود Secret و نحوهٔ توقف فقط اتصال جدید | P1 | باز |
| روش اتمیک مصرف Pending با Schema فعلی | P1 | باز؛ ناکافی بود توقف |
| unique فعال، تاریخچه و نسخهٔ هویت | P3 | باز |
| legacy verification و بازتأیید بدون قفل حساب | P4 و پیش از P9/P10 | باز |
| اثبات مالکیت و اصالت Webhook بله | پیش از P5 | باز |
| bootstrap کاربر بدون رمز و بدون کانال قبلی | پیش از P5 و P9 | باز |
| تقدم سیاست‌ها، default/unset/none و محل تنظیم سراسری | P6 | پیشنهاد ثبت‌شده؛ پذیرش لازم |
| کانتکست شرکت برای تمام Notificationهای واقعی | پیش از P8 | موارد مبهم گزارش شوند |
| claim/lease Worker، Retry و Timeout نامطمئن | P7/P8 | باز |
| rollback برای کاربر Bale-only | پیش از P9 | باز |
| تنظیمات موبایل Flutter و حذف Schema قدیمی | پس از این مسیر | خارج محدوده |

برای تصمیم باز، پاسخ کاربر را در Decision Log ثبت کن. نام Feature Flagهای پیشنهادی را تا پیاده‌سازی «موجود» فرض نکن.

## 9. الگوی ثبت اجرای هر مرحله و جلسات

پس از شروع/اتمام/برگشت هر مرحله، جدول بخش 4 و این رکورد تکمیل شود:

### رکورد مرحله: P__ — عنوان

- وضعیت:
- تاریخ و مسئول اجرا:
- مجوز مالک (تاریخ و خلاصهٔ دامنه؛ بدون جعل تأیید):
- Branch / Base SHA:
- فایل‌های مجاز نهایی:
- فایل‌های واقعاً تغییرکرده:
- Commitهای اجرا (SHA کامل و لینک):
- Commit مستنداتی ثبت نتیجه:
- Merge SHA، در صورت وجود:
- Migrationها / نسخهٔ Schema / نتیجهٔ اجرا:
- Backfill checkpoint / شمارش / تعارض‌ها:
- محیط و SHA مستقرشده:
- Feature Flagهای واقعی و مقادیر غیرمحرمانه:
- تست خودکار (دستور، نتیجه، شواهد):
- تست دستی مالک (تاریخ، نتیجه، موارد اجرا نشده):
- Rollback دقیق کد/تنظیم/Worker/داده:
- نتیجهٔ تمرین Rollback:
- ریسک باقی‌مانده / مانع:
- پذیرش مالک برای اتمام این مرحله:
- مجوز شروع مرحلهٔ بعد (جدا از پذیرش مرحله):
- قدم بعدی دقیق و فایل آغاز بررسی:

### Checkpoint توقف میان مرحله

- آخرین کار تکمیل‌شده:
- کار ناتمام:
- Branch/Commit یا وضعیت Diff ذخیره‌شده:
- تست‌های اجراشده و اجرا‌نشده:
- وضعیت دیتابیس/استقرار:
- دستور یا اقدام دقیق بعدی:
- دلیل توقف و تأیید موردنیاز:

### Decision Log

| تاریخ | موضوع | تصمیم و دلیل | تصویب‌کننده/وضعیت |
|---|---|---|---|
| 2026-09-14 | هدف محصول | حفظ Telegram و افزودن چند Provider | درخواست مالک |
| 2026-09-14 | این نوبت | فقط ایجاد Roadmap و Commit مستنداتی | درخواست مالک |
| 2026-09-14 | مسیر فنی | ۱۰ مرحله، مدل عمومی با مهاجرت افزایشی | پیشنهاد؛ اجرا نیازمند تأیید مرحله‌ای |

## 10. تاریخچه، Commitها و اسناد مرتبط

### تاریخچهٔ اولیه

| رویداد | وضعیت | مرجع |
|---|---|---|
| شرط عضویت و شرکت فعال در Auth | در کد مبنا وجود دارد؛ استقرار زنده در این سند تأیید نشده | [701fdbd](https://github.com/Armanita/Followa/commit/701fdbd1f0994633cc813cf475abd84637bc74c3) |
| Audit تلگرام و برنامهٔ چندمرحله‌ای | انجام‌شده در بررسی؛ هیچ اجرای مرحلهٔ کد | مبنای این سند |
| P0: ایجاد این Roadmap | مستندات تنها | Commit ایجاد فایل در تاریخچهٔ Git |
| P1 تا P10 | شروع نشده | هیچ Commit اجرا ندارد |

برای یافتن SHA دقیق P0، بدون مشکل خودارجاعی SHA داخل همان Commit:

```bash
git log --diff-filter=A --format='%H %s' -- docs/multi-messaging-roadmap.md
```

در اولین Checkpoint بعدی SHA ایجاد فایل را نیز به جدول اضافه کن. برای مرحله‌های کد، SHA نهایی را در اولین به‌روزرسانی مستنداتی پس از Commit حتماً ثبت کن.

### اسناد مرتبط

- [معماری موجود](architecture.md)
- [برنامهٔ ۱۴ موردی](approved-14-implementation-plan.md) — این Roadmap جزئیات مسیر پیام‌رسانی را محدود و مرحله‌بندی می‌کند؛ مجوز تغییر سایر آیتم‌های آن نیست.
- [طرح قدیمی Telegram](telegram-integration.md) — برخی بخش‌ها آرمانی/اجرانشده‌اند؛ مرجع واقعیت کد نیست. این مسیر Telegram approval login یا TelegramAuthSession را اضافه نمی‌کند.
- [مرحلهٔ Customer](phase-c-customer-domain.md) — دامنهٔ کسب‌وکار جداست و در این مسیر تغییر نمی‌کند.
- [راهنمای تست دستی](manual-testing-guide-fa.md)
- [استقرار](deployment.md)

**وضعیت پایان این جلسه: فقط ثبت مستندات. قدم بعدی: دریافت تأیید برای محدودهٔ P1؛ تا آن زمان STOP.**
