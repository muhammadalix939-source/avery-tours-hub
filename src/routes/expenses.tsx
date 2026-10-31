import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Plus, Trash2, Pencil, Download, Receipt, Wallet, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import PageHeader from "@/components/PageHeader";
import { formatCurrency } from "@/lib/data";
import { useStore, type LedgerEntry } from "@/lib/store";
import { getPKTDate } from "@/lib/date-utils";
import { generatePaymentReceipt } from "@/lib/pdf";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/expenses")({
  component: ExpensesPage,
  head: () => ({ meta: [{ title: "Expenses — AV Travel CRM" }] }),
});

const CATEGORIES = [
  "Office Rent", "Utilities", "Salaries", "Marketing", "Stationery",
  "Travel", "Meals", "Software / Subscriptions", "Maintenance", "Bank Charges", "Other",
] as const;

function ExpensesPage() {
  const store = useStore();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<LedgerEntry | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [form, setForm] = useState({ date: "", category: "Office Rent", referenceName: "", amount: "", note: "", groupId: "" });

  const expenses = useMemo(
    () => store.entries.filter((e) => e.type === "expense").sort((a, b) => b.date.localeCompare(a.date)),
    [store.entries]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((e) => {
      if (category !== "All" && (e.headId || "Other") !== category) return false;
      if (!q) return true;
      return (e.referenceName + " " + e.note + " " + e.id).toLowerCase().includes(q);
    });
  }, [expenses, search, category]);

  const total = useMemo(() => filtered.reduce((s, e) => s + e.amount, 0), [filtered]);
  const monthTotal = useMemo(() => {
    const m = new Date().toISOString().slice(0, 7);
    return expenses.filter((e) => e.date.startsWith(m)).reduce((s, e) => s + e.amount, 0);
  }, [expenses]);

  function handleAdd() {
    store.addEntry({
      date: form.date || getPKTDate(),
      type: "expense",
      headId: form.category, // we use headId column to store category for filtering
      referenceId: "",
      referenceName: form.referenceName || form.category,
      amount: Number(form.amount) || 0,
      note: form.note,
      groupId: form.groupId || undefined,
    });
    setForm({ date: "", category: "Office Rent", referenceName: "", amount: "", note: "", groupId: "" });
    setAddOpen(false);
  }

  function handleEdit() {
    if (!selected) return;
    store.updateEntry(selected.id, {
      date: form.date,
      headId: form.category,
      referenceName: form.referenceName,
      amount: Number(form.amount) || 0,
      note: form.note,
      groupId: form.groupId || undefined,
    });
    setEditOpen(false);
  }

  function openEdit(e: LedgerEntry) {
    setSelected(e);
    setForm({ date: e.date, category: e.headId || "Other", referenceName: e.referenceName, amount: String(e.amount), note: e.note, groupId: e.groupId || "" });
    setEditOpen(true);
  }

  const formFields = (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="bg-accent/20 border-border mt-1 h-9" /></div>
        <div><Label className="text-xs">Category</Label>
          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
            <SelectTrigger className="bg-accent/20 border-border mt-1 h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
          </Select>
        </div>
      </div>
      <div><Label className="text-xs">Description</Label><Input value={form.referenceName} onChange={(e) => setForm({ ...form, referenceName: e.target.value })} placeholder="e.g. April Office Rent" className="bg-accent/20 border-border mt-1 h-9" /></div>
      <div><Label className="text-xs">Amount (PKR)</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="bg-accent/20 border-border mt-1 h-9" /></div>
      <div><Label className="text-xs">Note</Label><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="bg-accent/20 border-border mt-1 h-9" /></div>
      <div><Label className="text-xs">Tag to Group (optional)</Label>
        <Select value={form.groupId || "none"} onValueChange={(v) => setForm({ ...form, groupId: v === "none" ? "" : v })}>
          <SelectTrigger className="bg-accent/20 border-border mt-1 h-9 text-xs"><SelectValue placeholder="No group" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No group (general expense)</SelectItem>
            {store.groups.map((g) => (<SelectItem key={g.id} value={g.id}>{g.id} — {g.name}</SelectItem>))}
          </SelectContent>
        </Select>
        <p className="mt-1 text-[10px] text-muted-foreground">Group-tagged expenses (gifts, kits, hospitality) reduce that group's net profit.</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        subtitle="Track every outflow professionally"
        actions={
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={() => setForm({ date: getPKTDate(), category: "Office Rent", referenceName: "", amount: "", note: "", groupId: "" })}>
                <Plus className="h-4 w-4" /> New Expense
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
              {formFields}
              <Button onClick={handleAdd} className="w-full">Submit</Button>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-3"><Receipt className="h-5 w-5 text-primary" /><div>
            <p className="text-[10px] uppercase text-muted-foreground">Total Records</p>
            <p className="text-xl font-bold">{filtered.length}</p>
          </div></div>
        </div>
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-3"><TrendingDown className="h-5 w-5 text-destructive" /><div>
            <p className="text-[10px] uppercase text-muted-foreground">Filtered Total</p>
            <p className="text-xl font-bold text-destructive">{formatCurrency(total)}</p>
          </div></div>
        </div>
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-3"><Wallet className="h-5 w-5 text-warning" /><div>
            <p className="text-[10px] uppercase text-muted-foreground">This Month</p>
            <p className="text-xl font-bold text-warning">{formatCurrency(monthTotal)}</p>
          </div></div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Search expenses..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-64 bg-accent/20 border-border" />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-48 bg-accent/20 border-border text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Categories</SelectItem>
            {CATEGORIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl">
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card/95 backdrop-blur z-10">
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">ID</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Description</th><th className="px-4 py-3">Note</th>
                <th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-b border-border/50 hover:bg-accent/30">
                  <td className="px-4 py-3 font-semibold text-primary">{e.id}</td>
                  <td className="px-4 py-3">{e.date}</td>
                  <td className="px-4 py-3"><span className="rounded-md bg-accent/30 px-2 py-1 text-[10px] font-semibold uppercase text-warning">{e.headId || "Other"}</span></td>
                  <td className="px-4 py-3 font-medium">{e.referenceName}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs max-w-[240px] truncate">{e.note}</td>
                  <td className="px-4 py-3 text-right font-semibold text-destructive">- {formatCurrency(e.amount)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => generatePaymentReceipt(e)} className="rounded p-1 hover:bg-accent" title="Receipt"><Download className="h-3.5 w-3.5 text-success" /></button>
                      <button onClick={() => openEdit(e)} className="rounded p-1 hover:bg-accent"><Pencil className="h-3.5 w-3.5 text-warning" /></button>
                      <button onClick={() => store.deleteEntry(e.id)} className="rounded p-1 hover:bg-accent"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">No expenses match the filter.</td></tr>
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="bg-accent/20">
                <tr><td colSpan={5} className="px-4 py-3 text-right text-xs font-bold uppercase">Total</td>
                  <td className="px-4 py-3 text-right font-bold text-destructive">{formatCurrency(total)}</td><td /></tr>
              </tfoot>
            )}
          </table>
        </div>
      </motion.div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Edit Expense — {selected?.id}</DialogTitle></DialogHeader>
          {formFields}
          <Button onClick={handleEdit} className="w-full">Save Changes</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
