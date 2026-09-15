# Followa — Messaging Identity Migration Runbook

این سند فقط اجرای کنترل‌شدهٔ P3/P4 را توضیح می‌دهد. وجود Migration یا اسکریپت در Git مجوز اجرای Production نیست.

## وضعیت طراحی

- منبع خواندن عملیاتی همچنان `TelegramIdentity` است.
- Backfill فقط از `telegram_identities` به `messaging_identities` کپی می‌کند و هیچ پیامی نمی‌فرستد.
- ردیف Legacy با `verifiedAt = null`، روش `LEGACY_IMPORT_UNVERIFIED` و منبع `telegram_identities` ثبت می‌شود.
- Backfill هویت قدیمی را «تأییدشدهٔ جدید» اعلام نمی‌کند.
- Dual-write فقط اتصال‌های امن جدید P1 را در هر دو جدول و در یک تراکنش ثبت می‌کند.
- `TelegramPendingConnection` به Challenge عمومی منتقل نمی‌شود.
- هیچ Read switch در P4 انجام نمی‌شود.

## Feature switches

| متغیر | پیش‌فرض | کاربرد |
|---|---|---|
| `MESSAGING_IDENTITY_BACKFILL_ENABLED` | false | مجوز دوم برای اجرای `--apply` |
| `MESSAGING_IDENTITY_DUAL_WRITE_ENABLED` | false | ثبت اتمیک اتصال جدید در جدول قدیمی و عمومی |

مقادیر غیر از رشتهٔ `true` غیرفعال محسوب می‌شوند.

## پیش‌شرط محیط آزمایشی

1. SHA کد و نسخه Schema را ثبت کن.
2. از دیتابیس Backup بگیر و Restore آن را روی محیط جدا آزمایش کن.
3. مطمئن شو محیط آزمایشی به Telegram Production، Worker یا Notification واقعی متصل نیست.
4. Migration P3 را ابتدا روی کپی دیتابیس اجرا کن:

```bash
pnpm --filter @followa/api db:deploy
```

5. نسخه قبلی API با SHA `cea9a10cdbe3410e0b51faaca2c17dd5f64a7aba` را روی Schema توسعه‌یافته Smoke-test کن.
6. Build، Typecheck و تست‌ها را اجرا کن:

```bash
pnpm --filter @followa/api build
pnpm --filter @followa/api typecheck
pnpm --filter @followa/api test
```

## Dry-run

Dry-run پیش‌فرض است و به Feature switch نیاز ندارد:

```bash
pnpm --filter @followa/api exec tsx scripts/backfill-messaging-identities.ts --batch-size=100
```

برای ادامه از Checkpoint ثبت‌شده:

```bash
pnpm --filter @followa/api exec tsx scripts/backfill-messaging-identities.ts --batch-size=100 --after=LEGACY_ID
```

خروجی JSON فقط شمارش، Checkpoint و شناسه داخلی ردیف‌های متعارض را دارد؛ User ID و Telegram ID در Log چاپ نمی‌شوند.

قبل از Apply باید:

- `conflicts = 0` باشد یا تک‌تک تعارض‌ها با Query فقط‌خواندنی بررسی شوند.
- `scanned = wouldCreate + alreadySynced + conflicts` باشد.
- تعداد مبنای TelegramIdentity ثبت شود.
- هیچ پیام یا تغییر جدول Legacy مشاهده نشود.

## Apply

ابتدا فقط در محیط آزمایشی:

```bash
MESSAGING_IDENTITY_BACKFILL_ENABLED=true \
pnpm --filter @followa/api exec tsx scripts/backfill-messaging-identities.ts --apply --batch-size=100
```

Apply در اولین تعارض متوقف می‌شود. `checkpoint` آخرین ردیف موفق است و `stoppedAt` ردیف متعارض را نشان می‌دهد. پس از رفع تعارض، اجرا از Checkpoint ادامه پیدا می‌کند. اجرای مجدد idempotent است و ردیف‌های منطبق را `alreadySynced` حساب می‌کند.

فعال‌سازی Production فقط با تأیید جدا و پنجره نگهداری انجام شود.

## کنترل پس از Backfill

Queryهای فقط‌خواندنی پیشنهادی:

```sql
SELECT COUNT(*) FROM telegram_identities;

SELECT COUNT(*)
FROM messaging_identities
WHERE channel = 'TELEGRAM';

SELECT COUNT(*)
FROM messaging_identities
WHERE channel = 'TELEGRAM'
  AND "legacySource" = 'telegram_identities'
  AND "verifiedAt" IS NULL;
```

موارد زیر باید بررسی شوند:

- نگاشت User و Telegram ID بدون اختلاف باشد.
- اجرای دوم هیچ ردیف جدیدی نسازد.
- تعداد و محتوای جدول‌های Legacy تغییر نکرده باشد.
- OTP و Notification همچنان از TelegramIdentity قدیمی کار کنند.
- هیچ اعلان یا OTP بر اثر Backfill ارسال نشده باشد.

## فعال‌سازی Dual-write

فقط بعد از Migration موفق و بررسی Backfill:

