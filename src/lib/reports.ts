import type { Booking, Agent, Supplier, Client } from "./data";
import type { LedgerEntry, OpeningBalances } from "./store";

export interface ReportInput {
  bookings: Booking[];
  clients: Client[];
  agents: Agent[];
  suppliers: Supplier[];
  entries: LedgerEntry[];
  opening: OpeningBalances;
}

export interface FinancialTotals {
  totalRevenue: number;
  liveReceived: number;
  clientRefunds: number;
  supplierRefunds: number;
  bookedSales: number;
  totalCost: number;
  livePurchases: number;
  bookingCostFallback: number;
  expenses: number;
  commissionEarned: number;
  commissionPaid: number;
  supplierPaid: number;
  supplierPayable: number;
  pending: number;
  grossProfit: number;
  netProfit: number;
  margin: number;
  cashOnHand: number;
  /** Opening (brought-forward) components, kept visible so every total reconciles */
  openingRevenue: number;
  openingCost: number;
  openingExpenses: number;
  openingCommission: number;
  openingCash: number;
  openingProfit: number;
  collectionEfficiency: number;
  avgProfitPerBooking: number;
  avgRevenuePerClient: number;
  avgTicketSize: number;
}

export function computeTotals(input: ReportInput): FinancialTotals {
  const { bookings, clients, suppliers, entries, opening } = input;
  // ---------- Opening (brought-forward) baseline ----------
  const openingRevenue = opening.revenue || 0;
  const openingCost = opening.cost || 0;
  const openingExpenses = opening.expenses || 0;
  const openingCommission = opening.commission || 0;
  const openingCash = opening.cash || 0;
  const openingProfit = opening.profit || 0;

  // ---------- Live movement (ledger is the single source of truth) ----------
  const grossReceived = entries.filter(e => e.type === "client_receive" || e.type === "agent_receive").reduce((s, e) => s + e.amount, 0);
  const clientRefunds = entries.filter(e => e.type === "client_refund").reduce((s, e) => s + e.amount, 0);
  const supplierRefunds = entries.filter(e => e.type === "supplier_refund").reduce((s, e) => s + e.amount, 0);
  const liveReceived = Math.max(0, grossReceived - clientRefunds);
  const livePurchases = entries.filter(e => e.type === "purchase").reduce((s, e) => s + e.amount, 0);
  const supplierPaid = entries.filter(e => e.type === "supplier_payment").reduce((s, e) => s + e.amount, 0);
  const liveExpenses = entries.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0);
  const commissionPaid = entries.filter(e => e.type === "agent_commission").reduce((s, e) => s + e.amount, 0);
  const purchaseHeads = new Set(entries.filter(e => e.type === "purchase" && e.headId).map(e => e.headId));
  const bookingCostFallback = bookings.filter(b => !purchaseHeads.has(b.headId)).reduce((s, b) => s + (b.totalCost || 0), 0);
  const bookedSales = bookings.reduce((s, b) => s + b.totalAmount, 0);

  // ---------- Totals: EVERY total carries its own opening component ----------
  // Revenue  = live receipts (net of refunds) + opening revenue
  const totalRevenue = liveReceived + openingRevenue;
  // Cost of sales = live purchases (net of supplier refunds) or booking cost fallback + opening cost
  const totalCost = Math.max(0, livePurchases + bookingCostFallback - supplierRefunds) + openingCost;
  const expenses = liveExpenses + openingExpenses;
  const commissionEarned = bookings.reduce((s, b) => s + (b.commission || 0), 0) + openingCommission;
  const pending = Math.max(0, (bookedSales - bookings.reduce((s, b) => s + (b.amountReceived || 0), 0)) + (opening.pending || 0));
  const supplierPayable = suppliers.reduce((s, sp) => s + Math.max(0, (sp.totalPayable + (sp.openingPayable || 0)) - (sp.totalPaid + (sp.openingPaid || 0))), 0) + (opening.supplierDue || 0);
  // Gross profit = Revenue − Cost of sales   (both include their opening parts)
  const grossProfit = totalRevenue - totalCost;
  // Net profit = Gross − Expenses − Commission earned + manual profit adjustment
  const netProfit = grossProfit - expenses - commissionEarned + openingProfit;
  const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  // Cash is strictly actual money movement: opening cash + receipts − real payouts.
  // (Purchases that are not yet paid never touch cash; opening revenue is NOT cash unless it is in opening cash.)
  const drawings = entries.filter(e => e.type === "drawing").reduce((s, e) => s + e.amount, 0);
  const cashOnHand = openingCash + liveReceived - supplierPaid - liveExpenses - commissionPaid - drawings;
  const collectionEfficiency = bookedSales > 0 ? (liveReceived / bookedSales) * 100 : 0;
  const avgProfitPerBooking = bookings.length > 0 ? netProfit / bookings.length : 0;
  const avgRevenuePerClient = clients.length > 0 ? totalRevenue / clients.length : 0;
  const avgTicketSize = bookings.length > 0 ? bookedSales / bookings.length : 0;
  return {
    totalRevenue, liveReceived, clientRefunds, supplierRefunds, bookedSales, totalCost, livePurchases, bookingCostFallback,
    expenses, commissionEarned, commissionPaid, supplierPaid, supplierPayable, pending,
    grossProfit, netProfit, margin, cashOnHand, collectionEfficiency,
    openingRevenue, openingCost, openingExpenses, openingCommission, openingCash, openingProfit,
    avgProfitPerBooking, avgRevenuePerClient, avgTicketSize,
  };
}

