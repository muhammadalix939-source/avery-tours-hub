// Pure helpers for the Agent business ledger.
// Concept: an agent has TWO independent accounts —
//  1) Business account  : what his clients owe us  (Sale − Agent Commission = Net Receivable)
//  2) Commission account: what we owe him          (Commission Earned − Commission Paid)
import type { Agent, Booking, Client } from "./data";
import type { LedgerEntry } from "./store";

/** Entry types that belong to an agent's client-business ledger (never supplier / office costs). */
export const AGENT_BUSINESS_TYPES: LedgerEntry["type"][] = [
  "client_receive",
  "client_charge",
  "client_refund",
];

export interface AgentBusiness {
  bookings: Booking[];
  clients: Client[];
  headIds: Set<string>;
  /** Gross sale value booked through this agent (incl. extra charges, net of client refunds) */
  grossSales: number;
  /** Commission this agent earns on those bookings */
  commissionEarned: number;
  /** Commission already paid out */
  commissionPaid: number;
  commissionPayable: number;
  /** Sale − Commission = what actually has to reach us */
  netReceivable: number;
  /** Money already collected from these clients */
  received: number;
  /** netReceivable − received */
  outstanding: number;
  collectionPct: number;
  /** Ledger rows of the agent's client business (no purchases / expenses) */
  businessEntries: LedgerEntry[];
  /** Commission payout rows */
  commissionEntries: LedgerEntry[];
}

export function computeAgentBusiness(
  agent: Agent,
  data: { bookings: Booking[]; clients: Client[]; entries: LedgerEntry[] }
): AgentBusiness {
  const bookings = data.bookings.filter((b) => b.agentId === agent.id);
  const headIds = new Set(bookings.map((b) => b.headId));
  const clients = data.clients.filter((c) => headIds.has(c.headId));

  const otherSale = data.entries
    .filter((e) => (e.type === "purchase" && e.purchasedFor === "agent" && e.agentId === agent.id) || (e.type === "other_sale" && e.referenceId === agent.id))
    .reduce((s, e) => s + (e.type === "purchase" ? (e.saleAmount ?? e.amount) : e.amount), 0);
  const grossSales = bookings.reduce((s, b) => s + (b.totalAmount || 0), 0) + (agent.openingSales || 0) + otherSale;
  const commissionEarned = bookings.reduce((s, b) => s + (b.commission || 0), 0) + (agent.openingCommission || 0);
  const commissionPaid =
    data.entries.filter((e) => e.type === "agent_commission" && e.referenceId === agent.id).reduce((s, e) => s + e.amount, 0) +
    (agent.openingPaidCommission || 0);

  const businessEntries = data.entries
    .filter((e) => AGENT_BUSINESS_TYPES.includes(e.type) && e.headId && headIds.has(e.headId))
    .sort((a, b) => a.date.localeCompare(b.date));
  const commissionEntries = data.entries
    .filter((e) => e.type === "agent_commission" && e.referenceId === agent.id)
    .sort((a, b) => a.date.localeCompare(b.date));

  const received = bookings.reduce((s, b) => s + (b.amountReceived || 0), 0)
    + data.entries.filter((e) => e.type === "agent_receive" && e.referenceId === agent.id).reduce((s, e) => s + e.amount, 0);
  const netReceivable = Math.max(0, grossSales - commissionEarned);

  return {
    bookings, clients, headIds,
    grossSales, commissionEarned, commissionPaid,
    commissionPayable: commissionEarned - commissionPaid,
    netReceivable,
    received,
    outstanding: netReceivable - received,
    collectionPct: netReceivable > 0 ? (received / netReceivable) * 100 : 0,
    businessEntries, commissionEntries,
  };
}
