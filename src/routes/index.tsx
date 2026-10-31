import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { DollarSign, Users, BookOpen, TrendingUp, Clock, Receipt } from "lucide-react";
import StatsCard from "@/components/StatsCard";
import StatusBadge from "@/components/StatusBadge";
import PageHeader from "@/components/PageHeader";
import NewEntryDialog from "@/components/NewEntryDialog";
import { formatCurrency } from "@/lib/data";
import { useStore } from "@/lib/store";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

export const Route = createFileRoute("/")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Dashboard — AV Travel CRM" },
      { name: "description", content: "Live overview of bookings, revenue, groups and dues for Avery Travel." },
      { property: "og:title", content: "Dashboard — Avery Travel CRM" },
      { property: "og:description", content: "Live overview of bookings, revenue, groups and dues for Avery Travel." },
    ],
  }),
});

const pieData = [
  { name: "Umrah", value: 45, color: "oklch(0.8 0.12 80)" },
  { name: "Hajj", value: 35, color: "oklch(0.7 0.15 155)" },
  { name: "Tour", value: 20, color: "oklch(0.6 0.15 280)" },
];

// Month order: current month first, then previous
const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function Dashboard() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const store = useStore();
  const o = store.opening;
  // Revenue = booking.amountReceived (authoritative for each head) + non-booking client_receive entries.
  const bookingHeadSet = new Set(store.bookings.map((b) => b.headId));
  const bookedReceived = store.bookings.reduce((s, b) => s + (b.amountReceived || 0), 0);
  const nonBookingReceived = store.entries
    .filter((e) => e.type === "client_receive" && !bookingHeadSet.has(e.headId))
    .reduce((s, e) => s + e.amount, 0);
  const liveClientReceived = bookedReceived + nonBookingReceived;
  const livePurchases = store.entries.filter((e) => e.type === "purchase").reduce((s, e) => s + e.amount, 0);
  const liveSupplierPaid = store.entries.filter((e) => e.type === "supplier_payment").reduce((s, e) => s + e.amount, 0);
  const liveExpenses = store.entries.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);
  const liveAgentCommissionPaid = store.entries.filter((e) => e.type === "agent_commission").reduce((s, e) => s + e.amount, 0);
  const clientRefunds = store.entries.filter((e) => e.type === "client_refund").reduce((s, e) => s + e.amount, 0);
  const supplierRefunds = store.entries.filter((e) => e.type === "supplier_refund").reduce((s, e) => s + e.amount, 0);
  const purchaseHeads = new Set(store.entries.filter((e) => e.type === "purchase" && e.headId).map((e) => e.headId));
  const bookingCostFallback = store.bookings.filter((b) => !purchaseHeads.has(b.headId)).reduce((s, b) => s + (b.totalCost || 0), 0);
  const totalBusinessCost = Math.max(0, livePurchases + bookingCostFallback - supplierRefunds);
  const agentCommissionEarned = store.bookings.reduce((s, b) => s + (b.commission || 0), 0);
  const bookedSales = store.bookings.reduce((s, b) => s + b.totalAmount, 0);
  const totalRevenue = liveClientReceived + (o.revenue || 0);
  const totalPending = Math.max(0, bookedSales + (o.pending || 0) - totalRevenue);
  const totalClients = store.clients.length + (o.clients || 0);
  const totalBookings = store.bookings.length + (o.bookings || 0);
  const supplierPayable = store.suppliers.reduce((s, sp) => s + Math.max(0, (sp.totalPayable + (sp.openingPayable || 0)) - (sp.totalPaid + (sp.openingPaid || 0))), 0) + (o.supplierDue || 0);
  const totalExpenses = liveExpenses;
  const profit = totalRevenue - totalBusinessCost - totalExpenses - agentCommissionEarned + (o.profit || 0);
  const cashOnHand = totalRevenue + supplierRefunds - liveSupplierPaid - totalExpenses - liveAgentCommissionPaid - clientRefunds;

  const hasAnyData =
    store.bookings.length > 0 || store.clients.length > 0 || store.entries.length > 0 ||
    store.agents.length > 0  || store.suppliers.length > 0;

  // Sort monthly data: current month first
  const currentMonthIdx = new Date().getMonth(); // 0-based (April = 3)
  const sortedMonthly = [...store.monthlyData].sort((a, b) => {
    const aIdx = monthOrder.indexOf(a.month);
    const bIdx = monthOrder.indexOf(b.month);
    // Distance from current month (closer = higher priority, current month first)
    const aDist = (currentMonthIdx - aIdx + 12) % 12;
    const bDist = (currentMonthIdx - bIdx + 12) % 12;
    return aDist - bDist;
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="Overview of your travel business" actions={<NewEntryDialog />} />

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatsCard title="Total Revenue" value={formatCurrency(totalRevenue)} icon={DollarSign} delay={0} />
        <StatsCard title="Pending" value={formatCurrency(totalPending)} icon={Clock} delay={0.05} />
        <StatsCard title="Active Bookings" value={String(totalBookings)} subtitle="Head IDs" icon={BookOpen} delay={0.1} />
        <StatsCard title="Total Clients" value={String(totalClients)} icon={Users} delay={0.15} />
        <StatsCard title="Supplier Due" value={formatCurrency(supplierPayable)} icon={TrendingUp} delay={0.2} />
        <StatsCard title="Expenses" value={formatCurrency(totalExpenses)} icon={Receipt} delay={0.25} />
      </div>

      {hasAnyData && (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card rounded-xl lg:col-span-2 p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Monthly Revenue</h3>
          {mounted ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={store.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.01 260)" />
                <XAxis dataKey="month" stroke="oklch(0.6 0.02 260)" fontSize={12} />
                <YAxis stroke="oklch(0.6 0.02 260)" fontSize={12} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "oklch(0.17 0.01 260)", border: "1px solid oklch(0.28 0.01 260)", borderRadius: "8px", color: "oklch(0.95 0.01 80)" }} />
                <Bar dataKey="revenue" fill="oklch(0.8 0.12 80)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" fill="oklch(0.7 0.15 155)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] w-full rounded-lg bg-accent/10 animate-pulse flex items-center justify-center text-xs text-muted-foreground">Loading chart...</div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass-card rounded-xl p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Package Distribution</h3>
          {mounted ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" stroke="none">
                {pieData.map((entry, index) => (<Cell key={index} fill={entry.color} />))}
              </Pie></PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] w-full rounded-lg bg-accent/10 animate-pulse flex items-center justify-center text-xs text-muted-foreground">Loading chart...</div>
          )}
          <div className="mt-2 flex justify-center gap-4">
            {pieData.map((entry) => (
              <div key={entry.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="h-2 w-2 rounded-full" style={{ background: entry.color }} />{entry.name} ({entry.value}%)
              </div>
            ))}
          </div>
        </motion.div>
      </div>
      )}

      {/* Monthly Records — current month first */}
      {hasAnyData && sortedMonthly.length > 0 && (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card rounded-xl p-5">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Monthly Records</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Month</th><th className="px-4 py-3">Clients</th><th className="px-4 py-3">Revenue</th><th className="px-4 py-3">Profit</th>
              </tr>
            </thead>
            <tbody>
              {sortedMonthly.map((m, i) => (
                <tr key={m.month} className={`border-b border-border/50 transition-colors hover:bg-accent/30 ${i === 0 ? "bg-primary/5" : ""}`}>
                  <td className="px-4 py-3 font-medium">{m.month} 2026 {i === 0 && <span className="ml-2 text-[10px] text-primary font-bold">CURRENT</span>}</td>
                  <td className="px-4 py-3">{m.clients}</td>
                  <td className="px-4 py-3 text-primary">{formatCurrency(m.revenue)}</td>
                  <td className="px-4 py-3 text-success">{formatCurrency(m.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
      )}

      {/* Recent Bookings & Agent Performance */}
      {hasAnyData && (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="glass-card rounded-xl p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Recent Bookings</h3>
          <div className="space-y-3">
            {store.bookings.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-lg bg-accent/20 px-4 py-3">
                <div><p className="text-sm font-medium">{b.headId}</p><p className="text-xs text-muted-foreground">{b.packageType} · {b.clientIds.length} clients</p></div>
                <div className="text-right"><p className="text-sm font-medium text-primary">{formatCurrency(b.amountReceived)}</p><StatusBadge status={b.status} /></div>
              </div>
            ))}
            {store.bookings.length === 0 && <p className="text-xs text-muted-foreground">No bookings yet.</p>}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glass-card rounded-xl p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Agent Performance</h3>
          <div className="space-y-3">
            {store.agents.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg bg-accent/20 px-4 py-3">
                <div><p className="text-sm font-medium">{a.name}</p><p className="text-xs text-muted-foreground">{a.id} · {a.totalClients + (a.openingClients || 0)} clients</p></div>
                <div className="text-right"><p className="text-sm font-medium text-primary">{formatCurrency(a.totalSales + (a.openingSales || 0))}</p><p className="text-xs text-muted-foreground">Commission: {formatCurrency(a.commission + (a.openingCommission || 0))}</p></div>
              </div>
            ))}
            {store.agents.length === 0 && <p className="text-xs text-muted-foreground">No agents yet.</p>}
          </div>
        </motion.div>
      </div>
      )}

      {!hasAnyData && (
        <div className="glass-card rounded-xl p-10 text-center">
          <p className="text-sm text-muted-foreground">No data yet. Add a booking, client, agent or entry to see live insights.</p>
        </div>
      )}
    </div>
  );
}
