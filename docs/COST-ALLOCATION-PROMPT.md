# READY-TO-PASTE PROMPT — Cost Allocation (Purchases + Supplier Payments)

> Paste everything below the line into Google AI Studio / Lovable, with the **avery-system** repo (React 19, TanStack Router/Start, Vite, Tailwind, shadcn/ui, store in `src/lib/store.ts`) open.
> Section 0 is the brief, Sections 1-2 are the verified analysis of the existing code, 3-9 are the specification. Nothing here asks for a rewrite.

---

## 0. ROLE AND OUTCOME

You are a senior full-stack engineer and a chartered-accountant-minded reviewer working inside the existing **avery-system** travel-agency CRM. Implement **Cost Allocation**:

1. Every supplier **Purchase** (room, flight, transport, visa, package, ...) states **who it was bought for**. One purchase may be **split across several targets**: several client Heads, optionally a specific member of a Head, one or more Agents, and/or the Office.
2. The split is either **Equal (automatic)** or **Manual (typed shares)**. Shares always add up to the purchase amount to the last rupee.
3. A **Head** share appears in that Head's **Business View** as cost. An **Agent** share appears in that Agent's account as **Other Sale**, with the existing rules (sale amount may differ from cost; profit shown).
4. **Supplier Payments** get the same allocation tagging: a payment can be tagged against a Group (PNR/batch), against Heads, and against Agents, with amounts.

Work incrementally, keep the app compiling after every step, and **change as little existing code as possible**. Zero TypeScript errors (`exactOptionalPropertyTypes` is on). No `any` in new code. No new dependencies.

---

## 1. VERIFIED CURRENT STATE (do not re-invent; extend)

**Ledger.** `LedgerEntry` in `src/lib/store.ts` is the single source of truth. Totals are always derived, never stored as deltas.

**Fields that already exist on `LedgerEntry` and must be reused, not duplicated:** `type` (`purchase`, `supplier_payment`, `supplier_refund`, `client_charge`, `client_receive`, `agent_receive`, `other_sale`, ...), `headId`, `referenceId` (supplier id for purchases/payments; agent id for `other_sale`/`agent_*`), `agentId`, `groupId`, `serviceCategory`, `purchaseDetails`, `purchasedFor: "agent" | "client"`, `forClientName`, `saleAmount`, `reflectInClientLedger`, `clientId`, `refundOf`, `paidBy`, `voucherNo`, `sharedClientIds`, `splitMethod: "equal" | "manual"`, `clientSplits: Record<string, number>`.

**Important finding:** `sharedClientIds / splitMethod / clientSplits` are declared on the type (comment: "Shared Cost Allocation") but **no screen writes them and no calculation reads them**. They only work inside one Head and are single-level. Replace their role with the new `allocations` model below, keep them in the type for old saved data, and never write them again.

**Today a purchase can only point to ONE target** (`src/routes/entries.tsx`, state `pf`, the "Purchase For (whose account)" box, ~lines 1072-1115):
- Office / Stock: no head, no agent.
- Client: one `headId` (+ optional one member in `extra.clientId`). Text on screen: "Posts to this client's Business Ledger as cost ... personal balance is not changed."
- Agent: one `agentId`, `forClientName`, `saleAmount` (defaults to the purchase amount). Text: "Added to the agent's Other Sale and his Business Ledger receivable."

**Where cost/Other Sale is read today (all must move to the new helper in Section 4):**
| Place | What it does now |
|---|---|
| `src/lib/heads.ts` `computeHeadBusiness` | `totalPurchase = max(sum of purchase.amount where e.headId === headId, booking.totalCost) - supplierRefunds`. Supplier paid = payments with that `headId` + untagged group payments pro-rated by the head's share of the group bill. |
| `src/lib/agent-ledger.ts` `computeAgentBusiness` (line ~48) | Other Sale = purchases with `purchasedFor === "agent" && agentId === agent.id` (using `saleAmount ?? amount`) + `other_sale` entries with `referenceId === agent.id`. |
| `src/components/DetailDialog.tsx` (~line 73) | Same Other Sale filter for the agent detail view. |
| `src/routes/agents.tsx` (~line 92) | Same filter for the agent page. |
| `src/lib/pdf.ts` (~line 1090, plus the Other Sale section ~1178-1252) | Same filter for the agent statement PDF, grouped by service. |
| `src/lib/store.ts` `resyncSuppliers` (~line 543) | Supplier payable = sum of **full** purchase amounts (max with booking cost), minus refunds and discounts; paid = sum of payments. **Must stay exactly as is.** |
| `src/lib/store.ts` `addEntry / updateEntry / deleteEntry` | Take a whole-state JSON snapshot, change `entries`, call `resyncFromEntries`, `notify()`, then `registerUndoableAction(...)` (toast with Undo, ~8.5 s). One user action = one snapshot = one Undo. |

