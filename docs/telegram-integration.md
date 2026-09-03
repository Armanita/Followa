# Followa Telegram Integration Plan

## Purpose

This document defines the final architecture plan for adding Telegram as an official Followa integration.

Telegram will have three responsibilities:

1. Identity linking
2. Authentication provider
3. Notification delivery channel

The implementation must preserve the current modular monolith architecture and avoid coupling core business logic directly to Telegram APIs.

---

# Architecture Decision

Telegram is not treated as a simple messaging tool. It is implemented as an integration layer connected to existing Followa modules:

```
                 Telegram Integration
                         |
        ----------------------------------
        |                |               |
    Identity          Auth          Notification
```

Existing SMS providers remain supported as future channels.

---

# Current Architecture Alignment

Followa uses:

- Fastify + TypeScript + Prisma backend
- Next.js web application
- Modular monolith structure
- Existing auth provider abstraction
- Existing notification module

Telegram should be implemented as a provider/integration layer.

---

# 1. Telegram Identity Linking

## Goal

Connect an existing Followa user account to a Telegram account without manual administrator data entry.

The system must not create a new Followa user only because someone starts the Telegram bot.

---

## User Connection Flow

```
User starts Telegram Bot
        |
        |
Bot requests phone contact
        |
        |
Backend receives Telegram ID + phone
        |
        |
Find existing Followa user by normalized mobile
        |
        |
User confirmation
        |
        |
Create TelegramIdentity
```

---

## Unknown Users

If a person starts the bot but does not exist in Followa:

- No user account is created
- No company membership is created
- No permissions are granted

Bot response:

```
This Telegram account is not connected to a Followa user.
Please contact your organization administrator.
```

---

# Data Model

## TelegramIdentity

Stores the verified Telegram account linked to a Followa user.

Suggested fields:

```
id
userId
telegramUserId
telegramUsername
phoneNumber
verifiedAt
createdAt
updatedAt
```

Constraints:

```
unique(userId)
unique(telegramUserId)
```

---

## TelegramAuthSession

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

# 2. Telegram Authentication

## Goal

Allow secure login without depending on SMS OTP delivery.

Authentication architecture:

```
Auth Provider

      |
 ----------------
 |       |       |
SMS Telegram Email
```

---

## Login Flow

```
User clicks Login with Telegram
        |
        |
Followa creates authentication session
        |
        |
Telegram Bot receives approval request
        |
        |
User confirms login
        |
        |
Followa creates application session
```

Telegram approval replaces sending a plain OTP message.

---

# Security Rules

## Required protections

- Rate limiting for bot actions
- Audit log for connection and login events
- Unique Telegram identity mapping
- Ability to disconnect Telegram
- Disabled Followa users cannot authenticate

No automatic account creation is allowed.

---

# 3. Notification Engine Integration

Telegram must be implemented as a notification channel adapter.

Avoid direct usage:

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
CASE_STATUS_CHANGED
CASE_COMPLETED
```

## Assignments

```
ASSIGNMENT_RECEIVED
ASSIGNMENT_REJECTED
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
- Implement secure identity linking flow

## Phase 2 - Authentication

- Telegram login provider
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

# Final Decision

Approved architecture:

- Telegram ID alone is not sufficient for linking.
- User phone contact is used for matching existing Followa users.
- User confirmation is required before binding identity.
- Telegram becomes both authentication provider and notification channel.
- SMS remains a future provider.
