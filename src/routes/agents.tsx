import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Plus, Trash2, Pencil, Eye, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import DetailDialog from "@/components/DetailDialog";
import { formatCurrency, type Agent } from "@/lib/data";
import { useStore } from "@/lib/store";
import { generateAgentReport } from "@/lib/pdf";
import { useState } from "react";
import StatementDialog from "@/components/StatementDialog";

export const Route = createFileRoute("/agents")({
  component: AgentsPage,
  head: () => ({ meta: [{ title: "Agents — AV Travel CRM" }] }),
});

function AgentsPage() {
  const store = useStore();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Agent | null>(null);
  const [stmtOpen, setStmtOpen] = useState(false);
  const [stmtAgent, setStmtAgent] = useState<Agent | null>(null);
  const [form, setForm] = useState({
    name: "", phone: "", email: "",
    status: "Active" as Agent["status"],
    openingSales: "", openingClients: "", openingCommission: "", openingPaidCommission: "",
  });

  function handleAdd() {
    store.addAgent({
      name: form.name, phone: form.phone, email: form.email,
      totalSales: 0, totalClients: 0, commission: 0, paidCommission: 0,
      status: form.status,
      openingSales: Number(form.openingSales) || 0,
      openingClients: Number(form.openingClients) || 0,
      openingCommission: Number(form.openingCommission) || 0,
      openingPaidCommission: Number(form.openingPaidCommission) || 0,
    });
    setForm({ name: "", phone: "", email: "", status: "Active", openingSales: "", openingClients: "", openingCommission: "", openingPaidCommission: "" });
    setAddOpen(false);
  }

  function handleEdit() {
    if (!selected) return;
    store.updateAgent(selected.id, {
      name: form.name, phone: form.phone, email: form.email, status: form.status,
      openingSales: Number(form.openingSales) || 0,
      openingClients: Number(form.openingClients) || 0,
      openingCommission: Number(form.openingCommission) || 0,
      openingPaidCommission: Number(form.openingPaidCommission) || 0,
    });
    setEditOpen(false);
  }

  function openEdit(a: Agent) {
    setSelected(a);
    setForm({
      name: a.name, phone: a.phone, email: a.email, status: a.status,
      openingSales: String(a.openingSales || 0),
      openingClients: String(a.openingClients || 0),
      openingCommission: String(a.openingCommission || 0),
      openingPaidCommission: String(a.openingPaidCommission || 0),
    });
    setEditOpen(true);
  }

  function openStmt(a: Agent) { setStmtAgent(a); setStmtOpen(true); }
  function downloadReport(a: Agent, range: { fromDate?: string; toDate?: string; includeOpening?: boolean; scope?: "client" | "other" | "both" }) {
    generateAgentReport(a, store.entries, { ...range, bookings: store.bookings, clients: store.clients });
  }

  // Agent ledger = own commission payouts + the CLIENT transactions of heads this agent brought.
  // Supplier purchases / payments / office expenses never belong in an agent ledger.
  const relatedEntries = (() => {
    if (!selected) return [];
    const agentHeads = new Set(store.bookings.filter((b) => b.agentId === selected.id).map((b) => b.headId));
    const clientTypes = new Set(["client_receive", "client_charge", "client_refund"]);
    return store.entries.filter(
      (e) =>
        (e.type === "agent_commission" && e.referenceId === selected.id) ||
        (clientTypes.has(e.type) && e.headId && agentHeads.has(e.headId)) ||
        (e.agentId === selected.id && e.type === "supplier_payment") ||
        (e.type === "purchase" && e.purchasedFor === "agent" && e.agentId === selected.id) ||
        (e.type === "other_sale" && e.referenceId === selected.id)
    );
  })();

  const formFields = (
    <div className="space-y-3">
      <div><Label className="text-xs">Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
        <div><Label className="text-xs">Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
      </div>
      <div><Label className="text-xs">Status</Label>
        <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Agent["status"] })}>
          <SelectTrigger className="bg-accent/20 border-border mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive</SelectItem></SelectContent>
        </Select>
      </div>
      <div className="border-t border-border/30 pt-3">
        <p className="text-xs font-semibold text-warning mb-2">Opening Balances (legacy / carry-forward)</p>
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">Previous Sales</Label><Input type="number" value={form.openingSales} onChange={(e) => setForm({ ...form, openingSales: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
          <div><Label className="text-xs">Previous Clients</Label><Input type="number" value={form.openingClients} onChange={(e) => setForm({ ...form, openingClients: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
          <div><Label className="text-xs">Previous Commission</Label><Input type="number" value={form.openingCommission} onChange={(e) => setForm({ ...form, openingCommission: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
          <div><Label className="text-xs">Previous Paid</Label><Input type="number" value={form.openingPaidCommission} onChange={(e) => setForm({ ...form, openingPaidCommission: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agent Management"
        subtitle={`${store.agents.length} agents`}
        actions={
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={() => setForm({ name: "", phone: "", email: "", status: "Active", openingSales: "", openingClients: "", openingCommission: "", openingPaidCommission: "" })}>
                <Plus className="h-4 w-4" /> Add Agent
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader><DialogTitle>Add New Agent</DialogTitle></DialogHeader>
              {formFields}
              <Button onClick={handleAdd} className="w-full">Add Agent</Button>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {store.agents.map((a, i) => (
          <motion.div key={a.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="glass-card glass-card-hover rounded-xl p-5 transition-all duration-300">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {a.name.split(" ").map((n) => n[0]).join("")}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={a.status} />
                <button onClick={() => { setSelected(a); setDetailOpen(true); }} className="rounded p-1 hover:bg-accent"><Eye className="h-3.5 w-3.5 text-primary" /></button>
                <button onClick={() => openStmt(a)} className="rounded p-1 hover:bg-accent" title="Download Statement"><Download className="h-3.5 w-3.5 text-success" /></button>
                <button onClick={() => openEdit(a)} className="rounded p-1 hover:bg-accent"><Pencil className="h-3.5 w-3.5 text-warning" /></button>
                <button onClick={() => store.deleteAgent(a.id)} className="rounded p-1 hover:bg-accent"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
              </div>
            </div>
            <h3 className="text-lg font-semibold">{a.name}</h3>
            <p className="text-xs text-muted-foreground">{a.id} · {a.email}</p>
            <p className="text-xs text-muted-foreground">{a.phone}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/50 pt-4">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Sales</p>
                <p className="text-sm font-semibold text-primary">{formatCurrency(a.totalSales + (a.openingSales || 0))}</p>
                {(a.openingSales || 0) > 0 && <p className="text-[9px] text-muted-foreground">incl. {formatCurrency(a.openingSales || 0)} B/F</p>}
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Clients</p>
                <p className="text-sm font-semibold">{a.totalClients + (a.openingClients || 0)}</p>
                {(a.openingClients || 0) > 0 && <p className="text-[9px] text-muted-foreground">incl. {a.openingClients} B/F</p>}
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Commission</p>
                <p className="text-sm font-semibold text-success">{formatCurrency(a.commission + (a.openingCommission || 0))}</p>
                {(a.openingCommission || 0) > 0 && <p className="text-[9px] text-muted-foreground">incl. {formatCurrency(a.openingCommission || 0)} B/F</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-border/50 pt-2">
              <div><p className="text-[10px] uppercase text-muted-foreground">Paid</p><p className="text-sm font-semibold text-success">{formatCurrency(a.paidCommission + (a.openingPaidCommission || 0))}</p></div>
              <div><p className="text-[10px] uppercase text-muted-foreground">Payable</p><p className="text-sm font-semibold text-destructive">{formatCurrency((a.commission + (a.openingCommission || 0)) - (a.paidCommission + (a.openingPaidCommission || 0)))}</p></div>
            </div>
            <button onClick={() => { setSelected(a); setDetailOpen(true); }}
              className="mt-3 w-full rounded-lg border border-border/50 px-3 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary">
              View · Clients, Business Account & Other Sale
            </button>
          </motion.div>
        ))}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Edit Agent — {selected?.id}</DialogTitle></DialogHeader>
          {formFields}
          <Button onClick={handleEdit} className="w-full">Save Changes</Button>
        </DialogContent>
      </Dialog>

      <DetailDialog open={detailOpen} onOpenChange={setDetailOpen} type="agent" data={selected} entries={relatedEntries} allClients={store.clients} allBookings={store.bookings} />

      <StatementDialog
        open={stmtOpen} onOpenChange={setStmtOpen}
        title={`Agent Statement — ${stmtAgent?.name || ""}`}
        subtitle="Pick a period and what to include. Opening balance, receipts and remaining balance are calculated automatically."
        showScope
        onDownload={(range) => stmtAgent && downloadReport(stmtAgent, range)}
      />
    </div>
  );
}