**Existing business rules to honour:**
- No duplicate entries for one business fact (one purchase = one ledger row).
- `agent_receive` never sets `headId`.
- "Other Sale" is **one** entry/line visible both in the client/head ledger context and in the agent view; it must not be counted twice.
- Supplier side always sees the **full** purchase amount; allocation only decides *who bears the cost / who is billed*.
- Flat disclosed amounts only: no interest, no compounding, no hidden mark-up (Shariah-compliant). Any agent sale price above cost must be visible to the agent in his statement.
- Existing refund convention inconsistency (booking-level vs traveller-level) is documented in AGENTS.md. Do **not** touch it.

---

## 2. ANALYSIS: WHY ONE EMBEDDED `allocations[]` AND NOT CHILD ENTRIES

Options considered:
- *A. Many child ledger rows per purchase* — breaks "one fact = one row", doubles supplier totals unless filtered everywhere, and an edit/undo must keep N rows in sync. Rejected.
- *B. Extra tables/collections* — Firestore + localStorage persistence and snapshots would need changes. Rejected.
- **C. (CHOSEN) A single optional array on the existing Purchase / Supplier Payment entry.** The snapshot/undo already deep-copies entries as JSON, so add/edit/delete/undo of the whole split is automatically atomic. Old entries keep working through a pure "legacy adapter".

Everything downstream reads allocations through **one** pure module so no screen re-implements the rules.

---

## 3. DATA MODEL (additive, optional, backward compatible)

In `src/lib/store.ts` add:

```ts
export type AllocationTarget = "head" | "agent" | "office";

export interface CostAllocation {
  /** stable id inside the entry, e.g. "A1", "A2" (not a global ledger id) */
  id: string;
  target: AllocationTarget;
  /** target === "head": the client Head */
  headId?: string;
  /** target === "head": optional specific member; empty = whole head */
  clientId?: string;
  /** target === "agent": the agent id */
  agentId?: string;
  /** Cost share in whole PKR. Sum of all lines MUST equal entry.amount. */
  amount: number;
  /** target === "agent" only: price billed to the agent (Other Sale). Defaults to `amount`. */
  saleAmount?: number;
  /** target === "agent": end passenger/client name (replaces forClientName per line) */
  forClientName?: string;
  /** Manual-mode lock: this line is not touched by equal re-split / auto-balance */
  locked?: boolean;
}

export interface PaymentAllocation {
  id: string;
  target: "head" | "group" | "agent" | "unallocated";
  headId?: string;
  groupId?: string;
  agentId?: string;
  amount: number;
}
```

On `LedgerEntry` add (both optional):

```ts
/** Purchase only. Who bears this purchase. Sum(amount) === entry.amount. */
allocations?: CostAllocation[];
/** How the lines were produced; informational, lines are authoritative. */
allocationMode?: "equal" | "manual";
/** supplier_payment only. Sum(amount) === entry.amount (use target "unallocated" for the rest). */
paymentAllocations?: PaymentAllocation[];
```

Rules:
- When `allocations` is present it is **authoritative**. The legacy single fields stay populated for compatibility: `purchasedFor`/`headId`/`agentId`/`saleAmount` are set **only if there is exactly one non-office line**; otherwise `headId = ""`, `agentId = undefined`, `purchasedFor = undefined`. Never leave a half-filled legacy field that contradicts the lines.
- No `undefined` values inside nested objects that go to Firestore; omit keys instead (the existing persist path must keep working, so check how `persist()` serialises before choosing).
- Money is **integer PKR**. Reject NaN, negatives, decimals (round input to integer on blur).

---

## 4. ONE PURE MODULE: `src/lib/allocations.ts` (no React, no store imports except types)

Implement and export exactly these, fully typed and unit-testable:

