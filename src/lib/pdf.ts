import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency, getClientName } from "./data";
import type {
  Client, Agent, Supplier, Booking,
  HotelService, FlightService, TransportService, VisaService, OtherService,
} from "./data";
import type { LedgerEntry } from "./store";
import { AVERY_LOGO_JPEG } from "@/assets/avery-logo";

// =========================================================================
//  AVERY INTERNATIONAL TRAVEL & TOURS — High-End Luxury Executive PDF Template
//  Ivory parchment + Royal Navy + Antique Gold. Serif headings. Logo top-left.
// =========================================================================

const COMPANY = "AVERY INTERNATIONAL TRAVEL & TOURS";
const SLOGAN = "Umrah · Hajj · Ziyarah · International & Domestic Tours · Visas · Transport";
const TAGLINE = "Curated journeys. Trusted service. Worldwide reach.";
const COMPANY_ADDR = "IBM Center, Paper Market, Office 204, Karachi, Pakistan";
const COMPANY_PHONE = "0330-2793701  ·  0310-2326386  ·  0322-3241659";
const COMPANY_EMAIL = "averyinternationaltraveltours@gmail.com";

// Premium palette
const NAVY: [number, number, number]   = [11, 24, 56];
const GOLD: [number, number, number]   = [176, 137, 52];   // antique gold
const GOLD_LT: [number, number, number]= [212, 178, 102];
const IVORY: [number, number, number]  = [252, 249, 241];  // parchment
const ROW_ALT: [number, number, number]= [247, 243, 232];
const INK: [number, number, number]    = [22, 28, 44];
const MUTED: [number, number, number]  = [110, 110, 120];
const WHITE: [number, number, number]  = [255, 255, 255];
const SUCCESS: [number, number, number]= [22, 110, 60];
const DANGER: [number, number, number] = [170, 35, 35];

// ---------- Brand Fonts Loader (Libre Baskerville + IBM Plex Sans) ----------
interface FontCacheItem {
  b64: string;
  name: string;
  style: string;
}
let fontCache: Record<string, FontCacheItem> | null = null;
let fontLoadPromise: Promise<void> | null = null;

export async function loadPdfFonts(doc: jsPDF): Promise<void> {
  if (typeof window === "undefined") return;
  if (!fontCache) {
    if (!fontLoadPromise) {
      fontLoadPromise = (async () => {
        try {
          const files = [
            { file: "LibreBaskerville-Regular.ttf", name: "LibreBaskerville", style: "normal", url: "/fonts/LibreBaskerville-Regular.ttf" },
            { file: "LibreBaskerville-Bold.ttf", name: "LibreBaskerville", style: "bold", url: "/fonts/LibreBaskerville-Bold.ttf" },
            { file: "IBMPlexSans-Regular.ttf", name: "IBMPlexSans", style: "normal", url: "/fonts/IBMPlexSans-Regular.ttf" },
            { file: "IBMPlexSans-Bold.ttf", name: "IBMPlexSans", style: "bold", url: "/fonts/IBMPlexSans-Bold.ttf" },
          ];
          const results = await Promise.all(
            files.map(async (f) => {
              const res = await fetch(f.url);
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const buf = await res.arrayBuffer();
              const bytes = new Uint8Array(buf);
              let binary = "";
              const chunkSize = 0x8000;
              for (let i = 0; i < bytes.length; i += chunkSize) {
                binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
              }
              return { file: f.file, b64: btoa(binary), name: f.name, style: f.style };
            })
          );
          fontCache = {};
          for (const r of results) {
            fontCache[r.file] = { b64: r.b64, name: r.name, style: r.style };
          }
        } catch (e) {
          console.warn("Could not load custom brand fonts for PDF, using system fallbacks:", e);
        }
      })();
    }
    await fontLoadPromise;
  }

  if (fontCache) {
    for (const [file, info] of Object.entries(fontCache)) {
      try {
        doc.addFileToVFS(file, info.b64);
        doc.addFont(file, info.name, info.style);
      } catch {}
    }
  }
}

if (typeof window !== "undefined") {
  const dummy = new jsPDF();
  loadPdfFonts(dummy).catch(() => {});
}

function hasFont(doc: jsPDF, name: string): boolean {
  try {
    const list = doc.getFontList() as Record<string, any>;
    return Boolean(list && list[name]);
  } catch {
    return false;
  }
}

function setSerif(doc: jsPDF, style: "normal" | "bold" | "italic" = "bold") {
  if (hasFont(doc, "LibreBaskerville")) {
    doc.setFont("LibreBaskerville", style === "italic" ? "normal" : style);
  } else {
    doc.setFont("times", style);
  }
}

function setSans(doc: jsPDF, style: "normal" | "bold" | "italic" = "normal") {
  if (hasFont(doc, "IBMPlexSans")) {
    doc.setFont("IBMPlexSans", style === "italic" ? "normal" : style);
  } else {
    doc.setFont("helvetica", style);
  }
}

// ---------- Page chrome ----------
// ---------- Pagination safety ----------
const PAGE_TOP = 24;      // content start on continuation pages
const PAGE_BOTTOM = 266;  // last usable y before the footer rule (273)
const framed = new WeakMap<jsPDF, Set<number>>();
function markFramed(doc: jsPDF) {
  const set = framed.get(doc) || new Set<number>();
  set.add(doc.getCurrentPageInfo().pageNumber);
  framed.set(doc, set);
}
/** Ivory background + gold double border + slim navy strip for continuation pages. */
function pageFrame(doc: jsPDF) {
  const n = doc.getCurrentPageInfo().pageNumber;
  if (framed.get(doc)?.has(n)) return;
  doc.setFillColor(...IVORY);
  doc.rect(0, 0, 210, 297, "F");
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.8);
  doc.rect(8, 8, 194, 281);
  doc.setLineWidth(0.2);
  doc.rect(10, 10, 190, 277);
  doc.setFillColor(...NAVY);
  doc.rect(10, 10, 190, 8, "F");
  doc.setFillColor(...GOLD);
  doc.rect(10, 18, 190, 0.5, "F");
  setSerif(doc, "bold");
  doc.setFontSize(8);
  doc.setTextColor(...GOLD_LT);
  doc.text(COMPANY, 14, 15.4);
  setSans(doc, "normal");
  doc.setFontSize(7);
  doc.text("Statement (continued)", 196, 15.4, { align: "right" });
  doc.setTextColor(...INK);
  markFramed(doc);
}
/** Start a new framed page when the next block (height `need`) would cross the footer. */
function ensureSpace(doc: jsPDF, y: number, need: number): number {
  if (y + need <= PAGE_BOTTOM) return y;
  doc.addPage();
  pageFrame(doc);
  return PAGE_TOP;
}

function header(doc: jsPDF, title: string) {
  markFramed(doc);
  // Ivory page background
  doc.setFillColor(...IVORY);
  doc.rect(0, 0, 210, 297, "F");

  // Outer luxury double border
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.8);
  doc.rect(8, 8, 194, 281);
  doc.setLineWidth(0.2);
  doc.rect(10, 10, 190, 277);

  // Navy header band
  doc.setFillColor(...NAVY);
  doc.rect(10, 10, 190, 26, "F");
  // Gold pinstripe under header
  doc.setFillColor(...GOLD);
  doc.rect(10, 36, 190, 0.8, "F");

  // Logo (top-left, inside the navy band)
  try {
    doc.addImage(AVERY_LOGO_JPEG, "JPEG", 13, 12, 22, 22, undefined, "FAST");
  } catch {
    // fall-through: no logo
  }

  // Wordmark
  doc.setTextColor(...GOLD_LT);
  setSerif(doc, "bold");
  doc.setFontSize(14);
  doc.text(COMPANY, 38, 21.5);

  setSerif(doc, "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(...WHITE);
  doc.text(SLOGAN, 38, 27.5);
  doc.setFontSize(6.5);
  doc.setTextColor(...GOLD_LT);
  doc.text(TAGLINE, 38, 32);

  // Document title (right)
  setSerif(doc, "bold");
  doc.setFontSize(10);
  doc.setTextColor(...WHITE);
  doc.text(title.toUpperCase(), 196, 22, { align: "right" });
  setSans(doc, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...GOLD_LT);
  const now = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  doc.text(`Issued: ${now}`, 196, 28, { align: "right" });

  doc.setTextColor(...INK);
}

function footer(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    // Gold pinstripe above footer
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.4);
    doc.line(14, 273, 196, 273);
    doc.setLineWidth(0.15);
    doc.line(14, 274.4, 196, 274.4);

    setSerif(doc, "bold");
    doc.setFontSize(8);
    doc.setTextColor(...NAVY);
    doc.text(COMPANY, 14, 279);
    setSans(doc, "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(COMPANY_ADDR, 14, 283);
    doc.text(`${COMPANY_PHONE}   ·   ${COMPANY_EMAIL}`, 14, 287);

    setSerif(doc, "italic");
    doc.setTextColor(...GOLD);
    doc.setFontSize(7.5);
    doc.text("Your journey begins with trust.", 196, 283, { align: "right" });
    setSans(doc, "normal");
    doc.setTextColor(...MUTED);
    doc.setFontSize(7);
    doc.text(`Page ${i} of ${pages}`, 196, 287, { align: "right" });
  }
}

