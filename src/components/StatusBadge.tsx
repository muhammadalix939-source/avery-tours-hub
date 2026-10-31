interface StatusBadgeProps {
  status: string;
}

const statusStyles: Record<string, string> = {
  Paid: "bg-success/15 text-success border-success/20",
  Confirmed: "bg-success/15 text-success border-success/20",
  Active: "bg-success/15 text-success border-success/20",
  Partial: "bg-warning/15 text-warning border-warning/20",
  Pending: "bg-warning/15 text-warning border-warning/20",
  Unpaid: "bg-destructive/15 text-destructive border-destructive/20",
  Cancelled: "bg-destructive/15 text-destructive border-destructive/20",
  Inactive: "bg-muted text-muted-foreground border-border",
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const style = statusStyles[status] || "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${style}`}>
      {status}
    </span>
  );
}
