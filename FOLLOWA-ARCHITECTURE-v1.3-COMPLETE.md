# FOLLOWA-ARCHITECTURE-v1.3-COMPLETE.md

# Followa Final Architecture Specification

## 1. Architecture Principles

Followa is implemented as:

-   Modular Monolith
-   Monorepo
-   REST API
-   PostgreSQL Database
-   Domain-oriented modules

Reason:

-   MVP is for one company
-   Approximately 30 users
-   Development speed and reliability are priorities
-   Microservice complexity is unnecessary

------------------------------------------------------------------------

# 2. Technology Stack

## Backend

-   Node.js
-   TypeScript
-   Fastify
-   Prisma ORM
-   PostgreSQL

## Web

-   Next.js
-   TypeScript
-   RTL
-   Persian UI
-   Jalali Calendar

## Mobile

-   Flutter
-   Android First

------------------------------------------------------------------------

# 3. Identity Architecture

Identity has two independent areas.

## System Admin

Independent platform identity.

Capabilities:

-   Create company
-   Create first company manager
-   System configuration
-   API settings

No access:

-   Company cases
-   Employee reports
-   Daily operations

------------------------------------------------------------------------

## Company Identity

Structure:

    User
     |
    CompanyMembership
     |
    Company

Role belongs to membership.

Roles:

-   COMPANY_MANAGER
-   EMPLOYEE

------------------------------------------------------------------------

# 4. Backend Module Architecture

    src/modules

    auth
    identity
    companies
    memberships
    users
    cases
    assignments
    activities
    work-sessions
    reminders
    notifications
    dashboard
    files

Each module contains:

-   routes
-   services
-   repositories
-   validation
-   tests

------------------------------------------------------------------------

# 5. Database Architecture

Main entities:

    SystemAdmin

    User

    Company

    CompanyMembership

    CaseType

    Case

    CaseAssignment

    CaseActivity

    WorkSession

    Reminder

    File

    Notification

------------------------------------------------------------------------

# 6. Core Case Model

Case is the main business entity.

A Case contains:

-   title
-   description
-   type
-   current owner
-   assignment history
-   activities
-   files
-   reminders
-   work sessions

Lifecycle:

    OPEN

    WAITING_ACCEPTANCE

    IN_PROGRESS

    WAITING_APPROVAL

    DONE

    CANCELLED

------------------------------------------------------------------------

# 7. Assignment Architecture

Every Case has one active responsible person.

Every transfer creates history.

Assignment stores:

-   from user
-   to user
-   reason
-   description
-   status
-   accepted time
-   rejected time
-   reject reason

Statuses:

-   PENDING
-   ACCEPTED
-   REJECTED

------------------------------------------------------------------------

# 8. Activity Timeline

Activity is immutable history.

Types:

-   CREATE
-   ASSIGN
-   ACCEPT
-   REJECT
-   START_WORK
-   END_WORK
-   RESULT_ADDED
-   FILE_UPLOADED
-   COMPLETE

------------------------------------------------------------------------

# 9. Work Tracking

WorkSession stores real working time.

Fields:

-   case
-   user
-   startedAt
-   endedAt
-   durationSeconds

A user can work on multiple cases.

------------------------------------------------------------------------

# 10. Reminder Architecture

Reminder belongs to current workflow.

Stores:

-   case
-   assigned user
-   creator
-   reminder time
-   status

Statuses:

-   ACTIVE
-   DONE
-   EXPIRED

------------------------------------------------------------------------

# 11. Notification Architecture

Initial:

-   In-app notifications
-   Push abstraction

External adapters:

-   Bale
-   Eitaa

Provider implementation can be added later.

------------------------------------------------------------------------

# 12. File Storage

MVP:

Local storage.

Structure:

    storage/files/year/month/case-id/

Database stores:

-   filename
-   storagePath
-   mimeType
-   size

Restrictions:

-   Max 20MB
-   PDF
-   Office files
-   Images
-   Audio

------------------------------------------------------------------------

# 13. Permission Architecture

## System Admin

Platform only.

## Manager

Can:

-   View all company cases
-   Manage employees
-   Create and assign cases
-   View reports

## Employee

Can:

-   View own cases
-   View created cases
-   View own assignment history

Cannot:

-   View unrelated employee cases
-   Modify historical assignments

------------------------------------------------------------------------

# 14. API Structure

Base:

    /api/v1

Main groups:

    /auth

    /companies

    /members

    /cases

    /assignments

    /work-sessions

    /reminders

    /notifications

    /dashboard

------------------------------------------------------------------------

# 15. Web Architecture

Pages:

    login

    dashboard

    cases

    case-detail

    employees

    reports

    settings

Requirements:

-   Persian language
-   RTL
-   Responsive
-   Jalali dates
-   Professional dashboard

UI Reference:

OrgaWork repository:

https://github.com/Armanita/OrgaWork

Only visual patterns are used.

------------------------------------------------------------------------

# 16. Dashboard Architecture

Manager:

Metrics:

-   Total cases
-   Open cases
-   In progress
-   Waiting acceptance
-   Late cases
-   Active workers

Sections:

-   Urgent cases
-   Recent activity
-   Current workers
-   Case charts

Employee:

Metrics:

-   My cases
-   Today reminders
-   New assignments
-   Active work
-   History

------------------------------------------------------------------------

# 17. Repository Structure

    followa/

    apps/

     api/
     web/
     mobile/


    packages/

     ui/
     shared-types/


    docs/

     architecture.md
     erd.md
     api-contract.md


    storage/

    docker-compose.yml

    .env.example

    README.md

------------------------------------------------------------------------

# 18. Security Rules

Required:

-   Password hashing
-   JWT protection
-   Input validation
-   Role authorization
-   Company data isolation
-   Environment protection

Never commit:

-   .env
-   secrets
-   node_modules

------------------------------------------------------------------------

# 19. Implementation Order

1.  Repository setup
2.  Docker environment
3.  Prisma schema
4.  Database migration
5.  Authentication
6.  Company management
7.  Membership management
8.  Case engine
9.  Assignment flow
10. Work tracking
11. Reminder
12. Dashboard
13. Web UI
14. Android application
15. Testing and verification

------------------------------------------------------------------------

# 20. UI Quality Rules

The final product must not look like a raw admin panel.

Required:

-   Beautiful Persian typography
-   Vazirmatn or equivalent font
-   Modern cards
-   Clear status colors
-   Timeline views
-   Mobile-first layouts
-   Empty states
-   Loading states
-   Error states

Goal:

A professional internal company application.
