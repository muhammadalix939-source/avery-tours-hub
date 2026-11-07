// Cost Allocation — ONE pure module (no React, no store state; types only).
// Every screen / PDF reads "who bears this purchase" and "who was this supplier payment for" through here,
// so a rupee is never counted twice and old (legacy, single-target) entries keep their exact numbers.
import type { CostAllocation, LedgerEntry, PaymentAllocation } from "./store";

// ---------------------------------------------------------------- integer maths

/** Integer split. First `total % count` lines get +1. 100001/3 → [33334, 33334, 33333]. Sum is always `total`. */
export function splitEqual(total: number, count: number): number[] {
  const n = Math.max(0, Math.floor(count));
  if (n === 0) return [];
  const t = Math.max(0, Math.round(total));
  const base = Math.floor(t / n);
  const r = t - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < r ? 1 : 0));
}

/** Largest-remainder distribution of `total` over `weights` (sum === total, deterministic, ties → earlier index). */
export function distributeProRata(total: number, weights: number[]): number[] {
  const t = Math.round(total);
  const w = weights.map((x) => Math.max(0, Number(x) || 0));
  const sum = w.reduce((a, b) => a + b, 0);
  if (!w.length) return [];
  if (sum <= 0) return w.map(() => 0);
  const sign = t < 0 ? -1 : 1;
  const abs = Math.abs(t);
  const raw = w.map((x) => (abs * x) / sum);
  const floors = raw.map(Math.floor);
  let left = abs - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; k < order.length && left > 0; k++, left--) floors[order[k].i] += 1;
  return floors.map((x) => sign * x);
}

/** Equal-split `total` minus locked amounts over the UNLOCKED lines. Never negative. */
export function rebalanceEqual<T extends { amount: number; locked?: boolean }>(lines: T[], total: number): T[] {
  const lockedSum = lines.filter((l) => l.locked).reduce((s, l) => s + l.amount, 0);
  const free = lines.filter((l) => !l.locked);
  const shares = splitEqual(Math.max(0, Math.round(total) - lockedSum), free.length);
  let k = 0;
  return lines.map((l) => (l.locked ? l : { ...l, amount: shares[k++] }));
}

/** Manual helper: put (total − the other lines) on the last unlocked line (clamped at 0). */
export function autoBalanceLast<T extends { amount: number; locked?: boolean }>(lines: T[], total: number): T[] {
  let idx = -1;
  lines.forEach((l, i) => { if (!l.locked) idx = i; });
  if (idx < 0) return lines;
  const others = lines.reduce((s, l, i) => (i === idx ? s : s + l.amount), 0);
  const amount = Math.max(0, Math.round(total) - others);
  return lines.map((l, i) => (i === idx ? { ...l, amount } : l));
}

// ---------------------------------------------------------------- validation

export interface AllocationContext {
  heads: Set<string>;
  agents: Set<string>;
  membersOf: (headId: string) => Set<string>;
}
export interface AllocationValidation { ok: boolean; errors: string[]; remaining: number }

export function validateAllocations(lines: CostAllocation[], total: number, ctx: AllocationContext): AllocationValidation {
  const errors: string[] = [];
  const t = Math.round(total);
  if (!lines.length) errors.push("Add at least one allocation line.");
  const sum = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const remaining = t - sum;
  if (lines.length && remaining !== 0) errors.push(`Shares must add up to the purchase amount (${remaining > 0 ? "+" : "−"}${Math.abs(remaining).toLocaleString("en-US")} remaining).`);
  const seen = new Set<string>();
  lines.forEach((l, i) => {
    const n = i + 1;
    if (!Number.isInteger(l.amount)) errors.push(`Line ${n}: amount must be a whole number of rupees.`);
    if (!(l.amount > 0)) errors.push(`Line ${n}: share must be greater than zero.`);
    if (l.target === "head") {
      if (!l.headId) errors.push(`Line ${n}: choose a Head.`);
      else if (!ctx.heads.has(l.headId)) errors.push(`Line ${n}: Head ${l.headId} does not exist.`);
      else if (l.clientId && !ctx.membersOf(l.headId).has(l.clientId)) errors.push(`Line ${n}: that member is not part of ${l.headId}.`);
    } else if (l.target === "agent") {
      if (!l.agentId) errors.push(`Line ${n}: choose an Agent.`);
      else if (!ctx.agents.has(l.agentId)) errors.push(`Line ${n}: Agent ${l.agentId} does not exist.`);
      if (l.saleAmount !== undefined && !(l.saleAmount >= 0)) errors.push(`Line ${n}: sale amount cannot be negative.`);
    }
    const key = `${l.target}|${l.headId || ""}|${l.clientId || ""}|${l.agentId || ""}`;
    if (seen.has(key)) errors.push(`Line ${n}: duplicate target — merge it with the earlier line.`);
    seen.add(key);
  });
  return { ok: errors.length === 0, errors, remaining };
}

