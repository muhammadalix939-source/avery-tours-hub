// CRM Data Types and Mock Data

// Expanded service catalogue used across Bookings, Suppliers and Services menus.
export const SERVICE_TYPES = [
  "Umrah Package",
  "Hajj Package",
  "Hotel",
  "Flight",
  "Visa",
  "Transport",
  "Ziyarah",
  "Domestic Tour",
  "International Tour",
  "Insurance",
  "Other",
] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const PACKAGE_TYPES = [
  "Umrah",
  "Umrah Economy",
  "Umrah Standard",
  "Umrah VIP",
  "Hajj",
  "Hajj Shifting",
  "Hajj Aziziya",
  "Ziyarah",
  "International Tour",
  "Domestic Tour",
  "Pakistan Tour",
  "Honeymoon Package",
  "Group Tour",
  "Family Package",
  "Visa Only",
  "Tour",
  "Custom",
] as const;
export type PackageType = (typeof PACKAGE_TYPES)[number];

export type ChecklistStatus = "Pending" | "In Progress" | "Completed";

export interface ChecklistItem {
  id: string;
  label: string;
  status: ChecklistStatus;
  note?: string;
}

export interface Client {
  id: string;
  headId: string;
  firstName: string;
  lastName: string;
  gender: "Male" | "Female" | "Custom";
  ageCategory?: "Adult" | "Child" | "Infant";
  nationality: string;
  passport: string;
  cnic?: string;
  dateOfBirth?: string;
  dateOfIssue?: string;
  dateOfExpire?: string;
  phone: string;
  email?: string;
  packageType: PackageType;
  paymentStatus: "Paid" | "Partial" | "Unpaid";
  amountDue: number;
  amountPaid: number;
  /** Package due before any extra charges (embassy fees, etc.). Managed by the store. */
  baseDue?: number;
  /** Sum of extra charges billed to this member via the ledger. */
  extraCharges?: number;
  /** Sum refunded back to this member via the ledger (reduces net due). */
  refunded?: number;
  /** Carry-forward balance from before this system (added to amountPaid baseline). */
  openingPaid?: number;
  isVip: boolean;
  destination?: string;
  driveLink?: string;
  /** Per-client service checklist (Transport / Ziyarat / Hotel / Visa + custom items). */
  checklist?: ChecklistItem[];
  /** Manually archived out of the active Clients alerts tab (reversible). */
  checklistArchived?: boolean;
}

export function getClientName(c: Client): string {
  return `${c.firstName} ${c.lastName}`.trim() || "—";
}

export interface Booking {
  id: string;
  headId: string;
  agentId: string;
  supplierId: string;
  totalAmount: number;
  amountReceived: number;
  totalCost: number;
  commission: number;
  /** Package amount before extra charges. Managed by the store. */
  baseAmount?: number;
  /** Extra charges (embassy / service fees) billed to this head via the ledger. */
  extraCharges?: number;
  /** Amount refunded back to the client(s) of this head. */
  refunded?: number;
  clientIds: string[];
  status: "Confirmed" | "Pending" | "Cancelled";
  packageType: PackageType;
  travelDate: string;
  createdAt: string;
  members: number;
  destination?: string;
  driveLink?: string;
  hotels?: HotelService[];
  flights?: FlightService[];
  transports?: TransportService[];
  visas?: VisaService[];
  others?: OtherService[];
  /** Optional PNR / batch group linking this booking to a shared purchase group */
  groupId?: string;
  /** Realized vs Accrued Profit status: unearned until confirmed/converted to earned */
  profitStatus?: "unearned" | "earned";
  /** Date when profit was converted to earned / realized */
  profitEarnedDate?: string;
  /** Whether the travel service has been fulfilled/completed */
  serviceCompleted?: boolean;
  /** Timestamp when the service was marked completed */
  completedAt?: string;
  /** Discount / price concession given to client / customer (PKR) */
  discount?: number;
  /** Discount settlement strategy: offset from agent commission or absorbed by agency */
  discountSettlement?: "agent_commission" | "agency_absorbed";
  /** Discount / rebate received from supplier on this booking (PKR) */
  supplierDiscount?: number;
}

