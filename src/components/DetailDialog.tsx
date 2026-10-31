import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ChevronRight, ArrowLeft, Users, DollarSign, FileText } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import ClientChecklistPanel from "@/components/ClientChecklistPanel";
import { formatCurrency, getClientName } from "@/lib/data";
import type { Client, Booking, Agent, Supplier } from "@/lib/data";
import type { LedgerEntry } from "@/lib/store";
import { generateClientStatement, generateSupplierLedger, generateAgentReport, generatePaymentHistory } from "@/lib/pdf";
import { formatCurrency as fc } from "@/lib/data";
import { useState } from "react";

interface DetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "client" | "agent" | "supplier" | "booking";
  data: Client | Agent | Supplier | Booking | null;
  entries?: LedgerEntry[];
  allClients?: Client[];
  allBookings?: Booking[];
}

export default function DetailDialog({ open, onOpenChange, type, data, entries = [], allClients = [], allBookings = [] }: DetailDialogProps) {
  const [subView, setSubView] = useState<"main" | "clients" | "client-detail" | "bookings" | "statement" | "business" | "othersale">("main");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [includeOpening, setIncludeOpening] = useState(true);

  if (!data) return null;

  function handleClose(o: boolean) {
    if (!o) { setSubView("main"); setSelectedClient(null); }
    onOpenChange(o);
  }

  function handleDownload() {
    if (!data) return;
    if (type === "client") generateClientStatement(data as Client, entries);
    if (type === "supplier") generateSupplierLedger(data as Supplier, entries);
    if (type === "agent") generateAgentReport(data as Agent, entries, { bookings: allBookings, clients: allClients });
  }

  function handleHistory() {
    if (!data) return;
    if (type === "client") {
      const c = data as Client;
      generatePaymentHistory(`Client ${c.id}`,
        [["Client ID", c.id], ["Name", getClientName(c)], ["Head ID", c.headId], ["Phone", c.phone]],
        entries.filter((e) => e.type === "client_receive"),
        [["Total Due", fc(c.amountDue), "ink"], ["Paid", fc(c.amountPaid), "success"], ["Remaining", fc(c.amountDue - c.amountPaid), "destructive"]]);
    }
    if (type === "supplier") {
      const s = data as Supplier;
      const payable = s.totalPayable + (s.openingPayable || 0);
      const paid = s.totalPaid + (s.openingPaid || 0);
      generatePaymentHistory(`Supplier ${s.id}`,
        [["Supplier ID", s.id], ["Company", s.companyName], ["Contact", s.contactPerson]],
        entries.filter((e) => e.type === "supplier_payment"),
        [["Payable", fc(payable), "ink"], ["Paid", fc(paid), "success"], ["Remaining", fc(payable - paid), "destructive"]]);
    }
    if (type === "agent") {
      const a = data as Agent;
      generatePaymentHistory(`Agent ${a.id}`,
        [["Agent ID", a.id], ["Name", a.name], ["Phone", a.phone]],
        entries.filter((e) => e.type === "agent_commission" && e.referenceId === a.id),
        [["Commission", fc(a.commission), "ink"], ["Paid", fc(a.paidCommission || 0), "success"], ["Payable", fc((a.commission || 0) - (a.paidCommission || 0)), "destructive"]]);
    }
  }

  // Compute agent stats from bookings
  function getAgentStats(a: Agent) {
    const agentBookings = allBookings.filter((b) => b.agentId === a.id);
    const agentClients = allClients.filter((c) => agentBookings.some((b) => b.headId === c.headId));
    const otherSaleRows = entries.filter((e) => (e.type === "purchase" && e.purchasedFor === "agent" && e.agentId === a.id) || (e.type === "other_sale" && e.referenceId === a.id));
    const otherSaleTotal = otherSaleRows.reduce((s, e) => s + (e.type === "purchase" ? (e.saleAmount ?? e.amount) : e.amount), 0);
    const otherSaleCost = otherSaleRows.filter((e) => e.type === "purchase").reduce((s, e) => s + e.amount, 0);
    const totalSales = agentBookings.reduce((s, b) => s + b.totalAmount, 0) + (a.openingSales || 0) + otherSaleTotal;
    const totalCommission = agentBookings.reduce((s, b) => s + (b.commission || 0), 0) + (a.openingCommission || 0);
    const paidCommission = entries.filter((e) => e.type === "agent_commission" && e.referenceId === a.id).reduce((s, e) => s + e.amount, 0) + (a.openingPaidCommission || 0);
    const received = agentBookings.reduce((s, b) => s + (b.amountReceived || 0), 0)
      + entries.filter((e) => e.type === "agent_receive" && e.referenceId === a.id).reduce((s, e) => s + e.amount, 0);
    const netReceivable = Math.max(0, totalSales - totalCommission);
    return {
      agentBookings, agentClients, totalSales, totalCommission, paidCommission, otherSaleRows, otherSaleTotal, otherSaleCost,
      payable: totalCommission - paidCommission,
      received, netReceivable, outstanding: netReceivable - received,
    };
  }

  // Compute supplier stats from bookings
  function getSupplierStats(s: Supplier) {
    const supplierBookings = allBookings.filter((b) => b.supplierId === s.id);
    const purchaseTotal = entries.filter((e) => e.type === "purchase" && e.referenceId === s.id).reduce((sum, e) => sum + e.amount, 0);
    const bookingCostTotal = supplierBookings.reduce((sum, b) => sum + (b.totalCost || 0), 0);
    const totalCost = Math.max(s.totalPayable || 0, purchaseTotal || 0, bookingCostTotal || 0) + (s.openingPayable || 0);
    const totalPaid = entries.filter((e) => e.type === "supplier_payment" && e.referenceId === s.id).reduce((sum, e) => sum + e.amount, 0) + (s.openingPaid || 0);
    return { supplierBookings, totalCost, totalPaid, remaining: totalCost - totalPaid };
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[85vh] overflow-y-auto bg-card border-border max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            {subView !== "main" && (
              <Button size="sm" variant="ghost" onClick={() => { setSubView("main"); setSelectedClient(null); }} className="gap-1 text-xs px-2">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
            )}
            <DialogTitle className="text-primary text-sm flex-1">
              {subView === "statement" ? `Statement — ${type === "supplier" ? (data as Supplier).companyName : type === "agent" ? (data as Agent).name : getClientName(data as Client)}` :
               subView === "client-detail" && selectedClient ? `${getClientName(selectedClient)}` :
               subView === "clients" && type === "agent" ? `Clients of ${(data as Agent).name}` :
               subView === "othersale" && type === "agent" ? `Other Sale — ${(data as Agent).name}` :
               subView === "business" && type === "agent" ? `Business Account — ${(data as Agent).name}` :
               subView === "bookings" && type === "supplier" ? `Bookings — ${(data as Supplier).companyName}` :
               type === "client" ? `Client: ${getClientName(data as Client)}` :
               type === "agent" ? `Agent: ${(data as Agent).name}` :
               type === "supplier" ? `Supplier: ${(data as Supplier).companyName}` :
               `Booking: ${(data as Booking).headId}`}
            </DialogTitle>
            {type !== "booking" && subView === "main" && (
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => setSubView("statement")} className="gap-1.5 text-xs">
                  <FileText className="h-3.5 w-3.5" /> View
                </Button>
                <Button size="sm" variant="outline" onClick={handleDownload} className="gap-1.5 text-xs">
                  <Download className="h-3.5 w-3.5" /> Statement
                </Button>
                <Button size="sm" variant="outline" onClick={handleHistory} className="gap-1.5 text-xs">
                  <Download className="h-3.5 w-3.5" /> History
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* MAIN VIEW */}
          {subView === "main" && (
            <>
              {type === "client" && (
                <>
                  {renderClient(data as Client)}
                  <ClientChecklistPanel client={data as Client} />
                </>
              )}
              {type === "agent" && renderAgentFull(data as Agent, getAgentStats(data as Agent), () => setSubView("clients"), () => setSubView("business"), () => setSubView("othersale"))}
              {type === "supplier" && renderSupplierFull(data as Supplier, getSupplierStats(data as Supplier), () => setSubView("bookings"))}
              {type === "booking" && renderBooking(data as Booking)}

              {entries.length > 0 && type === "agent" && (
                <>

                  <LedgerBlock
                    title="Client Business Ledger"
                    hint="Every client transaction of the bookings this agent brought — receipts, extra charges and refunds."
                    rows={entries.filter((e) => e.type === "client_receive" || e.type === "client_charge" || e.type === "client_refund")}
                  />
                </>
              )}
              {entries.length > 0 && type !== "agent" && (
                <LedgerBlock title="Transaction History" rows={entries} />
              )}
            </>
          )}

          {/* AGENT → CLIENTS LIST */}
          {subView === "clients" && type === "agent" && (() => {
            const stats = getAgentStats(data as Agent);
            const grouped = new Map<string, Client[]>();
            stats.agentClients.forEach((c) => {
              if (!grouped.has(c.headId)) grouped.set(c.headId, []);
              grouped.get(c.headId)!.push(c);
            });
            return (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">{stats.agentClients.length} total clients across {grouped.size} bookings</p>
                {Array.from(grouped.entries()).map(([headId, members]) => {
                  const booking = allBookings.find((b) => b.headId === headId);
                  const totalPaid = members.reduce((s, c) => s + c.amountPaid, 0);
                  const totalDue = members.reduce((s, c) => s + c.amountDue, 0);
                  return (
                    <div key={headId} className="rounded-lg border border-border/50 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-primary">{headId}</p>
                          <p className="text-[10px] text-muted-foreground">{members.length} members · {booking?.packageType || ""} · {booking?.destination || ""}</p>
                        </div>
                        <div className="text-right text-[10px]">
                          <p>Total: {formatCurrency(booking?.totalAmount || totalDue)}</p>
                          <p className="text-success">Paid: {formatCurrency(totalPaid)}</p>
                        </div>
                      </div>
                      {members.map((c) => (
                        <div key={c.id} onClick={() => { setSelectedClient(c); setSubView("client-detail"); }}
                          className="flex items-center justify-between rounded bg-accent/20 px-3 py-2 cursor-pointer hover:bg-accent/40 transition-colors">
                          <div>
                            <p className="text-xs font-medium">{getClientName(c)}</p>
                            <p className="text-[10px] text-muted-foreground">{c.id} · {c.passport}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={c.paymentStatus} />
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* AGENT → OTHER SALE */}
          {subView === "othersale" && type === "agent" && (() => {
            const stats = getAgentStats(data as Agent);
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <StatCard label="Other Sale" value={formatCurrency(stats.otherSaleTotal)} color="text-primary" />
                  <StatCard label="Purchase Cost" value={formatCurrency(stats.otherSaleCost)} color="text-warning" />
                  <StatCard label="Profit" value={formatCurrency(stats.otherSaleTotal - stats.otherSaleCost)} color="text-success" />
                </div>
                <div className="rounded-lg border border-border/50 p-3 space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Other Sale Entries</p>
                  {stats.otherSaleRows.map((e) => {
                    const sale = e.type === "purchase" ? (e.saleAmount ?? e.amount) : e.amount;
                    const cost = e.type === "purchase" ? e.amount : 0;
                    return (
                      <div key={e.id} className="flex items-center justify-between rounded bg-accent/20 px-3 py-2">
                        <div>
                          <p className="text-xs font-medium">{e.forClientName || e.note || e.referenceName}</p>
                          <p className="text-[10px] text-muted-foreground">{[e.date, e.serviceCategory, e.type === "purchase" ? `Supplier: ${e.referenceName}` : "Direct"].filter(Boolean).join(" · ")}</p>
                        </div>
                        <div className="text-right text-[10px]">
                          <p>Sale: <span className="font-semibold text-primary">{formatCurrency(sale)}</span></p>
                          {cost > 0 && <p>Cost: {formatCurrency(cost)} · Profit: <span className="text-success">{formatCurrency(sale - cost)}</span></p>}
                        </div>
                      </div>
                    );
                  })}
                  {stats.otherSaleRows.length === 0 && <p className="py-2 text-center text-[11px] text-muted-foreground">No other sale yet. Post a Purchase entry "For Agent" to add one.</p>}
                </div>
              </div>
            );
          })()}

          {/* AGENT → BUSINESS ACCOUNT */}
          {subView === "business" && type === "agent" && (() => {
            const stats = getAgentStats(data as Agent);
            return (
              <div className="space-y-3">
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Business Account (Receivable from Agent)</p>
                  {stats.otherSaleTotal > 0 && <div className="flex justify-between text-xs"><span className="text-muted-foreground">incl. Other Sale</span><span className="font-medium">{formatCurrency(stats.otherSaleTotal)}</span></div>}
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Gross Sale</span><span className="font-medium">{formatCurrency(stats.totalSales)}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Less: Agent Commission</span><span className="text-destructive">− {formatCurrency(stats.totalCommission)}</span></div>
                  <div className="flex justify-between border-t border-border/50 pt-1.5 text-xs font-semibold"><span>Net Receivable</span><span className="text-primary">{formatCurrency(stats.netReceivable)}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Received</span><span className="text-success">{formatCurrency(stats.received)}</span></div>
                  <div className="flex justify-between border-t border-border/50 pt-1.5 text-sm font-bold"><span>Remaining</span><span className={stats.outstanding > 0 ? "text-destructive" : "text-success"}>{formatCurrency(stats.outstanding)}</span></div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <StatCard label="Bookings" value={String(stats.agentBookings.length)} />
                  <StatCard label="Clients" value={String(stats.agentClients.length)} />
                  <StatCard label="Commission Payable" value={formatCurrency(stats.payable)} color="text-destructive" />
                </div>
                <div className="rounded-lg border border-border/50 p-3 space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Booking-wise Receivable</p>
                  {stats.agentBookings.map((b: any) => {
                    const net = Math.max(0, (b.totalAmount || 0) - (b.commission || 0));
                    return (
                      <div key={b.id} className="flex items-center justify-between rounded bg-accent/20 px-3 py-2">
                        <div>
                          <p className="text-xs font-medium">{b.headId}</p>
                          <p className="text-[10px] text-muted-foreground">{[b.packageType, b.destination].filter(Boolean).join(" · ")}</p>
                        </div>
                        <div className="text-right text-[10px]">
                          <p>Net: <span className="font-semibold text-primary">{formatCurrency(net)}</span></p>
                          <p>Received: <span className="text-success">{formatCurrency(b.amountReceived || 0)}</span> · Due: <span className="text-destructive">{formatCurrency(Math.max(0, net - (b.amountReceived || 0)))}</span></p>
                        </div>
                      </div>
                    );
                  })}
                  {stats.agentBookings.length === 0 && <p className="py-2 text-center text-[11px] text-muted-foreground">No bookings brought by this agent yet.</p>}
                </div>
              </div>
            );
          })()}

          {/* SUPPLIER → BOOKINGS LIST */}
          {subView === "bookings" && type === "supplier" && (() => {
            const stats = getSupplierStats(data as Supplier);
            return (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">{stats.supplierBookings.length} bookings</p>
                {stats.supplierBookings.map((b) => {
                  const members = allClients.filter((c) => c.headId === b.headId);
                  return (
                    <div key={b.id} className="rounded-lg border border-border/50 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-primary">{b.headId}</p>
                          <p className="text-[10px] text-muted-foreground">{b.packageType} · {b.destination || ""} · {b.members} members</p>
                        </div>
                        <div className="text-right text-[10px]">
                          <p>Cost: {formatCurrency(b.totalCost || 0)}</p>
                          <p>Amount: {formatCurrency(b.totalAmount)}</p>
                        </div>
                      </div>
                      {members.slice(0, 3).map((c) => (
                        <div key={c.id} onClick={() => { setSelectedClient(c); setSubView("client-detail"); }}
                          className="flex items-center justify-between rounded bg-accent/20 px-3 py-2 cursor-pointer hover:bg-accent/40 transition-colors text-xs">
                          <span>{getClientName(c)} — {c.id}</span>
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        </div>
                      ))}
                      {members.length > 3 && <p className="text-[10px] text-muted-foreground text-center">+{members.length - 3} more</p>}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* CLIENT DETAIL (from agent/supplier drill-down) */}
          {subView === "client-detail" && selectedClient && renderClient(selectedClient)}

          {/* STATEMENT VIEW — mirrors PDF layout */}
          {subView === "statement" && (
            <StatementView
              type={type as "client" | "agent" | "supplier"}
              data={data as Client | Agent | Supplier}
              entries={entries}
              includeOpening={includeOpening}
              onToggleOpening={setIncludeOpening}
              onDownload={handleDownload}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between border-b border-border/30 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${color || ""}`}>{value}</span>
    </div>
  );
}

const ENTRY_LABELS: Record<string, string> = {
  client_receive: "Payment Received",
  client_charge: "Extra Charge",
  client_refund: "Refund to Client",
  supplier_payment: "Supplier Payment",
  supplier_refund: "Refund from Supplier",
  agent_commission: "Commission Paid",
  purchase: "Purchase",
  expense: "Expense",
};
const INFLOW = new Set(["client_receive", "supplier_refund"]);

function LedgerBlock({ title, hint, rows }: { title: string; hint?: string; rows: LedgerEntry[] }) {
  if (rows.length === 0) return null;
  const total = rows.reduce((s, e) => s + (INFLOW.has(e.type) ? e.amount : -e.amount), 0);
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
        <span className={`text-xs font-bold ${total >= 0 ? "text-success" : "text-destructive"}`}>
          {total >= 0 ? "+" : "-"}{formatCurrency(Math.abs(total))}
        </span>
      </div>
      {hint && <p className="mb-2 text-[10px] text-muted-foreground">{hint}</p>}
      <div className="space-y-2">
        {rows.map((e) => {
          const inflow = INFLOW.has(e.type);
          return (
            <div key={e.id} className="flex items-center justify-between rounded-lg bg-accent/20 px-3 py-2 text-xs">
              <div className="min-w-0">
                <p className="truncate font-medium">{ENTRY_LABELS[e.type] || e.type}{e.note ? ` — ${e.note}` : ""}</p>
                <p className="text-[10px] text-muted-foreground">
                  {[e.date, e.headId, e.chargeCategory, e.serviceCategory].filter(Boolean).join(" · ")}
                </p>
              </div>
              <span className={`shrink-0 pl-2 ${inflow ? "text-success" : "text-destructive"}`}>
                {inflow ? "+" : "-"}{formatCurrency(e.amount)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg bg-accent/20 p-3 text-center">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className={`text-sm font-bold ${color || ""}`}>{value}</p>
    </div>
  );
}

function renderClient(c: Client) {
  return (
    <>
      <Row label="Client ID" value={c.id} />
      <Row label="Head ID" value={c.headId} />
      <Row label="First Name" value={c.firstName} />
      <Row label="Last Name" value={c.lastName} />
      <Row label="Gender" value={c.gender} />
      {c.nationality && <Row label="Nationality" value={c.nationality} />}
      <Row label="Passport" value={c.passport} />
      {c.cnic && <Row label="CNIC" value={c.cnic} />}
      {c.dateOfBirth && <Row label="Date of Birth" value={c.dateOfBirth} />}
      {c.dateOfIssue && <Row label="Date of Issue" value={c.dateOfIssue} />}
      {c.dateOfExpire && <Row label="Date of Expire" value={c.dateOfExpire} />}
      <Row label="Phone" value={c.phone} />
      {c.email && <Row label="Email" value={c.email} />}
      <Row label="Package" value={c.packageType} />
      {c.destination && <Row label="Destination" value={c.destination} />}
      <Row label="Amount Due" value={formatCurrency(c.amountDue)} />
      <Row label="Amount Paid" value={formatCurrency(c.amountPaid)} color="text-success" />
      <Row label="Remaining" value={formatCurrency(c.amountDue - c.amountPaid)} color="text-destructive" />
      <div className="flex justify-between border-b border-border/30 py-2">
        <span className="text-muted-foreground">Status</span>
        <StatusBadge status={c.paymentStatus} />
      </div>
      <Row label="VIP" value={c.isVip ? "⭐ Yes" : "No"} />
      {c.driveLink && <Row label="Drive Link" value={c.driveLink} />}
    </>
  );
}

function renderAgentFull(a: Agent, stats: { agentBookings: any[]; agentClients: Client[]; totalSales: number; totalCommission: number; paidCommission: number; payable: number; received: number; netReceivable: number; outstanding: number }, onViewClients: () => void, onViewBusiness: () => void, onViewOtherSale?: () => void) {
  return (
    <>
      <Row label="Agent ID" value={a.id} />
      <Row label="Name" value={a.name} />
      <Row label="Phone" value={a.phone} />
      <Row label="Email" value={a.email} />
      <div className="flex justify-between border-b border-border/30 py-2">
        <span className="text-muted-foreground">Status</span>
        <StatusBadge status={a.status} />
      </div>

      <div className="grid grid-cols-3 gap-2 pt-2">
        <StatCard label="Total Sales" value={formatCurrency(stats.totalSales)} color="text-primary" />
        <StatCard label="Total Clients" value={String(stats.agentClients.length)} />
        <StatCard label="Bookings" value={String(stats.agentBookings.length)} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Net Receivable" value={formatCurrency(stats.netReceivable)} color="text-primary" />
        <StatCard label="Received" value={formatCurrency(stats.received)} color="text-success" />
        <StatCard label="Remaining" value={formatCurrency(stats.outstanding)} color="text-destructive" />
      </div>
      <AgentServices bookings={stats.agentBookings} otherRows={(stats as any).otherSaleRows || []} />

      <div className="space-y-2">
        <Button onClick={onViewClients} variant="outline" className="w-full gap-2 text-xs">
          <Users className="h-3.5 w-3.5" /> View All Clients ({stats.agentClients.length}) <ChevronRight className="h-3.5 w-3.5 ml-auto" />
        </Button>
        <Button onClick={onViewBusiness} variant="outline" className="w-full gap-2 text-xs">
          <DollarSign className="h-3.5 w-3.5" /> View Business Account <ChevronRight className="h-3.5 w-3.5 ml-auto" />
        </Button>
        {onViewOtherSale && (
          <Button onClick={onViewOtherSale} variant="outline" className="w-full gap-2 text-xs">
            <DollarSign className="h-3.5 w-3.5" /> View Other Sale <ChevronRight className="h-3.5 w-3.5 ml-auto" />
          </Button>
        )}
      </div>
    </>
  );
}

function renderSupplierFull(s: Supplier, stats: { supplierBookings: any[]; totalCost: number; totalPaid: number; remaining: number }, onViewBookings: () => void) {
  return (
    <>
      <Row label="Supplier ID" value={s.id} />
      <Row label="Company" value={s.companyName} />
      <Row label="Contact" value={s.contactPerson} />
      <Row label="Phone" value={s.phone} />
      <Row label="Email" value={s.email} />
      <Row label="Service Type" value={s.serviceType} />

      <div className="grid grid-cols-3 gap-2 pt-2">
        <StatCard label="Total Cost" value={formatCurrency(stats.totalCost)} color="text-primary" />
        <StatCard label="Total Paid" value={formatCurrency(stats.totalPaid)} color="text-success" />
        <StatCard label="Remaining" value={formatCurrency(stats.remaining)} color="text-destructive" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Bookings" value={String(stats.supplierBookings.length)} />
        <StatCard label="Payment %" value={stats.totalCost > 0 ? `${Math.round((stats.totalPaid / stats.totalCost) * 100)}%` : "0%"} />
      </div>

      <Button onClick={onViewBookings} variant="outline" className="w-full gap-2 text-xs">
        <DollarSign className="h-3.5 w-3.5" /> View All Bookings ({stats.supplierBookings.length}) <ChevronRight className="h-3.5 w-3.5 ml-auto" />
      </Button>
    </>
  );
}

function renderBooking(b: Booking) {
  return (
    <>
      <Row label="Booking ID" value={b.id} />
      <Row label="Head ID" value={b.headId} />
      <Row label="Package" value={b.packageType} />
      <Row label="Agent" value={b.agentId || "Direct"} />
      <Row label="Supplier" value={b.supplierId} />
      {b.destination && <Row label="Destination" value={b.destination} />}
      <Row label="Members" value={String(b.members || b.clientIds.length)} />
      <Row label="Total Amount" value={formatCurrency(b.totalAmount)} />
      <Row label="Received" value={formatCurrency(b.amountReceived)} color="text-success" />
      <Row label="Pending" value={formatCurrency(b.totalAmount - b.amountReceived)} color="text-destructive" />
      <Row label="Total Cost" value={formatCurrency(b.totalCost || 0)} />
      <Row label="Commission" value={formatCurrency(b.commission || 0)} />
      <div className="flex justify-between border-b border-border/30 py-2">
        <span className="text-muted-foreground">Status</span>
        <StatusBadge status={b.status} />
      </div>
      <Row label="Travel Date" value={b.travelDate} />
      <Row label="Created" value={b.createdAt} />
      {b.driveLink && <Row label="Drive Link" value={b.driveLink} />}
    </>
  );
}

// ============================================================
// STATEMENT VIEW — professional grouped layout mirroring PDF
// ============================================================

const CATEGORY_LABELS: Record<string, string> = {
  flight: "Flight / Tickets",
  ticket: "Flight / Tickets",
  hotel: "Hotel Accommodation",
  visa: "Visa Services",
  transport: "Transportation",
  ziyarah: "Ziyarah",
  insurance: "Insurance",
  other: "Other Services",
};

function StatementView({
  type, data, entries, includeOpening, onToggleOpening, onDownload,
}: {
  type: "client" | "agent" | "supplier";
  data: Client | Agent | Supplier;
  entries: LedgerEntry[];
  includeOpening: boolean;
  onToggleOpening: (v: boolean) => void;
  onDownload: () => void;
}) {
  // ---------- SUPPLIER ----------
  if (type === "supplier") {
    const s = data as Supplier;
    const purchases = entries.filter((e) => e.type === "purchase");
    const payments = entries.filter((e) => e.type === "supplier_payment");
    const grouped = new Map<string, LedgerEntry[]>();
    purchases.forEach((e) => {
      const cat = (e.serviceCategory || "other").toLowerCase();
      const key = CATEGORY_LABELS[cat] || CATEGORY_LABELS.other;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(e);
    });
    const purchaseTotal = purchases.reduce((sum, e) => sum + e.amount, 0);
    const paidTotal = payments.reduce((sum, e) => sum + e.amount, 0);
    const opening = includeOpening ? (s.openingPayable || 0) : 0;
    const openingPaid = includeOpening ? (s.openingPaid || 0) : 0;
    const grandPayable = opening + purchaseTotal;
    const grandPaid = openingPaid + paidTotal;
    const balance = grandPayable - grandPaid;

    return (
      <div className="space-y-4">
        <StatementHeader
          title="Supplier Ledger Statement"
          rows={[["Supplier", s.companyName], ["Contact", s.contactPerson], ["Phone", s.phone]]}
          includeOpening={includeOpening}
          onToggle={onToggleOpening}
          onDownload={onDownload}
          hasOpening={(s.openingPayable || 0) > 0 || (s.openingPaid || 0) > 0}
        />

        {includeOpening && (s.openingPayable || s.openingPaid) ? (
          <SectionCard title="Brought Forward (B/F)">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <MiniStat label="Opening Payable" value={formatCurrency(s.openingPayable || 0)} />
              <MiniStat label="Opening Paid" value={formatCurrency(s.openingPaid || 0)} tone="success" />
            </div>
          </SectionCard>
        ) : null}

        {grouped.size === 0 && payments.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">No transactions recorded yet.</p>
        )}

        {Array.from(grouped.entries()).map(([label, items]) => {
          const subtotal = items.reduce((s, e) => s + e.amount, 0);
          return (
            <SectionCard key={label} title={label} rightLabel={formatCurrency(subtotal)}>
              <StatementTable
                columns={["Date", "Description", "Amount"]}
                rows={items.map((e) => [e.date, e.note || "—", formatCurrency(e.amount)])}
              />
            </SectionCard>
          );
        })}

        {payments.length > 0 && (
          <SectionCard title="Payments Made" rightLabel={formatCurrency(paidTotal)} tone="success">
            <StatementTable
              columns={["Date", "Method / Note", "Amount"]}
              rows={payments.map((e) => [e.date, e.note || "Payment", formatCurrency(e.amount)])}
            />
          </SectionCard>
        )}

        <SectionCard title="Overview" highlight>
          <div className="space-y-1.5 text-xs">
            {includeOpening && (s.openingPayable || 0) > 0 && <OverviewRow label="Opening Payable" value={formatCurrency(s.openingPayable || 0)} />}
            <OverviewRow label="Total Purchases" value={formatCurrency(purchaseTotal)} />
            <OverviewRow label="Grand Total Payable" value={formatCurrency(grandPayable)} bold />
            {includeOpening && (s.openingPaid || 0) > 0 && <OverviewRow label="Opening Paid" value={formatCurrency(s.openingPaid || 0)} tone="success" />}
            <OverviewRow label="Payments Made" value={formatCurrency(paidTotal)} tone="success" />
            <OverviewRow label="Grand Total Paid" value={formatCurrency(grandPaid)} bold tone="success" />
            <div className="border-t border-primary/30 pt-1.5 mt-1.5" />
            <OverviewRow label="Closing Balance" value={formatCurrency(balance)} bold tone={balance > 0 ? "destructive" : "success"} />
          </div>
        </SectionCard>
      </div>
    );
  }

  // ---------- AGENT ----------
  if (type === "agent") {
    const a = data as Agent;
    const commissions = entries.filter((e) => e.type === "agent_commission");
    const earned = a.commission || 0;
    const paid = commissions.reduce((s, e) => s + e.amount, 0);
    const opening = includeOpening ? (a.openingCommission || 0) : 0;
    const openingPaid = includeOpening ? (a.openingPaidCommission || 0) : 0;
    const totalEarned = earned + opening;
    const totalPaid = paid + openingPaid;
    const balance = totalEarned - totalPaid;

    return (
      <div className="space-y-4">
        <StatementHeader
          title="Agent Commission Statement"
          rows={[["Agent", a.name], ["Phone", a.phone], ["Email", a.email]]}
          includeOpening={includeOpening}
          onToggle={onToggleOpening}
          onDownload={onDownload}
          hasOpening={(a.openingCommission || 0) > 0 || (a.openingPaidCommission || 0) > 0}
        />

        <SectionCard title="Commissions Earned" rightLabel={formatCurrency(earned)}>
          {includeOpening && (a.openingCommission || 0) > 0 && (
            <div className="text-[11px] text-muted-foreground pb-2 border-b border-border/30 mb-2">
              B/F Opening Commission: <span className="text-foreground font-medium">{formatCurrency(a.openingCommission || 0)}</span>
            </div>
          )}
          {earned === 0 && commissions.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No commission activity yet.</p>
          ) : (
            <p className="text-xs text-muted-foreground">Total commission accrued from bookings.</p>
          )}
        </SectionCard>

        {commissions.length > 0 && (
          <SectionCard title="Commission Payments" rightLabel={formatCurrency(paid)} tone="success">
            <StatementTable
              columns={["Date", "Description", "Amount"]}
              rows={commissions.map((e) => [e.date, e.note || "Payment", formatCurrency(e.amount)])}
            />
          </SectionCard>
        )}

        <SectionCard title="Overview" highlight>
          <div className="space-y-1.5 text-xs">
            <OverviewRow label="Total Commission" value={formatCurrency(totalEarned)} bold />
            <OverviewRow label="Total Paid" value={formatCurrency(totalPaid)} bold tone="success" />
            <div className="border-t border-primary/30 pt-1.5 mt-1.5" />
            <OverviewRow label="Payable Balance" value={formatCurrency(balance)} bold tone={balance > 0 ? "destructive" : "success"} />
          </div>
        </SectionCard>
      </div>
    );
  }

  // ---------- CLIENT ----------
  const c = data as Client;
  const receipts = entries.filter((e) => e.type === "client_receive");
  const paid = receipts.reduce((s, e) => s + e.amount, 0);
  const remaining = c.amountDue - c.amountPaid;

  return (
    <div className="space-y-4">
      <StatementHeader
        title="Client Account Statement"
        rows={[["Client", getClientName(c)], ["Head ID", c.headId], ["Phone", c.phone]]}
        includeOpening={includeOpening}
        onToggle={onToggleOpening}
        onDownload={onDownload}
        hasOpening={false}
      />

      <SectionCard title="Booking Charges" rightLabel={formatCurrency(c.amountDue)}>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <MiniStat label="Package" value={c.packageType} />
          <MiniStat label="Destination" value={c.destination || "—"} />
          <MiniStat label="Total Due" value={formatCurrency(c.amountDue)} />
          <MiniStat label="Amount Paid" value={formatCurrency(c.amountPaid)} tone="success" />
        </div>
      </SectionCard>

      {receipts.length > 0 && (
        <SectionCard title="Payments Received" rightLabel={formatCurrency(paid)} tone="success">
          <StatementTable
            columns={["Date", "Description", "Amount"]}
            rows={receipts.map((e) => [e.date, e.note || "Receipt", formatCurrency(e.amount)])}
          />
        </SectionCard>
      )}

      <SectionCard title="Overview" highlight>
        <div className="space-y-1.5 text-xs">
          <OverviewRow label="Total Due" value={formatCurrency(c.amountDue)} bold />
          <OverviewRow label="Total Paid" value={formatCurrency(c.amountPaid)} bold tone="success" />
          <div className="border-t border-primary/30 pt-1.5 mt-1.5" />
          <OverviewRow label="Remaining Balance" value={formatCurrency(remaining)} bold tone={remaining > 0 ? "destructive" : "success"} />
        </div>
      </SectionCard>
    </div>
  );
}

function StatementHeader({ title, rows, includeOpening, onToggle, onDownload, hasOpening }: {
  title: string; rows: [string, string][]; includeOpening: boolean; onToggle: (v: boolean) => void; onDownload: () => void; hasOpening: boolean;
}) {
  return (
    <div className="rounded-lg border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-primary/70">Avery Group of Travel</p>
          <p className="text-sm font-semibold text-primary font-serif">{title}</p>
        </div>
        <Button size="sm" variant="outline" onClick={onDownload} className="gap-1.5 text-xs">
          <Download className="h-3.5 w-3.5" /> PDF
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-2 text-[11px] pt-1 border-t border-border/30">
        {rows.map(([k, v]) => (
          <div key={k}>
            <p className="text-muted-foreground text-[9px] uppercase">{k}</p>
            <p className="font-medium truncate">{v}</p>
          </div>
        ))}
      </div>
      {hasOpening && (
        <label className="flex items-center gap-2 text-[11px] pt-1 cursor-pointer">
          <input type="checkbox" checked={includeOpening} onChange={(e) => onToggle(e.target.checked)} className="accent-primary" />
          <span className="text-muted-foreground">Include opening balance (B/F)</span>
        </label>
      )}
    </div>
  );
}

function SectionCard({ title, rightLabel, tone, highlight, children }: {
  title: string; rightLabel?: string; tone?: "success" | "destructive"; highlight?: boolean; children: React.ReactNode;
}) {
  const toneClass = tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-primary";
  return (
    <div className={`rounded-lg border ${highlight ? "border-primary/40 bg-primary/5" : "border-border/50 bg-accent/10"} overflow-hidden`}>
      <div className={`flex items-center justify-between px-3 py-2 border-b ${highlight ? "border-primary/30 bg-primary/10" : "border-border/40 bg-accent/20"}`}>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary font-serif">{title}</p>
        {rightLabel && <p className={`text-xs font-bold ${toneClass}`}>{rightLabel}</p>}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function StatementTable({ columns, rows }: { columns: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-border/40">
            {columns.map((c, i) => (
              <th key={c} className={`py-1.5 px-2 text-[10px] uppercase text-muted-foreground font-medium ${i === columns.length - 1 ? "text-right" : "text-left"}`}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/20 last:border-0">
              {r.map((cell, j) => (
                <td key={j} className={`py-1.5 px-2 ${j === r.length - 1 ? "text-right font-medium" : "text-left"}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "success" | "destructive" }) {
  const c = tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "";
  return (
    <div>
      <p className="text-[9px] uppercase text-muted-foreground">{label}</p>
      <p className={`text-xs font-semibold ${c}`}>{value}</p>
    </div>
  );
}

function OverviewRow({ label, value, bold, tone }: { label: string; value: string; bold?: boolean; tone?: "success" | "destructive" }) {
  const c = tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "";
  return (
    <div className="flex justify-between items-center">
      <span className={`text-muted-foreground ${bold ? "font-semibold text-foreground" : ""}`}>{label}</span>
      <span className={`${bold ? "font-bold" : "font-medium"} ${c}`}>{value}</span>
    </div>
  );
}


/** One-by-one service breakdown for an agent (bookings' services + other-sale purchases), grouped like the supplier view. */
function AgentServices({ bookings, otherRows }: { bookings: Booking[]; otherRows: LedgerEntry[] }) {
  type Item = { key: string; title: string; sub: string; amount?: number; head: string };
  const groups: Record<string, Item[]> = { Hotel: [], Flight: [], Visa: [], Transport: [], Other: [] };
  bookings.forEach((b) => {
    (b.hotels || []).forEach((h: any, i) => groups.Hotel.push({ key: `${b.id}h${i}`, head: b.headId, title: h.hotelName || h.name || "Hotel", sub: [h.city, h.checkIn && `${h.checkIn} → ${h.checkOut || ""}`, h.rooms && `${h.rooms} room(s)`].filter(Boolean).join(" · ") }));
    (b.flights || []).forEach((f: any, i) => groups.Flight.push({ key: `${b.id}f${i}`, head: b.headId, title: [f.airline, f.flightNumber].filter(Boolean).join(" ") || "Flight", sub: [f.from && `${f.from} → ${f.to || ""}`, f.departureDate || f.date, f.pnr && `PNR ${f.pnr}`].filter(Boolean).join(" · ") }));
    (b.visas || []).forEach((v: any, i) => groups.Visa.push({ key: `${b.id}v${i}`, head: b.headId, title: v.visaType || v.type || "Visa", sub: [v.country, v.status].filter(Boolean).join(" · ") }));
    (b.transports || []).forEach((t: any, i) => groups.Transport.push({ key: `${b.id}t${i}`, head: b.headId, title: t.route || t.vehicle || "Transport", sub: [t.vehicle, t.date].filter(Boolean).join(" · ") }));
    ((b as any).others || []).forEach((o: any, i: number) => groups.Other.push({ key: `${b.id}o${i}`, head: b.headId, title: o.name || o.description || "Service", sub: o.description || "" }));
  });
  otherRows.forEach((e) => {
    const cat = e.serviceCategory && groups[e.serviceCategory] ? e.serviceCategory : "Other";
    const d = e.purchaseDetails || {};
    groups[cat].push({ key: e.id, head: e.forClientName || "Other Sale", title: d.hotelName || d.visaType || d.route || d.description || e.note || "Other Sale", sub: [e.date, d.city, `Other Sale`].filter(Boolean).join(" · "), amount: e.type === "purchase" ? (e.saleAmount ?? e.amount) : e.amount });
  });
  const keys = Object.keys(groups).filter((k) => groups[k].length);
  if (!keys.length) return <p className="rounded-lg border border-border/50 p-3 text-center text-[11px] text-muted-foreground">No services recorded for this agent yet.</p>;
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Services — one by one</p>
      {keys.map((k) => (
        <div key={k} className="rounded-lg border border-border/50">
          <div className="flex items-center justify-between border-b border-border/40 bg-accent/10 px-3 py-1.5">
            <span className="text-xs font-semibold text-primary">{k}</span>
            <span className="text-[10px] text-muted-foreground">{groups[k].length} item(s)</span>
          </div>
          {groups[k].map((it) => (
            <div key={it.key} className="flex items-center justify-between border-b border-border/20 px-3 py-1.5 last:border-0">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">{it.title}</p>
                <p className="truncate text-[10px] text-muted-foreground">{it.head}{it.sub ? ` · ${it.sub}` : ""}</p>
              </div>
              {it.amount != null && <span className="text-xs font-semibold text-primary">{formatCurrency(it.amount)}</span>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
