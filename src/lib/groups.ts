// Pure analytics helpers for Purchase Groups (PNR / batch groups).
// Keeps the Groups page logic testable and consistent with the rest of the CRM.
import type { Booking, Client, Supplier } from "./data";
import type { LedgerEntry, PurchaseGroup } from "./store";

export interface GroupHeadSummary {
  headId: string;
  booking: Booking;
  clients: Client[];
  leadName: string;
  members: number;
  totalAmount: number;
  received: number;
  pending: number;
}

export interface GroupStats {
  group: PurchaseGroup;
  supplier?: Supplier;
  heads: GroupHeadSummary[];
  purchases: LedgerEntry[];
  payments: LedgerEntry[];
  groupExpenses: LedgerEntry[];
  receipts: LedgerEntry[];
  /** Pax already consumed — CLIENT members only (never supplier purchase pax) */
  usedPax: number;
  /** Pax the supplier has invoiced us for (from purchase entries) — informational only */
  billedPax: number;
  capacity: number;
  remainingPax: number;
  /** Sales booked to this group */
  revenue: number;
  received: number;
  refunds: number;
  pendingReceivable: number;
  /** Supplier bill for this group */
  supplierBill: number;
  supplierPaid: number;
  supplierOutstanding: number;
  commission: number;
  expenses: number;
  netProfit: number;
  margin: number;
  /** Supplier bill grouped by service category */
  billByCategory: { category: string; count: number; amount: number }[];
}

export function computeGroupStats(
  group: PurchaseGroup,
  data: { bookings: Booking[]; clients: Client[]; entries: LedgerEntry[]; suppliers: Supplier[] }
): GroupStats {
  const linkedBookings = data.bookings.filter((b) => b.groupId === group.id);
  const headIds = new Set(linkedBookings.map((b) => b.headId));

  const heads: GroupHeadSummary[] = linkedBookings.map((b) => {
    const cl = data.clients.filter((c) => c.headId === b.headId);
    const lead = cl[0];
    return {
      headId: b.headId,
      booking: b,
      clients: cl,
      leadName: lead ? `${lead.firstName} ${lead.lastName}`.trim() : "—",
      members: b.members || cl.length,
      totalAmount: b.totalAmount || 0,
      received: b.amountReceived || 0,
      pending: Math.max(0, (b.totalAmount || 0) - (b.amountReceived || 0)),
    };
  });

  const tagged = data.entries.filter((e) => e.groupId === group.id);
  const purchases = tagged.filter((e) => e.type === "purchase");
  const payments = tagged.filter((e) => e.type === "supplier_payment");
  const groupExpenses = tagged.filter((e) => e.type === "expense");
  const supplierRefunds = tagged.filter((e) => e.type === "supplier_refund");
  const receipts = data.entries.filter((e) => e.type === "client_receive" && headIds.has(e.headId));

  const billedPax = purchases.reduce((s, e) => {
    const d = e.purchaseDetails || {};
    return s + (d.adults || 0) + (d.children || 0) + (d.infants || 0);
  }, 0);
  // Seats are consumed by CLIENTS only. Supplier bills / expenses never consume capacity.
  const usedPax = heads.reduce((s, h) => s + (h.clients.length || h.members || 0), 0);
  const capacity = group.totalPax || 0;

  const revenue = heads.reduce((s, h) => s + h.totalAmount, 0);
  const received = heads.reduce((s, h) => s + h.received, 0);
  const refunds = data.entries
    .filter((e) => e.type === "client_refund" && headIds.has(e.headId))
    .reduce((s, e) => s + e.amount, 0);
  const supplierBill = Math.max(0, purchases.reduce((s, e) => s + e.amount, 0) - supplierRefunds.reduce((s, e) => s + e.amount, 0));
  const supplierPaid = payments.reduce((s, e) => s + e.amount, 0);
  const commission = linkedBookings.reduce((s, b) => s + (b.commission || 0), 0);
  const expenses = groupExpenses.reduce((s, e) => s + e.amount, 0);
  const netProfit = revenue - supplierBill - commission - expenses;

  const catMap = new Map<string, { count: number; amount: number }>();
  for (const p of purchases) {
    const key = p.serviceCategory || "Other";
    const cur = catMap.get(key) || { count: 0, amount: 0 };
    catMap.set(key, { count: cur.count + 1, amount: cur.amount + p.amount });
  }

  return {
    group,
    supplier: data.suppliers.find((s) => s.id === group.supplierId),
    heads, purchases, payments, groupExpenses, receipts,
    usedPax, billedPax, capacity, remainingPax: Math.max(0, capacity - usedPax),
    revenue, received, refunds, pendingReceivable: Math.max(0, revenue - received),
    supplierBill, supplierPaid, supplierOutstanding: supplierBill - supplierPaid,
    commission, expenses, netProfit,
    margin: revenue > 0 ? (netProfit / revenue) * 100 : 0,
    billByCategory: Array.from(catMap.entries())
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.amount - a.amount),
  };
}