export interface BookingFinancials {
  sale: number;
  grossSale: number;
  discount: number;
  supplierDiscount: number;
  netCost: number;
  netCommission: number;
  agentAbsorbedDiscount: number;
  agencyAbsorbedDiscount: number;
  netProfit: number;
  isLoss: boolean;
  lossAmount: number;
  marginPercent: number;
}

export function computeBookingFinancials(b: Booking): BookingFinancials {
  const sale = Number(b.totalAmount) || 0;
  const discount = Number(b.discount) || 0;
  const supplierDisc = Number(b.supplierDiscount) || 0;
  const grossCost = Number(b.totalCost) || 0;
  const netCost = Math.max(0, grossCost - supplierDisc);

  const originalCommission = Number(b.commission) || 0;
  let netCommission = originalCommission;
  let agentAbsorbedDiscount = 0;
  let agencyAbsorbedDiscount = 0;

  // When booking has an agent and settlement is offset against agent commission:
  if (b.agentId && b.agentId !== "Direct" && b.discountSettlement === "agent_commission") {
    agentAbsorbedDiscount = Math.min(originalCommission, discount);
    netCommission = Math.max(0, originalCommission - agentAbsorbedDiscount);
    agencyAbsorbedDiscount = Math.max(0, discount - agentAbsorbedDiscount);
  } else {
    agencyAbsorbedDiscount = discount;
  }

  // Net agency profit: Sale revenue (after agency-absorbed discount) - net supplier cost - net commission
  const netProfit = (sale - agencyAbsorbedDiscount) - netCost - netCommission;
  const isLoss = netProfit < 0;

  return {
    sale,
    grossSale: sale,
    discount,
    supplierDiscount: supplierDisc,
    netCost,
    netCommission,
    agentAbsorbedDiscount,
    agencyAbsorbedDiscount,
    netProfit,
    isLoss,
    lossAmount: isLoss ? Math.abs(netProfit) : 0,
    marginPercent: sale > 0 ? Math.round((netProfit / sale) * 100) : 0,
  };
}

export function computeBookingProfit(b: Booking): number {
  return computeBookingFinancials(b).netProfit;
}

export interface Drawer {
  id: string;
  name: string;
  role?: string;
  phone?: string;
  sharePercent?: number;
  openingDrawings?: number;
  notes?: string;
}

export interface HotelService {
  id: string;
  city: string;        // e.g. Makkah / Madinah
  hotelName: string;
  roomType: string;    // e.g. 1 Quad, 2 Triple
  checkIn: string;     // YYYY-MM-DD
  checkOut: string;    // YYYY-MM-DD
  nights: number;
}

export interface FlightService {
  id: string;
  date: string;
  flightNo: string;
  from: string;
  to: string;
  departure: string;   // HH:mm
  arrival: string;     // HH:mm
}

export interface TransportService {
  id: string;
  service: string;     // e.g. Airport Transfer
  route: string;       // e.g. JED Airport - Makkah Hotel
  vehicle: string;     // e.g. Private Car
  date: string;
  amount?: number;
}

export interface VisaService {
  id: string;
  visaType: string;    // e.g. Umrah / Tourist
  country: string;     // e.g. Saudi Arabia
  reference: string;   // visa / file number
  issueDate?: string;
  amount?: number;
}

export interface OtherService {
  id: string;
  category: string;    // e.g. Ziyarah / Insurance / Lunch
  description: string;
  date?: string;
  amount?: number;
}

export interface Agent {
  id: string;
  name: string;
  phone: string;
  email: string;
  totalSales: number;
  totalClients: number;
  commission: number;
  paidCommission: number;
  openingCommission?: number;      // legacy commission earned before system
  openingPaidCommission?: number;  // legacy commission already paid
  openingClients?: number;         // legacy client count
  openingSales?: number;           // legacy sales
  status: "Active" | "Inactive";
}

