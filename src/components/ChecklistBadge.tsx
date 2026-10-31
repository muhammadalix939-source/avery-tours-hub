import { checklistProgress } from "@/lib/checklist";
import type { Client } from "@/lib/data";

/** Compact "3/5 Complete" progress pill shown wherever a client is listed. */
export default function ChecklistBadge({ client, compact = false }: { client: Client; compact?: boolean }) {
  const p = checklistProgress(client);
  const tone = p.isComplete
    ? "border-success/30 bg-success/10 text-success"
    : p.completed === 0
      ? "border-border bg-muted/40 text-muted-foreground"
      : "border-warning/30 bg-warning/10 text-warning";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tone}`} title={`Service checklist: ${p.completed} of ${p.total} completed`}>
      <span className="tracking-wide">{p.label}</span>
      {!compact && <span className="font-medium opacity-80">{p.isComplete ? "Complete" : "Complete"}</span>}
    </span>
  );
}
