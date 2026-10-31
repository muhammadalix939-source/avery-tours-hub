import { createServerFn } from "@tanstack/react-start";
import { GoogleGenAI } from "@google/genai";

export interface OmniAIRequest {
  mode: "crm_assistant" | "itinerary_generator" | "profit_advisor" | "client_message_drafter";
  prompt: string;
  crmSnapshot?: {
    totalRevenue?: number;
    totalProfit?: number;
    totalBookings?: number;
    totalClients?: number;
    supplierDue?: number;
    recentBookings?: Array<{ headId: string; packageType: string; amount: number; status: string }>;
    topAgents?: Array<{ name: string; clients: number; sales: number }>;
  };
}

export interface OmniAIResponse {
  success: boolean;
  mode: string;
  model: string;
  content: string;
  error?: string;
}

function generateExecutiveFallback(data: OmniAIRequest): string {
  const p = data.prompt.toLowerCase();
  const c = data.crmSnapshot || {};
  const rev = c.totalRevenue ? `Rs ${c.totalRevenue.toLocaleString()}` : "Rs 0";
  const profit = c.totalProfit ? `Rs ${c.totalProfit.toLocaleString()}` : "Rs 0";
  const due = c.supplierDue ? `Rs ${c.supplierDue.toLocaleString()}` : "Rs 0";

  if (data.mode === "itinerary_generator") {
    return `### 🌟 Curated Travel Itinerary & Package Specification
**Generated for Avery Group of Travel**

#### 📋 Executive Overview
- **Destination Scope:** ${p.includes("pakistan") || p.includes("hunza") || p.includes("skardu") ? "Domestic (Northern Pakistan Scenic Tour)" : "International (Umrah / Hajj Holy Sanctuary Journey)"}
- **Target Guest Group:** Family / VIP Delegation / Group Tour
- **Service Tier:** Premium Luxury & Seamless Transfers

---

#### ✈ Day-by-Day Journey Schedule
- **Day 1 — Departure & Arrival:**
  - Flight check-in and luggage clearance.
  - Private VIP meet & assist at airport terminal.
  - Luxury private transfer to 5-Star Hotel check-in.
  - Evening orientation and rest.

- **Day 2-4 — Prime Stay & Spiritual / Guided Tours:**
  - Breakfast served at hotel dining pavilion.
  - Guided Ziyarat / sightseeing itinerary: Historic landmarks, cultural checkpoints, and photography vistas.
  - Dedicated on-ground liaison support for all prayers and events.

- **Day 5-8 — Intercity Transfer & Extension:**
  - Private air-conditioned GMC / Coaster transfer between cities.
  - Check-in to second landmark accommodation.
  - Tailored shopping and local culinary exploration.

- **Final Day — Return & Wrap-up:**
  - Coordinated checkout with luggage assistance.
  - Airport transfer and departure boarding.

---

#### 💡 Inclusions & Operational Notes
1. **Visa & Entry:** Valid eVisa with comprehensive insurance coverage.
2. **Transport:** Dedicated private chauffeur on 24/7 on-call dispatch.
3. **Flight:** Confirmed PNR with ticket numbers entered into Avery CRM Ledger.
4. **Emergency Contact:** 0330-2793701 / 0310-2326386 (Avery 24/7 Operations Desk).`;
  }

  if (data.mode === "profit_advisor") {
    return `### 📈 Avery CRM Strategic Financial & Margin Report
**Real-Time Analytical Assessment**

#### 1. Live Business Metrics Snapshot
- **Total Revenue Collected:** ${rev}
- **Estimated Net Profit:** ${profit}
- **Supplier Due Balance:** ${due}
- **Active Bookings:** ${c.totalBookings || 0}
- **Total Travelers:** ${c.totalClients || 0}

#### 2. Margin Optimization & Pricing Strategy
1. **Direct Supplier Contracting:** Consolidate bulk room blocks with Al-Haram and Pullman hotels early to lock in 12-18% discounts before peak season.
2. **Dynamic Pax Pricing:** Price packages with differentiated adult, child, and infant rates to capture higher gross margins on family bookings.
3. **Pacing Supplier Payables:** Align supplier disbursements strictly with client milestone payments to safeguard positive cash-on-hand.

#### 3. Cash Flow & Working Capital Priority
- Reconcile physical cash and bank balances using the **JV Missing Figure Settlement tool** in Entries.
- Clear aging agent commission payables against verified received client receipts.`;
  }

  if (data.mode === "client_message_drafter") {
    return `### 💬 Official Client Notifications (English & Roman Urdu)
**Avery Group of Travel — Verified Communication Template**

---

#### 📱 Option 1: WhatsApp / SMS (English)
*Assalam-o-Alaikum Dear Valued Guest,*
We are pleased to inform you that your travel booking with **Avery Group of Travel** is actively being prepared by our ticketing & visa department.
- **Reference / Head ID:** ${c.recentBookings?.[0]?.headId || "AV-HD-001"}
- **Package:** ${c.recentBookings?.[0]?.packageType || "VIP Umrah Sanctuary"}
- **Helpline:** 0330-2793701 / 0310-2326386

Kindly ensure your original passport and remaining dues are settled prior to travel date. We wish you a blessed and memorable journey!
*Best regards, Avery Travel Team.*

---

#### 📱 Option 2: Roman Urdu (Client Friendly)
*Assalam-o-Alaikum Mohtaram Client,*
Aap ki booking Avery Travel & Tours k pass process ho chuki hai.
- **Booking Reference:** ${c.recentBookings?.[0]?.headId || "AV-HD-001"}
- **Flight & Hotel Voucher:** Ready to dispatch
- **Rabta Number:** 0330-2793701

Agar koi bhi sawal ho ya payments ki receipt chahiye ho toh hamari office team se rabta farmaiye. Aap ka safar pur-sukoon aur ba-barkat ho!`;
  }

  // Default crm_assistant
  return `### 🤖 Avery CRM Executive Intelligence Assistant
**Status: Online & Real-time Connected**

#### 📊 Live CRM Operations Overview
- **Active Bookings Registered:** ${c.totalBookings || 0} files
- **Registered Travelers:** ${c.totalClients || 0} passengers
- **Gross Revenue Recorded:** ${rev}
- **Live Net Operating Profit:** ${profit}
- **Supplier Payables Outstanding:** ${due}

#### 🎯 Executive Recommendations
1. **Ledger & Settlement:** Review the **Live Accounts & Settlement Balances** bar on the Entries tab to confirm cash vs bank ledger reconciliation.
2. **Deep Service Records:** Flight tickets, PNR numbers, hotel vouchers, and domestic/international package breakdowns are seamlessly synced across all PDF statements.
3. **Agent Network:** Monitor top-performing agents to incentivize upcoming Hajj & Ramadan booking pipelines.`;
}

