import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Plus, Phone, Trash2, Pencil, Eye, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import DetailDialog from "@/components/DetailDialog";
import ChecklistBadge from "@/components/ChecklistBadge";
import ClientChecklistPanel from "@/components/ClientChecklistPanel";
import ConfirmDelete from "@/components/ConfirmDelete";
import { formatCurrency, getClientName, PACKAGE_TYPES, type Client } from "@/lib/data";
import { useStore } from "@/lib/store";
import { generateClientStatement } from "@/lib/pdf";
import { useState } from "react";

export const Route = createFileRoute("/clients")({
  component: ClientsPage,
  head: () => ({ meta: [{ title: "Clients — AV Travel CRM" }] }),
});

function ClientsPage() {
  const store = useStore();
  const [filter, setFilter] = useState("All");
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Client | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [form, setForm] = useState({
    headId: "", firstName: "", lastName: "", gender: "Male" as Client["gender"],
    nationality: "", passport: "", cnic: "", dateOfBirth: "", dateOfIssue: "", dateOfExpire: "",
    phone: "", email: "", packageType: "Umrah" as Client["packageType"],
    amountDue: "", isVip: false, destination: "", driveLink: "",
  });

  const filtered = filter === "All" ? store.clients : store.clients.filter((c) => c.paymentStatus === filter);

  const emptyForm = {
    headId: "", firstName: "", lastName: "", gender: "Male" as Client["gender"],
    nationality: "", passport: "", cnic: "", dateOfBirth: "", dateOfIssue: "", dateOfExpire: "",
    phone: "", email: "", packageType: "Umrah" as Client["packageType"],
    amountDue: "", isVip: false, destination: "", driveLink: "",
  };

  function handleAdd() {
    store.addClient({
      headId: form.headId, firstName: form.firstName, lastName: form.lastName,
      gender: form.gender, nationality: form.nationality, passport: form.passport,
      cnic: form.cnic, dateOfBirth: form.dateOfBirth, dateOfIssue: form.dateOfIssue,
      dateOfExpire: form.dateOfExpire, phone: form.phone, email: form.email,
      packageType: form.packageType, paymentStatus: "Unpaid",
      amountDue: Number(form.amountDue) || 0, amountPaid: 0,
      isVip: form.isVip, destination: form.destination, driveLink: form.driveLink,
    });
    setForm(emptyForm);
    setAddOpen(false);
  }

  function handleEdit() {
    if (!selected) return;
    store.updateClient(selected.id, {
      headId: form.headId, firstName: form.firstName, lastName: form.lastName,
      gender: form.gender, nationality: form.nationality, passport: form.passport,
      cnic: form.cnic, dateOfBirth: form.dateOfBirth, dateOfIssue: form.dateOfIssue,
      dateOfExpire: form.dateOfExpire, phone: form.phone, email: form.email,
      packageType: form.packageType, amountDue: Number(form.amountDue) || 0,
      isVip: form.isVip, destination: form.destination, driveLink: form.driveLink,
    });
    setEditOpen(false);
  }

  function openEdit(c: Client) {
    setSelected(c);
    setForm({
      headId: c.headId, firstName: c.firstName, lastName: c.lastName,
      gender: c.gender, nationality: c.nationality || "", passport: c.passport,
      cnic: c.cnic || "", dateOfBirth: c.dateOfBirth || "", dateOfIssue: c.dateOfIssue || "",
      dateOfExpire: c.dateOfExpire || "", phone: c.phone, email: c.email || "",
      packageType: c.packageType, amountDue: String(c.amountDue),
      isVip: c.isVip, destination: c.destination || "", driveLink: c.driveLink || "",
    });
    setEditOpen(true);
  }

  function downloadStatement(c: Client) {
    const entries = store.entries.filter((e) => e.referenceId === c.id || e.headId === c.headId);
    generateClientStatement(c, entries);
  }

  const relatedEntries = selected ? store.entries.filter((e) => e.referenceId === selected.id || e.headId === selected.headId) : [];

  const formFields = (
    <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Head ID</Label><Input value={form.headId} onChange={(e) => setForm({ ...form, headId: e.target.value })} placeholder="AV-HD-001" className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
        <div><Label className="text-xs">Nationality</Label><Input value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} placeholder="e.g. Pakistani" className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><Label className="text-xs">First Name</Label><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
        <div><Label className="text-xs">Last Name</Label><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
        <div><Label className="text-xs">Gender</Label>
          <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v as Client["gender"] })}>
            <SelectTrigger className="bg-accent/20 border-border mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem><SelectItem value="Custom">Custom</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Passport Number</Label><Input value={form.passport} onChange={(e) => setForm({ ...form, passport: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
        <div><Label className="text-xs">CNIC</Label><Input value={form.cnic} onChange={(e) => setForm({ ...form, cnic: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><Label className="text-xs">Date of Birth</Label><Input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
        <div><Label className="text-xs">Date of Issue</Label><Input type="date" value={form.dateOfIssue} onChange={(e) => setForm({ ...form, dateOfIssue: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
        <div><Label className="text-xs">Date of Expire</Label><Input type="date" value={form.dateOfExpire} onChange={(e) => setForm({ ...form, dateOfExpire: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Contact</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
        <div><Label className="text-xs">Email (optional)</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Package Type</Label>
          <Select value={form.packageType} onValueChange={(v) => setForm({ ...form, packageType: v as Client["packageType"] })}>
            <SelectTrigger className="bg-accent/20 border-border mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PACKAGE_TYPES.map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Amount Due (PKR)</Label><Input type="number" value={form.amountDue} onChange={(e) => setForm({ ...form, amountDue: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
      </div>
      <div><Label className="text-xs">Destination</Label><Input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="Makkah / Madinah" className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
      <div><Label className="text-xs">Drive Link (optional)</Label><Input value={form.driveLink} onChange={(e) => setForm({ ...form, driveLink: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={form.isVip} onChange={(e) => setForm({ ...form, isVip: e.target.checked })} className="rounded" />
        <Label className="text-xs">VIP Client</Label>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client Management"
        subtitle={`${store.clients.length} total clients`}
        actions={
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={() => setForm(emptyForm)}>
                <Plus className="h-4 w-4" /> Add Client
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-lg">
              <DialogHeader><DialogTitle>Add New Client</DialogTitle></DialogHeader>
              {formFields}
              <Button onClick={handleAdd} className="w-full">Add Client</Button>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex flex-wrap gap-2">
        {["All", "Paid", "Partial", "Unpaid"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-4 py-2 text-xs font-medium transition-all ${filter === f ? "bg-primary text-primary-foreground" : "bg-accent/30 text-muted-foreground hover:bg-accent/50"}`}>{f}</button>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Client ID</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Head ID</th>
                <th className="px-4 py-3">Phone</th><th className="px-4 py-3">Package</th><th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3">Due</th><th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Services</th><th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-border/50 transition-colors hover:bg-accent/30">
                  <td className="px-4 py-3 font-semibold text-primary">{c.id}</td>
                  <td className="px-4 py-3 font-medium">{getClientName(c)} {c.isVip && "⭐"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.headId}</td>
                  <td className="px-4 py-3 text-muted-foreground"><span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span></td>
                  <td className="px-4 py-3">{c.packageType}</td>
                  <td className="px-4 py-3 text-success">{formatCurrency(c.amountPaid)}</td>
                  <td className="px-4 py-3 text-destructive">{formatCurrency(c.amountDue - c.amountPaid)}</td>
                  <td className="px-4 py-3"><StatusBadge status={c.paymentStatus} /></td>
                  <td className="px-4 py-3"><ChecklistBadge client={c} compact /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => { setSelected(c); setDetailOpen(true); }} className="rounded p-1 hover:bg-accent"><Eye className="h-3.5 w-3.5 text-primary" /></button>
                      <button onClick={() => downloadStatement(c)} className="rounded p-1 hover:bg-accent" title="Download Statement"><Download className="h-3.5 w-3.5 text-success" /></button>
                      <button onClick={() => openEdit(c)} className="rounded p-1 hover:bg-accent"><Pencil className="h-3.5 w-3.5 text-warning" /></button>
                      <button onClick={() => setDeleteTarget(c)} className="rounded p-1 hover:bg-accent"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[88vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Client — {selected?.id}</DialogTitle></DialogHeader>
          {formFields}
          {selected && <div className="mt-2"><ClientChecklistPanel client={selected} /></div>}
          <Button onClick={handleEdit} className="w-full">Save Changes</Button>
        </DialogContent>
      </Dialog>

      <ConfirmDelete
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title={`Delete ${deleteTarget ? getClientName(deleteTarget) : "client"}?`}
        description="This client record, along with their service checklist, will be permanently removed."
        onConfirm={() => { if (deleteTarget) store.deleteClient(deleteTarget.id); setDeleteTarget(null); }}
      />

      <DetailDialog open={detailOpen} onOpenChange={setDetailOpen} type="client" data={selected} entries={relatedEntries} allClients={store.clients} allBookings={store.bookings} />
    </div>
  );
}