export interface PaymentContext { heads: Set<string>; agents: Set<string>; groups: Set<string> }

/** Supplier-payment tags: sum must equal the payment; "unallocated" soaks up whatever is not tagged. */
export function validatePaymentAllocations(lines: PaymentAllocation[], total: number, ctx: PaymentContext): AllocationValidation {
  const errors: string[] = [];
  const t = Math.round(total);
  if (!lines.length) errors.push("Add at least one tag line (or use Unallocated).");
  const sum = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const remaining = t - sum;
  if (lines.length && remaining !== 0) errors.push(`Tags must add up to the payment amount (${remaining > 0 ? "+" : "−"}${Math.abs(remaining).toLocaleString("en-US")} remaining).`);
  const seen = new Set<string>();
  lines.forEach((l, i) => {
    const n = i + 1;
    if (!Number.isInteger(l.amount)) errors.push(`Line ${n}: amount must be a whole number of rupees.`);
    if (!(l.amount > 0)) errors.push(`Line ${n}: amount must be greater than zero.`);
    if (l.target === "head") { if (!l.headId) errors.push(`Line ${n}: choose a Head.`); else if (!ctx.heads.has(l.headId)) errors.push(`Line ${n}: Head ${l.headId} does not exist.`); }
    if (l.target === "group") { if (!l.groupId) errors.push(`Line ${n}: choose a Group.`); else if (!ctx.groups.has(l.groupId)) errors.push(`Line ${n}: Group ${l.groupId} does not exist.`); }
    if (l.target === "agent") { if (!l.agentId) errors.push(`Line ${n}: choose an Agent.`); else if (!ctx.agents.has(l.agentId)) errors.push(`Line ${n}: Agent ${l.agentId} does not exist.`); }
    const key = `${l.target}|${l.headId || ""}|${l.groupId || ""}|${l.agentId || ""}`;
    if (seen.has(key)) errors.push(`Line ${n}: duplicate target — merge it with the earlier line.`);
    seen.add(key);
  });
  return { ok: errors.length === 0, errors, remaining };
}

// ---------------------------------------------------------------- legacy adapters (read side)

/** Lines of a purchase. New entries return `allocations`; old ones are synthesised from the single-target fields. */
export function purchaseAllocations(e: LedgerEntry): CostAllocation[] {
  if (e.allocations && e.allocations.length) return e.allocations;
  if (e.purchasedFor === "agent" && e.agentId) {
    return [{ id: "L1", target: "agent", agentId: e.agentId, amount: e.amount, saleAmount: e.saleAmount ?? e.amount, ...(e.forClientName ? { forClientName: e.forClientName } : {}) }];
  }
  if (e.headId) {
    return [{ id: "L1", target: "head", headId: e.headId, ...(e.clientId ? { clientId: e.clientId } : {}), amount: e.amount }];
  }
  return [{ id: "L1", target: "office", amount: e.amount }];
}

export function isSplitEntry(e: LedgerEntry): boolean {
  return !!e.allocations && e.allocations.length > 1;
}

/** Short human text, e.g. "AV-HD-001 · AV-HD-002 · AV-A001". */
export function allocationTargetsLabel(e: LedgerEntry): string {
  return purchaseAllocations(e).map((l) => (l.target === "head" ? l.headId : l.target === "agent" ? l.agentId : "Office")).filter(Boolean).join(" · ");
}

