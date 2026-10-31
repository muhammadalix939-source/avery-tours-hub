// Head / Group business economics — single source of truth for the Head Business View card.
import type { Booking, Client } from "./data";
import type { LedgerEntry } from "./store";

export interface HeadBusinessMember {
  id: string;
  name: string;
  ageCategory?: string;
  amount: number;
  received: number;
  pending: number;
  status: "Paid" | "Partial" | "Unpaid";
}

export interface HeadBusiness {
  headId: string;
  leadName: string;
  members: number;
  perPerson: number;
  otherCosts: number;
  totalSale: number;
  refunds: number;
  netReceivable: number;
  totalPurchase: number;
  commission: number;
  netProfit: number;
  received: number;
  outstanding: number;
  supplierPaid: number;
  supplierRemaining: number;
  memberList: HeadBusinessMember[];
  linked: LedgerEntry[];
}

/** Flat, disclosed amounts only — no interest, no compounding. */
export function computeHeadBusiness(
  headId: string,
  clients: Client[],
  bookings: Booking[],
  entries: LedgerEntry[],
): HeadBusiness {
  const members = clients.filter((c) => c.headId === headId);
  const booking = bookings.find((b) => b.headId === headId);
  const linked = entries.filter((e) => e.headId === headId);

  const otherCosts = linked.filter((e) => e.type === "client_charge").reduce((s, e) => s + e.amount, 0);
  const base = booking?.baseAmount ?? booking?.totalAmount ?? members.reduce((s, c) => s + (c.baseDue ?? c.amountDue), 0);
  const perPerson = members.length ? Math.round(base / members.length) : base;
  const totalSale = perPerson * (members.length || 1) + otherCosts;
  const refunds = linked.filter((e) => e.type === "client_refund").reduce((s, e) => s + e.amount, 0);
  const netReceivable = totalSale - refunds;
  const purchaseEntries = linked.filter((e) => e.type === "purchase");
  const supplierRefunds = linked.filter((e) => e.type === "supplier_refund").reduce((s, e) => s + e.amount, 0);
  const totalPurchase = Math.max(purchaseEntries.reduce((s, e) => s + e.amount, 0), booking?.totalCost || 0) - supplierRefunds;
  const commission = booking?.commission || 0;
  const received = linked.filter((e) => e.type === "client_receive").reduce((s, e) => s + e.amount, 0);

  // ---- Supplier Paid / Remaining for THIS head's purchases only ----
  // 1) Payments explicitly tagged to this head (Head ID field on a Supplier Payment entry).
  const directSupplierPaid = linked.filter((e) => e.type === "supplier_payment").reduce((s, e) => s + e.amount, 0);
  // 2) This head may share a PNR / batch Group with other heads. Any payment made against
  //    that group WITHOUT a specific head tag is prorated by this head's share of the group's bill.
  const groupIds = new Set(purchaseEntries.map((e) => e.groupId).filter(Boolean) as string[]);
  let proratedSupplierPaid = 0;
  groupIds.forEach((gid) => {
    const groupBill = entries.filter((e) => e.type === "purchase" && e.groupId === gid).reduce((s, e) => s + e.amount, 0);
    const groupUntaggedPaid = entries.filter((e) => e.type === "supplier_payment" && e.groupId === gid && !e.headId).reduce((s, e) => s + e.amount, 0);
    const thisHeadShare = purchaseEntries.filter((e) => e.groupId === gid).reduce((s, e) => s + e.amount, 0);
    if (groupBill > 0) proratedSupplierPaid += groupUntaggedPaid * (thisHeadShare / groupBill);
  });
  const supplierPaid = Math.round(directSupplierPaid + proratedSupplierPaid);
  const supplierRemaining = Math.max(0, Math.round(totalPurchase - supplierPaid));

  // ---- Per-member (Members View) breakdown ----
  // Client.amountDue / amountPaid / paymentStatus are already the resynced source of truth
  // (kept in sync by the store from client_receive / client_charge / client_refund entries,
  // including any Shared Cost Allocation posted from a Purchase entry). We simply expose them.
  const memberList: HeadBusinessMember[] = members.map((c) => ({
    id: c.id,
    name: `${c.firstName} ${c.lastName}`.trim(),
    ageCategory: c.ageCategory,
    amount: c.amountDue,
    received: c.amountPaid,
    pending: Math.max(0, c.amountDue - c.amountPaid),
    status: c.paymentStatus,
  }));

  const lead = members[0];
  return {
    headId,
    leadName: lead ? `${lead.firstName} ${lead.lastName}`.trim() : headId,
    members: members.length,
    perPerson,
    otherCosts,
    totalSale,
    refunds,
    netReceivable,
    totalPurchase,
    commission,
    netProfit: netReceivable - totalPurchase - commission,
    received,
    outstanding: Math.max(0, netReceivable - received),
    supplierPaid,
    supplierRemaining,
    memberList,
    linked,
  };
}
