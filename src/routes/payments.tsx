import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { distributePayment, formatCurrency } from "@/lib/data";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/payments")({
  component: PaymentsPage,
  head: () => ({ meta: [{ title: "Payments — AV Travel CRM" }] }),
});

function PaymentsPage() {
  const store = useStore();
  const [selectedHead, setSelectedHead] = useState(store.bookings[0]?.headId || "");
  const [paymentInput, setPaymentInput] = useState("");

  const booking = store.bookings.find((b) => b.headId === selectedHead);
  if (!booking) return <div className="p-8 text-muted-foreground">No bookings available</div>;

  const clients = store.clients.filter((c) => c.headId === selectedHead);
  const amountToUse = paymentInput ? Number(paymentInput) : booking.amountReceived;
  const distributedClients = distributePayment(clients, amountToUse);
  const totalPaid = distributedClients.reduce((s, c) => s + c.amountPaid, 0);
  const totalDue = distributedClients.reduce((s, c) => s + c.amountDue, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Payment Distribution" subtitle="Auto-distribute payments across clients under a Head ID" />

      <div className="flex flex-wrap gap-2">
        {store.bookings.map((b) => (
          <button key={b.headId} onClick={() => { setSelectedHead(b.headId); setPaymentInput(""); }}
            className={`rounded-lg px-4 py-2 text-xs font-medium transition-all ${selectedHead === b.headId ? "bg-primary text-primary-foreground" : "bg-accent/30 text-muted-foreground hover:bg-accent/50"}`}
          >{b.headId}</button>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5">
        <h3 className="mb-4 text-sm font-semibold">Payment Simulator — {selectedHead}</h3>
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div><p className="text-[10px] uppercase text-muted-foreground">Total Package</p><p className="text-lg font-bold">{formatCurrency(booking.totalAmount)}</p></div>
          <div><p className="text-[10px] uppercase text-muted-foreground">Received</p><p className="text-lg font-bold text-success">{formatCurrency(totalPaid)}</p></div>
          <div><p className="text-[10px] uppercase text-muted-foreground">Pending</p><p className="text-lg font-bold text-destructive">{formatCurrency(totalDue - totalPaid)}</p></div>
          <div className="flex items-end gap-2">
            <div className="flex-1"><p className="mb-1 text-[10px] uppercase text-muted-foreground">Simulate Payment</p><Input type="number" placeholder="Enter amount..." value={paymentInput} onChange={(e) => setPaymentInput(e.target.value)} className="bg-accent/20 border-border" /></div>
            <Button size="sm" onClick={() => setPaymentInput(String(booking.totalAmount))}>Full</Button>
          </div>
        </div>

        <div className="mb-4">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>{totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0}% collected</span>
            <span>{formatCurrency(totalPaid)} / {formatCurrency(totalDue)}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-accent/30">
            <motion.div className="h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${totalDue > 0 ? (totalPaid / totalDue) * 100 : 0}%` }} transition={{ duration: 0.6 }} />
          </div>
        </div>

        <div className="space-y-2">
          {distributedClients.map((c, i) => {
            const percent = c.amountDue > 0 ? Math.round((c.amountPaid / c.amountDue) * 100) : 0;
            return (
              <motion.div key={c.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                className="flex items-center gap-4 rounded-lg border border-border/30 bg-accent/10 px-4 py-3"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div><p className="text-sm font-medium">{`${c.firstName} ${c.lastName}`.trim()}</p><p className="text-xs text-muted-foreground">{c.id}</p></div>
                    <div className="text-right">
                      <p className="text-sm font-medium"><span className="text-success">{formatCurrency(c.amountPaid)}</span><span className="text-muted-foreground"> / {formatCurrency(c.amountDue)}</span></p>
                      <StatusBadge status={c.paymentStatus} />
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-accent/30">
                    <motion.div className={`h-full rounded-full ${c.paymentStatus === "Paid" ? "bg-success" : c.paymentStatus === "Partial" ? "bg-warning" : "bg-destructive/30"}`}
                      initial={{ width: 0 }} animate={{ width: `${percent}%` }} transition={{ duration: 0.4, delay: i * 0.05 }} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
