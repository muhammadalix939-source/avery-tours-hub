# Booking Lifecycle Fulfillment & Universal Sort-By Engine

A professional workflow overhaul for Avery Travel CRM that separates active bookings from completed/fulfilled travel orders via dedicated lifecycle tabs, provides a hybrid auto-fulfillment mechanism with continuous editability, and integrates a universal multi-criteria sort-by engine (Date, Amount, Alphabetical) across Bookings, Entries, and Groups.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following product decisions were confirmed during the interactive clarification phase and govern the architectural blueprint:

- **Confirmed Decision 1 (Tabular Lifecycle Architecture)**: Active and Completed bookings will be organized into dedicated high-density tabs (`Active Bookings` vs `Completed / Fulfilled Bookings`) with live count counters, mirroring the group closure pattern while maintaining immediate full-history visibility.
- **Confirmed Decision 2 (Hybrid Fulfillment Transition)**: Bookings auto-suggest completion when travel date has passed or services/checklists are fulfilled, accompanied by a prominent 1-click toggle button (`Mark Fulfilled` / `Reopen Active`). Completed bookings remain 100% editable at all times to accommodate post-travel billing adjustments, refund entries, or voucher reprints.
- **Confirmed Decision 3 (Universal Multi-Parameter Sort Engine)**: A standardized, reusable sorting dropdown bar (`Sort by: Date Newest → Oldest, Date Oldest → Newest, Amount High → Low, Amount Low → High, Alphabetical A → Z`) will be deployed across Bookings, Entries, Groups, Clients, and Accounts.

---

## 1. Overview & Core Concept

### What It Does
1. **Booking Lifecycle Separation**:
   - **Active Bookings Tab**: Focuses team attention on upcoming departures, unpaid balances, pending service vouchers (flights, hotels, transport), and uncompleted traveler checklists.
   - **Completed / Fulfilled Tab**: Isolates settled, traveled, and reconciled bookings so historical records do not clutter active operational queues.
   - **Fulfill / Reopen Controls**: Users can mark bookings as completed or reopen them at any time. Any financial changes (refunds, post-trip hotel bill adjustments) update the booking without breaking fulfillment state.
2. **Universal Sort-By Engine**:
   - Replaces hardcoded descending-date lists with a flexible sorting bar that handles date-based ordering, financial volume ordering (highest/lowest total or pending balance), and alphabetical organization.
   - Preserves active filters (search queries, package types, date ranges) while changing sort orders smoothly.

### Target Audience & Persona
- **Travel Agency Operations Managers & Reservation Agents**: Need an uncluttered view of pending departures while retaining instant searchability of historical trips for client re-booking, accounting audits, and visa tracking.

### Key Value Delivered
- **Operational Clarity**: Reduces cognitive load by eliminating traveled bookings from day-to-day departure monitors.
- **Flexible Data Exploration**: Enables one-click discovery of top-billing clients, high-volume transactions, and chronologically ordered financial logs.

---

## 2. User Experience & Visual Design

### Key User Flows

#### Flow 1: Managing Active vs Completed Bookings
1. The user navigates to `/bookings`.
2. Above the data table, a segmented tab controller displays:
   - **Active Bookings** (with live count badge, e.g. `[Active (12)]`).
   - **Completed / Fulfilled** (with count badge, e.g. `[Completed (84)]`).
   - **All Bookings** (master audit view).
3. Active bookings with past travel dates display a subtle amber notice: *"Travel date passed — ready to fulfill"*.
4. Clicking **"Mark Completed"** moves the booking to the Completed tab with an instant notification toast.
5. In the Completed tab, bookings retain all action buttons (`Edit`, `Invoice`, `Payment History`, `Services`, `Delete`). If edited, changes persist safely. A **"Reopen"** button allows restoring to Active if needed.

#### Flow 2: Universal Sorting & Filtering
1. On `/bookings`, `/entries`, and `/groups`, a unified control bar sits right beside the search input.
2. The user clicks **Sort By**:
   - `Date: Newest First` (Default)
   - `Date: Oldest First`
   - `Amount: Highest First`
   - `Amount: Lowest First`
   - `Name / ID: A → Z`
   - `Name / ID: Z → A`
