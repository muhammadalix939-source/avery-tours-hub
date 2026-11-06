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

## Not verified / known limits
- Statements print all-time totals (payable/paid) even when a date range is chosen; only the listed rows are filtered.
- Supplier PDF totals come from ledger entries; the Suppliers page also applies `max(purchases, booking cost)`. They only differ when a booking cost exceeds itemised purchases.
- `vite build` could not be run in the authoring sandbox (it also fails there on untouched main); verify the build in your normal environment.
- Firebase / Google Fonts requests are blocked in the sandbox, so cloud sync was not exercised.
- Refund convention differs between booking-level and traveller-level remaining (pre-existing, documented in AGENTS.md); intentionally unchanged.

## Next
1. Implement Cost Allocation using `docs/COST-ALLOCATION-PROMPT.md` (purchase and supplier-payment splits across heads / agents; agent share becomes Other Sale).
2. Small spacing polish on the Tax Invoice heading under the "Invoice #" bar.
3. Mobile pass on Entries / Agents tables.

## Rules for any contributor (human or AI)
- Ledger entries are the only source of truth; totals are derived.
- No duplicate entries for one business fact; `agent_receive` never sets `headId`.
- No force-push to `main`.
