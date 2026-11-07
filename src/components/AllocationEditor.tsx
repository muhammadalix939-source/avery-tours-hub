// Cost Allocation editor — one table used for BOTH split purchases (cost → heads / agents / office)
// and supplier-payment tags (money → heads / groups / agents / unallocated). Pure UI: the parent owns the rows
// and runs the validators from `@/lib/allocations`, so Save can be disabled there.
import { useEffect } from "react";
import { Lock, LockOpen, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/SearchableSelect";
import { formatCurrency } from "@/lib/data";
import { rebalanceEqual, autoBalanceLast } from "@/lib/allocations";
import type { CostAllocation, PaymentAllocation } from "@/lib/store";

export type AllocTarget = "head" | "agent" | "office" | "group" | "unallocated";
export interface AllocRow {
  id: string;
  target: AllocTarget;
  headId?: string;
  clientId?: string;
  agentId?: string;
  groupId?: string;
  amount: number;
  saleAmount?: number;
  forClientName?: string;
  locked?: boolean;
  billClient?: boolean;
}

let rowSeq = 0;
export const newRowId = () => `A${++rowSeq}`;

/** UI rows → stored purchase lines (only meaningful keys are written; exactOptionalPropertyTypes friendly). */
export function toCostAllocations(rows: AllocRow[]): CostAllocation[] {
  return rows
    .filter((r) => r.target === "head" || r.target === "agent" || r.target === "office")
    .map((r, i) => ({
      id: `A${i + 1}`,
      target: r.target as CostAllocation["target"],
      amount: r.amount,
      ...(r.target === "head" && r.headId ? { headId: r.headId } : {}),
      ...(r.target === "head" && r.clientId ? { clientId: r.clientId } : {}),
      ...(r.target === "head" && r.billClient ? { billClient: true } : {}),
      ...(r.target === "agent" && r.agentId ? { agentId: r.agentId } : {}),
      ...(r.target === "agent" && r.saleAmount !== undefined && r.saleAmount !== r.amount ? { saleAmount: r.saleAmount } : {}),
      ...(r.target === "agent" && r.forClientName ? { forClientName: r.forClientName } : {}),
      ...(r.locked ? { locked: true } : {}),
    }));
}

export function toPaymentAllocations(rows: AllocRow[]): PaymentAllocation[] {
  return rows
    .filter((r) => r.target === "head" || r.target === "group" || r.target === "agent" || r.target === "unallocated")
    .map((r, i) => ({
      id: `P${i + 1}`,
      target: r.target as PaymentAllocation["target"],
      amount: r.amount,
      ...(r.target === "head" && r.headId ? { headId: r.headId } : {}),
      ...(r.target === "group" && r.groupId ? { groupId: r.groupId } : {}),
      ...(r.target === "agent" && r.agentId ? { agentId: r.agentId } : {}),
    }));
}

export function rowsFromCost(lines: CostAllocation[]): AllocRow[] {
  return lines.map((l) => ({
    id: newRowId(), target: l.target, amount: l.amount,
    ...(l.headId ? { headId: l.headId } : {}), ...(l.clientId ? { clientId: l.clientId } : {}), ...(l.agentId ? { agentId: l.agentId } : {}),
    ...(l.saleAmount !== undefined ? { saleAmount: l.saleAmount } : {}), ...(l.forClientName ? { forClientName: l.forClientName } : {}),
    ...(l.locked ? { locked: true } : {}), ...(l.billClient ? { billClient: true } : {}),
  }));
}

export function rowsFromPayment(lines: PaymentAllocation[]): AllocRow[] {
  return lines.map((l) => ({
    id: newRowId(), target: l.target, amount: l.amount,
    ...(l.headId ? { headId: l.headId } : {}), ...(l.groupId ? { groupId: l.groupId } : {}), ...(l.agentId ? { agentId: l.agentId } : {}),
  }));
}

interface Option { value: string; label: string; hint?: string }
interface Props {
  kind: "purchase" | "payment";
  total: number;
  rows: AllocRow[];
  onRows: (rows: AllocRow[]) => void;
  allocMode: "equal" | "manual";
  onAllocMode: (m: "equal" | "manual") => void;
  heads: Option[];
  agents: Option[];
  groups?: Option[];
  membersOf: (headId: string) => Option[];
  errors: string[];
  remaining: number;
  /** Amber (non-blocking) hint for a row, e.g. a payment bigger than the head's outstanding supplier cost. */
  warn?: (row: AllocRow) => string | null;
}

const TYPE_LABEL: Record<AllocTarget, string> = { head: "Head", agent: "Agent", office: "Office", group: "Group", unallocated: "Unallocated" };

export default function AllocationEditor({ kind, total, rows, onRows, allocMode, onAllocMode, heads, agents, groups = [], membersOf, errors, remaining, warn }: Props) {
  const isEqual = allocMode === "equal";
  const t = Math.max(0, Math.round(total) || 0);

  // Equal mode: keep shares in step with the total and the number of rows (also when the amount field changes).
  useEffect(() => {
    if (!isEqual || !rows.length) return;
    const next = rebalanceEqual(rows.map((r) => ({ ...r, locked: false })), t);
    if (next.some((r, i) => r.amount !== rows[i].amount)) onRows(next);
  }, [isEqual, t, rows, onRows]);

  const settle = (next: AllocRow[]) => onRows(isEqual ? rebalanceEqual(next.map((r) => ({ ...r, locked: false })), t) : next);
  const patch = (id: string, p: Partial<AllocRow>) => settle(rows.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const add = (target: AllocTarget) => settle([...rows, { id: newRowId(), target, amount: 0 }]);
  const remove = (id: string) => settle(rows.filter((r) => r.id !== id));

  const remainder = isEqual && rows.length > 0 && t % rows.length !== 0;
  const allocated = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const ok = remaining === 0 && rows.length > 0;

  return (
    <div className="space-y-3" data-testid="allocation-editor">
      <div className="flex flex-wrap items-center gap-2">
        <div className="grid grid-cols-2 gap-1 rounded-md border border-border bg-accent/10 p-1">
          {(["equal", "manual"] as const).map((m) => (
            <button key={m} type="button" onClick={() => { onAllocMode(m); if (m === "equal") onRows(rebalanceEqual(rows.map((r) => ({ ...r, locked: false })), t)); }}
              className={`min-h-8 rounded px-3 text-[11px] font-semibold capitalize ${allocMode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{m}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]" aria-live="polite">
          <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">Total <b className="text-foreground tabular-nums">{formatCurrency(t)}</b></span>
          <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">Allocated <b className="text-foreground tabular-nums">{formatCurrency(allocated)}</b></span>
          <span className={`rounded-full border px-2 py-0.5 ${ok ? "border-success/40 text-success" : "border-destructive/40 text-destructive"}`}>
            Remaining <b className="tabular-nums">{remaining > 0 ? "+" : remaining < 0 ? "−" : ""}{formatCurrency(Math.abs(remaining))}</b>
          </span>
        </div>
      </div>
      {remainder && <p className="text-[10px] text-muted-foreground">Equal split — the odd {t % rows.length} PKR is added one rupee at a time to the first lines, so nothing is lost.</p>}

      <div className="space-y-2">
        {rows.map((r, i) => {
          const warning = warn?.(r) || null;
          const members = r.target === "head" && r.headId ? membersOf(r.headId) : [];
          return (
            <div key={r.id} className="rounded-lg border border-border/60 bg-accent/10 p-2">
              {/* Line 1: type + who + actions. Line 2: member / client name + share. (Dialog is narrow, so no viewport breakpoints.) */}
              <div className="grid grid-cols-[76px_minmax(0,1fr)_auto] items-center gap-2">
                <span className="inline-flex h-8 items-center justify-center rounded-md border border-primary/40 bg-primary/10 text-[10px] font-semibold uppercase tracking-wider text-primary">{TYPE_LABEL[r.target]}</span>
                {r.target === "head" && <SearchableSelect value={r.headId || ""} onChange={(v) => patch(r.id, { headId: v, clientId: "" })} placeholder="Search head…" options={heads} />}
                {r.target === "agent" && <SearchableSelect value={r.agentId || ""} onChange={(v) => patch(r.id, { agentId: v })} placeholder="Search agent…" options={agents} />}
                {r.target === "group" && <SearchableSelect value={r.groupId || ""} onChange={(v) => patch(r.id, { groupId: v })} placeholder="Search group / PNR…" options={groups} />}
                {(r.target === "office" || r.target === "unallocated") && <span className="text-[11px] text-muted-foreground">{r.target === "office" ? "Office / stock — no client or agent bears it" : "Not tagged to anyone"}</span>}
                <div className="flex items-center justify-end gap-1">
                  {!isEqual && (
                    <button type="button" onClick={() => patch(r.id, { locked: !r.locked })} aria-label={r.locked ? "Unlock share" : "Lock share"} className="grid h-8 w-8 place-items-center rounded-md hover:bg-accent">
                      {r.locked ? <Lock className="h-3.5 w-3.5 text-primary" /> : <LockOpen className="h-3.5 w-3.5 text-muted-foreground" />}
                    </button>
                  )}
                  <button type="button" onClick={() => remove(r.id)} aria-label={`Remove line ${i + 1}`} className="grid h-8 w-8 place-items-center rounded-md hover:bg-accent"><X className="h-3.5 w-3.5 text-destructive" /></button>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-[minmax(0,1fr)_132px] items-center gap-2">
                {r.target === "head" ? (
                  <SearchableSelect value={r.clientId || ""} onChange={(v) => patch(r.id, { clientId: v })} placeholder="Whole head (or pick a member)" options={members} />
                ) : r.target === "agent" && kind === "purchase" ? (
                  <Input aria-label={`End client for line ${i + 1}`} value={r.forClientName || ""} onChange={(e) => { const { value } = e.target; const next = rows.map((x) => (x.id === r.id ? { ...x, forClientName: value } : x)); onRows(next); }} placeholder="Passenger / client name" className="h-8 bg-accent/20 border-border text-xs" />
                ) : <span />}
                <Input
                  aria-label={`Share for line ${i + 1}`} type="number" inputMode="numeric" min={0} step={1}
                  value={r.amount ? String(r.amount) : ""} readOnly={isEqual} placeholder="Share PKR"
                  onChange={(e) => patch(r.id, { amount: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                  className={`h-8 border-border text-right text-xs tabular-nums ${isEqual ? "bg-accent/10 text-muted-foreground" : "bg-accent/20"}`}
                />
              </div>

              {r.target === "agent" && kind === "purchase" && (
                <div className="mt-2 grid gap-1">
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <label className="text-[10px] text-muted-foreground" htmlFor={`sale-${r.id}`}>Sale to agent</label>
                    <Input id={`sale-${r.id}`} type="number" inputMode="numeric" min={0} value={r.saleAmount !== undefined ? String(r.saleAmount) : ""} placeholder={r.amount ? String(r.amount) : "Same as cost"}
                      onChange={(e) => { const raw = e.target.value; const next = rows.map((x) => { if (x.id !== r.id) return x; const { saleAmount: _drop, ...rest } = x; void _drop; return raw === "" ? rest : { ...rest, saleAmount: Math.max(0, Math.round(Number(raw) || 0)) }; }); onRows(next); }}
                      className="h-8 w-32 bg-accent/20 border-border text-right text-xs tabular-nums" />
                  </div>
                  {(() => { const sale = r.saleAmount ?? r.amount; const profit = sale - r.amount; return (
                    <p className="text-[11px] text-muted-foreground">Cost <b className="text-foreground">{formatCurrency(r.amount)}</b> · Other Sale <b className="text-primary">{formatCurrency(sale)}</b> · Profit <b className={profit >= 0 ? "text-success" : "text-destructive"}>{formatCurrency(profit)}</b></p>
                  ); })()}
                </div>
              )}
              {r.target === "head" && kind === "purchase" && (
                <label className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <input type="checkbox" checked={!!r.billClient} onChange={(e) => patch(r.id, { billClient: e.target.checked })} />
                  Also bill this share to the client (adds a linked “Shared cost” charge)
                </label>
              )}
              {warning && <p className="mt-1 text-[10px] text-warning">{warning}</p>}
            </div>
          );
        })}
        {rows.length === 0 && <p className="rounded-lg border border-dashed border-border py-4 text-center text-[11px] text-muted-foreground">No lines yet — add a head, an agent{kind === "payment" ? ", a group" : " or office"} below.</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1 text-[11px]" onClick={() => add("head")}><Plus className="h-3 w-3" /> Add head</Button>
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1 text-[11px]" onClick={() => add("agent")}><Plus className="h-3 w-3" /> Add agent</Button>
        {kind === "payment" && <Button type="button" size="sm" variant="outline" className="h-8 gap-1 text-[11px]" onClick={() => add("group")}><Plus className="h-3 w-3" /> Add group</Button>}
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1 text-[11px]" onClick={() => add(kind === "payment" ? "unallocated" : "office")}><Plus className="h-3 w-3" /> {kind === "payment" ? "Unallocated" : "Office"}</Button>
        {!isEqual && rows.length > 0 && remaining !== 0 && (
          <Button type="button" size="sm" variant="ghost" className="ml-auto h-8 text-[11px] text-primary" onClick={() => onRows(autoBalanceLast(rows, t))}>Auto-balance last</Button>
        )}
      </div>

      {errors.length > 0 && (
        <ul className="space-y-0.5 text-[10px] text-destructive" role="alert">{errors.slice(0, 4).map((e) => <li key={e}>• {e}</li>)}</ul>
      )}
      <p className="text-[10px] text-muted-foreground">
        {kind === "purchase"
          ? "Head lines are posted as cost in that Head's Business View — the client's personal balance is not changed unless “Also bill this share” is ticked. Agent lines appear in the agent's Other Sale and receivable. The supplier always sees the full amount."
          : "Tags only decide whose business this payment belongs to. The supplier balance and cash / bank account always use the full payment amount."}
      </p>
    </div>
  );
}
