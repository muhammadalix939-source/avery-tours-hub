import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Plus, Trash2, Pencil, Download, ArrowRightLeft, Calculator,
  Landmark, Banknote, Wallet, Plane, Building2, FileCheck2, Bus,
  MapPin, Package, Check, X, ShieldCheck, Compass, CheckSquare, Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import PageHeader from "@/components/PageHeader";
import GroupSeatStrip from "@/components/GroupSeatStrip";
import { SearchableSelect } from "@/components/SearchableSelect";
import SortBar from "@/components/SortBar";
import { sortEntities, type SortOptionKey } from "@/lib/sort-utils";
import { formatCurrency, getClientName } from "@/lib/data";
import { useStore, computeGroupUsedPax, entryDirection, computeAccountBalance, type LedgerEntry, type Account } from "@/lib/store";
import { toast } from "sonner";
import { getPKTDate } from "@/lib/date-utils";
import { generatePaymentReceipt } from "@/lib/pdf";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/entries")({
  component: EntriesPage,
  head: () => ({ meta: [{ title: "Entries — AV Travel CRM" }] }),
});

const typeLabels: Record<LedgerEntry["type"], string> = {
  client_receive: "Client Payment Received",
  purchase: "Purchase from Supplier",
  supplier_payment: "Supplier Payment",
  agent_commission: "Agent Commission",
  expense: "Expense",
  client_charge: "Extra Charge to Client",
  client_refund: "Refund to Client",
  supplier_refund: "Refund from Supplier",
  other_sale: "Other Sale",
  gift: "Gift & Expense",
  drawing: "Owner Drawing",
  agent_receive: "Agent Payment Received",
  client_discount: "Client Discount / Concession",
  supplier_discount: "Supplier Discount / Rebate",
  jv: "Journal Voucher (JV) / Settlement",
};

const typeColors: Record<LedgerEntry["type"], string> = {
  client_receive: "text-success",
  purchase: "text-warning",
  supplier_payment: "text-destructive",
  agent_commission: "text-warning",
  expense: "text-destructive",
  client_charge: "text-primary",
  client_refund: "text-destructive",
  supplier_refund: "text-success",
  other_sale: "text-success",
  gift: "text-destructive",
  drawing: "text-destructive",
  agent_receive: "text-success",
  client_discount: "text-amber-400",
  supplier_discount: "text-emerald-400",
  jv: "text-primary font-medium",
};

/** Money that flows INTO the business (shown with a + sign). */
const INFLOW_TYPES: LedgerEntry["type"][] = ["client_receive", "supplier_refund", "other_sale", "agent_receive"];
/** Entries where real money moves — these capture account + instrument details. */
const MONEY_TYPES: LedgerEntry["type"][] = ["client_receive", "agent_receive", "supplier_payment", "agent_commission", "expense", "client_refund", "supplier_refund", "drawing", "jv"];
const METHODS = ["Cash", "Cheque", "Bank Transfer", "Online / Wallet"] as const;

const CHARGE_CATEGORIES = [
  "Embassy / Send-to-Embassy Fee",
  "Visa Fee",
  "Ticket Change / Reissue",
  "Excess Baggage",
  "Hotel Upgrade",
  "Transport Extra",
  "Insurance",
  "Service / Processing Charge",
  "Late Payment Charge",
  "Other Charge",
];

const SERVICE_CATEGORIES = [
  "Hotel",
  "Flight",
  "Visa",
  "Transport",
  "Package",
  "Ziyarah",
  "Insurance",
  "Other",
] as const;

function buildDetailsPayload(cat: string, d: any): LedgerEntry["purchaseDetails"] {
  const num = (v: any) => (v === "" || v == null ? undefined : Number(v) || 0);
  const str = (v: any) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const pax = {
    adults: num(d.adults), children: num(d.children), infants: num(d.infants),
    adultPrice: num(d.adultPrice), childPrice: num(d.childPrice), infantPrice: num(d.infantPrice),
  };
  if (cat === "Flight") {
    return {
      ...pax,
      ticketNumber: str(d.ticketNumber),
      pnr: str(d.pnr),
      sector: str(d.sector),
      tripType: d.tripType,
      departureDate: str(d.departureDate),
      returnDate: str(d.returnDate),
      multiCityRoute: str(d.multiCityRoute),
      airline: str(d.airline),
      flightNumber: str(d.flightNumber),
      cabinClass: str(d.cabinClass),
      description: str(d.description),
    };
  }
  if (cat === "Hotel") {
    return {
      hotelName: str(d.hotelName),
      city: str(d.city),
      roomType: str(d.roomType),
      rooms: num(d.rooms),
      perNight: num(d.perNight),
      nights: num(d.nights),
      checkIn: str(d.checkIn),
      checkOut: str(d.checkOut),
      mealPlan: str(d.mealPlan),
      confirmationNo: str(d.confirmationNo),
      description: str(d.description),
    };
  }
  if (cat === "Visa") {
    return {
      ...pax,
      visaType: str(d.visaType),
      country: str(d.country),
      reference: str(d.reference),
      applicantNames: str(d.applicantNames),
      description: str(d.description),
    };
  }
  if (cat === "Transport") {
    return {
      ...pax,
      route: str(d.route),
      vehicle: str(d.vehicle),
      pickupDate: str(d.pickupDate),
      driverName: str(d.driverName),
      driverPhone: str(d.driverPhone),
      voucherNo: str(d.voucherNo),
      description: str(d.description),
    };
  }
  if (cat === "Package") {
    return {
      ...pax,
      packageName: str(d.packageName),
      packageType: d.packageType,
      destinationCountry: str(d.destinationCountry),
      destinationCity: str(d.destinationCity),
      isMultiCity: d.isMultiCity,
      packageDurationDays: num(d.packageDurationDays),
      packageDurationNights: num(d.packageDurationNights),
      packageInclusions: Array.isArray(d.packageInclusions) ? d.packageInclusions : undefined,
      startDate: str(d.startDate),
      endDate: str(d.endDate),
      description: str(d.description),
    };
  }
  if (cat === "Ziyarah") {
    return {
      ...pax,
      city: str(d.city),
      ziyarahSites: str(d.ziyarahSites),
      vehicle: str(d.vehicle),
      guideName: str(d.guideName),
      description: str(d.description),
    };
  }
  return { ...pax, description: str(d.description) };
}

