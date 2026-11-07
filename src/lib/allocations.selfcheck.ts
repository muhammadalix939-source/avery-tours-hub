// Dev self-check for Cost Allocation (the repo has no test runner). Run:  bun run src/lib/allocations.selfcheck.ts
// Each check prints the real numbers it computed. Exit code 1 if any check fails.
import {
  splitEqual, distributeProRata, rebalanceEqual, autoBalanceLast, validateAllocations, purchaseAllocations,
  headCostOf, headSupplierPaid, agentSupplierPaid, agentOtherSaleRows, headSupplierRefundOf, entriesAllocatingTo,
  validatePaymentAllocations, paymentAmountForGroup,
} from "./allocations";
import type { CostAllocation, LedgerEntry } from "./store";

export interface CheckResult { name: string; ok: boolean; detail: string }

const mk = (o: Partial<LedgerEntry> & { id: string; type: LedgerEntry["type"]; amount: number }): LedgerEntry => ({
  date: "2026-11-01", headId: "", referenceId: "AV-S001", referenceName: "Al-Haram Hotels", note: "", createdAt: "", ...o,
} as LedgerEntry);
const L = (o: Partial<CostAllocation> & { id: string; target: CostAllocation["target"]; amount: number }): CostAllocation => ({ ...o });

export function runAllocationSelfCheck(): CheckResult[] {
  const out: CheckResult[] = [];
  const check = (name: string, ok: boolean, detail: string) => out.push({ name, ok, detail });
  const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

  // 1. splitEqual
  let sumsOk = true;
  for (let t = 0; t <= 1000; t++) for (let c = 1; c <= 9; c++) if (splitEqual(t, c).reduce((a, b) => a + b, 0) !== t) sumsOk = false;
  check("1 splitEqual", eq(splitEqual(100000, 2), [50000, 50000]) && eq(splitEqual(100001, 3), [33334, 33334, 33333]) && sumsOk,
    `100000/2=${splitEqual(100000, 2)} 100001/3=${splitEqual(100001, 3)} sums(0..1000 × 1..9) ${sumsOk ? "all exact" : "BROKEN"}`);

  // 2. one room 100,000 equal between Head A and B
  const room = mk({ id: "P1", type: "purchase", amount: 100000, serviceCategory: "Hotel", allocationMode: "equal",
    allocations: rebalanceEqual([L({ id: "A1", target: "head", headId: "HA", amount: 0 }), L({ id: "A2", target: "head", headId: "HB", amount: 0 })], 100000) });
  check("2 equal head split", headCostOf([room], "HA") === 50000 && headCostOf([room], "HB") === 50000 && room.amount === 100000,
    `A=${headCostOf([room], "HA")} B=${headCostOf([room], "HB")} supplier payable(full)=${room.amount}`);

  // 3. mixed manual 90,000 = A 40k + B 30k + Agent X 20k (sale 24k)
  const mixed = mk({ id: "P2", type: "purchase", amount: 90000, allocationMode: "manual", allocations: [
    L({ id: "A1", target: "head", headId: "HA", amount: 40000 }), L({ id: "A2", target: "head", headId: "HB", amount: 30000 }),
    L({ id: "A3", target: "agent", agentId: "AX", amount: 20000, saleAmount: 24000 }) ] });
  const rows3 = agentOtherSaleRows([mixed], "AX");
  check("3 mixed manual", headCostOf([mixed], "HA") === 40000 && headCostOf([mixed], "HB") === 30000 && rows3.length === 1 && rows3[0].sale === 24000 && rows3[0].profit === 4000,
    `A=${headCostOf([mixed], "HA")} B=${headCostOf([mixed], "HB")} otherSale=${rows3[0]?.sale} profit=${rows3[0]?.profit} supplier=${mixed.amount}`);

  // 4. one head + one agent 60/40 — agent sale appears once
  const hv = mk({ id: "P3", type: "purchase", amount: 100000, allocations: [L({ id: "A1", target: "head", headId: "HA", amount: 60000 }), L({ id: "A2", target: "agent", agentId: "AX", amount: 40000 })] });
  check("4 head+agent once", headCostOf([hv], "HA") === 60000 && agentOtherSaleRows([hv], "AX").length === 1 && agentOtherSaleRows([hv], "AX")[0].sale === 40000,
    `head cost ${headCostOf([hv], "HA")}, agent rows ${agentOtherSaleRows([hv], "AX").length}, sale ${agentOtherSaleRows([hv], "AX")[0]?.sale}`);

  // 5. edit amount to 70,000 in equal mode
  const edited = rebalanceEqual(hv.allocations!.map((l) => ({ ...l })), 70000);
  check("5 equal re-split", eq(edited.map((l) => l.amount), [35000, 35000]), `lines ${edited.map((l) => l.amount)}`);

  // 6. delete purchase → everything drops (derived from entries only)
  check("6 delete drops all", headCostOf([], "HA") === 0 && agentOtherSaleRows([], "AX").length === 0, "no purchase → head cost 0, other sale none (all derived from the entry)");

  // 7. legacy parity vs the OLD formulas (headId-only purchases / purchasedFor agent)
  const legacy: LedgerEntry[] = [
    mk({ id: "E001", type: "purchase", amount: 120000, headId: "AV-HD-001", purchasedFor: "client" }),
    mk({ id: "E002", type: "purchase", amount: 50000, headId: "", purchasedFor: "agent", agentId: "AV-A001", saleAmount: 56000, forClientName: "X" }),
    mk({ id: "E003", type: "supplier_payment", amount: 200000, headId: "", note: "Hotel advance" }),
    mk({ id: "E004", type: "purchase", amount: 30000, headId: "AV-HD-001", groupId: "G1" }),
    mk({ id: "E005", type: "purchase", amount: 10000, headId: "AV-HD-002", groupId: "G1" }),
    mk({ id: "E006", type: "supplier_payment", amount: 20000, headId: "", groupId: "G1" }),
    mk({ id: "E007", type: "supplier_payment", amount: 15000, headId: "AV-HD-001" }),
    mk({ id: "E008", type: "other_sale", amount: 9000, referenceId: "AV-A001" }),
    mk({ id: "E009", type: "supplier_refund", amount: 5000, headId: "AV-HD-001" }),
  ];
  const oldCost = (h: string) => legacy.filter((e) => e.type === "purchase" && e.headId === h).reduce((s, e) => s + e.amount, 0);
  const oldPaid = (h: string) => {
    const linked = legacy.filter((e) => e.headId === h);
    const direct = linked.filter((e) => e.type === "supplier_payment").reduce((s, e) => s + e.amount, 0);
    const pe = linked.filter((e) => e.type === "purchase");
    let pr = 0;
    new Set(pe.map((e) => e.groupId).filter(Boolean) as string[]).forEach((g) => {
      const bill = legacy.filter((e) => e.type === "purchase" && e.groupId === g).reduce((s, e) => s + e.amount, 0);
      const un = legacy.filter((e) => e.type === "supplier_payment" && e.groupId === g && !e.headId).reduce((s, e) => s + e.amount, 0);
      const mine = pe.filter((e) => e.groupId === g).reduce((s, e) => s + e.amount, 0);
      if (bill > 0) pr += un * (mine / bill);
    });
    return Math.round(direct + pr);
  };
  const oldOther = (a: string) => legacy.filter((e) => (e.type === "purchase" && e.purchasedFor === "agent" && e.agentId === a) || (e.type === "other_sale" && e.referenceId === a))
    .reduce((s, e) => s + (e.type === "purchase" ? (e.saleAmount ?? e.amount) : e.amount), 0);
  const parity = ["AV-HD-001", "AV-HD-002"].every((h) => headCostOf(legacy, h) === oldCost(h) && headSupplierPaid(legacy, h) === oldPaid(h))
    && agentOtherSaleRows(legacy, "AV-A001").reduce((s, r) => s + r.sale, 0) === oldOther("AV-A001")
    && headSupplierRefundOf(legacy, "AV-HD-001") === 5000;
  check("7 legacy parity", parity, `cost HD1 ${headCostOf(legacy, "AV-HD-001")}=${oldCost("AV-HD-001")} · paid HD1 ${headSupplierPaid(legacy, "AV-HD-001")}=${oldPaid("AV-HD-001")} · paid HD2 ${headSupplierPaid(legacy, "AV-HD-002")}=${oldPaid("AV-HD-002")} · otherSale ${agentOtherSaleRows(legacy, "AV-A001").reduce((s, r) => s + r.sale, 0)}=${oldOther("AV-A001")} · E003 untagged → unallocated (head paid unaffected)`);

  // 8. payment 60,000 = Head A 30k + Group G 20k + Agent X 10k
  const gp = [
    mk({ id: "P10", type: "purchase", amount: 30000, groupId: "G", allocations: [L({ id: "A1", target: "head", headId: "HA", amount: 30000 })] }),
    mk({ id: "P11", type: "purchase", amount: 10000, groupId: "G", allocations: [L({ id: "A1", target: "head", headId: "HB", amount: 10000 })] }),
    mk({ id: "S1", type: "supplier_payment", amount: 60000, paymentAllocations: [
      { id: "A1", target: "head", headId: "HA", amount: 30000 }, { id: "A2", target: "group", groupId: "G", amount: 20000 }, { id: "A3", target: "agent", agentId: "AX", amount: 10000 } ] }),
  ];
  check("8 payment tags", headSupplierPaid(gp, "HA") === 30000 + 15000 && headSupplierPaid(gp, "HB") === 5000 && agentSupplierPaid(gp, "AX") === 10000 && gp[2].amount === 60000,
    `HA paid ${headSupplierPaid(gp, "HA")} (30,000 direct + 15,000 group) · HB ${headSupplierPaid(gp, "HB")} · agent memo ${agentSupplierPaid(gp, "AX")} · supplier totalPaid ${gp[2].amount}`);

  // 9. group pro-rating 30k/10k of 20k → 15k/5k
  const g9 = [gp[0], gp[1], mk({ id: "S2", type: "supplier_payment", amount: 20000, groupId: "G" })];
  check("9 group pro-rata", headSupplierPaid(g9, "HA") === 15000 && headSupplierPaid(g9, "HB") === 5000, `A=${headSupplierPaid(g9, "HA")} B=${headSupplierPaid(g9, "HB")}`);

  // 10. blocking helper + validation
  const ctx = { heads: new Set(["HA", "HB"]), agents: new Set(["AX"]), membersOf: () => new Set(["M1"]) };
  const bad = validateAllocations([L({ id: "A1", target: "head", headId: "HA", amount: 40000 })], 50000, ctx);
  const good = validateAllocations(hv.allocations!, 100000, ctx);
  const dup = validateAllocations([L({ id: "A1", target: "head", headId: "HA", amount: 1 }), L({ id: "A2", target: "head", headId: "HA", amount: 1 })], 2, ctx);
  const unk = validateAllocations([L({ id: "A1", target: "head", headId: "ZZ", amount: 5 })], 5, ctx);
  const mem = validateAllocations([L({ id: "A1", target: "head", headId: "HA", clientId: "NOPE", amount: 5 })], 5, ctx);
  check("10 validation + block", !bad.ok && bad.remaining === 10000 && good.ok && !dup.ok && !unk.ok && !mem.ok && entriesAllocatingTo([hv, room], { agentId: "AX" }).length === 1,
    `mismatch remaining ${bad.remaining}; valid ok=${good.ok}; duplicate=${!dup.ok}; unknown head=${!unk.ok}; bad member=${!mem.ok}; entries referencing AX = ${entriesAllocatingTo([hv, room], { agentId: "AX" }).length}`);

  // extras: refunds on a split purchase, rounding, auto-balance, largest remainder
  const refd = mk({ id: "R1", type: "supplier_refund", amount: 10000, refundOf: "P2", headId: "" });
  const rf = headSupplierRefundOf([mixed, refd], "HA") + headSupplierRefundOf([mixed, refd], "HB");
  const ab = autoBalanceLast([L({ id: "A1", target: "head", headId: "HA", amount: 30000 }), L({ id: "A2", target: "head", headId: "HB", amount: 1 })], 100000);
  check("11 refund pro-rata + autoBalance", distributeProRata(10000, [40000, 30000, 20000]).reduce((a, b) => a + b, 0) === 10000 && ab[1].amount === 70000 && rf > 0 && rf <= 10000,
    `refund 10,000 over 40/30/20k → ${distributeProRata(10000, [40000, 30000, 20000])}; heads share ${rf}; autoBalanceLast → ${ab[1].amount}`);
  check("12 legacy adapter lines", purchaseAllocations(legacy[1])[0].target === "agent" && purchaseAllocations(legacy[0])[0].target === "head" && purchaseAllocations(mk({ id: "X", type: "purchase", amount: 5 }))[0].target === "office",
    "agent / head / office synthesised from old fields");
  // 13. supplier-payment tags: validation + group paid (legacy parity, tagged lines)
  const pctx = { heads: new Set(["HA"]), agents: new Set(["AX"]), groups: new Set(["G"]) };
  const pOk = validatePaymentAllocations([{ id: "P1", target: "head", headId: "HA", amount: 30000 }, { id: "P2", target: "group", groupId: "G", amount: 15000 }, { id: "P3", target: "unallocated", amount: 5000 }], 50000, pctx);
  const pBad = validatePaymentAllocations([{ id: "P1", target: "head", headId: "HA", amount: 30000 }], 50000, pctx);
  const pUnk = validatePaymentAllocations([{ id: "P1", target: "group", groupId: "NOPE", amount: 5 }], 5, pctx);
  const legacyGroupPay = mk({ id: "S9", type: "supplier_payment", amount: 7000, headId: "HA", groupId: "G" });
  const taggedPay = mk({ id: "S10", type: "supplier_payment", amount: 50000, paymentAllocations: [{ id: "P1", target: "head", headId: "HA", amount: 30000 }, { id: "P2", target: "group", groupId: "G", amount: 15000 }, { id: "P3", target: "unallocated", amount: 5000 }] });
  check("13 payment tags", pOk.ok && !pBad.ok && pBad.remaining === 20000 && !pUnk.ok && paymentAmountForGroup(legacyGroupPay, "G") === 7000 && paymentAmountForGroup(taggedPay, "G") === 15000 && paymentAmountForGroup(taggedPay, "OTHER") === 0,
    `valid=${pOk.ok}; mismatch remaining=${pBad.remaining}; unknown group blocked=${!pUnk.ok}; legacy group pay=${paymentAmountForGroup(legacyGroupPay, "G")}; tagged group pay=${paymentAmountForGroup(taggedPay, "G")}`);
  return out;
}

if (typeof process !== "undefined" && process.argv[1] && process.argv[1].endsWith("allocations.selfcheck.ts")) {
  const res = runAllocationSelfCheck();
  res.forEach((r) => console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name.padEnd(32)} ${r.detail}`));
  const failed = res.filter((r) => !r.ok).length;
  console.log(failed ? `\n${failed} FAILED` : `\nAll ${res.length} checks passed`);
  if (failed) process.exit(1);
}
