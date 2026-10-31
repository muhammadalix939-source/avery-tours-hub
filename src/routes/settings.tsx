import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Save, Settings as SettingsIcon, Trash2, AlertTriangle, Database, Cloud, RefreshCw, CheckCircle2, LogIn, LogOut, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import PageHeader from "@/components/PageHeader";
import { useStore } from "@/lib/store";
import { formatCurrency } from "@/lib/data";
import { toast } from "sonner";
import { auth, onAuthStateChanged, signInWithGoogle, logOut, testConnection, type User } from "@/lib/firebase";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings — Avery Group of Travel" }] }),
});

function SettingsPage() {
  const store = useStore();
  const [user, setUser] = useState<User | null>(null);
  const [mounted, setMounted] = useState(false);
  const [testingConn, setTestingConn] = useState(false);
  const [connStatus, setConnStatus] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  const [form, setForm] = useState({
    revenue: String(store.opening.revenue || 0),
    pending: String(store.opening.pending || 0),
    bookings: String(store.opening.bookings || 0),
    clients: String(store.opening.clients || 0),
    supplierDue: String(store.opening.supplierDue || 0),
    profit: String(store.opening.profit || 0),
    cost: String(store.opening.cost || 0),
    expenses: String(store.opening.expenses || 0),
    commission: String(store.opening.commission || 0),
    cash: String(store.opening.cash || 0),
    note: store.opening.note || "",
  });

  function save() {
    store.setOpeningBalances({
      revenue: Number(form.revenue) || 0,
      pending: Number(form.pending) || 0,
      bookings: Number(form.bookings) || 0,
      clients: Number(form.clients) || 0,
      supplierDue: Number(form.supplierDue) || 0,
      profit: Number(form.profit) || 0,
      cost: Number(form.cost) || 0,
      expenses: Number(form.expenses) || 0,
      commission: Number(form.commission) || 0,
      cash: Number(form.cash) || 0,
      note: form.note,
    });
    toast.success("Opening balances saved");
  }

  function reset() {
    setForm({ revenue: "0", pending: "0", bookings: "0", clients: "0", supplierDue: "0", profit: "0", cost: "0", expenses: "0", commission: "0", cash: "0", note: "" });
  }

  function wipeAll(keepOpening: boolean) {
    const msg = keepOpening
      ? "This will permanently delete all clients, bookings, agents, suppliers, entries and monthly history. Opening balances will be kept. Continue?"
      : "This will permanently delete EVERYTHING (including opening balances) and reset the system to a true blank slate. Continue?";
    if (!confirm(msg)) return;
    store.resetAllData({ keepOpening });
    if (!keepOpening) setForm({ revenue: "0", pending: "0", bookings: "0", clients: "0", supplierDue: "0", profit: "0", cost: "0", expenses: "0", commission: "0", cash: "0", note: "" });
    toast.success(keepOpening ? "All operational data cleared." : "System fully reset to blank slate.");
  }

  const fields: Array<[keyof typeof form, string, string]> = [
    ["revenue", "Opening Revenue (PKR)", "Cash already collected before this system"],
    ["cost", "Opening Cost of Sales (PKR)", "Supplier cost of those old sales — must be filled if Opening Revenue is filled, otherwise profit inflates"],
    ["expenses", "Opening Expenses (PKR)", "Office / operating expenses already incurred"],
    ["commission", "Opening Agent Commission (PKR)", "Commission already earned by agents on old sales"],
    ["cash", "Opening Cash / Bank (PKR)", "Actual money in hand + bank when you started using this system"],
    ["pending", "Opening Pending (PKR)", "Outstanding receivables from old bookings"],
    ["bookings", "Opening Bookings (count)", "Historical booking count"],
    ["clients", "Opening Clients (count)", "Historical client count"],
    ["supplierDue", "Opening Supplier Due (PKR)", "What you still owe legacy suppliers"],
    ["profit", "Profit Adjustment (PKR)", "Manual correction only — leave 0 if you filled Opening Revenue/Cost/Expenses above"],
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Edit dashboard opening balances and business defaults" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3 border-b border-border/50 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <SettingsIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Dashboard Opening Balances</h2>
            <p className="text-xs text-muted-foreground">
              These values are added on top of your live data so the dashboard reflects your full business
              history (including records that aren't entered into the system yet).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map(([key, label, hint]) => (
            <div key={key}>
              <Label className="text-xs font-semibold">{label}</Label>
              <Input
                type="number"
                value={form[key] as string}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="bg-accent/20 border-border mt-1 h-9 text-sm"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>
            </div>
          ))}
        </div>

        <div>
          <Label className="text-xs font-semibold">Notes (optional)</Label>
          <Textarea
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            className="bg-accent/20 border-border mt-1 text-sm"
            placeholder="Any internal notes about how these baseline numbers were calculated…"
            rows={3}
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={save} className="gap-2"><Save className="h-4 w-4" /> Save Opening Balances</Button>
          <Button onClick={reset} variant="outline">Reset to zero</Button>
        </div>

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <p className="text-xs font-semibold text-primary mb-2">Live Preview</p>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            <Stat label="Revenue baseline" value={formatCurrency(Number(form.revenue) || 0)} />
            <Stat label="Cost baseline" value={formatCurrency(Number(form.cost) || 0)} />
            <Stat label="Expenses baseline" value={formatCurrency(Number(form.expenses) || 0)} />
            <Stat label="Commission baseline" value={formatCurrency(Number(form.commission) || 0)} />
            <Stat label="Cash baseline" value={formatCurrency(Number(form.cash) || 0)} />
            <Stat
              label="Opening gross profit"
              value={formatCurrency((Number(form.revenue) || 0) - (Number(form.cost) || 0) - (Number(form.expenses) || 0) - (Number(form.commission) || 0))}
            />
            <Stat label="Pending baseline" value={formatCurrency(Number(form.pending) || 0)} />
            <Stat label="Bookings baseline" value={String(Number(form.bookings) || 0)} />
            <Stat label="Clients baseline" value={String(Number(form.clients) || 0)} />
            <Stat label="Supplier due baseline" value={formatCurrency(Number(form.supplierDue) || 0)} />
            <Stat label="Profit adjustment" value={formatCurrency(Number(form.profit) || 0)} />
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="glass-card rounded-xl p-6">
        <h3 className="text-sm font-semibold mb-2">Per-entity opening balances</h3>
        <p className="text-xs text-muted-foreground">
          Opening balances for individual <span className="text-primary font-medium">agents</span>,
          <span className="text-primary font-medium"> suppliers</span> and
          <span className="text-primary font-medium"> clients</span> are set inside each record's edit form
          (Previous Commission, Previous Payable, etc). These flow into their statements automatically.
        </p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="glass-card rounded-xl p-6 space-y-4 border-primary/30">
        <div className="flex items-center justify-between border-b border-border/50 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Database className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold">Cloud Database (Google Cloud Firestore)</h3>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${mounted && user ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-amber-500/10 text-amber-400 border border-amber-500/30"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${mounted && user ? "bg-emerald-400" : "bg-amber-400"}`} />
                  {mounted && user ? "Cloud Synced" : "Provisioned & Ready"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Persistent enterprise cloud storage enabled for multi-user and real-time CRM updates.
              </p>
            </div>
          </div>

          <div>
            {mounted && user ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground hidden sm:inline">Signed in as <strong className="text-foreground">{user.email}</strong></span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await logOut();
                    setUser(null);
                    toast.info("Signed out of Cloud DB");
                  }}
                  className="gap-1.5 text-xs h-8"
                >
                  <LogOut className="h-3.5 w-3.5" /> Sign Out
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    const u = await signInWithGoogle();
                    setUser(u);
                    toast.success(`Connected as ${u.email}`);
                    await store.syncToCloud();
                  } catch (err: unknown) {
                    toast.error(err instanceof Error ? err.message : "Sign-in failed");
                  }
                }}
                className="gap-1.5 text-xs h-8"
              >
                <LogIn className="h-3.5 w-3.5" /> Connect with Google
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
          <div className="rounded-lg bg-background/50 p-3 border border-border/40">
            <p className="text-[10px] uppercase font-semibold text-muted-foreground">Cloud Project</p>
            <p className="font-mono text-xs text-foreground mt-0.5">xanthic-indexer-c01dl</p>
          </div>
          <div className="rounded-lg bg-background/50 p-3 border border-border/40">
            <p className="text-[10px] uppercase font-semibold text-muted-foreground">Database Engine</p>
            <p className="text-xs text-foreground mt-0.5">Firestore (Enterprise Free Tier)</p>
          </div>
          <div className="rounded-lg bg-background/50 p-3 border border-border/40">
            <p className="text-[10px] uppercase font-semibold text-muted-foreground">Last Cloud Sync</p>
            <p className="text-xs text-foreground mt-0.5">{mounted && store.lastSyncedAt ? store.lastSyncedAt : "Pending manual/auto sync"}</p>
          </div>
        </div>

        {connStatus && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
            <span>{connStatus}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            disabled={testingConn}
            onClick={async () => {
              setTestingConn(true);
              try {
                const res = await testConnection();
                setConnStatus(res.message);
                toast.success(res.message);
              } catch (e: unknown) {
                toast.error(e instanceof Error ? e.message : "Connection failed");
              } finally {
                setTestingConn(false);
              }
            }}
            className="gap-2 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${testingConn ? "animate-spin" : ""}`} />
            Test Connection
          </Button>

          <Button
            size="sm"
            disabled={store.cloudSyncStatus === "syncing"}
            onClick={async () => {
              if (!user) {
                toast.info("Please connect your Google Account first to authenticate cloud writes");
                return;
              }
              try {
                toast.loading("Uploading CRM state to Firestore...", { id: "sync-toast" });
                await store.syncToCloud();
                toast.success("All data uploaded and backed up to Firestore!", { id: "sync-toast" });
              } catch (e: unknown) {
                toast.error(e instanceof Error ? e.message : "Upload failed", { id: "sync-toast" });
              }
            }}
            className="gap-2 text-xs"
          >
            <Cloud className="h-3.5 w-3.5" />
            Upload Local Data to Cloud DB
          </Button>

          <Button
            size="sm"
            variant="outline"
            disabled={store.cloudSyncStatus === "syncing"}
            onClick={async () => {
              if (!user) {
                toast.info("Please connect your Google Account first to authenticate cloud reads");
                return;
              }
              try {
                toast.loading("Fetching latest data from Firestore...", { id: "load-toast" });
                const res = await store.loadFromCloud();
                toast.success(`Pulled ${res?.count || 0} records from Cloud DB!`, { id: "load-toast" });
              } catch (e: unknown) {
                toast.error(e instanceof Error ? e.message : "Pull failed", { id: "load-toast" });
              }
            }}
            className="gap-2 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${store.cloudSyncStatus === "syncing" ? "animate-spin" : ""}`} />
            Pull from Cloud DB
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const data = {
                clients: store.clients,
                bookings: store.bookings,
                agents: store.agents,
                suppliers: store.suppliers,
                entries: store.entries,
                groups: store.groups,
                accounts: store.accounts,
                opening: store.opening,
                alertSettings: store.alertSettings,
                exportedAt: new Date().toISOString(),
              };
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `avery-crm-backup-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success("Offline backup downloaded (JSON)");
            }}
            className="gap-2 text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            Download Backup (JSON)
          </Button>

          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors">
            <Upload className="h-3.5 w-3.5" />
            <span>Restore Backup (JSON)</span>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (evt) => {
                  try {
                    const parsed = JSON.parse(evt.target?.result as string);
                    localStorage.setItem("av-crm-store-v1", JSON.stringify(parsed));
                    toast.success("Backup loaded successfully! Refreshing...");
                    setTimeout(() => window.location.reload(), 600);
                  } catch {
                    toast.error("Invalid JSON file");
                  }
                };
                reader.readAsText(file);
              }}
            />
          </label>

          <a
            href="/avery-system-source-code.tar.gz"
            download="avery-system-source-code.tar.gz"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download Full Codebase (.tar.gz)</span>
          </a>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="glass-card rounded-xl p-6 border-destructive/40">
        <div className="flex items-center gap-3 border-b border-border/50 pb-4 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-destructive">Danger Zone</h3>
            <p className="text-xs text-muted-foreground">Use these only when starting fresh. Mock / sample data lingering in the system can be wiped here.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => wipeAll(true)} variant="outline" className="gap-2 border-warning/40 text-warning hover:bg-warning/10">
            <Trash2 className="h-4 w-4" /> Clear all operational data (keep opening balances)
          </Button>
          <Button onClick={() => wipeAll(false)} variant="destructive" className="gap-2">
            <Trash2 className="h-4 w-4" /> Wipe everything (full reset)
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-background/50 px-3 py-2">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}