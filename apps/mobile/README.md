# Followa Mobile (Flutter — Android First)

اپلیکیشن اندروید فالوآ.

## Prerequisites

- Flutter SDK 3.24+ (`flutter doctor` must pass for Android)
- Android SDK / emulator, or a physical device with USB debugging

## Run

```bash
cd apps/mobile

# API on your dev machine (default target: http://10.0.2.2:3001 = localhost from emulator)
flutter pub get
flutter run

# Physical device: pass your PC's LAN IP
flutter run --dart-define=FOLLOWA_API=http://192.168.1.10:3001/api/v1
```

## Build APK

```bash
flutter build apk --release
# output: build/app/outputs/flutter-apk/app-release.apk
```

## Features

- Login (mobile + password), OTP registration flow (3-step wizard)
- Role-aware navigation (manager vs employee tabs)
- Dashboard with live metrics + status chart (manager) / reminders + active work (employee)
- Cases list with search, new case creation
- Case detail: accept/reject assignment, start/end work session, register result,
  transfer to colleague, create reminder, full timeline & assignment history
- Pending assignments inbox
- Reminders with "done + record result" flow
- Notifications (in-app)
- Employees management (activate/suspend/reset password — manager)
- Reports (30-day work time chart — manager)
- Profile + logout

Persian RTL throughout, Vazirmatn-ready (add font assets under `assets/fonts/`
and declare in `pubspec.yaml` if you want the bundled font; Material default
falls back to a Persian-capable system font otherwise).