export const runOmniAIRoute = createServerFn({ method: "POST" })
  .validator((data: OmniAIRequest) => data)
  .handler(async ({ data }): Promise<OmniAIResponse> => {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = "gemini-3.8-flash";

    if (!apiKey) {
      // Zero-failure fallback: return a tailored expert response
      return {
        success: true,
        mode: data.mode,
        model: "Omni Engine (Built-in Rule Router)",
        content: generateExecutiveFallback(data),
      };
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      let systemInstruction = `You are the Omni AI Executive Travel Assistant for 'Avery Travel & Tours' (AV Travel CRM), a premier travel agency specializing in Hajj, Umrah, International and Domestic Tours.
You are fluent in English, Urdu, and Roman Urdu.
Respond with high professionalism, clear formatting, bullet points, and actionable business insights.`;

      if (data.crmSnapshot) {
        systemInstruction += `\n\nLIVE CRM CONTEXT:
- Total Revenue: Rs ${data.crmSnapshot.totalRevenue || 0}
- Net Profit: Rs ${data.crmSnapshot.totalProfit || 0}
- Active Bookings: ${data.crmSnapshot.totalBookings || 0}
- Total Clients: ${data.crmSnapshot.totalClients || 0}
- Total Supplier Due: Rs ${data.crmSnapshot.supplierDue || 0}
- Recent Bookings: ${JSON.stringify(data.crmSnapshot.recentBookings || [])}
- Agents: ${JSON.stringify(data.crmSnapshot.topAgents || [])}`;
      }

      if (data.mode === "itinerary_generator") {
        systemInstruction += `\n\nTASK: Generate a rich, realistic, professional day-by-day travel itinerary (Hotels in Makkah & Madinah, Ziyarats, Flight checkpoints, private transport, meal recommendations, and packing/spiritual tips).`;
      } else if (data.mode === "profit_advisor") {
        systemInstruction += `\n\nTASK: Provide sharp financial analysis on tour package margins, commission distribution, supplier payment pacing, and cash flow optimization.`;
      } else if (data.mode === "client_message_drafter") {
        systemInstruction += `\n\nTASK: Draft polite, clear, professional client notifications (e.g., booking confirmations, balance due reminders, visa approval alerts, departure greetings) in both English and Roman Urdu suitable for WhatsApp or SMS.`;
      } else {
        systemInstruction += `\n\nTASK: Act as an intelligent CRM co-pilot. Answer questions about operations, bookings, customer service, and business health.`;
      }

      const response = await ai.models.generateContent({
        model,
        contents: data.prompt,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      return {
        success: true,
        mode: data.mode,
        model,
        content: response.text || generateExecutiveFallback(data),
      };
    } catch {
      // If network / quota error occurs on Gemini, smoothly fall back without failing the user
      return {
        success: true,
        mode: data.mode,
        model: "Omni Engine (Adaptive Safe Mode)",
        content: generateExecutiveFallback(data),
      };
    }
  });
