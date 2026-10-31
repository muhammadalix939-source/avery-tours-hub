import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useMemo, useState, useEffect } from "react";
import { DollarSign, TrendingUp, Wallet, Receipt, Users, BookOpen, Percent, PiggyBank, Activity, Award } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { formatCurrency } from "@/lib/data";
import { useStore } from "@/lib/store";
import { computeTotals, profitByPackage, monthlyTrend, expenseBreakdown, topProfitableBookings } from "@/lib/reports";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/reports")({
  component: ReportsPage,
  head: () => ({
    meta: [
      { title: "Financial Reports — AV Travel CRM" },
      { name: "description", content: "Professional financial analytics, profitability and cash flow reports." },
    ],
  }),
});

const COLORS = ["oklch(0.8 0.12 80)", "oklch(0.7 0.15 155)", "oklch(0.6 0.15 280)", "oklch(0.7 0.18 30)", "oklch(0.65 0.13 200)", "oklch(0.75 0.14 320)", "oklch(0.7 0.12 100)"];

interface DrillRow { label: string; sub?: string; date?: string; amount: number; }
interface Drill { title: string; rows: DrillRow[]; total: number; }

function KpiCard({ title, value, sub, icon: Icon, accent, onClick, delay = 0 }: { title: string; value: string; sub?: string; icon: LucideIcon; accent?: string; onClick?: () => void; delay?: number; }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ y: -2 }}
      className="glass-card glass-card-hover w-full rounded-xl p-5 text-left transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className={`text-2xl font-bold ${accent || "gold-text"}`}>{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
    </motion.button>
  );
}

function ReportsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const store = useStore();
  const [drill, setDrill] = useState<Drill | null>(null);
  const [pkgFilter, setPkgFilter] = useState<string>("All");
  const [agentFilter, setAgentFilter] = useState<string>("All");

  const filteredBookings = useMemo(() => store.bookings.filter(b =>
    (pkgFilter === "All" || b.packageType === pkgFilter) &&
    (agentFilter === "All" || b.agentId === agentFilter)
  ), [store.bookings, pkgFilter, agentFilter]);

  const headFilter = useMemo(() => new Set(filteredBookings.map(b => b.headId)), [filteredBookings]);
  const filteredEntries = useMemo(() => {
    if (pkgFilter === "All" && agentFilter === "All") return store.entries;
    return store.entries.filter(e => !e.headId || headFilter.has(e.headId));
  }, [store.entries, headFilter, pkgFilter, agentFilter]);

  const input = useMemo(() => ({
    bookings: filteredBookings,
    clients: store.clients,
    agents: store.agents,
    suppliers: store.suppliers,
    entries: filteredEntries,
    opening: store.opening,
  }), [filteredBookings, store.clients, store.agents, store.suppliers, filteredEntries, store.opening]);
  const t = useMemo(() => computeTotals(input), [input]);
  const byPkg = useMemo(() => profitByPackage(input), [input]);
  const trend = useMemo(() => monthlyTrend(input), [input]);
  const expCats = useMemo(() => expenseBreakdown(input), [input]);
  const topBookings = useMemo(() => topProfitableBookings(input, 5), [input]);

  const openDrill = (title: string, rows: DrillRow[]) =>
    setDrill({ title, rows, total: rows.reduce((s, r) => s + r.amount, 0) });

  const drillRevenue = () => openDrill("Total Revenue — Client Receipts",
    filteredEntries.filter(e => e.type === "client_receive")
      .map(e => ({ label: e.referenceName, sub: e.headId, date: e.date, amount: e.amount })));
  const drillCost = () => openDrill("Total Cost — Purchases & Booking Costs", [
    ...filteredEntries.filter(e => e.type === "purchase").map(e => ({ label: e.referenceName + (e.serviceCategory ? ` · ${e.serviceCategory}` : ""), sub: e.headId, date: e.date, amount: e.amount })),
    ...filteredBookings.filter(b => !filteredEntries.some(e => e.type === "purchase" && e.headId === b.headId)).map(b => ({ label: `Booking ${b.headId}`, sub: b.packageType, date: b.createdAt, amount: b.totalCost || 0 })),
  ]);
  const drillExpenses = () => openDrill("Expenses",
    filteredEntries.filter(e => e.type === "expense").map(e => ({ label: e.referenceName, sub: e.note, date: e.date, amount: e.amount })));
  const drillSupplierPaid = () => openDrill("Supplier Payments",
    filteredEntries.filter(e => e.type === "supplier_payment").map(e => ({ label: e.referenceName, sub: e.note, date: e.date, amount: e.amount })));
  const drillCommissionPaid = () => openDrill("Commissions Paid",
    filteredEntries.filter(e => e.type === "agent_commission").map(e => ({ label: e.referenceName, sub: e.note, date: e.date, amount: e.amount })));
  const drillCommissionEarned = () => openDrill("Commissions Earned (per Booking)",
    filteredBookings.filter(b => (b.commission || 0) > 0).map(b => ({ label: `Booking ${b.headId}`, sub: b.packageType, date: b.createdAt, amount: b.commission || 0 })));
  const drillPending = () => openDrill("Pending Receivables",
    filteredBookings.filter(b => (b.totalAmount - b.amountReceived) > 0).map(b => ({ label: `Booking ${b.headId}`, sub: `${b.packageType} · received ${formatCurrency(b.amountReceived)}`, date: b.createdAt, amount: b.totalAmount - b.amountReceived })));
  const drillSupplierPayable = () => openDrill("Supplier Payable",
    store.suppliers.map(s => {
      const payable = (s.totalPayable + (s.openingPayable || 0)) - (s.totalPaid + (s.openingPaid || 0));
      return { label: s.companyName, sub: s.serviceType, amount: Math.max(0, payable) };
    }).filter(r => r.amount > 0));

  const hasData = store.bookings.length > 0 || store.entries.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Financial Reports" subtitle="Executive analytics, profitability & cash flow — click any card for details" />

      {/* Filters */}
      <div className="glass-card flex flex-wrap items-center gap-3 rounded-xl p-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filters</span>
        <select value={pkgFilter} onChange={(e) => setPkgFilter(e.target.value)} className="rounded-md border border-border bg-background px-3 py-1.5 text-sm">
          <option value="All">All Packages</option>
          {Array.from(new Set(store.bookings.map(b => b.packageType))).map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} className="rounded-md border border-border bg-background px-3 py-1.5 text-sm">
          <option value="All">All Agents</option>
          {store.agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        {(pkgFilter !== "All" || agentFilter !== "All") && (
          <button onClick={() => { setPkgFilter("All"); setAgentFilter("All"); }} className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent">Reset</button>
        )}
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <KpiCard title="Total Revenue" value={formatCurrency(t.totalRevenue)} sub="Client receipts + opening" icon={DollarSign} onClick={drillRevenue} delay={0.00} />
        <KpiCard title="Total Cost" value={formatCurrency(t.totalCost)} sub="Purchases + booking cost" icon={TrendingUp} onClick={drillCost} delay={0.03} />
        <KpiCard title="Gross Profit" value={formatCurrency(t.grossProfit)} sub="Revenue − Cost" icon={PiggyBank} accent={t.grossProfit >= 0 ? "text-success" : "text-destructive"} delay={0.06} />
        <KpiCard title="Net Profit" value={formatCurrency(t.netProfit)} sub="After expenses & commission" icon={Award} accent={t.netProfit >= 0 ? "text-success" : "text-destructive"} delay={0.09} />
        <KpiCard title="Profit Margin" value={`${t.margin.toFixed(2)}%`} sub="Net Profit / Revenue" icon={Percent} accent={t.margin >= 0 ? "text-success" : "text-destructive"} delay={0.12} />
        <KpiCard title="Cash on Hand" value={formatCurrency(t.cashOnHand)} sub="Net liquidity" icon={Wallet} delay={0.15} />
        <KpiCard title="Pending Receivables" value={formatCurrency(t.pending)} sub="Click to view bookings" icon={Activity} onClick={drillPending} delay={0.18} />
        <KpiCard title="Supplier Payable" value={formatCurrency(t.supplierPayable)} sub="Outstanding to suppliers" icon={Users} onClick={drillSupplierPayable} delay={0.21} />
        <KpiCard title="Expenses" value={formatCurrency(t.expenses)} sub="Operating expenses" icon={Receipt} onClick={drillExpenses} delay={0.24} />
        <KpiCard title="Commission Earned" value={formatCurrency(t.commissionEarned)} sub="Across all bookings" icon={Award} onClick={drillCommissionEarned} delay={0.27} />
        <KpiCard title="Commission Paid" value={formatCurrency(t.commissionPaid)} sub="Outflow to agents" icon={Wallet} onClick={drillCommissionPaid} delay={0.30} />
        <KpiCard title="Supplier Paid" value={formatCurrency(t.supplierPaid)} sub="Outflow to suppliers" icon={Wallet} onClick={drillSupplierPaid} delay={0.33} />
      </div>

      {/* Profitability KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Avg Profit / Booking" value={formatCurrency(t.avgProfitPerBooking)} icon={BookOpen} delay={0} />
        <KpiCard title="Avg Ticket Size" value={formatCurrency(t.avgTicketSize)} sub="Per booking" icon={DollarSign} delay={0.05} />
        <KpiCard title="Avg Revenue / Client" value={formatCurrency(t.avgRevenuePerClient)} icon={Users} delay={0.1} />
        <KpiCard title="Collection Efficiency" value={`${t.collectionEfficiency.toFixed(1)}%`} sub="Received / Booked" icon={Percent} delay={0.15} />
      </div>

      {/* Profit by Package */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5">
        <h3 className="mb-4 text-sm font-semibold">Profit Breakdown by Package Type</h3>
        {byPkg.length === 0 ? <p className="text-xs text-muted-foreground">No bookings yet.</p> : (
          <>
            {mounted ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={byPkg}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.01 260)" />
                  <XAxis dataKey="packageType" stroke="oklch(0.6 0.02 260)" fontSize={11} />
                  <YAxis stroke="oklch(0.6 0.02 260)" fontSize={11} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: "oklch(0.17 0.01 260)", border: "1px solid oklch(0.28 0.01 260)", borderRadius: 8 }} formatter={(v: any) => formatCurrency(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="revenue" fill="oklch(0.8 0.12 80)" name="Revenue" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cost" fill="oklch(0.6 0.15 280)" name="Cost" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profit" fill="oklch(0.7 0.15 155)" name="Profit" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] w-full rounded-lg bg-accent/10 animate-pulse flex items-center justify-center text-xs text-muted-foreground">Loading chart...</div>
            )}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <th className="px-3 py-2">Package</th><th className="px-3 py-2">Bookings</th>
                    <th className="px-3 py-2">Revenue</th><th className="px-3 py-2">Cost</th>
                    <th className="px-3 py-2">Profit</th><th className="px-3 py-2">Margin</th>
                    <th className="px-3 py-2">Avg Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {byPkg.map((r) => (
                    <tr key={r.packageType} className="border-b border-border/50 hover:bg-accent/30">
                      <td className="px-3 py-2 font-medium">{r.packageType}</td>
                      <td className="px-3 py-2">{r.bookings}</td>
                      <td className="px-3 py-2 text-primary">{formatCurrency(r.revenue)}</td>
                      <td className="px-3 py-2">{formatCurrency(r.cost)}</td>
                      <td className={`px-3 py-2 ${r.profit >= 0 ? "text-success" : "text-destructive"}`}>{formatCurrency(r.profit)}</td>
                      <td className="px-3 py-2">{r.margin.toFixed(1)}%</td>
                      <td className="px-3 py-2">{formatCurrency(r.avgProfit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </motion.div>

      {/* Monthly Trend */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5">
        <h3 className="mb-4 text-sm font-semibold">Monthly Performance Trend</h3>
        {trend.length === 0 ? <p className="text-xs text-muted-foreground">No transactions yet.</p> : mounted ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.01 260)" />
              <XAxis dataKey="month" stroke="oklch(0.6 0.02 260)" fontSize={11} />
              <YAxis stroke="oklch(0.6 0.02 260)" fontSize={11} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: "oklch(0.17 0.01 260)", border: "1px solid oklch(0.28 0.01 260)", borderRadius: 8 }} formatter={(v: any) => formatCurrency(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="revenue" stroke="oklch(0.8 0.12 80)" strokeWidth={2} dot={false} name="Revenue" />
              <Line type="monotone" dataKey="cost" stroke="oklch(0.6 0.15 280)" strokeWidth={2} dot={false} name="Cost" />
              <Line type="monotone" dataKey="profit" stroke="oklch(0.7 0.15 155)" strokeWidth={2} dot={false} name="Profit" />
              <Line type="monotone" dataKey="expenses" stroke="oklch(0.7 0.18 30)" strokeWidth={2} dot={false} name="Expenses" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[280px] w-full rounded-lg bg-accent/10 animate-pulse flex items-center justify-center text-xs text-muted-foreground">Loading trend...</div>
        )}
      </motion.div>

      {/* Cash Flow + Expense Breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5">
          <h3 className="mb-1 text-sm font-semibold">Cash Flow Statement</h3>
          <p className="mb-3 text-[11px] text-muted-foreground">Real money movement only — unpaid purchases are excluded (they sit in Supplier Payable).</p>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-border/50"><td className="px-2 py-2">Opening Cash / Bank</td><td className="px-2 py-2 text-right">{formatCurrency(t.openingCash)}</td></tr>
              <tr className="border-b border-border"><td className="px-2 py-2 font-semibold text-success" colSpan={2}>Inflows</td></tr>
              <tr className="border-b border-border/50"><td className="px-2 py-2">Client Receipts (gross)</td><td className="px-2 py-2 text-right">{formatCurrency(t.liveReceived + t.clientRefunds)}</td></tr>
              <tr className="border-b border-border/50"><td className="px-2 py-2">Less: Refunds to Clients</td><td className="px-2 py-2 text-right text-destructive">− {formatCurrency(t.clientRefunds)}</td></tr>
              <tr className="border-b border-border"><td className="px-2 py-2 font-semibold">Net Cash Received</td><td className="px-2 py-2 text-right font-semibold text-success">{formatCurrency(t.liveReceived)}</td></tr>
              <tr className="border-b border-border"><td className="px-2 py-2 font-semibold text-destructive" colSpan={2}>Outflows</td></tr>
              <tr className="border-b border-border/50"><td className="px-2 py-2">Supplier Payments</td><td className="px-2 py-2 text-right">{formatCurrency(t.supplierPaid)}</td></tr>
              <tr className="border-b border-border/50"><td className="px-2 py-2">Expenses (live)</td><td className="px-2 py-2 text-right">{formatCurrency(t.expenses - t.openingExpenses)}</td></tr>
              <tr className="border-b border-border/50"><td className="px-2 py-2">Commission Paid</td><td className="px-2 py-2 text-right">{formatCurrency(t.commissionPaid)}</td></tr>
              <tr className="border-b border-border"><td className="px-2 py-2 font-semibold">Total Outflows</td><td className="px-2 py-2 text-right font-semibold text-destructive">{formatCurrency(t.supplierPaid + (t.expenses - t.openingExpenses) + t.commissionPaid)}</td></tr>
              <tr><td className="px-2 py-3 text-base font-bold">Closing Cash on Hand</td><td className={`px-2 py-3 text-right text-base font-bold ${t.cashOnHand >= 0 ? "text-success" : "text-destructive"}`}>{formatCurrency(t.cashOnHand)}</td></tr>
            </tbody>
          </table>
          <div className="mt-4 rounded-lg border border-border/60 bg-accent/10 p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-primary">Profit Reconciliation</p>
            <table className="w-full text-xs">
              <tbody>
                <tr><td className="py-1">Revenue (live {formatCurrency(t.liveReceived)} + B/F {formatCurrency(t.openingRevenue)})</td><td className="py-1 text-right">{formatCurrency(t.totalRevenue)}</td></tr>
                <tr><td className="py-1">− Cost of Sales (live {formatCurrency(t.totalCost - t.openingCost)} + B/F {formatCurrency(t.openingCost)})</td><td className="py-1 text-right">{formatCurrency(t.totalCost)}</td></tr>
                <tr className="border-t border-border/50"><td className="py-1 font-semibold">= Gross Profit</td><td className={`py-1 text-right font-semibold ${t.grossProfit >= 0 ? "text-success" : "text-destructive"}`}>{formatCurrency(t.grossProfit)}</td></tr>
                <tr><td className="py-1">− Expenses (incl. B/F {formatCurrency(t.openingExpenses)})</td><td className="py-1 text-right">{formatCurrency(t.expenses)}</td></tr>
                <tr><td className="py-1">− Agent Commission earned (incl. B/F {formatCurrency(t.openingCommission)})</td><td className="py-1 text-right">{formatCurrency(t.commissionEarned)}</td></tr>
                {t.openingProfit !== 0 && <tr><td className="py-1">+ Manual profit adjustment</td><td className="py-1 text-right">{formatCurrency(t.openingProfit)}</td></tr>}
                <tr className="border-t border-border"><td className="py-1.5 text-sm font-bold">= Net Profit</td><td className={`py-1.5 text-right text-sm font-bold ${t.netProfit >= 0 ? "text-success" : "text-destructive"}`}>{formatCurrency(t.netProfit)}</td></tr>
              </tbody>
            </table>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5">
          <h3 className="mb-4 text-sm font-semibold">Expense Breakdown</h3>
          {expCats.length === 0 ? <p className="text-xs text-muted-foreground">No expenses recorded.</p> : (
            <>
              {mounted ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={expCats} dataKey="amount" nameKey="category" cx="50%" cy="50%" innerRadius={45} outerRadius={75} stroke="none">
                      {expCats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "oklch(0.17 0.01 260)", border: "1px solid oklch(0.28 0.01 260)", borderRadius: 8 }} formatter={(v: any) => formatCurrency(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] w-full rounded-lg bg-accent/10 animate-pulse flex items-center justify-center text-xs text-muted-foreground">Loading chart...</div>
              )}
              <table className="mt-3 w-full text-sm">
                <tbody>
                  {expCats.map((r, i) => (
                    <tr key={r.category} className="border-b border-border/50">
                      <td className="px-2 py-2"><span className="mr-2 inline-block h-2 w-2 rounded-full align-middle" style={{ background: COLORS[i % COLORS.length] }} />{r.category}</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(r.amount)}</td>
                      <td className="px-2 py-2 text-right text-xs text-muted-foreground">{r.pct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </motion.div>
      </div>

      {/* Agent Performance & Supplier Spend */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5">
          <h3 className="mb-4 text-sm font-semibold">Agent Performance</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="px-2 py-2">Agent</th><th className="px-2 py-2">Sales</th><th className="px-2 py-2">Earned</th><th className="px-2 py-2">Paid</th><th className="px-2 py-2">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {store.agents.length === 0 && <tr><td colSpan={5} className="px-2 py-3 text-xs text-muted-foreground">No agents.</td></tr>}
              {store.agents.map(a => {
                const sales = a.totalSales + (a.openingSales || 0);
                const earned = a.commission + (a.openingCommission || 0);
                const paid = a.paidCommission + (a.openingPaidCommission || 0);
                return (
                  <tr key={a.id} className="border-b border-border/50 hover:bg-accent/30">
                    <td className="px-2 py-2 font-medium">{a.name}</td>
                    <td className="px-2 py-2 text-primary">{formatCurrency(sales)}</td>
                    <td className="px-2 py-2">{formatCurrency(earned)}</td>
                    <td className="px-2 py-2 text-success">{formatCurrency(paid)}</td>
                    <td className="px-2 py-2 text-destructive">{formatCurrency(Math.max(0, earned - paid))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5">
          <h3 className="mb-4 text-sm font-semibold">Supplier Spend</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="px-2 py-2">Supplier</th><th className="px-2 py-2">Payable</th><th className="px-2 py-2">Paid</th><th className="px-2 py-2">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {store.suppliers.length === 0 && <tr><td colSpan={4} className="px-2 py-3 text-xs text-muted-foreground">No suppliers.</td></tr>}
              {store.suppliers.map(s => {
                const payable = s.totalPayable + (s.openingPayable || 0);
                const paid = s.totalPaid + (s.openingPaid || 0);
                return (
                  <tr key={s.id} className="border-b border-border/50 hover:bg-accent/30">
                    <td className="px-2 py-2 font-medium">{s.companyName}</td>
                    <td className="px-2 py-2">{formatCurrency(payable)}</td>
                    <td className="px-2 py-2 text-success">{formatCurrency(paid)}</td>
                    <td className="px-2 py-2 text-destructive">{formatCurrency(Math.max(0, payable - paid))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </motion.div>
      </div>

      {/* Top Profitable Bookings */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5">
        <h3 className="mb-4 text-sm font-semibold">Top 5 Most Profitable Bookings</h3>
        {topBookings.length === 0 ? <p className="text-xs text-muted-foreground">No bookings yet.</p> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="px-2 py-2">Head ID</th><th className="px-2 py-2">Package</th><th className="px-2 py-2">Revenue</th><th className="px-2 py-2">Cost</th><th className="px-2 py-2">Profit</th>
              </tr>
            </thead>
            <tbody>
              {topBookings.map(b => (
                <tr key={b.id} className="border-b border-border/50 hover:bg-accent/30">
                  <td className="px-2 py-2 font-medium">{b.headId}</td>
                  <td className="px-2 py-2">{b.packageType}</td>
                  <td className="px-2 py-2 text-primary">{formatCurrency(b.totalAmount)}</td>
                  <td className="px-2 py-2">{formatCurrency(b._cost)}</td>
                  <td className={`px-2 py-2 ${b._profit >= 0 ? "text-success" : "text-destructive"}`}>{formatCurrency(b._profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </motion.div>

      {!hasData && (
        <div className="glass-card rounded-xl p-10 text-center">
          <p className="text-sm text-muted-foreground">No data yet. Add bookings or entries to see live financial reports.</p>
        </div>
      )}

      {/* Drill-down Dialog */}
      <Dialog open={!!drill} onOpenChange={(o) => !o && setDrill(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{drill?.title}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {drill && drill.rows.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No records.</p>}
            {drill && drill.rows.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <th className="px-2 py-2">Date</th><th className="px-2 py-2">Reference</th><th className="px-2 py-2">Detail</th><th className="px-2 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {drill.rows.map((r, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="px-2 py-2 text-xs text-muted-foreground">{r.date || "—"}</td>
                      <td className="px-2 py-2 font-medium">{r.label}</td>
                      <td className="px-2 py-2 text-xs text-muted-foreground">{r.sub || "—"}</td>
                      <td className="px-2 py-2 text-right text-primary">{formatCurrency(r.amount)}</td>
                    </tr>
                  ))}
                  <tr className="bg-accent/30">
                    <td colSpan={3} className="px-2 py-3 font-semibold">Total</td>
                    <td className="px-2 py-3 text-right font-bold gold-text">{formatCurrency(drill.total)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