export interface Supplier {
  id: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  serviceType: string;
  totalPayable: number;
  totalPaid: number;
  openingPayable?: number;
  openingPaid?: number;
}

export interface SupplierTransaction {
  id: string;
  supplierId: string;
  date: string;
  amount: number;
  remainingAfter: number;
}

// Mock data
export const mockAgents: Agent[] = [
  { id: "AV-A001", name: "Ahmed Khan", phone: "03001234567", email: "ahmed@av.com", totalSales: 2500000, totalClients: 45, commission: 125000, paidCommission: 50000, status: "Active" },
  { id: "AV-A002", name: "Sara Ali", phone: "03009876543", email: "sara@av.com", totalSales: 1800000, totalClients: 32, commission: 90000, paidCommission: 30000, status: "Active" },
  { id: "AV-A003", name: "Usman Malik", phone: "03115554444", email: "usman@av.com", totalSales: 950000, totalClients: 18, commission: 47500, paidCommission: 0, status: "Active" },
];

export const mockSuppliers: Supplier[] = [
  { id: "AV-S001", companyName: "Al-Haram Hotels", contactPerson: "Fahad Sheikh", phone: "03211112222", email: "fahad@alharam.com", serviceType: "Hotel", totalPayable: 800000, totalPaid: 500000 },
  { id: "AV-S002", companyName: "Sky Wings Airlines", contactPerson: "Bilal Ahmed", phone: "03223334444", email: "bilal@skywings.com", serviceType: "Flight", totalPayable: 600000, totalPaid: 600000 },
  { id: "AV-S003", companyName: "Noor Transport", contactPerson: "Imran Hussain", phone: "03335556666", email: "imran@noor.com", serviceType: "Transport", totalPayable: 200000, totalPaid: 120000 },
  { id: "AV-S004", companyName: "Fast Visa Services", contactPerson: "Tariq Mehmood", phone: "03447778888", email: "tariq@fastvisa.com", serviceType: "Visa", totalPayable: 150000, totalPaid: 150000 },
];

export const mockClients: Client[] = [
  { id: "AV-C001", headId: "AV-HD-001", firstName: "Muhammad", lastName: "Ali", gender: "Male", nationality: "Pakistani", passport: "AB1234567", phone: "03001111111", packageType: "Umrah", paymentStatus: "Paid", amountDue: 100000, amountPaid: 100000, isVip: true },
  { id: "AV-C002", headId: "AV-HD-001", firstName: "Fatima", lastName: "Ali", gender: "Female", nationality: "Pakistani", passport: "AB1234568", phone: "03001111112", packageType: "Umrah", paymentStatus: "Paid", amountDue: 100000, amountPaid: 100000, isVip: false },
  { id: "AV-C003", headId: "AV-HD-001", firstName: "Hassan", lastName: "Ali", gender: "Male", nationality: "Pakistani", passport: "AB1234569", phone: "03001111113", packageType: "Umrah", paymentStatus: "Partial", amountDue: 100000, amountPaid: 50000, isVip: false },
  { id: "AV-C004", headId: "AV-HD-001", firstName: "Aisha", lastName: "Ali", gender: "Female", nationality: "Pakistani", passport: "AB1234570", phone: "03001111114", packageType: "Umrah", paymentStatus: "Unpaid", amountDue: 100000, amountPaid: 0, isVip: false },
  { id: "AV-C005", headId: "AV-HD-001", firstName: "Omar", lastName: "Ali", gender: "Male", nationality: "Pakistani", passport: "AB1234571", phone: "03001111115", packageType: "Umrah", paymentStatus: "Unpaid", amountDue: 100000, amountPaid: 0, isVip: false },
  { id: "AV-C006", headId: "AV-HD-002", firstName: "Zainab", lastName: "Raza", gender: "Female", nationality: "Pakistani", passport: "CD5678901", phone: "03002222221", packageType: "Hajj", paymentStatus: "Paid", amountDue: 250000, amountPaid: 250000, isVip: true },
  { id: "AV-C007", headId: "AV-HD-002", firstName: "Aamir", lastName: "Raza", gender: "Male", nationality: "Pakistani", passport: "CD5678902", phone: "03002222222", packageType: "Hajj", paymentStatus: "Paid", amountDue: 250000, amountPaid: 250000, isVip: false },
  { id: "AV-C008", headId: "AV-HD-002", firstName: "Nadia", lastName: "Raza", gender: "Female", nationality: "Pakistani", passport: "CD5678903", phone: "03002222223", packageType: "Hajj", paymentStatus: "Partial", amountDue: 250000, amountPaid: 100000, isVip: false },
  { id: "AV-C009", headId: "AV-HD-003", firstName: "Kamran", lastName: "Sheikh", gender: "Male", nationality: "Pakistani", passport: "EF9012345", phone: "03003333331", packageType: "Tour", paymentStatus: "Paid", amountDue: 80000, amountPaid: 80000, isVip: false },
  { id: "AV-C010", headId: "AV-HD-003", firstName: "Sadia", lastName: "Sheikh", gender: "Female", nationality: "Pakistani", passport: "EF9012346", phone: "03003333332", packageType: "Tour", paymentStatus: "Unpaid", amountDue: 80000, amountPaid: 0, isVip: false },
];

