# Followa Telegram Integration Plan

## Purpose

This document defines the architecture plan for adding Telegram as an official Followa integration.

Telegram will support two capabilities:

1. Authentication
2. Notification delivery

The implementation must preserve the current modular monolith architecture and avoid coupling core business logic directly to Telegram APIs.

---

## Current Architecture Alignment

Followa uses:

- Fastify + TypeScript + Prisma backend
- Next.js web application
- Modular monolith structure
- Existing auth provider abstraction
- Existing notification module

Telegram should be implemented as an integration/provider layer.

---

# 1. Telegram Authentication

## Goal

Allow users to authenticate through Telegram without depending on SMS OTP delivery.

Flow:

```
User
 |
Login Page
 |
Telegram Authentication
 |
Telegram Bot Verification
 |
Link Telegram Identity
 |
Followa Session
```

## Data Model

### TelegramIdentity

Stores the verified Telegram account linked to a Followa user.

Suggested fields:

```
id
userId
telegramUserId
telegramUsername
firstName
lastName
isVerified
createdAt
updatedAt
```

### TelegramAuthSession

Temporary authentication session.

Suggested fields:

```
id
token
telegramUserId
status
expiresAt
createdAt
```

Statuses:

```
PENDING
VERIFIED
EXPIRED
```

---

# 2. Notification Engine Integration

Telegram must be implemented as a notification channel adapter.

Avoid direct usage such as:

```
telegram.send()
```

Preferred architecture:

```
NotificationService
        |
        |
 Channel Adapter
        |
 ----------------
 |      |        |
Telegram SMS Email
```

---

# Initial Events

## Cases

```
CASE_CREATED
CASE_ASSIGNED
CASE_ACCEPTED
CASE_REJECTED
CASE_COMPLETED
```

## Assignments

```
NEW_ASSIGNMENT
ASSIGNMENT_RETURNED
```

## Reminders

```
REMINDER_CREATED
REMINDER_DUE
REMINDER_OVERDUE
```

---

# Technical Structure

Suggested structure:

```
apps/api/src/modules

telegram/
 ├── telegram.service.ts
 ├── telegram.controller.ts
 ├── telegram.repository.ts
 └── telegram.types.ts

notifications/
 ├── notification.service.ts
 └── channels/
      └── telegram.channel.ts

auth/
 └── providers/
      └── telegram.provider.ts
```

---

# Environment Variables

Required configuration:

```
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_WEBHOOK_SECRET=
```

---

# Web Application Changes

## Login

Add:

```
Login with Telegram
```

## Account Settings

Add Telegram connection management:

```
Telegram
Status: Connected
Connect / Disconnect
```

## Notification Settings

Allow users to configure Telegram notifications.

---

# Implementation Phases

## Phase 1 - Foundation

- Create Telegram bot
- Configure webhook
- Add Telegram identity model
- Link Telegram account to Followa user

## Phase 2 - Authentication

- Telegram login flow
- Verification session
- Followa session creation

## Phase 3 - Notifications

- Notification channel adapter
- Event mapping
- Telegram delivery

## Phase 4 - User Settings

- Telegram connection management
- Notification preferences

---

## Decision

SMS remains a future notification provider. Telegram is the first external communication channel to implement because it solves the current OTP limitation while also providing a foundation for operational notifications.
