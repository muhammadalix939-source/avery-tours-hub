# Security Specification: AV Travel CRM

## 1. Data Invariants & Zero-Trust Financial Controls
- **Financial Balances & Totals Protection (Anti-Self-Awarding):**
  - Customer balances (`amountDue`, `amountPaid`) in `/clients/{clientId}` can strictly only be created or modified by authorized, verified Administrators (`isAdmin()`). Non-admin callers attempting to alter customer balances are rejected by the rule engine.
  - Booking totals (`totalAmount`, `totalCost`, `amountReceived`) in `/bookings/{bookingId}` can strictly only be created or modified by authorized Administrators. Non-admin updates must leave financial totals unchanged.
  - Supplier balances (`totalPayable`, `totalPaid`) in `/suppliers/{supplierId}` can strictly only be created or modified by authorized Administrators.
  - Ledger entries (`/entries/{entryId}`) and Accounts (`/accounts/{accountId}`) are append/update restricted to verified Administrators.
- **Admin Verification:**
  - Evaluated through `isAdmin()` requiring `request.auth != null`, `request.auth.token.email_verified == true`, and verified against `alianus09x@gmail.com` or explicit inclusion in `/admins/{uid}`.
- **Identity & Type Safety:**
  - Document IDs must conform to hardened regex pattern `^[a-zA-Z0-9_\-]+$` and size <= 128 chars.
  - All financial amounts must be non-negative numbers (`amount >= 0`).

## 2. The Dirty Dozen Payloads
1. Unauthenticated write to `/clients/AV-C001` -> PERMISSION_DENIED
2. Non-admin authenticated user altering customer `amountDue` or `amountPaid` -> PERMISSION_DENIED
3. Non-admin authenticated user altering booking `totalAmount` or `totalCost` -> PERMISSION_DENIED
4. Non-admin authenticated user altering supplier `totalPayable` or `totalPaid` -> PERMISSION_DENIED
5. Unverified email write attempt to `/entries/E001` -> PERMISSION_DENIED
6. Spoofed admin email with `email_verified == false` -> PERMISSION_DENIED
7. Malformed client document ID (junk > 128 chars) -> PERMISSION_DENIED
8. Client write with negative amountDue (`amountDue < 0`) -> PERMISSION_DENIED
9. Non-admin write to `/accounts/AC-001` -> PERMISSION_DENIED
10. Unauthenticated modification of `/settings/opening` -> PERMISSION_DENIED
11. Write to arbitrary undeclared collections `/private_admin/{id}` -> PERMISSION_DENIED
12. Attempt to bypass catch-all rule `/{document=**}` -> PERMISSION_DENIED
