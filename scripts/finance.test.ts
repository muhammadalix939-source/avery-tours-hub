// Behaviour checks for the client-money engine. Not part of the app bundle (outside tsconfig "include").
// Run:  bun test scripts/finance.test.ts
import { mock, test, expect, beforeAll } from "bun:test";

mock.module("react", () => ({ useState: (v: unknown) => [v, () => {}], useCallback: (f: unknown) => f, useEffect: () => {}, useMemo: (f: () => unknown) => f(), createContext: () => ({}), useContext: () => ({}) }));
mock.module("sonner", () => ({ toast: Object.assign(() => 0, { success() {}, error() {}, info() {}, message() {}, dismiss() {} }) }));
mock.module("../src/lib/firebase", () => ({ auth: { currentUser: null }, pushFullStateToFirestore: async () => {}, fetchCollectionFromFirestore: async () => [] }));

type Store = ReturnType<typeof import("../src/lib/store").useStore>;
let st: () => Store;
let money: typeof import("../src/lib/heads").computeBookingMoney;
let hb: typeof import("../src/lib/heads").computeHeadBusiness;
let fin: typeof import("../src/lib/data").computeBookingFinancials;

beforeAll(async () => {
  const s = await import("../src/lib/store");
  st = () => s.useStore();
  money = (await import("../src/lib/heads")).computeBookingMoney;
  hb = (await import("../src/lib/heads")).computeHeadBusiness;
  fin = (await import("../src/lib/data")).computeBookingFinancials;
});

const member = (headId: string, n: number, due: number) => ({
  headId, firstName: "M", lastName: String(n), gender: "Male" as const, ageCategory: "Adult" as const, nationality: "", passport: "", cnic: "",
  dateOfBirth: "", dateOfIssue: "", dateOfExpire: "", phone: "", email: "", packageType: "Umrah" as const, paymentStatus: "Unpaid" as const,
  amountDue: due, amountPaid: 0, isVip: false, destination: "",
});

function newBooking(discount = 0, agentId = "", commission = 0, settlement: "agent_commission" | "agency_absorbed" = "agent_commission") {
  const s = st();
  const headId = s.generateHeadId();
  const id = s.addBooking({ headId, agentId, supplierId: "", totalAmount: 300000, amountReceived: 0, totalCost: 0, commission, discount, discountSettlement: settlement, supplierDiscount: 0, clientIds: [], status: "Confirmed", packageType: "Umrah", travelDate: "2026-12-01", createdAt: "2026-11-01", members: 3, destination: "" } as never);
  [0, 1, 2].forEach((i) => s.addClient(member(headId, i, 100000), { skipBookingSync: true }));
  return { headId, id };
}
const book = (headId: string) => st().bookings.find((b) => b.headId === headId)!;
const mem = (headId: string) => st().clients.filter((c) => c.headId === headId);

test("booking discount reduces total, member due and pending", () => {
  const { headId } = newBooking(20000);
  const b = book(headId);
  expect(b.totalAmount).toBe(280000);
  expect(mem(headId).map((c) => c.amountDue)).toEqual([80000, 100000, 100000]);
  const m = money(b, st().entries);
  expect([m.gross, m.discount, m.net, m.pending]).toEqual([300000, 20000, 280000, 280000]);
});

test("adding a member adds their price to the booking total (and removing takes it off)", () => {
  const { headId } = newBooking(0);
  const s = st();
  const newId = s.addClient(member(headId, 9, 100000));
  expect(book(headId).totalAmount).toBe(400000);
  expect(book(headId).members).toBe(4);
  s.updateClient(newId, { amountDue: 120000 });
  expect(book(headId).totalAmount).toBe(420000);
  s.deleteClient(newId);
  expect(book(headId).totalAmount).toBe(300000);
  expect(book(headId).members).toBe(3);
});

test("discount + new member + payment stay consistent (FIFO, spill-over, pending never negative)", () => {
  const { headId } = newBooking(150000);
  const s = st();
  s.addClient(member(headId, 7, 50000));
  const b = book(headId);
  expect(b.totalAmount).toBe(350000 - 150000); // 300k + 50k − 150k
  const dues = mem(headId).map((c) => c.amountDue);
  expect(dues.reduce((a, c) => a + c, 0)).toBe(200000);
  expect(dues[0]).toBe(0); // the discount spills past the lead (100k) into the next member
  s.addEntry({ date: "2026-11-02", type: "client_receive", headId, referenceId: headId, referenceName: "x", amount: 120000, note: "" });
  const m = money(book(headId), st().entries);
  expect([m.net, m.received, m.pending]).toEqual([200000, 120000, 80000]);
});

test("ledger discount + booking discount both apply; charges and refunds layer on", () => {
  const { headId } = newBooking(10000);
  const s = st();
  s.addEntry({ date: "2026-11-02", type: "client_discount", headId, referenceId: headId, referenceName: "x", amount: 5000, note: "" });
  s.addEntry({ date: "2026-11-02", type: "client_charge", headId, referenceId: headId, referenceName: "x", amount: 2000, note: "", chargeCategory: "Visa" });
  expect(book(headId).totalAmount).toBe(300000 - 10000 - 5000 + 2000);
  const m = money(book(headId), st().entries);
  expect(m.discount).toBe(15000);
});

test("profit: agent-settled discount is not double counted; direct bookings absorb it fully", () => {
  const agent = newBooking(20000, "AV-A001", 30000, "agent_commission");
  const direct = newBooking(20000, "", 30000, "agent_commission"); // no agent → agency absorbs, commission unchanged
  const fa = fin({ ...book(agent.headId), totalCost: 200000 });
  const fd = fin({ ...book(direct.headId), totalCost: 200000 });
  // net sale 280k − cost 200k − commission (30k − 20k absorbed = 10k) = 70k
  expect(fa.netProfit).toBe(70000);
  expect(fa.agentAbsorbedDiscount).toBe(20000);
  // direct: 280k − 200k − 30k = 50k
  expect(fd.netProfit).toBe(50000);
});

test("Business View matches the booking: net receivable and profit", () => {
  const { headId } = newBooking(20000);
  const x = hb(headId, st().clients, st().bookings, st().entries);
  expect(x.totalSale).toBe(300000);
  expect(x.discount).toBe(20000);
  expect(x.netReceivable).toBe(280000);
});

test("split purchase 'also bill client' creates a linked charge that follows edits and deletion", () => {
  const { headId } = newBooking(0);
  const s = st();
  const pid = s.addEntry({
    date: "2026-11-03", type: "purchase", headId: "", referenceId: "AV-S001", referenceName: "Hotel", amount: 90000, note: "", serviceCategory: "Hotel",
    allocationMode: "manual", allocations: [{ id: "A1", target: "head", headId, amount: 60000, billClient: true }, { id: "A2", target: "office", amount: 30000 }],
  });
  const linked = () => st().entries.filter((e) => e.allocationOf === pid);
  expect(linked().length).toBe(1);
  expect(book(headId).totalAmount).toBe(360000);
  s.updateEntry(pid, { allocations: [{ id: "A1", target: "head", headId, amount: 50000, billClient: true }, { id: "A2", target: "office", amount: 40000 }] });
  expect(linked().map((e) => e.amount)).toEqual([50000]);
  expect(book(headId).totalAmount).toBe(350000);
  s.deleteEntry(pid);
  expect(linked().length).toBe(0);
  expect(book(headId).totalAmount).toBe(300000);
});