export interface PackageRow {
  packageType: string;
  bookings: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  avgProfit: number;
}

export function profitByPackage(input: ReportInput): PackageRow[] {
  const { bookings, entries } = input;
  const map = new Map<string, PackageRow>();
  for (const b of bookings) {
    const key = b.packageType || "Other";
    const purchases = entries.filter(e => e.type === "purchase" && e.headId === b.headId).reduce((s, e) => s + e.amount, 0);
    const cost = purchases > 0 ? purchases : (b.totalCost || 0);
    const revenue = b.totalAmount || 0;
    const profit = revenue - cost - (b.commission || 0);
    const cur = map.get(key) || { packageType: key, bookings: 0, revenue: 0, cost: 0, profit: 0, margin: 0, avgProfit: 0 };
    cur.bookings += 1;
    cur.revenue += revenue;
    cur.cost += cost;
    cur.profit += profit;
    map.set(key, cur);
  }
  return Array.from(map.values()).map(r => ({
    ...r,
    margin: r.revenue > 0 ? (r.profit / r.revenue) * 100 : 0,
    avgProfit: r.bookings > 0 ? r.profit / r.bookings : 0,
  })).sort((a, b) => b.profit - a.profit);
}

export interface MonthRow { month: string; revenue: number; cost: number; profit: number; expenses: number; }

export function monthlyTrend(input: ReportInput): MonthRow[] {
  const { entries, bookings } = input;
  const map = new Map<string, MonthRow>();
  const ensure = (k: string) => {
    if (!map.has(k)) map.set(k, { month: k, revenue: 0, cost: 0, profit: 0, expenses: 0 });
    return map.get(k)!;
  };
  const monthOf = (d: string) => (d || "").slice(0, 7);
  for (const e of entries) {
    const m = monthOf(e.date);
    if (!m) continue;
    const row = ensure(m);
    if (e.type === "client_receive") row.revenue += e.amount;
    if (e.type === "purchase") row.cost += e.amount;
    if (e.type === "expense") row.expenses += e.amount;
  }
  // Booking cost fallback for heads w/o purchase entry
  const purchaseHeads = new Set(entries.filter(e => e.type === "purchase" && e.headId).map(e => e.headId));
  for (const b of bookings) {
    if (purchaseHeads.has(b.headId)) continue;
    const m = monthOf(b.createdAt || b.travelDate || "");
    if (!m) continue;
    ensure(m).cost += (b.totalCost || 0);
  }
  for (const r of map.values()) {
    r.profit = r.revenue - r.cost - r.expenses;
  }
  return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
}

export function expenseBreakdown(input: ReportInput): { category: string; amount: number; pct: number }[] {
  const expenses = input.entries.filter(e => e.type === "expense");
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const map = new Map<string, number>();
  for (const e of expenses) {
    const cat = e.referenceName || e.note || "Other";
    map.set(cat, (map.get(cat) || 0) + e.amount);
  }
  return Array.from(map.entries()).map(([category, amount]) => ({
    category, amount, pct: total > 0 ? (amount / total) * 100 : 0,
  })).sort((a, b) => b.amount - a.amount);
}

export function topProfitableBookings(input: ReportInput, n = 5) {
  const { bookings, entries } = input;
  return bookings.map(b => {
    const purchases = entries.filter(e => e.type === "purchase" && e.headId === b.headId).reduce((s, e) => s + e.amount, 0);
    const cost = purchases > 0 ? purchases : (b.totalCost || 0);
    const profit = (b.totalAmount || 0) - cost - (b.commission || 0);
    return { ...b, _cost: cost, _profit: profit };
  }).sort((a, b) => b._profit - a._profit).slice(0, n);
}
