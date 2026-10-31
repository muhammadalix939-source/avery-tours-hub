import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Download } from "lucide-react";

export interface StatementGroupOption { id: string; label: string; hint?: string; }

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  subtitle?: string;
  groups?: StatementGroupOption[];
  /** Show "Client business / Other sale" checkboxes (agent statements). */
  showScope?: boolean;
  onDownload: (range: { fromDate?: string; toDate?: string; includeOpening?: boolean; groupId?: string; groupLabel?: string; scope?: "client" | "other" | "both" }) => void;
}

export default function StatementDialog({ open, onOpenChange, title, subtitle, groups, showScope, onDownload }: Props) {
  const [incClient, setIncClient] = useState(true);
  const [incOther, setIncOther] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [includeOpening, setIncludeOpening] = useState(true);
  const [groupId, setGroupId] = useState<string>("");

  function handle(allTime = false) {
    const g = groups?.find((x) => x.id === groupId);
    if (showScope && !incClient && !incOther) return;
    const scope = showScope ? ((incClient && incOther ? "both" : incClient ? "client" : "other") as "client" | "other" | "both") : undefined;
    onDownload(allTime
      ? { includeOpening, groupId: groupId || undefined, groupLabel: g?.label, scope }
      : { fromDate: fromDate || undefined, toDate: toDate || undefined, includeOpening, groupId: groupId || undefined, groupLabel: g?.label, scope });
    onOpenChange(false);
  }

  function preset(months: number) {
    const to = new Date();
    const from = new Date();
    from.setMonth(from.getMonth() - months);
    setFromDate(from.toISOString().slice(0, 10));
    setToDate(to.toISOString().slice(0, 10));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-primary">{title}</DialogTitle>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">From Date</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                className="bg-accent/20 border-border mt-1 h-9 text-xs" />
            </div>
            <div>
              <Label className="text-xs">To Date</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                className="bg-accent/20 border-border mt-1 h-9 text-xs" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => preset(1)} className="text-xs">Last 30 days</Button>
            <Button variant="outline" size="sm" onClick={() => preset(3)} className="text-xs">Last 3 months</Button>
            <Button variant="outline" size="sm" onClick={() => preset(6)} className="text-xs">Last 6 months</Button>
            <Button variant="outline" size="sm" onClick={() => preset(12)} className="text-xs">Last year</Button>
          </div>
          {groups && groups.length > 0 && (
            <div>
              <Label className="text-xs">Filter by Group (optional)</Label>
              <select value={groupId} onChange={(e) => setGroupId(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-accent/20 px-2 py-2 text-xs">
                <option value="">All groups (no filter)</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.label}{g.hint ? ` — ${g.hint}` : ""}</option>
                ))}
              </select>
              {groupId && <p className="mt-1 text-[10px] text-muted-foreground">Only purchases tagged to this group will be included. Opening balance is disabled for group-filtered statements.</p>}
            </div>
          )}
          {showScope && (
            <div className="space-y-2 rounded-lg border border-border/50 bg-accent/10 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Include in statement</p>
              <label className="flex items-start gap-2 text-xs">
                <Checkbox checked={incClient} onCheckedChange={(v) => setIncClient(!!v)} />
                <span>Client business <span className="text-muted-foreground">— clients by his reference, sale minus his commission</span></span>
              </label>
              <label className="flex items-start gap-2 text-xs">
                <Checkbox checked={incOther} onCheckedChange={(v) => setIncOther(!!v)} />
                <span>Other sale <span className="text-muted-foreground">— purchases made for this agent, service-wise</span></span>
              </label>
              {!incClient && !incOther && <p className="text-[10px] text-destructive">Select at least one.</p>}
            </div>
          )}
          <label className="flex items-center gap-2 rounded-lg border border-border/50 bg-accent/10 p-2 text-xs">
            <Checkbox checked={includeOpening} onCheckedChange={(v) => setIncludeOpening(!!v)} />
            <span>Include opening balance (brought-forward) in totals</span>
          </label>
          <div className="flex gap-2 pt-2">
            <Button onClick={() => handle(true)} variant="outline" className="flex-1 gap-2">
              <Download className="h-4 w-4" /> All-time
            </Button>
            <Button onClick={() => handle(false)} className="flex-1 gap-2">
              <Download className="h-4 w-4" /> Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}