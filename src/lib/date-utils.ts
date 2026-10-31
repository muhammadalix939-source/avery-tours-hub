// PKT (Pakistan Standard Time) UTC+5 helpers
export function getPKTDate(): string {
  return new Date().toLocaleString("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" });
}

export function getPKTDateTime(): string {
  return new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi", dateStyle: "medium", timeStyle: "short" });
}

export function getPKTISO(): string {
  const now = new Date();
  const pkt = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Karachi" }));
  return pkt.toISOString();
}
