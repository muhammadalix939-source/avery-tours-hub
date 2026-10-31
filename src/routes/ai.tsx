import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Send,
  Copy,
  Check,
  Bot,
  Compass,
  TrendingUp,
  MessageSquare,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  Database,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import PageHeader from "@/components/PageHeader";
import { useStore } from "@/lib/store";
import { formatCurrency } from "@/lib/data";
import { runOmniAIRoute } from "@/lib/ai.server";
import { toast } from "sonner";

export const Route = createFileRoute("/ai")({
  component: OmniAIPage,
  head: () => ({
    meta: [
      { title: "Omni AI Assistant — Avery Travel CRM" },
      { name: "description", content: "Free LLM API and Omni Router for Travel Itineraries, Financial Analysis, and Client Messaging." },
    ],
  }),
});

type AIMode = "crm_assistant" | "itinerary_generator" | "profit_advisor" | "client_message_drafter";

const MODES: Array<{ id: AIMode; label: string; icon: typeof Bot; desc: string }> = [
  {
    id: "crm_assistant",
    label: "CRM Copilot",
    icon: Bot,
    desc: "Ask queries about your bookings, agents, revenue, and daily operations",
  },
  {
    id: "itinerary_generator",
    label: "Itinerary Builder",
    icon: Compass,
    desc: "Generate professional day-by-day Umrah, Hajj & Tour travel packages",
  },
  {
    id: "profit_advisor",
    label: "Profit Advisor",
    icon: TrendingUp,
    desc: "Analyze profit margins, supplier cost efficiency & cash flow strategy",
  },
  {
    id: "client_message_drafter",
    label: "Client Messaging",
    icon: MessageSquare,
    desc: "Draft personalized WhatsApp/SMS alerts in English & Roman Urdu",
  },
];

const QUICK_PROMPTS: Record<AIMode, string[]> = {
  crm_assistant: [
    "Give me an executive summary of our active bookings and overall business health.",
    "Which agent has brought the most revenue and what is their commission?",
    "Review our outstanding client balances and suggest immediate collection priorities.",
    "Summarize all pending travel dates scheduled for the upcoming 30 days.",
  ],
  itinerary_generator: [
    "Create a 15-day VIP Umrah itinerary with 5 nights in Makkah (Clock Tower) and 5 nights in Madinah (Dar Al Taqwa). Include Ziyarat points.",
    "Draft a 10-day Economy Umrah itinerary for a family of 4 with private transport between Jeddah, Makkah, and Madinah.",
    "Design a 7-day Northern Pakistan Tour itinerary (Hunza, Skardu, Attabad Lake) with hotels and meal plans.",
    "Generate a 21-day Standard Hajj package schedule with Aziziya shifting and Mina/Arafat guidance.",
  ],
  profit_advisor: [
    "Analyze our package revenue vs supplier purchase costs and suggest margin improvements.",
    "How should we price our upcoming Ramadan Umrah packages to maximize gross margins?",
    "Evaluate our supplier payables and suggest an optimal payment schedule to preserve cash on hand.",
    "What strategies can help increase our booking ticket size and client retention?",
  ],
  client_message_drafter: [
    "Draft a polite WhatsApp payment reminder for a client whose remaining balance of Rs 150,000 is overdue before travel.",
    "Draft an official booking confirmation message with flight details and hotel check-in instructions in Urdu & English.",
    "Create a welcome message wishing a blessed journey to an Umrah family departing tomorrow.",
    "Draft a notification informing a client that their Saudi Umrah eVisa has been successfully issued.",
  ],
};

