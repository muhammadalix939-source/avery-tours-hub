# Avery System — Upgrade Log

Single place to see what is done, what is verified and what is left. Update it with every change.

## Status (audited 5 Nov 2026 against origin/main 1e5b462)

| Area | Status | Evidence |
|---|---|---|
| Brand fonts (Libre Baskerville / IBM Plex Sans) on screen | Done | Fonts load, tokens match `styles.css` |
| Sidebar (all sections + Settings reachable, compact DB row, scroll fade) | Done, checked at 1440x900 and 390x844 | Screenshot review |
| Dashboard KPI cards | Fixed in this change: six cards in one row at 1280-1535 px truncated figures ("Rs 930,..."); now 3 columns until 2xl | Screenshot review before/after |
| Global Undo toast (about 8.5 s) on add / edit / delete | Present (`registerUndoableAction`, snapshot based) | Code review |
| Page-change motion, glass cards, hover effects | Present (`framer-motion`, `.glass-card`, `.glass-card-hover`) | Code review |
| PDF: logo top-left, ivory/navy/gold, service-category sections | Done for Supplier, Agent, Client, Invoice, Receipt, Payment History | Rendered with test data, page images reviewed |
| PDF: embedded brand fonts | Done (pdffonts shows LibreBaskerville + IBMPlexSans embedded) | Rendered and inspected |
| PDF: Agent / Invoice / Receipt header overlap | Fixed in this change: long titles ran through the company name; wordmark now auto-fits | Before/after render |
| Typecheck | `tsc --noEmit` = 0 errors | Run |
| ESLint on `src/lib/pdf.ts` | Clean | Run |

## Update 6 Nov 2026 - statements logic and bookings
| Area | Change |
|---|---|
| Client statement | **Bug fixed:** callers pass every ledger row linked to the client or Head ID, so supplier purchases and supplier payments were printed on a client-facing PDF as "Payments Received" and distorted totals. The builder now keeps only client money: receipts, extra charges, refunds and discounts that belong to the client or its Head (unassigned charges go to the lead member, same rule as the store). Added Extra Charges and Refunds & Discounts sections; labels "BKG / RCPT"; removed "Filtered by Group" wording. |
| Supplier statement | **Bug fixed:** supplier refunds and discounts were ignored, so the PDF disagreed with the Suppliers page. They are now listed as credits and deducted from payable. "Payments Received" renamed "Payments Made"; "Receipt" column renamed "Ref #". |
| Bookings page | Every booking shows the Head name (lead member) under the Head ID in the table, in each booking card heading, in the Edit dialog title, in the action toasts, and as the sort key for "Name". Table cells no longer wrap figures. Helper: `getHeadName()` in `src/lib/heads.ts`. |

## Update 7 Nov 2026 - discount, new members, statements, Cost Allocation
| Area | Change |
|---|---|
| Client discount | **Bug fixed:** the booking-form discount was only a display tag; totals, member dues, Pending, Business View and PDFs never subtracted it. One function now derives everything: `resyncHead()` in `store.ts` (booking total = package + charges - refunds - ledger discounts - booking discount; member due likewise, discount taken from the lead first and spilling over to the next member; payments allocated FIFO). Views read `computeBookingMoney()` / `computeHeadBusiness()` in `heads.ts`. Older saves are migrated on load (idempotent). |
| New member | **Bug fixed:** adding a member never touched the booking. `addClient / updateClient / deleteClient` now move the booking package total by the member's price (moving a member between heads moves it between bookings) and keep `members` / `clientIds` in sync. The edit-booking screen read a stale roster after adding or removing pax; it now reads the live roster. Member dialog edits the package price (net due is derived). |
| Profit (**numbers change**) | Agent-settled discounts were double counted in the agency's favour. Correct: profit = (gross - full discount) - supplier cost - (commission - agent-absorbed part). Direct bookings (no agent) absorb the whole discount. "(Agent)" label no longer shown on Direct bookings. |
| Statements | ID and name are printed together everywhere (`idName()`): invoice, payment history, client / agent / supplier statements, tables. Invoice shows Package, Extra, Discount, Net Payable, Received, Balance Due; payment history lists receipts / charges / refunds / discounts and has an empty state. |
| Cost Allocation | `src/lib/allocations.ts` (pure; largest-remainder rounding; legacy adapters so old entries keep exact numbers), `AllocationEditor.tsx`, Entries form: Purchase For = Office / One client / One agent / **Split** (Equal or Manual, lock, auto-balance, per-line "also bill client" which creates a locked linked charge). Supplier payments can be tagged across heads, groups and agents (supplier balance and cash/bank always use the full payment). Head share -> Head Business View cost + "Allocated purchases" list; agent share -> Other Sale (agent view, DetailDialog, statement PDF with "Share of E123" note). `Split x N` badge in Entries. Deleting a head or agent that appears in an allocation is blocked with the entry list. |
| Checks | `bun run src/lib/allocations.selfcheck.ts` (13 checks), `bun test scripts/finance.test.ts` (7 behaviour tests: discount, +member, spill-over, linked charge, profit), tsc 0 errors, PDFs rendered and reviewed, Entries Split flow driven in a headless browser. |
| Deliberately not done | Supplier statement does not print "Allocated to: heads / agents" - that PDF goes to the supplier and would expose client / agent business. |

## Not verified / known limits
- Statements print all-time totals (payable/paid) even when a date range is chosen; only the listed rows are filtered.
- Supplier PDF totals come from ledger entries; the Suppliers page also applies `max(purchases, booking cost)`. They only differ when a booking cost exceeds itemised purchases.
- `vite build` could not be run in the authoring sandbox (it also fails there on untouched main); verify the build in your normal environment.
- Firebase / Google Fonts requests are blocked in the sandbox, so cloud sync was not exercised.
- Refund convention differs between booking-level and traveller-level remaining (pre-existing, documented in AGENTS.md); intentionally unchanged.

## Next
1. Small spacing polish on the Tax Invoice heading under the "Invoice #" bar.
2. Mobile pass on Entries / Agents tables.
3. Hand-test Cost Allocation on real data (split a real hotel bill; check Head Business View and the agent statement).

## Rules for any contributor (human or AI)
- Ledger entries are the only source of truth; totals are derived.
- No duplicate entries for one business fact; `agent_receive` never sets `headId`.
- No force-push to `main`.