1. `MESSAGING_IDENTITY_DUAL_WRITE_ENABLED=true` را برای API تنظیم کن.
2. API را Restart کن و مقدار Flag غیرمحرمانه را در Checkpoint ثبت کن.
3. با حساب آزمایشی بدون اتصال قبلی، اتصال امن Telegram را انجام بده.
4. بررسی کن یک ردیف Legacy و یک ردیف عمومی با همان User/Telegram ID ساخته شده باشد.
5. `verifiedAt` ردیف جدید مقدار داشته و `verificationMethod` برابر `TELEGRAM_SIGNED_CALLBACK_V1` باشد.
6. تعارض User یا external ID باید کل تراکنش را برگرداند و Pending را حفظ کند.
7. OTP و Notification باید دقیقاً یک بار و همچنان از Read قدیمی ارسال شوند.

## توقف و Rollback

### توقف Backfill

Process را متوقف کن و آخرین `checkpoint` را نگه دار. اجرای مجدد از همان Checkpoint امن و idempotent است. هیچ پیام خارجی برای جبران یا Replay ارسال نکن.

### خاموش کردن Dual-write

`MESSAGING_IDENTITY_DUAL_WRITE_ENABLED=false` و Restart API. خواندن و نوشتن Legacy مانند قبل ادامه دارد. ردیف‌های عمومی را حذف نکن؛ پیش از فعال‌سازی دوباره Compare انجام بده.

### برگشت برنامه

- نسخه قبلی API را Deploy کن.
- جدول‌های P3/P4 و Migration اعمال‌شده را Drop، Rename یا Edit نکن.
- Git revert دیتابیس را برنمی‌گرداند.
- حذف داده عمومی باعث از دست رفتن Checkpoint و نیاز به تطبیق دوباره می‌شود.
- Restore کامل Backup فقط برای حادثه جدی و با پذیرش از دست‌رفتن تغییرات بعد از Backup است.

## معیار پایان P4

- Migration و نسخه قبلی API روی کپی DB تأیید شده باشند.
- Dry-run بدون تعارض حل‌نشده باشد.
- Apply آزمایشی و اجرای مجدد idempotent باشد.
- Dual-write آزمایشی اتمیک باشد.
- Telegram OTP/Notification قدیمی بدون تغییر رفتار کار کنند.
- نتیجه و SHA محیط در Roadmap ثبت و مالک آن را تأیید کند.


## P10 — تغییر کنترل‌شده منبع خواندن Telegram

متغیر `MESSAGING_IDENTITY_READ_ENABLED` پیش‌فرض `false` است. در حالت
`false` تمام خواندن‌های عملیاتی Telegram از جدول Legacy انجام می‌شوند. در
حالت `true` مدل عمومی منبع authoritative است و هیچ fallback به Legacy وجود
ندارد؛ ردیف مفقود، `REVOKED` یا بدون `verifiedAt` متصل محسوب نمی‌شود.

### پیش‌شرط فعال‌سازی

1. Migrationهای P3/P6/P7، Backfill و تطبیق بدون تعارض تکمیل شده باشند.
2. تمام هویت‌های Telegram موردنیاز، بازتأیید شده و `ACTIVE` با
   `verifiedAt` معتبر باشند؛ ردیف‌های `LEGACY_IMPORT_UNVERIFIED` قابل ارسال نیستند.
3. `MESSAGING_IDENTITY_DUAL_WRITE_ENABLED=true` در کل دوره rollout و rollback
   باقی بماند تا اتصال جدید فقط در Legacy ثبت نشود.
4. تعداد و نگاشت User/external ID و وضعیت revoke به‌صورت read-only تطبیق داده شود.
5. OTP و Notification واقعی تا پیش از تأیید محیط آزمایشی خاموش بمانند.

### Rollout

1. ابتدا API/Worker آزمایشی را با dual-write روشن و read switch خاموش تست کن.
2. `MESSAGING_IDENTITY_READ_ENABLED=true` و API/Worker را Restart کن.
3. اتصال، Admin status، OTP و Notification Telegram را با User آزمایشی بررسی کن.
4. یک Identity آزمایشی را revoke کن؛ وجود Legacy نباید آن را دوباره فعال نشان دهد.
5. Deliveryهای قبل از switch که Snapshot Legacy دارند ممکن است به دلیل اختلاف
   Snapshot لغو شوند؛ آن‌ها را خودکار replay نکن.

### Rollback

1. ارسال/Worker را کنترل‌شده متوقف کن.
2. `MESSAGING_IDENTITY_READ_ENABLED=false` و API/Worker را Restart کن.
3. dual-write را روشن نگه دار و قبل از بازگشت ترافیک، اختلاف‌های ایجادشده در
   پنجره rollout را تطبیق بده.
4. جدول یا داده عمومی/Legacy را حذف نکن. Revoke عمومی را قبل از fallback به
   Legacy به‌صورت دستی در Legacy هم ایمن‌سازی کن تا هویت لغوشده احیا نشود.
5. Restart کدهای OTP و Pending Token حافظه‌ای را پاک می‌کند و درخواست تازه لازم است.
