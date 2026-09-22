# Followa Mobile (Flutter — Android First)

اپلیکیشن اندروید فالوآ.

## Prerequisites

- Flutter SDK 3.24+ (`flutter doctor` must pass for Android)
- Android SDK / emulator, or a physical device with USB debugging

## Run

```bash
cd apps/mobile

# Production API is the default: https://api.followa.ir/api/v1
flutter pub get
flutter run

# Optional local development override for a physical device
flutter run --dart-define=FOLLOWA_API=http://192.168.1.10:3001/api/v1

# Optional sanitized request/status logging (disabled by default)
flutter run --dart-define=FOLLOWA_DEBUG_LOGGING=true
```

## Build APK

```bash
flutter build apk --release
# output: build/app/outputs/flutter-apk/app-release.apk
```

For a distributable production APK, add the private Android signing values to
`android/key.properties`. The file and keystore formats are already ignored by
Git. Without that local file, release builds use the debug key for internal
validation only.

## Features

- Login (mobile + password), OTP registration flow (3-step wizard)
- Secure persisted sessions, password recovery and self-service password change
- Role-aware navigation (manager vs employee tabs)
- Dashboard with live metrics + status chart (manager) / reminders + active work (employee)
- Cases list with search, new case creation
- Case detail: accept/reject assignment, register result and effort, transfer to
  colleague, create reminder, attach documents, full timeline and assignment history
- Pending assignments inbox
- Reminders with "done + record result" flow
- Notifications (in-app)
- Telegram/Bale notification and OTP preferences
- Employees management (activate/suspend/reset password — manager)
- Reports (30-day work time chart — manager)
- Profile + logout
- Case document upload from files/gallery or camera, with preview and validation

Persian RTL throughout with the bundled Estedad font.
