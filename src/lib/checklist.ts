// Client package-completion checklist helpers.
// Items are stored on the client record (store-managed, fully editable per client).
import type { Client, ChecklistItem, ChecklistStatus } from "./data";

export const CHECKLIST_STATUSES: ChecklistStatus[] = ["Pending", "In Progress", "Completed"];

/** Default service items every package client starts with (agent can add/edit/delete). */
export const DEFAULT_CHECKLIST_LABELS = ["Transport", "Ziyarat", "Hotel", "Visa"] as const;

export function defaultChecklist(): ChecklistItem[] {
  return DEFAULT_CHECKLIST_LABELS.map((label, i) => ({
    id: `chk-${i + 1}-${label.toLowerCase()}`,
    label,
    status: "Pending" as ChecklistStatus,
  }));
}

/** Never returns undefined — clients without a stored checklist fall back to defaults. */
export function getChecklist(c: Client): ChecklistItem[] {
  return c.checklist && c.checklist.length ? c.checklist : defaultChecklist();
}

export interface ChecklistProgress {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  percent: number;
  isComplete: boolean;
  label: string; // e.g. "3/5"
}

export function checklistProgress(c: Client): ChecklistProgress {
  const items = getChecklist(c);
  const completed = items.filter((i) => i.status === "Completed").length;
  const inProgress = items.filter((i) => i.status === "In Progress").length;
  const total = items.length;
  return {
    total, completed, inProgress,
    pending: total - completed - inProgress,
    percent: total ? Math.round((completed / total) * 100) : 0,
    isComplete: total > 0 && completed === total,
    label: `${completed}/${total}`,
  };
}

/** Cycle a status on tick: Pending → In Progress → Completed → Pending */
export function nextStatus(s: ChecklistStatus): ChecklistStatus {
  return s === "Pending" ? "In Progress" : s === "In Progress" ? "Completed" : "Pending";
}

export const statusTone: Record<ChecklistStatus, string> = {
  Pending: "text-muted-foreground border-border bg-muted/40",
  "In Progress": "text-warning border-warning/30 bg-warning/10",
  Completed: "text-success border-success/30 bg-success/10",
};

/** Clients whose checklist is incomplete and not archived → active alerts. */
export function activeChecklistAlerts(clients: Client[]): Client[] {
  return clients.filter((c) => !c.checklistArchived && !checklistProgress(c).isComplete);
}

/** Completed or manually archived clients → archive view. */
export function completedChecklistAlerts(clients: Client[]): Client[] {
  return clients.filter((c) => c.checklistArchived || checklistProgress(c).isComplete);
}