export const mockBookings: Booking[] = [
  { id: "B001", headId: "AV-HD-001", agentId: "AV-A001", supplierId: "AV-S001", totalAmount: 500000, amountReceived: 250000, totalCost: 350000, commission: 25000, clientIds: ["AV-C001", "AV-C002", "AV-C003", "AV-C004", "AV-C005"], status: "Confirmed", packageType: "Umrah", travelDate: "2026-06-15", createdAt: "2026-03-01", members: 5, destination: "Makkah / Madinah", profitStatus: "earned", profitEarnedDate: "2026-03-20", discount: 5000, discountSettlement: "agent_commission" },
  { id: "B002", headId: "AV-HD-002", agentId: "AV-A002", supplierId: "AV-S002", totalAmount: 750000, amountReceived: 600000, totalCost: 500000, commission: 30000, clientIds: ["AV-C006", "AV-C007", "AV-C008"], status: "Confirmed", packageType: "Hajj", travelDate: "2026-07-10", createdAt: "2026-02-15", members: 3, destination: "Makkah / Madinah", profitStatus: "earned", profitEarnedDate: "2026-03-25", supplierDiscount: 10000 },
  { id: "B003", headId: "AV-HD-003", agentId: "AV-A003", supplierId: "AV-S003", totalAmount: 160000, amountReceived: 80000, totalCost: 100000, commission: 8000, clientIds: ["AV-C009", "AV-C010"], status: "Pending", packageType: "Tour", travelDate: "2026-05-20", createdAt: "2026-04-01", members: 2, destination: "Istanbul, Turkey", profitStatus: "unearned" },
];

export const mockMonthlyData = [
  { month: "Jan", revenue: 450000, clients: 12, profit: 85000 },
  { month: "Feb", revenue: 620000, clients: 18, profit: 124000 },
  { month: "Mar", revenue: 380000, clients: 10, profit: 72000 },
  { month: "Apr", revenue: 890000, clients: 25, profit: 178000 },
];

// Payment distribution logic
export function distributePayment(clients: Client[], totalReceived: number): Client[] {
  let remaining = totalReceived;
  return clients.map((client) => {
    if (remaining <= 0) {
      return { ...client, amountPaid: 0, paymentStatus: "Unpaid" as const };
    }
    if (remaining >= client.amountDue) {
      remaining -= client.amountDue;
      return { ...client, amountPaid: client.amountDue, paymentStatus: "Paid" as const };
    }
    const paid = remaining;
    remaining = 0;
    return { ...client, amountPaid: paid, paymentStatus: "Partial" as const };
  });
}

export function formatCurrency(amount: number): string {
  const n = Math.round(Number(amount) || 0);
  const formatted = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return n < 0 ? `-Rs ${formatted}` : `Rs ${formatted}`;
}

export function generateId(prefix: string, num: number): string {
  return `${prefix}${String(num).padStart(3, "0")}`;
}