const purchases = (entries: LedgerEntry[]) => entries.filter((e) => e.type === "purchase");

/** Supplier refunds that reverse an ALLOCATED purchase are shared over its lines pro-rata. */
function refundsOf(entries: LedgerEntry[], purchaseId: string): number {
  return entries.filter((e) => e.type === "supplier_refund" && e.refundOf === purchaseId).reduce((s, e) => s + e.amount, 0);
}

/** Gross cost (before supplier refunds) the head bears: every head line of every purchase. */
export function headCostOf(entries: LedgerEntry[], headId: string): number {
  return purchases(entries).reduce((sum, p) => sum + purchaseAllocations(p).filter((l) => l.target === "head" && l.headId === headId).reduce((s, l) => s + l.amount, 0), 0);
}

/** Supplier refunds credited to the head: pro-rata share of refunds on split purchases + legacy refunds tagged with the head. */
export function headSupplierRefundOf(entries: LedgerEntry[], headId: string): number {
  const split = new Set(purchases(entries).filter((p) => p.allocations && p.allocations.length).map((p) => p.id));
  let total = 0;
  // legacy / simple: refund row carries the head id (and does not point at a split purchase)
  entries.forEach((e) => {
    if (e.type === "supplier_refund" && e.headId === headId && !(e.refundOf && split.has(e.refundOf))) total += e.amount;
  });
  // split purchases: distribute each refund over the purchase lines (cost side)
  purchases(entries).forEach((p) => {
    if (!split.has(p.id)) return;
    const r = refundsOf(entries, p.id);
    if (r <= 0) return;
    const lines = purchaseAllocations(p);
    const shares = distributeProRata(r, lines.map((l) => l.amount));
    lines.forEach((l, i) => { if (l.target === "head" && l.headId === headId) total += shares[i]; });
  });
  return total;
}

export interface OtherSaleRow { entry: LedgerEntry; line?: CostAllocation; sale: number; cost: number; profit: number | null }

/** Other Sale of an agent: purchase lines billed to him + explicit `other_sale` entries. */
export function agentOtherSaleRows(entries: LedgerEntry[], agentId: string): OtherSaleRow[] {
  const rows: OtherSaleRow[] = [];
  entries.forEach((e) => {
    if (e.type === "purchase") {
      purchaseAllocations(e).forEach((l) => {
        if (l.target === "agent" && l.agentId === agentId) {
          const sale = l.saleAmount ?? l.amount;
          rows.push({ entry: e, line: l, sale, cost: l.amount, profit: sale - l.amount });
        }
      });
    } else if (e.type === "other_sale" && e.referenceId === agentId) {
      rows.push({ entry: e, sale: e.amount, cost: 0, profit: null });
    }
  });
  return rows;
}

/** Lines of a supplier payment (legacy: head → head, group → group, agent → agent, else unallocated). */
export function paymentAllocations(e: LedgerEntry): PaymentAllocation[] {
  if (e.paymentAllocations && e.paymentAllocations.length) return e.paymentAllocations;
  if (e.headId) return [{ id: "L1", target: "head", headId: e.headId, amount: e.amount }];
  if (e.groupId) return [{ id: "L1", target: "group", groupId: e.groupId, amount: e.amount }];
  if (e.agentId) return [{ id: "L1", target: "agent", agentId: e.agentId, amount: e.amount }];
  return [{ id: "L1", target: "unallocated", amount: e.amount }];
}

const payments = (entries: LedgerEntry[]) => entries.filter((e) => e.type === "supplier_payment");