function EntriesPage() {
  const store = useStore();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<LedgerEntry | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [form, setForm] = useState({ date: "", type: "client_receive" as LedgerEntry["type"], headId: "", referenceId: "", referenceName: "", amount: "", note: "" });
  const [serviceCategory, setServiceCategory] = useState<string>("");
  // Extra charge / refund metadata
  const [extra, setExtra] = useState({ clientId: "", chargeCategory: "", refundOf: "", refundReason: "" });
  // Purchase allocation: who this supplier purchase was bought for
  const [pf, setPf] = useState({ for: "" as "" | "client" | "agent", agentId: "", clientName: "", saleAmount: "" });
  // Group management (PNR / batch) — for purchase entries
  const [groupMode, setGroupMode] = useState<"none" | "existing" | "new">("none");
  const [groupId, setGroupId] = useState<string>("");
  // Supplier-payment references (who paid / for which agent's business)
  const [refs, setRefs] = useState({ agentId: "", paidBy: "" });
  // Payment instrument details (every money-in / money-out entry)
  const emptyPay = { method: "Cash" as NonNullable<LedgerEntry["paymentMethod"]>, accountId: "", chequeNo: "", chequeDate: "", bankName: "", txnRef: "", collectedBy: "" };
  const [pay, setPay] = useState(emptyPay);
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortOptionKey>("date_desc");
  const [searchQuery, setSearchQuery] = useState("");
  const emptyJv = {
    jvType: "account_transfer" as "account_transfer" | "reconciliation_adjustment" | "party_settlement",
    toAccountId: "",
    targetBalance: "",
    direction: "out" as "in" | "out",
  };
  const [jv, setJv] = useState(emptyJv);
  const [newGroup, setNewGroup] = useState({ name: "", pnr: "", flightNumber: "", date: "", description: "", totalPax: "" });
  const emptyDetails = {
    // Flight / Ticket
    ticketNumber: "",
    pnr: "",
    sector: "",
    tripType: "One Way" as "One Way" | "Round Trip" | "Multi-City",
    departureDate: "",
    returnDate: "",
    multiCityRoute: "",
    airline: "",
    flightNumber: "",
    cabinClass: "Economy",
    // Hotel
    hotelName: "",
    city: "",
    roomType: "Quad",
    mealPlan: "Room Only",
    confirmationNo: "",
    rooms: "",
    perNight: "",
    nights: "",
    checkIn: "",
    checkOut: "",
    // Visa
    visaType: "Umrah",
    country: "Saudi Arabia",
    reference: "",
    applicantNames: "",
    // Transport
    route: "",
    vehicle: "Private Sedan",
    pickupDate: "",
    driverName: "",
    driverPhone: "",
    voucherNo: "",
    // Package (Domestic & International)
    packageName: "",
    packageType: "International" as "Domestic" | "International",
    destinationCountry: "Saudi Arabia",
    destinationCity: "Makkah + Madinah",
    isMultiCity: true,
    packageDurationDays: "",
    packageDurationNights: "",
    packageInclusions: ["Hotel", "Visa", "Transport"] as string[],
    startDate: "",
    endDate: "",
    // Passenger Breakdown (pax)
    adults: "",
    children: "",
    infants: "",
    adultPrice: "",
    childPrice: "",
    infantPrice: "",
    // Ziyarah & Common
    ziyarahSites: "",
    guideName: "",
    description: "",
  };
  const [details, setDetails] = useState<typeof emptyDetails>(emptyDetails);
  const [autoTotal, setAutoTotal] = useState(true);

  const supplierGroups = useMemo(() => {
    if (!form.referenceId) return store.groups;
    return store.groups.filter((g) => !g.supplierId || g.supplierId === form.referenceId);
  }, [store.groups, form.referenceId]);

  // Auto-compute purchase amount when details change (Flight / Hotel / Package / Visa / etc.)
  function computeAutoAmount(cat: string, d: typeof emptyDetails): number | null {
    if (cat === "Hotel") {
      const r = Number(d.rooms) || 0, pn = Number(d.perNight) || 0, n = Number(d.nights) || 0;
      return r > 0 && pn > 0 && n > 0 ? r * pn * n : null;
    }
    // All other categories (Flight/Visa/Package/Transport/Ziyarah/Insurance/Other) use pax pricing
    if (!cat) return null;
    const a = Number(d.adults) || 0, c = Number(d.children) || 0, i = Number(d.infants) || 0;
    const ap = Number(d.adultPrice) || 0, cp = Number(d.childPrice) || 0, ip = Number(d.infantPrice) || 0;
    if (a + c + i + ap + cp + ip === 0) return null;
    return a * ap + c * cp + i * ip;
  }
  function setDetailField<K extends keyof typeof emptyDetails>(k: K, v: any) {
    const next = { ...details, [k]: v };
    setDetails(next);
    if (autoTotal && form.type === "purchase") {
      const auto = computeAutoAmount(serviceCategory, next);
      if (auto !== null) setForm((f) => ({ ...f, amount: String(auto) }));
    }
  }

  /** Entry types that may be tagged to a Group / PNR */
  const groupTaggable = form.type === "purchase" || form.type === "supplier_payment" || form.type === "supplier_refund" || form.type === "expense";

  const filtered = useMemo(() => {
    const list = store.entries
      .filter((e) => typeFilter === "all" || e.type === typeFilter)
      .filter((e) => methodFilter === "all" || (MONEY_TYPES.includes(e.type) && e.paymentMethod === methodFilter))
      .filter((e) => {
        if (accountFilter === "all") return true;
        const acc = store.accounts.find((a) => a.id === accountFilter);
        if (!acc) return true;
        // Enforce opening date boundary: only entries on or after openingDate belong to this account
        if (acc.openingDate && e.date < acc.openingDate) return false;
        return e.accountId === accountFilter || (e.type === "jv" && e.toAccountId === accountFilter);
      })
      .filter((e) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        const idMatch = e.id.toLowerCase().includes(q);
        const headMatch = e.headId?.toLowerCase().includes(q) || false;
        const refMatch = e.referenceName?.toLowerCase().includes(q) || false;
        const noteMatch = e.note?.toLowerCase().includes(q) || false;
        const drawerMatch = e.drawerName?.toLowerCase().includes(q) || false;
        const methodMatch = e.paymentMethod?.toLowerCase().includes(q) || false;
        return idMatch || headMatch || refMatch || noteMatch || drawerMatch || methodMatch;
      });

    return sortEntities(list, sortKey, {
      date: (e) => e.date,
      amount: (e) => e.amount,
      name: (e) => e.referenceName || e.drawerName || e.id,
    });
  }, [store.entries, store.accounts, typeFilter, methodFilter, accountFilter, searchQuery, sortKey]);

  function validatePay(): boolean {
    if (!MONEY_TYPES.includes(form.type)) return true;
    if (!(Number(form.amount) > 0)) { toast.error("Enter an amount"); return false; }
    if (form.type === "jv") {
      if (!pay.accountId) { toast.error("Select the primary/source account"); return false; }
      if (jv.jvType === "account_transfer" && !jv.toAccountId) {
        toast.error("Select the destination account"); return false;
      }
      if (jv.jvType === "account_transfer" && pay.accountId === jv.toAccountId) {
        toast.error("Source and destination accounts must be different"); return false;
      }
      return true;
    }
    if ((form.type === "agent_receive") && !form.referenceId) { toast.error("Select the agent"); return false; }
    if (pay.method === "Cheque" && !pay.chequeNo) { toast.error("Enter the cheque number"); return false; }
    if ((pay.method === "Bank Transfer" || pay.method === "Online / Wallet") && !pay.txnRef) { toast.error("Enter the transaction / reference number"); return false; }
    return true;
  }

  function handleAdd() {
    if (!validatePay()) return;
    let finalGroupId = groupMode === "existing" ? groupId : undefined;
    if (groupMode === "new" && newGroup.name.trim()) {
      finalGroupId = store.addGroup({
        name: newGroup.name.trim(),
        category: serviceCategory || "Other",
        supplierId: form.referenceId || undefined,
        pnr: newGroup.pnr || undefined,
        flightNumber: newGroup.flightNumber || undefined,
        date: newGroup.date || undefined,
        description: newGroup.description || undefined,
        totalPax: newGroup.totalPax ? Number(newGroup.totalPax) : undefined,
      });
    }
    store.addEntry({
      date: form.date || getPKTDate(), type: form.type, headId: form.headId,
      referenceId: form.referenceId, referenceName: form.referenceName,
      amount: Number(form.amount) || 0, note: form.note,
      serviceCategory: serviceCategory || undefined,
      purchaseDetails: form.type === "purchase" ? buildDetailsPayload(serviceCategory, details) : undefined,
      groupId: groupTaggable ? finalGroupId : undefined,
      purchasedFor: form.type === "purchase" ? (pf.for || undefined) : undefined,
      forClientName: form.type === "purchase" && pf.for === "agent" ? (pf.clientName || undefined) : undefined,
      saleAmount: form.type === "purchase" && pf.for === "agent" && pf.saleAmount ? Number(pf.saleAmount) : undefined,
      agentId: form.type === "purchase" && pf.for === "agent" ? (pf.agentId || undefined) : (refs.agentId || undefined),
      paidBy: refs.paidBy || undefined,
      clientId: extra.clientId || undefined,
      drawerId: form.type === "drawing" ? (form.referenceId || undefined) : undefined,
      drawerName: form.type === "drawing" ? (form.referenceName || undefined) : undefined,
      chargeCategory: form.type === "client_charge" || form.type === "drawing" ? (extra.chargeCategory || undefined) : undefined,
      refundOf: extra.refundOf || undefined,
      paymentMethod: MONEY_TYPES.includes(form.type) ? pay.method : undefined,
      accountId: MONEY_TYPES.includes(form.type) ? (pay.accountId || undefined) : undefined,
      chequeNo: MONEY_TYPES.includes(form.type) && pay.method === "Cheque" ? pay.chequeNo || undefined : undefined,
      chequeDate: MONEY_TYPES.includes(form.type) && pay.method === "Cheque" ? pay.chequeDate || undefined : undefined,
      bankName: MONEY_TYPES.includes(form.type) && pay.method !== "Cash" ? pay.bankName || undefined : undefined,
      txnRef: MONEY_TYPES.includes(form.type) && pay.method !== "Cash" ? pay.txnRef || undefined : undefined,
      collectedBy: MONEY_TYPES.includes(form.type) ? pay.collectedBy || undefined : undefined,
      direction: form.type === "jv" ? jv.direction : MONEY_TYPES.includes(form.type) ? entryDirection(form.type) : undefined,
      refundReason: extra.refundReason || undefined,
      jvType: form.type === "jv" ? jv.jvType : undefined,
      toAccountId: form.type === "jv" && jv.jvType === "account_transfer" ? (jv.toAccountId || undefined) : undefined,
      targetBalance: form.type === "jv" && jv.targetBalance ? Number(jv.targetBalance) : undefined,
    });
    setForm({ date: "", type: "client_receive", headId: "", referenceId: "", referenceName: "", amount: "", note: "" });
    setPf({ for: "", agentId: "", clientName: "", saleAmount: "" });
    setServiceCategory("");
    setDetails(emptyDetails);
    setExtra({ clientId: "", chargeCategory: "", refundOf: "", refundReason: "" });
    setGroupMode("none"); setGroupId(""); setNewGroup({ name: "", pnr: "", flightNumber: "", date: "", description: "", totalPax: "" });
    setRefs({ agentId: "", paidBy: "" });
    setPay(emptyPay);
    setJv(emptyJv);
    setAddOpen(false);
  }

  function handleEdit() {
    if (!selected) return;
    if (!validatePay()) return;
    let finalGroupId: string | undefined = groupMode === "existing" ? groupId : groupMode === "none" ? undefined : selected.groupId;
    if (groupMode === "new" && newGroup.name.trim()) {
      finalGroupId = store.addGroup({
        name: newGroup.name.trim(),
        category: serviceCategory || "Other",
        supplierId: form.referenceId || undefined,
        pnr: newGroup.pnr || undefined,
        flightNumber: newGroup.flightNumber || undefined,
        date: newGroup.date || undefined,
        description: newGroup.description || undefined,
        totalPax: newGroup.totalPax ? Number(newGroup.totalPax) : undefined,
      });
    }
    store.updateEntry(selected.id, {
      date: form.date, type: form.type, headId: form.headId,
      referenceId: form.referenceId, referenceName: form.referenceName,
      amount: Number(form.amount) || 0, note: form.note,
      serviceCategory: serviceCategory || undefined,
      purchaseDetails: form.type === "purchase" ? buildDetailsPayload(serviceCategory, details) : undefined,
      groupId: groupTaggable ? finalGroupId : undefined,
      purchasedFor: form.type === "purchase" ? (pf.for || undefined) : undefined,
      forClientName: form.type === "purchase" && pf.for === "agent" ? (pf.clientName || undefined) : undefined,
      saleAmount: form.type === "purchase" && pf.for === "agent" && pf.saleAmount ? Number(pf.saleAmount) : undefined,
      agentId: form.type === "purchase" && pf.for === "agent" ? (pf.agentId || undefined) : (refs.agentId || undefined),
      paidBy: refs.paidBy || undefined,
      clientId: extra.clientId || undefined,
      drawerId: form.type === "drawing" ? (form.referenceId || undefined) : undefined,
      drawerName: form.type === "drawing" ? (form.referenceName || undefined) : undefined,
      chargeCategory: form.type === "client_charge" || form.type === "drawing" ? (extra.chargeCategory || undefined) : undefined,
      refundOf: extra.refundOf || undefined,
      paymentMethod: MONEY_TYPES.includes(form.type) ? pay.method : undefined,
      accountId: MONEY_TYPES.includes(form.type) ? (pay.accountId || undefined) : undefined,
      chequeNo: MONEY_TYPES.includes(form.type) && pay.method === "Cheque" ? pay.chequeNo || undefined : undefined,
      chequeDate: MONEY_TYPES.includes(form.type) && pay.method === "Cheque" ? pay.chequeDate || undefined : undefined,
      bankName: MONEY_TYPES.includes(form.type) && pay.method !== "Cash" ? pay.bankName || undefined : undefined,
      txnRef: MONEY_TYPES.includes(form.type) && pay.method !== "Cash" ? pay.txnRef || undefined : undefined,
      collectedBy: MONEY_TYPES.includes(form.type) ? pay.collectedBy || undefined : undefined,
      direction: form.type === "jv" ? jv.direction : MONEY_TYPES.includes(form.type) ? entryDirection(form.type) : undefined,
      refundReason: extra.refundReason || undefined,
      jvType: form.type === "jv" ? jv.jvType : undefined,
      toAccountId: form.type === "jv" && jv.jvType === "account_transfer" ? (jv.toAccountId || undefined) : undefined,
      targetBalance: form.type === "jv" && jv.targetBalance ? Number(jv.targetBalance) : undefined,
    });
    setEditOpen(false);
  }

  function openEdit(e: LedgerEntry) {
    setSelected(e);
    setForm({ date: e.date, type: e.type, headId: e.headId, referenceId: e.referenceId, referenceName: e.referenceName, amount: String(e.amount), note: e.note });
    setServiceCategory(e.serviceCategory || "");
    setExtra({ clientId: e.clientId || "", chargeCategory: e.chargeCategory || "", refundOf: e.refundOf || "", refundReason: e.refundReason || "" });
    setRefs({ agentId: e.agentId || "", paidBy: e.paidBy || "" });
    setPay({ method: e.paymentMethod || "Cash", accountId: e.accountId || "", chequeNo: e.chequeNo || "", chequeDate: e.chequeDate || "", bankName: e.bankName || "", txnRef: e.txnRef || "", collectedBy: e.collectedBy || "" });
    setJv({
      jvType: e.jvType || "account_transfer",
      toAccountId: e.toAccountId || "",
      targetBalance: e.targetBalance != null ? String(e.targetBalance) : "",
      direction: e.direction || (e.type === "jv" ? "out" : entryDirection(e.type)),
    });
    setPf({ for: e.purchasedFor || "", agentId: e.purchasedFor === "agent" ? e.agentId || "" : "", clientName: e.forClientName || "", saleAmount: e.saleAmount ? String(e.saleAmount) : "" });
    if (e.groupId) { setGroupMode("existing"); setGroupId(e.groupId); } else { setGroupMode("none"); setGroupId(""); }
    setNewGroup({ name: "", pnr: "", flightNumber: "", date: "", description: "", totalPax: "" });
    const d = e.purchaseDetails || {};
    setDetails({
      ticketNumber: d.ticketNumber || "",
      pnr: d.pnr || "",
      sector: d.sector || "",
      tripType: d.tripType || "One Way",
      departureDate: d.departureDate || "",
      returnDate: d.returnDate || "",
      multiCityRoute: d.multiCityRoute || "",
      airline: d.airline || "",
      flightNumber: d.flightNumber || "",
      cabinClass: d.cabinClass || "Economy",
      hotelName: d.hotelName || "",
      city: d.city || "",
      roomType: d.roomType || "Quad",
      mealPlan: d.mealPlan || "Room Only",
      confirmationNo: d.confirmationNo || "",
      rooms: d.rooms != null ? String(d.rooms) : "",
      perNight: d.perNight != null ? String(d.perNight) : "",
      nights: d.nights != null ? String(d.nights) : "",
      checkIn: d.checkIn || "",
      checkOut: d.checkOut || "",
      visaType: d.visaType || "Umrah",
      country: d.country || "Saudi Arabia",
      reference: d.reference || "",
      applicantNames: d.applicantNames || "",
      route: d.route || "",
      vehicle: d.vehicle || "Private Sedan",
      pickupDate: d.pickupDate || "",
      driverName: d.driverName || "",
      driverPhone: d.driverPhone || "",
      voucherNo: d.voucherNo || "",
      packageName: d.packageName || "",
      packageType: d.packageType || "International",
      destinationCountry: d.destinationCountry || "Saudi Arabia",
      destinationCity: d.destinationCity || "Makkah + Madinah",
      isMultiCity: d.isMultiCity ?? true,
      packageDurationDays: d.packageDurationDays != null ? String(d.packageDurationDays) : "",
      packageDurationNights: d.packageDurationNights != null ? String(d.packageDurationNights) : "",
      packageInclusions: d.packageInclusions || ["Hotel", "Visa", "Transport"],
      startDate: d.startDate || "",
      endDate: d.endDate || "",
      adults: d.adults != null ? String(d.adults) : "",
      children: d.children != null ? String(d.children) : "",
      infants: d.infants != null ? String(d.infants) : "",
      adultPrice: d.adultPrice != null ? String(d.adultPrice) : "",
      childPrice: d.childPrice != null ? String(d.childPrice) : "",
      infantPrice: d.infantPrice != null ? String(d.infantPrice) : "",
      ziyarahSites: d.ziyarahSites || "",
      guideName: d.guideName || "",
      description: d.description || "",
    });
    setAutoTotal(false);
    setEditOpen(true);
  }

  const totalReceived = store.entries.filter((e) => e.type === "client_receive" || e.type === "agent_receive").reduce((s, e) => s + e.amount, 0)
    - store.entries.filter((e) => e.type === "client_refund").reduce((s, e) => s + e.amount, 0);
  const totalPaid = store.entries.filter((e) => e.type === "supplier_payment" || e.type === "agent_commission" || e.type === "expense" || e.type === "drawing").reduce((s, e) => s + e.amount, 0)
    - store.entries.filter((e) => e.type === "supplier_refund").reduce((s, e) => s + e.amount, 0);
  const totalPurchases = store.entries.filter((e) => e.type === "purchase").reduce((s, e) => s + e.amount, 0);

  // Auto-populate reference name when type or referenceId changes
  function updateFormType(type: LedgerEntry["type"]) {
    setForm({ ...form, type, referenceId: "", referenceName: "", headId: "" });
    setExtra({ clientId: "", chargeCategory: "", refundOf: "", refundReason: "" });
    setRefs({ agentId: "", paidBy: "" });
    setGroupMode("none"); setGroupId("");
  }

  function updateReferenceId(refId: string) {
    let name = "";
    if (form.type === "client_receive" || form.type === "client_charge" || form.type === "client_refund" || form.type === "client_discount") {
      const booking = store.bookings.find((b) => b.headId === refId);
      if (booking) {
        const headClient = store.clients.find((c) => c.headId === refId);
        name = headClient ? getClientName(headClient) : refId;
      }
      setForm({ ...form, referenceId: refId, referenceName: name || form.referenceName, headId: refId });
      setExtra((x) => ({ ...x, clientId: "" }));
    } else if (form.type === "supplier_payment" || form.type === "purchase" || form.type === "supplier_refund" || form.type === "supplier_discount") {
      const supplier = store.suppliers.find((s) => s.id === refId);
      name = supplier?.companyName || "";
      setForm({ ...form, referenceId: refId, referenceName: name || form.referenceName });
    } else if (form.type === "agent_commission" || form.type === "agent_receive") {
      const agent = store.agents.find((a) => a.id === refId);
      name = agent?.name || "";
      setForm({ ...form, referenceId: refId, referenceName: name || form.referenceName });
    } else {
      setForm({ ...form, referenceId: refId });
    }
  }

  const formFields = (
    <div className="space-y-4">
      <div><Label>Entry Type</Label>
        <Select value={form.type} onValueChange={(v) => updateFormType(v as LedgerEntry["type"])}>
          <SelectTrigger className="bg-accent/20 border-border mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="client_receive">Client Payment Received</SelectItem>
            <SelectItem value="purchase">Purchase from Supplier</SelectItem>
            <SelectItem value="supplier_payment">Supplier Payment</SelectItem>
            <SelectItem value="agent_commission">Agent Commission</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
            <SelectItem value="client_charge">Extra Charge to Client (Embassy / Service Fee)</SelectItem>
            <SelectItem value="client_refund">Refund to Client</SelectItem>
            <SelectItem value="client_discount">Client Discount / Concession (Reduces Client Due)</SelectItem>
            <SelectItem value="supplier_refund">Refund from Supplier</SelectItem>
            <SelectItem value="supplier_discount">Supplier Discount / Rebate (Reduces Payable)</SelectItem>
            <SelectItem value="agent_receive">Agent Payment Received</SelectItem>
            <SelectItem value="drawing">Owner / Partner Drawing</SelectItem>
            <SelectItem value="jv">Journal Voucher (JV) / Account Settlement</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="bg-accent/20 border-border mt-1" /></div>

      {form.type === "jv" && (
        <div className="space-y-4 rounded-xl border border-primary/40 bg-primary/5 p-4">
          <div className="flex items-center justify-between border-b border-primary/20 pb-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <ArrowRightLeft className="h-3.5 w-3.5" />
                Journal Voucher (JV) & Settlement
              </p>
              <p className="text-[11px] text-muted-foreground">Transfer between accounts, reconcile balances, or adjust missing figures.</p>
            </div>
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">Double-Entry</span>
          </div>

          <div>
            <Label className="text-xs">Settlement Type</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                type="button"
                onClick={() => setJv({ ...jv, jvType: "account_transfer", direction: "out" })}
                className={`rounded-lg border p-2 text-xs text-left transition-colors flex items-center gap-2 ${
                  jv.jvType === "account_transfer"
                    ? "border-primary bg-primary/15 font-semibold text-foreground shadow-sm"
                    : "border-border/60 bg-accent/10 text-muted-foreground hover:bg-accent/20"
                }`}
              >
                <ArrowRightLeft className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="font-semibold text-foreground">Account Transfer</p>
                  <p className="text-[10px] text-muted-foreground">Move funds from A to B</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setJv({ ...jv, jvType: "reconciliation_adjustment" })}
                className={`rounded-lg border p-2 text-xs text-left transition-colors flex items-center gap-2 ${
                  jv.jvType === "reconciliation_adjustment"
                    ? "border-primary bg-primary/15 font-semibold text-foreground shadow-sm"
                    : "border-border/60 bg-accent/10 text-muted-foreground hover:bg-accent/20"
                }`}
              >
                <Calculator className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="font-semibold text-foreground">Find Missing Figure</p>
                  <p className="text-[10px] text-muted-foreground">Reconcile & balance cash/bank</p>
                </div>
              </button>
            </div>
          </div>

          {jv.jvType === "account_transfer" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">From Account (Source Outflow)</Label>
                  <SearchableSelect
                    value={pay.accountId}
                    onChange={(v) => setPay({ ...pay, accountId: v })}
                    placeholder="Select source account..."
                    options={store.accounts.map((a) => ({
                      value: a.id,
                      label: `${a.name} (${a.type})`,
                      hint: `Bal: ${formatCurrency(computeAccountBalance(a.id))}`,
                    }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">To Account (Destination Inflow)</Label>
                  <SearchableSelect
                    value={jv.toAccountId}
                    onChange={(v) => setJv({ ...jv, toAccountId: v })}
                    placeholder="Select destination account..."
                    options={store.accounts.filter((a) => a.id !== pay.accountId).map((a) => ({
                      value: a.id,
                      label: `${a.name} (${a.type})`,
                      hint: `Bal: ${formatCurrency(computeAccountBalance(a.id))}`,
                    }))}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label className="text-[10px]">Transfer Instrument / Channel</Label>
                <div className="grid grid-cols-4 gap-1 rounded-md border border-border bg-accent/10 p-1 mt-1">
                  {METHODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPay({ ...pay, method: m })}
                      className={`rounded px-1 py-1 text-[10px] font-semibold ${
                        pay.method === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {pay.method !== "Cash" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px]">Reference / Cheque No / Slip No</Label>
                    <Input
                      value={pay.txnRef || pay.chequeNo}
                      onChange={(e) => setPay({ ...pay, txnRef: e.target.value, chequeNo: e.target.value })}
                      placeholder="e.g. Deposit Slip 48291"
                      className="bg-accent/20 border-border mt-1 h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Transferred / Handled By</Label>
                    <Input
                      value={pay.collectedBy}
                      onChange={(e) => setPay({ ...pay, collectedBy: e.target.value })}
                      placeholder="Staff / manager name"
                      className="bg-accent/20 border-border mt-1 h-8 text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {jv.jvType === "reconciliation_adjustment" && (
            <div className="space-y-3 rounded-lg border border-primary/20 bg-background/60 p-3 text-xs">
              <div>
                <Label className="text-xs">Account to Balance & Reconcile</Label>
                <SearchableSelect
                  value={pay.accountId}
                  onChange={(v) => setPay({ ...pay, accountId: v })}
                  placeholder="Select account..."
                  options={store.accounts.map((a) => ({
                    value: a.id,
                    label: `${a.name} (${a.type})`,
                    hint: `System: ${formatCurrency(computeAccountBalance(a.id))}`,
                  }))}
                  className="mt-1"
                />
              </div>

              {pay.accountId && (() => {
                const sysBal = computeAccountBalance(pay.accountId);
                const targetBal = jv.targetBalance !== "" ? Number(jv.targetBalance) : null;
                const diff = targetBal !== null ? targetBal - sysBal : 0;
                return (
                  <div className="space-y-2.5 border-t border-border/50 pt-2.5">
                    <div className="flex items-center justify-between text-xs rounded-md bg-accent/20 p-2">
                      <span className="text-muted-foreground">Current System Balance:</span>
                      <strong className="text-foreground font-mono text-sm">{formatCurrency(sysBal)}</strong>
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Actual Physical / Counted Balance (PKR)</Label>
                        <span className="text-[10px] text-muted-foreground">Enter physical count or bank statement</span>
                      </div>
                      <Input
                        type="number"
                        value={jv.targetBalance}
                        onChange={(e) => setJv({ ...jv, targetBalance: e.target.value })}
                        placeholder={`e.g. ${sysBal}`}
                        className="bg-accent/20 border-border mt-1 h-8 text-xs font-mono font-bold"
                      />
                    </div>

                    {jv.targetBalance !== "" && (
                      <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-foreground">Calculated Missing Figure:</span>
                          <span className={`text-sm font-bold font-mono ${diff >= 0 ? "text-success" : "text-destructive"}`}>
                            {diff >= 0 ? `+${formatCurrency(diff)} (Missing Inflow)` : `${formatCurrency(diff)} (Missing Outflow)`}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {diff > 0
                            ? "System was short — an inflow adjustment of this missing amount will bring the balance to your target."
                            : diff < 0
                            ? "System had excess — an outflow adjustment of this missing amount will bring the balance to your target."
                            : "System balance already matches your counted figure perfectly!"}
                        </p>

                        {diff !== 0 && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              setForm({
                                ...form,
                                amount: String(Math.abs(diff)),
                                note: `Reconciliation adjustment: balanced to target ${formatCurrency(Number(jv.targetBalance))}. Missing figure of ${formatCurrency(Math.abs(diff))} posted.`,
                                referenceName: "Account Reconciliation",
                              });
                              setJv({ ...jv, direction: diff > 0 ? "in" : "out" });
                              toast.success(`Missing figure of ${formatCurrency(Math.abs(diff))} auto-filled into entry!`);
                            }}
                            className="w-full h-8 text-xs font-semibold gap-2 mt-1"
                          >
                            <Calculator className="h-3.5 w-3.5" />
                            Auto-Fill Missing Figure ({formatCurrency(Math.abs(diff))})
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {form.type === "client_receive" && (
        <div><Label>Head ID</Label>
          <SearchableSelect
            value={form.headId}
            onChange={(v) => updateReferenceId(v)}
            placeholder="Search Head ID..."
            options={store.bookings.map((b) => ({
              value: b.headId,
              label: `${b.headId} — ${b.packageType}`,
              hint: `${b.travelDate} · ${formatCurrency(b.totalAmount)}`,
            }))}
            className="mt-1"
          />
        </div>
      )}

      {(form.type === "client_charge" || form.type === "client_refund") && (
        <div className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
            {form.type === "client_charge" ? "Charge Details" : "Client Refund Details"}
          </p>
          <div><Label className="text-[10px]">Head ID (Booking)</Label>
            <SearchableSelect
              value={form.headId}
              onChange={(v) => updateReferenceId(v)}
              placeholder="Search Head ID..."
              options={store.bookings.map((b) => ({
                value: b.headId,
                label: `${b.headId} — ${b.packageType}`,
                hint: `${b.travelDate} · ${formatCurrency(b.totalAmount)}`,
              }))}
              className="mt-1"
            />
          </div>
          <div><Label className="text-[10px]">Member (optional — defaults to head member)</Label>
            <SearchableSelect
              value={extra.clientId}
              onChange={(v) => {
                const c = store.clients.find((x) => x.id === v);
                setExtra({ ...extra, clientId: v });
                if (c) setForm((f) => ({ ...f, referenceName: getClientName(c) }));
              }}
              placeholder={form.headId ? "Select member..." : "Select a Head ID first"}
              options={store.clients.filter((c) => c.headId === form.headId).map((c) => ({
                value: c.id,
                label: `${c.id} — ${getClientName(c)}`,
                hint: `${c.ageCategory || "Adult"} · Due ${formatCurrency(c.amountDue)}`,
              }))}
              className="mt-1"
            />
          </div>
          {form.type === "client_charge" ? (
            <div><Label className="text-[10px]">Charge Type</Label>
              <Select value={extra.chargeCategory} onValueChange={(v) => setExtra({ ...extra, chargeCategory: v })}>
                <SelectTrigger className="bg-accent/20 border-border mt-1 h-8 text-xs"><SelectValue placeholder="Embassy fee / Visa fee / Other" /></SelectTrigger>
                <SelectContent>{CHARGE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
              <p className="mt-1 text-[10px] text-muted-foreground">This amount is added to the member's due and to the booking total automatically.</p>
            </div>
          ) : (
            <>
              <div><Label className="text-[10px]">Refund Against (optional)</Label>
                <SearchableSelect
                  value={extra.refundOf}
                  onChange={(v) => setExtra({ ...extra, refundOf: v })}
                  placeholder="Link to the original receipt..."
                  options={store.entries.filter((e) => e.type === "client_receive" && (!form.headId || e.headId === form.headId)).map((e) => ({
                    value: e.id, label: `${e.id} — ${formatCurrency(e.amount)}`, hint: `${e.date} · ${e.referenceName}`,
                  }))}
                  className="mt-1"
                />
              </div>
              <div><Label className="text-[10px]">Reason</Label><Input value={extra.refundReason} onChange={(e) => setExtra({ ...extra, refundReason: e.target.value })} placeholder="Visa rejected / trip cancelled..." className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
              <p className="text-[10px] text-muted-foreground">Refunds are deducted from the head's received amount everywhere.</p>
            </>
          )}
        </div>
      )}

      {form.type === "client_discount" && (
        <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
            Client Discount / Concession Details
          </p>
          <div><Label className="text-[10px]">Head ID (Booking)</Label>
            <SearchableSelect
              value={form.headId}
              onChange={(v) => updateReferenceId(v)}
              placeholder="Search Head ID..."
              options={store.bookings.map((b) => ({
                value: b.headId,
                label: `${b.headId} — ${b.packageType}`,
                hint: `${b.travelDate} · Net: ${formatCurrency(b.totalAmount)}`,
              }))}
              className="mt-1"
            />
          </div>
          <div><Label className="text-[10px]">Specific Member (optional — leaves unassigned to lead)</Label>
            <SearchableSelect
              value={extra.clientId}
              onChange={(v) => {
                const c = store.clients.find((x) => x.id === v);
                setExtra({ ...extra, clientId: v });
                if (c) setForm((f) => ({ ...f, referenceName: getClientName(c) }));
              }}
              placeholder={form.headId ? "Select member..." : "Select a Head ID first"}
              options={store.clients.filter((c) => c.headId === form.headId).map((c) => ({
                value: c.id,
                label: `${c.id} — ${getClientName(c)}`,
                hint: `${c.ageCategory || "Adult"} · Due ${formatCurrency(c.amountDue)}`,
              }))}
              className="mt-1"
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            This concession directly reduces the client's balance due and the booking total sale without requiring physical cash withdrawal.
          </p>
        </div>
      )}

      {form.type === "supplier_discount" && (
        <div className="space-y-3 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
            Supplier Discount / Rebate Details
          </p>
          <div><Label className="text-[10px]">Supplier</Label>
            <SearchableSelect
              value={form.referenceId}
              onChange={(v) => updateReferenceId(v)}
              placeholder="Search Supplier..."
              options={store.suppliers.map((s) => ({ value: s.id, label: `${s.id} — ${s.companyName}`, hint: s.serviceType }))}
              className="mt-1"
            />
          </div>
          <div><Label className="text-[10px]">Link to Booking / Head ID (optional)</Label>
            <SearchableSelect
              value={form.headId}
              onChange={(v) => setForm({ ...form, headId: v })}
              placeholder="Tag rebate to a specific booking..."
              options={store.bookings.map((b) => ({ value: b.headId, label: `${b.headId} — ${b.packageType}`, hint: b.travelDate }))}
              className="mt-1"
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Rebates and volume discounts directly reduce your Accounts Payable to this supplier and lower your cost of sales.
          </p>
        </div>
      )}

      {form.type === "supplier_refund" && (
        <div className="space-y-3 rounded-lg border border-success/40 bg-success/5 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-success">Supplier Refund Details</p>
          <div><Label className="text-[10px]">Supplier</Label>
            <SearchableSelect
              value={form.referenceId}
              onChange={(v) => updateReferenceId(v)}
              placeholder="Search Supplier..."
              options={store.suppliers.map((s) => ({ value: s.id, label: `${s.id} — ${s.companyName}`, hint: s.serviceType }))}
              className="mt-1"
            />
          </div>
          <div><Label className="text-[10px]">Refund Against Purchase (optional)</Label>
            <SearchableSelect
              value={extra.refundOf}
              onChange={(v) => setExtra({ ...extra, refundOf: v })}
              placeholder="Select the original purchase..."
              options={store.entries.filter((e) => e.type === "purchase" && (!form.referenceId || e.referenceId === form.referenceId)).map((e) => ({
                value: e.id,
                label: `${e.id} — ${formatCurrency(e.amount)}`,
                hint: [e.date, e.serviceCategory, e.headId].filter(Boolean).join(" · "),
              }))}
              className="mt-1"
            />
          </div>
          <div><Label className="text-[10px]">Link to Head ID (optional)</Label>
            <SearchableSelect
              value={form.headId}
              onChange={(v) => setForm({ ...form, headId: v })}
              placeholder="Tag this refund to a booking..."
              options={store.bookings.map((b) => ({ value: b.headId, label: `${b.headId} — ${b.packageType}`, hint: b.travelDate }))}
              className="mt-1"
            />
          </div>
          <div><Label className="text-[10px]">Reason</Label><Input value={extra.refundReason} onChange={(e) => setExtra({ ...extra, refundReason: e.target.value })} placeholder="Cancelled ticket / unused room night..." className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
          <p className="text-[10px] text-muted-foreground">This credit reduces the supplier's payable in statements automatically.</p>
        </div>
      )}

      {(form.type === "supplier_payment" || form.type === "purchase") && (
        <div className="space-y-3">
          <div><Label>Supplier</Label>
          <SearchableSelect
            value={form.referenceId}
            onChange={(v) => updateReferenceId(v)}
            placeholder="Search Supplier..."
            options={store.suppliers.map((s) => ({
              value: s.id,
              label: `${s.id} — ${s.companyName}`,
              hint: s.serviceType,
            }))}
            className="mt-1"
          />
          </div>
          {form.type === "supplier_payment" && (
            <div className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Payment Reference (who / where it belongs)</p>
              <div><Label className="text-[10px]">Group / PNR (optional)</Label>
                <SearchableSelect
                  value={groupMode === "existing" ? groupId : ""}
                  onChange={(v) => { setGroupMode(v ? "existing" : "none"); setGroupId(v); }}
                  placeholder={supplierGroups.length ? "Pay against a group..." : "No groups yet"}
                  options={supplierGroups.map((g) => ({
                    value: g.id,
                    label: `${g.id} — ${g.name}`,
                    hint: [g.category, g.pnr && `PNR ${g.pnr}`, g.date].filter(Boolean).join(" · "),
                  }))}
                  className="mt-1"
                />
                {(() => {
                  const sel = groupMode === "existing" ? store.groups.find((g) => g.id === groupId) : null;
                  if (!sel) return null;
                  const bill = store.entries.filter((e) => e.type === "purchase" && e.groupId === sel.id).reduce((s, e) => s + e.amount, 0)
                    - store.entries.filter((e) => e.type === "supplier_refund" && e.groupId === sel.id).reduce((s, e) => s + e.amount, 0);
                  const paid = store.entries.filter((e) => e.type === "supplier_payment" && e.groupId === sel.id && e.id !== selected?.id).reduce((s, e) => s + e.amount, 0);
                  const thisPay = Number(form.amount) || 0;
                  const remaining = bill - paid - thisPay;
                  return (
                    <div className="mt-2 flex flex-wrap items-center gap-3 rounded-md bg-accent/20 px-3 py-2 text-[11px]">
                      <span className="text-muted-foreground">Group Bill: <b className="text-foreground">{formatCurrency(bill)}</b></span>
                      <span className="text-muted-foreground">Paid: <b className="text-success">{formatCurrency(paid)}</b></span>
                      <span className="text-muted-foreground">This payment: <b className="text-foreground">{formatCurrency(thisPay)}</b></span>
                      <span className="ml-auto text-muted-foreground">Remaining: <b className={remaining > 0 ? "text-destructive" : "text-success"}>{formatCurrency(remaining)}</b></span>
                    </div>
                  );
                })()}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-[10px]">Agent Reference (optional)</Label>
                  <SearchableSelect
                    value={refs.agentId}
                    onChange={(v) => setRefs({ ...refs, agentId: v })}
                    placeholder="Which agent's business..."
                    options={store.agents.map((a) => ({ value: a.id, label: `${a.id} — ${a.name}`, hint: a.phone }))}
                    className="mt-1"
                  />
                </div>
                <div><Label className="text-[10px]">Head ID (optional)</Label>
                  <SearchableSelect
                    value={form.headId}
                    onChange={(v) => setForm({ ...form, headId: v })}
                    placeholder="Tag to a booking..."
                    options={store.bookings.map((b) => ({ value: b.headId, label: `${b.headId} — ${b.packageType}`, hint: b.travelDate }))}
                    className="mt-1"
                  />
                </div>
              </div>
              <div><Label className="text-[10px]">Paid By / Handed Over By</Label>
                <Input value={refs.paidBy} onChange={(e) => setRefs({ ...refs, paidBy: e.target.value })} placeholder="Office cash / Bank transfer / Agent Ahmed" className="bg-accent/20 border-border mt-1 h-8 text-xs" />
              </div>
              <p className="text-[10px] text-muted-foreground">Group-tagged payments show up in that group's settlement progress, and the agent reference appears in the agent's ledger.</p>
            </div>
          )}
          {form.type === "purchase" && (
            <div className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Purchase For (whose account)</p>
              <div className="grid grid-cols-3 gap-1 rounded-md border border-border bg-accent/10 p-1">
                {([["", "Office / Stock"], ["client", "Client"], ["agent", "Agent"]] as const).map(([v, l]) => (
                  <button key={v} type="button" onClick={() => { setPf({ ...pf, for: v }); if (v !== "client") setForm((f) => ({ ...f, headId: v === "agent" ? "" : f.headId })); }}
                    className={`rounded px-2 py-1.5 text-[11px] font-semibold ${pf.for === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{l}</button>
                ))}
              </div>
              {pf.for === "client" && (
                <>
                  <div><Label className="text-[10px]">Client (Head ID / Name) *</Label>
                    <SearchableSelect value={form.headId} onChange={(v) => { setForm({ ...form, headId: v }); setExtra({ ...extra, clientId: "" }); }}
                      placeholder="Search client head..."
                      options={Array.from(new Map(store.clients.map((c) => [c.headId, c])).values()).map((c) => ({ value: c.headId, label: `${c.headId} — ${getClientName(c)}`, hint: c.id }))}
                      className="mt-1" />
                  </div>
                  {form.headId && (
                    <div><Label className="text-[10px]">Member (optional)</Label>
                      <SearchableSelect value={extra.clientId} onChange={(v) => setExtra({ ...extra, clientId: v })} placeholder="Whole head"
                        options={store.clients.filter((c) => c.headId === form.headId).map((c) => ({ value: c.id, label: `${c.id} — ${getClientName(c)}` }))} className="mt-1" />
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground">Posts to this client's <b>Business Ledger</b> as cost (reduces booking profit). The client's personal balance is <b>not</b> changed.</p>
                </>
              )}
              {pf.for === "agent" && (
                <>
                  <div><Label className="text-[10px]">Agent *</Label>
                    <SearchableSelect value={pf.agentId} onChange={(v) => setPf({ ...pf, agentId: v })} placeholder="Search agent..."
                      options={store.agents.map((a) => ({ value: a.id, label: `${a.id} — ${a.name}` }))} className="mt-1" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-[10px]">Client Name</Label><Input value={pf.clientName} onChange={(e) => setPf({ ...pf, clientName: e.target.value })} placeholder="Passenger / client name" className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
                    <div><Label className="text-[10px]">Sale to Agent (PKR)</Label><Input type="number" value={pf.saleAmount} onChange={(e) => setPf({ ...pf, saleAmount: e.target.value })} placeholder={form.amount || "Same as cost"} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
                  </div>
                  {(() => { const cost = Number(form.amount) || 0; const sale = Number(pf.saleAmount) || cost; return (
                    <div className="flex flex-wrap gap-3 rounded-md bg-accent/20 px-3 py-2 text-[11px]">
                      <span className="text-muted-foreground">Cost: <b className="text-foreground">{formatCurrency(cost)}</b></span>
                      <span className="text-muted-foreground">Other Sale: <b className="text-primary">{formatCurrency(sale)}</b></span>
                      <span className="ml-auto text-muted-foreground">Profit: <b className={sale - cost >= 0 ? "text-success" : "text-destructive"}>{formatCurrency(sale - cost)}</b></span>
                    </div>); })()}
                  <p className="text-[10px] text-muted-foreground">Added to the agent's <b>Other Sale</b> and his Business Ledger receivable.</p>
                </>
              )}
            </div>
          )}
          {form.type === "purchase" && (
            <>
              <div>
                <Label>Service Category</Label>
                <Select
                  value={serviceCategory}
                  onValueChange={(v) => {
                    setServiceCategory(v);
                    const auto = computeAutoAmount(v, details);
                    if (autoTotal && auto !== null) setForm((f) => ({ ...f, amount: String(auto) }));
                  }}
                >
                  <SelectTrigger className="bg-accent/20 border-border mt-1">
                    <SelectValue placeholder="Select Service Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c === "Package" ? "Package (Holiday / Umrah / Tour)" : c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* ---------------- FLIGHT / TICKET DETAILS ---------------- */}
              {serviceCategory === "Flight" && (
                <div className="rounded-xl border border-primary/40 bg-primary/5 p-3.5 space-y-3">
                  <div className="flex items-center justify-between border-b border-primary/20 pb-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                      <Plane className="h-4 w-4" />
                      Flight & Ticket Details
                    </p>
                    <span className="text-[10px] text-muted-foreground">Detailed Airline & PNR Record</span>
                  </div>

                  <div>
                    <Label className="text-[10px]">Trip Type</Label>
                    <div className="grid grid-cols-3 gap-1.5 mt-1">
                      {(["One Way", "Round Trip", "Multi-City"] as const).map((tt) => (
                        <button
                          key={tt}
                          type="button"
                          onClick={() => setDetailField("tripType", tt)}
                          className={`rounded px-2 py-1 text-xs font-medium transition ${
                            details.tripType === tt
                              ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                              : "bg-accent/20 text-muted-foreground hover:bg-accent/40"
                          }`}
                        >
                          {tt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[10px]">Ticket Number *</Label>
                      <Input
                        value={details.ticketNumber}
                        onChange={(e) => setDetailField("ticketNumber", e.target.value)}
                        placeholder="e.g. 214-9847291042"
                        className="bg-accent/20 border-border mt-0.5 h-8 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">PNR / Booking Ref *</Label>
                      <Input
                        value={details.pnr}
                        onChange={(e) => setDetailField("pnr", e.target.value.toUpperCase())}
                        placeholder="e.g. PK-87YTR"
                        className="bg-accent/20 border-border mt-0.5 h-8 text-xs font-mono font-semibold"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Sector / Route *</Label>
                      <Input
                        value={details.sector}
                        onChange={(e) => setDetailField("sector", e.target.value.toUpperCase())}
                        placeholder="e.g. KHI - JED - KHI"
                        className="bg-accent/20 border-border mt-0.5 h-8 text-xs font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[10px]">Airline</Label>
                      <Input
                        value={details.airline}
                        onChange={(e) => setDetailField("airline", e.target.value)}
                        placeholder="Saudia / PIA / Emirates"
                        className="bg-accent/20 border-border mt-0.5 h-8 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Flight Number(s)</Label>
                      <Input
                        value={details.flightNumber}
                        onChange={(e) => setDetailField("flightNumber", e.target.value)}
                        placeholder="SV-701 / SV-702"
                        className="bg-accent/20 border-border mt-0.5 h-8 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Cabin Class</Label>
                      <Select value={details.cabinClass} onValueChange={(v) => setDetailField("cabinClass", v)}>
                        <SelectTrigger className="bg-accent/20 border-border mt-0.5 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["Economy", "Premium Economy", "Business", "First Class"].map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px]">Departure Date</Label>
                      <Input
                        type="date"
                        value={details.departureDate}
                        onChange={(e) => setDetailField("departureDate", e.target.value)}
                        className="bg-accent/20 border-border mt-0.5 h-8 text-xs"
                      />
                    </div>
                    {details.tripType === "Round Trip" && (
                      <div>
                        <Label className="text-[10px]">Return Date</Label>
                        <Input
                          type="date"
                          value={details.returnDate}
                          onChange={(e) => setDetailField("returnDate", e.target.value)}
                          className="bg-accent/20 border-border mt-0.5 h-8 text-xs"
                        />
                      </div>
                    )}
                  </div>

                  {details.tripType === "Multi-City" && (
                    <div>
                      <Label className="text-[10px]">Multi-City Routing Details</Label>
                      <Input
                        value={details.multiCityRoute}
                        onChange={(e) => setDetailField("multiCityRoute", e.target.value)}
                        placeholder="KHI → IST → LHR → DXB → KHI"
                        className="bg-accent/20 border-border mt-0.5 h-8 text-xs"
                      />
                    </div>
                  )}

                  {/* Passenger Breakdown */}
                  <div className="rounded-lg border border-border/50 bg-background/50 p-2.5 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Passenger Breakdown & Fare</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div><Label className="text-[10px]">Adults</Label><Input type="number" min="0" value={details.adults} onChange={(e) => setDetailField("adults", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                      <div><Label className="text-[10px]">Children</Label><Input type="number" min="0" value={details.children} onChange={(e) => setDetailField("children", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                      <div><Label className="text-[10px]">Infants</Label><Input type="number" min="0" value={details.infants} onChange={(e) => setDetailField("infants", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div><Label className="text-[10px]">Adult Rate (PKR)</Label><Input type="number" value={details.adultPrice} onChange={(e) => setDetailField("adultPrice", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                      <div><Label className="text-[10px]">Child Rate (PKR)</Label><Input type="number" value={details.childPrice} onChange={(e) => setDetailField("childPrice", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                      <div><Label className="text-[10px]">Infant Rate (PKR)</Label><Input type="number" value={details.infantPrice} onChange={(e) => setDetailField("infantPrice", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                    </div>
                  </div>
                </div>
              )}

              {/* ---------------- HOTEL DETAILS ---------------- */}
              {serviceCategory === "Hotel" && (
                <div className="rounded-xl border border-primary/40 bg-primary/5 p-3.5 space-y-3">
                  <div className="flex items-center justify-between border-b border-primary/20 pb-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                      <Building2 className="h-4 w-4" />
                      Hotel Booking Details
                    </p>
                    <span className="text-[10px] text-muted-foreground">Rooms & Nightly Rates</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px]">Hotel Name *</Label>
                      <Input
                        value={details.hotelName}
                        onChange={(e) => setDetailField("hotelName", e.target.value)}
                        placeholder="Dar Al Taqwa / Swissotel / Pullman"
                        className="bg-accent/20 border-border mt-0.5 h-8 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">City *</Label>
                      <Input
                        value={details.city}
                        onChange={(e) => setDetailField("city", e.target.value)}
                        placeholder="Makkah / Madinah / Dubai / Istanbul"
                        className="bg-accent/20 border-border mt-0.5 h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[10px]">Room Type</Label>
                      <Select value={details.roomType} onValueChange={(v) => setDetailField("roomType", v)}>
                        <SelectTrigger className="bg-accent/20 border-border mt-0.5 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["Quad (4-Bed)", "Triple (3-Bed)", "Double (2-Bed)", "Single (1-Bed)", "Sharing (Bed-by-Bed)", "Family Suite"].map((r) => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px]">Meal Plan</Label>
                      <Select value={details.mealPlan} onValueChange={(v) => setDetailField("mealPlan", v)}>
                        <SelectTrigger className="bg-accent/20 border-border mt-0.5 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["Room Only (RO)", "Bed & Breakfast (BB)", "Half Board (HB)", "Full Board (FB)", "Sahur / Iftar (Ramadan)"].map((m) => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px]">Confirmation / Voucher #</Label>
                      <Input
                        value={details.confirmationNo}
                        onChange={(e) => setDetailField("confirmationNo", e.target.value)}
                        placeholder="e.g. HTL-98214"
                        className="bg-accent/20 border-border mt-0.5 h-8 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div><Label className="text-[10px]">Number of Rooms *</Label><Input type="number" min="1" value={details.rooms} onChange={(e) => setDetailField("rooms", e.target.value)} placeholder="1" className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                    <div><Label className="text-[10px]">Nights *</Label><Input type="number" min="1" value={details.nights} onChange={(e) => setDetailField("nights", e.target.value)} placeholder="5" className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                    <div><Label className="text-[10px]">Rate Per Night (PKR) *</Label><Input type="number" value={details.perNight} onChange={(e) => setDetailField("perNight", e.target.value)} placeholder="35000" className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-[10px]">Check-in Date</Label><Input type="date" value={details.checkIn} onChange={(e) => setDetailField("checkIn", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                    <div><Label className="text-[10px]">Check-out Date</Label><Input type="date" value={details.checkOut} onChange={(e) => setDetailField("checkOut", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                  </div>
                </div>
              )}

              {/* ---------------- NEW SERVICE: PACKAGE (HOLIDAY / UMRAH / TOURS) ---------------- */}
              {serviceCategory === "Package" && (
                <div className="rounded-xl border border-primary/40 bg-primary/5 p-3.5 space-y-3">
                  <div className="flex items-center justify-between border-b border-primary/20 pb-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                      <Package className="h-4 w-4" />
                      Holiday & Umrah Package Builder
                    </p>
                    <span className="rounded bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">All-in-One Package</span>
                  </div>

                  {/* Domestic vs International */}
                  <div className="space-y-1">
                    <Label className="text-[10px]">Package Scope</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {(["International", "Domestic"] as const).map((ps) => (
                        <button
                          key={ps}
                          type="button"
                          onClick={() => setDetailField("packageType", ps)}
                          className={`rounded-lg border p-2 text-xs text-left transition-colors flex items-center justify-between ${
                            details.packageType === ps
                              ? "border-primary bg-primary/15 font-semibold text-foreground shadow-sm"
                              : "border-border/60 bg-accent/10 text-muted-foreground hover:bg-accent/20"
                          }`}
                        >
                          <span>{ps === "International" ? "✈ International (Umrah / Tours)" : "🏔 Domestic (Pakistan / Northern Areas)"}</span>
                          {details.packageType === ps && <Check className="h-3.5 w-3.5 text-primary" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px]">Destination Country *</Label>
                      <Input
                        value={details.destinationCountry}
                        onChange={(e) => setDetailField("destinationCountry", e.target.value)}
                        placeholder={details.packageType === "Domestic" ? "Pakistan" : "Saudi Arabia / UAE / Turkey / Azerbaijan"}
                        className="bg-accent/20 border-border mt-0.5 h-8 text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">City / Multi-City Combo *</Label>
                      <Input
                        value={details.destinationCity}
                        onChange={(e) => setDetailField("destinationCity", e.target.value)}
                        placeholder="e.g. Makkah + Madinah / Hunza + Skardu / Baku + Gabala"
                        className="bg-accent/20 border-border mt-0.5 h-8 text-xs font-semibold"
                      />
                    </div>
                  </div>

                  {/* Preset Quick Combo Buttons */}
                  <div className="space-y-1">
                    <Label className="text-[9px] text-muted-foreground">Quick City Combos:</Label>
                    <div className="flex flex-wrap gap-1">
                      {(details.packageType === "Domestic"
                        ? ["Hunza + Skardu", "Naran + Kagan + Swat", "Murree + Bhurban", "Gwadar Beach"]
                        : ["Makkah + Madinah", "Dubai + Abu Dhabi", "Istanbul + Antalya", "Baku + Gabala", "Kuala Lumpur + Langkawi", "Bangkok + Phuket"]
                      ).map((combo) => (
                        <button
                          key={combo}
                          type="button"
                          onClick={() => setDetailField("destinationCity", combo)}
                          className="rounded bg-accent/30 hover:bg-accent/60 px-2 py-0.5 text-[10px] text-muted-foreground transition"
                        >
                          + {combo}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <Label className="text-[10px]">Package Title / Name</Label>
                      <Input
                        value={details.packageName}
                        onChange={(e) => setDetailField("packageName", e.target.value)}
                        placeholder="e.g. 15-Day VIP Executive Umrah Package"
                        className="bg-accent/20 border-border mt-0.5 h-8 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Duration (Days)</Label>
                      <Input
                        type="number"
                        min="1"
                        value={details.packageDurationDays}
                        onChange={(e) => setDetailField("packageDurationDays", e.target.value)}
                        placeholder="e.g. 15"
                        className="bg-accent/20 border-border mt-0.5 h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px]">Start Date</Label>
                      <Input
                        type="date"
                        value={details.startDate}
                        onChange={(e) => setDetailField("startDate", e.target.value)}
                        className="bg-accent/20 border-border mt-0.5 h-8 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">End Date</Label>
                      <Input
                        type="date"
                        value={details.endDate}
                        onChange={(e) => setDetailField("endDate", e.target.value)}
                        className="bg-accent/20 border-border mt-0.5 h-8 text-xs"
                      />
                    </div>
                  </div>

                  {/* Package Inclusions Checklist */}
                  <div className="space-y-1.5 border-t border-border/40 pt-2">
                    <Label className="text-[10px]">Package Inclusions</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {["Flight Tickets", "Hotel Accommodation", "Visa Processing", "Private Transport", "Guided Ziyarah", "Daily Breakfast", "Travel Insurance"].map((inc) => {
                        const active = details.packageInclusions.includes(inc);
                        return (
                          <button
                            key={inc}
                            type="button"
                            onClick={() => {
                              const next = active
                                ? details.packageInclusions.filter((x) => x !== inc)
                                : [...details.packageInclusions, inc];
                              setDetailField("packageInclusions", next);
                            }}
                            className={`rounded px-2 py-1 text-[10px] text-left flex items-center justify-between border transition ${
                              active ? "border-primary bg-primary/20 font-semibold text-primary" : "border-border/50 bg-accent/10 text-muted-foreground"
                            }`}
                          >
                            <span>{inc}</span>
                            {active && <Check className="h-3 w-3 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Passenger Breakdown & Rates */}
                  <div className="rounded-lg border border-border/50 bg-background/50 p-2.5 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Passenger Breakdown & Package Rates</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div><Label className="text-[10px]">Adults Count</Label><Input type="number" min="0" value={details.adults} onChange={(e) => setDetailField("adults", e.target.value)} placeholder="2" className="bg-accent/20 border-border mt-0.5 h-8 text-xs font-semibold" /></div>
                      <div><Label className="text-[10px]">Children Count</Label><Input type="number" min="0" value={details.children} onChange={(e) => setDetailField("children", e.target.value)} placeholder="0" className="bg-accent/20 border-border mt-0.5 h-8 text-xs font-semibold" /></div>
                      <div><Label className="text-[10px]">Infants Count</Label><Input type="number" min="0" value={details.infants} onChange={(e) => setDetailField("infants", e.target.value)} placeholder="0" className="bg-accent/20 border-border mt-0.5 h-8 text-xs font-semibold" /></div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div><Label className="text-[10px]">Adult Rate (PKR)</Label><Input type="number" value={details.adultPrice} onChange={(e) => setDetailField("adultPrice", e.target.value)} placeholder="150000" className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                      <div><Label className="text-[10px]">Child Rate (PKR)</Label><Input type="number" value={details.childPrice} onChange={(e) => setDetailField("childPrice", e.target.value)} placeholder="120000" className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                      <div><Label className="text-[10px]">Infant Rate (PKR)</Label><Input type="number" value={details.infantPrice} onChange={(e) => setDetailField("infantPrice", e.target.value)} placeholder="40000" className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                    </div>

                    {(() => {
                      const a = Number(details.adults) || 0, c = Number(details.children) || 0, i = Number(details.infants) || 0;
                      const ap = Number(details.adultPrice) || 0, cp = Number(details.childPrice) || 0, ip = Number(details.infantPrice) || 0;
                      const sum = a * ap + c * cp + i * ip;
                      if (sum === 0) return null;
                      return (
                        <div className="flex items-center justify-between rounded bg-primary/10 px-2 py-1.5 text-xs">
                          <span className="text-muted-foreground">Total Pax: <b>{a + c + i}</b> (Adults: {a}, Child: {c}, Inf: {i})</span>
                          <span className="text-primary font-bold">Auto-Calc Total: {formatCurrency(sum)}</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* ---------------- VISA DETAILS ---------------- */}
              {serviceCategory === "Visa" && (
                <div className="rounded-xl border border-primary/40 bg-primary/5 p-3.5 space-y-3">
                  <div className="flex items-center justify-between border-b border-primary/20 pb-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                      <FileCheck2 className="h-4 w-4" />
                      Visa Processing Details
                    </p>
                    <span className="text-[10px] text-muted-foreground">MOFA / Application Status</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[10px]">Country *</Label>
                      <Input
                        value={details.country}
                        onChange={(e) => setDetailField("country", e.target.value)}
                        placeholder="Saudi Arabia / UAE / Turkey"
                        className="bg-accent/20 border-border mt-0.5 h-8 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Visa Type</Label>
                      <Input
                        value={details.visaType}
                        onChange={(e) => setDetailField("visaType", e.target.value)}
                        placeholder="Umrah eVisa / Tourist / Work"
                        className="bg-accent/20 border-border mt-0.5 h-8 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Reference / MOFA #</Label>
                      <Input
                        value={details.reference}
                        onChange={(e) => setDetailField("reference", e.target.value)}
                        placeholder="e.g. MOFA-89104"
                        className="bg-accent/20 border-border mt-0.5 h-8 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-[10px]">Applicant Names / Passports (comma separated)</Label>
                    <Input
                      value={details.applicantNames}
                      onChange={(e) => setDetailField("applicantNames", e.target.value)}
                      placeholder="e.g. Ali Khan (AB123456), Fatima Bibi (XY789012)"
                      className="bg-accent/20 border-border mt-0.5 h-8 text-xs"
                    />
                  </div>

                  <div className="rounded-lg border border-border/50 bg-background/50 p-2.5 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Visa Pax & Fees</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div><Label className="text-[10px]">Adults</Label><Input type="number" min="0" value={details.adults} onChange={(e) => setDetailField("adults", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                      <div><Label className="text-[10px]">Children</Label><Input type="number" min="0" value={details.children} onChange={(e) => setDetailField("children", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                      <div><Label className="text-[10px]">Infants</Label><Input type="number" min="0" value={details.infants} onChange={(e) => setDetailField("infants", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div><Label className="text-[10px]">Adult Visa Fee (PKR)</Label><Input type="number" value={details.adultPrice} onChange={(e) => setDetailField("adultPrice", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                      <div><Label className="text-[10px]">Child Visa Fee (PKR)</Label><Input type="number" value={details.childPrice} onChange={(e) => setDetailField("childPrice", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                      <div><Label className="text-[10px]">Infant Visa Fee (PKR)</Label><Input type="number" value={details.infantPrice} onChange={(e) => setDetailField("infantPrice", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                    </div>
                  </div>
                </div>
              )}

              {/* ---------------- TRANSPORT DETAILS ---------------- */}
              {serviceCategory === "Transport" && (
                <div className="rounded-xl border border-primary/40 bg-primary/5 p-3.5 space-y-3">
                  <div className="flex items-center justify-between border-b border-primary/20 pb-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                      <Bus className="h-4 w-4" />
                      Transport & Transfer Details
                    </p>
                    <span className="text-[10px] text-muted-foreground">Vehicles & Routes</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px]">Route *</Label>
                      <Input
                        value={details.route}
                        onChange={(e) => setDetailField("route", e.target.value)}
                        placeholder="JED Airport → Makkah → Madinah → MED"
                        className="bg-accent/20 border-border mt-0.5 h-8 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Vehicle Type *</Label>
                      <Input
                        value={details.vehicle}
                        onChange={(e) => setDetailField("vehicle", e.target.value)}
                        placeholder="GMC Yukon / Sedan / Coaster / Bus 49"
                        className="bg-accent/20 border-border mt-0.5 h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[10px]">Pickup Date & Time</Label>
                      <Input
                        value={details.pickupDate}
                        onChange={(e) => setDetailField("pickupDate", e.target.value)}
                        placeholder="2026-04-10 14:00"
                        className="bg-accent/20 border-border mt-0.5 h-8 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Driver Name & Phone</Label>
                      <Input
                        value={details.driverName}
                        onChange={(e) => setDetailField("driverName", e.target.value)}
                        placeholder="Tariq (+966-50...)"
                        className="bg-accent/20 border-border mt-0.5 h-8 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Voucher / Booking #</Label>
                      <Input
                        value={details.voucherNo}
                        onChange={(e) => setDetailField("voucherNo", e.target.value)}
                        placeholder="TR-7821"
                        className="bg-accent/20 border-border mt-0.5 h-8 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ---------------- ZIYARAH / INSURANCE / OTHER DETAILS ---------------- */}
              {(serviceCategory === "Ziyarah" || serviceCategory === "Insurance" || serviceCategory === "Other") && (
                <div className="rounded-xl border border-primary/40 bg-primary/5 p-3.5 space-y-3">
                  <div className="flex items-center justify-between border-b border-primary/20 pb-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                      <Compass className="h-4 w-4" />
                      {serviceCategory} Details
                    </p>
                  </div>

                  {serviceCategory === "Ziyarah" && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px]">City</Label>
                        <Input
                          value={details.city}
                          onChange={(e) => setDetailField("city", e.target.value)}
                          placeholder="Makkah / Madinah / Taif"
                          className="bg-accent/20 border-border mt-0.5 h-8 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">Sites / Route</Label>
                        <Input
                          value={details.ziyarahSites}
                          onChange={(e) => setDetailField("ziyarahSites", e.target.value)}
                          placeholder="Cave Hira, Jabal Thawr, Uhud, Quba"
                          className="bg-accent/20 border-border mt-0.5 h-8 text-xs"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <Label className="text-[10px]">Description & Special Notes</Label>
                    <Input
                      value={details.description}
                      onChange={(e) => setDetailField("description", e.target.value)}
                      placeholder="Additional details..."
                      className="bg-accent/20 border-border mt-0.5 h-8 text-xs"
                    />
                  </div>

                  {/* Pax breakdown */}
                  <div className="grid grid-cols-3 gap-2">
                    <div><Label className="text-[10px]">Adults</Label><Input type="number" min="0" value={details.adults} onChange={(e) => setDetailField("adults", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                    <div><Label className="text-[10px]">Children</Label><Input type="number" min="0" value={details.children} onChange={(e) => setDetailField("children", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                    <div><Label className="text-[10px]">Infants</Label><Input type="number" min="0" value={details.infants} onChange={(e) => setDetailField("infants", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                  </div>
                </div>
              )}
              <div><Label>Link to Head ID (optional)</Label>
                <SearchableSelect
                  value={form.headId}
                  onChange={(v) => setForm({ ...form, headId: v })}
                  placeholder="Tag this purchase to a booking..."
                  options={store.bookings.map((b) => ({ value: b.headId, label: `${b.headId} — ${b.packageType}`, hint: b.travelDate }))}
                  className="mt-1"
                />
              </div>
              {/* --- Group / PNR management --- */}
              <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Group / PNR</p>
                  <div className="flex gap-1 text-[10px]">
                    {(["none","existing","new"] as const).map((m) => (
                      <button key={m} type="button" onClick={() => setGroupMode(m)}
                        className={`rounded px-2 py-1 font-medium transition ${groupMode === m ? "bg-primary text-primary-foreground" : "bg-accent/40 text-muted-foreground hover:bg-accent/60"}`}>
                        {m === "none" ? "Custom (No group)" : m === "existing" ? "Add to Group" : "+ New Group"}
                      </button>
                    ))}
                  </div>
                </div>
                {groupMode === "existing" && (
                  <div className="space-y-2">
                    <SearchableSelect
                      value={groupId}
                      onChange={setGroupId}
                      placeholder={supplierGroups.length ? "Select existing group..." : "No groups yet — create a new one"}
                      options={supplierGroups.map((g) => {
                        const u = computeGroupUsedPax(g.id);
                        const cap = g.totalPax != null ? ` · ${u}/${g.totalPax} used` : ` · ${u} used`;
                        return {
                          value: g.id,
                          label: `${g.id} — ${g.name}`,
                          hint: [g.category, g.pnr && `PNR ${g.pnr}`, g.flightNumber, g.date].filter(Boolean).join(" · ") + cap,
                        };
                      })}
                      className="mt-1"
                    />
                    {(() => {
                      const sel = supplierGroups.find((g) => g.id === groupId);
                      if (!sel) return null;
                      const used = computeGroupUsedPax(sel.id);
                      const req = (Number(details.adults) || 0) + (Number(details.children) || 0) + (Number(details.infants) || 0);
                      const remaining = sel.totalPax != null ? Math.max(0, sel.totalPax - used) : null;
                      const overflow = sel.totalPax != null && (used + req) > sel.totalPax;
                      return (
                        <div className={`flex flex-wrap items-center gap-3 rounded-md px-3 py-2 text-[11px] ${overflow ? "bg-destructive/15 text-destructive" : "bg-accent/20 text-foreground"}`}>
                          <span>Capacity:</span>
                          <span className="font-semibold">{sel.totalPax ?? "∞"}</span>
                          <span className="text-muted-foreground">Used: <b className="text-foreground">{used}</b></span>
                          {remaining !== null && <span className="text-muted-foreground">Remaining: <b className={overflow ? "text-destructive" : "text-success"}>{remaining}</b></span>}
                          <span className="ml-auto text-muted-foreground">This entry: <b className="text-foreground">{req}</b></span>
                        </div>
                      );
                    })()}
                  </div>
                )}
                {groupMode === "new" && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div><Label className="text-[10px]">Group Name</Label><Input value={newGroup.name} onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })} placeholder="Umrah Group Feb-26 / PK-234 Batch" className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                      <div><Label className="text-[10px]">Total Persons (capacity)</Label><Input type="number" min="0" value={newGroup.totalPax} onChange={(e) => setNewGroup({ ...newGroup, totalPax: e.target.value })} placeholder="e.g. 30" className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div><Label className="text-[10px]">PNR</Label><Input value={newGroup.pnr} onChange={(e) => setNewGroup({ ...newGroup, pnr: e.target.value })} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                      <div><Label className="text-[10px]">Flight / Ref #</Label><Input value={newGroup.flightNumber} onChange={(e) => setNewGroup({ ...newGroup, flightNumber: e.target.value })} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                      <div><Label className="text-[10px]">Date</Label><Input type="date" value={newGroup.date} onChange={(e) => setNewGroup({ ...newGroup, date: e.target.value })} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                    </div>
                    <div><Label className="text-[10px]">Description</Label><Input value={newGroup.description} onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {form.type === "agent_commission" && (
        <div><Label>Agent</Label>
          <SearchableSelect
            value={form.referenceId}
            onChange={(v) => updateReferenceId(v)}
            placeholder="Search Agent..."
            options={store.agents.map((a) => ({
              value: a.id,
              label: `${a.id} — ${a.name}`,
              hint: a.phone,
            }))}
            className="mt-1"
          />
        </div>
      )}

      {form.type === "expense" && (
        <div><Label>Expense Name</Label><Input value={form.referenceName} onChange={(e) => setForm({ ...form, referenceName: e.target.value })} placeholder="Office Rent, Utilities..." className="bg-accent/20 border-border mt-1" /></div>
      )}

      {form.type === "agent_receive" && (
        <div className="space-y-3 rounded-lg border border-success/40 bg-success/5 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-success">Payment received from agent</p>
          <div><Label className="text-[10px]">Agent *</Label>
            <SearchableSelect value={form.referenceId} onChange={(v) => updateReferenceId(v)} placeholder="Search Agent..."
              options={store.agents.map((a) => ({ value: a.id, label: `${a.id} — ${a.name}`, hint: a.phone }))} className="mt-1" />
          </div>
          {form.referenceId && (
            <div><Label className="text-[10px]">Against Head ID (optional)</Label>
              <SearchableSelect value={form.headId} onChange={(v) => setForm({ ...form, headId: v })} placeholder="General / on-account"
                options={store.bookings.filter((b) => b.agentId === form.referenceId).map((b) => ({ value: b.headId, label: `${b.headId} — ${b.packageType}`, hint: b.travelDate }))} className="mt-1" />
            </div>
          )}
          <p className="text-[10px] text-muted-foreground">Reduces the agent's Business Account remaining balance. Shows in his statement under Receipts.</p>
        </div>
      )}

      {form.type === "drawing" && (
        <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-destructive">Owner / Partner Drawing</p>
            <span className="text-[10px] text-muted-foreground">Linked to Partner Equity</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Select Registered Partner / Drawer *</Label>
              <SearchableSelect
                value={form.referenceId}
                onChange={(v) => {
                  const d = store.drawers.find((x) => x.id === v);
                  setForm({ ...form, referenceId: v, referenceName: d?.name || form.referenceName });
                }}
                placeholder="Select registered partner..."
                options={store.drawers.map((d) => ({
                  value: d.id,
                  label: `${d.name} (${d.sharePercent || 0}% Equity)`,
                  hint: d.role || d.phone || d.id,
                }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-[10px]">Or Partner Name (manual / new)</Label>
              <Input
                value={form.referenceName}
                onChange={(e) => setForm({ ...form, referenceName: e.target.value })}
                placeholder="Partner / Drawer Name"
                className="bg-accent/20 border-border mt-1 h-8 text-xs font-medium"
              />
            </div>
          </div>
          <div>
            <Label className="text-[10px]">Purpose / Withdrawal Category</Label>
            <Input
              value={extra.chargeCategory}
              onChange={(e) => setExtra({ ...extra, chargeCategory: e.target.value })}
              placeholder="e.g. Monthly Partner Drawing, Personal Expense, Profit Distribution"
              className="bg-accent/20 border-border mt-1 h-8 text-xs"
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            A drawing is not an expense — it does not reduce business operational profit, it reduces cash/bank balances and the partner's equity. See partner-wise cards in Accounts.
          </p>
        </div>
      )}

      {MONEY_TYPES.includes(form.type) && form.type !== "jv" && (
        <div className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">{entryDirection(form.type) === "in" ? "Received In — payment details" : "Paid From — payment details"}</p>
          <div className="grid grid-cols-4 gap-1 rounded-md border border-border bg-accent/10 p-1">
            {METHODS.map((m) => (
              <button key={m} type="button" onClick={() => setPay({ ...pay, method: m })}
                className={`rounded px-1 py-1.5 text-[10px] font-semibold ${pay.method === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{m}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-[10px]">Account</Label>
              <SearchableSelect value={pay.accountId} onChange={(v) => setPay({ ...pay, accountId: v })} placeholder={store.accounts.length ? "Select account" : "No accounts yet"}
                options={store.accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.type})`, hint: a.number }))} className="mt-1" />
            </div>
            <div><Label className="text-[10px]">{entryDirection(form.type) === "in" ? "Collected By" : "Paid By / Handed To"}</Label><Input value={pay.collectedBy} onChange={(e) => setPay({ ...pay, collectedBy: e.target.value })} placeholder="Staff / person name" className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
          </div>
          {pay.method === "Cheque" && (
            <div className="grid grid-cols-3 gap-2">
              <div><Label className="text-[10px]">Cheque No *</Label><Input value={pay.chequeNo} onChange={(e) => setPay({ ...pay, chequeNo: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
              <div><Label className="text-[10px]">Cheque Date</Label><Input type="date" value={pay.chequeDate} onChange={(e) => setPay({ ...pay, chequeDate: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
              <div><Label className="text-[10px]">Bank</Label><Input value={pay.bankName} onChange={(e) => setPay({ ...pay, bankName: e.target.value })} placeholder="HBL / Meezan" className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
            </div>
          )}
          {(pay.method === "Bank Transfer" || pay.method === "Online / Wallet") && (
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-[10px]">{pay.method === "Bank Transfer" ? "Bank Name" : "Wallet (JazzCash / Easypaisa)"}</Label><Input value={pay.bankName} onChange={(e) => setPay({ ...pay, bankName: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
              <div><Label className="text-[10px]">Transaction / Ref No *</Label><Input value={pay.txnRef} onChange={(e) => setPay({ ...pay, txnRef: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
            </div>
          )}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between">
          <Label>Amount (PKR)</Label>
          {form.type === "purchase" && serviceCategory && (
            <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={autoTotal} onChange={(e) => setAutoTotal(e.target.checked)} className="rounded" />
              Auto-calc
            </label>
          )}
        </div>
        <Input type="number" value={form.amount} onChange={(e) => { setAutoTotal(false); setForm({ ...form, amount: e.target.value }); }} placeholder="100000" className="bg-accent/20 border-border mt-1" />
      </div>
      <div><Label>Description</Label><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="What this payment is for..." className="bg-accent/20 border-border mt-1" /></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Entries & Ledger"
        subtitle="All financial transactions"
        actions={
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={() => { setForm({ date: getPKTDate(), type: "client_receive", headId: "", referenceId: "", referenceName: "", amount: "", note: "" }); setDetails(emptyDetails); setServiceCategory(""); setAutoTotal(true); setExtra({ clientId: "", chargeCategory: "", refundOf: "", refundReason: "" }); setGroupMode("none"); setGroupId(""); }}>
                <Plus className="h-4 w-4" /> New Entry
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Add New Entry</DialogTitle></DialogHeader>
              {formFields}
              <Button onClick={handleAdd} className="w-full">Submit Entry</Button>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Live seat status for group sale / bill entry */}
      <GroupSeatStrip />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="glass-card rounded-xl p-5">
          <p className="text-[10px] uppercase text-muted-foreground">Total Received</p>
          <p className="text-xl font-bold text-success">{formatCurrency(totalReceived)}</p>
        </div>
        <div className="glass-card rounded-xl p-5">
          <p className="text-[10px] uppercase text-muted-foreground">Total Purchases</p>
          <p className="text-xl font-bold text-warning">{formatCurrency(totalPurchases)}</p>
        </div>
        <div className="glass-card rounded-xl p-5">
          <p className="text-[10px] uppercase text-muted-foreground">Total Paid Out</p>
          <p className="text-xl font-bold text-destructive">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="glass-card rounded-xl p-5">
          <p className="text-[10px] uppercase text-muted-foreground">Net Balance</p>
          <p className="text-xl font-bold text-primary">{formatCurrency(totalReceived - totalPaid)}</p>
        </div>
      </div>

      {/* Live Accounts & Settlement Balances Bar — click to filter entries */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Landmark className="h-3.5 w-3.5 text-primary" />
              Live Accounts & Clean Cash Balances
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Transactions are strictly recorded on or after each account's opening date. Legacy entries before opening date do not pollute cash.
            </p>
          </div>
          {accountFilter !== "all" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAccountFilter("all")}
              className="h-7 text-xs gap-1 border-primary/40 text-primary"
            >
              <X className="h-3 w-3" /> Clear Account Filter
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {store.accounts.map((acc) => {
            const bal = computeAccountBalance(acc.id);
            const active = accountFilter === acc.id;
            const Icon = acc.type === "Cash" ? Banknote : acc.type === "Bank" ? Landmark : Wallet;
            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => setAccountFilter(active ? "all" : acc.id)}
                className={`glass-card rounded-xl p-4 text-left transition-all relative overflow-hidden ${
                  active ? "ring-2 ring-primary border-primary bg-primary/10" : "hover:border-primary/40"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-primary/15 p-2 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">{acc.name}</p>
                      <p className="text-[10px] text-muted-foreground">{acc.number || acc.type}</p>
                    </div>
                  </div>
                  <span className="rounded bg-accent/40 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                    {acc.type}
                  </span>
                </div>

                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Live Balance</span>
                  <span className={`text-base font-bold font-mono ${bal >= 0 ? "text-success" : "text-destructive"}`}>
                    {formatCurrency(bal)}
                  </span>
                </div>

                <div className="mt-1.5 flex items-center justify-between border-t border-border/40 pt-1.5 text-[9px] text-muted-foreground">
                  <span>Effective Date:</span>
                  <span className="font-semibold text-foreground">{acc.openingDate || "2026-01-01"}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Universal Search, Filter & Sort Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ID, reference, partner, note..."
              className="h-8 pl-8 text-xs bg-background/50 border-border/60"
            />
          </div>

          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="h-8 text-xs bg-background/50 border-border/60 w-[140px]">
              <SelectValue placeholder="All Methods" />
            </SelectTrigger>
            <SelectContent className="border-border bg-card">
              <SelectItem value="all">All Channels</SelectItem>
              {METHODS.map((m) => (
                <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(typeFilter !== "all" || methodFilter !== "all" || accountFilter !== "all" || searchQuery) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setTypeFilter("all");
                setMethodFilter("all");
                setAccountFilter("all");
                setSearchQuery("");
              }}
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              Reset Filters
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground font-mono">
            {filtered.length} entries
          </span>
          <SortBar
            value={sortKey}
            onChange={setSortKey}
            label="Sort by:"
          />
        </div>
      </div>

      {/* Type Filters */}
      <div className="flex flex-wrap gap-2">
        {(["all", "client_receive", "client_charge", "purchase", "supplier_payment", "agent_commission", "expense", "client_refund", "supplier_refund", "agent_receive", "drawing", "jv"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${
              typeFilter === t ? "bg-primary text-primary-foreground shadow-sm" : "bg-accent/30 text-muted-foreground hover:bg-accent/50"
            }`}
          >
            {t === "all" ? "All Entries" : typeLabels[t]}
          </button>
        ))}
      </div>

      {/* Entries Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">ID</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Head ID</th><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Details & Note</th><th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const pd = e.purchaseDetails;
                const isJv = e.type === "jv";
                const isIn = INFLOW_TYPES.includes(e.type) || (isJv && e.direction === "in");
                const isCharge = e.type === "client_charge";

                return (
                  <tr key={e.id} className="border-b border-border/50 transition-colors hover:bg-accent/30">
                    <td className="px-4 py-3 font-semibold text-primary">{e.id}</td>
                    <td className="px-4 py-3 text-xs">{e.date}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-md bg-accent/30 px-2 py-1 text-[10px] font-semibold uppercase ${typeColors[e.type]}`}>
                        {typeLabels[e.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{e.headId || "—"}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium">{e.referenceName || (isJv ? "Journal Voucher" : "—")}</p>
                      <p className="text-xs text-muted-foreground">{e.referenceId}</p>
                    </td>
                    <td className={`px-4 py-3 font-semibold font-mono ${isIn ? "text-success" : isCharge ? "text-primary" : "text-destructive"}`}>
                      {isIn ? "+" : isCharge ? "" : "-"}{formatCurrency(e.amount)}
                    </td>
                    <td className="px-4 py-3 text-xs max-w-[280px]">
                      {/* Deep Service Chips for Purchases */}
                      {e.type === "purchase" && pd && (
                        <div className="mb-1 space-y-0.5">
                          {e.serviceCategory === "Flight" && (
                            <div className="rounded bg-sky-500/10 border border-sky-500/30 px-2 py-1 text-[10px] text-sky-400 flex flex-wrap gap-1.5 items-center">
                              <span className="font-bold flex items-center gap-1"><Plane className="h-3 w-3" /> Flight:</span>
                              {pd.tripType && <span className="bg-sky-500/20 px-1 rounded">{pd.tripType}</span>}
                              {pd.pnr && <span>PNR: <b className="text-foreground">{pd.pnr}</b></span>}
                              {pd.ticketNumber && <span>Tkt: <b className="text-foreground">{pd.ticketNumber}</b></span>}
                              {pd.sector && <span>Route: <b className="text-foreground">{pd.sector}</b></span>}
                              {pd.airline && <span>({pd.airline})</span>}
                            </div>
                          )}
                          {e.serviceCategory === "Hotel" && (
                            <div className="rounded bg-amber-500/10 border border-amber-500/30 px-2 py-1 text-[10px] text-amber-400 flex flex-wrap gap-1.5 items-center">
                              <span className="font-bold flex items-center gap-1"><Building2 className="h-3 w-3" /> Hotel:</span>
                              <span className="text-foreground font-semibold">{pd.hotelName || "Hotel"}</span>
                              {pd.city && <span>({pd.city})</span>}
                              {pd.rooms && <span>{pd.rooms} Rms</span>}
                              {pd.nights && <span>{pd.nights} Nts</span>}
                              {pd.mealPlan && <span>[{pd.mealPlan}]</span>}
                            </div>
                          )}
                          {e.serviceCategory === "Package" && (
                            <div className="rounded bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 text-[10px] text-emerald-400 flex flex-wrap gap-1.5 items-center">
                              <span className="font-bold flex items-center gap-1"><Package className="h-3 w-3" /> Package:</span>
                              <span className="text-foreground font-semibold">{pd.packageName || pd.destinationCity || "Holiday Tour"}</span>
                              {pd.packageType && <span className="bg-emerald-500/20 px-1 rounded">{pd.packageType}</span>}
                              {pd.destinationCountry && <span>{pd.destinationCountry}</span>}
                              {pd.packageDurationDays && <span>({pd.packageDurationDays} Days)</span>}
                            </div>
                          )}
                          {e.serviceCategory === "Visa" && (
                            <div className="rounded bg-purple-500/10 border border-purple-500/30 px-2 py-1 text-[10px] text-purple-400 flex flex-wrap gap-1.5 items-center">
                              <span className="font-bold flex items-center gap-1"><FileCheck2 className="h-3 w-3" /> Visa:</span>
                              <span>{pd.country} ({pd.visaType})</span>
                              {pd.reference && <span>Ref: <b className="text-foreground">{pd.reference}</b></span>}
                            </div>
                          )}
                          {e.serviceCategory === "Transport" && (
                            <div className="rounded bg-indigo-500/10 border border-indigo-500/30 px-2 py-1 text-[10px] text-indigo-400 flex flex-wrap gap-1.5 items-center">
                              <span className="font-bold flex items-center gap-1"><Bus className="h-3 w-3" /> Transport:</span>
                              <span>{pd.route}</span>
                              {pd.vehicle && <span>({pd.vehicle})</span>}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Journal Voucher Routing Badge */}
                      {isJv && (
                        <div className="mb-1 rounded bg-primary/10 border border-primary/30 px-2 py-1 text-[10px] text-primary">
                          {e.jvType === "account_transfer" ? (
                            <span className="flex items-center gap-1">
                              <ArrowRightLeft className="h-3 w-3 shrink-0" />
                              Transfer: <b>{store.accounts.find((a) => a.id === e.accountId)?.name || e.accountId}</b> → <b>{store.accounts.find((a) => a.id === e.toAccountId)?.name || e.toAccountId}</b>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <Calculator className="h-3 w-3 shrink-0" />
                              Reconciliation Adjustment ({store.accounts.find((a) => a.id === e.accountId)?.name || e.accountId})
                              {e.targetBalance != null && ` · Target: ${formatCurrency(e.targetBalance)}`}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Partner Drawing Badge */}
                      {e.type === "drawing" && (
                        <div className="mb-1 rounded bg-destructive/10 border border-destructive/30 px-2 py-0.5 text-[10px] text-destructive flex items-center gap-1.5">
                          <Wallet className="h-3 w-3 shrink-0" />
                          <span>Partner Drawing: <b className="text-foreground">{e.drawerName || e.referenceName || "Partner"}</b></span>
                          {e.chargeCategory && <span className="text-muted-foreground">({e.chargeCategory})</span>}
                        </div>
                      )}

                      <div className="text-muted-foreground truncate">{[e.chargeCategory, e.refundReason, e.note].filter(Boolean).join(" · ")}</div>

                      {MONEY_TYPES.includes(e.type) && !isJv && (
                        <p className="mt-0.5 text-[10px] text-primary/80">
                          {[
                            e.paymentMethod || "Cash",
                            store.accounts.find((a) => a.id === e.accountId)?.name,
                            e.chequeNo && `Chq ${e.chequeNo}`,
                            e.bankName,
                            e.txnRef && `Ref ${e.txnRef}`,
                            e.collectedBy && `by ${e.collectedBy}`,
                          ].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => generatePaymentReceipt(e)} className="rounded p-1 hover:bg-accent" title="Download Receipt"><Download className="h-3.5 w-3.5 text-success" /></button>
                        <button onClick={() => openEdit(e)} className="rounded p-1 hover:bg-accent"><Pencil className="h-3.5 w-3.5 text-warning" /></button>
                        <button onClick={() => store.deleteEntry(e.id)} className="rounded p-1 hover:bg-accent"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Entry — {selected?.id}</DialogTitle></DialogHeader>
          {formFields}
          <Button onClick={handleEdit} className="w-full">Save Changes</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
