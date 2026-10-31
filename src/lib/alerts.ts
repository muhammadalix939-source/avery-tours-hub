// Notification rules engine — derives live alerts from CRM state (no polling, no refresh).
import type { Account, AlertSettings, LedgerEntry } from "./store";
import { computeAccountBalance, entryDirection } from "./store";
import type { Agent, Booking, Client, Supplier } from "./data";
import { formatCurrency } from "./data";

export type AlertSeverity = "info" | "urgent";
export type AlertKind = "payment_due" | "low_balance" | "reconciliation" | "agent_balance" | "audit";

export interface SystemAlert {
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  message: string;
  timestamp: string;
  /** Where clicking the alert should take the user. */
  href: string;
}

function daysSince(date: string): number {
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.floor((Date.now() - t) / 86400000);
}

export function buildAlerts(data: {
  clients: Client[];
  bookings: Booking[];
  agents: Agent[];
  suppliers: Supplier[];
  entries: LedgerEntry[];
  accounts: Account[];
  settings: AlertSettings;
}): SystemAlert[] {
  const { clients, bookings, agents, suppliers, entries, accounts, settings } = data;
  const out: SystemAlert[] = [];

  // 1. Client balance overdue past travel/due date
  bookings.forEach((b) => {
    const due = Math.max(0, (b.totalAmount || 0) - (b.amountReceived || 0));
    if (due <= 0) return;
    const overdue = daysSince(b.travelDate) > -settings.clientOverdueDays;
    if (!overdue) return;
    const lead = clients.find((c) => c.headId === b.headId);
    const name = lead ? `${lead.firstName} ${lead.lastName}`.trim() : b.headId;
    out.push({
      id: `due-${b.id}`, kind: "payment_due", severity: "urgent",
      message: `${name} — ${formatCurrency(due)} outstanding for travel on ${b.travelDate}`,
      timestamp: b.travelDate, href: "/clients",
    });
  });

  // 2. Account balance below threshold
  accounts.forEach((a) => {
    const bal = computeAccountBalance(a.id);
    if (bal >= settings.lowBalance) return;
    out.push({
      id: `low-${a.id}`, kind: "low_balance", severity: "urgent",
      message: `${a.name} balance is ${formatCurrency(bal)} — below ${formatCurrency(settings.lowBalance)}`,
      timestamp: new Date().toISOString().slice(0, 10), href: "/accounts",
    });
  });

  // 3. Supplier purchases left unmatched for N+ days
  suppliers.forEach((s) => {
    const stale = entries.filter(
      (e) => e.type === "purchase" && e.referenceId === s.id && e.reconciled !== "matched" && daysSince(e.date) >= settings.unmatchedDays,
    );
    if (!stale.length) return;
    out.push({
      id: `recon-${s.id}-${stale.length}`, kind: "reconciliation", severity: "info",
      message: `${stale.length} unmatched ${stale.length === 1 ? "entry" : "entries"} — ${s.companyName} supplier ledger`,
      timestamp: stale[0].date, href: "/suppliers",
    });
  });

  // 4. Agent remaining due above limit
  agents.forEach((a) => {
    const netBalance = (a.openingSales || 0) + (a.totalSales || 0) - (a.commission || 0) - (a.openingCommission || 0);
    const paid = (a.openingPaidCommission || 0) + (a.paidCommission || 0);
    const remaining = netBalance - paid;
    if (remaining <= settings.agentDueLimit) return;
    out.push({
      id: `agent-${a.id}`, kind: "agent_balance", severity: "urgent",
      message: `Agent ${a.name} — ${formatCurrency(remaining)} remaining due`,
      timestamp: new Date().toISOString().slice(0, 10), href: "/agents",
    });
  });

  // 5. Correction / reversal entries posted (audit trail)
  entries
    .filter((e) => e.refundOf || /revers|correct/i.test(e.note || ""))
    .slice(-5)
    .forEach((e) => {
      out.push({
        id: `audit-${e.id}`, kind: "audit", severity: "info",
        message: `Correction posted on ${e.refundOf || e.id} — ${formatCurrency(e.amount)} ${entryDirection(e.type)}`,
        timestamp: e.date, href: "/entries",
      });
    });

  return out.sort((a, b) => (a.severity === b.severity ? (a.timestamp < b.timestamp ? 1 : -1) : a.severity === "urgent" ? -1 : 1));
}