```ts
splitEqual(total: number, count: number): number[]
// Integer split. base = floor(total / count); remainder r = total - base*count.
// The FIRST r lines get +1. 100000/2 -> [50000,50000]; 100001/3 -> [33334,33334,33333]; sum always === total.

rebalanceEqual(lines: CostAllocation[], total: number): CostAllocation[]
// Equal-splits `total` minus locked amounts across UNLOCKED lines (same remainder rule). Never negative.

autoBalanceLast(lines: CostAllocation[], total: number): CostAllocation[]
// Manual helper: puts (total - sum of the other lines) on the last unlocked line.

validateAllocations(lines: CostAllocation[], total: number, ctx: { heads: Set<string>; agents: Set<string>; membersOf: (headId: string) => Set<string> }): { ok: boolean; errors: string[]; remaining: number }
// Errors: empty list; sum !== total (show remaining, signed); a head/agent line without its id; unknown id;
// duplicate (same target+id+clientId) lines; amount <= 0; agent saleAmount < 0; clientId not in headId.

purchaseAllocations(e: LedgerEntry): CostAllocation[]
// LEGACY ADAPTER. If e.allocations exists return it. Otherwise synthesise ONE line from the old fields:
//   purchasedFor "client" + headId -> {target:"head", headId, clientId, amount:e.amount}
//   purchasedFor "agent"  + agentId -> {target:"agent", agentId, amount:e.amount, saleAmount:e.saleAmount ?? e.amount, forClientName:e.forClientName}
//   headId set without purchasedFor -> head line (this is how old data behaved in computeHeadBusiness)
//   otherwise -> {target:"office", amount:e.amount}

headCostOf(entries: LedgerEntry[], headId: string): number
// Sum of `amount` of every head line for that head across all `purchase` entries (via purchaseAllocations).

agentOtherSaleRows(entries: LedgerEntry[], agentId: string): { entry: LedgerEntry; line?: CostAllocation; sale: number; cost: number; profit: number }[]
// Purchase agent lines (sale = saleAmount ?? amount) PLUS `other_sale` entries with referenceId === agentId (sale = amount, cost = 0 => profit shown as "-").

paymentAllocations(e: LedgerEntry): PaymentAllocation[]
// LEGACY ADAPTER for supplier_payment: headId -> head line; groupId (no head) -> group line; agentId -> agent line; else unallocated. Same rule as today.

headSupplierPaid(entries: LedgerEntry[], headId: string): number
// direct head lines + (group lines and legacy untagged group payments pro-rated by the head's share of that group's purchase bill, using the head's allocated COST in group purchases)

agentSupplierPaid(entries: LedgerEntry[], agentId: string): number
// Memo figure only: supplier money paid on that agent's behalf. It is NOT agent receipts and must never change the agent's received/outstanding.

distributeProRata(total: number, weights: number[]): number[]
// Largest-remainder method, sum === total. Used for pro-rating (group payments, supplier refunds on an allocated purchase).
```

Rounding is deterministic and stable (same input -> same output) so PDF and screens never disagree by 1 rupee.

---

## 5. WIRING (smallest possible edits)

