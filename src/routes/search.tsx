import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState, useMemo, useEffect } from "react";
import { Search as SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import DetailDialog from "@/components/DetailDialog";
import ChecklistBadge from "@/components/ChecklistBadge";
import { formatCurrency, getClientName, type Client, type Agent, type Supplier, type Booking } from "@/lib/data";
import { useStore } from "@/lib/store";
import { computeGroupStats } from "@/lib/groups";
import { computeUrgency, urgencyLabel } from "@/lib/urgency";
import { checklistProgress, getChecklist } from "@/lib/checklist";

export const Route = createFileRoute("/search")({
  component: SearchPage,
  head: () => ({ meta: [{ title: "Search — AV Travel CRM" }] }),
});

type ResultType = "booking" | "client" | "agent" | "supplier" | "group";

interface SearchResult {
  type: ResultType;
  id: string;
  title: string;
  subtitle: string;
  status: string;
  extra?: string;
  raw: Client | Agent | Supplier | Booking;
  /** Client results carry their checklist progress for the inline badge. */
  client?: Client;
}

const typeColors: Record<ResultType, string> = {
  booking: "bg-primary/10 text-primary",
  client: "bg-success/10 text-success",
  agent: "bg-warning/10 text-warning",
  supplier: "bg-chart-3/10 text-chart-3",
  group: "bg-primary/10 text-primary",
};

function SearchPage() {
  const store = useStore();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 120);
    return () => clearTimeout(t);
  }, [query]);
  const [typeFilter, setTypeFilter] = useState<ResultType | "all">("all");
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<Exclude<ResultType, "group">>("client");
  const [selectedData, setSelectedData] = useState<Client | Agent | Supplier | Booking | null>(null);

  const results = useMemo(() => searchAll(debounced, store), [debounced, store]);
  const filtered = useMemo(() => typeFilter === "all" ? results : results.filter((r) => r.type === typeFilter), [results, typeFilter]);

  function handleClick(r: SearchResult) {
    // Group hits open their linked booking detail (groups themselves live on /groups).
    setSelectedType(r.type === "group" ? "booking" : r.type);
    setSelectedData(r.raw);
    setDetailOpen(true);
  }

  const relatedEntries = selectedData && "id" in selectedData ? store.entries.filter((e) => e.referenceId === (selectedData as any).id || e.headId === (selectedData as any).headId) : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Search" subtitle="Find any record — click for full details" />

      <div className="relative">
        <SearchIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by Head ID, Client ID, Name, Phone, Agent, Supplier..." value={query} onChange={(e) => setQuery(e.target.value)} className="h-12 bg-accent/20 pl-12 text-base border-border" />
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "booking", "client", "agent", "supplier", "group"] as const).map((t) => (
          <button key={t} onClick={() => setTypeFilter(t)} className={`rounded-lg px-4 py-2 text-xs font-medium capitalize transition-all ${typeFilter === t ? "bg-primary text-primary-foreground" : "bg-accent/30 text-muted-foreground hover:bg-accent/50"}`}>
            {t === "all" ? "All" : `${t}s`}
          </button>
        ))}
      </div>

      {query && <p className="text-xs text-muted-foreground">{filtered.length} results found</p>}

      <div className="space-y-2">
        {filtered.map((r, i) => (
          <motion.div key={`${r.type}-${r.id}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
            onClick={() => handleClick(r)}
            className="glass-card glass-card-hover flex items-center justify-between rounded-xl px-5 py-4 transition-all duration-200 cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <span className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase ${typeColors[r.type]}`}>{r.type}</span>
              <div>
                <p className="text-sm font-medium">{r.title}</p>
                <p className="text-xs text-muted-foreground">{r.subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {r.client && <ChecklistBadge client={r.client} compact />}
              {r.extra && <span className="text-sm font-medium text-primary">{r.extra}</span>}
              <StatusBadge status={r.status} />
            </div>
          </motion.div>
        ))}
      </div>

      {query && filtered.length === 0 && (
        <div className="flex flex-col items-center py-16 text-center">
          <SearchIcon className="mb-3 h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No results found for "{query}"</p>
        </div>
      )}

      <DetailDialog open={detailOpen} onOpenChange={setDetailOpen} type={selectedType} data={selectedData} entries={relatedEntries} allClients={store.clients} allBookings={store.bookings} />
    </div>
  );
}

function searchAll(query: string, store: ReturnType<typeof useStore>): SearchResult[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const results: SearchResult[] = [];

  store.bookings.forEach((b) => {
    if (b.headId.toLowerCase().includes(q) || b.agentId.toLowerCase().includes(q) || b.supplierId.toLowerCase().includes(q)) {
      results.push({ type: "booking", id: b.headId, title: b.headId, subtitle: `${b.packageType} · ${b.clientIds.length} clients · ${b.travelDate}`, status: b.status, extra: formatCurrency(b.totalAmount), raw: b });
    }
  });

  store.clients.forEach((c) => {
    const fullName = getClientName(c).toLowerCase();
    const checklistText = getChecklist(c).map((i) => `${i.label} ${i.status}`).join(" ").toLowerCase();
    const progress = checklistProgress(c);
    const alertText = `${progress.isComplete ? "completed services" : "pending services"} ${progress.label}`;
    if (c.id.toLowerCase().includes(q) || fullName.includes(q) || c.phone.includes(q) || c.passport.toLowerCase().includes(q) || checklistText.includes(q) || alertText.includes(q)) {
      results.push({ type: "client", id: c.id, title: getClientName(c), subtitle: `${c.id} · ${c.headId} · ${c.passport}`, status: c.paymentStatus, extra: formatCurrency(c.amountPaid), raw: c, client: c });
    }
  });

  store.agents.forEach((a) => {
    if (a.id.toLowerCase().includes(q) || a.name.toLowerCase().includes(q) || a.phone.includes(q)) {
      results.push({ type: "agent", id: a.id, title: a.name, subtitle: `${a.id} · ${a.totalClients} clients`, status: a.status, extra: formatCurrency(a.totalSales), raw: a });
    }
  });

  store.suppliers.forEach((s) => {
    if (s.id.toLowerCase().includes(q) || s.companyName.toLowerCase().includes(q) || s.phone.includes(q)) {
      const remaining = s.totalPayable - s.totalPaid;
      results.push({ type: "supplier", id: s.id, title: s.companyName, subtitle: `${s.id} · ${s.serviceType}`, status: remaining === 0 ? "Paid" : "Partial", extra: formatCurrency(remaining), raw: s });
    }
  });

  store.groups.forEach((g) => {
    const stats = computeGroupStats(g, store);
    const u = computeUrgency(stats);
    const hay = [g.id, g.name, g.pnr, g.flightNumber, g.category, g.date, u.isFull ? "full closed" : "active open"].filter(Boolean).join(" ").toLowerCase();
    if (hay.includes(q)) {
      results.push({
        type: "group", id: g.id, title: g.name,
        subtitle: `${g.id} · ${g.category} · ${g.date || "no date"} · ${u.capacity > 0 ? `${u.remainingSeats}/${u.capacity} seats left` : `${stats.usedPax} pax`} · ${u.reason}`,
        status: u.isFull ? "Inactive" : "Active",
        extra: urgencyLabel[u.level],
        raw: (stats.heads[0]?.booking ?? { headId: g.id }) as any,
      });
    }
  });

  return results;
}
