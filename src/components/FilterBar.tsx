import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface FilterPill {
  key: string;
  label: string;
  kind: "date" | "select" | "text";
  value: string;
  options?: { value: string; label: string }[];
  onChange: (v: string) => void;
}

/** Shared filter bar — ivory rail, pill controls, gold underline when a filter is active. */
export default function FilterBar({ filters, onClear }: { filters: FilterPill[]; onClear: () => void }) {
  const anyActive = filters.some((f) => f.value && f.value !== "all");
  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-border/60 bg-accent/10 px-4 py-4">
      {filters.map((f) => {
        const active = !!f.value && f.value !== "all";
        const base = `h-8 rounded-md border-border bg-background/60 text-xs ${active ? "border-b-2 border-b-primary" : ""}`;
        return (
          <div key={f.key} className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{f.label}</p>
            {f.kind === "select" ? (
              <Select value={f.value || "all"} onValueChange={f.onChange}>
                <SelectTrigger className={`${base} min-w-[150px]`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(f.options || []).map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input
                type={f.kind === "date" ? "date" : "text"}
                value={f.value}
                placeholder={f.kind === "text" ? "Search…" : undefined}
                onChange={(e) => f.onChange(e.target.value)}
                className={`${base} min-w-[150px]`}
              />
            )}
          </div>
        );
      })}
      {anyActive && (
        <button type="button" onClick={onClear} className="pb-1 text-xs text-muted-foreground underline-offset-4 hover:underline hover:text-foreground">
          Clear filters
        </button>
      )}
    </div>
  );
}

/** In / Out direction pill — same badge language as Matched / Unmatched. */
export function DirectionBadge({ direction }: { direction: "in" | "out" }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${direction === "in" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
      {direction}
    </span>
  );
}
