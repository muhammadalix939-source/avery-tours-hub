import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Plus, Trash2, Pencil, Eye, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import DetailDialog from "@/components/DetailDialog";
import { formatCurrency, SERVICE_TYPES, type Supplier } from "@/lib/data";
import { useStore } from "@/lib/store";
import { generateSupplierLedger } from "@/lib/pdf";
import { useState } from "react";
import StatementDialog from "@/components/StatementDialog";

export const Route = createFileRoute("/suppliers")({
  component: SuppliersPage,
  head: () => ({ meta: [{ title: "Suppliers — AV Travel CRM" }] }),
});

function SuppliersPage() {
  const store = useStore();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [stmtOpen, setStmtOpen] = useState(false);
  const [stmtSupplier, setStmtSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState({
    companyName: "", contactPerson: "", phone: "", email: "",
    serviceTypes: ["Hotel"] as string[],
    totalPayable: "", totalPaid: "",
    openingPayable: "", openingPaid: "",
  });

  const resetSupplierForm = () => setForm({ companyName: "", contactPerson: "", phone: "", email: "", serviceTypes: ["Hotel"], totalPayable: "", totalPaid: "", openingPayable: "", openingPaid: "" });

  function toggleService(service: string) {
    const next = form.serviceTypes.includes(service)
      ? form.serviceTypes.filter((item) => item !== service)
      : [...form.serviceTypes, service];
    setForm({ ...form, serviceTypes: next.length ? next : [service] });
  }

  function handleAdd() {
    store.addSupplier({
      companyName: form.companyName, contactPerson: form.contactPerson, phone: form.phone, email: form.email,
      serviceType: form.serviceTypes.join(", "),
      totalPayable: Number(form.totalPayable) || 0,
      totalPaid: Number(form.totalPaid) || 0,
      openingPayable: Number(form.openingPayable) || 0,
      openingPaid: Number(form.openingPaid) || 0,
    });
    resetSupplierForm();
    setAddOpen(false);
  }

  function handleEdit() {
    if (!selected) return;
    store.updateSupplier(selected.id, {
      companyName: form.companyName, contactPerson: form.contactPerson, phone: form.phone, email: form.email,
      serviceType: form.serviceTypes.join(", "),
      totalPayable: Number(form.totalPayable) || 0,
      totalPaid: Number(form.totalPaid) || 0,
      openingPayable: Number(form.openingPayable) || 0,
      openingPaid: Number(form.openingPaid) || 0,
    });
    setEditOpen(false);
  }

  function openEdit(s: Supplier) {
    setSelected(s);
    setForm({
      companyName: s.companyName, contactPerson: s.contactPerson, phone: s.phone, email: s.email,
      serviceTypes: s.serviceType.split(",").map((item) => item.trim()).filter(Boolean),
      totalPayable: String(s.totalPayable), totalPaid: String(s.totalPaid),
      openingPayable: String(s.openingPayable || 0), openingPaid: String(s.openingPaid || 0),
    });
    setEditOpen(true);
  }

  function openStmt(s: Supplier) { setStmtSupplier(s); setStmtOpen(true); }
  function downloadLedger(s: Supplier, range: { fromDate?: string; toDate?: string; includeOpening?: boolean; groupId?: string; groupLabel?: string }) {
    const supplierEntries = store.entries.filter((e) => e.referenceId === s.id);
    generateSupplierLedger(s, supplierEntries, range);
  }

  const stmtGroups = stmtSupplier
    ? store.groups
        .filter((g) => !g.supplierId || g.supplierId === stmtSupplier.id)
        .map((g) => ({
          id: g.id,
          label: `${g.id} — ${g.name}`,
          hint: [g.category, g.pnr && `PNR ${g.pnr}`, g.flightNumber, g.date].filter(Boolean).join(" · "),
        }))
    : [];

  const relatedEntries = selected ? store.entries.filter((e) => e.referenceId === selected.id) : [];

  const formFields = (
    <div className="space-y-3">
      <div><Label className="text-xs">Company Name</Label><Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
      <div><Label className="text-xs">Contact Person</Label><Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
        <div><Label className="text-xs">Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
      </div>
      <div><Label className="text-xs">Service Types</Label>
        <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg border border-border/50 bg-accent/10 p-3 sm:grid-cols-3">
          {SERVICE_TYPES.map((s) => (
            <label key={s} className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox checked={form.serviceTypes.includes(s)} onCheckedChange={() => toggleService(s)} />
              <span>{s}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Total Payable (PKR)</Label><Input type="number" value={form.totalPayable} onChange={(e) => setForm({ ...form, totalPayable: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
        <div><Label className="text-xs">Total Paid (PKR)</Label><Input type="number" value={form.totalPaid} onChange={(e) => setForm({ ...form, totalPaid: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3 border-t border-border/30 pt-3">
        <div>
          <Label className="text-xs text-warning">Opening Payable (carry-forward)</Label>
          <Input type="number" value={form.openingPayable} onChange={(e) => setForm({ ...form, openingPayable: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" />
        </div>
        <div>
          <Label className="text-xs text-warning">Opening Paid</Label>
          <Input type="number" value={form.openingPaid} onChange={(e) => setForm({ ...form, openingPaid: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supplier Management"
        subtitle={`${store.suppliers.length} suppliers`}
        actions={
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={resetSupplierForm}>
                <Plus className="h-4 w-4" /> Add Supplier
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader><DialogTitle>Add New Supplier</DialogTitle></DialogHeader>
              {formFields}
              <Button onClick={handleAdd} className="w-full">Add Supplier</Button>
            </DialogContent>
          </Dialog>
        }
      />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">ID</th><th className="px-4 py-3">Company</th><th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Service</th><th className="px-4 py-3">Payable</th><th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3">Remaining</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {store.suppliers.map((s) => {
                const payable = s.totalPayable + (s.openingPayable || 0);
                const paid = s.totalPaid + (s.openingPaid || 0);
                const remaining = payable - paid;
                const status = remaining <= 0 ? "Paid" : paid > 0 ? "Partial" : "Unpaid";
                return (
                  <tr key={s.id} className="border-b border-border/50 transition-colors hover:bg-accent/30">
                    <td className="px-4 py-3 font-semibold text-primary">{s.id}</td>
                    <td className="px-4 py-3 font-medium">{s.companyName}</td>
                    <td className="px-4 py-3"><p className="text-sm">{s.contactPerson}</p><p className="text-xs text-muted-foreground">{s.phone}</p></td>
                    <td className="px-4 py-3">{s.serviceType}</td>
                    <td className="px-4 py-3"><p>{formatCurrency(payable)}</p>{(s.openingPayable || 0) > 0 && <p className="text-[9px] text-muted-foreground">incl. {formatCurrency(s.openingPayable || 0)} B/F</p>}</td>
                    <td className="px-4 py-3 text-success"><p>{formatCurrency(paid)}</p>{(s.openingPaid || 0) > 0 && <p className="text-[9px] text-muted-foreground">incl. {formatCurrency(s.openingPaid || 0)} B/F</p>}</td>
                    <td className="px-4 py-3 text-destructive">{formatCurrency(remaining)}</td>
                    <td className="px-4 py-3"><StatusBadge status={status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => { setSelected(s); setDetailOpen(true); }} className="rounded p-1 hover:bg-accent"><Eye className="h-3.5 w-3.5 text-primary" /></button>
                        <button onClick={() => openStmt(s)} className="rounded p-1 hover:bg-accent" title="Download Statement"><Download className="h-3.5 w-3.5 text-success" /></button>
                        <button onClick={() => openEdit(s)} className="rounded p-1 hover:bg-accent"><Pencil className="h-3.5 w-3.5 text-warning" /></button>
                        <button onClick={() => store.deleteSupplier(s.id)} className="rounded p-1 hover:bg-accent"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {store.suppliers.map((s, i) => {
          const payable = s.totalPayable + (s.openingPayable || 0);
          const paid = s.totalPaid + (s.openingPaid || 0);
          const remaining = payable - paid;
          const paidPercent = payable > 0 ? Math.min(100, Math.round((paid / payable) * 100)) : 0;
          return (
            <motion.div key={s.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="glass-card rounded-xl p-5">
              <div className="mb-3 flex items-center justify-between"><div><h3 className="text-sm font-semibold">{s.companyName}</h3><p className="text-[10px] text-muted-foreground">{s.serviceType}</p></div><span className="text-xs text-muted-foreground">{s.id}</span></div>
              <div className="mb-2 h-2 overflow-hidden rounded-full bg-accent/30"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${paidPercent}%` }} /></div>
              <div className="grid grid-cols-3 gap-2 border-t border-border/50 pt-3 text-xs">
                <div><p className="text-[10px] uppercase text-muted-foreground">Payable</p><p className="font-semibold text-primary">{formatCurrency(payable)}</p>{(s.openingPayable || 0) > 0 && <p className="text-[9px] text-muted-foreground">incl. {formatCurrency(s.openingPayable || 0)} B/F</p>}</div>
                <div><p className="text-[10px] uppercase text-muted-foreground">Paid</p><p className="font-semibold text-success">{formatCurrency(paid)}</p>{(s.openingPaid || 0) > 0 && <p className="text-[9px] text-muted-foreground">incl. {formatCurrency(s.openingPaid || 0)} B/F</p>}</div>
                <div><p className="text-[10px] uppercase text-muted-foreground">Remaining</p><p className="font-semibold text-destructive">{formatCurrency(remaining)}</p></div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Edit Supplier — {selected?.id}</DialogTitle></DialogHeader>
          {formFields}
          <Button onClick={handleEdit} className="w-full">Save Changes</Button>
        </DialogContent>
      </Dialog>

      <DetailDialog open={detailOpen} onOpenChange={setDetailOpen} type="supplier" data={selected} entries={relatedEntries} allClients={store.clients} allBookings={store.bookings} />

      <StatementDialog
        open={stmtOpen} onOpenChange={setStmtOpen}
        title={`Supplier Statement — ${stmtSupplier?.companyName || ""}`}
        subtitle="Choose date range, all-time, or filter by group. Includes hotel/flight/visa/transport sections."
        groups={stmtGroups}
        onDownload={(range) => stmtSupplier && downloadLedger(stmtSupplier, range)}
      />
    </div>
  );
}
