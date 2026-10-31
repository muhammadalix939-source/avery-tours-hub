import { useState } from "react";
import { Check, Plus, Trash2, Pencil, RotateCcw, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ConfirmDelete from "@/components/ConfirmDelete";
import { CHECKLIST_STATUSES, checklistProgress, getChecklist, nextStatus, statusTone } from "@/lib/checklist";
import type { Client, ChecklistStatus } from "@/lib/data";
import { useStore } from "@/lib/store";

/** Service Checklist panel — full add / edit / delete per client with tick-through statuses. */
export default function ClientChecklistPanel({ client }: { client: Client }) {
  const store = useStore();
  const live = store.clients.find((c) => c.id === client.id) || client;
  const items = getChecklist(live);
  const progress = checklistProgress(live);

  const [newLabel, setNewLabel] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-border/60 bg-accent/10 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Service Checklist</p>
          <p className="text-[10px] text-muted-foreground">Tick each service as it is arranged — {progress.label} completed</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-muted-foreground">{progress.percent}%</span>
          <Button size="sm" variant="outline" className="h-7 gap-1 text-[10px]"
            onClick={() => store.setChecklistArchived(live.id, !live.checklistArchived)}>
            {live.checklistArchived ? <><RotateCcw className="h-3 w-3" /> Re-open</> : <><Archive className="h-3 w-3" /> Archive</>}
          </Button>
        </div>
      </div>

      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-accent/40">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress.percent}%` }} />
      </div>

      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2 rounded-lg bg-card/60 px-2.5 py-2">
            <button
              onClick={() => store.updateChecklistItem(live.id, item.id, { status: nextStatus(item.status) })}
              title="Click to change status"
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                item.status === "Completed" ? "border-success bg-success/20 text-success"
                  : item.status === "In Progress" ? "border-warning bg-warning/20 text-warning" : "border-border text-transparent"
              }`}
            >
              <Check className="h-3 w-3" />
            </button>

            {editId === item.id ? (
              <Input autoFocus value={editLabel} onChange={(e) => setEditLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { store.updateChecklistItem(live.id, item.id, { label: editLabel.trim() || item.label }); setEditId(null); } }}
                className="h-7 flex-1 border-border bg-accent/20 text-xs" />
            ) : (
              <span className={`flex-1 text-xs ${item.status === "Completed" ? "text-muted-foreground line-through" : ""}`}>{item.label}</span>
            )}

            <select
              value={item.status}
              onChange={(e) => store.updateChecklistItem(live.id, item.id, { status: e.target.value as ChecklistStatus })}
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold outline-none ${statusTone[item.status]}`}
            >
              {CHECKLIST_STATUSES.map((s) => <option key={s} value={s} className="bg-card text-foreground">{s}</option>)}
            </select>

            {editId === item.id ? (
              <button onClick={() => { store.updateChecklistItem(live.id, item.id, { label: editLabel.trim() || item.label }); setEditId(null); }}
                className="rounded p-1 hover:bg-accent"><Check className="h-3.5 w-3.5 text-success" /></button>
            ) : (
              <button onClick={() => { setEditId(item.id); setEditLabel(item.label); }} className="rounded p-1 hover:bg-accent">
                <Pencil className="h-3.5 w-3.5 text-warning" />
              </button>
            )}
            <button onClick={() => setDeleteId(item.id)} className="rounded p-1 hover:bg-accent">
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </button>
          </div>
        ))}
        {items.length === 0 && <p className="py-3 text-center text-[11px] text-muted-foreground">No checklist items — add the services this client needs.</p>}
      </div>

      <div className="mt-3 flex gap-2">
        <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Add custom item (e.g. Zam Zam, Laundry, Ihram Kit)"
          onKeyDown={(e) => { if (e.key === "Enter" && newLabel.trim()) { store.addChecklistItem(live.id, newLabel); setNewLabel(""); } }}
          className="h-8 border-border bg-accent/20 text-xs" />
        <Button size="sm" className="h-8 gap-1 text-xs" disabled={!newLabel.trim()}
          onClick={() => { store.addChecklistItem(live.id, newLabel); setNewLabel(""); }}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>

      <ConfirmDelete
        open={!!deleteId}
        onOpenChange={(o) => { if (!o) setDeleteId(null); }}
        title="Delete checklist item?"
        description="This service item will be removed from this client's checklist."
        onConfirm={() => { if (deleteId) store.deleteChecklistItem(live.id, deleteId); setDeleteId(null); }}
      />
    </div>
  );
}
