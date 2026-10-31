import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, getClientName } from "@/lib/data";
import { useStore } from "@/lib/store";
import { computeHeadBusiness } from "@/lib/heads";

function Kpi({ label, value, tone = "text-foreground" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-accent/10 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function Line({ label, value, sign = "", strong, tone = "" }: { label: string; value: number; sign?: string; strong?: boolean; tone?: string }) {
  return (
    <div className={`flex justify-between py-1.5 text-xs ${strong ? "border-t border-border/60 pt-2 text-sm font-bold" : ""}`}>
      <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
      <span className={`tabular-nums ${tone}`}>{sign}{formatCurrency(value)}</span>
    </div>
  );
}

/** Professional booking view: Members tab (per-person money) + Business Ledger tab (cost & profit). */
export default function BookingViewDialog({ headId, onClose }: { headId: string | null; onClose: () => void }) {
  const store = useStore();
  const [tab, setTab] = useState<"members" | "business">("members");
  const booking = store.bookings.find((b) => b.headId === headId);
  const hb = useMemo(() => (headId ? computeHeadBusiness(headId, store.clients, store.bookings, store.entries) : null), [headId, store.clients, store.bookings, store.entries]);
  if (!headId || !hb) return null;

  const linked = hb.linked;
  const gifts = linked.filter((e) => e.type === "gift" || e.type === "expense").reduce((s, e) => s + e.amount, 0);
  const agent = booking?.agentId ? store.agents.find((a) => a.id === booking.agentId) : null;
  const profit = hb.netProfit - gifts;
  const members = store.clients.filter((c) => c.headId === headId);

  return (
    <Dialog open={!!headId} onOpenChange={(o) => { if (!o) { onClose(); setTab("members"); } }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-border bg-card">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-baseline gap-2">
            <span className="text-primary">{headId}</span>
            <span className="text-sm font-normal text-muted-foreground">{hb.leadName} · {booking?.packageType} · {booking?.travelDate} · {agent ? `Agent: ${agent.name}` : "Direct"}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Kpi label="Net Receivable" value={formatCurrency(hb.netReceivable)} tone="text-primary" />
          <Kpi label="Received" value={formatCurrency(hb.received)} tone="text-success" />
          <Kpi label="Remaining" value={formatCurrency(hb.outstanding)} tone="text-destructive" />
          <Kpi label="Net Profit" value={formatCurrency(profit)} tone={profit >= 0 ? "text-success" : "text-destructive"} />
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-accent/10 p-1">
          {(["members", "business"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-md py-2 text-xs font-semibold ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              {t === "members" ? `Member Details (${members.length})` : "Business Ledger"}
            </button>
          ))}
        </div>

        {tab === "members" && (
          <div className="grid gap-3 sm:grid-cols-2">
            {members.map((c) => {
              const refunds = store.entries.filter((e) => e.type === "client_refund" && e.clientId === c.id).reduce((s, e) => s + e.amount, 0);
              const charges = store.entries.filter((e) => e.type === "client_charge" && e.clientId === c.id).reduce((s, e) => s + e.amount, 0);
              const ledger = store.entries.filter((e) => (e.clientId === c.id || e.referenceId === c.id) && ["client_receive", "client_charge", "client_refund"].includes(e.type)).sort((a, b) => a.date.localeCompare(b.date));
              const remaining = Math.max(0, c.amountDue - c.amountPaid);
              return (
                <div key={c.id} className="rounded-xl border border-border/60 bg-accent/5 p-4">
                  <div className="mb-2 flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold">{getClientName(c)}</p>
                      <p className="text-[10px] text-muted-foreground">{c.id} · {c.ageCategory || "Adult"} · {c.gender} · {c.passport || "No passport"}</p>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] ${c.paymentStatus === "Paid" ? "border-success/40 text-success" : c.paymentStatus === "Partial" ? "border-warning/40 text-warning" : "border-destructive/40 text-destructive"}`}>{c.paymentStatus}</span>
                  </div>
                  <Line label="Package (per person)" value={c.baseDue ?? c.amountDue} />
                  {charges > 0 && <Line label="Extra charges" value={charges} sign="+ " />}
                  {refunds > 0 && <Line label="Refunds" value={refunds} sign="− " tone="text-destructive" />}
                  <Line label="Total Amount" value={c.amountDue} strong />
                  <Line label="Received" value={c.amountPaid} tone="text-success" />
                  <Line label="Remaining" value={remaining} tone={remaining > 0 ? "text-destructive" : "text-success"} />
                  {ledger.length > 0 && (
                    <div className="mt-2 border-t border-border/40 pt-2">
                      <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Ledger</p>
                      {ledger.map((e) => (
                        <div key={e.id} className="flex justify-between text-[10px]">
                          <span className="text-muted-foreground">{e.date} · {e.type === "client_receive" ? "Received" : e.type === "client_refund" ? "Refund" : e.chargeCategory || "Charge"}</span>
                          <span className={e.type === "client_receive" ? "text-success" : e.type === "client_refund" ? "text-destructive" : ""}>{formatCurrency(e.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {members.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">No members yet.</p>}
          </div>
        )}

        {tab === "business" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-primary">Profit & Loss</p>
              <Line label={`Sale (${hb.members} × ${formatCurrency(hb.perPerson)})`} value={hb.totalSale - hb.otherCosts} />
              {hb.otherCosts > 0 && <Line label="Extra charges" value={hb.otherCosts} sign="+ " />}
              {hb.refunds > 0 && <Line label="Client refunds" value={hb.refunds} sign="− " />}
              <Line label="Net Sale" value={hb.netReceivable} strong />
              <Line label="Supplier purchases" value={hb.totalPurchase} sign="− " tone="text-warning" />
              <Line label={`Agent commission${agent ? ` (${agent.name})` : ""}`} value={hb.commission} sign="− " tone="text-warning" />
              {gifts > 0 && <Line label="Gifts & expenses" value={gifts} sign="− " tone="text-warning" />}
              <Line label="Net Profit" value={profit} strong tone={profit >= 0 ? "text-success" : "text-destructive"} />
              <div className="mt-3 border-t border-border/40 pt-2">
                <Line label="Supplier paid" value={hb.supplierPaid} tone="text-success" />
                <Line label="Supplier remaining" value={hb.supplierRemaining} tone="text-destructive" />
              </div>
            </div>
            <div className="rounded-xl border border-border/60 p-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Cost Entries</p>
              {linked.filter((e) => ["purchase", "supplier_refund", "gift", "expense"].includes(e.type)).map((e) => (
                <div key={e.id} className="flex items-center justify-between border-b border-border/30 py-1.5 text-[11px] last:border-0">
                  <div>
                    <p className="font-medium">{e.type === "purchase" ? `Purchase — ${e.referenceName}` : e.type === "supplier_refund" ? `Supplier refund — ${e.referenceName}` : e.note || e.referenceName}</p>
                    <p className="text-[10px] text-muted-foreground">{[e.date, e.serviceCategory].filter(Boolean).join(" · ")}</p>
                  </div>
                  <span className={e.type === "supplier_refund" ? "text-success" : "text-warning"}>{e.type === "supplier_refund" ? "+" : "−"} {formatCurrency(e.amount)}</span>
                </div>
              ))}
              {!linked.some((e) => ["purchase", "supplier_refund", "gift", "expense"].includes(e.type)) && <p className="py-4 text-center text-[11px] text-muted-foreground">No costs posted yet.</p>}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
