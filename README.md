# Avery Internarional travel Operations

Act like a senior SaaS architect and CRM system designer with 10+ years experience.

I want to build a HIGH-END, ENTERPRISE LEVEL CRM system for a Travel Agency (Umrah, Hajj, International Tours). This is NOT a basic CRM. It must have a luxury UI, fast performance, and smart financial distribution logic.

🎯 CORE REQUIREMENT:

Create a "HEAD ID BASED SYSTEM" where one main booking (Head ID) controls multiple clients under it.

-----------------------------------

🧠 SYSTEM STRUCTURE:

-----------------------------------

1. HEAD ID SYSTEM (MASTER BOOKING)

- Each booking has a unique HEAD ID

- Example: AV-HD-001

- Under one HEAD ID:

  - Multiple CLIENT IDs (family/group members)

  - One AGENT ID OR direct  AV-A001
- One Supplier ID  AV-S001

2. CLIENT ID SYSTEM

- Each person has a unique CLIENT ID   AV-C001

- Linked to HEAD ID

- Fields:

  - Name

  - Passport

  - Phone / WhatsApp ( FOR SENT REMINDER )

  - Package Type (Umrah / Hajj / Tour)

  - Individual Payment Status

3. AGENT ID SYSTEM

- Each sales agent has a unique AGENT ID AV-A001

- Track:

  - Total sales

  - Total clients handled

  - Commission tracking

-----------------------------------

💰 ADVANCED PAYMENT DISTRIBUTION LOGIC:

-----------------------------------

This is the most important feature:

- One HEAD ID has total package price (example: 5 persons = 500,000 PKR)

- Payments are received at HEAD level

⚙️ SYSTEM LOGIC:

- Payment received should AUTO DISTRIBUTE across CLIENT IDs

- Priority:

  1. First client FULL payment complete

  2. Then second client FULL

  3. Then third... and so on

Example:

- Total: 5 clients

- Payment received: 200,000

- System auto marks:

  - Client 1 = Paid ✅

  - Client 2 = Paid ✅

  - Client 3 = Partial / Pending

- Show:

  - Paid clients

  - Remaining balance per client

  - Total pending

-----------------------------------

🔍 SEARCH & FILTER PANEL (ADVANCED)

-----------------------------------

Create a powerful search system:

- Search by:

  - HEAD ID

  - CLIENT ID

  - AGENT ID

  - Name / Phone

- Filters:

  - Paid / Unpaid / Partial

  - Travel Type

  - Date range

  - VIP / Hot Lead

- Instant results (fast loading, no delay)

-----------------------------------

📊 DASHBOARD (HIGH-END UI)

-----------------------------------

- Total Revenue
 Each MONTH TOTAL RECORD LIKE TOTAL CLIENT , REVENUE , PROFIT 

- Pending Payments

- Active Bookings (HEAD IDs)

- Total Clients

- Agent Performance

Design:

- Premium dark theme (black + gold)

- Glassmorphism cards

- Smooth animations

- Mobile + Desktop optimized

-----------------------------------

📁 MODULES REQUIRED:

-----------------------------------

1. Booking Management (Head ID control)

2. Client Management (linked to Head)

3. Agent Management

4. Payment & Ledger System

5. Document Upload (passport, visa)

6. Auto Invoice Generator (PDF)

7. WhatsApp Integration (auto reminders)

8. Sales Pipeline (kanban view)

-----------------------------------

🤖 AUTOMATION FEATURES:

-----------------------------------

- Auto payment reminder 

- Auto follow-up messages

- Auto status update (paid / pending)

- Smart alerts:

  - "Head ID has pending balance"

-----------------------------------

🎨 DESIGN REQUIREMENTS:

-----------------------------------

- Clean, minimal, luxury UI

- Fast loading (optimized performance)

- Responsive design

- Professional typography (Inter / Poppins)

- Smooth hover + transition effects

-----------------------------------

🛠️ TECH STACK:

-----------------------------------

Frontend:

- React + Tailwind CSS

Backend:

- Firebase / Node.js

Database:

- Structured relational logic (Head → Clients → Payments)

-----------------------------------

🎯 FINAL GOAL:

-----------------------------------

This CRM should feel like a premium SaaS product, not a basic tool. It must be scalable, fast, and visually high-end, suitable for an international travel brand. WITH A BUTTON AUR PAGE TO ADD NEW SUPPLIER , CLIENT , AGENT ETC WITH THIER DETAIL 

Act like a senior SaaS product engineer and upgrade my existing CRM system into a HIGH-END ENTERPRISE TRAVEL CRM.

Current system already exists. Now implement advanced modules with automation, integrations, and financial tracking.

-----------------------------------

🎯 CORE UPGRADE REQUIREMENTS

-----------------------------------

Upgrade the system with the following ADVANCED modules:

-----------------------------------

📲 1. WHATSAPP AUTOMATION INTEGRATION

-----------------------------------

Integrate WhatsApp Business API with this number:

03302793701

Features:

- Auto send message when new client is added

- Auto send payment reminders

- Auto send booking confirmation

Advanced:

- If a user sends:

  - Passport image

  - CNIC

Then:

→ System automatically detects document

→ Extract basic data (Name, Passport No)

→ Create CLIENT ID under HEAD ID

-----------------------------------

📷 2. PASSPORT SCANNER (AI OCR)

-----------------------------------

- Upload or receive passport image

- Auto read:

  - Name

  - Passport Number

  - Nationality

- Auto-fill client form

- Store document in client profile

-----------------------------------

