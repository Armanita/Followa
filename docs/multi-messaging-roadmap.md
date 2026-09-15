# Followa — Multi Messaging Roadmap

> سند پیگیری اجرای چندپیام‌رسانی؛ مرجع ادامهٔ کار در جلسات آینده.
> ایجاد این سند مجوز اجرای مراحل کدنویسی یا استقرار نیست.

## 1. وضعیت فعلی و نقطهٔ ادامه

- تاریخ آخرین به‌روزرسانی: 2026-09-15
- Repository: [Armanita/Followa](https://github.com/Armanita/Followa)
- شاخهٔ مبنا: `main`
- آخرین Commit کد بررسی‌شده: `5b9f464e28753d5240c5f6156d20acb167c0d151`
- آخرین مرحلهٔ اجراشده در این مسیر: **P10 — خواندن Telegram از مدل عمومی**؛ کد opt-in در Git تکمیل و Build خودکار موفق است، اما Read Flag خاموش و تطبیق DB/Vitest/Live/Rollback/پذیرش مالک اجرا نشده‌اند.
- مرحلهٔ در حال اجرای کد: هیچ‌کدام.
- مرحلهٔ بعدی پیشنهادی: اجرای Migrationهای P3/P6/P7، Backfill/Reverification و تست یکپارچه P4 تا P10 روی کپی ایزوله؛ سپس Rollout کنترل‌شده و ثبت پذیرش مالک.
- مجوز ثبت‌شده: اجرای کد و Checkpoint مستنداتی P10؛ مجوز Migration، Backfill، فعال‌سازی Flagها یا ارسال واقعی داده نشده است.
- تمام Phaseهای کدنویسی P0 تا P10 در Repository اجرا شده‌اند؛ بسته‌شدن مسیر نیازمند تست DB/Live، تمرین Rollback و پذیرش مالک است.
- وضعیت استقرار، تنظیمات واقعی ربات و تست زنده: تأیید نشده؛ وضعیت Repository معادل وضعیت سرور نیست.
- Provider و اتصال امن Bale به‌صورت opt-in افزوده شده، اما Provider اعلان/OTP و ارسال چندکاناله فعال نشده است؛ خواندن عملیاتی Telegram همچنان Legacy است.

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

این‌ها یافتهٔ بررسی مبنا هستند؛ موارد 1 تا 6 در اجرای P1 با الزام Secret، مالکیت Contact، چت خصوصی، حذف مسیر عمومی، Challenge امضاشده، کنترل دسترسی و تراکنش Serializable پوشش داده شدند. موارد 7 و 8 خارج از P1 باقی می‌مانند. تست نفوذ یا تأیید بهره‌برداری روی سرور واقعی انجام نشده است.

## 4. جدول پیگیری مراحل

وضعیت‌ها: **باقی‌مانده، در حال انجام، منتظر تأیید، انجام‌شده، مسدود، برگشت‌داده‌شده**.
«انجام‌شده» برای مرحلهٔ اجرایی یعنی کد و شواهد ثبت شده و پذیرش دستی مالک ثبت شده باشد؛ Build تنها کافی نیست.

| ID | مرحله | وضعیت | مجوز اجرا | Commit اجرا | پذیرش مالک | Migration |
|---|---|---|---|---|---|---|
| P0 | بررسی و ثبت Roadmap | انجام‌شده — مستندات | فقط مستندات مجاز | [6ceb94f](https://github.com/Armanita/Followa/commit/6ceb94fdcae35388b603f39209d6d9c1ea29ae9b) | — | خیر |
| P1 | امنیت اتصال فعلی Telegram | منتظر تأیید دستی مالک — اجرای کد تکمیل | 2026-09-15 | [a4cc132](https://github.com/Armanita/Followa/commit/a4cc13253e793198ea52cdd37a403272c6ca098b) | اجرا نشده | خیر |
| P2 | قرارداد مشترک Provider | منتظر تأیید دستی مالک — اجرای کد تکمیل | 2026-09-15 | [83f6474](https://github.com/Armanita/Followa/commit/83f6474dfb63ef1216074e6d44c11338aeb5831b)؛ تکمیل 3 Commit مقدماتی | اجرا نشده | خیر |
| P3 | مدل عمومی هویت، بدون مصرف عملیاتی | منتظر تست Migration و تأیید مالک — Repository تکمیل | 2026-09-15؛ بدون مجوز Production | [92e5701](https://github.com/Armanita/Followa/commit/92e5701e96c8c2780be47fb47843e324da005cd9) | اجرا نشده | افزایشی؛ اجرا نشده |
| P4 | Backfill و همگام‌سازی آزمایشی Telegram | منتظر تست DB، Backfill مجاز و تأیید مالک — اجرای کد تکمیل | 2026-09-15؛ بدون مجوز Production | [f228ac8](https://github.com/Armanita/Followa/commit/f228ac88080b3e8d93cb6c39fd9dd39e03456dc4) | اجرا نشده | انتقال داده اجرا نشده؛ Schema جدید ندارد |
| P5 | اتصال امن Bale و پیام آزمایشی | منتظر Migration، تست ربات/DB و تأیید مالک — اجرای کد تکمیل | 2026-09-15؛ بدون مجوز Deploy/Webhook | [8dc7a81](https://github.com/Armanita/Followa/commit/8dc7a814c78b357afbdb5abb7afd65a2680b1e78) | اجرا نشده | خیر؛ استفاده از P3 |
| P6 | تنظیمات سیستم، شرکت و User | منتظر Migration، تست DB/Build و تأیید مالک — Repository تکمیل | 2026-09-15؛ بدون مجوز Production | [0ce519a](https://github.com/Armanita/Followa/commit/0ce519a8117aeeb35d852c19f5f2bf5471d8d3f7) | اجرا نشده | افزایشی؛ اجرا نشده |
| P7 | ذخیرهٔ مستقل وضعیت تحویل | منتظر Migration، تست DB/Vitest و تأیید مالک — Repository تکمیل | 2026-09-15؛ بدون مجوز Production | [1976c05](https://github.com/Armanita/Followa/commit/1976c05603b4ba6a335d1ab14800adc7b9643d83) | اجرا نشده | افزایشی؛ اجرا نشده |
| P8 | Notification چندکاناله و Worker | منتظر Migration، تست DB/Live و تأیید مالک — اجرای کد opt-in تکمیل | 2026-09-15؛ Flagها خاموش | [ef1b719](https://github.com/Armanita/Followa/commit/ef1b719d3d6979507e904e9b5a13ad0e72855271) | اجرا نشده | خیر؛ استفاده از P7 |
| P9 | انتخاب کانال OTP | منتظر Vitest/DB/Live و تأیید مالک — اجرای کد opt-in تکمیل | 2026-09-15؛ Flag خاموش | [7f39a3b](https://github.com/Armanita/Followa/commit/7f39a3be580bddd99ea56f99ed460af727513b7d) | اجرا نشده | خیر |
| P10 | خواندن Telegram از مدل عمومی | منتظر تطبیق DB/Vitest/Live/Rollback و تأیید مالک — اجرای کد opt-in تکمیل | 2026-09-15؛ Read Flag خاموش | [5b9f464](https://github.com/Armanita/Followa/commit/5b9f464e28753d5240c5f6156d20acb167c0d151) | اجرا نشده | بدون Migration تخریبی |

هیچ مرحله‌ای اکنون در حال اجرا نیست. اجرای Repository برای P1 تا P10 تکمیل شده، اما پذیرش دستی ثبت نشده است. Migrationهای P3/P6/P7، Backfill/Reverification P4 و تست‌های DB/Live اجرا نشده‌اند؛ Flagهای P8/P9/P10 پیش‌فرض خاموش‌اند و منبع خواندن Telegram هنوز Legacy است.

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
| رفتار در نبود Secret و نحوهٔ توقف فقط اتصال جدید | P1 | تصمیم اجراشده: پاسخ 503 و عدم ایجاد Pending؛ ارسال خروجی موجود مستقل باقی می‌ماند |
| روش اتمیک مصرف Pending با Schema فعلی | P1 | تصمیم اجراشده: تراکنش Serializable، حذف شرطی Pending و Retry محدود P2034؛ بدون Migration |
| unique فعال، تاریخچه و نسخهٔ هویت | P3 | تصمیم اجراشده: یک ردیف جاری برای User/Channel، یکتایی Channel/External ID، version=1 و وضعیت ACTIVE/REVOKED؛ تاریخچه چندردیفی در P3 ایجاد نشد |
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

### رکورد مرحله: P1 — امنیت اتصال فعلی Telegram

- وضعیت: اجرای کد تکمیل؛ منتظر تست و پذیرش دستی مالک.
- تاریخ و مسئول اجرا: 2026-09-15، Codex با درخواست مالک Repository.
- مجوز مالک: اجرای فقط P1 طبق Roadmap و ثبت Commit/Checkpoint.
- Branch / Base SHA: `main` / `22ef5683e3e9df64fce62ae73679ce9e8cd2c8e5`. در ابتدای کار HEAD مورد انتظار `6ceb94f` بود، اما تغییر هم‌زمان شناسایی و بدون Force یا بازنویسی روی HEAD جدید بازسازی شد.
- فایل‌های مجاز نهایی: سه فایل Route/Service/Repository تلگرام، تغییر Type مشروط Client، حذف Allowlist مسیر تأیید از Auth Plugin، تست جدید و همین Roadmap.
- فایل‌های واقعاً تغییرکرده:
  - `apps/api/src/modules/telegram/telegram-routes.ts`
  - `apps/api/src/modules/telegram/telegram-service.ts`
  - `apps/api/src/modules/telegram/telegram-repository.ts`
  - `apps/api/src/modules/telegram/telegram-client.ts`
  - `apps/api/src/plugins/auth.ts`
  - `apps/api/tests/telegram-linking.test.ts`
  - `docs/multi-messaging-roadmap.md` فقط در Checkpoint مستنداتی بعد از Commit اجرا
- Commitهای اجرا: [a4cc13253e793198ea52cdd37a403272c6ca098b](https://github.com/Armanita/Followa/commit/a4cc13253e793198ea52cdd37a403272c6ca098b). Commit قدیمی [2e69be7](https://github.com/Armanita/Followa/commit/2e69be72d16ca5ea41f0879a40d2068808c1cd84) بخشی از P1 را پیش‌تر اعمال کرده بود؛ Commit نهایی این رکورد کاستی‌های آن را کامل می‌کند.
- Commit مستنداتی ثبت نتیجه: [f06ce92](https://github.com/Armanita/Followa/commit/f06ce92bfaa81016123bccd3afa508807a7a0c49).
- Merge SHA: Commit مستقیم و fast-forward روی `main`؛ Merge جدا ندارد.
- Migrationها / نسخهٔ Schema / نتیجهٔ اجرا: ندارد؛ Schema و داده تغییر نکرد.
- Backfill checkpoint / شمارش / تعارض‌ها: ندارد.
- محیط و SHA مستقرشده: استقرار انجام یا تأیید نشده؛ Repository معادل Production فرض نشده است.
- Feature Flagهای واقعی: Feature Flag جدید ندارد. نبود `TELEGRAM_WEBHOOK_SECRET` اتصال جدید را با 503 متوقف می‌کند و خواندن هویت/ارسال خروجی موجود را تغییر نمی‌دهد.
- خلاصه تغییرات:
  - Webhook بدون Secret معتبر Fail-closed است و مقایسه Secret زمان‌ثابت انجام می‌شود.
  - فقط Contact ارسالی از حساب خود فرستنده در چت خصوصی پذیرفته می‌شود.
  - مسیر عمومی `/telegram/confirm` حذف و از Allowlist عمومی JWT خارج شد.
  - Callback دارای Challenge امضاشده و وابسته به Telegram ID، User، Pending، انقضا و شماره فعلی است؛ تجدید Pending دکمه قدیمی را باطل می‌کند.
  - عضویت فعال و شرکت فعال هم هنگام ساخت Pending و هم هنگام تأیید بررسی می‌شود.
  - مصرف Pending و ایجاد Identity در تراکنش Serializable انجام می‌شود؛ اتصال موجود منتقل یا overwrite نمی‌شود و پیام موفقیت فقط برای نتیجه `connected` ارسال می‌شود.
  - OTP، Notification، JWT، Password Flow و Providerهای P2 تغییر نکردند.
- تست خودکار:
  - PASS: خواندن مجدد شش فایل از Commit و بررسی Syntax هر فایل با `node --experimental-strip-types --check`.
  - ADDED / NOT RUN: مجموعه `apps/api/tests/telegram-linking.test.ts` برای Secret، Contact مالک، چت خصوصی، مسیر عمومی، عضویت/شرکت، انقضا، replay، rotation، عدم انتقال هویت، rollback تراکنش و سازگاری خواندن هویت.
  - NOT RUN: `pnpm --filter @followa/api build`، `typecheck` و Vitest؛ Checkout احراز‌شده و dependency/دیتابیس تست در محیط Connector در دسترس نبود.
  - NOT RUN: PostgreSQL واقعی، Telegram واقعی، تست نفوذ و تست Production.
- تست دستی مالک: اجرا نشده؛ موارد تست دستی تعریف‌شده در بخش P1 همچنان لازم‌اند.
- Rollback دقیق:
  - راه اضطراری امن: مقدار `TELEGRAM_WEBHOOK_SECRET` را خالی/حذف و API را Restart کن؛ Route اتصال جدید 503 می‌دهد، Pending تازه ساخته نمی‌شود و ارسال موجود OTP/Notification از TelegramIdentity ادامه دارد.
  - تغییر Secret تمام دکمه‌های Pending قبلی را نامعتبر می‌کند؛ کاربران باید پس از بازفعال‌سازی اتصال را دوباره آغاز کنند.
  - DB rollback لازم نیست و هیچ داده‌ای در Deploy کد تغییر نمی‌کند.
  - `git revert a4cc13253e793198ea52cdd37a403272c6ca098b` از نظر Git ممکن است، اما ضعف‌های امنیتی نسخه قبلی را برمی‌گرداند و برای Production توصیه نمی‌شود؛ اگر برگشت کد اجتناب‌ناپذیر است، ابتدا دسترسی Webhook را در لایه ورودی مسدود کن.
- نتیجهٔ تمرین Rollback: عملیاتی/Production اجرا نشده؛ رفتار Fail-closed نبود Secret در تست متمرکز پوشش داده شده ولی Vitest اجرا نشده است.
- ریسک باقی‌مانده / مانع: Build و تست DB/Live انجام نشده؛ پذیرش دستی مالک لازم است. داده‌های TelegramIdentity قدیمی در P1 بازتأیید نشده‌اند.
- پذیرش مالک برای اتمام این مرحله: ثبت نشده.
- مجوز شروع مرحلهٔ بعد: ثبت نشده.
- قدم بعدی دقیق: اجرای تست‌های خودکار در محیط پروژه و تست دستی P1؛ سپس ثبت پذیرش یا مشکل. تا تأیید جداگانه، هیچ Phase بعدی شروع نشود.

### رکورد مرحله: P2 — قرارداد مشترک Provider

- وضعیت: اجرای کد تکمیل؛ منتظر Build/Vitest، تست دستی و پذیرش مالک.
- تاریخ و مسئول اجرا: 2026-09-15، Codex با درخواست مالک Repository.
- مجوز مالک: شروع و اجرای P2؛ هیچ مجوزی برای P3 یا مراحل بعد ثبت نشد.
- Branch / Base SHA: `main` / `f06ce92bfaa81016123bccd3afa508807a7a0c49`.
- فایل‌های مجاز نهایی: سه فایل Messaging تعریف‌شده در P2، `otp-providers.ts`، `notification-service.ts`، تست Provider، تست سازگاری OTP و همین Roadmap.
- فایل‌های واقعاً تغییرکرده:
  - `apps/api/src/modules/messaging/messaging-types.ts`
  - `apps/api/src/modules/messaging/provider-registry.ts`
  - `apps/api/src/modules/messaging/providers/telegram-provider.ts`
  - `apps/api/src/modules/auth/otp-providers.ts`
  - `apps/api/src/modules/notifications/notification-service.ts`
  - `apps/api/tests/messaging-providers.test.ts`
  - `apps/api/tests/auth-otp.test.ts`
  - `docs/multi-messaging-roadmap.md` فقط در Checkpoint مستنداتی بعد از Commit اجرا
- Commitهای اجرا:
  - Commit نهایی P2: [83f6474dfb63ef1216074e6d44c11338aeb5831b](https://github.com/Armanita/Followa/commit/83f6474dfb63ef1216074e6d44c11338aeb5831b).
  - Commitهای مقدماتی موجود پیش از شروع این جلسه: [9b14150](https://github.com/Armanita/Followa/commit/9b14150fe7f5d3d034bfe114c1b8d68d08f5b466)، [fc88c81](https://github.com/Armanita/Followa/commit/fc88c8152562fa5b35a5a2428f12fe50fb1bdd5f)، [22ef568](https://github.com/Armanita/Followa/commit/22ef5683e3e9df64fce62ae73679ce9e8cd2c8e5). این سه Commit فقط اسکلت اولیه را افزوده بودند؛ Commit نهایی قرارداد را مصرف عملیاتی و تست آن را کامل کرد.
- Commit مستنداتی ثبت نتیجه: [cea9a10](https://github.com/Armanita/Followa/commit/cea9a10cdbe3410e0b51faaca2c17dd5f64a7aba).
- Merge SHA: Commit مستقیم و fast-forward روی `main`؛ Merge جدا ندارد.
- Migrationها / نسخهٔ Schema / نتیجهٔ اجرا: ندارد؛ Schema و داده تغییر نکرد.
- Backfill checkpoint / شمارش / تعارض‌ها: ندارد.
- محیط و SHA مستقرشده: استقرار انجام یا تأیید نشده؛ Repository معادل Production فرض نشده است.
- Feature Flagهای واقعی: Feature Flag جدید ندارد؛ انتخاب `OTP_PROVIDER` و `NOTIFICATION_PROVIDER` مانند قبل تک‌مقداری و تک‌کاناله باقی مانده است.
- خلاصه تغییرات:
  - قرارداد `MessagingProvider` برای destination، متن و metadata اختیاری تثبیت شد.
  - `ProviderRegistry` ثبت idempotent همان instance، جلوگیری از جایگزینی خاموش و دریافت صریح Provider را فراهم می‌کند.
  - `TelegramProvider` تنها Adapter تبدیل قرارداد مشترک به `telegram-client.sendMessage` است و متن و Reply Markup را بدون تغییر عبور می‌دهد.
  - Telegram OTP پس از همان lookup موبایل و TelegramIdentity از قرارداد مشترک ارسال می‌کند؛ متن، Purpose، کیبورد کپی، تولید و اعتبار OTP دست‌نخورده‌اند.
  - Telegram Notification پس از همان lookup User/Identity از قرارداد مشترک ارسال می‌کند؛ یک Notification داخلی، قالب عنوان/بدنه، رفتار کاربر بدون Identity و سیاست catch خطا حفظ شده‌اند.
  - هیچ Provider واقعی Bale، ارسال چندکاناله، تنظیمات کاربر، Schema، Migration یا تغییر رفتار کسب‌وکار اضافه نشد.
  - هیچ فایل مسیر امن اتصال P1 تغییر نکرد.
- تست خودکار:
  - PASS: خواندن فایل‌ها از Commit و بررسی Syntax هفت فایل TypeScript با `node --experimental-strip-types --check`.
  - ADDED / NOT RUN: `messaging-providers.test.ts` با 9 سناریو برای Registry، نگاشت Telegram، Reply Markup، propagation خطا و مرز Notification.
  - UPDATED / NOT RUN: یک سناریوی سازگاری در `auth-otp.test.ts` برای حفظ متن فعال‌سازی و کیبورد کپی کد.
  - NOT RUN: `pnpm --filter @followa/api build`، `typecheck` و Vitest؛ Checkout احراز‌شده، dependencyها و دیتابیس تست در محیط Connector در دسترس نبود.
  - NOT RUN: Telegram واقعی و Production.
- تست دستی مالک: اجرا نشده؛ Telegram OTP فعال‌سازی/فراموشی رمز، یک اعلان دقیقاً یک‌بار، کاربر بدون Identity، Mock و خطای ارسال باید بررسی شوند.
- Rollback دقیق:
  - برگشت Commit نهایی با `git revert 83f6474dfb63ef1216074e6d44c11338aeb5831b` مسیر OTP/Notification را به پیاده‌سازی مستقیم قبل برمی‌گرداند؛ DB rollback و Migration ندارد.
  - برای حذف کامل اسکلت P2، پس از Revert بالا Commitهای مقدماتی را از جدید به قدیم revert کن: `22ef5683e3e9df64fce62ae73679ce9e8cd2c8e5`، سپس `fc88c8152562fa5b35a5a2428f12fe50fb1bdd5f` و سپس `9b14150fe7f5d3d034bfe114c1b8d68d08f5b466`.
  - قبل از Production rollback وضعیت ارسال یک OTP و یک Notification آزمایشی بررسی شود؛ پیام خارجی قبلاً ارسال‌شده قابل بازگرداندن نیست.
- نتیجهٔ تمرین Rollback: اجرا نشده؛ تغییر فقط کد است و داده‌ای برای برگشت ندارد.
- ریسک باقی‌مانده / مانع: Build و Vitest واقعی اجرا نشده‌اند؛ تست دستی و استقرار تأیید نشده‌اند.
- پذیرش مالک برای اتمام این مرحله: ثبت نشده.
- مجوز شروع مرحلهٔ بعد: ثبت نشده.
- قدم بعدی دقیق: Build/Typecheck/Vitest و تست دستی سازگاری P1/P2؛ سپس ثبت پذیرش. P3 بدون مجوز مستقل شروع نشود.

### رکورد مرحله: P3 — Schema عمومی هویت

- وضعیت: کد و Migration افزایشی در Repository تکمیل؛ Migration/تست DB و پذیرش مالک در انتظار.
- تاریخ و مسئول اجرا: 2026-09-15، Codex با درخواست مالک Repository.
- مجوز مالک: شروع و اجرای P3؛ هیچ مجوزی برای P4، Deploy یا اجرای Migration روی Production ثبت نشد.
- Branch / Base SHA: `main` / `cea9a10cdbe3410e0b51faaca2c17dd5f64a7aba`.
- فایل‌های مجاز نهایی و واقعاً تغییرکرده:
  - `apps/api/prisma/schema.prisma`
  - `apps/api/prisma/migrations/20260915090000_add_messaging_identity/migration.sql`
  - `apps/api/src/modules/messaging/messaging-repository.ts`
  - `apps/api/tests/messaging-identity.test.ts`
  - `docs/multi-messaging-roadmap.md` فقط در Checkpoint مستنداتی بعد از Commit اجرا
- Commit اجرا: [92e5701e96c8c2780be47fb47843e324da005cd9](https://github.com/Armanita/Followa/commit/92e5701e96c8c2780be47fb47843e324da005cd9).
- Commit مستنداتی ثبت نتیجه: Commit بلافاصله بعد از `92e5701` در تاریخچه `main`؛ SHA خود این Checkpoint در Checkpoint بعدی ثبت شود.
- Merge SHA: Commit مستقیم و fast-forward روی `main`؛ Merge جدا ندارد.
- Migrationها / نسخهٔ Schema / نتیجهٔ اجرا:
  - Migration افزایشی `20260915090000_add_messaging_identity` ایجاد شد.
  - دو Enum، دو جدول جدید، Indexها و Foreign Keyهای Cascade ایجاد می‌کند؛ هیچ ALTER/DROP/UPDATE/DELETE روی جدول‌های قدیمی ندارد.
  - Migration روی هیچ دیتابیس، سرور یا Production اجرا نشده است.
- Backfill checkpoint / شمارش / تعارض‌ها: ندارد؛ هیچ TelegramIdentity یا Pending قدیمی کپی یا تغییر داده نشد.
- محیط و SHA مستقرشده: استقرار انجام یا تأیید نشده؛ Repository معادل Production فرض نشده است.
- Feature Flagهای واقعی: ندارد؛ هیچ مسیر عملیاتی مدل‌های جدید را مصرف نمی‌کند.
- خلاصه تغییرات:
  - Enum عمومی `MessagingChannel` برای TELEGRAM، BALE، EITAA، WHATSAPP و SMS اضافه شد.
  - `MessagingIdentity` به User متصل است و external ID، destination اختیاری، status، verifiedAt/method، legacy provenance، version و revokedAt را نگه می‌دارد.
  - یکتایی `userId + channel` یک ردیف جاری برای هر کاربر/کانال و یکتایی `channel + externalUserId` عدم اتصال یک حساب Provider به دو User را تضمین می‌کند؛ مقدار external ID مشابه در دو کانال مستقل مجاز است.
  - `MessagingLinkChallenge` فقط `tokenHash` یکتا، مقصد، انقضا و consumedAt را ذخیره می‌کند؛ فیلد توکن خام وجود ندارد.
  - Repository مستقل برای ایجاد/خواندن Identity و ایجاد/خواندن Challenge معتبر اضافه شد؛ هیچ Route یا Service عملیاتی آن را فراخوانی نمی‌کند.
  - مدل‌های قدیمی `TelegramIdentity` و `TelegramPendingConnection`، مسیر امن P1، Provider P2، OTP و Notification تغییر نکردند.
- تست خودکار:
  - PASS: بررسی Syntax فایل Repository و تست با `node --experimental-strip-types --check`.
  - PASS: بررسی ساختاری تطابق دو Model، Relationهای User، Enumها، سه Unique، دو Foreign Key و نبود دستور تخریبی/تغییر جدول Legacy در SQL.
  - ADDED / NOT RUN: `messaging-identity.test.ts` با 7 سناریوی DB برای استقلال کانال، جلوگیری از مالکیت تکراری، یک Identity در هر User/Channel، defaults/lookups، Hash یکتا، expiry/consumption و عدم نوشتن جدول Legacy.
  - NOT RUN: `prisma format`، `prisma validate`، `prisma migrate deploy`، Build، Typecheck و Vitest؛ Checkout احراز‌شده، dependencyها و PostgreSQL ایزوله در محیط Connector در دسترس نبود.
  - NOT RUN: تست نسخه قبلی API روی Schema توسعه‌یافته و Production.
- تست دستی مالک: اجرا نشده؛ موارد بخش P3 شامل سلامت Login/OTP/Notification قدیمی و آزمون Migration روی کپی دیتابیس همچنان الزامی‌اند.
- Rollback دقیق:
  - پیش از اجرای Migration: `git revert 92e5701e96c8c2780be47fb47843e324da005cd9` امکان‌پذیر است؛ DB rollback ندارد.
  - پس از اجرای Migration: Migration اعمال‌شده را حذف/ویرایش و جدول‌ها را Drop نکن. نسخه قبلی API با SHA `cea9a10cdbe3410e0b51faaca2c17dd5f64a7aba` را Deploy کن و Schema افزایشی و تاریخچه Migration را نگه دار.
  - چون هیچ مسیر عملیاتی از جدول‌های جدید نمی‌خواند، نسخه قبلی API باید با وجود جدول‌های افزوده کار کند؛ این سازگاری باید پیش از Production روی کپی DB آزموده شود.
  - Restore Backup یا حذف جدول راه عادی rollback نیست؛ پس از ایجاد داده در مراحل بعد خطر از دست‌رفتن اطلاعات دارد.
- نتیجهٔ تمرین Rollback: اجرا نشده؛ نیازمند دیتابیس ایزوله و نسخه قبلی API است.
- ریسک باقی‌مانده / مانع: Prisma validate، Migration واقعی، سازگاری نسخه قبلی، Build/Vitest و پذیرش دستی انجام نشده‌اند.
- پذیرش مالک برای اتمام این مرحله: ثبت نشده.
- مجوز شروع مرحلهٔ بعد: ثبت نشده.
- قدم بعدی دقیق: Backup قابل‌بازیابی، اجرای `prisma migrate deploy` روی کپی DB، Build/Typecheck/Vitest و اجرای نسخه قبلی API؛ سپس ثبت نتیجه. P4 بدون مجوز مستقل شروع نشود.

### رکورد مرحله: P4 — انتقال و همگام‌سازی هویت Telegram

- وضعیت: اجرای کد و Runbook در Repository تکمیل؛ Migration پیش‌نیاز، Dry-run/Apply، تست DB و پذیرش مالک در انتظار.
- تاریخ و مسئول اجرا: 2026-09-15، Codex با درخواست مالک Repository.
- مجوز مالک: شروع و اجرای P4 و Checkpoint مستنداتی؛ هیچ مجوزی برای P5، Deploy، Migration یا Backfill روی Production ثبت نشد.
- Branch / Base SHA: `main` / `9d247f9edc7842124503d55f5beccdfcafa16a5a`.
- فایل‌های واقعاً تغییرکرده:
  - `apps/api/scripts/backfill-messaging-identities.ts`
  - `apps/api/src/config.ts`
  - `apps/api/src/modules/messaging/messaging-repository.ts`
  - `apps/api/src/modules/telegram/telegram-repository.ts`
  - `apps/api/tests/messaging-compatibility.test.ts`
  - `docs/messaging-migration-runbook.md`
  - `docs/multi-messaging-roadmap.md` فقط در Checkpoint مستنداتی بعد از Commit اجرا
- Commit اجرا: [f228ac88080b3e8d93cb6c39fd9dd39e03456dc4](https://github.com/Armanita/Followa/commit/f228ac88080b3e8d93cb6c39fd9dd39e03456dc4).
- Commit مستنداتی ثبت نتیجه: Commit بلافاصله بعد از `f228ac8` در تاریخچه `main`؛ SHA خود این Checkpoint در Checkpoint بعدی ثبت شود.
- Merge SHA: Commit مستقیم و fast-forward روی `main`؛ Merge جدا ندارد.
- Migrationها / نسخهٔ Schema / نتیجهٔ اجرا:
  - P4 هیچ Schema یا Migration تازه‌ای ندارد.
  - Migration افزایشی P3 پیش‌نیاز فعال‌سازی dual-write و اجرای Apply است و هنوز روی هیچ دیتابیس اجرا نشده است.
  - Backfill اجرا نشده؛ checkpoint، شمارش واقعی و تعارض عملیاتی وجود ندارد.
- محیط و SHA مستقرشده: استقرار انجام یا تأیید نشده؛ Repository معادل Production فرض نشده است.
- Feature Flagهای واقعی:
  - `MESSAGING_IDENTITY_DUAL_WRITE_ENABLED` پیش‌فرض `false`.
  - `MESSAGING_IDENTITY_BACKFILL_ENABLED` پیش‌فرض `false`؛ Apply علاوه بر Flag به `--apply` صریح نیاز دارد.
- خلاصه تغییرات:
  - اسکریپت Backfill دسته‌ای با Dry-run پیش‌فرض، Apply دوگانه‌محافظت‌شده، checkpoint قابل ادامه، حد batch و توقف در اولین تعارض اضافه شد.
  - Import idempotent است؛ تعارض مالک User/Channel یا external ID را overwrite نمی‌کند و race یکتایی را دوباره بررسی می‌کند.
  - Identityهای Legacy با `verifiedAt = null`، روش `LEGACY_IMPORT_UNVERIFIED` و provenance برابر `telegram_identities` ثبت می‌شوند؛ انتقال داده به معنی بازتأیید امن نیست.
  - اتصال امن جدید P1 در صورت فعال‌بودن Flag، `TelegramIdentity` و `MessagingIdentity` را در همان تراکنش Serializable می‌نویسد یا در تعارض هیچ‌کدام را ثبت نمی‌کند.
  - تمام خواندن‌های عملیاتی Telegram همچنان از `TelegramIdentity` هستند؛ OTP و Notification تغییر نکردند و Backfill هیچ پیام شبکه‌ای ارسال نمی‌کند.
  - Runbook شامل پیش‌نیاز، Dry-run، Resume، Apply، تطبیق شمارش، توقف و Rollback افزوده شد.
- تست‌های انجام‌شده:
  - PASS: بررسی Diff از Base تا Commit نهایی؛ فقط ۶ فایل P4، بدون Schema/Migration/OTP/Notification.
  - PASS: بررسی Syntax پنج فایل TypeScript تغییرکرده/افزوده با `node --experimental-strip-types --check`.
  - ADDED / NOT RUN: `messaging-compatibility.test.ts` با ۸ سناریو برای Dry-run، checkpoint، توقف تعارض، resume/idempotency، provenance تأییدنشده، جلوگیری از overwrite، رفتار Flag خاموش، dual-write اتمیک و تعارض دیرهنگام.
  - NOT RUN: Build، Typecheck و Vitest واقعی؛ checkout کامل، dependencyهای نصب‌شده و PostgreSQL ایزوله در محیط Connector در دسترس نبود.
  - NOT RUN: Migration P3، Dry-run/Apply Backfill، Telegram واقعی، Production و تست دستی OTP/Notification.
- روش Rollback دقیق:
  - قبل از هر Backfill، هر دو Flag را `false` نگه دار و با `git revert f228ac88080b3e8d93cb6c39fd9dd39e03456dc4` یا Deploy نسخه `9d247f9edc7842124503d55f5beccdfcafa16a5a` کد P4 را برگردان؛ DB rollback ندارد.
  - پس از شروع Backfill، ابتدا Apply و dual-write را خاموش کن. خواندن‌ها همچنان Legacy هستند؛ ردیف‌های عمومی ساخته‌شده را حذف یا جدول‌ها را Drop نکن.
  - پیام خارجی ناشی از Backfill وجود ندارد. پیش از شروع دوباره، Dry-run و تطبیق مالکیت/شمارش را اجرا و از آخرین checkpoint موفق ادامه بده؛ رکورد تعارض checkpoint محسوب نمی‌شود.
  - اگر dual-write پس از Migration فعال شده باشد، خاموش‌کردن Flag مسیر قدیمی را حفظ می‌کند؛ قبل از استفاده مجدد مدل عمومی، اتصال‌های جدید دوره توقف دوباره تطبیق داده شوند.
- نتیجهٔ تمرین Rollback: اجرا نشده؛ نیازمند دیتابیس ایزوله است.
- ریسک باقی‌مانده / مانع: P3 هنوز migrate/validate نشده، Backfill واقعی و تست DB انجام نشده و داده Legacy امنِ جدید تلقی نمی‌شود.
- پذیرش مالک برای اتمام این مرحله: ثبت نشده.
- مجوز شروع مرحلهٔ بعد: ثبت نشده.
- قدم بعدی دقیق: طبق `docs/messaging-migration-runbook.md` روی کپی ایزوله، Backup/Restore، Migration P3، Build/Vitest، Dry-run و شمارش/تعارض را اجرا و نتیجه را ثبت کن. P5 بدون مجوز مستقل شروع نشود.

### رکورد مرحله: P5 — اتصال امن Bale و پیام آزمایشی

- وضعیت: اجرای کد opt-in در Repository تکمیل؛ Build/Vitest کامل، Migration پیش‌نیاز، تست DB، ربات آزمایشی، Webhook و پذیرش مالک در انتظار.
- تاریخ و مسئول اجرا: 2026-09-15، Codex با درخواست مالک Repository.
- مجوز مالک: شروع و اجرای P5 و Checkpoint مستنداتی؛ هیچ مجوزی برای P6، Deploy، Migration، Backfill یا ثبت Webhook واقعی ثبت نشد.
- Branch / Base SHA: `main` / `c1ec70c0024e02557651a2558e62291ff67c508b`.
- فایل‌های واقعاً تغییرکرده:
  - `.env.example`
  - `.env.prod.example`
  - `docker-compose.prod.yml`
  - `apps/api/src/config.ts`
  - `apps/api/src/plugins/auth.ts` فقط allowlist دقیق Webhook بله
  - `apps/api/src/server.ts`
  - `apps/api/src/modules/messaging/messaging-repository.ts`
  - `apps/api/src/modules/messaging/messaging-link-service.ts`
  - `apps/api/src/modules/messaging/providers/bale-provider.ts`
  - `apps/api/src/modules/bale/bale-client.ts`
  - `apps/api/src/modules/bale/bale-service.ts`
  - `apps/api/src/modules/bale/bale-routes.ts`
  - `apps/api/tests/bale-linking.test.ts`
  - `docs/multi-messaging-roadmap.md` فقط در Checkpoint مستنداتی بعد از Commit اجرا
- فایل پیشنهادی `messaging-routes.ts` عمداً ایجاد نشد؛ پیام تأیید اتصال، آزمون ارسال P5 را فراهم می‌کند و Endpoint عملیاتی اضافی پیش از سیاست‌های P6 ایجاد نشد.
- Commit اجرا: [8dc7a814c78b357afbdb5abb7afd65a2680b1e78](https://github.com/Armanita/Followa/commit/8dc7a814c78b357afbdb5abb7afd65a2680b1e78).
- Commit مستنداتی ثبت نتیجه: Commit بلافاصله بعد از `8dc7a81` در تاریخچه `main`؛ SHA خود این Checkpoint در Checkpoint بعدی ثبت شود.
- Merge SHA: Commit مستقیم و fast-forward روی `main`؛ Merge جدا ندارد.
- Database / Migration:
  - P5 Migration یا تغییر Schema تازه ندارد و از `MessagingIdentity` و `MessagingLinkChallenge` مرحله P3 استفاده می‌کند.
  - Migration P3 هنوز اجرا نشده؛ در نتیجه `BALE_LINKING_ENABLED` نباید در محیط واقعی فعال شود.
  - هیچ داده Bale، Challenge واقعی یا پیام خارجی در این اجرا ساخته/ارسال نشد.
- Feature Flag و تنظیمات:
  - `BALE_LINKING_ENABLED=false` پیش‌فرض امن است و از انتخاب `OTP_PROVIDER` و `NOTIFICATION_PROVIDER` مستقل است.
  - `BALE_BOT_TOKEN`، `BALE_BOT_USERNAME` و `BALE_WEBHOOK_SECRET` فقط از Environment خوانده می‌شوند؛ Secret واقعی وارد Git نشد.
  - Secret مسیر Webhook باید حداقل ۳۲ کاراکتر تصادفی باشد؛ Route برای جلوگیری از ثبت Secret در Log سطح `silent` دارد.
- خلاصه تغییرات:
  - Client رسمی Bale روی `https://tapi.bale.ai/bot<TOKEN>/METHOD` با HTTPS، JSON و Timeout ده‌ثانیه‌ای اضافه شد.
  - Bale به قرارداد مشترک `MessagingProvider` اضافه شد، ولی به OTP یا Notification متصل نشد.
  - اتصال با Contact خود فرستنده در گفت‌وگوی private آغاز می‌شود؛ شماره به User فعال با عضویت فعال و Company فعال نگاشت می‌شود.
  - Challenge تصادفی ۱۲۸ بیتی است؛ فقط SHA-256 آن با TTL ده دقیقه در DB ذخیره می‌شود و توکن/User ID در پاسخ HTTP افشا نمی‌شود.
  - Callback به Bale sender، Channel و Challenge یک‌بارمصرف مقید است؛ شرکت و عضویت هنگام Confirm دوباره بررسی می‌شوند.
  - مصرف Challenge و ایجاد Identity تأییدشده در یک تراکنش Serializable انجام می‌شود؛ تعارض یکتایی موجب Rollback و عدم انتقال مالکیت است.
  - شکست ارسال Challenge آن را مصرف می‌کند؛ شکست پیام تأیید پس از Commit، اتصال موفق را قابل استفاده مجدد نشان نمی‌دهد.
  - مستندات رسمی Bale برای `setWebhook` Header امضاشده/secret-token مستند نمی‌کنند؛ بنابراین URL با Secret پرقدرت به‌عنوان لایه ورودی و Challenge خروجی یک‌بارمصرف به‌عنوان اثبات کنترل حساب استفاده شد.
  - Route وب‌هوک تنها استثنای عمومی جدید Auth است و خود Route بدون Flag، Token و Secret معتبر Fail-closed می‌شود.
- تست‌های انجام‌شده:
  - PASS: Diff یک Commit از Base؛ ۱۳ فایل P5، بدون تغییر Auth Service، OTP، Notification، Telegram، Prisma Schema یا Migration.
  - PASS: Syntax check ده فایل TypeScript افزوده/تغییرکرده با `node --experimental-strip-types --check`.
  - ADDED / NOT RUN: `bale-linking.test.ts` با ۱۱ سناریو برای URL/بدنه API رسمی، Provider mapping، Hash-only و one-time challenge، مقصد مقید، expiry، مالک Contact، شرکت/عضویت غیرفعال، عدم انتقال Identity، شکست ارسال و perimeter وب‌هوک.
  - NOT RUN: Build، Typecheck و Vitest واقعی؛ checkout کامل، dependencyهای نصب‌شده و PostgreSQL ایزوله در محیط Connector در دسترس نبود.
  - NOT RUN: ربات Bale واقعی، `setWebhook`، پیام آزمایشی خارجی، Production و آزمون عدم اثر روی Telegram.
- تست دستی مالک:
  - اجرا نشده؛ ابتدا Migration P3 روی کپی DB، سپس ربات آزمایشی و Secret تصادفی تنظیم شود.
  - Contact خود کاربر، Callback یک‌بارمصرف، انقضا، مقصد دیگر، شرکت/عضویت غیرفعال، تعویض مدیر و اختلال Bale بررسی شوند.
  - Telegram OTP و Notification قبل و بعد آزمون باید بدون تغییر و دقیقاً یک‌بار کار کنند.
- روش Rollback دقیق:
  - ابتدا `BALE_LINKING_ENABLED=false` و سپس Webhook ربات Bale را با `deleteWebhook` غیرفعال کن؛ Token/Secret را در صورت احتمال افشا rotate کن.
  - کد P5 با `git revert 8dc7a814c78b357afbdb5abb7afd65a2680b1e78` یا Deploy نسخه `c1ec70c0024e02557651a2558e62291ff67c508b` برمی‌گردد؛ DB Migration rollback ندارد.
  - Identity و Challengeهای Bale ساخته‌شده را حذف یا جدول‌های P3 را Drop نکن؛ نسخه قبلی آن‌ها را نمی‌خواند و برای بررسی/ادامه آینده حفظ می‌شوند.
  - پیام خارجی ارسال‌شده قابل بازگرداندن نیست؛ Rollback نباید Challengeهای قبلی را بازپخش کند.
- نتیجهٔ تمرین Rollback: اجرا نشده؛ نیازمند ربات و دیتابیس آزمایشی است.
- ریسک باقی‌مانده / مانع:
  - اصالت مبدأ شبکه Webhook به دلیل نبود امضای مستند رسمی Bale قابل اثبات مستقیم نیست؛ Secret URL و proof خروجی ریسک جعل اتصال را می‌بندند، اما Rate Limit لبه شبکه پیش از Production توصیه می‌شود.
  - Build/Vitest، Migration، تست زنده و پذیرش مالک انجام نشده‌اند.
- پذیرش مالک برای اتمام این مرحله: ثبت نشده.
- مجوز شروع مرحلهٔ بعد: ثبت نشده.
- قدم بعدی دقیق: Migration P3 و تست کامل P4/P5 روی کپی DB، سپس تنظیم ربات آزمایشی و اجرای تست‌های دستی P5. P6 بدون مجوز مستقل شروع نشود.

### رکورد مرحله: P6 — سیاست‌ها و تنظیمات دریافت

- وضعیت: اجرای کد و Migration افزایشی در Repository تکمیل؛ اجرای Migration، Build/Vitest کامل، تست DB/UI و پذیرش مالک در انتظار.
- تاریخ و مسئول اجرا: 2026-09-15، Codex با درخواست مالک Repository.
- مجوز مالک: شروع و اجرای P6 و Checkpoint مستنداتی؛ هیچ مجوزی برای P7، Deploy، Migration، Backfill یا فعال‌کردن مصرف سیاست‌ها ثبت نشد.
- Branch / Base SHA: `main` / `982fb39e86f381630c64de00fa827b1f0f0e9a1e`.
- فایل‌های واقعاً تغییرکرده:
  - `apps/api/prisma/schema.prisma`
  - `apps/api/prisma/migrations/20260915130000_add_messaging_preferences/migration.sql`
  - `apps/api/src/modules/messaging/messaging-policy.ts`
  - `apps/api/src/modules/messaging/messaging-settings-routes.ts`
  - `apps/api/src/server.ts`
  - `apps/api/tests/messaging-policy.test.ts`
  - `apps/web/src/components/messaging-settings.tsx`
  - `apps/web/src/app/admin/page.tsx`
  - `apps/web/src/app/(app)/settings/page.tsx`
  - `docs/multi-messaging-roadmap.md` فقط در Checkpoint مستنداتی بعد از Commit اجرا
- Commit اجرا: [0ce519a8117aeeb35d852c19f5f2bf5471d8d3f7](https://github.com/Armanita/Followa/commit/0ce519a8117aeeb35d852c19f5f2bf5471d8d3f7).
- Commit مستنداتی ثبت نتیجه: Commit بلافاصله بعد از `0ce519a` در تاریخچه `main`؛ SHA خود این Checkpoint در Checkpoint بعدی ثبت شود.
- Merge SHA: Commit مستقیم و fast-forward روی `main`؛ Merge جدا ندارد.
- Database / Migration:
  - چهار جدول افزایشی برای سیاست سراسری، سیاست شرکت، ترجیح عضویت و ترجیح OTP کاربر اضافه شد؛ جدول یا ستون قدیمی حذف/بازنویسی نشد.
  - نبود رکورد شرکت/عضویت به معنی ارث‌بری و `false` ذخیره‌شده به معنی غیرفعال‌سازی صریح است؛ در نتیجه unset با none متفاوت می‌ماند.
  - Migration ثبت شد ولی در این اجرا روی هیچ دیتابیسی اعمال نشد؛ Migrationهای P3 پیش‌نیاز آن هستند.
- خلاصه تغییرات:
  - System Admin می‌تواند Provider و مجوز مستقل Notification/OTP را برای Telegram و Bale ذخیره کند.
  - Company Manager فقط سیاست اعلان شرکتِ موجود در JWT زنده خود را می‌خواند/تغییر می‌دهد؛ Company ID از ورودی پذیرفته نمی‌شود.
  - هر Company User فقط ترجیح عضویت جاری و کانال OTP User خودش را تغییر می‌دهد؛ User/Membership ID از ورودی پذیرفته نمی‌شود.
  - ماتریس تقدم `system -> company -> membership` در تابع خالص و تست‌پذیر ثبت شد؛ سیاست سراسری همیشه سقف مجاز است.
  - UI مدیر سیستم و تنظیمات شرکت/کاربر اضافه شد و صریحاً اعلام می‌کند تنظیمات تا P8/P9 اثری بر ارسال ندارند.
  - وضعیت اتصال صرفاً از `MessagingIdentity` فعال و تأییدشده نمایش داده می‌شود؛ هویت Legacy به‌عنوان اتصال امن جدید جا زده نمی‌شود.
  - `auth-service.ts`، OTP provider، Notification service، Telegram/Bale sending و منطق کسب‌وکار تغییر نکردند.
- تست‌های انجام‌شده:
  - PASS: Diff یک Commit از Base؛ دقیقاً ۹ فایل P6، بدون تغییر Auth Service، OTP، Notification، Telegram/Bale یا کسب‌وکار.
  - PASS: Syntax check فایل‌های TypeScript API افزوده‌شده و تست با `node --experimental-strip-types --check`.
  - ADDED / NOT RUN: `messaging-policy.test.ts` با ماتریس تقدم، تفاوت unset/false، مجوز System Admin/Manager، Scope عضویت، both/none و محدودیت OTP.
  - NOT RUN: Prisma generate/validate، Typecheck، Build و Vitest واقعی؛ checkout کامل، dependencyهای نصب‌شده و PostgreSQL ایزوله در محیط Connector در دسترس نبود.
  - NOT RUN: Migration، تست UI دستی، Production و آزمون واقعی عدم تغییر ارسال Telegram/Bale.
  - CI/Deploy خارجی پس از Push خودکار فعال شد: وضعیت API موفق و Web هنگام ثبت Checkpoint در انتظار بود؛ این درخواست مجوز Migration یا تغییر دستی محیط نداده است.
- تست دستی مالک:
  - اجرا نشده؛ پس از Backup/Restore روی کپی ایزوله، Migrationهای P3/P6 اجرا و چهار حالت Telegram-only، Bale-only، both و none بررسی شوند.
  - System Admin، Manager و Employee باید فقط Scope خود را ببینند؛ unset و false صریح جدا بررسی شوند.
  - ذخیره هر تنظیم باید بدون تغییر رفتار Notification و OTP جاری باشد؛ متن هشدار UI نیز مشاهده شود.
- روش Rollback دقیق:
  - تا پیش از Migration، `git revert 0ce519a8117aeeb35d852c19f5f2bf5471d8d3f7` یا Deploy نسخه `982fb39e86f381630c64de00fa827b1f0f0e9a1e` کافی است.
  - پس از Migration، Route/UI P6 را revert کن ولی چهار جدول افزایشی و داده‌های ترجیح را حذف نکن؛ نسخه قبلی آن‌ها را نمی‌خواند و رفتار ارسال قبلی باقی می‌ماند.
  - Drop table یا Migration برگشتی تخریبی توصیه نمی‌شود؛ اگر پاک‌سازی بعداً لازم شد Phase و Backup مستقل می‌خواهد.
  - چون Dispatcher/OTP این تنظیمات را مصرف نمی‌کنند، Rollback پیام خارجی یا Queue برای تعیین تکلیف ندارد.
- نتیجهٔ تمرین Rollback: اجرا نشده؛ نیازمند محیط ایزوله است.
- ریسک باقی‌مانده / مانع: Migrationهای P3/P6، Vitest و تست UI/DB و پذیرش مالک انجام نشده‌اند؛ API خودکار موفق شد و Web هنگام Checkpoint Pending بود، اما وضعیت Deploy معادل پذیرش مرحله نیست.
- پذیرش مالک برای اتمام این مرحله: ثبت نشده.
- مجوز شروع مرحلهٔ بعد: ثبت نشده.
- قدم بعدی دقیق: ابتدا وضعیت CI و اثر Deploy خودکار بررسی، سپس روی کپی DB Migration/Build/Vitest و تست دستی P6 اجرا شود. P7 بدون مجوز مستقل شروع نشود.

### رکورد مرحله: P7 — ذخیرهٔ مستقل وضعیت تحویل

- وضعیت: اجرای Schema، Migration و Repository در Repository تکمیل؛ اجرای Migration، Vitest/DB و پذیرش مالک در انتظار.
- تاریخ و مسئول اجرا: 2026-09-15، Codex با درخواست مالک Repository.
- مجوز مالک: شروع و اجرای P7 و Checkpoint مستنداتی؛ هیچ مجوزی برای P8، Migration، Backfill، Worker یا تغییر مسیر عملیاتی ارسال ثبت نشد.
- Branch / Base SHA: `main` / `d037547f200d41500597ca8249fde49b1439409d`.
- فایل‌های واقعاً تغییرکرده:
  - `apps/api/prisma/schema.prisma`
  - `apps/api/prisma/migrations/20260915143000_add_notification_delivery/migration.sql`
  - `apps/api/src/modules/messaging/delivery-repository.ts`
  - `apps/api/tests/notification-delivery.test.ts`
  - `docs/multi-messaging-roadmap.md` فقط در Checkpoint مستنداتی بعد از Commit اجرا
- Commit اجرا: [1976c05603b4ba6a335d1ab14800adc7b9643d83](https://github.com/Armanita/Followa/commit/1976c05603b4ba6a335d1ab14800adc7b9643d83).
- Commit مستنداتی ثبت نتیجه: Commit بلافاصله بعد از `1976c05` در تاریخچه `main`؛ SHA خود این Checkpoint در Checkpoint بعدی ثبت شود.
- Merge SHA: Commit مستقیم و fast-forward روی `main`؛ Merge جدا ندارد.
- Database / Migration:
  - `companyId` اختیاری به Notification افزوده شد تا اعلان‌های تاریخی بدون زمینه شرکت معتبر بمانند.
  - `NotificationDelivery` برای وضعیت مستقل هر Channel و `NotificationDeliveryAttempt` برای تاریخچه تغییرناپذیر تلاش‌ها اضافه شد.
  - دو Enum جدید برای وضعیت Delivery و نتیجه Attempt اضافه شدند؛ جدول/داده قدیمی حذف یا بازنویسی نشد.
  - Migration ثبت شد ولی در این اجرا روی دیتابیس اعمال نشد؛ Migrationهای P3 و P6 پیش‌نیاز آن هستند.
- خلاصه تغییرات:
  - کلید یکتای `(notificationId, channel)` ایجاد تکراری یک کار تحویل برای همان کانال را متوقف می‌کند.
  - مقصد، شناسه Identity و نسخه Identity هنگام ساخت Snapshot می‌شوند و فراخوانی تکراری اجازه Retarget کردن کار قبلی را ندارد.
  - وضعیت، شمارنده تلاش، زمان‌های ارسال/لغو/تلاش و شناسه پیام Provider مستقل از Notification داخلی ذخیره می‌شوند.
  - ثبت نتیجه Attempt و به‌روزرسانی خلاصه Delivery در تراکنش Serializable با Retry محدود انجام می‌شود.
  - Delivery ارسال‌شده یا لغوشده Attempt تازه نمی‌پذیرد؛ فقط Pending/Failed قابل لغو است.
  - `notification-service.ts` و تمام فراخوانی‌های کسب‌وکار دست‌نخورده‌اند؛ P7 هیچ Delivery تولید نمی‌کند، هیچ Worker ندارد و هیچ پیام خارجی نمی‌فرستد.
- تست‌های انجام‌شده:
  - PASS: Diff یک Commit از Base؛ دقیقاً ۴ فایل P7، بدون تغییر Notification Service، OTP، UI، Case، Assignment، File یا Reminder.
  - PASS: Syntax check Repository و تست TypeScript با `node --experimental-strip-types --check`.
  - ADDED / NOT RUN: `notification-delivery.test.ts` برای سازگاری اعلان قدیمی/readAt، استقلال Telegram/Bale، idempotency، جلوگیری از Retarget، تاریخچه Failed→Sent و لغو امن.
  - NOT RUN: Prisma validate/generate، Vitest و تست PostgreSQL واقعی؛ checkout کامل، dependencyهای نصب‌شده و DB ایزوله در محیط Connector موجود نبود.
  - NOT RUN: اجرای Migration، تست دستی، پیام خارجی یا Production.
  - PASS: Build/Deploy خودکار Railway برای هر دو سرویس API و Web موفق شد؛ این موفقیت جایگزین Vitest، تست DB یا پذیرش مالک نیست.
- تست دستی مالک:
  - اجرا نشده؛ روی کپی ایزوله ابتدا Backup/Restore و Migrationهای P3/P6/P7 انجام شود.
  - اعلان قدیمی و read/unread، دو Delivery مستقل، ثبت تکراری، Snapshot مقصد و تاریخچه Attempt بررسی شوند.
  - باید تأیید شود ذخیره اعلان جاری مثل قبل کار می‌کند و تعداد پیام‌های خارجی در اثر P7 افزایش نیافته است.
- روش Rollback دقیق:
  - پیش از Migration، `git revert 1976c05603b4ba6a335d1ab14800adc7b9643d83` یا Deploy نسخه `d037547f200d41500597ca8249fde49b1439409d` کافی است.
  - پس از Migration، کد/Repository P7 را revert کن ولی ستون nullable، جدول‌های Delivery/Attempt و داده‌ها را حذف نکن؛ نسخه قبلی آن‌ها را نمی‌خواند.
  - Drop ستون/جدول و حذف تاریخچه تحویل توصیه نمی‌شود؛ پاک‌سازی احتمالی نیازمند Backup و Phase تخریبی مستقل است.
  - چون مسیر عملیاتی ارسال و Worker تغییر نکرده‌اند، Rollback صف فعال یا پیام in-flight ندارد.
- نتیجهٔ تمرین Rollback: اجرا نشده؛ نیازمند دیتابیس ایزوله است.
- ریسک باقی‌مانده / مانع: Migrationهای P3/P6/P7، Vitest، تست DB و پذیرش مالک انجام نشده‌اند؛ Build خودکار موفق است ولی ثبت Delivery هنوز به هیچ مسیر عملیاتی متصل نیست.
- پذیرش مالک برای اتمام این مرحله: ثبت نشده.
- مجوز شروع مرحلهٔ بعد: ثبت نشده.
- قدم بعدی دقیق: Migration/Vitest/تست دستی P7 را روی کپی DB انجام بده و نتیجه را ثبت کن. P8 بدون مجوز مستقل شروع نشود.

### رکورد مرحله: P8 — Notification چندکاناله و Worker

- وضعیت: اجرای کد opt-in در Repository تکمیل؛ Flagها خاموش، Migrationهای پیش‌نیاز، Vitest/DB، ارسال Live و پذیرش مالک در انتظار.
- تاریخ و مسئول اجرا: 2026-09-15، Codex با درخواست مالک Repository.
- مجوز مالک: شروع و اجرای P8 و Checkpoint مستنداتی؛ هیچ مجوزی برای P9، Migration، Backfill، فعال‌سازی Flagها یا ارسال واقعی ثبت نشد.
- Branch / Base SHA: `main` / `abfcd82bf93e7d95d2d719a3bfac0483331bece7`.
- فایل‌های واقعاً تغییرکرده:
  - `.env.example`
  - `.env.prod.example`
  - `docker-compose.prod.yml`
  - `apps/api/package.json`
  - `apps/api/src/config.ts`
  - `apps/api/src/modules/notifications/notification-service.ts`
  - `apps/api/src/modules/messaging/delivery-repository.ts`
  - `apps/api/src/modules/messaging/notification-context.ts`
  - `apps/api/src/modules/messaging/notification-dispatcher.ts`
  - `apps/api/src/modules/messaging/delivery-worker.ts`
  - `apps/api/tests/multi-channel-notifications.test.ts`
  - `docs/multi-messaging-roadmap.md` فقط در Checkpoint مستنداتی بعد از Commit اجرا
- Commit اجرا: [ef1b719d3d6979507e904e9b5a13ad0e72855271](https://github.com/Armanita/Followa/commit/ef1b719d3d6979507e904e9b5a13ad0e72855271).
- Commit مستنداتی ثبت نتیجه: Commit بلافاصله بعد از `ef1b719` در تاریخچه `main`؛ SHA خود این Checkpoint در Checkpoint بعدی ثبت شود.
- Merge SHA: Commit مستقیم و fast-forward روی `main`؛ Merge جدا ندارد.
- Database / Migration:
  - P8 Migration جدید ندارد و فقط Schema/Repository افزایشی P3، P6 و P7 را مصرف می‌کند.
  - هیچ Migration، Backfill، NotificationDelivery یا پیام خارجی در این اجرا به‌صورت دستی ایجاد/ارسال نشد.
- Feature Flag و استقرار:
  - `MULTI_CHANNEL_NOTIFICATIONS_ENABLED=false` مسیر قدیمی را حفظ می‌کند؛ Dispatcher جدید فقط با روشن‌کردن صریح آن جایگزین ارسال فوری Legacy می‌شود و هم‌زمان با آن اجرا نمی‌شود.
  - `NOTIFICATION_WORKER_ENABLED=false` Worker را در حالت Idle نگه می‌دارد؛ فعال‌سازی نیازمند آماده‌بودن Migrationها، Providerها و سیاست‌های P6 است.
  - Worker به موفقیت سرویس migrate در Compose وابسته شد و Poll، Lease و سقف تلاش تنظیم‌پذیر هستند.
  - Push به main Build/Deploy خودکار را آغاز کرد و هر دو سرویس API و Web موفق شدند. هیچ Flag واقعی توسط این Commit روشن نشد.
- خلاصه تغییرات:
  - وقتی Flag خاموش است، ایجاد Notification و ارسال Adapter قدیمی بدون تغییر رفتاری ادامه دارد.
  - وقتی Flag روشن است، Notification داخلی و Deliveryهای مجاز Telegram/Bale در یک تراکنش Serializable ثبت می‌شوند.
  - زمینه شرکت فقط از `companyId` داخلی یا Link معتبر CASE/REMINDER استخراج می‌شود؛ زمینه مبهم فقط Notification داخلی می‌سازد.
  - تقدم سیاست P6 در سطح System، Company و Membership برای Telegram-only، Bale-only، both و none اعمال می‌شود.
  - Telegram تا P10 از `TelegramIdentity` Legacy خوانده می‌شود؛ Bale فقط Identity عمومی Active و verified را می‌پذیرد.
  - مقصد و نسخه Identity هنگام Queue شدن Snapshot می‌شوند؛ تغییر اتصال، کار قبلی را به مقصد جدید منحرف نمی‌کند.
  - Claim با Lease و `FOR UPDATE SKIP LOCKED` انجام می‌شود تا Workerهای هم‌زمان یک کار را هم‌زمان برندارند و Crash پس از پایان Lease قابل بازیابی باشد.
  - پیش از هر ارسال، فعال‌بودن شرکت/عضویت، سیاست جاری، Identity و Snapshot مقصد دوباره کنترل می‌شوند؛ مورد نامعتبر Cancel می‌شود.
  - شکست یک Provider فقط Delivery همان Channel را Failed/Retry می‌کند؛ کانال دیگر مستقل باقی می‌ماند.
  - هیچ تضمین exactly-once خارجی در Timeout ادعا نمی‌شود؛ ارسال موفق پیش از شکست ثبت DB می‌تواند Retry و پیام تکراری ایجاد کند.
  - فایل‌های Case، Assignment، File، Reminder، OTP و Auth Service تغییر نکردند.
- تست‌های انجام‌شده:
  - PASS: Diff یک Commit از Base؛ دقیقاً ۱۱ فایل P8، بدون تغییر فایل‌های کسب‌وکار، OTP، Auth Service، Prisma Schema یا Migration.
  - PASS: Syntax check پنج فایل TypeScript اجرایی و تست جدید با `node --experimental-strip-types --check`.
  - PASS: Build/Deploy خودکار Railway برای API و Web؛ این نتیجه جایگزین Vitest، تست DB/Live یا پذیرش مالک نیست.
  - ADDED / NOT RUN: `multi-channel-notifications.test.ts` برای both، none، یک Notification داخلی، شکست مستقل Bale، غیرفعال‌شدن شرکت، تغییر Snapshot مقصد و زمینه مبهم.
  - NOT RUN: Vitest، تست PostgreSQL، Migrationهای پیش‌نیاز، Worker واقعی، Telegram/Bale Live و تمرین Rollback.
- تست دستی مالک:
  - اجرا نشده؛ ابتدا روی کپی DB، Migrationهای P3/P6/P7، Backfill لازم، تنظیم سیاست‌ها و هویت‌های آزمایشی تأیید شوند.
  - با Flag API روشن و Worker ابتدا خاموش، ایجاد یک Notification و Deliveryهای موردانتظار بررسی شود؛ سپس Worker روشن شود.
  - Telegram-only، Bale-only، both و none؛ شکست یکی از Providerها؛ شرکت/عضویت غیرفعال؛ تغییر Identity؛ Restart Worker و خاموش‌کردن کنترل‌شده آزموده شوند.
  - پس از تست، تعداد Notification، Delivery، Attempt و پیام دریافتی تطبیق داده شود؛ پیام ارسال‌شده با Rollback قابل پس‌گرفتن نیست.
- روش Rollback دقیق:
  - ابتدا `MULTI_CHANNEL_NOTIFICATIONS_ENABLED=false` کن تا کار جدید ساخته نشود؛ سپس `NOTIFICATION_WORKER_ENABLED=false` و Worker را بعد از پایان کار جاری متوقف کن.
  - Deliveryهای Pending/Failed را خودکار Replay یا حذف نکن؛ Snapshot و تاریخچه برای تصمیم دستی حفظ شوند.
  - کد با `git revert ef1b719d3d6979507e904e9b5a13ad0e72855271` یا Deploy نسخه `abfcd82bf93e7d95d2d719a3bfac0483331bece7` برمی‌گردد.
  - Migration rollback ندارد چون P8 Migration تازه ندارد؛ جدول‌های P3/P6/P7 و داده‌های Delivery حفظ شوند.
  - پیام‌های قبلاً ارسال‌شده قابل برگشت نیستند؛ تعیین تکلیف کارهای in-flight و احتمال پیام تکراری باید در گزارش Rollback ثبت شود.
- نتیجهٔ تمرین Rollback: اجرا نشده؛ نیازمند دیتابیس و Provider آزمایشی است.
- ریسک باقی‌مانده / مانع: Build موفق است اما Migration/Vitest/Live انجام نشده و exactly-once خارجی قابل تضمین نیست؛ Flagها نباید پیش از تست و پذیرش مالک روشن شوند.
- پذیرش مالک برای اتمام این مرحله: ثبت نشده.
- مجوز شروع مرحلهٔ بعد: ثبت نشده.
- قدم بعدی دقیق: Migration و تست کامل P8 را روی کپی DB اجرا و Rollout آزمایشی دو Flag را مرحله‌ای انجام بده. P9 بدون مجوز مستقل شروع نشود.

### رکورد مرحله: P9 — کانال منتخب OTP

- وضعیت: اجرای کد opt-in در Repository تکمیل؛ Flag خاموش، Vitest/DB/Live و پذیرش مالک در انتظار.
- تاریخ و مسئول اجرا: 2026-09-15، Codex با درخواست مالک Repository.
- مجوز مالک: شروع و اجرای P9 و Checkpoint مستنداتی؛ هیچ مجوزی برای P10، Migration، Backfill، فعال‌سازی Flag یا ارسال واقعی ثبت نشد.
- Branch / Base SHA: `main` / `2a3910627a15d79d5165c1c4655557b24bdcaa05`.
- فایل‌های واقعاً تغییرکرده:
  - `apps/api/src/config.ts`
  - `apps/api/src/modules/auth/otp-providers.ts`
  - `apps/api/src/modules/messaging/messaging-policy.ts`
  - `apps/api/src/modules/messaging/otp-dispatcher.ts`
  - `apps/api/tests/multi-channel-otp.test.ts`
  - `docs/multi-messaging-roadmap.md` فقط در Checkpoint مستنداتی بعد از Commit اجرا
- Commit اجرا: [7f39a3be580bddd99ea56f99ed460af727513b7d](https://github.com/Armanita/Followa/commit/7f39a3be580bddd99ea56f99ed460af727513b7d).
- Commit مستنداتی ثبت نتیجه: Commit بلافاصله بعد از `7f39a3b` در تاریخچه `main`؛ SHA خود این Checkpoint در Checkpoint بعدی ثبت شود.
- Merge SHA: Commit مستقیم و fast-forward روی `main`؛ Merge جدا ندارد.
- Database / Migration:
  - P9 Migration تازه ندارد و از `UserMessagingPreference` و `MessagingSystemPolicy` مرحله P6 و Identityهای P3 استفاده می‌کند.
  - هیچ Migration، Backfill، تغییر داده یا ارسال پیام واقعی در این اجرا انجام نشد.
- Feature Flag و Bootstrap:
  - `MULTI_CHANNEL_OTP_ENABLED=false` مسیر `OTP_PROVIDER` قبلی را بدون تغییر حفظ می‌کند؛ مقدار پیش‌فرض Flag خاموش است.
  - با روشن‌شدن Flag، انتخاب صریح User فقط یک کانال را فعال می‌کند؛ نبود Preference به‌عنوان Bootstrap از Provider قدیمی استفاده می‌کند.
  - نبود مقصد، سیاست غیرفعال یا خطای Provider منتخب Fail-closed است و به کانال دیگری fallback نمی‌شود؛ OTP وارد صف Notification/Retry نمی‌شود.
- خلاصه تغییرات:
  - Dispatcher جدید پیش از ارسال، وجود User و عضویت فعال در شرکت فعال را دوباره بررسی می‌کند.
  - سیاست System باید هم `enabled` و هم `otpEnabled` باشد.
  - Telegram منتخب تا P10 از `TelegramIdentity` Legacy و Bale از `MessagingIdentity` فعال و تأییدشده خوانده می‌شود؛ مقصد دلخواه API پذیرفته نمی‌شود.
  - متن ACTIVATION و PASSWORD_RESET حفظ و Keyboard کپی کد Telegram در مسیر منتخب حفظ شد.
  - تولید کد، TTL پنج‌دقیقه‌ای، سقف پنج تلاش، Purpose isolation، Pending Token، JWT و Password Flow دست‌نخورده‌اند؛ `auth-service.ts` تغییر نکرد.
  - Notification، Worker، UI، Schema، Migration و فایل‌های کسب‌وکار تغییر نکردند.
- تست‌های انجام‌شده:
  - PASS: Diff Commit از Base؛ دقیقاً پنج فایل P9 و بدون تغییر `auth-service.ts`، JWT، Password Flow، Notification، Schema، Migration، UI یا کسب‌وکار.
  - PASS: Build/Deploy خودکار Railway برای API و Web روی Commit اجرا.
  - ADDED / NOT RUN: `multi-channel-otp.test.ts` برای Telegram منتخب، Bale منتخب، Bootstrap Legacy، شرکت/عضویت غیرفعال، سیاست غیرفعال، مقصد ناموجود و ممنوع‌بودن fallback.
  - NOT RUN: Vitest، تست PostgreSQL، Migrationهای پیش‌نیاز، Telegram/Bale Live، جریان کامل Auth و تمرین Rollback.
- تست دستی مالک:
  - ابتدا Migrationهای P3/P6/P7 و داده‌های سیاست/هویت روی کپی DB آماده شوند؛ Flag همچنان خاموش و جریان‌های Activation/Reset قدیمی تأیید شوند.
  - سپس Flag در محیط آزمایشی روشن شود و ACTIVATION و PASSWORD_RESET برای Telegram و Bale، wrong/expired/reused، جداسازی Purpose و خطای Provider آزموده شوند.
  - شرکت/عضویت پس از دریافت کد غیرفعال شود و Verify/Reset رد شود؛ ورود با رمز و System Admin بدون تغییر تأیید شوند.
  - User بدون Preference باید فقط Provider Legacy را بگیرد؛ User با Preference نامعتبر نباید به کانال دیگری fallback شود.
- روش Rollback دقیق:
  - ابتدا `MULTI_CHANNEL_OTP_ENABLED=false` و سرویس API Restart شود؛ این کار مسیر Provider قدیمی را برمی‌گرداند.
  - کد با `git revert 7f39a3be580bddd99ea56f99ed460af727513b7d` یا Deploy نسخه `2a3910627a15d79d5165c1c4655557b24bdcaa05` برمی‌گردد.
  - P9 DB rollback ندارد؛ Preferences و Identityها حذف یا تغییر داده نشوند.
  - Restart، OTP و Pending Token حافظه‌ای را پاک می‌کند؛ کاربران باید کد تازه درخواست کنند. کاربران Bale-only پیش از rollback باید مسیر بازیابی معتبر داشته باشند.
- نتیجهٔ تمرین Rollback: اجرا نشده؛ نیازمند محیط آزمایشی و Providerهای واقعی است.
- ریسک باقی‌مانده / مانع: Build موفق است اما Migration/Vitest/DB/Live و پذیرش مالک انجام نشده‌اند؛ Flag نباید پیش از این کنترل‌ها روشن شود.
- پذیرش مالک برای اتمام این مرحله: ثبت نشده.
- مجوز شروع مرحلهٔ بعد: ثبت نشده.
- قدم بعدی دقیق: تست کامل P9 را روی کپی DB و Provider آزمایشی اجرا و Rollout Flag را کنترل‌شده تأیید کن. P10 بدون مجوز مستقل شروع نشود.

### رکورد مرحله: P10 — خواندن Telegram از مدل عمومی

- وضعیت: اجرای کد opt-in در Repository تکمیل؛ Read Flag خاموش و تطبیق DB، Vitest، تست Live، تمرین Rollback و پذیرش مالک در انتظار.
- تاریخ و مسئول اجرا: 2026-09-15، Codex با درخواست مالک Repository.
- مجوز مالک: شروع و اجرای P10 و Checkpoint مستنداتی؛ هیچ مجوزی برای Migration، Backfill، Reverification، روشن‌کردن Flagها یا ارسال واقعی ثبت نشد.
- Branch / Base SHA: `main` / `afa0fd53ae5ddf867b74e42d7624936465975aba`.
- فایل‌های واقعاً تغییرکرده:
  - `apps/api/src/config.ts`
  - `apps/api/src/modules/messaging/messaging-repository.ts`
  - `apps/api/src/modules/telegram/telegram-repository.ts`
  - `apps/api/src/modules/admin/admin-routes.ts`
  - `apps/api/src/modules/messaging/notification-dispatcher.ts`
  - `apps/api/src/modules/messaging/delivery-worker.ts`
  - `apps/api/src/modules/messaging/otp-dispatcher.ts`
  - `apps/api/tests/messaging-compatibility.test.ts`
  - `docs/messaging-migration-runbook.md`
  - `docs/multi-messaging-roadmap.md` فقط در Checkpoint مستنداتی بعد از Commit اجرا
- دلیل گسترش Allowlist: سه مصرف‌کنندهٔ ایجادشده در P8/P9 مستقیماً Legacy را می‌خواندند؛ بدون تغییر Dispatcher اعلان، Worker و Dispatcher OTP، Read switch ناقص و قابل دورزدن بود.
- Commit اجرا: [5b9f464e28753d5240c5f6156d20acb167c0d151](https://github.com/Armanita/Followa/commit/5b9f464e28753d5240c5f6156d20acb167c0d151).
- Commit مستنداتی ثبت نتیجه: Commit بلافاصله بعد از `5b9f464` در تاریخچه `main`؛ SHA خود این Checkpoint در Checkpoint بعدی ثبت شود.
- Database / Migration:
  - P10 Migration تازه یا تخریبی ندارد و جدول Legacy، داده و dual-write حذف نشدند.
  - هیچ Migration، Backfill، Reverification، تغییر داده یا ارسال پیام واقعی اجرا نشد.
- Feature Flag:
  - `MESSAGING_IDENTITY_READ_ENABLED=false` رفتار Legacy را حفظ می‌کند و پیش‌فرض خاموش است.
  - در حالت روشن، مدل عمومی authoritative است؛ فقط Telegram Identity با status برابر ACTIVE و `verifiedAt` معتبر قابل مصرف است.
  - نبود ردیف عمومی، ردیف unverified یا REVOKED به Legacy fallback نمی‌کند و tombstone احیا نمی‌شود.
- خلاصه تغییرات:
  - Resolver مشترک خواندن Telegram برای User ID و external ID ساخته شد.
  - Telegram Repository، Admin status، Notification enqueue، Delivery revalidation و OTP منتخب از همان Resolver استفاده می‌کنند.
  - Snapshot اعلان Telegram در حالت عمومی به Identity ID و Version مقید می‌شود؛ Job قدیمی Legacy پس از switch در صورت اختلاف لغو می‌شود.
  - نوشتن Legacy و dual-write، اتصال/تأیید Telegram، Provider شبکه، الگوریتم OTP، JWT، Password Flow و کسب‌وکار تغییر نکردند.
  - Runbook شامل پیش‌شرط Reverification، Rollout، جلوگیری از احیای revoked و Rollback شد.
- تست‌های انجام‌شده:
  - PASS: Diff Commit از Base؛ ۹ فایل P10، بدون Schema/Migration، حذف جدول، تغییر الگوریتم OTP یا فایل کسب‌وکار.
  - PASS: Build/Deploy خودکار Railway برای API و Web روی Commit اجرا.
  - ADDED / NOT RUN: تست سازگاری برای Legacy در Flag خاموش، Generic فعال و verified، رد REVOKED/unverified و عدم fallback هنگام نبود Generic.
  - NOT RUN: Vitest، تست PostgreSQL، تطبیق/Backfill/Reverification، Telegram Live، OTP/Notification Live و تمرین Rollback.
- تست دستی مالک:
  - روی کپی DB، Migrationها و Backfill را اجرا و تمام ردیف‌های موردنیاز را بازتأیید کن؛ `LEGACY_IMPORT_UNVERIFIED` قابل ارسال نیست.
  - dual-write روشن و Read Flag خاموش: اتصال/اتصال مجدد و همگامی دو مدل را بررسی کن.
  - سپس Read Flag را در محیط آزمایشی روشن و Telegram linking، Admin status، OTP و Notification/Worker را آزمون کن.
  - یک Generic Identity را revoke کن و تأیید کن وجود Legacy آن را متصل یا قابل ارسال نشان نمی‌دهد.
  - تعویض مدیر، شرکت/عضویت غیرفعال، Snapshotهای قبل از switch و Restart نیز بررسی شوند.
- روش Rollback دقیق:
  - ابتدا ارسال جدید و Worker را کنترل‌شده متوقف کن و اختلاف‌های پنجره rollout را بررسی کن.
  - `MESSAGING_IDENTITY_READ_ENABLED=false` و API/Worker را Restart کن؛ `MESSAGING_IDENTITY_DUAL_WRITE_ENABLED=true` باید روشن بماند.
  - قبل از بازگشت ترافیک، هویت‌های REVOKED عمومی را در مسیر Legacy نیز ایمن‌سازی کن تا fallback آن‌ها را احیا نکند.
  - کد با `git revert 5b9f464e28753d5240c5f6156d20acb167c0d151` یا Deploy نسخه `afa0fd53ae5ddf867b74e42d7624936465975aba` برمی‌گردد.
  - DB rollback ندارد؛ هیچ جدول/داده عمومی یا Legacy حذف نشود. Restart، OTP و Pending Token حافظه‌ای را پاک می‌کند.
- نتیجهٔ تمرین Rollback: اجرا نشده؛ نیازمند دیتابیس و Provider آزمایشی است.
- ریسک باقی‌مانده / مانع: Read Flag نباید پیش از Migration، تطبیق، Reverification، تست کامل و ثبت مسیر امن revoked/rollback روشن شود.
- پذیرش مالک برای اتمام مرحله: ثبت نشده.
- قدم بعدی دقیق: تست یکپارچه P3 تا P10 و تمرین Rollout/Rollback روی کپی ایزوله انجام و نتیجه در همین Roadmap ثبت شود؛ Phase کدنویسی جدیدی خودکار شروع نشود.

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
| 2026-09-15 | P1: نبود Webhook Secret | اتصال جدید Fail-closed با 503؛ ارسال خروجی موجود مستقل | اجراشده در P1 |
| 2026-09-15 | P1: اتمیک بودن | تراکنش Serializable، مصرف شرطی Pending و Retry محدود conflict | اجراشده در P1 |
| 2026-09-15 | تغییر هم‌زمان main | حفظ Commitهای موجود و بازسازی P1 روی HEAD جدید بدون Force | اجراشده؛ P2 در آن جلسه بررسی/تکمیل نشد |
| 2026-09-15 | P2: قرارداد Provider | Registry مشترک و Adapter تلگرام؛ انتخاب همچنان تک‌Provider | اجراشده؛ پذیرش دستی لازم |
| 2026-09-15 | P2: metadata | فقط داده نمایشی Provider مانند Reply Markup؛ هویت/Secret ممنوع | اجراشده |
| 2026-09-15 | مرز P2 | Telegram/Bale هم‌زمان و Provider واقعی Bale خارج محدوده | اجرا نشده؛ مربوط به مراحل بعد |
| 2026-09-15 | P3: مالک Identity | Identity همیشه به User متصل است، نه Company یا نقش | اجراشده در Schema |
| 2026-09-15 | P3: یکتایی | یک ردیف User/Channel و external ID یکتا در همان Channel؛ مقدار مشابه بین کانال‌ها مجاز | اجراشده |
| 2026-09-15 | P3: تاریخچه | وضعیت/نسخه روی ردیف جاری؛ تاریخچه چندردیفی فعلاً ایجاد نشد | اجراشده؛ بازطراحی آینده نیازمند Phase جدا |
| 2026-09-15 | P3: Challenge | فقط Hash یکتا ذخیره شود؛ Pending قدیمی مهاجرت نشود | اجراشده |
| 2026-09-15 | P3: Migration | فقط ثبت در Git؛ اجرای Production مجاز نیست | اجرا نشده |
| 2026-09-15 | P4: خواندن دوره گذار | همه خواندن‌های عملیاتی روی TelegramIdentity قدیمی باقی بمانند | اجراشده؛ تغییر منبع خواندن مربوط به P10 |
| 2026-09-15 | P4: Legacy verification | Backfill با verifiedAt خالی و provenance صریح؛ داده قدیمی بازتأییدشده محسوب نشود | اجراشده |
| 2026-09-15 | P4: کنترل اجرا | Dry-run پیش‌فرض؛ Apply فقط با Flag و آرگومان صریح؛ توقف روی اولین تعارض | اجراشده؛ اجرای DB مجاز نشده |
| 2026-09-15 | P4: Dual-write | پیش‌فرض خاموش و در اتصال امن جدید اتمیک؛ هیچ ارسال شبکه‌ای داخل تراکنش | اجراشده؛ فعال‌سازی مجاز نشده |
| 2026-09-15 | P5: Webhook Bale | API رسمی Header امضاشده مستند نمی‌کند؛ Secret URL پرقدرت + عدم Log + Challenge خروجی | اجراشده؛ تست Live لازم |
| 2026-09-15 | P5: اثبات مالکیت | Contact خود فرستنده + توکن ۱۲۸ بیتی Hash-only و یک‌بارمصرف + بازبینی دسترسی | اجراشده |
| 2026-09-15 | P5: دامنه ارسال | فقط پیام‌های فرایند اتصال؛ OTP و Notification به Bale متصل نشوند | اجراشده |
| 2026-09-15 | P5: Rollout | Flag مستقل و پیش‌فرض خاموش؛ Migration P3 پیش‌نیاز فعال‌سازی | اجراشده؛ Deploy مجاز نشده |
| 2026-09-15 | P6: تقدم سیاست | System سقف مجاز؛ Company و Membership با نبود رکورد ارث می‌برند و false صریح none را حفظ می‌کند | اجراشده؛ مصرف در P8/P9 |
| 2026-09-15 | P6: مالکیت تنظیم | شرکت از Actor مدیر و ترجیح شخصی از Actor User/عضویت گرفته می‌شود؛ ID دلخواه پذیرفته نمی‌شود | اجراشده |
| 2026-09-15 | P6: مرز رفتار | تنظیمات فقط ذخیره/نمایش داده می‌شوند و ارسال Notification/OTP آن‌ها را نمی‌خواند | اجراشده |
| 2026-09-15 | P7: یکتایی کار | هر Notification/Channel فقط یک Delivery دارد و Upsert تکراری Snapshot مقصد را تغییر نمی‌دهد | اجراشده |
| 2026-09-15 | P7: تاریخچه تلاش | Attemptها ردیف مستقل و ترتیبی هستند؛ Delivery فقط خلاصه آخرین وضعیت را نگه می‌دارد | اجراشده |
| 2026-09-15 | P7: مرز رفتار | Ledger فقط ذخیره‌سازی است؛ ساخت کار عملیاتی و Worker تا P8 ممنوع است | اجراشده |
| 2026-09-15 | P8: Rollout | مسیر چندکاناله و Worker دو Flag مستقل و پیش‌فرض خاموش دارند؛ Legacy و Worker هم‌زمان ارسال نمی‌کنند | اجراشده؛ فعال‌سازی نشده |
| 2026-09-15 | P8: زمینه شرکت | فقط companyId داخلی یا CASE/REMINDER معتبر؛ مورد مبهم External Delivery ندارد | اجراشده |
| 2026-09-15 | P8: مقصد کار | Delivery به Snapshot مقصد/Identity version مقید است و پیش از Send دوباره اعتبارسنجی می‌شود | اجراشده |
| 2026-09-15 | P8: تضمین ارسال | Lease/Retry از رقابت جلوگیری می‌کند ولی exactly-once Provider در Timeout ادعا نمی‌شود | ثبت‌شده |
| 2026-09-15 | P9: Rollout | مسیریابی OTP با Flag مستقل و پیش‌فرض خاموش؛ OTP_PROVIDER قدیمی در حالت خاموش بدون تغییر | اجراشده؛ فعال‌سازی نشده |
| 2026-09-15 | P9: Bootstrap | نبود Preference از Provider قدیمی استفاده می‌کند؛ انتخاب صریح نامعتبر Fail-closed و بدون fallback است | اجراشده |
| 2026-09-15 | P9: مقصد | Telegram تا P10 از Legacy و Bale فقط از Identity عمومی Active/verified؛ هر OTP دقیقاً یک مقصد | اجراشده |
| 2026-09-15 | P10: Read switch | Flag مستقل و پیش‌فرض خاموش؛ Generic در حالت روشن authoritative و بدون Legacy fallback | اجراشده؛ فعال‌سازی نشده |
| 2026-09-15 | P10: Tombstone | REVOKED، unverified و missing هرگز از Legacy احیا نمی‌شوند | اجراشده |
| 2026-09-15 | P10: Rollback | dual-write در rollout/rollback روشن بماند و revoke پیش از fallback تطبیق شود | ثبت‌شده؛ تمرین نشده |

## 10. تاریخچه، Commitها و اسناد مرتبط

### تاریخچهٔ اولیه

| رویداد | وضعیت | مرجع |
|---|---|---|
| شرط عضویت و شرکت فعال در Auth | در کد مبنا وجود دارد؛ استقرار زنده در این سند تأیید نشده | [701fdbd](https://github.com/Armanita/Followa/commit/701fdbd1f0994633cc813cf475abd84637bc74c3) |
| Audit تلگرام و برنامهٔ چندمرحله‌ای | انجام‌شده در بررسی؛ هیچ اجرای مرحلهٔ کد | مبنای این سند |
| P0: ایجاد این Roadmap | مستندات تنها | [6ceb94f](https://github.com/Armanita/Followa/commit/6ceb94fdcae35388b603f39209d6d9c1ea29ae9b) |
| P1: امنیت اتصال Telegram | اجرای کد تکمیل؛ پذیرش دستی ثبت نشده | [a4cc132](https://github.com/Armanita/Followa/commit/a4cc13253e793198ea52cdd37a403272c6ca098b) |
| P2: قرارداد مشترک Provider | اجرای کد تکمیل؛ پذیرش دستی ثبت نشده | [83f6474](https://github.com/Armanita/Followa/commit/83f6474dfb63ef1216074e6d44c11338aeb5831b)؛ پس از سه Commit مقدماتی |
| P3: Schema عمومی هویت | کد/Migration در Repository تکمیل؛ اجرا و پذیرش DB ثبت نشده | [92e5701](https://github.com/Armanita/Followa/commit/92e5701e96c8c2780be47fb47843e324da005cd9) |
| P4: Backfill و همگام‌سازی آزمایشی | اجرای کد/Runbook تکمیل؛ Migration، Backfill و پذیرش DB ثبت نشده | [f228ac8](https://github.com/Armanita/Followa/commit/f228ac88080b3e8d93cb6c39fd9dd39e03456dc4) |
| P5: اتصال امن Bale و پیام آزمایشی | اجرای کد opt-in تکمیل؛ تست ربات/DB و پذیرش ثبت نشده | [8dc7a81](https://github.com/Armanita/Followa/commit/8dc7a814c78b357afbdb5abb7afd65a2680b1e78) |
| P6: سیاست‌ها و تنظیمات دریافت | کد/Migration در Repository تکمیل؛ اجرا و پذیرش DB/UI ثبت نشده | [0ce519a](https://github.com/Armanita/Followa/commit/0ce519a8117aeeb35d852c19f5f2bf5471d8d3f7) |
| P7: ذخیره مستقل وضعیت تحویل | Schema/Repository در Git تکمیل؛ Migration و پذیرش DB ثبت نشده | [1976c05](https://github.com/Armanita/Followa/commit/1976c05603b4ba6a335d1ab14800adc7b9643d83) |
| P8: Notification چندکاناله و Worker | کد opt-in تکمیل؛ Flagها خاموش و تست DB/Live ثبت نشده | [ef1b719](https://github.com/Armanita/Followa/commit/ef1b719d3d6979507e904e9b5a13ad0e72855271) |
| P9: کانال منتخب OTP | کد opt-in تکمیل؛ Flag خاموش و تست DB/Live ثبت نشده | [7f39a3b](https://github.com/Armanita/Followa/commit/7f39a3be580bddd99ea56f99ed460af727513b7d) |
| P10: خواندن Telegram از مدل عمومی | کد opt-in تکمیل؛ Read Flag خاموش و تست DB/Live ثبت نشده | [5b9f464](https://github.com/Armanita/Followa/commit/5b9f464e28753d5240c5f6156d20acb167c0d151) |

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

**وضعیت پایان این جلسه: P10 به‌صورت opt-in در Repository تکمیل و Checkpoint ثبت شد؛ Phaseهای کدنویسی Roadmap تا P10 اجرا شده‌اند، اما Flagهای P8/P9/P10 خاموش و Migrationهای P3/P6/P7، Backfill/Reverification P4، Vitest، تست DB/Live، تمرین Rollback و پذیرش مالک ثبت نشده‌اند. تا تأیید مرحلهٔ تست و Rollout، STOP.**
