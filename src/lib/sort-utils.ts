export type SortOptionKey =
  | "date_desc"
  | "date_asc"
  | "amount_desc"
  | "amount_asc"
  | "name_asc"
  | "name_desc";

export interface SortOption {
  value: SortOptionKey;
  label: string;
  category: "date" | "amount" | "alpha";
}

export const STANDARD_SORT_OPTIONS: SortOption[] = [
  { value: "date_desc", label: "Date: Newest First", category: "date" },
  { value: "date_asc", label: "Date: Oldest First", category: "date" },
  { value: "amount_desc", label: "Amount: Highest First", category: "amount" },
  { value: "amount_asc", label: "Amount: Lowest First", category: "amount" },
  { value: "name_asc", label: "Name / ID: A → Z", category: "alpha" },
  { value: "name_desc", label: "Name / ID: Z → A", category: "alpha" },
];

export interface SortAccessors<T> {
  date?: (item: T) => string | undefined;
  amount?: (item: T) => number | undefined;
  name?: (item: T) => string | undefined;
}

/**
 * Universal stable multi-criteria sorting function
 */
export function sortEntities<T>(
  items: T[],
  sortKey: SortOptionKey,
  accessors: SortAccessors<T>
): T[] {
  return [...items].sort((a, b) => {
    switch (sortKey) {
      case "date_desc": {
        const da = accessors.date ? accessors.date(a) || "" : "";
        const db = accessors.date ? accessors.date(b) || "" : "";
        return db.localeCompare(da);
      }
      case "date_asc": {
        const da = accessors.date ? accessors.date(a) || "" : "";
        const db = accessors.date ? accessors.date(b) || "" : "";
        return da.localeCompare(db);
      }
      case "amount_desc": {
        const amtA = accessors.amount ? Number(accessors.amount(a)) || 0 : 0;
        const amtB = accessors.amount ? Number(accessors.amount(b)) || 0 : 0;
        return amtB - amtA;
      }
      case "amount_asc": {
        const amtA = accessors.amount ? Number(accessors.amount(a)) || 0 : 0;
        const amtB = accessors.amount ? Number(accessors.amount(b)) || 0 : 0;
        return amtA - amtB;
      }
      case "name_asc": {
        const na = accessors.name ? (accessors.name(a) || "").toLowerCase() : "";
        const nb = accessors.name ? (accessors.name(b) || "").toLowerCase() : "";
        return na.localeCompare(nb);
      }
      case "name_desc": {
        const na = accessors.name ? (accessors.name(a) || "").toLowerCase() : "";
        const nb = accessors.name ? (accessors.name(b) || "").toLowerCase() : "";
        return nb.localeCompare(na);
      }
      default:
        return 0;
    }
  });
}
