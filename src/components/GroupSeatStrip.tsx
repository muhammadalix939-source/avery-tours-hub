import { useMemo, useState } from "react";
import { CalendarDays, Users, ChevronRight, Layers } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import StatusBadge from "@/components/StatusBadge";
import { formatCurrency, getClientName } from "@/lib/data";
import { useStore } from "@/lib/store";
import { computeGroupStats, type GroupStats } from "@/lib/groups";
import { computeUrgency, sortByUrgency, urgencyLabel, urgencyTone } from "@/lib/urgency";

/** Live seat-status widget for the Group Sale / Bill entry screen.
 *  Active groups only, ordered by urgency; click any group for a quick view. */
export default function GroupSeatStrip() {
  const store = useStore();
  const [quickId, setQuickId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const all = store.groups.map((g) => ({ stats: computeGroupStats(g, store), urgency: computeUrgency(computeGroupStats(g, store)) }));
    const active = all.filter((r) => !r.urgency.isFull);
    return sortByUrgency(active, (r) => r.urgency);
  }, [store]);

  const quick = quickId ? store.groups.find((g) => g.id === quickId) : null;
  const quickStats = quick ? computeGroupStats(quick, store) : null;

  const totals = useMemo(() => ({
    profit: rows.reduce((s, r) => s + r.stats.netProfit, 0),
    seats: rows.reduce((s, r) => s + (r.urgency.capacity > 0 ? r.urgency.remainingSeats : 0), 0),
    sales: rows.reduce((s, r) => s + r.stats.revenue, 0),
  }), [rows]);

  if (store.groups.length === 0) return null;

  return (
    <div className="glass-card rounded-xl p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Layers className="h-4 w-4 text-primary" />
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Live Seat Status</p>
        <span className="text-[10px] text-muted-foreground">Most urgent groups first · click for quick view</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Pill label="Group Sales" value={formatCurrency(totals.sales)} tone="text-primary" />
          <Pill label="Group Profit" value={formatCurrency(totals.profit)} tone={totals.profit >= 0 ? "text-success" : "text-destructive"} />
          <Pill label="Seats Left" value={String(totals.seats)} tone={totals.seats <= 3 ? "text-destructive" : "text-foreground"} />
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {rows.map(({ stats, urgency }) => (
          <button key={stats.group.id} onClick={() => setQuickId(stats.group.id)}
            className={`min-w-[210px] shrink-0 rounded-xl border p-3 text-left transition-all hover:border-primary/50 ${urgencyTone[urgency.level]}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-xs font-semibold text-foreground">{stats.group.name}</p>
              <span className="rounded-full border border-current px-1.5 py-0.5 text-[9px] font-bold">{urgencyLabel[urgency.level]}</span>
            </div>
            <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
              <CalendarDays className="h-3 w-3" /> {stats.group.date || "No date"}
            </p>
            <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-foreground">
              <Users className="h-3 w-3" />
              {urgency.capacity > 0 ? `${urgency.remainingSeats} of ${urgency.capacity} seats left` : `${stats.usedPax} pax booked`}
            </p>
            <p className="mt-0.5 text-[10px] opacity-80">{urgency.reason}</p>
            <div className="mt-2 flex items-center justify-between border-t border-current/20 pt-1.5 text-[10px]">
              <span className="text-muted-foreground">Sales {formatCurrency(stats.revenue)}</span>
              <span className={`font-semibold ${stats.netProfit >= 0 ? "text-success" : "text-destructive"}`}>Profit {formatCurrency(stats.netProfit)}</span>
            </div>
          </button>
        ))}
        {rows.length === 0 && <p className="py-3 text-xs text-muted-foreground">All groups are full — see the Full / Closed section on the Groups page.</p>}
      </div>

      <Dialog open={!!quick} onOpenChange={(o) => !o && setQuickId(null)}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] overflow-y-auto">
          {quick && quickStats && <QuickView stats={quickStats} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuickView({ stats }: { stats: GroupStats }) {
  const store = useStore();
  const urgency = computeUrgency(stats);
  const members = stats.heads.flatMap((h) => h.clients.map((c) => ({ c, headId: h.headId })));
  const nextDeparture = store.groups
    .map((g) => g.date).filter(Boolean).sort().find((d) => d! >= (stats.group.date || "")) || stats.group.date;

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2 text-primary text-sm">
          {stats.group.name}
          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${urgencyTone[urgency.level]}`}>{urgencyLabel[urgency.level]}</span>
        </DialogTitle>
        <p className="text-[11px] text-muted-foreground">
          {[stats.group.id, stats.group.pnr && `PNR ${stats.group.pnr}`, stats.group.category, stats.supplier?.companyName].filter(Boolean).join(" · ")}
        </p>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total Seats" value={String(urgency.capacity || "—")} />
        <Stat label="Booked" value={String(stats.usedPax)} tone="text-warning" />
        <Stat label="Remaining" value={urgency.capacity ? String(urgency.remainingSeats) : "—"} tone={urgency.remainingSeats <= 3 ? "text-destructive" : "text-success"} />
        <Stat label="Departure" value={stats.group.date || "—"} tone="text-primary" />
      </div>

      <div className="rounded-lg border border-border/50 p-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Booked Clients ({members.length})</p>
        <div className="max-h-56 space-y-1.5 overflow-y-auto">
          {members.map(({ c, headId }) => (
            <div key={c.id} className="flex items-center justify-between rounded bg-accent/20 px-2.5 py-1.5">
              <div>
                <p className="text-xs font-medium">{getClientName(c)}</p>
                <p className="text-[10px] text-muted-foreground">{c.id} · {headId}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">{formatCurrency(c.amountPaid)}</span>
                <StatusBadge status={c.paymentStatus} />
              </div>
            </div>
          ))}
          {members.length === 0 && <p className="py-2 text-center text-[11px] text-muted-foreground">No clients booked in this group yet.</p>}
        </div>
      </div>

      <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <ChevronRight className="h-3 w-3" /> Next departure on record: {nextDeparture || "—"}
      </p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-accent/20 p-2.5">
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-sm font-bold ${tone || ""}`}>{value}</p>
    </div>
  );
}

function Pill({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <span className="rounded-full border border-border/60 bg-accent/20 px-2.5 py-1 text-[10px]">
      <span className="uppercase tracking-wide text-muted-foreground">{label} </span>
      <span className={`font-bold ${tone || ""}`}>{value}</span>
    </span>
  );
}