// ---------- Section helpers ----------
function sectionTitle(doc: jsPDF, text: string, y: number) {
  if (y > PAGE_BOTTOM - 30) { doc.addPage(); pageFrame(doc); y = PAGE_TOP + 4; }
  setSerif(doc, "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text(text.toUpperCase(), 14, y);

  // Gold rule under heading
  const w = doc.getTextWidth(text.toUpperCase());
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(14, y + 1.5, 14 + Math.max(w, 30), y + 1.5);
  doc.setLineWidth(0.15);
  doc.line(14, y + 2.4, 196, y + 2.4);

  doc.setTextColor(...INK);
  return y;
}

function brandTable(doc: jsPDF, opts: Parameters<typeof autoTable>[1]) {
  const o: any = opts || {};
  // Never start a table in the last few mm of a page — prevents heading/table splits
  if (typeof o.startY === "number" && o.startY > PAGE_BOTTOM - 20) o.startY = ensureSpace(doc, o.startY, 40);
  const sansFont = hasFont(doc, "IBMPlexSans") ? "IBMPlexSans" : "helvetica";
  autoTable(doc, {
    showHead: "everyPage",
    showFoot: "lastPage",
    rowPageBreak: "avoid",
    willDrawPage: () => pageFrame(doc),
    theme: "grid",
    headStyles: { fillColor: NAVY, textColor: WHITE, fontSize: 8.5, fontStyle: "bold", font: sansFont, halign: "left", cellPadding: 2.5, overflow: "linebreak", valign: "middle" },
    bodyStyles: { fontSize: 8.5, textColor: INK, cellPadding: 2.5, font: sansFont, overflow: "linebreak", valign: "top" },
    alternateRowStyles: { fillColor: ROW_ALT },
    styles: { lineColor: GOLD_LT, lineWidth: 0.15, overflow: "linebreak", cellWidth: "auto", font: sansFont },
    tableWidth: "auto",
    ...o,
    margin: { left: 14, right: 14, top: PAGE_TOP, bottom: 297 - PAGE_BOTTOM },
  });
}

function partyBlock(doc: jsPDF, x: number, y: number, w: number, label: string, lines: Array<[string, string]>) {
  // Box with gold left bar + ivory fill
  doc.setFillColor(...IVORY);
  doc.rect(x, y, w, 6 + lines.length * 5 + 4, "F");
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.rect(x, y, w, 6 + lines.length * 5 + 4);
  doc.setFillColor(...GOLD);
  doc.rect(x, y, 1.2, 6 + lines.length * 5 + 4, "F");

  setSerif(doc, "bold");
  doc.setFontSize(8);
  doc.setTextColor(...GOLD);
  doc.text(label.toUpperCase(), x + 4, y + 4.5);

  setSans(doc, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  lines.forEach(([k, v], i) => {
    setSans(doc, "bold");
    doc.text(`${k}:`, x + 4, y + 10 + i * 5);
    setSans(doc, "normal");
    doc.text(String(v || "—"), x + 28, y + 10 + i * 5);
  });
  return y + 6 + lines.length * 5 + 6;
}

function fromAndTo(doc: jsPDF, y: number, recipientLabel: string, recipientLines: Array<[string, string]>) {
  const fromLines: Array<[string, string]> = [
    ["Company", "Avery Group of Travel"],
    ["Address", "IBM Center, Office 204, Karachi"],
    ["Phone", "0330-2793701, 0310-2326386"],
    ["Email", "averyinternationaltraveltours@gmail.com"],
  ];
  const yA = partyBlock(doc, 14, y, 88, "From", fromLines);
  const yB = partyBlock(doc, 108, y, 88, recipientLabel, recipientLines);
  return Math.max(yA, yB);
}

function totalsBand(doc: jsPDF, y: number, label: string, value: string, tone: "gold" | "navy" = "gold") {
  y = ensureSpace(doc, y, 13);
  if (tone === "gold") doc.setFillColor(...GOLD);
  else doc.setFillColor(...NAVY);
  doc.rect(14, y, 182, 11, "F");
  doc.setTextColor(...WHITE);
  setSerif(doc, "bold");
  doc.setFontSize(11);
  doc.text(label.toUpperCase(), 18, y + 7.4);
  doc.text(value, 192, y + 7.4, { align: "right" });
  doc.setTextColor(...INK);
  return y + 14;
}

function summaryCards(doc: jsPDF, y: number, cards: Array<[string, string, "ink" | "success" | "danger" | "gold"]>) {
  y = ensureSpace(doc, y, 22);
  const n = cards.length;
  const totalW = 182;
  const gap = 2;
  const cardW = (totalW - gap * (n - 1)) / n;
  cards.forEach(([label, value, tone], i) => {
    const x = 14 + i * (cardW + gap);
    // navy header
    doc.setFillColor(...NAVY);
    doc.rect(x, y, cardW, 5, "F");
    // ivory body
    doc.setFillColor(...WHITE);
    doc.rect(x, y + 5, cardW, 14, "F");
    doc.setDrawColor(...GOLD_LT);
    doc.setLineWidth(0.2);
    doc.rect(x, y, cardW, 19);

    setSans(doc, "bold");
    doc.setFontSize(7);
    doc.setTextColor(...WHITE);
    doc.text(label.toUpperCase(), x + 3, y + 3.5);

    setSerif(doc, "bold");
    doc.setFontSize(11);
    if (tone === "success") doc.setTextColor(...SUCCESS);
    else if (tone === "danger") doc.setTextColor(...DANGER);
    else if (tone === "gold") doc.setTextColor(...GOLD);
    else doc.setTextColor(...NAVY);
    doc.text(value, x + 3, y + 13.5);
  });
  doc.setTextColor(...INK);
  return y + 23;
}

function save(doc: jsPDF, name: string) {
  doc.save(name.replace(/\s+/g, "_"));
}

function fmtDate(s?: string): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function labelType(t: LedgerEntry["type"]): string {
  switch (t) {
    case "client_receive": return "Receive";
    case "supplier_payment": return "Supplier Pmt";
    case "agent_commission": return "Commission";
    case "expense": return "Expense";
    case "purchase": return "Purchase";
    case "client_charge": return "Extra Charge";
    case "client_refund": return "Client Refund";
    case "supplier_refund": return "Supplier Refund";
    default: return t;
  }
}

// =========================================================================
//  STATEMENT — Supplier / Agent (with optional date filter & service sections)
// =========================================================================

export interface StatementOptions {
  /** Filter entries by date range (inclusive). YYYY-MM-DD */
  fromDate?: string;
  toDate?: string;
  /** Bookings used to render Hotel/Flight/Visa/Transport/Other sections. */
  bookings?: Booking[];
  /** Include opening balance (brought-forward) in totals & opening row. Default true. */
  includeOpening?: boolean;
  /** Optional purchase-group filter (only entries with matching groupId are included). */
  groupId?: string;
  /** Human-readable group label for the header banner when groupId is set. */
  groupLabel?: string;
}

function inRange(date: string, from?: string, to?: string) {
  if (!from && !to) return true;
  const d = new Date(date).getTime();
  if (from && d < new Date(from).getTime()) return false;
  if (to && d > new Date(to + "T23:59:59").getTime()) return false;
  return true;
}

function renderServiceSections(doc: jsPDF, y: number, bookings: Booking[]): number {
  const allHotels: Array<HotelService & { headId: string }> = [];
  const allFlights: Array<FlightService & { headId: string }> = [];
  const allTransports: Array<TransportService & { headId: string }> = [];
  const allVisas: Array<VisaService & { headId: string }> = [];
  const allOthers: Array<OtherService & { headId: string }> = [];
  bookings.forEach((b) => {
    (b.hotels || []).forEach((h) => allHotels.push({ ...h, headId: b.headId }));
    (b.flights || []).forEach((f) => allFlights.push({ ...f, headId: b.headId }));
    (b.transports || []).forEach((t) => allTransports.push({ ...t, headId: b.headId }));
    (b.visas || []).forEach((v) => allVisas.push({ ...v, headId: b.headId }));
    (b.others || []).forEach((o) => allOthers.push({ ...o, headId: b.headId }));
  });

  if (allHotels.length) {
    y = sectionTitle(doc, `Hotels (${allHotels.length})`, y); y += 4;
    brandTable(doc, {
      startY: y + 1,
      head: [["Booking", "City", "Hotel", "Room", "Check-In", "Check-Out", "Nights"]],
      body: allHotels.map((h) => [h.headId, h.city, h.hotelName, h.roomType, fmtDate(h.checkIn), fmtDate(h.checkOut), String(h.nights)]),
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  if (allFlights.length) {
    y = sectionTitle(doc, `Flights (${allFlights.length})`, y); y += 4;
    brandTable(doc, {
      startY: y + 1,
      head: [["Booking", "Date", "Flight", "From", "To", "Dep", "Arr"]],
      body: allFlights.map((f) => [f.headId, fmtDate(f.date), f.flightNo, f.from, f.to, f.departure, f.arrival]),
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  if (allVisas.length) {
    const total = allVisas.reduce((s, v) => s + (v.amount || 0), 0);
    y = sectionTitle(doc, `Visas (${allVisas.length})`, y); y += 4;
    brandTable(doc, {
      startY: y + 1,
      head: [["Booking", "Type", "Country", "Reference", "Issue Date", "Amount"]],
      body: allVisas.map((v) => [v.headId, v.visaType, v.country, v.reference, fmtDate(v.issueDate), { content: formatCurrency(v.amount || 0), styles: { halign: "right" as const } }]),
      foot: [[{ content: "Total Visa Amount", colSpan: 5, styles: { halign: "right" as const, fontStyle: "bold" as const, fillColor: ROW_ALT, textColor: NAVY } }, { content: formatCurrency(total), styles: { halign: "right" as const, fontStyle: "bold" as const, fillColor: ROW_ALT, textColor: NAVY } }]],
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  if (allTransports.length) {
    const total = allTransports.reduce((s, t) => s + (t.amount || 0), 0);
    y = sectionTitle(doc, `Transport (${allTransports.length})`, y); y += 4;
    brandTable(doc, {
      startY: y + 1,
      head: [["Booking", "Service", "Route", "Vehicle", "Date", "Amount"]],
      body: allTransports.map((t) => [t.headId, t.service, t.route, t.vehicle, fmtDate(t.date), { content: formatCurrency(t.amount || 0), styles: { halign: "right" as const } }]),
      foot: total ? [[{ content: "Total Transport", colSpan: 5, styles: { halign: "right" as const, fontStyle: "bold" as const, fillColor: ROW_ALT, textColor: NAVY } }, { content: formatCurrency(total), styles: { halign: "right" as const, fontStyle: "bold" as const, fillColor: ROW_ALT, textColor: NAVY } }]] : undefined,
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  if (allOthers.length) {
    const total = allOthers.reduce((s, o) => s + (o.amount || 0), 0);
    y = sectionTitle(doc, `Other Services (${allOthers.length})`, y); y += 4;
    brandTable(doc, {
      startY: y + 1,
      head: [["Booking", "Category", "Description", "Date", "Amount"]],
      body: allOthers.map((o) => [o.headId, o.category, o.description, fmtDate(o.date), { content: formatCurrency(o.amount || 0), styles: { halign: "right" as const } }]),
      foot: total ? [[{ content: "Total Other", colSpan: 4, styles: { halign: "right" as const, fontStyle: "bold" as const, fillColor: ROW_ALT, textColor: NAVY } }, { content: formatCurrency(total), styles: { halign: "right" as const, fontStyle: "bold" as const, fillColor: ROW_ALT, textColor: NAVY } }]] : undefined,
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  return y;
}

// =========================================================================
//  SUPPLIER LEDGER / STATEMENT
// =========================================================================
// =========================================================================
//  SUPPLIER LEDGER / STATEMENT
// =========================================================================
export async function generateSupplierLedger(supplier: Supplier, entries: LedgerEntry[], opts: StatementOptions = {}) {
  const doc = new jsPDF();
  await loadPdfFonts(doc);
  supplierHeader(doc);

  const filtered = entries
    .filter((e) => inRange(e.date, opts.fromDate, opts.toDate))
    .filter((e) => !opts.groupId || e.groupId === opts.groupId);
  const periodLabel = opts.fromDate || opts.toDate
    ? `${fmtDate(opts.fromDate)} — ${fmtDate(opts.toDate)}`
    : "All-time";

  const includeOpening = opts.includeOpening !== false && !opts.groupId;
  const openingPayable = includeOpening ? (supplier.openingPayable || 0) : 0;
  const openingPaid = includeOpening ? (supplier.openingPaid || 0) : 0;
  const openingBF = openingPayable - openingPaid;

  const purchases = filtered.filter((e) => e.type === "purchase");
  const payments = filtered.filter((e) => e.type === "supplier_payment");

  const totalPurchases = purchases.reduce((s, e) => s + e.amount, 0);
  const totalPaid = payments.reduce((s, e) => s + e.amount, 0);
  const grandPayable = openingPayable + totalPurchases;
  const grandPaid = openingPaid + totalPaid;
  const remaining = grandPayable - grandPaid;

  let y = 66;
  y = supplierMetaBar(doc, y, {
    stmtNo: `AV-SS-${supplier.id.replace(/[^0-9A-Z]/gi, "")}-${new Date().getFullYear()}`,
    period: periodLabel,
    groupLabel: opts.groupId ? (opts.groupLabel || opts.groupId) : undefined,
  });
  y = supplierIdentityCard(doc, y, supplier);
  const pctPaid = grandPayable > 0 ? Math.max(0, Math.min(100, (grandPaid / grandPayable) * 100)) : 0;
  y = executiveSnapshot(doc, y, {
    payable: grandPayable, paid: grandPaid, remaining,
    bf: includeOpening ? openingBF : undefined,
    purchases: purchases.length, payments: payments.length,
    pctPaid,
  });

  // Group purchases by serviceCategory
  const groups = new Map<string, LedgerEntry[]>();
  for (const p of purchases) {
    const key = p.serviceCategory || "Other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }
  const order = ["Flight", "Hotel", "Visa", "Transport", "Ziyarah", "Insurance", "Other"];
  const sortedKeys = [
    ...order.filter((k) => groups.has(k)),
    ...Array.from(groups.keys()).filter((k) => !order.includes(k)),
  ];

  for (const key of sortedKeys) {
    const rows = groups.get(key)!;
    const catTotal = rows.reduce((s, e) => s + e.amount, 0);
    y = categoryHeading(doc, y, key, rows.length, catTotal, "navy");

    const { head, body } = buildPurchaseTable(key, rows);
    const colSpanForTotal = head[0].length - 1;
    brandTable(doc, {
      startY: y + 1,
      head,
      body,
      foot: [[
        { content: `Total ${key}`, colSpan: colSpanForTotal, styles: { halign: "right" as const, fontStyle: "bold" as const, fillColor: ROW_ALT, textColor: NAVY } },
        { content: formatCurrency(catTotal), styles: { halign: "right" as const, fontStyle: "bold" as const, fillColor: ROW_ALT, textColor: NAVY } },
      ]],
    });
    y = (doc as any).lastAutoTable.finalY + 7;
  }

  if (payments.length || (includeOpening && openingPaid > 0)) {
    y = categoryHeading(doc, y, "Payments Received", payments.length, grandPaid, "success");
    const body: any[] = [];
    if (includeOpening && openingPaid > 0) {
      body.push([
        { content: "Opening Paid (B/F)", colSpan: 3, styles: { fontStyle: "bold" as const, fillColor: ROW_ALT } },
        { content: formatCurrency(openingPaid), styles: { halign: "right" as const, fontStyle: "bold" as const, fillColor: ROW_ALT, textColor: NAVY } },
      ]);
    }
    for (const p of payments) {
      body.push([
        fmtDate(p.date), p.id, p.note || "—",
        { content: formatCurrency(p.amount), styles: { halign: "right" as const, textColor: SUCCESS } },
      ]);
    }
    brandTable(doc, {
      startY: y + 1,
      head: [["Date", "Receipt", "Note", "Amount"]],
      body,
      foot: [[
        { content: "Total Paid", colSpan: 3, styles: { halign: "right" as const, fontStyle: "bold" as const, fillColor: ROW_ALT, textColor: NAVY } },
        { content: formatCurrency(grandPaid), styles: { halign: "right" as const, fontStyle: "bold" as const, fillColor: ROW_ALT, textColor: SUCCESS } },
      ]],
    });
    y = (doc as any).lastAutoTable.finalY + 7;
  }

  y = reconciliationBlock(doc, y, {
    openingPayable: includeOpening ? openingPayable : undefined,
    openingPaid: includeOpening ? openingPaid : undefined,
    totalPurchases, totalPaid, grandPayable, grandPaid,
  });

  closingHero(doc, y, remaining);

  footer(doc);
  save(doc, `Avery_Supplier_Statement_${supplier.id}.pdf`);
}

// ---- High-End Luxury Executive Statement Chrome ----
function executiveHeader(doc: jsPDF, supertitle: string, subtitle: string) {
  markFramed(doc);
  // Ivory base
  doc.setFillColor(...IVORY);
  doc.rect(0, 0, 210, 297, "F");

  // Full-bleed navy cover band (taller, editorial)
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, 210, 54, "F");

  // Subtle gold hairlines top & bottom of cover
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(0, 3, 210, 3);
  doc.setLineWidth(0.25);
  doc.line(0, 51, 210, 51);
  doc.setLineWidth(0.6);
  doc.line(0, 53, 210, 53);

  // Logo circle (gold ring)
  try {
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.4);
    doc.circle(24, 27, 13);
    doc.addImage(AVERY_LOGO_JPEG, "JPEG", 13, 16, 22, 22, undefined, "FAST");
  } catch {}

  // Wordmark
  setSerif(doc, "bold");
  doc.setFontSize(18);
  doc.setTextColor(...GOLD_LT);
  doc.text("AVERY", 42, 23);
  setSerif(doc, "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...WHITE);
  doc.text("INTERNATIONAL TRAVEL & TOURS", 42, 29);
  setSans(doc, "normal");
  doc.setFontSize(7);
  doc.setTextColor(...GOLD_LT);
  doc.text("Umrah · Hajj · Ziyarah · International & Domestic Tours · Visas · Transport", 42, 35.5);
  setSerif(doc, "italic");
  doc.setFontSize(7);
  doc.setTextColor(...WHITE);
  doc.text("Curated journeys. Trusted service. Worldwide reach.", 42, 41);

  // Right side: document title, big serif
  setSerif(doc, "bold");
  doc.setFontSize(22);
  doc.setTextColor(...WHITE);
  doc.text(supertitle.toUpperCase(), 196, 24, { align: "right" });
  doc.setTextColor(...GOLD_LT);
  doc.text(subtitle.toUpperCase(), 196, 33, { align: "right" });
  setSans(doc, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...WHITE);
  const now = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  doc.text(`Issued ${now}`, 196, 40, { align: "right" });

  doc.setTextColor(...INK);
}

function supplierHeader(doc: jsPDF) {
  executiveHeader(doc, "SUPPLIER", "STATEMENT");
}

function supplierMetaBar(doc: jsPDF, y: number, meta: { stmtNo: string; period: string; groupLabel?: string }): number {
  const h = meta.groupLabel ? 13 : 9;
  doc.setFillColor(...IVORY);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.25);
  doc.rect(14, y, 182, h, "FD");
  // Left gold bar
  doc.setFillColor(...GOLD);
  doc.rect(14, y, 1.4, h, "F");

  setSans(doc, "bold");
  doc.setFontSize(7);
  doc.setTextColor(...GOLD);
  doc.text("STATEMENT NO.", 19, y + 4);
  doc.text("PERIOD", 92, y + 4);
  setSerif(doc, "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text(meta.stmtNo, 19, y + 8);
  doc.text(meta.period, 92, y + 8);

  setSans(doc, "bold");
  doc.setFontSize(7);
  doc.setTextColor(...GOLD);
  doc.text("CURRENCY", 168, y + 4);
  setSerif(doc, "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text("PKR", 168, y + 8);

  if (meta.groupLabel) {
    setSans(doc, "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(...GOLD);
    doc.text(`Filtered by Group  ·  ${meta.groupLabel}`, 19, y + 11.5);
  }
  doc.setTextColor(...INK);
  return y + h + 3;
}

function supplierIdentityCard(doc: jsPDF, y: number, s: Supplier): number {
  const h = 26;
  // Card
  doc.setFillColor(...WHITE);
  doc.setDrawColor(...GOLD_LT);
  doc.setLineWidth(0.2);
  doc.rect(14, y, 182, h, "FD");

  // Left navy plate
  doc.setFillColor(...NAVY);
  doc.rect(14, y, 62, h, "F");
  doc.setFillColor(...GOLD);
  doc.rect(14, y, 1.2, h, "F");

  setSans(doc, "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(...GOLD_LT);
  doc.text("STATEMENT ISSUED TO", 20, y + 5.5);

  setSerif(doc, "bold");
  doc.setFontSize(13);
  doc.setTextColor(...WHITE);
  doc.text(s.companyName || "—", 20, y + 12.5);

  setSans(doc, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...GOLD_LT);
  doc.text(s.id, 20, y + 17.5);
  doc.setTextColor(...WHITE);
  doc.text(s.serviceType || "—", 20, y + 22);

  // Right details grid
  const col1 = 82;
  const col2 = 140;
  const labelStyle = () => { setSans(doc, "bold"); doc.setFontSize(6.8); doc.setTextColor(...GOLD); };
  const valStyle = () => { setSans(doc, "normal"); doc.setFontSize(8.5); doc.setTextColor(...INK); };

  labelStyle(); doc.text("CONTACT PERSON", col1, y + 5.5);
  valStyle(); doc.text(s.contactPerson || "—", col1, y + 10);

  labelStyle(); doc.text("PHONE", col1, y + 15);
  valStyle(); doc.text(s.phone || "—", col1, y + 19.5);

  labelStyle(); doc.text("EMAIL", col2, y + 5.5);
  valStyle(); doc.text(s.email || "—", col2, y + 10);

  labelStyle(); doc.text("ACCOUNT STATUS", col2, y + 15);
  valStyle();
  const status = "Active";
  doc.text(status, col2, y + 19.5);

  doc.setTextColor(...INK);
  return y + h + 5;
}

function clientIdentityCard(doc: jsPDF, y: number, c: Client): number {
  const h = 26;
  // Card
  doc.setFillColor(...WHITE);
  doc.setDrawColor(...GOLD_LT);
  doc.setLineWidth(0.2);
  doc.rect(14, y, 182, h, "FD");

  // Left navy plate
  doc.setFillColor(...NAVY);
  doc.rect(14, y, 62, h, "F");
  doc.setFillColor(...GOLD);
  doc.rect(14, y, 1.2, h, "F");

  setSans(doc, "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(...GOLD_LT);
  doc.text("STATEMENT ISSUED TO", 20, y + 5.5);

  setSerif(doc, "bold");
  doc.setFontSize(13);
  doc.setTextColor(...WHITE);
  doc.text(getClientName(c) || "—", 20, y + 12.5);

  setSans(doc, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...GOLD_LT);
  doc.text(`Client ID: ${c.id}`, 20, y + 17.5);
  doc.setTextColor(...WHITE);
  doc.text(`Head ID: ${c.headId}`, 20, y + 22);

  // Right details grid
  const col1 = 82;
  const col2 = 140;
  const labelStyle = () => { setSans(doc, "bold"); doc.setFontSize(6.8); doc.setTextColor(...GOLD); };
  const valStyle = () => { setSans(doc, "normal"); doc.setFontSize(8.5); doc.setTextColor(...INK); };

  labelStyle(); doc.text("PACKAGE TYPE", col1, y + 5.5);
  valStyle(); doc.text(c.packageType || "Custom Package", col1, y + 10);

  labelStyle(); doc.text("PHONE NUMBER", col1, y + 15);
  valStyle(); doc.text(c.phone || "—", col1, y + 19.5);

  labelStyle(); doc.text("PASSPORT NUMBER", col2, y + 5.5);
  valStyle(); doc.text(c.passport || "—", col2, y + 10);

  labelStyle(); doc.text("PAYMENT STATUS", col2, y + 15);
  valStyle();
  doc.text(c.paymentStatus || "Active", col2, y + 19.5);

  doc.setTextColor(...INK);
  return y + h + 5;
}

function executiveSnapshot(
  doc: jsPDF, y: number,
  data: { payable: number; paid: number; remaining: number; bf?: number; purchases: number; payments: number; pctPaid: number }
): number {
  // Section title
  setSerif(doc, "italic");
  doc.setFontSize(9);
  doc.setTextColor(...GOLD);
  doc.text("Executive Snapshot", 14, y);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.line(14, y + 1.5, 60, y + 1.5);
  doc.setLineWidth(0.1);
  doc.setDrawColor(...GOLD_LT);
  doc.line(60, y + 1.5, 196, y + 1.5);

  y += 5;

  // 4 KPI tiles
  const tiles: Array<{ label: string; value: string; tone: "navy" | "gold" | "success" | "danger" }> = [
    { label: "Total Payable", value: formatCurrency(data.payable), tone: "navy" },
    { label: "Total Paid", value: formatCurrency(data.paid), tone: "success" },
    { label: "Outstanding", value: formatCurrency(data.remaining), tone: data.remaining > 0 ? "danger" : "success" },
    { label: data.bf !== undefined ? "Brought Forward" : "Transactions", value: data.bf !== undefined ? formatCurrency(data.bf) : `${data.purchases} PUR · ${data.payments} PMT`, tone: "gold" },
  ];
  const totalW = 182;
  const gap = 3;
  const w = (totalW - gap * 3) / 4;
  const h = 22;
  tiles.forEach((t, i) => {
    const x = 14 + i * (w + gap);
    // ivory card
    doc.setFillColor(...WHITE);
    doc.setDrawColor(...GOLD_LT);
    doc.setLineWidth(0.2);
    doc.rect(x, y, w, h, "FD");
    // top gold hairline
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.6);
    doc.line(x, y, x + w, y);

    setSans(doc, "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(...MUTED);
    doc.text(t.label.toUpperCase(), x + 3.5, y + 5.5);

    setSerif(doc, "bold");
    doc.setFontSize(t.value.length > 14 ? 10 : 12);
    if (t.tone === "navy") doc.setTextColor(...NAVY);
    else if (t.tone === "success") doc.setTextColor(...SUCCESS);
    else if (t.tone === "danger") doc.setTextColor(...DANGER);
    else doc.setTextColor(...GOLD);
    doc.text(t.value, x + 3.5, y + 15);
  });
  y += h + 4;

  // Settlement progress bar
  setSans(doc, "bold");
  doc.setFontSize(7);
  doc.setTextColor(...NAVY);
  doc.text("SETTLEMENT PROGRESS", 14, y);
  setSans(doc, "normal");
  doc.setTextColor(...MUTED);
  doc.text(`${data.pctPaid.toFixed(1)}% of payable settled`, 196, y, { align: "right" });

  const barY = y + 2;
  const barW = 182;
  // track
  doc.setFillColor(230, 224, 208);
  doc.rect(14, barY, barW, 4, "F");
  // fill
  const fillW = Math.max(0.6, (data.pctPaid / 100) * barW);
  doc.setFillColor(...GOLD);
  doc.rect(14, barY, fillW, 4, "F");
  // end tick
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.3);
  doc.line(14 + fillW, barY - 0.6, 14 + fillW, barY + 4.6);

  return y + 10;
}

function categoryHeading(doc: jsPDF, y: number, label: string, count: number, total: number, tone: "navy" | "success" = "navy"): number {
  // Elegant heading strip: gold vertical bar + serif category + count pill + right-aligned total
  const h = 8.5;
  y = ensureSpace(doc, y, h + 28); // keep heading together with at least two table rows
  doc.setFillColor(...GOLD);
  doc.rect(14, y, 1.6, h, "F");
  doc.setFillColor(...IVORY);
  doc.rect(15.6, y, 180.4, h, "F");
  doc.setDrawColor(...GOLD_LT);
  doc.setLineWidth(0.15);
  doc.line(14, y + h, 196, y + h);

  setSerif(doc, "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text(label, 19, y + 6);
  // measure label in its own font BEFORE switching
  const labelW = doc.getTextWidth(label);

  // count pill (in pill font)
  const pillTxt = `${count} ${count === 1 ? "item" : "items"}`;
  setSans(doc, "bold");
  doc.setFontSize(7);
  const pillW = doc.getTextWidth(pillTxt) + 5;
  const pillX = 19 + labelW + 4;
  doc.setFillColor(...NAVY);
  doc.roundedRect(pillX, y + 2.2, pillW, 4.4, 1.2, 1.2, "F");
  doc.setTextColor(...GOLD_LT);
  doc.text(pillTxt, pillX + pillW / 2, y + 5.3, { align: "center" });

  // right total
  setSans(doc, "bold");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text("SECTION TOTAL", 165, y + 3.6, { align: "right" });
  setSerif(doc, "bold");
  doc.setFontSize(10);
  if (tone === "success") doc.setTextColor(...SUCCESS);
  else doc.setTextColor(...NAVY);
  doc.text(formatCurrency(total), 194, y + 6.2, { align: "right" });

  doc.setTextColor(...INK);
  return y + h + 2;
}

function reconciliationBlock(
  doc: jsPDF, y: number,
  d: { openingPayable?: number; openingPaid?: number; totalPurchases: number; totalPaid: number; grandPayable: number; grandPaid: number }
): number {
  y = ensureSpace(doc, y, 40);
  setSerif(doc, "italic");
  doc.setFontSize(9);
  doc.setTextColor(...GOLD);
  doc.text("Ledger Reconciliation", 14, y);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.line(14, y + 1.5, 60, y + 1.5);
  doc.setLineWidth(0.1);
  doc.setDrawColor(...GOLD_LT);
  doc.line(60, y + 1.5, 196, y + 1.5);
  y += 5;

  const colW = 89;
  const gap = 4;
  const leftRows: Array<[string, number, boolean?]> = [];
  if (d.openingPayable !== undefined) leftRows.push(["Opening Payable (B/F)", d.openingPayable]);
  leftRows.push(["New Purchases (Period)", d.totalPurchases]);
  leftRows.push(["Grand Total Payable", d.grandPayable, true]);

  const rightRows: Array<[string, number, boolean?]> = [];
  if (d.openingPaid !== undefined) rightRows.push(["Opening Paid (B/F)", d.openingPaid]);
  rightRows.push(["Payments (Period)", d.totalPaid]);
  rightRows.push(["Grand Total Paid", d.grandPaid, true]);

  const rows = Math.max(leftRows.length, rightRows.length);
  const rowH = 6.5;
  const h = 6 + rows * rowH + 3;

  // Left card (payable)
  drawReconCard(doc, 14, y, colW, h, "Payable Side", NAVY, leftRows);
  // Right card (paid)
  drawReconCard(doc, 14 + colW + gap, y, colW, h, "Settlement Side", SUCCESS, rightRows);

  return y + h + 6;
}

function drawReconCard(
  doc: jsPDF, x: number, y: number, w: number, h: number,
  title: string, accent: [number, number, number], rows: Array<[string, number, boolean?]>
) {
  doc.setFillColor(...WHITE);
  doc.setDrawColor(...GOLD_LT);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h, "FD");
  // header strip
  doc.setFillColor(...accent);
  doc.rect(x, y, w, 6, "F");
  setSans(doc, "bold");
  doc.setFontSize(7.2);
  doc.setTextColor(...WHITE);
  doc.text(title.toUpperCase(), x + 3, y + 4.2);

  doc.setTextColor(...INK);
  rows.forEach(([label, val, bold], i) => {
    const ry = y + 6 + 5 + i * 6.5;
    if (bold) {
      doc.setFillColor(...IVORY);
      doc.rect(x + 0.4, ry - 4, w - 0.8, 6, "F");
    }
    if (bold) setSerif(doc, "bold");
    else setSans(doc, "normal");
    doc.setFontSize(bold ? 9 : 8);
    doc.setTextColor(...(bold ? NAVY : INK));
    doc.text(label, x + 3, ry);
    setSerif(doc, "bold");
    doc.setFontSize(bold ? 9.5 : 8.5);
    doc.setTextColor(...(bold ? accent : INK));
    doc.text(formatCurrency(val), x + w - 3, ry, { align: "right" });
  });
  doc.setTextColor(...INK);
}

function closingHero(doc: jsPDF, y: number, remaining: number, opts?: { title?: string; subtitle?: string; positiveLabel?: string; negativeLabel?: string }) {
  // If not enough room, add a page
  y = ensureSpace(doc, y, 32);
  const h = 30;
  // Navy panel
  doc.setFillColor(...NAVY);
  doc.rect(14, y, 182, h, "F");
  // Gold double frame
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.rect(14, y, 182, h);
  doc.setLineWidth(0.15);
  doc.rect(16, y + 2, 178, h - 4);
  // Left gold plate
  doc.setFillColor(...GOLD);
  doc.rect(14, y, 2, h, "F");

  setSans(doc, "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...GOLD_LT);
  doc.text(opts?.title || "CLOSING BALANCE", 22, y + 9);
  setSerif(doc, "italic");
  doc.setFontSize(8);
  doc.setTextColor(...WHITE);
  doc.text(opts?.subtitle || "Net amount payable to supplier as of statement date.", 22, y + 15);

  setSerif(doc, "bold");
  doc.setFontSize(20);
  const tone: [number, number, number] = remaining > 0 ? GOLD_LT : [180, 220, 190];
  doc.setTextColor(...tone);
  doc.text(formatCurrency(remaining), 192, y + 15, { align: "right" });
  setSans(doc, "normal");
  doc.setFontSize(7);
  doc.setTextColor(...GOLD_LT);
  const statusTxt = remaining > 0
    ? (opts?.positiveLabel || "Outstanding — Payment Due")
    : remaining < 0
    ? (opts?.negativeLabel || "Overpayment / Advance Credit")
    : "Fully Settled";
  doc.text(statusTxt, 192, y + 22, { align: "right" });

  // Auth line
  setSerif(doc, "italic");
  doc.setFontSize(7);
  doc.setTextColor(...GOLD_LT);
  doc.text("Computer-generated statement · Avery Group of Travel · This document does not require a signature.", 105, y + 27, { align: "center" });
  doc.setTextColor(...INK);
}

// Build category-specific purchase table with deep professional details
function buildPurchaseTable(category: string, rows: LedgerEntry[]): { head: any[][]; body: any[][] } {
  const cur = (n?: number) => formatCurrency(n || 0);

  if (category === "Flight") {
    return {
      head: [["Date", "Receipt", "Ticket #", "PNR", "Sector / Route", "Trip / Airline", "Pax / Fare", "Amount"]],
      body: rows.map((e) => {
        const d = e.purchaseDetails || {};
        const pnr = d.pnr || "—";
        const tkt = d.ticketNumber || "—";
        const sector = d.sector || d.description || e.note || "—";
        const meta = [d.tripType, d.airline || d.flightNumber].filter(Boolean).join(" · ") || "Flight";
        const pax = (d.adults || 0) + (d.children || 0) + (d.infants || 0);
        const paxText = pax > 0 ? `${pax} Pax` : "—";
        return [
          fmtDate(e.date), e.id, tkt, pnr, sector, meta, paxText,
          { content: cur(e.amount), styles: { halign: "right" as const, textColor: NAVY } },
        ];
      }),
    };
  }

  if (category === "Hotel") {
    return {
      head: [["Date", "Receipt", "Hotel & City", "Room Type / Voucher", "Rooms", "Nights", "Per Night", "Amount"]],
      body: rows.map((e) => {
        const d = e.purchaseDetails || {};
        const hotelCity = [d.hotelName || e.note, d.city ? `(${d.city})` : null].filter(Boolean).join(" ") || "—";
        const roomMeta = [d.roomType, d.confirmationNo ? `Ref: ${d.confirmationNo}` : null, d.mealPlan].filter(Boolean).join(" · ") || "Standard";
        return [
          fmtDate(e.date), e.id, hotelCity, roomMeta,
          String(d.rooms || "—"), String(d.nights || "—"),
          { content: d.perNight ? cur(d.perNight) : "—", styles: { halign: "right" as const } },
          { content: cur(e.amount), styles: { halign: "right" as const, textColor: NAVY } },
        ];
      }),
    };
  }

  if (category === "Package") {
    return {
      head: [["Date", "Receipt", "Package Title", "Scope & Destination", "Duration", "Inclusions", "Pax", "Amount"]],
      body: rows.map((e) => {
        const d = e.purchaseDetails || {};
        const title = d.packageName || d.description || e.note || "Custom Tour Package";
        const dest = [d.packageType, d.destinationCountry, d.destinationCity ? `[${d.destinationCity}]` : null].filter(Boolean).join(" · ") || "—";
        const dur = d.packageDurationDays ? `${d.packageDurationDays} Days` : "—";
        const inc = (d.packageInclusions || []).slice(0, 3).join(", ") || "Full Package";
        const pax = (d.adults || 0) + (d.children || 0) + (d.infants || 0);
        return [
          fmtDate(e.date), e.id, title, dest, dur, inc, String(pax || "—"),
          { content: cur(e.amount), styles: { halign: "right" as const, textColor: NAVY } },
        ];
      }),
    };
  }

  if (category === "Visa") {
    return {
      head: [["Date", "Receipt", "Country & Type", "MOFA / Ref #", "Applicants", "Pax", "Amount"]],
      body: rows.map((e) => {
        const d = e.purchaseDetails || {};
        const countryType = [d.country, d.visaType].filter(Boolean).join(" · ") || "Visa Service";
        const ref = d.reference || e.note || "—";
        const applicants = d.applicantNames || "—";
        const pax = (d.adults || 0) + (d.children || 0) + (d.infants || 0);
        return [
          fmtDate(e.date), e.id, countryType, ref, applicants, String(pax || "—"),
          { content: cur(e.amount), styles: { halign: "right" as const, textColor: NAVY } },
        ];
      }),
    };
  }

  if (category === "Transport") {
    return {
      head: [["Date", "Receipt", "Route", "Vehicle", "Date / Driver", "Voucher #", "Amount"]],
      body: rows.map((e) => {
        const d = e.purchaseDetails || {};
        const driverInfo = [d.pickupDate, d.driverName].filter(Boolean).join(" · ") || "—";
        return [
          fmtDate(e.date), e.id, d.route || e.note || "—", d.vehicle || "—",
          driverInfo, d.voucherNo || "—",
          { content: cur(e.amount), styles: { halign: "right" as const, textColor: NAVY } },
        ];
      }),
    };
  }

  if (category === "Ziyarah") {
    return {
      head: [["Date", "Receipt", "City & Sites", "Vehicle / Guide", "Pax", "Amount"]],
      body: rows.map((e) => {
        const d = e.purchaseDetails || {};
        const sites = [d.city, d.ziyarahSites].filter(Boolean).join(" · ") || e.note || "Ziyarat Tour";
        const vg = [d.vehicle, d.guideName ? `Guide: ${d.guideName}` : null].filter(Boolean).join(" · ") || "—";
        const pax = (d.adults || 0) + (d.children || 0) + (d.infants || 0);
        return [
          fmtDate(e.date), e.id, sites, vg, String(pax || "—"),
          { content: cur(e.amount), styles: { halign: "right" as const, textColor: NAVY } },
        ];
      }),
    };
  }

  // Insurance, Other, and custom categories
  return {
    head: [["Date", "Receipt", "Description", "Pax / Notes", "Amount"]],
    body: rows.map((e) => {
      const d = e.purchaseDetails || {};
      const pax = (d.adults || 0) + (d.children || 0) + (d.infants || 0);
      const notes = [pax ? `${pax} Pax` : null, d.description, e.note].filter(Boolean).join(" · ") || "—";
      return [
        fmtDate(e.date), e.id, d.description || e.note || "—", notes,
        { content: cur(e.amount), styles: { halign: "right" as const, textColor: NAVY } },
      ];
    }),
  };
}

// =========================================================================
//  AGENT REPORT / STATEMENT
// =========================================================================
export type AgentStatementScope = "client" | "other" | "both";
export interface AgentStatementOptions extends StatementOptions {
  scope?: AgentStatementScope;
  clients?: Client[];
}

/**
 * Agent Statement — professional account statement for one agent.
 *  • Client Business  : bookings brought by the agent → Sale − Agent Commission = Net Receivable
 *  • Other Sale       : purchases made for the agent ("For Agent") + direct other-sale entries, by service
 *  • Receipts         : money received against the selected business
 *  Opening balance = everything dated before the From date (+ legacy B/F); closing = opening + period − received.
 * `entries` should be the FULL ledger; the function picks the agent's rows itself.
 */
export async function generateAgentReport(agent: Agent, entries: LedgerEntry[], opts: AgentStatementOptions = {}) {
  const doc = new jsPDF();
  await loadPdfFonts(doc);
  header(doc, "Agent Account Statement");
  const scope: AgentStatementScope = opts.scope || "both";
  const incClient = scope !== "other";
  const incOther = scope !== "client";
  const includeOpening = opts.includeOpening !== false;
  const from = opts.fromDate, to = opts.toDate;
  const before = (d?: string) => !!from && !!d && new Date(d).getTime() < new Date(from).getTime();
  const within = (d?: string) => !!d && inRange(d, from, to);

  const bookings = (opts.bookings || []).filter((b) => b.agentId === agent.id);
  const headIds = new Set(bookings.map((b) => b.headId));
  const clients = opts.clients || [];
  const bDate = (b: Booking) => ((b as any).createdAt ? String((b as any).createdAt).slice(0, 10) : b.travelDate);
  const leadName = (h: string) => { const c = clients.find((x) => x.headId === h); return c ? getClientName(c) : "—"; };

  const otherRows = entries.filter((e) => (e.type === "purchase" && e.purchasedFor === "agent" && e.agentId === agent.id) || (e.type === "other_sale" && e.referenceId === agent.id));
  const otherSaleOf = (e: LedgerEntry) => (e.type === "purchase" ? (e.saleAmount ?? e.amount) : e.amount);
  const clientReceipts = entries.filter((e) => (e.type === "client_receive" || e.type === "client_refund" || e.type === "client_charge") && e.headId && headIds.has(e.headId));
  const agentReceipts = entries.filter((e) => e.type === "agent_receive" && (e.referenceId === agent.id || e.agentId === agent.id));
  const commissionPaid = entries.filter((e) => e.type === "agent_commission" && e.referenceId === agent.id);

  // signed movement of the agent account: + increases what he owes us, − reduces it
  const bookingNet = (b: Booking) => (b.totalAmount || 0) - (b.commission || 0);
  const clientMove = (e: LedgerEntry) => (e.type === "client_charge" ? e.amount : -e.amount);

  // ---------- Opening balance ----------
  let opening = 0;
  if (includeOpening) {
    if (incClient) {
      opening += (agent.openingSales || 0) - (agent.openingCommission || 0);
      opening += bookings.filter((b) => before(bDate(b))).reduce((s, b) => s + bookingNet(b), 0);
      opening += clientReceipts.filter((e) => before(e.date)).reduce((s, e) => s + clientMove(e), 0);
    }
    if (incOther) opening += otherRows.filter((e) => before(e.date)).reduce((s, e) => s + otherSaleOf(e), 0);
    opening -= agentReceipts.filter((e) => before(e.date)).reduce((s, e) => s + e.amount, 0);
  }

  const pBookings = incClient ? bookings.filter((b) => !from && !to ? true : within(bDate(b))) : [];
  const pClientTx = incClient ? clientReceipts.filter((e) => within(e.date) || (!from && !to)) : [];
  const pOther = incOther ? otherRows.filter((e) => within(e.date) || (!from && !to)) : [];
  const pAgentRec = agentReceipts.filter((e) => within(e.date) || (!from && !to));

  const grossSale = pBookings.reduce((s, b) => s + (b.totalAmount || 0), 0);
  const commission = pBookings.reduce((s, b) => s + (b.commission || 0), 0);
  const netClient = grossSale - commission;
  const extraCharges = pClientTx.filter((e) => e.type === "client_charge").reduce((s, e) => s + e.amount, 0);
  const refunds = pClientTx.filter((e) => e.type === "client_refund").reduce((s, e) => s + e.amount, 0);
  const clientReceived = pClientTx.filter((e) => e.type === "client_receive").reduce((s, e) => s + e.amount, 0);
  const otherSale = pOther.reduce((s, e) => s + otherSaleOf(e), 0);
  const otherCost = pOther.filter((e) => e.type === "purchase").reduce((s, e) => s + e.amount, 0);
  const agentReceived = pAgentRec.reduce((s, e) => s + e.amount, 0);
  const totalReceived = clientReceived + agentReceived;
  const periodBusiness = netClient + extraCharges - refunds + otherSale;
  const closing = opening + periodBusiness - totalReceived;

  const periodLabel = from || to ? `${fmtDate(from)} — ${fmtDate(to)}` : "All-time";
  const scopeLabel = scope === "client" ? "Client Business" : scope === "other" ? "Other Sale" : "Client Business + Other Sale";

  let y = 44;
  y = fromAndTo(doc, y, "Agent", [["ID", agent.id], ["Name", agent.name], ["Phone", agent.phone], ["Email", agent.email]]);

  doc.setFillColor(...NAVY);
  doc.rect(14, y, 182, 7, "F");
  setSerif(doc, "bold"); doc.setFontSize(8.5); doc.setTextColor(...WHITE);
  doc.text(`Period: ${periodLabel}`, 18, y + 4.9);
  doc.text(`Statement: ${scopeLabel}`, 192, y + 4.9, { align: "right" });
  doc.setTextColor(...INK);
  y += 11;

  y = summaryCards(doc, y, [
    ["Opening Balance", formatCurrency(opening), "ink"],
    ["Period Business", formatCurrency(periodBusiness), "gold"],
    ["Received", formatCurrency(totalReceived), "success"],
    ["Closing Balance", formatCurrency(closing), closing > 0 ? "danger" : "success"],
  ]);

  const money = (n: number, color: [number, number, number] = NAVY) => ({ content: formatCurrency(n), styles: { halign: "right" as const, textColor: color } });
  const footRow = (label: string, span: number, val: number, color: [number, number, number] = NAVY) => [[
    { content: label, colSpan: span, styles: { halign: "right" as const, fontStyle: "bold" as const, fillColor: ROW_ALT, textColor: NAVY } },
    { content: formatCurrency(val), styles: { halign: "right" as const, fontStyle: "bold" as const, fillColor: ROW_ALT, textColor: color } },
  ]];

  // ---------- Client Business ----------
  if (incClient) {
    y = categoryHeading(doc, y + 2, "Client Business (via agent reference)", pBookings.length, netClient);
    brandTable(doc, {
      startY: y + 1,
      head: [["Date", "Head ID", "Lead Client", "Package", "Pax", "Sale", "Commission", "Net"]],
      body: pBookings.length ? pBookings.map((b) => [
        fmtDate(bDate(b)), b.headId, leadName(b.headId), b.packageType || "—",
        String(clients.filter((c) => c.headId === b.headId).length),
        money(b.totalAmount || 0, INK), money(b.commission || 0, DANGER), money(bookingNet(b)),
      ]) : [[{ content: "No client bookings in this period", colSpan: 8, styles: { halign: "center" as const, textColor: MUTED } }]],
      foot: [[
        { content: "Totals", colSpan: 5, styles: { halign: "right" as const, fontStyle: "bold" as const, fillColor: ROW_ALT, textColor: NAVY } },
        { content: formatCurrency(grossSale), styles: { halign: "right" as const, fontStyle: "bold" as const, fillColor: ROW_ALT, textColor: INK } },
        { content: formatCurrency(commission), styles: { halign: "right" as const, fontStyle: "bold" as const, fillColor: ROW_ALT, textColor: DANGER } },
        { content: formatCurrency(netClient), styles: { halign: "right" as const, fontStyle: "bold" as const, fillColor: ROW_ALT, textColor: NAVY } },
      ]],
    });
    y = (doc as any).lastAutoTable.finalY + 7;
  }

  // ---------- Other Sale (service-wise) ----------
  if (incOther) {
    const groups = new Map<string, LedgerEntry[]>();
    pOther.forEach((e) => { const k = e.serviceCategory || (e.type === "other_sale" ? "Direct Sale" : "Other"); if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(e); });
    const order = ["Flight", "Hotel", "Package", "Visa", "Transport", "Ziyarah", "Insurance", "Other", "Direct Sale"];
    const keys = [...order.filter((k) => groups.has(k)), ...[...groups.keys()].filter((k) => !order.includes(k))];
    if (!keys.length) {
      y = categoryHeading(doc, y, "Other Sale", 0, 0);
      brandTable(doc, { startY: y + 1, head: [["Date", "Client", "Description", "Amount"]], body: [[{ content: "No other sale in this period", colSpan: 4, styles: { halign: "center" as const, textColor: MUTED } }]] });
      y = (doc as any).lastAutoTable.finalY + 7;
    }
    for (const k of keys) {
      const rows = groups.get(k)!;
      const tot = rows.reduce((s, e) => s + otherSaleOf(e), 0);
      y = categoryHeading(doc, y, `Other Sale — ${k}`, rows.length, tot);
      brandTable(doc, {
        startY: y + 1,
        head: [["Date", "Ref", "Client", "Specification / Record Details", "Amount"]],
        body: rows.map((e) => {
          const d = e.purchaseDetails || {};
          let desc = "—";
          if (k === "Flight") {
            desc = [d.pnr && `PNR: ${d.pnr}`, d.ticketNumber && `Tkt: ${d.ticketNumber}`, d.sector, d.airline].filter(Boolean).join(" · ") || e.note || "Flight Ticket";
          } else if (k === "Hotel") {
            desc = [d.hotelName, d.city && `(${d.city})`, d.rooms && `${d.rooms} Rms`, d.nights && `${d.nights} Nts`, d.mealPlan].filter(Boolean).join(" ") || e.note || "Hotel Booking";
          } else if (k === "Package") {
            desc = [d.packageName || d.destinationCity, d.packageType, d.packageDurationDays && `${d.packageDurationDays}D`].filter(Boolean).join(" · ") || e.note || "Tour Package";
          } else if (k === "Visa") {
            desc = [d.country, d.visaType, d.reference && `Ref: ${d.reference}`].filter(Boolean).join(" · ") || e.note || "Visa";
          } else if (k === "Transport") {
            desc = [d.route, d.vehicle].filter(Boolean).join(" · ") || e.note || "Transport";
          } else {
            desc = [d.description, e.chargeCategory, e.note].filter(Boolean).join(" · ") || "Service";
          }
          return [fmtDate(e.date), e.id, e.forClientName || "—", desc, money(otherSaleOf(e))];
        }),
        foot: footRow(`Total ${k}`, 4, tot),
      });
      y = (doc as any).lastAutoTable.finalY + 7;
    }
  }

  // ---------- Receipts & adjustments ----------
  const recRows = [
    ...pClientTx.map((e) => ({ e, label: e.type === "client_receive" ? "Client Receipt" : e.type === "client_refund" ? "Client Refund" : `Extra Charge${e.chargeCategory ? ` — ${e.chargeCategory}` : ""}`, sign: e.type === "client_charge" ? 1 : -1 })),
    ...pAgentRec.map((e) => ({ e, label: "Received from Agent", sign: -1 })),
  ].sort((a, b) => a.e.date.localeCompare(b.e.date));
  y = categoryHeading(doc, y, "Receipts & Adjustments", recRows.length, totalReceived, "success");
  let running = opening;
  brandTable(doc, {
    startY: y + 1,
    head: [["Date", "Ref", "Head", "Particulars", "Debit", "Credit", "Balance"]],
    body: [
      [{ content: "Opening Balance", colSpan: 6, styles: { fontStyle: "bold" as const, fillColor: ROW_ALT } }, { content: formatCurrency(opening), styles: { halign: "right" as const, fontStyle: "bold" as const, fillColor: ROW_ALT, textColor: NAVY } }],
      [{ content: "Business booked in period (net of commission)", colSpan: 4 }, money(netClient + otherSale, INK), "", money((running += netClient + otherSale))],
      ...recRows.map(({ e, label, sign }) => {
        running += sign * e.amount;
        return [fmtDate(e.date), e.id, e.headId || "—", label,
          sign > 0 ? money(e.amount, INK) : "", sign < 0 ? money(e.amount, SUCCESS) : "", money(running)];
      }),
    ],
    foot: footRow("Closing Balance", 6, closing, closing > 0 ? DANGER : SUCCESS),
  });
  y = (doc as any).lastAutoTable.finalY + 7;

  // ---------- Summary ----------
  y = ensureSpace(doc, y, 70);
  y = sectionTitle(doc, "Account Summary", y); y += 5;
  const sumBody: any[] = [["Opening Balance", money(opening)]];
  if (incClient) {
    sumBody.push(["Client Sale (gross)", money(grossSale, INK)], ["Less: Agent Commission", money(-commission, DANGER)], ["Net Client Business", money(netClient)]);
    if (extraCharges) sumBody.push(["Add: Extra Charges", money(extraCharges, INK)]);
    if (refunds) sumBody.push(["Less: Client Refunds", money(-refunds, DANGER)]);
  }
  if (incOther) sumBody.push(["Other Sale", money(otherSale)]);
  sumBody.push(["Less: Received", money(-totalReceived, SUCCESS)]);
  brandTable(doc, {
    startY: y,
    body: sumBody,
    columnStyles: { 0: { cellWidth: 120, fontStyle: "bold" } },
    foot: [[{ content: closing >= 0 ? "Remaining Balance (Receivable)" : "Advance / Credit", styles: { fillColor: NAVY, textColor: WHITE, fontStyle: "bold" as const } }, { content: formatCurrency(Math.abs(closing)), styles: { fillColor: NAVY, textColor: GOLD_LT, halign: "right" as const, fontStyle: "bold" as const } }]],
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  void otherCost; // internal profit is never printed on an agent-facing statement

  // Commission account (separate)
  const commEarned = bookings.reduce((s, b) => s + (b.commission || 0), 0) + (agent.openingCommission || 0);
  const commPaid = commissionPaid.reduce((s, e) => s + e.amount, 0) + (agent.openingPaidCommission || 0);
  y = summaryCards(doc, y, [
    ["Commission Earned", formatCurrency(commEarned), "gold"],
    ["Commission Paid", formatCurrency(commPaid), "success"],
    ["Commission Payable", formatCurrency(commEarned - commPaid), "danger"],
  ]);

  footer(doc);
  save(doc, `Avery_Agent_Statement_${agent.id}_${scope}.pdf`);
}

// =========================================================================
//  CLIENT STATEMENT
// =========================================================================
export async function generateClientStatement(client: Client, entries: LedgerEntry[], opts: StatementOptions = {}) {
  const doc = new jsPDF();
  await loadPdfFonts(doc);
  executiveHeader(doc, "CLIENT", "STATEMENT");

  const filtered = entries.filter((e) => inRange(e.date, opts.fromDate, opts.toDate));
  const periodLabel = opts.fromDate || opts.toDate
    ? `${fmtDate(opts.fromDate)} — ${fmtDate(opts.toDate)}`
    : "All-time";

  const includeOpening = opts.includeOpening !== false;
  const openingPaid = includeOpening ? (client.openingPaid || 0) : 0;
  const totalDue = client.amountDue;
  const totalPaid = client.amountPaid + openingPaid;
  const remaining = totalDue - totalPaid;

  let y = 66;
  y = supplierMetaBar(doc, y, {
    stmtNo: `AV-CS-${client.id.replace(/[^0-9A-Z]/gi, "")}-${new Date().getFullYear()}`,
    period: periodLabel,
    groupLabel: client.packageType ? `${client.packageType} Package · Head ${client.headId}` : undefined,
  });

  y = clientIdentityCard(doc, y, client);

  const pctPaid = totalDue > 0 ? Math.max(0, Math.min(100, (totalPaid / totalDue) * 100)) : 0;
  y = executiveSnapshot(doc, y, {
    payable: totalDue,
    paid: totalPaid,
    remaining,
    bf: includeOpening && openingPaid > 0 ? openingPaid : undefined,
    purchases: opts.bookings ? opts.bookings.length : 1,
    payments: filtered.length,
    pctPaid,
  });

  if (opts.bookings && opts.bookings.length) {
    y = renderServiceSections(doc, y, opts.bookings);
  }

  // Payment receipts table
  if (filtered.length || (includeOpening && openingPaid > 0)) {
    y = categoryHeading(doc, y, "Payments Received", filtered.length + (openingPaid > 0 ? 1 : 0), totalPaid, "success");
    const body: any[] = [];
    if (includeOpening && openingPaid > 0) {
      body.push([
        { content: "Opening Paid (B/F)", colSpan: 3, styles: { fontStyle: "bold" as const, fillColor: ROW_ALT } },
        { content: formatCurrency(openingPaid), styles: { halign: "right" as const, fontStyle: "bold" as const, fillColor: ROW_ALT, textColor: NAVY } },
      ]);
    }
    for (const p of filtered) {
      body.push([
        fmtDate(p.date), p.id, p.note || p.referenceName || "Payment Received",
        { content: formatCurrency(p.amount), styles: { halign: "right" as const, textColor: SUCCESS } },
      ]);
    }
    brandTable(doc, {
      startY: y + 1,
      head: [["Date", "Receipt #", "Particulars / Notes", "Amount"]],
      body,
      foot: [[
        { content: "Total Received", colSpan: 3, styles: { halign: "right" as const, fontStyle: "bold" as const, fillColor: ROW_ALT, textColor: NAVY } },
        { content: formatCurrency(totalPaid), styles: { halign: "right" as const, fontStyle: "bold" as const, fillColor: ROW_ALT, textColor: SUCCESS } },
      ]],
    });
    y = (doc as any).lastAutoTable.finalY + 7;
  }

  // Reconciliation summary
  y = reconciliationBlock(doc, y, {
    openingPayable: undefined,
    openingPaid: includeOpening && openingPaid > 0 ? openingPaid : undefined,
    totalPurchases: totalDue,
    totalPaid: filtered.reduce((s, e) => s + e.amount, 0),
    grandPayable: totalDue,
    grandPaid: totalPaid,
  });

  closingHero(doc, y, remaining, {
    title: "CLOSING BALANCE",
    subtitle: "Net balance receivable from client as of statement date.",
    positiveLabel: "Outstanding — Payment Due",
    negativeLabel: "Overpayment / Advance Credit",
  });

  footer(doc);
  save(doc, `Avery_Client_Statement_${client.id}.pdf`);
}

// =========================================================================
//  PAYMENT HISTORY (generic, used by DetailDialog "History" buttons)
// =========================================================================
export async function generatePaymentHistory(
  title: string,
  ownerInfo: Array<[string, string]>,
  entries: LedgerEntry[],
  summary: Array<[string, string, string?]>
) {
  const doc = new jsPDF();
  await loadPdfFonts(doc);
  header(doc, "Payment History");

  let y = 44;
  y = fromAndTo(doc, y, title, ownerInfo.slice(0, 4).map(([k, v]) => [k, v] as [string, string]));

  const cards: Array<[string, string, "ink" | "success" | "danger" | "gold"]> = summary.slice(0, 4).map(([l, v, c]) => [
    l, v,
    (c === "success" ? "success" : c === "destructive" ? "danger" : c === "gold" ? "gold" : "ink"),
  ]);
  y = summaryCards(doc, y, cards);
  y += 2;

  y = sectionTitle(doc, "Transaction History", y); y += 4;
  let running = 0;
  brandTable(doc, {
    startY: y + 1,
    head: [["Date", "Receipt", "Description", "Type", "Amount", "Running"]],
    body: entries.map((e) => {
      running += e.amount;
      return [
        fmtDate(e.date), e.id, e.note || e.referenceName, labelType(e.type),
        { content: formatCurrency(e.amount), styles: { halign: "right" as const } },
        { content: formatCurrency(running), styles: { halign: "right" as const, textColor: NAVY } },
      ];
    }),
  });

  footer(doc);
  save(doc, `Avery_Payment_History_${title.replace(/\s+/g, "_")}.pdf`);
}

// =========================================================================
//  INVOICE
// =========================================================================
export async function generateInvoice(booking: Booking, clients: Client[], agent?: Agent, supplier?: Supplier) {
  const doc = new jsPDF();
  await loadPdfFonts(doc);
  header(doc, "Tax Invoice");

  let y = 44;
  y = fromAndTo(doc, y, "Bill To", [
    ["Head ID", booking.headId],
    ["Lead", clients[0] ? getClientName(clients[0]) : "—"],
    ["Phone", clients[0]?.phone || "—"],
    ["Members", String(booking.members || clients.length)],
  ]);

  // Meta strip
  doc.setFillColor(...NAVY);
  doc.rect(14, y, 182, 7, "F");
  setSerif(doc, "bold");
  doc.setFontSize(9);
  doc.setTextColor(...WHITE);
  doc.text(`Invoice #INV-${booking.headId.replace("AV-HD-", "")}   ·   Package: ${booking.packageType}`, 18, y + 5);
  doc.text(`Travel: ${fmtDate(booking.travelDate)}`, 192, y + 5, { align: "right" });
  doc.setTextColor(...INK);
  y += 11;

  y = sectionTitle(doc, "Client Breakdown", y); y += 4;
  brandTable(doc, {
    startY: y + 1,
    head: [["#", "Client ID", "Name", "Passport", "Due", "Paid", "Status"]],
    body: clients.map((c, i) => [
      String(i + 1), c.id, getClientName(c), c.passport || "—",
      { content: formatCurrency(c.amountDue), styles: { halign: "right" as const } },
      { content: formatCurrency(c.amountPaid), styles: { halign: "right" as const, textColor: SUCCESS } },
      c.paymentStatus,
    ]),
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Service sections embedded in invoice if any
  y = renderServiceSections(doc, y, [booking]);

  const balance = booking.totalAmount - booking.amountReceived;
  // Right-aligned totals box
  doc.setFillColor(...IVORY);
  doc.rect(110, y, 86, 32, "F");
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.rect(110, y, 86, 32);
  setSans(doc, "normal");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text("Total Amount", 114, y + 7);
  doc.text(formatCurrency(booking.totalAmount), 192, y + 7, { align: "right" });
  doc.text("Received", 114, y + 14);
  doc.setTextColor(...SUCCESS);
  doc.text(formatCurrency(booking.amountReceived), 192, y + 14, { align: "right" });
  doc.setTextColor(...INK);

  doc.setFillColor(...GOLD);
  doc.rect(110, y + 19, 86, 13, "F");
  doc.setTextColor(...WHITE);
  setSerif(doc, "bold");
  doc.setFontSize(11);
  doc.text("BALANCE DUE", 114, y + 27.5);
  doc.text(formatCurrency(balance), 192, y + 27.5, { align: "right" });

  if (agent || supplier) {
    setSans(doc, "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(`Agent: ${agent?.name || "Direct"}   ·   Supplier: ${supplier?.companyName || "—"}`, 14, y + 36);
  }

  footer(doc);
  save(doc, `Avery_Invoice_${booking.headId}.pdf`);
}

// =========================================================================
//  PAYMENT RECEIPT
// =========================================================================
export async function generatePaymentReceipt(entry: LedgerEntry, opts?: { clientName?: string; method?: string; handledBy?: string; reference?: string }) {
  const doc = new jsPDF();
  await loadPdfFonts(doc);
  header(doc, "Payment Receipt");

  let y = 44;
  y = fromAndTo(doc, y, "Received From", [
    ["Name", opts?.clientName || entry.referenceName],
    ["Reference", opts?.reference || entry.headId || "—"],
    ["Receipt #", entry.id],
    ["Date", fmtDate(entry.date)],
  ]);

  brandTable(doc, {
    startY: y,
    head: [["Description", "Method", "Handled By", "Amount (PKR)"]],
    body: [[
      entry.note || "Payment received",
      opts?.method || entry.paymentMethod || "Cash / Bank Transfer",
      opts?.handledBy || entry.collectedBy || "Avery Office",
      { content: formatCurrency(entry.amount).replace("PKR", "").trim(), styles: { halign: "right" as const } }
    ]],
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  const pd = entry.purchaseDetails;
  if (pd || entry.type === "purchase" || entry.type === "jv" || entry.chequeNo || entry.txnRef) {
    const detailsRows: Array<[string, string]> = [];
    if (pd?.ticketNumber) detailsRows.push(["Ticket Number", pd.ticketNumber]);
    if (pd?.pnr) detailsRows.push(["PNR Booking Ref", pd.pnr]);
    if (pd?.sector) detailsRows.push(["Sector / Route", pd.sector]);
    if (pd?.tripType) detailsRows.push(["Trip Type", pd.tripType]);
    if (pd?.airline) detailsRows.push(["Airline & Flight", [pd.airline, pd.flightNumber].filter(Boolean).join(" · ")]);
    if (pd?.hotelName) detailsRows.push(["Hotel & City", `${pd.hotelName} ${pd.city ? `(${pd.city})` : ""}`]);
    if (pd?.rooms || pd?.nights) detailsRows.push(["Rooms / Nights", `${pd.rooms || 1} Rooms · ${pd.nights || 1} Nights [${pd.mealPlan || "Standard"}]`]);
    if (pd?.packageName) detailsRows.push(["Package Title", pd.packageName]);
    if (pd?.destinationCity) detailsRows.push(["Destination Combo", `${pd.destinationCountry || ""} — ${pd.destinationCity}`]);
    if (pd?.packageInclusions?.length) detailsRows.push(["Inclusions", pd.packageInclusions.join(", ")]);
    if (pd?.visaType) detailsRows.push(["Visa Category", `${pd.country || ""} (${pd.visaType}) · Ref: ${pd.reference || "—"}`]);
    if (pd?.applicantNames) detailsRows.push(["Applicants", pd.applicantNames]);
    if (pd?.route) detailsRows.push(["Transport Route", `${pd.route} (${pd.vehicle || "Standard"})`]);
    if (entry.type === "jv") detailsRows.push(["JV Settlement", entry.jvType === "account_transfer" ? "Account to Account Transfer" : "Reconciliation Adjustment"]);
    if (entry.chequeNo) detailsRows.push(["Cheque No", `${entry.chequeNo} ${entry.chequeDate ? `(Date: ${entry.chequeDate})` : ""}`]);
    if (entry.txnRef) detailsRows.push(["Txn / Ref No", entry.txnRef]);
    if (entry.bankName) detailsRows.push(["Bank Name", entry.bankName]);

    if (detailsRows.length) {
      y = sectionTitle(doc, "Service & Transaction Details", y); y += 4;
      brandTable(doc, {
        startY: y,
        head: [["Item / Specification", "Detail Record"]],
        body: detailsRows,
      });
      y = (doc as any).lastAutoTable.finalY + 4;
    }
  }

  totalsBand(doc, y, "Total Received", formatCurrency(entry.amount));
  y += 18;

  doc.setDrawColor(...MUTED);
  doc.setLineWidth(0.2);
  doc.line(20, y + 6, 80, y + 6);
  doc.line(130, y + 6, 190, y + 6);
  setSans(doc, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  doc.text("Authorized Signature", 30, y + 11);
  doc.text("Company Stamp", 145, y + 11);

  doc.setTextColor(...MUTED);
  doc.setFontSize(7);
  doc.text("This is a computer-generated receipt and does not require a physical signature.", 14, y + 22);

  footer(doc);
  save(doc, `Avery_Payment_Receipt_${entry.id}.pdf`);
}

// =========================================================================
//  VOUCHERS — Hotel / Flight / Transport
// =========================================================================
export async function generateHotelVoucher(booking: Booking, clients: Client[], hotels: HotelService[], opts?: { transports?: TransportService[]; flights?: FlightService[]; voucherSuffix?: string }) {
  const doc = new jsPDF();
  await loadPdfFonts(doc);
  const subtitle = booking.packageType === "Umrah" ? "Umrah Hotel Voucher" : booking.packageType === "Hajj" ? "Hajj Hotel Voucher" : "Hotel Voucher";
  header(doc, subtitle);

  let y = 44;
  y = fromAndTo(doc, y, "Guest Booking", [
    ["Head ID", booking.headId],
    ["Voucher #", `AV-${booking.headId.replace(/[^0-9]/g, "")}${opts?.voucherSuffix || ""}`],
    ["Travel Date", fmtDate(booking.travelDate)],
    ["Members", String(clients.length)],
  ]);

  y = sectionTitle(doc, "Passenger Details", y); y += 4;
  brandTable(doc, {
    startY: y + 1,
    head: [["#", "Passenger Name", "Passport No", "Type"]],
    body: clients.map((c, i) => [String(i + 1), getClientName(c), c.passport || "—", "Adult"]),
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  if (hotels.length) {
    y = sectionTitle(doc, "Accommodation", y); y += 4;
    brandTable(doc, {
      startY: y + 1,
      head: [["City", "Hotel Name", "Room", "Check-In", "Check-Out", "Nights"]],
      body: hotels.map((h) => [h.city, h.hotelName, h.roomType, fmtDate(h.checkIn), fmtDate(h.checkOut), String(h.nights)]),
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  if (opts?.transports?.length) {
    y = sectionTitle(doc, "Transport", y); y += 4;
    brandTable(doc, {
      startY: y + 1,
      head: [["Service", "Route", "Vehicle", "Date"]],
      body: opts.transports.map((t) => [t.service, t.route, t.vehicle, fmtDate(t.date)]),
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  if (opts?.flights?.length) {
    y = sectionTitle(doc, "Flights", y); y += 4;
    brandTable(doc, {
      startY: y + 1,
      head: [["Date", "Flight", "From", "To", "Departure", "Arrival"]],
      body: opts.flights.map((f) => [fmtDate(f.date), f.flightNo, f.from, f.to, f.departure, f.arrival]),
    });
  }

  footer(doc);
  const cityTag = hotels.length === 1 ? `_${hotels[0].city}` : hotels.length > 1 ? "_All" : "";
  save(doc, `Avery_Hotel_Voucher_${booking.headId}${cityTag}.pdf`);
}

export async function generateFlightVoucher(booking: Booking, clients: Client[], flights: FlightService[]) {
  const doc = new jsPDF();
  await loadPdfFonts(doc);
  header(doc, "Flight Voucher");
  let y = 44;
  y = fromAndTo(doc, y, "Booking", [
    ["Head ID", booking.headId],
    ["Voucher #", `AV-FL-${booking.headId.replace(/[^0-9]/g, "")}`],
    ["Travel Date", fmtDate(booking.travelDate)],
    ["Members", String(clients.length)],
  ]);
  y = sectionTitle(doc, "Passenger Details", y); y += 4;
  brandTable(doc, {
    startY: y + 1,
    head: [["#", "Passenger Name", "Passport No"]],
    body: clients.map((c, i) => [String(i + 1), getClientName(c), c.passport || "—"]),
  });
  y = (doc as any).lastAutoTable.finalY + 6;
  y = sectionTitle(doc, "Flights", y); y += 4;
  brandTable(doc, {
    startY: y + 1,
    head: [["Date", "Flight", "From", "To", "Departure", "Arrival"]],
    body: flights.map((f) => [fmtDate(f.date), f.flightNo, f.from, f.to, f.departure, f.arrival]),
  });
  footer(doc);
  save(doc, `Avery_Flight_Voucher_${booking.headId}.pdf`);
}

export async function generateTransportVoucher(booking: Booking, clients: Client[], transports: TransportService[]) {
  const doc = new jsPDF();
  await loadPdfFonts(doc);
  header(doc, "Transport Voucher");
  let y = 44;
  y = fromAndTo(doc, y, "Booking", [
    ["Head ID", booking.headId],
    ["Voucher #", `AV-TR-${booking.headId.replace(/[^0-9]/g, "")}`],
    ["Travel Date", fmtDate(booking.travelDate)],
    ["Members", String(clients.length)],
  ]);
  y = sectionTitle(doc, "Passenger Details", y); y += 4;
  brandTable(doc, {
    startY: y + 1,
    head: [["#", "Passenger Name", "Passport No"]],
    body: clients.map((c, i) => [String(i + 1), getClientName(c), c.passport || "—"]),
  });
  y = (doc as any).lastAutoTable.finalY + 6;
  y = sectionTitle(doc, "Transport", y); y += 4;
  brandTable(doc, {
    startY: y + 1,
    head: [["Service", "Route", "Vehicle", "Date"]],
    body: transports.map((t) => [t.service, t.route, t.vehicle, fmtDate(t.date)]),
  });
  footer(doc);
  save(doc, `Avery_Transport_Voucher_${booking.headId}.pdf`);
}