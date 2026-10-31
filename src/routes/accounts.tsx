import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  Plus, Wallet, Landmark, Banknote, Trash2, TrendingUp, Clock,
  CheckCircle2, DollarSign, Filter, Search, UserCheck, Eye,
  Calendar, RefreshCw, X, Layers, Users, PieChart, AlertOctagon, ShieldCheck, Tag
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStore, computeAccountBalance, buildAccountLedger, type Account } from "@/lib/store";
import { formatCurrency, computeBookingProfit, computeBookingFinancials, type Drawer, type Booking } from "@/lib/data";
import { toast } from "sonner";

export const Route = createFileRoute("/accounts")({
  head: () => ({
    meta: [
      { title: "Accounts & Profit Engine — Avery Travel CRM" },
      { name: "description", content: "Chart of accounts, liquid balances, earned vs unearned profits, and partner drawing cards." },
      { property: "og:title", content: "Accounts & Profit Engine — Avery Travel CRM" },
      { property: "og:description", content: "Chart of accounts, liquid balances, earned vs unearned profits, and partner drawing cards." },
    ],
  }),
  component: AccountsPage,
});

const icons = { Cash: Banknote, Bank: Landmark, "Mobile Wallet": Wallet };
const emptyAccount = {
  name: "",
  type: "Bank" as Account["type"],
  number: "",
  branch: "",
  openingBalance: "",
  openingDate: new Date().toISOString().slice(0, 10),
};

const emptyDrawer = {
  name: "",
  role: "Partner",
  phone: "",
  sharePercent: "50",
  openingDrawings: "",
  notes: "",
};

