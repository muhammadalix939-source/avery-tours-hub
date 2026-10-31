import { useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/data";
import { useStore } from "@/lib/store";
import { computeHeadBusiness } from "@/lib/heads";
import { ChevronDown, ChevronUp } from "lucide-react";

function Row({ label, value, muted, sign }: { label: string; value: number; muted?: boolean; sign?: string }) {
  return (
    <div className="flex items-baseline justify-between py-1.5">
      <span className={`text-xs ${muted ? "text-muted-foreground" : "text-foreground/80"}`}>{label}</span>
      <span className="text-sm font-semibold tabular-nums text-foreground">{sign}{formatCurrency(value)}</span>
    </div>
  );
}

/** Head / Group Business View — opens as a modal card, never a page navigation. */
export default function HeadBusinessCard({ headId, open, onOpenChange }: { headId: string | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const store = useStore();
  const [expanded, setExpanded] = useState(false);
  const hb = useMemo(
    () => (headId ? computeHeadBusiness(headId, store.clients, store.bookings, store.entries) : null),
    [headId, store.clients, store.bookings, store.entries],
  );
  if (!hb) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden border-border bg-card p-0">
        <div className="bg-sidebar px-6 py-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/70">{hb.headId}</p>
          <h2 className="mt-1 text-lg font-bold text-foreground">{hb.leadName}</h2>
          <div className="mt-2 h-[2px] w-16 rounded-full bg-primary" />
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-6">
          <Row label="Total Members" value={hb.members} muted />
          <Row label="Per Person Amount" value={hb.perPerson} />
          <Row label="Other Costs (visa / hotel / transport)" value={hb.otherCosts} />
          <div className="my-2 border-t border-border/60" />
          <Row label="Total Sale Amount" value={hb.totalSale} />
          <Row label="(–) Refunds" value={hb.refunds} sign="–" />
          <Row label="= Net Receivable" value={hb.netReceivable} />
          <div className="my-2 border-t border-border/60" />
          <Row label="Total Purchase (Cost)" value={hb.totalPurchase} />
          <Row label="Commission" value={hb.commission} />
          <div className="my-2 border-t border-border/60" />
          <div className="flex items-baseline justify-between rounded-lg bg-primary/5 px-3 py-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Net Profit</span>
            <span className={`text-2xl font-bold tabular-nums ${hb.netProfit >= 0 ? "gold-text" : "text-destructive"}`}>{formatCurrency(hb.netProfit)}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
            <p>Received: <span className="font-semibold text-success">{formatCurrency(hb.received)}</span></p>
            <p>Outstanding: <span className="font-semibold text-warning">{formatCurrency(hb.outstanding)}</span></p>
          </div>

          <button type="button" onClick={() => setExpanded(!expanded)} className="mt-5 flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            View all linked entries {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {expanded && (
            <div className="mt-3 overflow-hidden rounded-lg border border-border/60">
              <table className="w-full text-xs">
                <thead className="bg-accent/20 text-[10px] uppercase text-muted-foreground">
                  <tr><th className="p-2 text-left">Date</th><th className="p-2 text-left">Type</th><th className="p-2 text-left">Reference</th><th className="p-2 text-right">Amount</th></tr>
                </thead>
                <tbody>
                  {hb.linked.length === 0 && <tr><td colSpan={4} className="p-3 text-center text-muted-foreground">No linked entries yet.</td></tr>}
                  {hb.linked.map((e) => (
                    <tr key={e.id} className="border-t border-border/40">
                      <td className="p-2 text-muted-foreground">{e.date}</td>
                      <td className="p-2 capitalize">{e.type.replace(/_/g, " ")}</td>
                      <td className="p-2 text-muted-foreground">{e.referenceName || "—"}</td>
                      <td className="p-2 text-right font-semibold tabular-nums">{formatCurrency(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