/** Supplier money attributed to a head: direct head lines + its pro-rata share of group-tagged money. */
export function headSupplierPaid(entries: LedgerEntry[], headId: string): number {
  let direct = 0;
  const groupMoney = new Map<string, number>();
  payments(entries).forEach((e) => {
    paymentAllocations(e).forEach((l) => {
      if (l.target === "head" && l.headId === headId) direct += l.amount;
      if (l.target === "group" && l.groupId) groupMoney.set(l.groupId, (groupMoney.get(l.groupId) || 0) + l.amount);
    });
  });
  let prorated = 0;
  groupMoney.forEach((paid, gid) => {
    const groupPurchases = purchases(entries).filter((p) => p.groupId === gid);
    const bill = groupPurchases.reduce((s, p) => s + p.amount, 0);
    if (bill <= 0) return;
    // head cost inside this group, taken from allocation lines (not from the raw headId field)
    const heads = new Map<string, number>();
    groupPurchases.forEach((p) => purchaseAllocations(p).forEach((l) => { if (l.target === "head" && l.headId) heads.set(l.headId, (heads.get(l.headId) || 0) + l.amount); }));
    const mine = heads.get(headId) || 0;
    if (!mine) return;
    const ids = [...heads.keys()];
    const rest = Math.max(0, bill - [...heads.values()].reduce((a, b) => a + b, 0));
    const shares = distributeProRata(paid, [...ids.map((h) => heads.get(h) || 0), rest]);
    prorated += shares[ids.indexOf(headId)];
  });
  return Math.round(direct + prorated);
}

/** Money of a supplier payment that settles a Group / PNR bill. Legacy entries keep their old rule (groupId → whole amount). */
export function paymentAmountForGroup(e: LedgerEntry, groupId: string): number {
  if (e.type !== "supplier_payment") return 0;
  if (e.paymentAllocations && e.paymentAllocations.length) return e.paymentAllocations.filter((l) => l.target === "group" && l.groupId === groupId).reduce((s, l) => s + l.amount, 0);
  return e.groupId === groupId ? e.amount : 0;
}

/** Memo figure: supplier money paid on an agent's behalf. NEVER agent receipts / outstanding. */
export function agentSupplierPaid(entries: LedgerEntry[], agentId: string): number {
  return payments(entries).reduce((sum, e) => sum + paymentAllocations(e).filter((l) => l.target === "agent" && l.agentId === agentId).reduce((s, l) => s + l.amount, 0), 0);
}

/** A purchase (cost) that appears in a head's ledger: any allocation line points at it. */
export function entryTouchesHead(e: LedgerEntry, headId: string): boolean {
  if (e.headId === headId) return true;
  if (e.type === "purchase") return purchaseAllocations(e).some((l) => l.target === "head" && l.headId === headId);
  if (e.type === "supplier_payment") return paymentAllocations(e).some((l) => l.target === "head" && l.headId === headId);
  return false;
}

/** Entries whose NEW-style allocation lines reference this head / agent — used to block deleting them. */
export function entriesAllocatingTo(entries: LedgerEntry[], ref: { headId?: string; agentId?: string }): LedgerEntry[] {
  return entries.filter((e) => {
    const costLines = (e.allocations || []).some((l) => (ref.headId && l.target === "head" && l.headId === ref.headId) || (ref.agentId && l.target === "agent" && l.agentId === ref.agentId));
    const payLines = (e.paymentAllocations || []).some((l) => (ref.headId && l.target === "head" && l.headId === ref.headId) || (ref.agentId && l.target === "agent" && l.agentId === ref.agentId));
    return costLines || payLines;
  });
}

/** Head lines of a purchase as "share of total" rows for the Business View card. */
export interface AllocatedPurchaseRow { entryId: string; date: string; supplier: string; service: string; share: number; ofTotal: number; split: boolean }
export function allocatedPurchasesOf(entries: LedgerEntry[], headId: string): AllocatedPurchaseRow[] {
  return purchases(entries)
    .map((p) => {
      const share = purchaseAllocations(p).filter((l) => l.target === "head" && l.headId === headId).reduce((s, l) => s + l.amount, 0);
      return { p, share };
    })
    .filter((x) => x.share > 0)
    .map(({ p, share }) => ({ entryId: p.id, date: p.date, supplier: p.referenceName || p.referenceId, service: p.serviceCategory || "Purchase", share, ofTotal: p.amount, split: isSplitEntry(p) }));
}