function OmniAIPage() {
  const store = useStore();
  const [mounted, setMounted] = useState(false);
  const [activeMode, setActiveMode] = useState<AIMode>("crm_assistant");
  const [prompt, setPrompt] = useState("");
  const [includeContext, setIncludeContext] = useState(true);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [responseModel, setResponseModel] = useState<string>("gemini-3.8-flash");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Compute live CRM snapshot for the Omni Router
  const crmSnapshot = useMemo(() => {
    const totalRev = store.bookings.reduce((s, b) => s + (b.amountReceived || 0), 0) + (store.opening.revenue || 0);
    const totalPurchases = store.entries.filter((e) => e.type === "purchase").reduce((s, e) => s + e.amount, 0);
    const totalExpenses = store.entries.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);
    const totalProfit = totalRev - totalPurchases - totalExpenses + (store.opening.profit || 0);
    const supplierDue = store.suppliers.reduce((s, sp) => s + Math.max(0, (sp.totalPayable || 0) - (sp.totalPaid || 0)), 0);

    return {
      totalRevenue: totalRev,
      totalProfit,
      totalBookings: store.bookings.length,
      totalClients: store.clients.length,
      supplierDue,
      recentBookings: store.bookings.slice(0, 5).map((b) => ({
        headId: b.headId,
        packageType: b.packageType,
        amount: b.totalAmount,
        status: b.status,
      })),
      topAgents: store.agents.slice(0, 5).map((a) => ({
        name: a.name,
        clients: a.totalClients,
        sales: a.totalSales,
      })),
    };
  }, [store.bookings, store.clients, store.suppliers, store.entries, store.agents, store.opening]);

  const handleSend = async (customPrompt?: string) => {
    const textToSend = (customPrompt || prompt).trim();
    if (!textToSend) {
      toast.info("Please enter a prompt or pick a quick suggestion");
      return;
    }

    setLoading(true);
    setResponse(null);

    try {
      const res = await runOmniAIRoute({
        data: {
          mode: activeMode,
          prompt: textToSend,
          crmSnapshot: includeContext ? crmSnapshot : undefined,
        },
      });

      if (res.success && res.content) {
        setResponse(res.content);
        setResponseModel(res.model || "gemini-3.8-flash");
        toast.success("AI response generated");
      } else {
        toast.error(res.error || "Failed to generate response");
        setResponse(`Error: ${res.error || "Could not retrieve response from Gemini API"}`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error communicating with Omni AI server";
      toast.error(msg);
      setResponse(`Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!response) return;
    navigator.clipboard.writeText(response);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Omni AI Assistant"
        subtitle="Executive AI Co-pilot & Itinerary Generator powered by Gemini 3.8 Flash"
        actions={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Omni Router · Gemini 3.8 Flash</span>
            </span>
          </div>
        }
      />

      {/* Mode Switcher Tabs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {MODES.map((m) => {
          const Icon = m.icon;
          const isSelected = activeMode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => {
                setActiveMode(m.id);
                setResponse(null);
              }}
              className={`flex flex-col text-left rounded-xl p-4 border transition-all ${
                isSelected
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "border-border/60 bg-card/60 hover:border-border hover:bg-card/90"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`p-2 rounded-lg ${isSelected ? "bg-primary text-primary-foreground" : "bg-accent/40 text-foreground"}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className="font-semibold text-sm text-foreground">{m.label}</span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{m.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Live Context Snapshot Banner */}
      {mounted && (
        <div className="rounded-xl border border-border/60 bg-accent/15 p-4 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary shrink-0" />
              <div>
                <span className="font-semibold text-foreground">Live CRM Context Feed</span>
                <p className="text-[11px] text-muted-foreground">
                  The Omni Router seamlessly injects real-time agency metrics into prompts for accurate answers.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-3 font-mono text-[11px]">
                <span className="text-muted-foreground">Rev: <strong className="text-foreground">{formatCurrency(crmSnapshot.totalRevenue)}</strong></span>
                <span className="text-muted-foreground">Profit: <strong className="text-success">{formatCurrency(crmSnapshot.totalProfit)}</strong></span>
                <span className="text-muted-foreground">Bookings: <strong className="text-foreground">{crmSnapshot.totalBookings}</strong></span>
              </div>

              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeContext}
                  onChange={(e) => setIncludeContext(e.target.checked)}
                  className="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5"
                />
                <span className="text-[11px] text-muted-foreground">Include Context</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Prompt Input & Quick Starters */}
        <div className="space-y-4 lg:col-span-5">
          <div className="glass-card rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                Prompt & Request
              </h3>
              <span className="text-[11px] text-muted-foreground font-mono">
                {MODES.find((m) => m.id === activeMode)?.label}
              </span>
            </div>

            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={`Type your instructions in English, Urdu, or Roman Urdu...\ne.g. "${QUICK_PROMPTS[activeMode][0]}"`}
              rows={5}
              className="resize-none text-sm bg-background/60"
            />

            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPrompt("");
                  setResponse(null);
                }}
                className="text-xs text-muted-foreground h-8"
              >
                Clear
              </Button>

              <Button
                onClick={() => handleSend()}
                disabled={loading || !prompt.trim()}
                size="sm"
                className="gap-2 text-xs h-8"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>Ask Omni AI</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Quick Prompts Suggestions */}
          <div className="glass-card rounded-xl p-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Suggested {MODES.find((m) => m.id === activeMode)?.label} Prompts
            </p>
            <div className="space-y-2">
              {QUICK_PROMPTS[activeMode].map((qp, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setPrompt(qp);
                    handleSend(qp);
                  }}
                  disabled={loading}
                  className="group flex w-full items-start gap-2 rounded-lg border border-border/50 bg-accent/10 p-2.5 text-left text-xs transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0 mt-0.5" />
                  <span className="text-foreground/90 group-hover:text-foreground">{qp}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: AI Output Canvas */}
        <div className="lg:col-span-7">
          <div className="glass-card rounded-xl p-6 min-h-[460px] flex flex-col">
            <div className="flex items-center justify-between border-b border-border/50 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold">Executive AI Response</h4>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    Model: {responseModel} · Latency: Low
                  </p>
                </div>
              </div>

              {response && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="gap-1.5 text-xs h-8"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </Button>
              )}
            </div>

            <div className="flex-1 flex flex-col justify-start">
              {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
                  <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Omni AI is thinking...</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Routing through Gemini 3.8 Flash with live CRM context
                    </p>
                  </div>
                </div>
              ) : response ? (
                <div className="prose prose-sm dark:prose-invert max-w-none text-foreground text-xs leading-relaxed whitespace-pre-wrap font-sans bg-accent/5 p-4 rounded-lg border border-border/40 overflow-y-auto max-h-[600px]">
                  {response}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                  <Bot className="h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-medium text-foreground">Omni AI Assistant Ready</p>
                  <p className="text-xs max-w-md mt-1">
                    Select a suggested prompt from the left or type any custom request. Your assistant has direct access to live bookings, package details, and financial ledgers.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
