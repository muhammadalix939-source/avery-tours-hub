import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Search, Bell, CalendarDays, Users, ClipboardCheck, Archive, RotateCcw, ChevronRight, CheckCheck, Lock, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PageHeader from "@/components/PageHeader";
import ChecklistBadge from "@/components/ChecklistBadge";
import ClientChecklistPanel from "@/components/ClientChecklistPanel";
import { formatCurrency, getClientName, type Client } from "@/lib/data";
import { useStore } from "@/lib/store";
import { computeGroupStats } from "@/lib/groups";
import { computeUrgency, sortByUrgency, urgencyLabel, urgencyTone } from "@/lib/urgency";
import { checklistProgress, getChecklist } from "@/lib/checklist";
import type { GroupStats } from "@/lib/groups";

export const Route = createFileRoute("/alerts")({
  component: AlertsPage,
  head: () => ({
    meta: [
      { title: "Alerts Hub — Avery International Travel & Tours" },
      { name: "description", content: "Seat-urgency alerts for closing groups and package-completion alerts for every client, in one operational hub." },
      { property: "og:title", content: "Alerts Hub — Avery International Travel & Tours" },
      { property: "og:description", content: "Closing groups, low seats and pending client services — prioritised for daily travel operations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Tab = "groups" | "clients";

function AlertsPage() {
  const store = useStore();
  const [tab, setTab] = useState<Tab>("groups");
  const [query, setQuery] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [showFullGroups, setShowFullGroups] = useState(false);
  const [openClient, setOpenClient] = useState<Client | null>(null);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const groupRows = useMemo(() => {
    const rows = store.groups.map((g) => {
      const stats = computeGroupStats(g, store);
      return { stats, urgency: computeUrgency(stats) };
    });
    return sortByUrgency(rows, (r) => r.urgency);
  }, [store]);

  const q = query.trim().toLowerCase();

  const filteredGroups = useMemo(() => groupRows.filter((r) =>
    !q || [r.stats.group.name, r.stats.group.id, r.stats.group.pnr, r.stats.group.category, r.stats.group.date, r.stats.supplier?.companyName]
      .filter(Boolean).join(" ").toLowerCase().includes(q)
  ), [groupRows, q]);

  const activeGroups = useMemo(() => filteredGroups.filter((r) => !r.urgency.isFull), [filteredGroups]);
  const archivedGroups = useMemo(() => filteredGroups.filter((r) => r.urgency.isFull), [filteredGroups]);
  const shownGroups = showFullGroups ? archivedGroups : activeGroups;
  const groupTotals = useMemo(() => ({
    profit: shownGroups.reduce((s, r) => s + r.stats.netProfit, 0),
    sales: shownGroups.reduce((s, r) => s + r.stats.revenue, 0),
    seats: shownGroups.reduce((s, r) => s + (r.urgency.capacity > 0 ? r.urgency.remainingSeats : 0), 0),
  }), [shownGroups]);
  const openGroup = openGroupId ? groupRows.find((r) => r.stats.group.id === openGroupId) : null;

  const clientRows = useMemo(() => {
    const rows = store.clients.map((c) => ({ client: c, progress: checklistProgress(c) }));
    const archived = rows.filter((r) => r.client.checklistArchived || r.progress.isComplete);
    const active = rows.filter((r) => !r.client.checklistArchived && !r.progress.isComplete);
    const pool = showCompleted ? archived : active;
    return pool
      .filter((r) => !q || [getClientName(r.client), r.client.id, r.client.headId, r.client.phone, r.client.packageType,
        ...getChecklist(r.client).map((i) => `${i.label} ${i.status}`)].join(" ").toLowerCase().includes(q))
      .sort((a, b) => a.progress.percent - b.progress.percent);
  }, [store.clients, q, showCompleted]);

  /** Head-wise grouping of the client alerts: one block per Head ID with its members. */
  const headGroups = useMemo(() => {
    const map = new Map<string, typeof clientRows>();
    clientRows.forEach((r) => {
      const key = r.client.headId || "No Head";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    return Array.from(map.entries()).map(([headId, members]) => {
      const completed = members.filter((m) => m.progress.isComplete).length;
      return {
        headId, members, completed,
        booking: store.bookings.find((b) => b.headId === headId),
        percent: Math.round(members.reduce((s, m) => s + m.progress.percent, 0) / (members.length || 1)),
      };
    }).sort((a, b) => a.percent - b.percent);
  }, [clientRows, store.bookings]);

  const visibleIds = clientRows.map((r) => r.client.id);
  const selected = selectedIds.filter((id) => visibleIds.includes(id));
  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function completeClients(ids: string[]) {
    ids.forEach((id) => {
      const c = store.clients.find((x) => x.id === id);
      if (!c) return;
      getChecklist(c).forEach((it) => { if (it.status !== "Completed") store.updateChecklistItem(id, it.id, { status: "Completed" }); });
      store.setChecklistArchived(id, true);
    });
    setSelectedIds([]);
  }

  const urgentCount = groupRows.filter((r) => r.urgency.level === "critical").length;
  const pendingClients = store.clients.filter((c) => !c.checklistArchived && !checklistProgress(c).isComplete).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts Hub"
        subtitle={`${urgentCount} urgent group${urgentCount === 1 ? "" : "s"} · ${pendingClients} client${pendingClients === 1 ? "" : "s"} with pending services`}
      />

      <div className="flex flex-wrap items-center gap-2">
        {(["groups", "clients"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold capitalize transition-all ${tab === t ? "bg-primary text-primary-foreground" : "bg-accent/30 text-muted-foreground hover:bg-accent/50"}`}>
            {t === "groups" ? <CalendarDays className="h-3.5 w-3.5" /> : <ClipboardCheck className="h-3.5 w-3.5" />}
            {t}
            <span className="rounded-full bg-background/30 px-1.5 text-[10px]">{t === "groups" ? activeGroups.length : clientRows.length}</span>
          </button>
        ))}
        <span className="rounded-lg border border-dashed border-border px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">Payments · coming soon</span>
      </div>

      <div className="glass-card flex items-center gap-2 rounded-xl px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder={tab === "groups" ? "Search group, PNR, date, supplier..." : "Search client, head ID, service item..."}
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
      </div>

      {tab === "groups" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant={showFullGroups ? "outline" : "default"} className="h-8 gap-1 text-xs" onClick={() => setShowFullGroups(false)}>
              <CalendarDays className="h-3.5 w-3.5" /> Active ({activeGroups.length})
            </Button>
            <Button size="sm" variant={showFullGroups ? "default" : "outline"} className="h-8 gap-1 text-xs" onClick={() => setShowFullGroups(true)}>
              <Lock className="h-3.5 w-3.5" /> Completed archive ({archivedGroups.length})
            </Button>
            <span className="ml-auto flex flex-wrap items-center gap-2 text-[10px]">
              <span className="rounded-full border border-border/60 bg-accent/20 px-2.5 py-1">Sales <b className="text-primary">{formatCurrency(groupTotals.sales)}</b></span>
              <span className="rounded-full border border-border/60 bg-accent/20 px-2.5 py-1">Profit <b className={groupTotals.profit >= 0 ? "text-success" : "text-destructive"}>{formatCurrency(groupTotals.profit)}</b></span>
              <span className="rounded-full border border-border/60 bg-accent/20 px-2.5 py-1">Seats Left <b>{groupTotals.seats}</b></span>
            </span>
          </div>

          {shownGroups.map(({ stats, urgency }, i) => (
            <motion.div key={stats.group.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}
              onClick={() => setOpenGroupId(stats.group.id)}
              className={`glass-card glass-card-hover flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${urgency.isFull ? "opacity-60 hover:opacity-100" : ""}`}>
              <div className="flex items-center gap-3">
                <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${urgencyTone[urgency.level]}`}>{urgencyLabel[urgency.level]}</span>
                <div>
                  <p className="text-sm font-semibold">{stats.group.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {[stats.group.id, stats.group.category, stats.group.date || "no date", stats.supplier?.companyName].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-5 text-right">
                <div>
                  <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Seats Left</p>
                  <p className={`text-sm font-bold ${urgency.remainingSeats <= 3 ? "text-destructive" : "text-success"}`}>
                    {urgency.capacity > 0 ? `${urgency.remainingSeats} / ${urgency.capacity}` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Sales</p>
                  <p className="text-sm font-semibold text-primary">{formatCurrency(stats.revenue)}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Profit</p>
                  <p className={`text-sm font-bold ${stats.netProfit >= 0 ? "text-success" : "text-destructive"}`}>{formatCurrency(stats.netProfit)}</p>
                </div>
                <p className="min-w-[120px] text-[10px] text-muted-foreground">{urgency.reason}</p>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </motion.div>
          ))}
          {shownGroups.length === 0 && <Empty icon={Bell} text={showFullGroups ? "No full / closed groups yet." : "No active group alerts match your search."} />}
        </div>
      )}

      {tab === "clients" && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant={showCompleted ? "outline" : "default"} className="h-8 gap-1 text-xs" onClick={() => setShowCompleted(false)}>
              <ClipboardCheck className="h-3.5 w-3.5" /> Active
            </Button>
            <Button size="sm" variant={showCompleted ? "default" : "outline"} className="h-8 gap-1 text-xs" onClick={() => setShowCompleted(true)}>
              <Archive className="h-3.5 w-3.5" /> Completed archive
            </Button>
            {!showCompleted && (
              <>
                <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => setSelectedIds(visibleIds)}>Select all</Button>
                {selected.length > 0 && (
                  <>
                    <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => setSelectedIds([])}>Clear ({selected.length})</Button>
                    <Button size="sm" className="h-8 gap-1 text-xs" onClick={() => completeClients(selected)}>
                      <CheckCheck className="h-3.5 w-3.5" /> Complete selected members
                    </Button>
                  </>
                )}
                {selected.length === 0 && visibleIds.length > 0 && (
                  <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => completeClients(visibleIds)}>
                    <CheckCheck className="h-3.5 w-3.5" /> Mark all complete
                  </Button>
                )}
              </>
            )}
          </div>

          <div className="space-y-4">
            {headGroups.map((hg, i) => (
              <motion.div key={hg.headId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.3) }}
                className="glass-card rounded-xl p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-semibold text-primary">{hg.headId}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {[`${hg.members.length} member${hg.members.length === 1 ? "" : "s"}`, hg.booking?.packageType, hg.booking?.destination, hg.booking?.travelDate].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-border/60 bg-accent/20 px-2.5 py-1 text-[10px]">{hg.completed}/{hg.members.length} members done · {hg.percent}%</span>
                    {!showCompleted && (
                      <>
                        <Button size="sm" variant="outline" className="h-7 text-[10px]"
                          onClick={() => setSelectedIds((prev) => Array.from(new Set([...prev, ...hg.members.map((m) => m.client.id)])))}>
                          Select head
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 gap-1 text-[10px]" onClick={() => completeClients(hg.members.map((m) => m.client.id))}>
                          <CheckCheck className="h-3 w-3" /> All complete
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  {hg.members.map(({ client, progress }) => (
                    <div key={client.id} onClick={() => setOpenClient(client)}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-accent/20 px-3 py-2 cursor-pointer transition-colors hover:bg-accent/40">
                      <div className="flex items-center gap-3">
                        {!showCompleted && (
                          <input type="checkbox" checked={selected.includes(client.id)} onClick={(e) => e.stopPropagation()}
                            onChange={() => toggleSelect(client.id)} className="h-3.5 w-3.5 accent-primary" />
                        )}
                        <div>
                          <p className="text-xs font-semibold">{getClientName(client)}</p>
                          <p className="text-[10px] text-muted-foreground">{client.id} · {client.packageType}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-muted-foreground">
                          {getChecklist(client).filter((it) => it.status !== "Completed").map((it) => it.label).slice(0, 3).join(", ") || "All services arranged"}
                        </span>
                        <ChecklistBadge client={client} />
                        {(client.checklistArchived || progress.isComplete) && (
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-[10px]"
                            onClick={(e) => { e.stopPropagation(); store.setChecklistArchived(client.id, false); }}>
                            <RotateCcw className="h-3 w-3" /> Re-open
                          </Button>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
            {headGroups.length === 0 && <Empty icon={ClipboardCheck} text={showCompleted ? "No completed client checklists yet." : "No pending client services. Everything is arranged."} />}
          </div>
        </>
      )}

      <Dialog open={!!openGroup} onOpenChange={(o) => !o && setOpenGroupId(null)}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] overflow-y-auto">
          {openGroup && <GroupAlertDetail stats={openGroup.stats} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!openClient} onOpenChange={(o) => !o && setOpenClient(null)}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] overflow-y-auto">
          {openClient && (
            <>
              <DialogHeader>
                <DialogTitle className="text-primary text-sm">{getClientName(openClient)} — Service Checklist</DialogTitle>
                <p className="text-[11px] text-muted-foreground">{openClient.id} · {openClient.headId} · {openClient.packageType}</p>
              </DialogHeader>
              <ClientChecklistPanel client={openClient} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Empty({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="glass-card flex flex-col items-center rounded-xl py-14 text-center">
      <Icon className="mb-3 h-10 w-10 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function GroupAlertDetail({ stats }: { stats: GroupStats }) {
  const u = computeUrgency(stats);
  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2 text-sm text-primary">
          {stats.group.name}
          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${urgencyTone[u.level]}`}>{urgencyLabel[u.level]}</span>
        </DialogTitle>
        <p className="text-[11px] text-muted-foreground">
          {[stats.group.id, stats.group.pnr && `PNR ${stats.group.pnr}`, stats.group.category, stats.group.date, stats.supplier?.companyName].filter(Boolean).join(" · ")}
        </p>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Box label="Seats Left" value={u.capacity > 0 ? `${u.remainingSeats} / ${u.capacity}` : "—"} tone={u.remainingSeats <= 3 ? "text-destructive" : "text-success"} />
        <Box label="Sales" value={formatCurrency(stats.revenue)} tone="text-primary" />
        <Box label="Supplier Bill" value={formatCurrency(stats.supplierBill)} tone="text-warning" />
        <Box label="Net Profit" value={formatCurrency(stats.netProfit)} tone={stats.netProfit >= 0 ? "text-success" : "text-destructive"} />
      </div>

      <div className="rounded-lg border border-border/50 p-3">
        <p className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <TrendingUp className="h-3 w-3" /> Heads in this group ({stats.heads.length}) · margin {stats.margin.toFixed(1)}%
        </p>
        <div className="max-h-56 space-y-1.5 overflow-y-auto">
          {stats.heads.map((h) => (
            <div key={h.headId} className="flex items-center justify-between rounded bg-accent/20 px-2.5 py-1.5">
              <div>
                <p className="text-xs font-medium">{h.leadName}</p>
                <p className="text-[10px] text-muted-foreground">{h.headId} · {h.members} member{h.members === 1 ? "" : "s"}</p>
              </div>
              <div className="text-right text-[10px]">
                <p>Total {formatCurrency(h.totalAmount)}</p>
                <p className="text-success">Received {formatCurrency(h.received)}</p>
              </div>
            </div>
          ))}
          {stats.heads.length === 0 && <p className="py-2 text-center text-[11px] text-muted-foreground">No heads booked in this group yet.</p>}
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground">{u.reason}</p>
    </div>
  );
}

function Box({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-accent/20 p-2.5">
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-sm font-bold ${tone || ""}`}>{value}</p>
    </div>
  );
}
