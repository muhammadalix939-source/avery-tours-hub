import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard, BookOpen, Users, UserCog, Truck, CreditCard, Search, FileText, Settings, Receipt, BarChart3, Layers, Bell, Menu, X, Plane, Wallet, Database, RefreshCw, LogOut, Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { buildAlerts } from "@/lib/alerts";
import { auth, onAuthStateChanged, signInWithGoogle, logOut, type User } from "@/lib/firebase";
import { toast } from "sonner";

const sections = [
  { title: "Overview", items: [
    { to: "/", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/ai", icon: Sparkles, label: "Omni AI Assistant" },
    { to: "/alerts", icon: Bell, label: "Alerts" },
    { to: "/search", icon: Search, label: "Search" },
  ]},
  { title: "Operations", items: [
    { to: "/bookings", icon: BookOpen, label: "Bookings" },
    { to: "/groups", icon: Layers, label: "Groups" },
    { to: "/clients", icon: Users, label: "Clients" },
    { to: "/agents", icon: UserCog, label: "Agents" },
    { to: "/suppliers", icon: Truck, label: "Suppliers" },
  ]},
  { title: "Finance", items: [
    { to: "/accounts", icon: Wallet, label: "Accounts" },
    { to: "/payments", icon: CreditCard, label: "Payments" },
    { to: "/entries", icon: FileText, label: "Entries" },
    { to: "/expenses", icon: Receipt, label: "Expenses" },
    { to: "/drawings", icon: Receipt, label: "Drawings" },
    { to: "/reports", icon: BarChart3, label: "Financial Reports" },
  ]},
  { title: "System", items: [
    { to: "/settings", icon: Settings, label: "Settings" },
  ]},
] as const;

import { Undo2 } from "lucide-react";

export default function AppSidebar() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [mounted, setMounted] = useState(false);
  const store = useStore();

  useEffect(() => {
    setMounted(true);
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);
  const unread = useMemo(() => {
    try {
      return buildAlerts({ clients: store.clients, bookings: store.bookings, agents: store.agents, suppliers: store.suppliers, entries: store.entries, accounts: store.accounts, settings: store.alertSettings })
        .filter((a) => !store.readAlerts.includes(a.id)).length;
    } catch { return 0; }
  }, [store.clients, store.bookings, store.agents, store.suppliers, store.entries, store.accounts, store.alertSettings, store.readAlerts]);
  useEffect(() => { setOpen(false); }, [location.pathname]);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-sidebar-border bg-sidebar/95 backdrop-blur-md px-4 md:hidden">
        <div className="flex items-center gap-2.5">
          <img
            src="/avery-gold-logo.jpg"
            alt="Avery Logo"
            className="h-8 w-8 rounded-full border border-primary/50 object-cover shadow-sm"
          />
          <div>
            <span className="font-display text-sm font-bold tracking-wide gold-text">AVERY</span>
            <span className="ml-1 text-[11px] text-muted-foreground">Travel & Tours</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {store.hasUndo && store.hasUndo() && (
            <button
              onClick={() => store.undoLastAction && store.undoLastAction()}
              title="Undo last action"
              className="flex items-center gap-1 rounded-md border border-primary/50 bg-primary/10 px-2 py-1 text-xs font-medium text-primary active-press"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Undo
            </button>
          )}
          <Link to="/alerts" aria-label="Alerts" className="relative rounded-md border border-border p-2 text-foreground active-press">
            <Bell className="h-5 w-5" />
            {mounted && unread > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">{unread}</span>}
          </Link>
          <button aria-label="Open menu" onClick={() => setOpen(true)} className="rounded-md border border-border p-2 text-foreground active-press">
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {open && <div className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm md:hidden" onClick={() => setOpen(false)} />}

      <aside className={`fixed left-0 top-0 z-50 flex h-screen w-[260px] flex-col border-r border-sidebar-border bg-sidebar/95 backdrop-blur-xl transition-transform duration-300 md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-3.5">
          <img
            src="/avery-gold-logo.jpg"
            alt="Avery International Travel & Tours"
            className="h-8 w-8 rounded-full border border-primary/50 object-cover shadow-sm gold-glow"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-display text-sm font-bold leading-none gold-text tracking-wide">AVERY</span>
              <span className="text-[10px] text-muted-foreground font-medium truncate">Travel & Tours</span>
            </div>
            <p className="text-[8.5px] uppercase tracking-[0.15em] text-muted-foreground/75 mt-0.5">Operations Suite</p>
          </div>
          <button aria-label="Close menu" onClick={() => setOpen(false)} className="text-muted-foreground md:hidden active-press"><X className="h-4 w-4" /></button>
        </div>

        {/* Global Undo Banner if active */}
        {mounted && store.hasUndo && store.hasUndo() && (
          <div className="mx-2.5 mt-2 shrink-0 rounded border border-primary/40 bg-primary/10 px-2 py-1 text-center">
            <button
              onClick={() => store.undoLastAction && store.undoLastAction()}
              className="flex w-full items-center justify-center gap-1 text-[11px] font-semibold text-primary hover:underline active-press"
            >
              <Undo2 className="h-3 w-3" />
              Revert / Undo Last Action
            </button>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-2.5 py-2">
          {sections.map((s) => (
            <div key={s.title} className="mb-2">
              <p className="mb-0.5 px-2 text-[9.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground/70">{s.title}</p>
              <div className="space-y-0.5">
                {s.items.map((item) => {
                  const isActive = location.pathname === item.to || (item.to !== "/" && location.pathname.startsWith(item.to));
                  return (
                    <Link key={item.to} to={item.to}
                      className={`relative flex items-center gap-2.5 rounded px-2.5 py-1.5 text-[12.5px] leading-tight transition-all touch-effect ${isActive ? "bg-sidebar-accent font-semibold text-foreground shadow-sm" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"}`}
                    >
                      {isActive && <span className="absolute left-0 top-1 bottom-1 w-[2.5px] rounded-r bg-primary gold-glow" />}
                      <item.icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-primary" : ""}`} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {mounted && item.to === "/alerts" && unread > 0 && <span className="rounded-full bg-destructive px-1.5 py-0.2 text-[9px] font-semibold leading-none text-destructive-foreground">{unread}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Database & Cloud Connection Status */}
        <div className="shrink-0 border-t border-sidebar-border bg-sidebar/80 p-2">
          <div className="rounded border border-border/50 bg-card/50 p-2">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${mounted && user ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                <span className="text-[10px] font-medium text-foreground">
                  {mounted && user ? "Cloud DB Active" : "Local DB (Ready)"}
                </span>
              </div>
              <span className="text-[8.5px] uppercase tracking-wider text-muted-foreground font-mono">
                Firestore
              </span>
            </div>

            {mounted && user ? (
              <div className="space-y-1.5">
                <div className="truncate text-[10px] text-muted-foreground">
                  {user.email || user.displayName}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={async () => {
                      try {
                        toast.loading("Syncing with Firestore...", { id: "cloud-sync" });
                        await store.syncToCloud();
                        toast.success("Synced with Cloud DB", { id: "cloud-sync" });
                      } catch {
                        toast.error("Sync failed", { id: "cloud-sync" });
                      }
                    }}
                    disabled={store.cloudSyncStatus === "syncing"}
                    className="flex flex-1 items-center justify-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/20 transition-colors"
                  >
                    <RefreshCw className={`h-2.5 w-2.5 ${store.cloudSyncStatus === "syncing" ? "animate-spin" : ""}`} />
                    Sync Cloud
                  </button>
                  <button
                    onClick={async () => {
                      await logOut();
                      setUser(null);
                      toast.info("Signed out of Cloud DB");
                    }}
                    title="Sign Out"
                    className="rounded border border-border p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <LogOut className="h-2.5 w-2.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <button
                  onClick={async () => {
                    try {
                      const u = await signInWithGoogle();
                      setUser(u);
                      toast.success(`Connected as ${u.email}`);
                      await store.syncToCloud();
                    } catch (err: unknown) {
                      toast.error(err instanceof Error ? err.message : "Sign-in failed");
                    }
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Database className="h-3 w-3" />
                  Connect Cloud DB
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-sidebar-border px-3 py-1.5 text-[9px] uppercase tracking-[0.14em] text-muted-foreground/75 text-center">
          Umrah · Hajj · Tours · Visa
        </div>
      </aside>
    </>
  );
}