3. Table rows animate and reorder instantly with zero page reload.

### Visual Identity & Theme
- **Color Discipline**:
  - Semantic status tokens: `--primary` (cyan/teal for active IDs), `--success` (emerald for completed/fulfilled indicators), `--warning` (amber for travel date passed / pending action), `--muted` for quiet typography.
  - Zero-pill discipline: Metadata (dates, passport count, supplier IDs) rendered with quiet inline text and dividers (`·`), reserving bordered buttons strictly for interactive filter tabs.
- **Typographic Math**: Monospace tabular numerals (`font-mono`) on all PKR currency amounts, counts, and dates to guarantee vertical decimal alignment.

---

## 3. Key Product Decisions & Trade-Offs

| Decision | Chosen Approach | Why Chosen | Alternative Considered |
| :--- | :--- | :--- | :--- |
| **Fulfillment Storage** | `serviceCompleted?: boolean` & `completedAt?: string` in `Booking` interface | Decouples travel fulfillment from payment status (`Paid` vs `Partial`). A booking can be fulfilled even if an agent has remaining balance due. | Reusing the existing `status: "Confirmed" \| "Pending" \| "Cancelled"` field, which would break booking financial states. |
| **Post-Completion Edits** | Full editability preserved across all fields | Travel agencies frequently receive late supplier invoices, extra charges, or rooming corrections after clients return. | Locking completed records in read-only mode, which would frustrate operations staff. |
| **Sort Implementation** | Shared declarative sorter hook / utility in `@/lib/sort.ts` | Guarantees identical sorting semantics, tie-breaking rules, and date-parsing across Bookings, Entries, and Groups. | Repeating ad-hoc `.sort(...)` calls inside each page component. |

---

## 4. Technical Architecture & Data Strategy

### System Component & Data Flow Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Avery Travel CRM UI                           │
├────────────────────────────┬───────────────────────────────────────────┤
│    /bookings Route View    │            /entries Route View            │
│  ┌──────────────────────┐  │  ┌─────────────────────────────────────┐  │
│  │ Segmented Tabs:      │  │  │ Universal SortBar Component:        │  │
│  │ [Active] [Completed] │  │  │ [Date ▼] [Amount ▼] [A-Z ▼]         │  │
│  └──────────┬───────────┘  │  └──────────────────┬──────────────────┘  │
│             │              │                     │                     │
│             ▼              │                     ▼                     │
│  ┌──────────────────────┐  │  ┌─────────────────────────────────────┐  │
│  │ Sort & Filter Engine │  │  │ Shared Sorter Pipeline              │  │
│  │ (Active vs Fulfilled)│  │  │ (Date, Amount, Reference Alphabet)  │  │
│  └──────────┬───────────┘  │  └──────────────────┬──────────────────┘  │
└─────────────┼────────────────────────────────────┼─────────────────────┘
              │                                    │
              ▼                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Zustand & Reactive Store                        │
│                         (src/lib/store.ts)                             │
│                                                                        │
│  • toggleBookingCompleted(bookingId: string)                           │
│  • Booking.serviceCompleted: boolean                                   │
│  • Booking.completedAt?: string                                        │
│  • Universal Sort Preferences & Dynamic Sorting Helpers               │
└────────────────────────────────────────────────────────────────────────┘
```

### Data Model Enhancements

1. **`Booking` Interface Extension (`src/lib/data.ts`)**:
   ```typescript
   export interface Booking {
     // ... existing fields ...
     serviceCompleted?: boolean;
     completedAt?: string;
   }
   ```

2. **Store Action Additions (`src/lib/store.ts`)**:
   - `toggleBookingCompleted(id: string)`: Inverts `serviceCompleted` and stamps `completedAt`.
   - `setBookingCompleted(id: string, completed: boolean)`: Explicitly sets completion status.

3. **Universal Sorting Utility (`src/lib/sort-utils.ts`)**:
   - Standardized `SortOption` type:
     `"date_desc" | "date_asc" | "amount_desc" | "amount_asc" | "name_asc" | "name_desc"`.
   - Generic comparator functions for items with date, amount, and name properties.
