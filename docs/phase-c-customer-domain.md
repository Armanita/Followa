# Phase C — Customer Domain Foundation

Status: implementation candidate; acceptance pending focused validation and browser review.
Base commit: `58b1aff2b53ee1a91556bf84fc009536de3f5285`
Branch: `feat/followa-approved-14-phase1`

## Scope

Phase C implements the approved Customer foundation without changing the existing modular-monolith architecture:

- company-scoped Customer master data;
- individual/legal customer type;
- optional `Case.customerId` so internal cases remain valid;
- customer search/select during case creation;
- controlled employee quick-create with minimal contact fields;
- Manager-only full customer edit, archive/restore, and history;
- customer-sensitive audit evidence using field names only;
- customer case-history summary as the reporting foundation;
- Jalali rendering for customer-history timestamps in the Web UI.

## Tenant and authorization rules

- Every customer query is scoped by `request.actor.companyId`.
- Employees can search only active customers in their own company.
- Employees can quick-create only `type`, `name`, `mobile`, and `phone`.
- Managers can create/edit full customer master data and include archived customers in management lists.
- Full customer case history is Manager-only.
- A Case can reference a customer only when that customer is active and belongs to the same company.
- Foreign-company customer IDs are rejected and are never exposed through history/detail endpoints.

## Archive policy

Normal product flows never delete customers. Archive sets `isActive=false` and `archivedAt`; restore reverses it. Existing Case history remains linked to archived customers, while new Case links require an active customer.

## Identity and indexing decision

Customer identifiers such as mobile, national ID, and economic code are optional. Phase C intentionally does not add a global database `UNIQUE` constraint because customer data may be incomplete and nullable. Instead:

- indexes are company-scoped for active/name, type, mobile, national ID, and economic code;
- create/update performs a same-company duplicate guard for non-empty mobile/national-ID/economic-code values;
- an archived duplicate must be restored rather than silently recreated.

If future import/concurrency requirements demand database-enforced uniqueness, that must be designed explicitly (for example with PostgreSQL partial unique indexes) rather than added implicitly.

## Audit policy

Customer create/update/archive/restore actions write `SensitiveAuditLog` records. Audit payloads contain only changed field names; raw national IDs, economic codes, addresses, email values, or other customer values are not copied into audit JSON.

## Out of scope

Phase C does not implement Bale delivery, notification retries/workers, production backup/restore, password throttling, OTP persistence hardening, or broad file-security hardening. Those remain Phase D/E work.
