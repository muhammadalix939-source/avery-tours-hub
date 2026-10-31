import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { formatCurrency } from "@/lib/data";
import { computeTotals } from "@/lib/reports";

export const Route = createFileRoute("/drawings")({
  head: () => ({
    meta: [
      { title: "Owner Drawings — Avery Travel CRM" },
      { name: "description", content: "Owner and partner drawings with business profit on each drawing date and retained profit today." },
      { property: "og:title", content: "Owner Drawings — Avery Travel CRM" },
      { property: "og:description", content: "Owner and partner drawings with profit at the time of each drawing and today." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DrawingsPage,
});

function DrawingsPage() {
  const store = useStore();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [person, setPerson] = useState("all");

  // Net profit using only business recorded up to (and including) a given date.
  const profitAt = useMemo(() => {
    const cache = new Map<string, number>();
    return (date: string) => {
      if (cache.has(date)) return cache.get(date)!;
      const bookings = store.bookings.filter((b) => (b.createdAt || b.travelDate || "").slice(0, 10) <= date);
      const entries = store.entries.filter((e) => e.date <= date);
      const v = computeTotals({ bookings, clients: store.clients, agents: store.agents, suppliers: store.suppliers, entries, opening: store.opening }).netProfit;
      cache.set(date, v);
      return v;
    };
  }, [store.bookings, store.entries, store.clients, store.agents, store.suppliers, store.opening]);

  const all = store.entries.filter((e) => e.type === "drawing").sort((a, b) => a.date.localeCompare(b.date));
  const people = [...new Set(all.map((e) => e.referenceName || "Owner"))];
  const rows = all.filter((e) => (!from || e.date >= from) && (!to || e.date <= to) && (person === "all" || (e.referenceName || "Owner") === person));

  const profitNow = computeTotals({ bookings: store.bookings, clients: store.clients, agents: store.agents, suppliers: store.suppliers, entries: store.entries, opening: store.opening }).netProfit;
  const totalDrawn = all.reduce((s, e) => s + e.amount, 0);
  const periodDrawn = rows.reduce((s, e) => s + e.amount, 0);
  const retained = profitNow - totalDrawn;

  let cumulative = 0;
  const withRunning = all.map((e) => { cumulative += e.amount; return { e, cum: cumulative }; });
  const runOf = new Map(withRunning.map((r) => [r.e.id, r.cum]));

  const card = (label: string, value: string, tone: string, hint?: string) => (
    <div className="glass-card rounded-xl p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-bold ${tone}`}>{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Owner Drawings" subtitle="Money taken out by owners / partners against business profit" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {card("Net Profit Today", formatCurrency(profitNow), "text-primary", "Business profit, before drawings")}
        {card("Total Drawn", formatCurrency(totalDrawn), "text-destructive", `${all.length} drawings`)}
        {card("Retained Profit", formatCurrency(retained), retained >= 0 ? "text-success" : "text-destructive", "Profit − drawings")}
        {card("Drawn in Filter", formatCurrency(periodDrawn), "text-warning", `${rows.length} shown`)}
      </div>

      <div className="glass-card flex flex-wrap items-end gap-3 rounded-xl p-4">
        <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 h-9 text-xs" /></div>
        <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 h-9 text-xs" /></div>
        <div><Label className="text-xs">Drawn By</Label>
          <select value={person} onChange={(e) => setPerson(e.target.value)} className="mt-1 h-9 rounded-md border border-border bg-accent/20 px-2 text-xs">
            <option value="all">Everyone</option>
            {people.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <p className="ml-auto text-[10px] text-muted-foreground">Add drawings from Entries → New Entry → Owner / Partner Drawing.</p>
      </div>

      <div className="glass-card overflow-x-auto rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Date</th><th className="px-4 py-3">Drawn By</th><th className="px-4 py-3">Purpose</th><th className="px-4 py-3">Paid Via</th>
              <th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-right">Profit on Date</th><th className="px-4 py-3 text-right">Total Drawn to Date</th><th className="px-4 py-3 text-right">Profit Left After</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const p = profitAt(e.date);
              const cum = runOf.get(e.id) || 0;
              return (
                <tr key={e.id} className="border-b border-border/50">
                  <td className="px-4 py-3">{e.date}</td>
                  <td className="px-4 py-3 font-medium">{e.referenceName || "Owner"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{[e.chargeCategory, e.note].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-4 py-3 text-xs">{[e.paymentMethod || "Cash", store.accounts.find((a) => a.id === e.accountId)?.name, e.chequeNo && `Chq ${e.chequeNo}`, e.txnRef].filter(Boolean).join(" · ")}</td>
                  <td className="px-4 py-3 text-right font-semibold text-destructive">{formatCurrency(e.amount)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(p)}</td>
                  <td className="px-4 py-3 text-right text-warning">{formatCurrency(cum)}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${p - cum >= 0 ? "text-success" : "text-destructive"}`}>{formatCurrency(p - cum)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-xs text-muted-foreground">No drawings recorded.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
