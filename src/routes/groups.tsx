import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import {
  Plus, Trash2, Pencil, Layers, Users, Wallet, TrendingUp, Gift, ChevronRight, Search, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { formatCurrency } from "@/lib/data";
import { useStore, type PurchaseGroup } from "@/lib/store";
import { computeGroupStats, type GroupStats } from "@/lib/groups";
import { computeUrgency, sortByUrgency, urgencyLabel, urgencyTone, type GroupUrgency } from "@/lib/urgency";
import ConfirmDelete from "@/components/ConfirmDelete";
import { getPKTDate } from "@/lib/date-utils";
import SortBar from "@/components/SortBar";
import { sortEntities, type SortOptionKey } from "@/lib/sort-utils";

export const Route = createFileRoute("/groups")({
  component: GroupsPage,
  head: () => ({
    meta: [
      { title: "Group Management — Avery Travel CRM" },
      { name: "description", content: "Track every PNR / batch group: linked heads, member details, supplier bill, group expenses and net profit in one professional view." },
      { property: "og:title", content: "Group Management — Avery Travel CRM" },
      { property: "og:description", content: "Group-wise supplier bill, gifts & extra expenses, and live net profit for every travel batch." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const GROUP_CATEGORIES = ["Flight", "Hotel", "Visa", "Transport", "Ziyarah", "Insurance", "Other"] as const;
const EXTRA_CATEGORIES = ["Gift", "Hospitality", "Ihram / Kit", "Zam Zam", "Meals", "Documentation", "Transport Extra", "Other"] as const;

const emptyForm = {
  name: "", category: "Flight", supplierId: "", date: "", pnr: "", flightNumber: "", description: "", totalPax: "",
};

function GroupsPage() {
  const store = useStore();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [expenseFor, setExpenseFor] = useState<PurchaseGroup | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortOptionKey>("date_desc");
  const [form, setForm] = useState(emptyForm);
  const [selected, setSelected] = useState<PurchaseGroup | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PurchaseGroup | null>(null);

  const stats = useMemo<GroupStats[]>(
    () => store.groups.map((g) => computeGroupStats(g, store)),
    [store]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q ? stats.filter((s) =>
      [s.group.id, s.group.name, s.group.pnr, s.group.flightNumber, s.group.category, s.supplier?.companyName]
        .filter(Boolean).join(" ").toLowerCase().includes(q)
    ) : stats;

    return sortEntities(base, sortKey, {
      date: (s) => s.group.date || s.group.createdAt,
      amount: (s) => s.revenue || s.supplierBill,
      name: (s) => s.group.name || s.group.id,
    });
  }, [stats, search, sortKey]);

  const activeGroups = useMemo(() => filtered.filter((s) => !computeUrgency(s).isFull), [filtered]);
  const fullGroups = useMemo(() => filtered.filter((s) => computeUrgency(s).isFull), [filtered]);

  const totals = useMemo(() => ({
    groups: stats.length,
    pax: stats.reduce((s, x) => s + x.usedPax, 0),
    revenue: stats.reduce((s, x) => s + x.revenue, 0),
    bill: stats.reduce((s, x) => s + x.supplierBill, 0),
    extras: stats.reduce((s, x) => s + x.expenses, 0),
    profit: stats.reduce((s, x) => s + x.netProfit, 0),
    seatsLeft: stats.reduce((s, x) => s + (x.capacity > 0 ? Math.max(0, x.capacity - x.usedPax) : 0), 0),
  }), [stats]);

  const detail = detailId ? stats.find((s) => s.group.id === detailId) : null;

  function payload() {
    return {
      name: form.name || "Untitled Group",
      category: form.category,
      supplierId: form.supplierId || undefined,
      date: form.date || undefined,
      pnr: form.pnr || undefined,
      flightNumber: form.flightNumber || undefined,
      description: form.description || undefined,
      totalPax: Number(form.totalPax) || 0,
    };
  }

  function openEdit(g: PurchaseGroup) {
    setSelected(g);
    setForm({
      name: g.name, category: g.category, supplierId: g.supplierId || "", date: g.date || "",
      pnr: g.pnr || "", flightNumber: g.flightNumber || "", description: g.description || "",
      totalPax: String(g.totalPax || ""),
    });
    setEditOpen(true);
  }

  const formFields = (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Group Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Umrah Batch 12 Jun" className="bg-accent/20 border-border mt-1 h-9 text-xs" /></div>
        <div><Label className="text-xs">Category</Label>
          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
            <SelectTrigger className="bg-accent/20 border-border mt-1 h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{GROUP_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Supplier</Label>
          <Select value={form.supplierId || "none"} onValueChange={(v) => setForm({ ...form, supplierId: v === "none" ? "" : v })}>
            <SelectTrigger className="bg-accent/20 border-border mt-1 h-9 text-xs"><SelectValue placeholder="Select supplier" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No supplier</SelectItem>
              {store.suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.companyName}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Travel / Service Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="bg-accent/20 border-border mt-1 h-9 text-xs" /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><Label className="text-xs">PNR</Label><Input value={form.pnr} onChange={(e) => setForm({ ...form, pnr: e.target.value })} className="bg-accent/20 border-border mt-1 h-9 text-xs" /></div>
        <div><Label className="text-xs">Flight / Ref No.</Label><Input value={form.flightNumber} onChange={(e) => setForm({ ...form, flightNumber: e.target.value })} className="bg-accent/20 border-border mt-1 h-9 text-xs" /></div>
        <div><Label className="text-xs">Capacity (Pax)</Label><Input type="number" value={form.totalPax} onChange={(e) => setForm({ ...form, totalPax: e.target.value })} className="bg-accent/20 border-border mt-1 h-9 text-xs" /></div>
      </div>
      <div><Label className="text-xs">Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-accent/20 border-border mt-1 h-9 text-xs" /></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Group Management"
        subtitle={`${store.groups.length} groups · PNR / batch level profitability`}
        actions={
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={() => setForm({ ...emptyForm, date: getPKTDate() })}>
                <Plus className="h-4 w-4" /> New Group
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create Group</DialogTitle></DialogHeader>
              {formFields}
              <Button className="w-full" onClick={() => { store.addGroup(payload()); setAddOpen(false); }}>Create Group</Button>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-7">
        <Kpi icon={Layers} label="Groups" value={String(totals.groups)} />
        <Kpi icon={Users} label="Total Pax" value={String(totals.pax)} />
        <Kpi icon={Users} label="Seats Left" value={String(totals.seatsLeft)} tone={totals.seatsLeft <= 3 ? "text-destructive" : "text-success"} />
        <Kpi icon={TrendingUp} label="Group Sales" value={formatCurrency(totals.revenue)} tone="text-primary" />
        <Kpi icon={Wallet} label="Supplier Bill" value={formatCurrency(totals.bill)} tone="text-warning" />
        <Kpi icon={Gift} label="Extras / Gifts" value={formatCurrency(totals.extras)} tone="text-destructive" />
        <Kpi icon={TrendingUp} label="Group Profit" value={formatCurrency(totals.profit)} tone={totals.profit >= 0 ? "text-success" : "text-destructive"} />
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="glass-card flex items-center gap-2 rounded-xl px-3 py-2 flex-1">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search group, PNR, flight, supplier..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <SortBar
          value={sortKey}
          onChange={setSortKey}
          label="Sort by:"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {activeGroups.map((s, i) => (
          <GroupCard key={s.group.id} s={s} index={i}
            onOpen={() => setDetailId(s.group.id)}
            onExpense={() => setExpenseFor(s.group)}
            onEdit={() => openEdit(s.group)}
            onDelete={() => setDeleteTarget(s.group)} />
        ))}
        {activeGroups.length === 0 && (
          <div className="glass-card rounded-xl p-12 text-center text-sm text-muted-foreground xl:col-span-2">
            No active groups. Create a group to track PNR-level cost and profit.
          </div>
        )}
      </div>

      {fullGroups.length > 0 && (
        <div className="space-y-3 border-t border-border/60 pt-5">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Full / Closed Groups ({fullGroups.length})</p>
            <span className="text-[10px] text-muted-foreground">Closed for new sales — still searchable everywhere</span>
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {fullGroups.map((s, i) => (
              <GroupCard key={s.group.id} s={s} index={i} muted
                onOpen={() => setDetailId(s.group.id)}
                onExpense={() => setExpenseFor(s.group)}
                onEdit={() => openEdit(s.group)}
                onDelete={() => setDeleteTarget(s.group)} />
            ))}
          </div>
        </div>
      )}

      <ConfirmDelete
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title={`Delete group ${deleteTarget?.name || ""}?`}
        description="The group will be removed and any tagged entries will be untagged. Bookings and clients are not deleted."
        onConfirm={() => { if (deleteTarget) store.deleteGroup(deleteTarget.id); setDeleteTarget(null); }}
      />

      {/* Edit */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-card border-border max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Group — {selected?.id}</DialogTitle></DialogHeader>
          {formFields}
          <Button className="w-full" onClick={() => { if (selected) store.updateGroup(selected.id, payload()); setEditOpen(false); }}>Save Changes</Button>
        </DialogContent>
      </Dialog>

      {/* Group expense */}
      <GroupExpenseDialog
        group={expenseFor}
        onClose={() => setExpenseFor(null)}
        onSubmit={(data) => {
          store.addEntry({
            date: data.date || getPKTDate(),
            type: "expense",
            headId: data.category,
            referenceId: "",
            referenceName: data.description || data.category,
            amount: data.amount,
            note: `${expenseFor?.name || ""} (${expenseFor?.id || ""}) — ${data.note}`.trim(),
            groupId: expenseFor?.id,
          });
          setExpenseFor(null);
        }}
      />

      {/* Detail */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="bg-card border-border max-w-4xl max-h-[88vh] overflow-y-auto">
          {detail && <GroupDetail stats={detail} onAddExpense={() => setExpenseFor(detail.group)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GroupCard({ s, index, muted, onOpen, onExpense, onEdit, onDelete }: {
  s: GroupStats; index: number; muted?: boolean;
  onOpen: () => void; onExpense: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const u: GroupUrgency = computeUrgency(s);
  const pct = s.capacity > 0 ? Math.min(100, Math.round((s.usedPax / s.capacity) * 100)) : 0;
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.05, 0.3) }}
      className={`glass-card cursor-pointer rounded-xl p-5 transition-colors hover:border-primary/40 ${muted ? "opacity-60 hover:opacity-100" : ""}`}
      onClick={onOpen}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{s.group.name}</h3>
            <span className="rounded-md bg-accent/40 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">{s.group.category}</span>
            <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${urgencyTone[u.level]}`}>{urgencyLabel[u.level]}</span>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {[s.group.id, s.group.pnr && `PNR ${s.group.pnr}`, s.group.flightNumber, s.group.date, s.supplier?.companyName].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">{u.reason}</p>
        </div>
        <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
          <button onClick={onExpense} className="rounded p-1 hover:bg-accent" title="Add gift / extra expense"><Gift className="h-3.5 w-3.5 text-primary" /></button>
          <button onClick={onEdit} className="rounded p-1 hover:bg-accent" title="Edit"><Pencil className="h-3.5 w-3.5 text-warning" /></button>
          <button onClick={onDelete} className="rounded p-1 hover:bg-accent" title="Delete"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
        </div>
      </div>

      {s.capacity > 0 && (
        <>
          <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
            <span>{s.usedPax} / {s.capacity} clients booked</span>
            <span className={u.remainingSeats <= 3 && !u.isFull ? "font-semibold text-destructive" : ""}>{s.remainingPax} seats left</span>
          </div>
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-accent/30">
            <div className={`h-full rounded-full transition-all ${u.isFull ? "bg-muted-foreground" : "bg-primary"}`} style={{ width: `${pct}%` }} />
          </div>
        </>
      )}

      <div className="grid grid-cols-4 gap-2 border-t border-border/50 pt-3 text-xs">
        <Cell label="Sales" value={formatCurrency(s.revenue)} tone="text-primary" />
        <Cell label="Supplier Bill" value={formatCurrency(s.supplierBill)} tone="text-warning" />
        <Cell label="Extras" value={formatCurrency(s.expenses)} tone="text-destructive" />
        <Cell label="Net Profit" value={formatCurrency(s.netProfit)} tone={s.netProfit >= 0 ? "text-success" : "text-destructive"} />
      </div>
      <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{s.heads.length} head{s.heads.length === 1 ? "" : "s"} · margin {s.margin.toFixed(1)}%</span>
        <span className="flex items-center gap-1 text-primary">Open detail <ChevronRight className="h-3 w-3" /></span>
      </div>
    </motion.div>
  );
}

function Kpi({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone?: string }) {
  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex items-center gap-3">
        <Icon className={`h-4 w-4 ${tone || "text-primary"}`} />
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className={`text-base font-bold ${tone || ""}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`font-semibold ${tone || ""}`}>{value}</p>
    </div>
  );
}

function GroupExpenseDialog({ group, onClose, onSubmit }: {
  group: PurchaseGroup | null;
  onClose: () => void;
  onSubmit: (d: { date: string; category: string; description: string; amount: number; note: string }) => void;
}) {
  const [date, setDate] = useState("");
  const [category, setCategory] = useState<string>("Gift");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  return (
    <Dialog open={!!group} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-primary">Add Group Expense</DialogTitle>
          <p className="text-xs text-muted-foreground">{group?.name} · {group?.id} — gifts, hospitality and extras booked against this group reduce its net profit.</p>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-accent/20 border-border mt-1 h-9 text-xs" /></div>
            <div><Label className="text-xs">Type</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-accent/20 border-border mt-1 h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{EXTRA_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label className="text-xs">Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Ihram kits for 30 pax" className="bg-accent/20 border-border mt-1 h-9 text-xs" /></div>
          <div><Label className="text-xs">Amount (PKR)</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-accent/20 border-border mt-1 h-9 text-xs" /></div>
          <div><Label className="text-xs">Note</Label><Input value={note} onChange={(e) => setNote(e.target.value)} className="bg-accent/20 border-border mt-1 h-9 text-xs" /></div>
          <Button className="w-full" onClick={() => {
            onSubmit({ date, category, description, amount: Number(amount) || 0, note });
            setDate(""); setCategory("Gift"); setDescription(""); setAmount(""); setNote("");
          }}>Add to Group</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GroupDetail({ stats, onAddExpense }: { stats: GroupStats; onAddExpense: () => void }) {
  const [openHead, setOpenHead] = useState<string | null>(null);
  const g = stats.group;

  return (
    <div className="space-y-5">
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2 text-primary">
          {g.name}
          <span className="rounded-md bg-accent/40 px-2 py-0.5 text-[10px] font-semibold uppercase">{g.category}</span>
        </DialogTitle>
        <p className="text-xs text-muted-foreground">
          {[g.id, g.pnr && `PNR ${g.pnr}`, g.flightNumber, g.date, stats.supplier?.companyName, g.description].filter(Boolean).join(" · ")}
        </p>
      </DialogHeader>

      {/* Financial snapshot */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Cell label="Group Sales" value={formatCurrency(stats.revenue)} tone="text-primary" />
        <Cell label="Received" value={formatCurrency(stats.received)} tone="text-success" />
        <Cell label="Pending" value={formatCurrency(stats.pendingReceivable)} tone="text-destructive" />
        <Cell label="Clients (Pax)" value={stats.capacity ? `${stats.usedPax} / ${stats.capacity}` : String(stats.usedPax)} />
        <Cell label="Supplier Bill" value={formatCurrency(stats.supplierBill)} tone="text-warning" />
        <Cell label="Supplier Paid" value={formatCurrency(stats.supplierPaid)} tone="text-success" />
        <Cell label="Outstanding" value={formatCurrency(stats.supplierOutstanding)} tone="text-destructive" />
        <Cell label="Commission" value={formatCurrency(stats.commission)} />
      </div>

      <div className="glass-card grid grid-cols-2 gap-3 rounded-xl p-4 sm:grid-cols-5">
        <Cell label="Extras / Gifts" value={formatCurrency(stats.expenses)} tone="text-destructive" />
        <Cell label="Client Refunds" value={formatCurrency(stats.refunds)} tone="text-destructive" />
        <Cell label="Supplier Billed Pax" value={String(stats.billedPax)} />
        <Cell label="Net Profit" value={formatCurrency(stats.netProfit)} tone={stats.netProfit >= 0 ? "text-success" : "text-destructive"} />
        <Cell label="Margin" value={`${stats.margin.toFixed(1)}%`} tone={stats.margin >= 0 ? "text-success" : "text-destructive"} />
      </div>
      <p className="text-[10px] text-muted-foreground">
        Seat capacity counts CLIENT members only — supplier bills, purchases and extras never consume seats.
        Net Profit = Group Sales (net of refunds) − Supplier Bill − Agent Commission − Extras / Gifts
      </p>

      {/* Heads */}
      <Section title={`Heads in this group (${stats.heads.length})`}>
        {stats.heads.length === 0 && <Empty text="No booking is linked to this group yet." />}
        {stats.heads.map((h) => (
          <div key={h.headId} className="rounded-lg border border-border/50">
            <button onClick={() => setOpenHead(openHead === h.headId ? null : h.headId)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-accent/30">
              <div>
                <p className="text-xs font-semibold text-primary">{h.headId}</p>
                <p className="text-[10px] text-muted-foreground">{h.leadName} · {h.members} member{h.members === 1 ? "" : "s"} · {h.booking.packageType}</p>
              </div>
              <div className="flex items-center gap-4 text-[10px]">
                <span>Total <b className="text-primary">{formatCurrency(h.totalAmount)}</b></span>
                <span>Paid <b className="text-success">{formatCurrency(h.received)}</b></span>
                <span>Due <b className="text-destructive">{formatCurrency(h.pending)}</b></span>
                <StatusBadge status={h.booking.status} />
              </div>
            </button>
            {openHead === h.headId && (
              <div className="border-t border-border/50 p-3">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-left uppercase tracking-wide text-muted-foreground">
                      <th className="py-1">Client</th><th className="py-1">Name</th><th className="py-1">Type</th>
                      <th className="py-1">Passport</th><th className="py-1">Contact</th>
                      <th className="py-1 text-right">Due</th><th className="py-1 text-right">Paid</th><th className="py-1">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {h.clients.map((c) => (
                      <tr key={c.id} className="border-t border-border/40">
                        <td className="py-1 font-semibold text-primary">{c.id}</td>
                        <td className="py-1">{c.firstName} {c.lastName}</td>
                        <td className="py-1">{c.ageCategory || "Adult"}</td>
                        <td className="py-1">{c.passport || "—"}</td>
                        <td className="py-1">{c.phone || "—"}</td>
                        <td className="py-1 text-right">{formatCurrency(c.amountDue)}</td>
                        <td className="py-1 text-right text-success">{formatCurrency(c.amountPaid)}</td>
                        <td className="py-1"><StatusBadge status={c.paymentStatus} /></td>
                      </tr>
                    ))}
                    {h.clients.length === 0 && <tr><td colSpan={8} className="py-3 text-center text-muted-foreground">No member detail recorded.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </Section>

      {/* Supplier bill */}
      <Section title="Supplier Bill (purchases tagged to this group)">
        {stats.purchases.length === 0 && <Empty text="No purchase entry tagged to this group." />}
        {stats.billByCategory.map((c) => (
          <div key={c.category} className="space-y-1">
            <div className="flex items-center justify-between rounded-md bg-accent/30 px-3 py-1.5 text-[11px]">
              <span className="font-semibold uppercase tracking-wide text-primary">{c.category} · {c.count}</span>
              <span className="font-semibold text-warning">{formatCurrency(c.amount)}</span>
            </div>
            {stats.purchases.filter((p) => (p.serviceCategory || "Other") === c.category).map((p) => (
              <div key={p.id} className="flex items-center justify-between px-3 py-1 text-[11px] text-muted-foreground">
                <span>{p.date} · {p.referenceName} {p.note ? `· ${p.note}` : ""}</span>
                <span className="text-foreground">{formatCurrency(p.amount)}</span>
              </div>
            ))}
          </div>
        ))}
      </Section>

      {/* Payments */}
      <Section title="Supplier Payments">
        {stats.payments.length === 0 && <Empty text="No settlement recorded for this group." />}
        {stats.payments.map((p) => (
          <div key={p.id} className="flex items-center justify-between px-3 py-1 text-[11px]">
            <span className="text-muted-foreground">{p.date} · {p.referenceName} {p.note ? `· ${p.note}` : ""}</span>
            <span className="font-semibold text-success">{formatCurrency(p.amount)}</span>
          </div>
        ))}
      </Section>

      {/* Extras */}
      <Section
        title="Gifts & Extra Expenses"
        action={<Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={onAddExpense}><Gift className="h-3 w-3" /> Add</Button>}
      >
        {stats.groupExpenses.length === 0 && <Empty text="No gift or extra expense booked to this group." />}
        {stats.groupExpenses.map((e) => (
          <div key={e.id} className="flex items-center justify-between px-3 py-1 text-[11px]">
            <span className="text-muted-foreground">{e.date} · <b className="text-foreground">{e.headId}</b> · {e.referenceName}</span>
            <span className="font-semibold text-destructive">- {formatCurrency(e.amount)}</span>
          </div>
        ))}
      </Section>

      {/* Client receipts */}
      <Section title="Client Receipts (heads of this group)">
        {stats.receipts.length === 0 && <Empty text="No client receipt recorded." />}
        {stats.receipts.map((r) => (
          <div key={r.id} className="flex items-center justify-between px-3 py-1 text-[11px]">
            <span className="text-muted-foreground">{r.date} · {r.headId} · {r.referenceName}</span>
            <span className="font-semibold text-success">{formatCurrency(r.amount)}</span>
          </div>
        ))}
      </Section>
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between border-b border-border/60 pb-1">
        <h4 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</h4>
        {action}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-3 py-2 text-[11px] text-muted-foreground">{text}</p>;
}