function AccountsPage() {
  const store = useStore();

  // --- Account State ---
  const [accOpen, setAccOpen] = useState(false);
  const [accForm, setAccForm] = useState(emptyAccount);
  const [selAccId, setSelAccId] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // --- Drawer / Partner State ---
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerForm, setDrawerForm] = useState(emptyDrawer);
  const [editingDrawerId, setEditingDrawerId] = useState<string | null>(null);
  const [selectedDrawerForStatement, setSelectedDrawerForStatement] = useState<Drawer | null>(null);

  // --- Profit Breakdown Modal State ---
  const [profitModalOpen, setProfitModalOpen] = useState(false);
  const [profitFilterStatus, setProfitFilterStatus] = useState<"all" | "earned" | "unearned">("all");
  const [profitFilterMargin, setProfitFilterMargin] = useState<"all" | "profit" | "loss">("all");
  const [profitFilterSource, setProfitFilterSource] = useState<"all" | "agent" | "direct">("all");
  const [profitFilterPackage, setProfitFilterPackage] = useState<string>("all");
  const [profitFilterMonth, setProfitFilterMonth] = useState<string>("all");
  const [profitFilterYear, setProfitFilterYear] = useState<string>("all");
  const [profitSearch, setProfitSearch] = useState<string>("");

  // --- Drawings Audit Modal State ---
  const [drawingsModalOpen, setDrawingsModalOpen] = useState(false);

  // Selected account and ledger rows
  const selectedAccount = store.accounts.find((a) => a.id === selAccId) || store.accounts[0];
  const ledgerRows = selectedAccount
    ? buildAccountLedger(selectedAccount.id).filter((r) => (!from || r.date >= from) && (!to || r.date <= to))
    : [];
  const totalLiquid = store.accounts.reduce((s, a) => s + computeAccountBalance(a.id), 0);

  // -------------------------------------------------------------
  // Profit Calculations & Analytics (Earned vs Unearned)
  // -------------------------------------------------------------
  const {
    earnedProfit, unearnedProfit, totalProjectedProfit,
    earnedCount, unearnedCount, totalSales, totalCosts, totalCommissions,
    totalCustomerDiscounts, totalSupplierRebates, totalLossDealsCount, totalLossAmount
  } = useMemo(() => {
    let earned = 0;
    let unearned = 0;
    let earnedCnt = 0;
    let unearnedCnt = 0;
    let sales = 0;
    let costs = 0;
    let commissions = 0;
    let custDisc = 0;
    let supReb = 0;
    let lossCnt = 0;
    let lossAmt = 0;

    store.bookings.forEach((b) => {
      const fin = computeBookingFinancials(b);
      const profit = fin.netProfit;
      sales += fin.grossSale;
      costs += fin.netCost;
      commissions += fin.netCommission;
      custDisc += fin.discount;
      supReb += fin.supplierDiscount;
      if (fin.isLoss) {
        lossCnt += 1;
        lossAmt += fin.lossAmount;
      }

      if (b.profitStatus === "earned") {
        earned += profit;
        earnedCnt += 1;
      } else {
        unearned += profit;
        unearnedCnt += 1;
      }
    });

    return {
      earnedProfit: earned,
      unearnedProfit: unearned,
      totalProjectedProfit: earned + unearned,
      earnedCount: earnedCnt,
      unearnedCount: unearnedCnt,
      totalSales: sales,
      totalCosts: costs,
      totalCommissions: commissions,
      totalCustomerDiscounts: custDisc,
      totalSupplierRebates: supReb,
      totalLossDealsCount: lossCnt,
      totalLossAmount: lossAmt,
    };
  }, [store.bookings]);

  // Total partner drawings across all entries
  const allDrawings = useMemo(() => {
    return store.entries.filter((e) => e.type === "drawing");
  }, [store.entries]);

  const totalDrawingsAmount = useMemo(() => {
    return allDrawings.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [allDrawings]);

  // Retained net profit
  const netRetainedProfit = earnedProfit - totalDrawingsAmount;

  // Filtered bookings for the Profit Modal
  const filteredBookings = useMemo(() => {
    return store.bookings.filter((b) => {
      const fin = computeBookingFinancials(b);

      // Margin filter (All vs Profitable only vs Loss Deals only)
      if (profitFilterMargin === "profit" && fin.isLoss) return false;
      if (profitFilterMargin === "loss" && !fin.isLoss) return false;

      // Status filter
      if (profitFilterStatus === "earned" && b.profitStatus !== "earned") return false;
      if (profitFilterStatus === "unearned" && b.profitStatus === "earned") return false;

      // Source filter
      if (profitFilterSource === "agent" && !b.agentId) return false;
      if (profitFilterSource === "direct" && b.agentId) return false;

      // Package type filter
      if (profitFilterPackage !== "all" && b.packageType !== profitFilterPackage) return false;

      // Month & Year filters (based on travelDate or createdAt)
      const dateStr = b.travelDate || b.createdAt || "";
      if (profitFilterYear !== "all" && !dateStr.startsWith(profitFilterYear)) return false;
      if (profitFilterMonth !== "all") {
        const parts = dateStr.split("-");
        if (parts.length >= 2 && parts[1] !== profitFilterMonth) return false;
      }

      // Search query
      if (profitSearch.trim()) {
        const q = profitSearch.toLowerCase().trim();
        const headMatch = b.headId.toLowerCase().includes(q);
        const agentMatch = b.agentId?.toLowerCase().includes(q) || false;
        const destMatch = b.destination?.toLowerCase().includes(q) || false;
        const pkgMatch = b.packageType.toLowerCase().includes(q);
        const clientMatch = store.clients
          .filter((c) => c.headId === b.headId)
          .some((c) => `${c.firstName} ${c.lastName}`.toLowerCase().includes(q));
        if (!headMatch && !agentMatch && !destMatch && !pkgMatch && !clientMatch) return false;
      }

      return true;
    });
  }, [store.bookings, store.clients, profitFilterMargin, profitFilterStatus, profitFilterSource, profitFilterPackage, profitFilterMonth, profitFilterYear, profitSearch]);

  const filteredStats = useMemo(() => {
    let sales = 0;
    let costs = 0;
    let commissions = 0;
    let profit = 0;
    let earned = 0;
    let unearned = 0;
    let custDiscounts = 0;
    let supRebates = 0;
    let lossCount = 0;

    filteredBookings.forEach((b) => {
      const fin = computeBookingFinancials(b);
      const p = fin.netProfit;
      sales += fin.grossSale;
      costs += fin.netCost;
      commissions += fin.netCommission;
      profit += p;
      custDiscounts += fin.discount;
      supRebates += fin.supplierDiscount;
      if (fin.isLoss) lossCount += 1;
      if (b.profitStatus === "earned") earned += p;
      else unearned += p;
    });

    return { sales, costs, commissions, profit, earned, unearned, custDiscounts, supRebates, lossCount };
  }, [filteredBookings]);

  // Helper to open profit modal with specific status
  const openProfitModal = (status: "all" | "earned" | "unearned") => {
    setProfitFilterStatus(status);
    setProfitModalOpen(true);
  };

  // Save new or edited account
  const saveAccount = () => {
    if (!accForm.name.trim()) {
      toast.error("Please enter an account name");
      return;
    }
    store.addAccount({
      ...accForm,
      openingBalance: Number(accForm.openingBalance) || 0,
    });
    setAccForm(emptyAccount);
    setAccOpen(false);
    toast.success("Account created successfully");
  };

  // Save partner/drawer
  const saveDrawer = () => {
    if (!drawerForm.name.trim()) {
      toast.error("Please enter partner name");
      return;
    }
    const data = {
      name: drawerForm.name.trim(),
      role: drawerForm.role.trim() || "Partner",
      phone: drawerForm.phone.trim() || undefined,
      sharePercent: Number(drawerForm.sharePercent) || 0,
      openingDrawings: Number(drawerForm.openingDrawings) || 0,
      notes: drawerForm.notes.trim() || undefined,
    };

    if (editingDrawerId) {
      store.updateDrawer(editingDrawerId, data);
      toast.success("Partner details updated");
    } else {
      store.addDrawer(data);
      toast.success("Partner added to equity registry");
    }
    setDrawerForm(emptyDrawer);
    setEditingDrawerId(null);
    setDrawerOpen(false);
  };

  const openEditDrawer = (d: Drawer) => {
    setDrawerForm({
      name: d.name,
      role: d.role || "Partner",
      phone: d.phone || "",
      sharePercent: d.sharePercent != null ? String(d.sharePercent) : "50",
      openingDrawings: d.openingDrawings != null ? String(d.openingDrawings) : "",
      notes: d.notes || "",
    });
    setEditingDrawerId(d.id);
    setDrawerOpen(true);
  };

  // Get drawings for a specific partner
  const getPartnerDrawings = (partner: Drawer) => {
    return store.entries.filter((e) => {
      if (e.type !== "drawing") return false;
      return (
        e.drawerId === partner.id ||
        (e.drawerName && e.drawerName.toLowerCase() === partner.name.toLowerCase()) ||
        (e.referenceId && e.referenceId === partner.id) ||
        (e.referenceName && e.referenceName.toLowerCase() === partner.name.toLowerCase())
      );
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Accounts & Profit Engine"
        subtitle={`Liquid Liquidity: ${formatCurrency(totalLiquid)} · Realized Profit: ${formatCurrency(earnedProfit)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="gap-1.5 text-xs bg-card/60 hover:bg-accent border-border"
              onClick={() => {
                setDrawerForm(emptyDrawer);
                setEditingDrawerId(null);
                setDrawerOpen(true);
              }}
            >
              <Users className="h-3.5 w-3.5 text-primary" />
              Add Partner / Drawer
            </Button>
            <Dialog open={accOpen} onOpenChange={setAccOpen}>
              <Button onClick={() => setAccOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> New Bank / Cash Account
              </Button>
              <DialogContent className="border-border bg-card">
                <DialogHeader>
                  <DialogTitle>Add Financial Account</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3">
                  <div>
                    <Label>Account Name</Label>
                    <Input
                      value={accForm.name}
                      onChange={(e) => setAccForm({ ...accForm, name: e.target.value })}
                      placeholder="e.g. Meezan Bank Main / Head Office Cash"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Account Type</Label>
                    <Select
                      value={accForm.type}
                      onValueChange={(v) => setAccForm({ ...accForm, type: v as Account["type"] })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["Cash", "Bank", "Mobile Wallet"].map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Account / IBAN No.</Label>
                      <Input
                        value={accForm.number}
                        onChange={(e) => setAccForm({ ...accForm, number: e.target.value })}
                        placeholder="PK..."
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Branch / Identifier</Label>
                      <Input
                        value={accForm.branch}
                        onChange={(e) => setAccForm({ ...accForm, branch: e.target.value })}
                        placeholder="Main Branch / Lahore"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Opening Balance (PKR)</Label>
                      <Input
                        type="number"
                        value={accForm.openingBalance}
                        onChange={(e) => setAccForm({ ...accForm, openingBalance: e.target.value })}
                        placeholder="0"
                        className="mt-1 font-mono"
                      />
                    </div>
                    <div>
                      <Label>Opening Date</Label>
                      <Input
                        type="date"
                        value={accForm.openingDate}
                        onChange={(e) => setAccForm({ ...accForm, openingDate: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <Button onClick={saveAccount} className="mt-2">Save Account</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {/* ------------------------------------------------------------------ */}
      {/* 1. PROFIT REALIZATION KPI BAR (Interactive & Clickable Cards)     */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold tracking-wide text-foreground">
              Profit Realization & Equity Summary
            </h2>
          </div>
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            Click any card to inspect sales breakdown & toggle profit status
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Earned Profit (Actual Realized) */}
          <button
            type="button"
            onClick={() => openProfitModal("earned")}
            className="group glass-card rounded-xl p-4 text-left border-border hover:border-success/60 hover:bg-success/5 transition-all shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/15 text-success group-hover:scale-105 transition-transform">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success uppercase tracking-wider">
                Actual Realized
              </span>
            </div>
            <p className="mt-3 text-xs font-medium text-muted-foreground">Earned Profit</p>
            <p className="mt-1 text-2xl font-bold font-mono text-success">
              {formatCurrency(earnedProfit)}
            </p>
            <div className="mt-2.5 flex items-center justify-between text-[11px] border-t border-border/40 pt-2 text-muted-foreground">
              <span>{earnedCount} Confirmed Head(s)</span>
              <span className="text-success font-medium group-hover:underline flex items-center gap-0.5">
                Inspect Realized →
              </span>
            </div>
          </button>

          {/* Card 2: Unearned Profit (Pipeline / Pending) */}
          <button
            type="button"
            onClick={() => openProfitModal("unearned")}
            className="group glass-card rounded-xl p-4 text-left border-border hover:border-warning/60 hover:bg-warning/5 transition-all shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/15 text-warning group-hover:scale-105 transition-transform">
                <Clock className="h-5 w-5" />
              </div>
              <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-bold text-warning uppercase tracking-wider">
                Pipeline / Accrued
              </span>
            </div>
            <p className="mt-3 text-xs font-medium text-muted-foreground">Unearned Profit</p>
            <p className="mt-1 text-2xl font-bold font-mono text-warning">
              {formatCurrency(unearnedProfit)}
            </p>
            <div className="mt-2.5 flex items-center justify-between text-[11px] border-t border-border/40 pt-2 text-muted-foreground">
              <span>{unearnedCount} Pending Head(s)</span>
              <span className="text-warning font-medium group-hover:underline flex items-center gap-0.5">
                Convert to Earned →
              </span>
            </div>
          </button>

          {/* Card 3: Total Projected Profit */}
          <button
            type="button"
            onClick={() => openProfitModal("all")}
            className="group glass-card rounded-xl p-4 text-left border-border hover:border-primary/60 hover:bg-primary/5 transition-all shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary group-hover:scale-105 transition-transform">
                <PieChart className="h-5 w-5" />
              </div>
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary uppercase tracking-wider">
                Full Portfolio
              </span>
            </div>
            <p className="mt-3 text-xs font-medium text-muted-foreground">Total Projected Profit</p>
            <p className="mt-1 text-2xl font-bold font-mono text-foreground">
              {formatCurrency(totalProjectedProfit)}
            </p>
            <div className="mt-2.5 flex items-center justify-between text-[11px] border-t border-border/40 pt-2 text-muted-foreground">
              <span>Sales: {formatCurrency(totalSales)}</span>
              <span className="text-primary font-medium group-hover:underline flex items-center gap-0.5">
                Multi-Filter View →
              </span>
            </div>
          </button>

          {/* Card 4: Total Partner Drawings & Retained Profit */}
          <button
            type="button"
            onClick={() => setDrawingsModalOpen(true)}
            className="group glass-card rounded-xl p-4 text-left border-border hover:border-destructive/60 hover:bg-destructive/5 transition-all shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/15 text-destructive group-hover:scale-105 transition-transform">
                <Wallet className="h-5 w-5" />
              </div>
              <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive uppercase tracking-wider">
                Owner Drawings
              </span>
            </div>
            <p className="mt-3 text-xs font-medium text-muted-foreground">Total Partner Withdrawals</p>
            <p className="mt-1 text-2xl font-bold font-mono text-destructive">
              {formatCurrency(totalDrawingsAmount)}
            </p>
            <div className="mt-2.5 flex items-center justify-between text-[11px] border-t border-border/40 pt-2 text-muted-foreground">
              <span>Retained: <b className={netRetainedProfit >= 0 ? "text-success" : "text-destructive"}>{formatCurrency(netRetainedProfit)}</b></span>
              <span className="text-destructive font-medium group-hover:underline flex items-center gap-0.5">
                Audit Withdrawals →
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 2. PARTNER / DRAWER MANAGEMENT CARDS (Account-Wise Equity Filter) */}
      {/* ------------------------------------------------------------------ */}
      <div className="glass-card rounded-xl p-4 md:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/50 pb-3">
          <div>
            <h3 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Partner Equity & Drawing Account Cards
            </h3>
            <p className="text-xs text-muted-foreground">
              Manage drawer profiles, equity shares, and monitor individual withdrawal statements across accounts.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setDrawerForm(emptyDrawer);
              setEditingDrawerId(null);
              setDrawerOpen(true);
            }}
            className="gap-1.5 text-xs h-8"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Partner Profile
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {store.drawers.map((partner) => {
            const drawings = getPartnerDrawings(partner);
            const totalDrawn = drawings.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) + (partner.openingDrawings || 0);

            // Group withdrawals by account
            const accountMap = new Map<string, number>();
            drawings.forEach((e) => {
              const accName = store.accounts.find((a) => a.id === e.accountId)?.name || e.paymentMethod || "Cash Account";
              accountMap.set(accName, (accountMap.get(accName) || 0) + (Number(e.amount) || 0));
            });

            // Calculate theoretical equity entitlement
            const equityEntitlement = Math.round((earnedProfit * (partner.sharePercent || 0)) / 100);
            const remainingShare = equityEntitlement - totalDrawn;

            return (
              <div
                key={partner.id}
                className="rounded-xl border border-border/60 bg-accent/5 p-4 flex flex-col justify-between hover:border-primary/50 transition-all shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-sm">{partner.name}</span>
                        <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                          {partner.sharePercent || 0}% Equity
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{partner.role || "Partner"} {partner.phone && `· ${partner.phone}`}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title="Edit Partner"
                        onClick={() => openEditDrawer(partner)}
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        title="Delete Partner"
                        onClick={() => {
                          if (store.drawers.length <= 1) {
                            toast.error("At least one partner must remain");
                            return;
                          }
                          store.deleteDrawer(partner.id);
                          toast.success("Partner removed");
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Partner Drawing Financials */}
                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-background/50 p-2.5 border border-border/40">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Drawn</span>
                      <p className="text-base font-bold font-mono text-destructive">
                        {formatCurrency(totalDrawn)}
                      </p>
                      <span className="text-[10px] text-muted-foreground">{drawings.length} withdrawal(s)</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Share of Earned</span>
                      <p className="text-base font-bold font-mono text-success">
                        {formatCurrency(equityEntitlement)}
                      </p>
                      <span className={`text-[10px] font-semibold ${remainingShare >= 0 ? "text-success" : "text-destructive"}`}>
                        Net: {formatCurrency(remainingShare)}
                      </span>
                    </div>
                  </div>

                  {/* Account Breakdown Chips */}
                  <div className="mt-3 space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Disbursement Accounts Used:
                    </span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {accountMap.size === 0 && (
                        <span className="text-[11px] text-muted-foreground italic">No withdrawals recorded yet</span>
                      )}
                      {Array.from(accountMap.entries()).map(([accName, amt]) => (
                        <span
                          key={accName}
                          className="rounded-md border border-border/50 bg-accent/20 px-2 py-0.5 text-[10px] font-medium text-foreground flex items-center gap-1"
                        >
                          <span>{accName}:</span>
                          <b className="font-mono text-destructive">{formatCurrency(amt)}</b>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground font-mono">{partner.id}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedDrawerForStatement(partner)}
                    className="h-7 text-xs gap-1 hover:bg-primary hover:text-primary-foreground"
                  >
                    <Eye className="h-3 w-3" />
                    View Statement ({drawings.length})
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 3. CHART OF ACCOUNTS & RUNNING FINANCIAL LEDGER                     */}
      {/* ------------------------------------------------------------------ */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
              <Landmark className="h-4 w-4 text-primary" />
              Chart of Accounts (Cash & Bank Ledgers)
            </h3>
            <p className="text-xs text-muted-foreground">
              Select an account below to view its running double-entry ledger and reconciliation state.
            </p>
          </div>
          <span className="text-xs font-semibold text-foreground">
            Combined Liquidity: <span className="text-primary font-mono">{formatCurrency(totalLiquid)}</span>
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {store.accounts.map((a) => {
            const Icon = icons[a.type] || Wallet;
            const bal = computeAccountBalance(a.id);
            const active = selectedAccount?.id === a.id;
            return (
              <button
                key={a.id}
                onClick={() => setSelAccId(a.id)}
                className={`glass-card rounded-xl p-4 text-left transition-all ${
                  active ? "border-primary shadow-md bg-primary/5 ring-1 ring-primary/40" : "glass-card-hover"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="rounded bg-accent/40 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
                    {a.type}
                  </span>
                </div>
                <p className="mt-3 text-sm font-semibold text-foreground">{a.name}</p>
                <p className="text-xs text-muted-foreground">
                  {[a.number, a.branch].filter(Boolean).join(" · ") || a.id}
                </p>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-[10px] text-muted-foreground">Balance:</span>
                  <span className={`font-mono text-base font-bold ${bal < 0 ? "text-destructive" : "text-success"}`}>
                    {formatCurrency(bal)}
                  </span>
                </div>
              </button>
            );
          })}
          {store.accounts.length === 0 && (
            <p className="text-sm text-muted-foreground">No accounts created yet.</p>
          )}
        </div>

        {selectedAccount && (
          <div className="glass-card rounded-xl p-4 md:p-5">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h3 className="font-display text-base font-semibold text-foreground">
                  {selectedAccount.name} — Running Ledger
                </h3>
                <p className="text-xs text-muted-foreground">
                  Opening {formatCurrency(selectedAccount.openingBalance)} on {selectedAccount.openingDate || "2026-01-01"}
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <Label className="text-xs">From</Label>
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">To</Label>
                  <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 text-xs" />
                </div>
                {(from || to) && (
                  <Button size="sm" variant="ghost" onClick={() => { setFrom(""); setTo(""); }} className="h-9 text-xs">
                    Clear
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="icon"
                  title="Delete account"
                  className="h-9 w-9 text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    if (store.accounts.length <= 1) {
                      toast.error("At least one account must remain");
                      return;
                    }
                    store.deleteAccount(selectedAccount.id);
                    setSelAccId(null);
                    toast.success("Account deleted");
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border/40">
              <table className="w-full min-w-[650px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-accent/20 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-3.5 py-2.5">Date</th>
                    <th className="px-3.5 py-2.5">Description & Reference</th>
                    <th className="px-3.5 py-2.5">Type</th>
                    <th className="px-3.5 py-2.5 text-right">In (+)</th>
                    <th className="px-3.5 py-2.5 text-right">Out (-)</th>
                    <th className="px-3.5 py-2.5 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerRows.map((r) => (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                      <td className="px-3.5 py-2.5 whitespace-nowrap text-xs font-mono">{r.date}</td>
                      <td className="px-3.5 py-2.5 capitalize text-xs font-medium">{r.description}</td>
                      <td className="px-3.5 py-2.5 text-[10px]">
                        <span className="rounded bg-accent/30 px-1.5 py-0.5 font-semibold text-muted-foreground">
                          {r.transactionType}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-right text-success font-mono font-semibold">
                        {r.direction === "in" ? formatCurrency(r.amount) : "—"}
                      </td>
                      <td className="px-3.5 py-2.5 text-right text-destructive font-mono font-semibold">
                        {r.direction === "out" ? formatCurrency(r.amount) : "—"}
                      </td>
                      <td className={`px-3.5 py-2.5 text-right font-mono font-bold ${r.runningBalanceAfter >= 0 ? "text-foreground" : "text-destructive"}`}>
                        {formatCurrency(r.runningBalanceAfter)}
                      </td>
                    </tr>
                  ))}
                  {ledgerRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-xs text-muted-foreground">
                        No transactions recorded in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 4. MODAL: PROFIT REALIZATION & FILTER ENGINE (Unearned vs Earned) */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={profitModalOpen} onOpenChange={setProfitModalOpen}>
        <DialogContent className="max-w-4xl border-border bg-card max-h-[90vh] flex flex-col p-6">
          <DialogHeader className="border-b border-border/50 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Profit Realization Engine — Earned vs Unearned Sales
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Convert sales profit from Unearned (Pipeline) to Earned (Actual) with 1-click accounting verification.
                </p>
              </div>
            </div>
          </DialogHeader>

          {/* Loss Deals Alert Banner if any detected */}
          {totalLossDealsCount > 0 && (
            <div className="mt-2 rounded-lg border border-rose-500/50 bg-rose-500/10 p-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <AlertOctagon className="h-4 w-4 text-rose-500 shrink-0" />
                <div>
                  <p className="font-semibold text-rose-300">Negative Margin Alert: {totalLossDealsCount} Loss Deal(s) Detected</p>
                  <p className="text-[10px] text-rose-200/80">Total negative loss: -{formatCurrency(totalLossAmount)}. Concessions/commissions exceed sale value.</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setProfitFilterMargin(profitFilterMargin === "loss" ? "all" : "loss")}
                className={`h-7 text-[10px] border-rose-500/50 ${profitFilterMargin === "loss" ? "bg-rose-500 text-white" : "text-rose-300 hover:bg-rose-500/20"}`}
              >
                {profitFilterMargin === "loss" ? "Show All Deals" : "Isolate Loss Deals →"}
              </Button>
            </div>
          )}

          {/* Filter Bar */}
          <div className="mt-3 space-y-3 bg-accent/10 p-3 rounded-xl border border-border/40">
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
              {/* Margin / Loss Filter */}
              <div>
                <Label className="text-[10px]">Margin Category</Label>
                <Select value={profitFilterMargin} onValueChange={(v) => setProfitFilterMargin(v as any)}>
                  <SelectTrigger className="h-8 text-xs mt-0.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Deals</SelectItem>
                    <SelectItem value="profit">Profitable Deals Only</SelectItem>
                    <SelectItem value="loss">Loss Deals Only (Negative)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div>
                <Label className="text-[10px]">Profit Status</Label>
                <Select value={profitFilterStatus} onValueChange={(v) => setProfitFilterStatus(v as any)}>
                  <SelectTrigger className="h-8 text-xs mt-0.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Profits</SelectItem>
                    <SelectItem value="earned">Earned (Actual)</SelectItem>
                    <SelectItem value="unearned">Unearned (Pending)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Source Filter */}
              <div>
                <Label className="text-[10px]">Sale Source</Label>
                <Select value={profitFilterSource} onValueChange={(v) => setProfitFilterSource(v as any)}>
                  <SelectTrigger className="h-8 text-xs mt-0.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="agent">Agent Sales Only</SelectItem>
                    <SelectItem value="direct">Direct Clients Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Package Type */}
              <div>
                <Label className="text-[10px]">Package</Label>
                <Select value={profitFilterPackage} onValueChange={setProfitFilterPackage}>
                  <SelectTrigger className="h-8 text-xs mt-0.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Packages</SelectItem>
                    <SelectItem value="Umrah">Umrah</SelectItem>
                    <SelectItem value="Hajj">Hajj</SelectItem>
                    <SelectItem value="Flight">Flight</SelectItem>
                    <SelectItem value="Tour">Tour</SelectItem>
                    <SelectItem value="Custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Month */}
              <div>
                <Label className="text-[10px]">Travel Month</Label>
                <Select value={profitFilterMonth} onValueChange={setProfitFilterMonth}>
                  <SelectTrigger className="h-8 text-xs mt-0.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Months</SelectItem>
                    <SelectItem value="01">January</SelectItem>
                    <SelectItem value="02">February</SelectItem>
                    <SelectItem value="03">March</SelectItem>
                    <SelectItem value="04">April</SelectItem>
                    <SelectItem value="05">May</SelectItem>
                    <SelectItem value="06">June</SelectItem>
                    <SelectItem value="07">July</SelectItem>
                    <SelectItem value="08">August</SelectItem>
                    <SelectItem value="09">September</SelectItem>
                    <SelectItem value="10">October</SelectItem>
                    <SelectItem value="11">November</SelectItem>
                    <SelectItem value="12">December</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Year */}
              <div>
                <Label className="text-[10px]">Year</Label>
                <Select value={profitFilterYear} onValueChange={setProfitFilterYear}>
                  <SelectTrigger className="h-8 text-xs mt-0.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2026">2026</SelectItem>
                    <SelectItem value="2027">2027</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Search Input & Reset */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={profitSearch}
                  onChange={(e) => setProfitSearch(e.target.value)}
                  placeholder="Filter by Head ID (e.g. AV-HD-001), Client name, or Agent ID..."
                  className="h-8 pl-8 text-xs bg-background/50"
                />
              </div>
              {(profitFilterStatus !== "all" || profitFilterMargin !== "all" || profitFilterSource !== "all" || profitFilterPackage !== "all" || profitFilterMonth !== "all" || profitFilterYear !== "all" || profitSearch) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setProfitFilterStatus("all");
                    setProfitFilterMargin("all");
                    setProfitFilterSource("all");
                    setProfitFilterPackage("all");
                    setProfitFilterMonth("all");
                    setProfitFilterYear("all");
                    setProfitSearch("");
                  }}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                >
                  Reset Filters
                </Button>
              )}
            </div>
          </div>

          {/* Filtered Dynamic Stat Summary */}
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-xs">
            <div className="rounded-lg bg-accent/20 p-2">
              <span className="text-[10px] text-muted-foreground uppercase">Filtered Sales</span>
              <p className="font-bold font-mono text-foreground">{formatCurrency(filteredStats.sales)}</p>
            </div>
            <div className="rounded-lg bg-accent/20 p-2">
              <span className="text-[10px] text-muted-foreground uppercase">Costs + Comm</span>
              <p className="font-bold font-mono text-destructive">{formatCurrency(filteredStats.costs + filteredStats.commissions)}</p>
            </div>
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2">
              <span className="text-[10px] text-amber-400 uppercase font-semibold">Cust. Discounts</span>
              <p className="font-bold font-mono text-amber-400">-{formatCurrency(filteredStats.custDiscounts)}</p>
            </div>
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2">
              <span className="text-[10px] text-emerald-400 uppercase font-semibold">Sup. Rebates</span>
              <p className="font-bold font-mono text-emerald-400">+{formatCurrency(filteredStats.supRebates)}</p>
            </div>
            <div className="rounded-lg bg-success/10 border border-success/30 p-2">
              <span className="text-[10px] text-success uppercase font-semibold">Earned Profit</span>
              <p className="font-bold font-mono text-success">{formatCurrency(filteredStats.earned)}</p>
            </div>
            <div className="rounded-lg bg-warning/10 border border-warning/30 p-2">
              <span className="text-[10px] text-warning uppercase font-semibold">Unearned Profit</span>
              <p className="font-bold font-mono text-warning">{formatCurrency(filteredStats.unearned)}</p>
            </div>
          </div>

          {/* Bookings Table with 1-Click Profit Conversion */}
          <div className="mt-3 flex-1 overflow-y-auto rounded-lg border border-border/40">
            <table className="w-full text-xs">
              <thead className="bg-accent/20 sticky top-0 border-b border-border z-10">
                <tr className="text-left uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2">Head ID / Package</th>
                  <th className="px-3 py-2">Source / Agent</th>
                  <th className="px-3 py-2 text-right">Sale Total</th>
                  <th className="px-3 py-2 text-right">Cost</th>
                  <th className="px-3 py-2 text-right">Commission</th>
                  <th className="px-3 py-2 text-right">Net Profit</th>
                  <th className="px-3 py-2 text-center">Status</th>
                  <th className="px-3 py-2 text-right">Conversion Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredBookings.map((b) => {
                  const fin = computeBookingFinancials(b);
                  const isEarned = b.profitStatus === "earned";

                  return (
                    <tr key={b.id} className="hover:bg-accent/20 transition-colors">
                      <td className="px-3 py-2">
                        <span className="font-bold text-primary">{b.headId}</span>
                        <div className="text-[10px] text-muted-foreground">{b.packageType} · {b.travelDate}</div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-medium text-foreground">{b.agentId ? `Agent: ${b.agentId}` : "Direct Client"}</span>
                        <div className="text-[10px] text-muted-foreground">{b.destination || "Standard"}</div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-medium">{formatCurrency(b.totalAmount)}</td>
                      <td className="px-3 py-2 text-right font-mono text-destructive">{formatCurrency(b.totalCost)}</td>
                      <td className="px-3 py-2 text-right font-mono text-warning">{formatCurrency(b.commission)}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {fin.isLoss ? (
                          <div className="flex flex-col items-end">
                            <span className="font-bold text-rose-400 flex items-center gap-1">
                              <AlertOctagon className="h-3 w-3 text-rose-500" />
                              -{formatCurrency(fin.lossAmount)}
                            </span>
                            <span className="text-[9px] text-rose-300 font-semibold uppercase">Loss ({fin.marginPercent.toFixed(1)}%)</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-end">
                            <span className="font-bold text-success">{formatCurrency(fin.netProfit)}</span>
                            <span className="text-[9px] text-muted-foreground">({fin.marginPercent.toFixed(1)}%)</span>
                          </div>
                        )}
                        {fin.discount > 0 && (
                          <div className="text-[9px] text-amber-400">
                            Disc: {formatCurrency(fin.discount)} {b.discountSettlement === "agent_commission" ? "(Agent)" : "(Agency)"}
                          </div>
                        )}
                        {fin.supplierDiscount > 0 && (
                          <div className="text-[9px] text-emerald-400">
                            Rebate: +{formatCurrency(fin.supplierDiscount)}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                            isEarned
                              ? "bg-success/20 text-success border border-success/40"
                              : "bg-warning/20 text-warning border border-warning/40"
                          }`}
                        >
                          {isEarned ? "Earned" : "Unearned"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          variant={isEarned ? "outline" : "default"}
                          onClick={() => {
                            store.toggleBookingProfitStatus(b.id);
                            toast.success(
                              isEarned
                                ? `Reverted ${b.headId} to Unearned Profit`
                                : `Converted ${b.headId} to Earned Actual Profit`
                            );
                          }}
                          className={`h-7 text-[11px] gap-1 font-semibold ${
                            isEarned
                              ? "border-warning/50 text-warning hover:bg-warning/10"
                              : "bg-success text-success-foreground hover:bg-success/90"
                          }`}
                        >
                          {isEarned ? (
                            <>
                              <RefreshCw className="h-3 w-3" />
                              Revert to Unearned
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-3 w-3" />
                              Mark as Earned
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {filteredBookings.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-xs text-muted-foreground">
                      No sales matching the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* 5. MODAL: PARTNER INDIVIDUAL DRAWING STATEMENT                      */}
      {/* ------------------------------------------------------------------ */}
      {selectedDrawerForStatement && (
        <Dialog open={!!selectedDrawerForStatement} onOpenChange={(open) => !open && setSelectedDrawerForStatement(null)}>
          <DialogContent className="max-w-2xl border-border bg-card">
            <DialogHeader className="border-b border-border/50 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-base font-bold flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-primary" />
                    {selectedDrawerForStatement.name} — Drawing Statement
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedDrawerForStatement.role} · {selectedDrawerForStatement.sharePercent}% Profit Equity
                  </p>
                </div>
              </div>
            </DialogHeader>

            {(() => {
              const statementEntries = getPartnerDrawings(selectedDrawerForStatement);
              const sum = statementEntries.reduce((s, e) => s + (Number(e.amount) || 0), 0) + (selectedDrawerForStatement.openingDrawings || 0);
              let running = selectedDrawerForStatement.openingDrawings || 0;

              return (
                <div className="space-y-3 mt-2">
                  <div className="flex items-center justify-between rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-destructive">Cumulative Withdrawals</span>
                      <p className="text-xl font-bold font-mono text-destructive">{formatCurrency(sum)}</p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <span>Total Withdrawals: <b>{statementEntries.length}</b></span>
                      {selectedDrawerForStatement.openingDrawings ? (
                        <p className="text-[10px]">Opening Baseline: {formatCurrency(selectedDrawerForStatement.openingDrawings)}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-border/40">
                    <table className="w-full text-xs">
                      <thead className="bg-accent/20 sticky top-0 border-b border-border">
                        <tr className="text-left uppercase tracking-wider text-muted-foreground">
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Account & Channel</th>
                          <th className="px-3 py-2">Purpose / Note</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                          <th className="px-3 py-2 text-right">Running Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {statementEntries.map((e) => {
                          const amt = Number(e.amount) || 0;
                          running += amt;
                          const acc = store.accounts.find((a) => a.id === e.accountId);
                          return (
                            <tr key={e.id} className="hover:bg-accent/20">
                              <td className="px-3 py-2 font-mono whitespace-nowrap">{e.date}</td>
                              <td className="px-3 py-2">
                                <span className="font-semibold text-foreground">{acc?.name || e.paymentMethod || "Cash"}</span>
                                {e.txnRef && <span className="text-[10px] text-muted-foreground block">Ref: {e.txnRef}</span>}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {[e.chargeCategory, e.note].filter(Boolean).join(" · ") || "Personal drawing"}
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-bold text-destructive">
                                {formatCurrency(amt)}
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-semibold text-foreground">
                                {formatCurrency(running)}
                              </td>
                            </tr>
                          );
                        })}
                        {statementEntries.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground italic">
                              No drawing transactions recorded for this partner yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 6. MODAL: ALL DRAWINGS AUDIT                                       */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={drawingsModalOpen} onOpenChange={setDrawingsModalOpen}>
        <DialogContent className="max-w-3xl border-border bg-card">
          <DialogHeader className="border-b border-border/50 pb-3">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Wallet className="h-5 w-5 text-destructive" />
              All Partner Drawings & Withdrawals Ledger
            </DialogTitle>
          </DialogHeader>

          <div className="mt-2 space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-accent/20 p-3">
              <div>
                <span className="text-[10px] uppercase text-muted-foreground font-semibold">Total Drawn from Business</span>
                <p className="text-xl font-bold font-mono text-destructive">{formatCurrency(totalDrawingsAmount)}</p>
              </div>
              <div className="text-right text-xs">
                <span className="text-muted-foreground">Retained Operating Profit:</span>
                <p className={`font-mono font-bold text-base ${netRetainedProfit >= 0 ? "text-success" : "text-destructive"}`}>
                  {formatCurrency(netRetainedProfit)}
                </p>
              </div>
            </div>

            <div className="max-h-[55vh] overflow-y-auto rounded-lg border border-border/40">
              <table className="w-full text-xs">
                <thead className="bg-accent/20 sticky top-0 border-b border-border">
                  <tr className="text-left uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Drawn By</th>
                    <th className="px-3 py-2">Account</th>
                    <th className="px-3 py-2">Category & Note</th>
                    <th className="px-3 py-2 text-right">Amount (PKR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {allDrawings.map((e) => {
                    const acc = store.accounts.find((a) => a.id === e.accountId);
                    return (
                      <tr key={e.id} className="hover:bg-accent/20">
                        <td className="px-3 py-2 font-mono whitespace-nowrap">{e.date}</td>
                        <td className="px-3 py-2 font-semibold text-foreground">
                          {e.drawerName || e.referenceName || "Partner"}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {acc?.name || e.paymentMethod || "Cash"}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {[e.chargeCategory, e.note].filter(Boolean).join(" · ") || "Drawing"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-destructive">
                          {formatCurrency(e.amount)}
                        </td>
                      </tr>
                    );
                  })}
                  {allDrawings.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground italic">
                        No drawing entries recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* 7. MODAL: ADD / EDIT PARTNER                                       */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent className="border-border bg-card">
          <DialogHeader>
            <DialogTitle>
              {editingDrawerId ? "Edit Partner Profile" : "Register Partner / Drawer"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 mt-1">
            <div>
              <Label>Full Name *</Label>
              <Input
                value={drawerForm.name}
                onChange={(e) => setDrawerForm({ ...drawerForm, name: e.target.value })}
                placeholder="e.g. Muhammad Ali"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Role / Title</Label>
                <Input
                  value={drawerForm.role}
                  onChange={(e) => setDrawerForm({ ...drawerForm, role: e.target.value })}
                  placeholder="Managing Partner / Director"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Equity Share (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={drawerForm.sharePercent}
                  onChange={(e) => setDrawerForm({ ...drawerForm, sharePercent: e.target.value })}
                  placeholder="50"
                  className="mt-1 font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Phone / Contact</Label>
                <Input
                  value={drawerForm.phone}
                  onChange={(e) => setDrawerForm({ ...drawerForm, phone: e.target.value })}
                  placeholder="0300-1234567"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Opening Drawings (PKR)</Label>
                <Input
                  type="number"
                  value={drawerForm.openingDrawings}
                  onChange={(e) => setDrawerForm({ ...drawerForm, openingDrawings: e.target.value })}
                  placeholder="0"
                  className="mt-1 font-mono"
                />
              </div>
            </div>
            <div>
              <Label>Operational Notes</Label>
              <Input
                value={drawerForm.notes}
                onChange={(e) => setDrawerForm({ ...drawerForm, notes: e.target.value })}
                placeholder="Special authority, responsibilities..."
                className="mt-1"
              />
            </div>
            <Button onClick={saveDrawer} className="mt-2">
              {editingDrawerId ? "Update Partner" : "Save Partner"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