👤 3. SUPPLIER MANAGEMENT SYSTEM (VERY IMPORTANT)

-----------------------------------

Create a new module: SUPPLIERS

Each supplier should have:

- Supplier ID

- Company Name

- Contact Info

- Service Type (Visa / Hotel / Transport)

-----------------------------------

🔗 LINK SUPPLIER WITH BOOKING

-----------------------------------

When a client is CONFIRMED:

- Assign:

  - AGENT ID

  - SUPPLIER

Fields:

- Supplier Cost per client

- Total Supplier Cost (per HEAD ID)

-----------------------------------

💰 4. SUPPLIER LEDGER SYSTEM

-----------------------------------

Create a financial tracking system:

Each supplier should have:

- Total Payable

- Total Paid

- Remaining Balance

Transaction history:

- Payment Date

- Amount Paid

- Remaining after payment

Example:

Supplier Total = 300,000

Paid = 150,000

Remaining = 150,000

-----------------------------------

💳 5. PAYMENT TRACKING (CLIENT + SUPPLIER)

-----------------------------------

Client Side:

- Payment received (HEAD ID level)

- Auto distribution across clients (already existing logic)

Supplier Side:

- Payment made to supplier

- Remaining balance visible

-----------------------------------

🔍 6. ADVANCED SEARCH PANEL

-----------------------------------

Search by:

- HEAD ID

- CLIENT ID

- AGENT ID

- SUPPLIER ID

- Name / Phone

Filters:

- Paid / Unpaid / Partial

- Supplier Pending

- Confirmed / Not Confirmed

-----------------------------------

📊 7. DASHBOARD UPGRADE

-----------------------------------

Add:

- Total Supplier Payable

- Total Supplier Paid

- Profit (Client Payment - Supplier Cost)

-----------------------------------

🎨 DESIGN (HIGH-END UI)

-----------------------------------

- Premium dark theme (black + gold gradient)

- Glassmorphism cards

- Smooth animations

- Clean minimal layout

- Mobile + desktop responsive

-----------------------------------

🤖 AUTOMATION

-----------------------------------

- Auto WhatsApp reminders:

  - Client payment due

  - Supplier payment due

- Auto status:

  - If full client payment → mark “Fully Paid”

  - If supplier paid → update ledger

-----------------------------------

🔐 PERFORMANCE & EXPERIENCE

-----------------------------------

- Fast loading

- Real-time updates

- Clean UX (no clutter)

-----------------------------------

🎯 FINAL GOAL

-----------------------------------

This CRM should function like a professional travel ERP system used by international agencies, with strong financial tracking, automation, and premium UI. WITH EDITTALE VERSION ADD ANY NEW THINGS 




Act like a senior SaaS product designer and build a PREMIUM CLIENT PORTAL system inside my existing Travel CRM.

This is a separate CLIENT LOGIN AREA where each client can securely log in and view their travel details.

-----------------------------------

🎯 CORE SYSTEM

-----------------------------------

Create a CLIENT PORTAL with secure login:

Login using:

- CLIENT ID

- Phone Number (OTP verification)

Each client should ONLY see their own data.

-----------------------------------

🔐 AUTHENTICATION SYSTEM

-----------------------------------

- Login with:

  - Client ID + Phone Number

- OTP verification (via SMS or WhatsApp)

- Session security:

  - One time loging required only 

  - Secure token-based login

with differnet client portal link soo we will send client with professional theme design look with fast loaded and mobile friendly

-----------------------------------

📊 CLIENT DASHBOARD (HIGH-END UI)

-----------------------------------

After login, show a PREMIUM dashboard:

- Welcome message (Client Name)

- Travel Countdown (Days left)

- Booking Status:

  - Confirmed / Pending

-----------------------------------

🕋 TRAVEL DETAILS SECTION

-----------------------------------

Show all details in clean card layout:

1. HOTEL DETAILS

- Makkah Hotel (Name, Distance, Check-in/out)

- Madinah Hotel

2. FLIGHT DETAILS

- Airline Name

- Departure Date & Time

- Return Flight

3. TRANSPORT DETAILS

- Airport Pickup

- Ziyarat Transport

-----------------------------------

📅 ITINERARY / SCHEDULE

-----------------------------------

- Day-wise plan

- Ziyarat schedule

- Important instructions

-----------------------------------

📩 NOTIFICATIONS / MESSAGES

-----------------------------------

- Upcoming alerts:

  - Flight reminder

  - Hotel check-in

  - Travel tips

- Admin can send broadcast messages

-----------------------------------

📄 DOCUMENTS SECTION

-----------------------------------

Client can view/download:

- Ticket

- Visa

- Voucher

-----------------------------------

💳 PAYMENT STATUS

-----------------------------------

- Total Package Price

- Paid Amount

- Remaining Balance

-----------------------------------

📞 SUPPORT BUTTON

-----------------------------------

- One-click:

  - WhatsApp chat

  - Call button

-----------------------------------

🎨 DESIGN (VERY IMPORTANT)

-----------------------------------

- Premium luxury UI

- Mobile-first design

- Clean cards

- Smooth animations

- Colors:

  - Dark theme OR soft luxury (white + gold)

-----------------------------------

⚡ PERFORMANCE

-----------------------------------

- Fast loading

- Simple navigation

- No clutter

-----------------------------------

🎯 FINAL GOAL

-----------------------------------

Client should feel like they are using a premium international travel app, not a basic system. with differnet client portal link soo we will send client with professional theme design look with fast loaded and mobile friendly

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://avery-system.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/936fded5-b476-4b1a-8d52-11503399536f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