1. `heads.ts` — `totalPurchase`: replace the purchase sum with `headCostOf(entries, headId)`; keep `Math.max(..., booking?.totalCost || 0)` and the supplier-refund subtraction as is. `supplierPaid`: use `headSupplierPaid`. Keep `linked` for the ledger tab but make it include purchases/payments where the head appears in any allocation line (so they show in the Head's ledger list) without changing totals logic. Add to `HeadBusiness`: `allocatedPurchases: { entryId, date, supplier, service, share, ofTotal }[]` for the UI card.
2. `agent-ledger.ts`, `DetailDialog.tsx`, `agents.tsx`, `pdf.ts` — replace the four copies of the Other Sale filter with `agentOtherSaleRows`. Same numbers for old data (verify), new numbers for split purchases. `grossSales` keeps `+ otherSale` exactly as now. Commission logic untouched.
3. `store.ts` — no change to `resyncSuppliers` (supplier sees full amounts). In `addEntry/updateEntry`: if `allocations` present, run `validateAllocations`; on failure **throw a typed error that the form shows inline** (never write a bad entry). Keep one snapshot and one `registerUndoableAction` per user action.
4. `deleteEntry` of a purchase removes its allocations with it (they live inside it). Deleting a Head/Agent that is referenced by allocations must be **blocked with a clear message** naming the entries (reuse `ConfirmDelete`), never silently orphaned.
5. Supplier refunds with `refundOf` pointing at an allocated purchase are distributed over its lines with `distributeProRata` (cost side). Refunds without `refundOf` behave exactly as today.
6. **Optional "Also bill the client" per head line** (default OFF; it is today's `reflectInClientLedger` behaviour): when ON, the Head share is also posted as a `client_charge` on that head (category `Shared <Service> Cost`, `clientId` if a member was chosen). These are **system-managed linked rows** (`allocationOf: <purchaseId>` — add this one optional field), regenerated inside the same snapshot whenever the purchase is edited/deleted, shown locked in the ledger ("Linked to E123"), and excluded from any manual edit. Cost (purchase line) and revenue (charge) are different things and must never be netted or counted twice.

---

## 6. SUPPLIER PAYMENT ALLOCATION (same engine, separate meaning)

On a Supplier Payment the user may tag the money to:
- **Group** (PNR / batch) — existing `groupId` behaviour; the amount is shared among the heads of that group by their allocated cost (`distributeProRata`), exactly like today's pro-rating.
- **Head(s)** — direct amounts.
- **Agent(s)** — memo link to that agent's Other Sale purchases ("paid to supplier on your business"). It never reduces what the agent owes us and never appears as the agent paying us.
- **Unallocated** — remainder; this is the default so old behaviour (E003 "Hotel advance", headId "") is unchanged.

Rules: sum of lines === payment amount (use Unallocated for the rest). A head/agent line larger than that party's remaining supplier cost shows an **amber warning, not an error** (advances are legitimate). Same Equal/Manual controls as purchases. Supplier balance (`totalPaid`) always uses the full payment amount. The cash/bank **account posting is untouched** — allocation is analysis only, it never moves money between accounts.

---

## 7. UI / UX — MATCH THE EXISTING THEME

**Design language (already in the app, do not introduce another):** navy / gold / ivory; display font **Libre Baskerville**, body **IBM Plex Sans**; shadcn/ui; semantic tokens only (`bg-primary`, `text-primary`, `border-border`, `bg-accent/20`, `text-success`, `text-destructive`, `text-muted-foreground`) — **no hard-coded hex in components**; glass panels like the existing cards; numbers right-aligned, tabular figures; currency through `formatCurrency`.

**Where:** extend the existing box "**Purchase For (whose account)**" in `src/routes/entries.tsx`. Keep its three-way segmented control, but rename the mode set to: `Office / Stock · One client · One agent · Split`. The first three behave **exactly as today** (writes one line). `Split` opens the **Allocation Table** below. Move the new UI into its own component `src/components/AllocationEditor.tsx` (props: `total`, `value`, `onChange`, `mode: "purchase" | "payment"`, `heads`, `agents`, `groups`) so `entries.tsx` (2272 lines) grows by a few lines only.

**Allocation Table (inside the same bordered `border-primary/40 bg-primary/5` box):**
1. Header row: segmented `Equal | Manual` + live chips: `Total 100,000` · `Allocated 100,000` · `Remaining 0` (green when 0, red with sign otherwise).
2. Rows (one per target): `[Type chip: Head / Agent / Office]  [SearchableSelect]  [Member (heads only, optional)]  [Share PKR]  [Sale PKR (agents only)]  [lock]  [remove]`. Use the existing `SearchableSelect` with the same option labels as today (`AV-HD-001 — Name`, `AV-A001 — Agent`).
3. `+ Add head`, `+ Add agent`, `+ Office` buttons under the rows.
4. **Equal mode:** share inputs are read-only and recomputed live with `rebalanceEqual` whenever rows are added/removed (display "equal split, +1 PKR on the first lines" when there is a remainder). **Manual mode:** inputs editable, `Auto-balance last` button, lock toggles, Save disabled while `Remaining != 0`.
5. Agent row shows a one-line profit read-out like today: `Cost 40,000 · Other Sale 46,000 · Profit 6,000` (green/red).
6. Helper text, same small `text-[10px] text-muted-foreground` style as today: head lines -> "Posted as cost in the Head's Business View. Client's personal balance is not changed unless 'Also bill client' is on."; agent lines -> "Appears in the agent's Other Sale and receivable."
7. Mobile: rows collapse into stacked cards (type chip + select on the first line, share/sale inputs on the second); 16 px side gutters; no horizontal scroll; touch targets >= 40 px; respect `prefers-reduced-motion`.
8. Keyboard/a11y: labelled inputs, `aria-live="polite"` on the Remaining chip, Enter adds a row from the last field.

**Surfaces that must show the result:**
- **Head Business View card** (`HeadBusinessCard.tsx`): the existing "Total Purchase / Net Profit" numbers now come from allocated cost; add a collapsible "Allocated purchases" list (date, supplier, service, `share of total`, link to the entry).
- **Agent view / agent statement PDF / DetailDialog / agents.tsx**: Other Sale lines show the allocated sale, service category, end-client name, and "Share of E123 (60,000 of 100,000 cost)" in a muted second line. Keep the existing PDF layout (service-wise sections); only add the share note.
- **Entries list row:** a small `Split ×3` badge (gold outline) with a tooltip listing the lines; clicking opens the detail dialog showing the full allocation table read-only.
- **Supplier statement:** unchanged amounts; optional muted line "Allocated to: AV-HD-001, AV-HD-002, AV-A001".
- Live success messages and the 5-10 s **Undo** use the existing sonner toast via `registerUndoableAction`; message e.g. "Purchase E123 recorded — split across 3 parties". One Undo restores the whole entry.

---

## 8. VALIDATION AND EDGE CASES (all must be handled, none may throw uncaught)

- Sum mismatch, empty split, duplicate target, unknown/deleted head or agent, member not in head, non-integer, <= 0 share, agent sale < 0 -> inline message under the table, Save disabled, nothing written.
- Changing the purchase **amount** after allocating: Equal mode re-splits automatically; Manual mode keeps lines, shows Remaining, blocks Save until fixed (offer `Auto-balance last`).
- Auto-total flow (Hotel rooms x nights x per-night, pax pricing) must keep working: allocation reads the final `form.amount`.
- Editing an old (legacy) purchase opens in the matching simple mode (One client / One agent / Office) and only converts to `allocations` if the user chooses Split. Saving untouched must not change its numbers.
- Same head twice (two members of one head) is allowed only when `clientId` differs; otherwise duplicate error.
- A head line + the same head's group payment pro-ration must not double count: group pro-rating uses only the head's **purchase** cost share; direct payment lines are added once.
- Zero-amount purchase: allocation optional/disabled.
- Firestore sync / localStorage hydration of old data without the new fields: everything defaults through the legacy adapters; no migration script is required and none may rewrite existing entries.

---

## 9. ACCEPTANCE TESTS (implement as unit tests on `allocations.ts` if a test runner exists in the repo; otherwise as a `__selfcheck` function run in dev and report results)

1. `splitEqual(100000,2) = [50000,50000]`; `splitEqual(100001,3) = [33334,33334,33333]`; sum always equals total for totals 0..1000 and counts 1..9.
2. One room, 100,000, Equal between Head A and Head B -> A cost 50,000, B cost 50,000; supplier payable still 100,000.
3. Mixed manual: 90,000 = Head A 40,000 + Head B 30,000 + Agent X cost 20,000 (sale 24,000) -> Head A totalPurchase +40,000; Head B +30,000; Agent X Other Sale +24,000, profit 4,000, grossSales +24,000; supplier payable +90,000; Office absorbs 0.
4. 1 Head + 1 Agent, 60,000 / 40,000 -> Head Business View shows 60,000 cost; agent account shows Other Sale (sale amount, default 40,000) once, not twice.
5. Edit that purchase to 70,000 in Equal mode -> 35,000 / 35,000 everywhere; Undo restores the old split in one click.
6. Delete the purchase -> Head cost, Other Sale and supplier payable all drop; Undo brings back all of them together.
7. Legacy data: seeded entries (including E003 with headId "") produce byte-identical Head/Agent/Supplier numbers before and after the change.
8. Supplier payment 60,000: Head A 30,000 + Group G 20,000 + Agent X 10,000 -> head supplierPaid includes 30,000 + its pro-rata of the 20,000; agent memo shows 10,000; agent received/outstanding unchanged; supplier totalPaid 60,000; cash account moves once by 60,000.
9. Group G pro-rating: heads with costs 30,000 / 10,000 in G, group payment 20,000 -> 15,000 / 5,000.
10. Blocking: deleting a Head/Agent that appears in a line is refused with the entry list; saving with Remaining != 0 is impossible.
11. `agent_receive` still never sets `headId`; no function in this change writes `headId` onto an agent receipt.
12. `npx tsc --noEmit` (or the repo's equivalent) reports 0 errors; ESLint clean on touched files.

---

## 10. DO-NOT-TOUCH / GUARDRAILS

- Do not change `resyncSuppliers`, cash/bank account posting, commission calculation, the refund-convention behaviour, auth, Firebase/Supabase config, routing, or the sidebar/theme tokens.
- Do not create a second source of truth or store derived totals on entries/heads/agents.
- Do not add libraries. Do not delete or rename existing exported functions/types; only add.
- Do not touch `public/` assets or any unrelated file. No placeholder/TODO code; every branch must work.
- Keep text consistent with existing labels (Other Sale, Business View, Head, Agent, Supplier Payment, PKR).

## 11. DELIVERY FORMAT (what I expect back)

1. A list of files changed/added, one line each with the reason.
2. Full contents of each **new** file; for edited files, the exact changed blocks with enough surrounding lines to apply them.
3. The results of the Section 9 checks (numbers, not "should work").
4. Anything you could not verify, stated plainly.
Implement in this order, compiling after each: (1) types + `allocations.ts` + tests, (2) read-side switch (heads, agent ledger, pdf, agents, DetailDialog) with legacy parity check, (3) `AllocationEditor` + purchase form, (4) supplier payment allocation, (5) badges, Business View list, PDF share notes.
