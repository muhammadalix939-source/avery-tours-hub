import { ArrowUpDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  STANDARD_SORT_OPTIONS,
  type SortOptionKey,
  type SortOption,
} from "@/lib/sort-utils";

interface SortBarProps {
  value: SortOptionKey;
  onChange: (value: SortOptionKey) => void;
  options?: SortOption[];
  className?: string;
  label?: string;
}

export default function SortBar({
  value,
  onChange,
  options = STANDARD_SORT_OPTIONS,
  className = "",
  label = "Sort by:",
}: SortBarProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {label && (
        <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap flex items-center gap-1">
          <ArrowUpDown className="h-3 w-3 text-muted-foreground/70" />
          {label}
        </span>
      )}
      <Select value={value} onValueChange={(v) => onChange(v as SortOptionKey)}>
        <SelectTrigger className="h-8 text-xs bg-background/50 border-border/60 hover:border-primary/50 transition-colors w-[180px]">
          <SelectValue placeholder="Select sorting..." />
        </SelectTrigger>
        <SelectContent align="end" className="border-border bg-card">
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
