# Axiom — Complete Project Documentation

**Project:** Axiom — Professional 3D Printing Business Platform
**Domain:** [www.axiomcreate.com](https://www.axiomcreate.com)
**Repository:** https://github.com/Andreasm21/aprinting
**Live Vercel:** https://aprinting-cayk.vercel.app
**Region:** Cyprus 🇨🇾
**Stack:** React 19 + Vite + TypeScript + Tailwind CSS v3 + Supabase (PostgreSQL) + Resend (email) + Vercel (hosting)

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Routes Map](#routes-map)
5. [Public Marketing Site](#public-marketing-site)
6. [Customer-Facing Public Pages](#customer-facing-public-pages-no-login)
7. [Customer Portal](#customer-portal-login-required)
8. [Admin Application](#admin-application-staff-login)
9. [Fulfillment Process Model](#fulfillment-process-model)
10. [State Management (Zustand Stores)](#state-management-zustand-stores)
11. [Database Schema](#database-schema)
12. [Pricing Engine — The Formula](#pricing-engine--the-formula)
13. [Quote → Order → Invoice Lifecycle](#quote--order--invoice-lifecycle)
14. [Inventory & Stock Auto-Deduct](#inventory--stock-auto-deduct)
15. [Print Job Manager](#print-job-manager)
16. [Email System (Resend)](#email-system-resend)
17. [Notifications](#notifications)
18. [Realtime Sync (Supabase Realtime)](#realtime-sync-supabase-realtime)
19. [Authentication](#authentication)
20. [Security Model](#security-model)
21. [File Structure](#file-structure)
22. [Environment Variables](#environment-variables)
23. [Deployment](#deployment)
24. [Operational Workflows](#operational-workflows)
25. [Pending / Future Work](#pending--future-work)

---

## Overview

Axiom is an end-to-end 3D printing business platform covering four distinct user surfaces, all served from a single React SPA + Vercel serverless API:

| Surface | URL | Audience |
|---|---|---|
| **Marketing site** | `/` | Public visitors browsing services |
| **Public quote viewer** | `/quote/:id` | Customer accepting a quote |
| **Public order tracking** | `/track/:id` | Customer following an active order |
| **Customer portal** | `/portal/*` | Logged-in customer managing their account |
| **Admin panel** | `/admin/*` | Internal staff running the business |

The entire system is **Supabase-only for shared admin data** (no localStorage caching that would cause stale-data bugs across browsers). Every CRUD operation flows through Supabase REST API + Realtime subscriptions, so changes propagate live across open admin tabs.

The **pricing engine** is the heart of the system: a single formula (`Material + Electricity + Labour + Depreciation × Markup`) drives every quote, invoice, and stock deduction. Material costs come from the live inventory; everything else is configured in Admin → Pricing.

---

## Tech Stack

### Frontend
- **React 19** + **TypeScript 5.9** (strict)
- **Vite 8** for dev/build
- **Tailwind CSS v3** with custom theme:
  - `bg-primary` `#0a0a0a`, `bg-secondary` `#171717`, `bg-tertiary` `#1f1f1f`
  - `accent-amber` `#F59E0B`, `accent-blue` `#3B82F6`, `accent-green` `#10B981`
  - Mono headers (JetBrains Mono / SF Mono), Inter for body copy
- **Zustand** for global state (no Redux/RTK Query — keeps the bundle lean)
- **React Router v7** for routing
- **lucide-react** for icons
- **html2canvas + jsPDF** for client-side PDF generation
- **bcryptjs** for password hashing in the browser (admin auth + customer portal)

### Backend / Infrastructure
- **Supabase** (PostgreSQL 17 + Realtime + REST API) — single source of truth
- **Vercel** for hosting + serverless functions (Node runtime)
- **Resend** for outbound email (invoices, quotations, credentials, low-stock alerts)
- **Zustand stores** that read/write to Supabase directly via the anon key (RLS open since admin sits behind a separate auth layer)

### Build / Dev
- TypeScript `tsc -b` + `vite build` produces a ~390KB gzipped bundle
- Single-page app served from `/`; everything else handled by client-side React Router
- `vercel.json` rewrites all paths to `index.html` so SPA routing works

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  www.axiomcreate.com                    │
│                  (CNAME → Vercel)                       │
└─────────────────────────────────────────────────────────┘
                            │
              ┌─────────────┴──────────────┐
              ↓                            ↓
    ┌───────────────────┐      ┌──────────────────────┐
    │ Static SPA        │      │ /api/send-email      │
    │ (Vite build)      │      │ Vercel Node function │
    │                   │      │ → Resend API         │
    │ React Router      │      └──────────────────────┘
    │ ├── /             │
    │ ├── /quote/:id    │
    │ ├── /track/:id    │
    │ ├── /portal/*     │
    │ └── /admin/*      │
    └─────────┬─────────┘
              │
              │ supabase-js (anon key)
              ↓
    ┌─────────────────────────────────────────┐
    │ Supabase (uohmzjdcrwwnzsoevbpf)         │
    │ ├── Postgres tables (RLS open)          │
    │ │   ├─ customers, documents, orders     │
    │ │   ├─ inventory_products, stock_movements
    │ │   ├─ notifications, email_log         │
    │ │   ├─ admin_users, audit_log           │
    │ │   ├─ purchase_orders, customer_activities
    │ │   ├─ print_jobs, site_content         │
    │ │   └─ storefront_products              │
    │ └── Realtime publication (orders,       │
    │     documents, notifications)           │
    └─────────────────────────────────────────┘
```

### Why Supabase-only?

Earlier versions of the app dual-wrote to localStorage AND Supabase for "snappy UX." This caused two long-running bugs:
1. **Deletes coming back** — admin A deletes a record; admin B with stale localStorage pushes it back up on next bootstrap
2. **Stale state across browsers** — site content (hero/about/pricing) lived only in localStorage so each browser had its own copy

The fix: removed localStorage from every shared admin store. All reads are from Supabase with Realtime subscriptions for live sync. The only stores that intentionally still use localStorage are per-browser ephemeral state:
- `quoteCartStore` — admin's draft quote-in-progress
- `cartStore` — public storefront shopping cart
- `appStore` — UI state (filters, modals, language)
- `visitorStore` — anonymous public-site analytics
- `portalAuthStore` — customer portal session token only (not data)

### Why Zustand instead of Redux?

The data shape is simple and the set of mutations is well-defined per resource. Zustand stores compose naturally with the Supabase client — each store wraps a Supabase table, exposes async CRUD methods, and subscribes to Realtime changes. No need for action creators, reducers, or middleware.

---

## Routes Map

### Public (no auth)
| Path | Component | What it does |
|---|---|---|
| `/` | `SitePage` (`src/App.tsx`) | Marketing home — Hero, Services, Products, Pricing, How It Works, Machines, Portfolio, About, FindYourOrder, CustomPartRequest |
| `/quote/:id` | `PublicQuoteView` | Customer view of a quotation with Accept / Request Changes / Request Account buttons |
| `/track/:id` | `PublicOrderTracking` | Customer-facing order status pipeline + invoice download |

### Customer Portal (portal login)
| Path | Component |
|---|---|
| `/portal` | `PortalLayout` (login redirect / dashboard) |
| `/portal` (logged in) | `PortalDashboard` |
| `/portal/documents` | `PortalDocuments` — quotes + invoices |
| `/portal/orders` | `PortalOrders` — order list with mini status pipeline + Track button |
| `/portal/store` | `PortalStore` — repeat order from past products |
| `/portal/profile` | `PortalProfile` — customer details + change password |

### Admin (admin login)
| Path | Component | Purpose |
|---|---|---|
| `/admin` | `AdminDashboard` | Fulfillment flow map + KPI tiles + recent activity |
| `/admin/notifications` | `AdminNotifications` | Request/Order intake — orders, part requests, contact messages, admin alerts |
| `/admin/customers` | `AdminCustomers` | Customer list, filters, bulk delete |
| `/admin/customers/:id` | `AdminCustomerProfile` | Customer detail + activity timeline + portal credentials |
| `/admin/team` | `AdminTeam` | Manage admin users (owner/admin/staff) |
| `/admin/activity` | `AdminActivityLog` | Audit log of every admin action |
| `/admin/orders` | `AdminOrdersOverview` | Fulfillment orders list with route/stage badges, KPIs, delete |
| `/admin/orders/:id` | `AdminOrderProfile` | Order detail — flow map, quote/payment cards, tracking link, timeline, status selector |
| `/admin/orders/quotations` | `AdminQuotations` (in OrdersLayout) | **Quotation** step — quotations list + create/edit |
| `/admin/orders/print` | `InventoryQueue` with OrdersLayout | **Print** step — Print Job Manager for custom + off-the-shelf jobs |
| `/admin/orders/invoices` | `AdminInvoices` (in OrdersLayout) | **Payment** step — invoices list + create/edit |
| `/admin/inventory` | `InventoryDashboard` | Stock overview + low-stock items |
| `/admin/inventory/queue` | `InventoryQueue` | Legacy direct route to Print Job Manager; primary location is `/admin/orders/print` |
| `/admin/inventory/products` | `InventoryProducts` | Product catalogue, filters, bulk delete, restock from edit modal |
| `/admin/inventory/movements` | `InventoryMovements` | IN/OUT/ADJUST history |
| `/admin/inventory/orders` | `InventoryOrders` | Purchase orders to suppliers |
| `/admin/inventory/scan` | `InventoryScan` | Barcode scanner for fast stock-in |
| `/admin/inventory/reports` | `InventoryReports` | Stock value, turnover, slow movers |
| `/admin/emails` | `AdminEmails` | Sent email history (real `email_log` table) |
| `/admin/analytics` | `AdminAnalytics` | Visitor analytics + conversion funnels |
| `/admin/products` | `AdminProducts` | Storefront product catalogue editor |
| `/admin/pricing` | `AdminPricing` | **Pricing Engine** — central price configuration |
| `/admin/hero` `/services` `/about` `/contact` | various | Site CMS for marketing copy |
| Legacy redirects | `/admin/invoices`, `/admin/quotations` | Redirect into `/admin/orders/invoices` and `/admin/orders/quotations` |

---

## Public Marketing Site

`src/components/` — composed inside `src/App.tsx → SitePage`:

```tsx
<Hero />
<Services />
<Products />
<Pricing />
<HowItWorks />
<Machines />
<Portfolio />
<About />
<FindYourOrder />
<CustomPartRequest />   // contains a Business / Shopper toggle
<Footer />
<Cart />
<Checkout />
```

### Components

- **`Hero.tsx`** — full-bleed amber-accented intro with tagline, CTA buttons. Content from `useContentStore.content.hero`.
- **`Services.tsx`** — service cards (FDM, Resin, Custom). Content-driven.
- **`Products.tsx`** — storefront product grid with **Add to Cart** + **3D model preview** (via `ModelViewer.tsx` using `<model-viewer>` web component).
- **`Pricing.tsx`** — public pricing display (FDM + Resin tables + design hourly rate). Reads from `useContentStore.content.pricing`. Marketing copy only — actual quote pricing comes from the engine.
- **`HowItWorks.tsx`** — step-by-step process explainer.
- **`Machines.tsx`** — machine specs grid.
- **`Portfolio.tsx`** — past-work gallery.
- **`About.tsx`** — team / mission section.
- **`FindYourOrder.tsx`** ⭐ — airline-style "find your booking" section with 2 modes:
  - **Find Order**: email + order number → looks up in Supabase, verifies email matches → redirects to `/track/:id`
  - **Reset Password**: email + optional message → creates `admin_alert` notification (admin manually reissues credentials)
- **`CustomPartRequest.tsx`** — a 4-step wizard with a top-level **Business / Shopper** toggle:
  - **Business mode**: photo upload → vehicle/part details → B2B contact → review → submit
  - **Shopper mode**: simple contact form (name/email/service/message)
  - Shopper mode is rendered via `ContactFormContent` exported from `Contact.tsx`
- **`Cart.tsx`** + **`Checkout.tsx`** — public storefront shopping (legacy flow)
- **`Navbar.tsx`** — top nav with language switcher (EN/GR) + cart icon
- **`Footer.tsx`** — links + Customer Portal entry. **Admin login link is intentionally hidden** from the public footer (admin route still works via direct URL).

### Visual reveals

`useScrollReveal` hook (`src/hooks/useScrollReveal.ts`) attaches an IntersectionObserver to a section ref + mutation observer for dynamically-mounted children. Adds `.visible` class on `.reveal` elements as they enter viewport. CSS in `src/index.css` handles the opacity/translateY transition.

### Translations

`src/data/translations.ts` — bilingual (EN/GR) marketing copy. `useTranslation()` hook reads `useAppStore.language`.

---

## Customer-Facing Public Pages (No Login)

These are accessed directly via tokenised URLs sent in emails. **No authentication required** — the URL ID is a 16-char random string treated as a secret-by-obscurity.

### `/quote/:id` — PublicQuoteView (`src/public/PublicQuoteView.tsx`)

```
┌─────────────────────────────────────────────────┐
│ A xiom              🔒 Secure quote view        │
├─────────────────────────────────────────────────┤
│  [Full quote rendered like the PDF preview]      │
│  - Bill To: customer name + email                │
│  - Line items with material/weight               │
│  - Totals with VAT status                        │
│                                                  │
│  [✓ Accept Quotation] [💬 Request Changes]       │
│  [👤 Request Account / Sign in to Portal]        │
└─────────────────────────────────────────────────┘
```

**Behaviour:**
- Looks up the quote in `useInvoicesStore` by id
- Renders the same `PrintableQuote` component used for the admin DocumentPreview body
- Detects existing portal account: if customer has `portalEnabled`, the third button becomes **Sign in to Portal** (links to `/portal`)
- **Accept Quotation** button → calls `useInvoicesStore.convertToInvoice(quoteId)`, which:
  1. Creates an Invoice
  2. Marks the quote `status='paid'`
  3. Creates an Order linked to both
  4. Auto-deducts material stock from inventory
  5. Sends `quote_accepted` admin notification
  6. Shows confirmation page with **Download Invoice PDF** button
- **Request Changes** → textarea modal → creates `admin_alert` notification (kind: `quote_changes_requested`) with the customer's note + context
- **Request Account** → name/email/message form → creates `admin_alert` (kind: `account_requested`)
- **Cancelled** quote → shows clean "no longer available" page (URL still resolves but no actions)
- **Hard-deleted** quote (from Archive button on admin notification) → 404-style "Quote not found"

### `/track/:id` — PublicOrderTracking (`src/public/PublicOrderTracking.tsx`)

```
                  Order tracking
                  ORD-2026-0003
       Hi Andreas — here's where your order stands.

  ●━━━━━━━━━━━●━━━━━━━━━━━○━━━━━━━━━━━○━━━━━━━━━━━○
  Pending   In Production   Ready    Shipped   Delivered

┌──────────┬────────────┬──────────────┐
│ Status   │ Total      │ Order date   │
│ In Prod  │ €43.74     │ 26 Apr 2026  │
└──────────┴────────────┴──────────────┘

┌─ Invoice ─────────────────────────────────────┐
│ AXM-2026-0004    €43.74 · Issued              │
│                              [⬇ Download PDF] │
└────────────────────────────────────────────────┘

┌─ Timeline ────────────────────────────────────┐
│ ● Order created                26 Apr · 18:37 │
│ ● Quotation accepted           26 Apr · 18:35 │
│ ● Quotation sent               26 Apr · 18:30 │
└────────────────────────────────────────────────┘

  Questions? team@axiomcreate.com
```

**Behaviour:**
- Reads from `useOrdersStore` by id
- Mini progress pipeline (5 steps); current one pulses; cancelled orders show a red banner instead
- Linked invoice card with one-click PDF download (renders a hidden printable element via `elementToPdfBase64`)
- Full timeline of every event in `order.history` (quotation_sent, quotation_accepted, order_created, invoice_generated, status_changed, note_added)
- Admin can copy/share this URL via Order Profile or send via email

---

## Customer Portal (Login Required)

`src/portal/` — gated by `usePortalAuthStore`. Customer must have `portalEnabled: true` and a `password_hash` set on their `customers` row.

### `PortalLogin.tsx`
- Email + password
- bcrypt-compares against `customers.password_hash`
- Creates session in localStorage (`axiom_portal_session`)
- Updates `customers.last_login_at`

### `PortalLayout.tsx`
- Sidebar nav: Dashboard / Documents / Orders / Store / Profile
- Customer name + email at top
- Logout button

### `PortalDashboard.tsx`
- Welcome card with stats (total orders, total spent, last order date)
- Recent activity feed

### `PortalDocuments.tsx` ⭐
- All quotations + invoices grouped by product name
- Each row has **two icon buttons:**
  - **⬇ Download** → opens DocumentPreview with `autoDownload` prop → silently generates PDF and closes
  - **👁 Preview** → opens DocumentPreview normally
- The "Send by Email" button on the preview is **hidden in portal context** (gated by `pathname.startsWith('/admin')`)

### `PortalOrders.tsx` ⭐
- Reads from `useOrdersStore` filtered by customer (by id, falls back to email match via linked invoice)
- Each card: order number, status badge, mini progress pipeline (Pending → In Production → Ready → Shipped → Delivered), total, linked refs, **Open tracking** button → `/track/:id`
- Cancelled orders skip the pipeline
- Legacy storefront orders + part requests still rendered below for back-compat

### `PortalStore.tsx`
- Storefront re-purchase view (legacy)

### `PortalProfile.tsx`
- View/edit personal details + change password

---

## Admin Application (Staff Login)

`src/admin/` — gated by `useAdminAuthStore`. Bootstrap owner credentials: `owner` / `15583712` (changeable in Team tab).

### Layout

`src/admin/AdminLayout.tsx` — workflow-ordered sidebar with collapsible category dropdowns:

```
Intake
  Dashboard
  Requests              (unread count badge)
  Customers

Fulfillment
  Orders
  Quotations
  Print                 (Print Job Manager)
  Payment               (Invoices)

Stock & Storefront
  Stock Overview
  Stock Products
  Movements
  Purchase Orders
  Scan
  Reports
  Storefront Products

Pricing & Comms
  Pricing Engine
  Emails
  Analytics

Website
  Hero Section
  Services
  About
  Contact

System
  Team
  Activity Log

Actions
  View Site
  Reset All Data
  Logout
```

Each route is `lazy()`-loaded; `AdminLoader` shows an amber pulse while the chunk loads.

### Dashboard (`AdminDashboard.tsx`)
- Fulfillment flow map showing Request / Quotation / Order / Print / Payment / Delivery / Archive counts
- KPI tiles for Fulfillment, Notifications, Customers, Payment, Quotations, Print, Inventory, and admin tools
- Recent audit log entries (most recent 20)

### Notifications (`AdminNotifications.tsx`)
- Filter pills: All / Alerts / Orders / Part Requests / Messages
- Each card shows its fulfillment position:
  - part requests + contact messages → **Custom / Request**
  - storefront orders → **Off-the-Shelf / Order**
  - quote-change alerts → **Custom / Quotation**
  - quote-accepted alerts → **Custom / Order**
  - paid-invoice cleanup → **Payment**
- 4 notification types rendered with type-specific detail components:
  - **OrderDetail** — storefront orders, now entering the off-the-shelf lane
  - **PartRequestDetail** — B2B custom part requests
  - **ContactDetail** — generic contact form messages
  - **AdminAlertDetail** ⭐ — generic admin alerts with `kind`:
    - `quote_accepted` — *"Quote QT-... accepted by [customer]"*
    - `quote_changes_requested` — customer wants edits
    - `account_requested` — customer wants portal access (or password reset)
    - `invoice_paid_cleanup` — *"INV-... is paid — archive QT-...?"* with Quick **Archive** button
    - `other` — used for low-stock alerts and misc system notifications
- Each card: type badge, age (timeAgo), expandable details, delete, mark read
- Bulk **Mark all read** + **Clear all** with type-delete confirmation

### Customers (`AdminCustomers.tsx` + `AdminCustomerProfile.tsx`)
- List view with search, filters (Individual/Business), tags, bulk delete
- Each row shows: name, company, email, payment terms, total orders, total spent
- **Customer Profile** detail page:
  - Personal/billing details, account type, discount tier
  - **Portal Access** card with **Generate Password** + **Email Credentials** buttons
  - **Activity timeline** (`customer_activities` — auto-populated on quote acceptance, invoice paid, etc.)
  - Tag management
  - Multiple contacts support
  - **Auto-updates** when an invoice is paid: bumps `totalOrders`, adds to `totalSpent`, sets `lastOrderAt`, drops an `'order'` activity entry

### CustomerFormModal (`src/admin/components/CustomerFormModal.tsx`) ⭐
- Used for create + edit
- Account type toggle (Individual/Business — Business unlocks VAT, payment terms, discount tier)
- **Portal Access** section:
  - Toggle on/off
  - **Generate Password** button → bcrypt hash kept in form state
  - **📧 Email Credentials** button → **first persists hash to Supabase**, *then* sends the credentials email (avoids race condition where the email password didn't match the saved hash)
- Multiple extra contacts support
- VAT-warning modal for businesses without VAT number

### Fulfillment (`/admin/orders/*`) ⭐

**`OrdersLayout`** — tabbed layout:
```
[ Orders ]  [ Quotations ]  [ Print ]  [ Payment ]
```
- Renders the shared fulfillment flow map from `FulfillmentFlow.tsx`
- Custom lane: `Request → Quotation → Order → Print + Payment → Delivery → Archive`
- Off-the-shelf lane: `Order → Print + Payment → Delivery → Archive`

**`AdminOrdersOverview.tsx`**:
- Status filter pills + search
- 4 KPI tiles (Pending / In Production / Ready / Delivered)
- Table with: Order #, Customer, Quote/Invoice link badges, Total, **Flow**, Status, Created, Actions
- **Per-row Trash button** with type-delete confirmation
- Custom orders are created automatically when a quotation is accepted
- Off-the-shelf orders are created when a storefront order is converted to an invoice from Notifications

**`AdminOrderProfile.tsx`** (`/admin/orders/:id`):
- Shows the shared fulfillment flow map with this order's current lane + stage highlighted
- **Status selector** dropdown — admin moves through Pending → In Production → Ready → Shipped → Delivered → Closed (or Cancelled)
- **Public tracking link panel** at the top:
  ```
  🔗 https://www.axiomcreate.com/track/ord-...
       [📧 Send by email] [📋 Copy link] [↗ Open]
  ```
  - **Send by email** opens a modal with an optional note textarea, fires `orderTrackingEmail` template, logs to `email_log`, and appends a `note_added` event to the timeline
- 3-column layout:
  - **Left**: Linked Quote card + Linked Invoice card (each with Preview button) + Add Note input
  - **Right**: Vertical timeline of every event with icon-coded entries
- Each status change is appended to history via `useOrdersStore.changeStatus(id, status, by)`

**`AdminQuotations.tsx`** (when accessed under `/admin/orders/quotations` shows in OrdersLayout, else standalone):
- List view with status filter, search, bulk delete, KPIs, and **Custom / Quotation** flow badges
- **New Quotation** opens `QuotationEditor` (a sub-component in the same file)
- **`QuotationEditor`**:
  - Customer selector (autocomplete dropdown of existing customers OR free-text)
  - **`LineItemsEditor`** with the formula
  - Discount %, delivery fee, extra charge fields
  - **VAT toggle** — checkbox; defaults ON (19% Cyprus VAT), uncheck for tax-exempt quotes
  - **Override final price** toggle — admin enters a custom total; line items scale proportionally so the math reconciles
  - Notes + Terms & Conditions
  - **Save → Send Prompt Modal**: after Submit, two buttons:
    - **📧 Save & Send to Customer** — saves AND emails the quote with public link (CTA: *Review & Accept Online*)
    - **🔒 Save as Draft** — saves only, no email
- **Convert to Invoice** button on each row — admin path to acceptance (alternative to customer accepting via public link)

**`AdminInvoices.tsx`**:
- Same shape as Quotations but for invoices
- Invoices are shown as the **Payment** step, with Custom vs Off-the-Shelf inferred from linked order/source
- Status: draft / sent / paid / cancelled
- KPIs: Total / Draft / Sent / Paid / Revenue
- **Marking an invoice Paid** triggers:
  1. Customer profile update (totalOrders++, totalSpent+=, lastOrderAt)
  2. `'order'` activity entry on the customer
  3. **`invoice_paid_cleanup`** admin notification prompting to archive the public quote URL

### LineItemsEditor (`src/admin/components/LineItemsEditor.tsx`) ⭐⭐
The core pricing UI used by both quotations and invoices.

```
┌─ FORMULA (editable in Admin → Pricing) ──────────────────────────┐
│ Power: 450W  Electricity: €0.32/kWh  Labour: €7.00/hr            │
│ Depreciation: €0.30/hr  Markup: +30%                             │
└──────────────────────────────────────────────────────────────────┘

Description     Material         Weight  Print h  Labour h  Unit €  Qty  Total  ×
─────────────────────────────────────────────────────────────────────────────────
[ABS print ]    [Creality ABS ▾] [500]   [33]     [1]       [43.74] [1]  43.74  🗑
                                                              ↑ auto-calc
                                                       (editable override)

[+ Add Line Item]
```

**Behaviour:**
- Material dropdown sources from inventory (filaments only — `MATERIAL_CATEGORIES`)
- Picking a material sets `material`, `materialPartNumber` (for stock deduction), `ratePerGram`
- Editing weight, hours, or rate triggers automatic recalculation:
  ```
  unitPrice = (weight × ratePerGram + printH × powerKW × elecRate
              + labourH × labourRate + printH × deprRate) × (1 + markup/100)
  ```
- Unit Price field is editable for manual override
- Hours fix: uses `?? defaultLabourHours` not `|| defaultLabourHours` so explicit `0` stays `0`
- Customer-facing render shows just the **filament kind** (PLA/PETG/ABS/etc.) — brand stripped via `filamentKindOnly()`

### Inventory (`/admin/inventory/*`) ⭐

**`InventoryLayout`** — tabs:
```
[ Dashboard ] [ Products ] [ Movements ] [ Purchase Orders ] [ Scan ] [ Reports ]
```

**`InventoryDashboard.tsx`**:
- Stock value KPIs
- Low-stock items list
- Recent movements
- Top-stocked items by value

**`InventoryProducts.tsx`** ⭐:
- Filterable product grid (by category, search by partNumber/name/brand/barcode)
- Status badges (OK / LOW / OUT) computed from `getStockStatus()`
- **Per-row actions**: Quote, Edit, Print Label, Delete
- Bulk delete with type-delete confirmation
- 13 categories: PLA / PETG / ABS / TPU / Resin / Nylon / Tools / Spare Parts / Consumables / Equipment / Packaging / Hardware / Finished

**`InventoryProductFormModal.tsx`** ⭐ — Add or Edit:
- Fields: Name *, Brand, Supplier, Category *, Cost per kg *, Bin Location, Barcode
- **Add to stock** field (always shown, both add and edit modes):
  - For filaments: input in **kg** (multiplied by 1000 → stored as grams)
  - For non-filaments: input in **pieces**
  - When editing, shows current on-hand qty for context
  - Default `0` in edit mode (no accidental double-add)
  - Live preview: *"After save → on hand will be X g"*
- Auto-generates partNumber as `{BRAND}-{CATEGORY}-{RAND}` (e.g. `CREA-ABS-7K3X`) on first save

**`InventoryQueue.tsx`** ⭐ (Print Job Manager):
- Primary route: `/admin/orders/print`; legacy direct route: `/admin/inventory/queue`
- 3 sections: **Active Job** / **Queue** / **Completed Today**
- Drag-style priority for queued jobs (manual reordering + auto-suggest small jobs)
- Status flow: `queued` → `printing` → `completed` (or `failed`/`paused`)
- Quick actions per job: Start, Complete, Fail, Pause, Fast-Track
- Job cards show: description, weight, print hours, customer, priority (low/normal/high/rush), and flow position badge
- Built atop `printJobsStore` with Supabase sync

**`InventoryMovements.tsx`**:
- Chronological log of every stock movement (IN / OUT / ADJUST)
- Each row: date, type, product, qty, reference (invoice number, "restock", "Quote accepted", etc.), notes
- **`NewMovementModal`** for manual movements

**`InventoryOrders.tsx`** (Purchase Orders):
- POs to suppliers
- Each PO has line items, status (draft/ordered/received/cancelled)
- Receiving items creates IN movements automatically

**`InventoryScan.tsx`**:
- Barcode scanner UI (camera-based)
- Quick stock-in flow: scan → enter qty → IN movement

**`InventoryReports.tsx`**:
- Stock value report
- Turnover by SKU
- Slow movers
- Category breakdown

**`InventoryLabelModal.tsx`**:
- Generates a printable label for a product (QR code, partNumber, name)

### Pricing (`AdminPricing.tsx`) ⭐⭐
**This is the central nervous system of the business.**

Sections, top to bottom:

1. **How the formula works** — amber-tinted explainer card
2. **Operational rates** — Electricity €/kWh, Labour €/hr, Depreciation €/hr
3. **Defaults applied to every line item** — Power draw kW, Default labour hours
4. **Profit markup** — highlighted as the main lever, includes "markup ≠ margin" note
5. **Live example** — reflows in real time as rates change (verifies €43.7411 for the reference 500g/33h job)
6. **Filament rates from inventory** — read-only summary of every filament's €/kg + €/g
7. **Inventory low-stock alert threshold** — fallback % when no per-product reorderLevel set

The legacy FDM/Resin/Design rate edit tables were **removed** — material cost now flows directly from inventory.

### Team (`AdminTeam.tsx`)
- List of admin_users
- Add new admin (auto-generates password, forces change on first login)
- Update display name / email
- Reset password (generates new + emails if email set)
- Delete admin (cannot delete owner)

### Activity Log (`AdminActivityLog.tsx`)
- Audit log of every admin action: create/update/delete/status_change/login etc.
- Categories: customer / invoice / quotation / order / notification / product / content / system
- Filter by category + action
- Cleared via Clear All (with confirm)

### Emails (`AdminEmails.tsx`)
- History of every email sent from the platform (`email_log` table)
- Filter by template (invoice / quotation / portal_credentials / custom)
- Status (sent / failed) + error if failed
- Recipient(s), subject, sent by (admin user), timestamp
- Compose UI for one-off custom emails

### Analytics (`AdminAnalytics.tsx`)
- Visitor analytics (sessions, pageviews, top pages, referrers, top customers)
- Reads from `visitorStore` (per-browser sessions stored in localStorage, aggregated client-side)

### CMS pages (Hero / Services / About / Contact)
- Content-driven editors for the marketing site
- Bilingual (EN/GR)
- Live preview
- Saves to `site_content` (singleton JSONB row)

---

## Fulfillment Process Model

The admin platform is organised around the uploaded fulfillment diagram. Every customer-facing record should be locatable on one of two lanes at any time:

### Custom / Made-to-Order

```
Request → Quotation → Order → Print + Payment → Delivery → Archive
```

- **Request**: B2B custom part requests, contact messages that become jobs, uploaded images/files, and initial intake details.
- **Quotation**: quote drafts, sent quotes, quote-change requests, and customer acceptance. A declined or changed quote remains in this step until accepted.
- **Order**: accepted custom work, tracking links, order confirmation/status emails, and order timeline notes.
- **Print**: Print Job Manager records, queued prints, active prints, paused prints, failed prints, and completed print production.
- **Payment**: invoices, payment terms, paid status, paid-invoice cleanup, and public quote link archival prompts.
- **Delivery**: ready, pickup, shipped, delivered, and customer handoff status.
- **Archive**: closed, cancelled, deleted, or intentionally archived records.

### Off-the-Shelf / Pre-Made

```
Order → Print + Payment → Delivery → Archive
```

- Storefront checkout notifications enter directly at **Order**.
- Creating an invoice from a storefront order now also creates a trackable `orders` row, so pre-made work follows the same admin tracking surface as custom work.
- Off-the-shelf work still uses **Print**, **Payment**, **Delivery**, and **Archive** as parallel/next steps after the order is confirmed.

### Shared implementation

- `src/lib/fulfillmentFlow.ts` owns the canonical lane/stage names and resolver functions.
- `src/admin/components/FulfillmentFlow.tsx` renders the shared flow map and flow-position badges.
- Quotations are always part of **Quotation**.
- Invoices are always part of **Payment**.
- The Print Job Manager is part of **Print** and is exposed at `/admin/orders/print`.
- Confirmation and tracking emails are part of **Order** unless the template is explicitly a quotation, invoice/payment, or delivery template.

### Simpleness audit decisions

- The sidebar follows the operational order instead of an alphabetic/tool list: **Intake → Fulfillment → Stock & Storefront → Pricing & Comms → Website → System**.
- Request intake and off-the-shelf order notifications stay together under **Intake** because they are entry points, not separate fulfillment processes.
- Quotations, Print Job Manager, and Payment are grouped under **Fulfillment** so staff do not jump between Orders, Inventory, and Invoices to locate one job.
- `Inventory Products` is labelled **Stock Products** and public catalogue management is labelled **Storefront Products** to remove the previous "Products" ambiguity.
- Pricing remains a supporting tool, not a fulfillment stage, and sits beside communications because it feeds quotations and customer documents.
- Website CMS and System administration are deliberately outside the fulfillment route so operational staff can ignore them during daily production.

---

## State Management (Zustand Stores)

`src/stores/` — every store wraps a Supabase table (or piece of one) and exposes async CRUD methods. All shared admin stores follow a common pattern:

```typescript
export const useFooStore = create<FooState>((set, get) => ({
  items: [],
  loading: true,
  addItem: async (data) => { /* set local + await sbUpsert */ },
  updateItem: async (id, updates) => { /* set local + await sbUpdate */ },
  deleteItem: async (id) => { /* set local + await sbDelete */ },
}))

// Kick off initial fetch AFTER the store is fully assigned
// (avoids temporal-dead-zone bug where setState would fail silently)
void fetchFromSupabase()
```

### Stores

| Store | Table | Purpose |
|---|---|---|
| **`adminAuthStore`** | `admin_users` | Bootstrap owner; admin login/logout; bcrypt password hashing; sessionStorage for the active session |
| **`portalAuthStore`** | `customers` (read) | Customer login; bcrypt-compares against `password_hash` field |
| **`customersStore`** | `customers` | Customer CRUD; `recordOrder()` for storefront purchases |
| **`invoicesStore`** ⭐ | `documents` | Invoice + Quotation CRUD; `convertToInvoice()` for custom acceptance; `createFromOrder()` for off-the-shelf order handoff; paid-invoice cleanup hook; auto-deduct stock on acceptance |
| **`ordersStore`** ⭐ | `orders` | Trackable order entity for both custom and off-the-shelf lanes; status flow + history JSONB; `getNextOrderNumber()` |
| **`inventoryStore`** ⭐ | `inventory_products` + `stock_movements` | Product CRUD; movements; `consumeMaterial()` for auto-deduct; low-stock detection + alert |
| **`notificationsStore`** ⭐ | `notifications` | Order/Part Request/Contact/AdminAlert notifications |
| **`emailLogStore`** | `email_log` | Logs every email send attempt (success or failure) |
| **`auditLogStore`** | `audit_log` | Append-only audit trail |
| **`activitiesStore`** | `customer_activities` | Per-customer timeline events |
| **`purchaseOrdersStore`** | `purchase_orders` | Supplier POs with embedded line items JSONB |
| **`printJobsStore`** | `print_jobs` | Print Job Manager records for the **Print** step, with status flow + priority |
| **`contentStore`** ⭐ | `site_content` (JSONB singleton) + `storefront_products` | All CMS data + storefront products + the `printPricing` config |
| **`appStore`** | localStorage | UI state — language (EN/GR), filters, modals |
| **`quoteCartStore`** | localStorage | Admin's draft quote cart |
| **`cartStore`** | in-memory | Public storefront cart |
| **`visitorStore`** | localStorage | Anonymous visitor analytics per-browser |

### Realtime subscriptions

Three stores subscribe to Supabase Realtime so admin tabs see changes from other browsers (or from customers accepting quotes via public links):

- `ordersStore` — channel `orders-realtime`
- `invoicesStore` — channel `documents-realtime`  
- `notificationsStore` — channel `notifications-realtime`

When any change is detected, the store re-fetches. Tables added to `supabase_realtime` publication via `alter publication`.

### The TDZ bug (historical, fixed)

Earlier versions called `fetchFromSupabase()` *inside* the `create()` callback:

```typescript
// BROKEN PATTERN
export const useFooStore = create<FooState>((set, get) => {
  fetchFromSupabase()   // references useFooStore which is still being assigned
  return { items: [], loading: true, ... }
})
```

The async function's first synchronous statement was `useFooStore.setState({ loading: true })` — but `useFooStore` was in temporal-dead-zone. Threw `ReferenceError`, which became an unhandled promise rejection, which silently swallowed the entire fetch. Result: `loading: true` forever, page shows "0 items" even with data in DB.

**Fix:** every store now calls `void fetchFromSupabase()` AFTER the `export const useFooStore = ...` statement returns. Affected: `inventoryStore`, `invoicesStore`, `activitiesStore`, `auditLogStore`, `printJobsStore`, `purchaseOrdersStore`, `contentStore`. `customersStore` and `notificationsStore` were already correct because they took `set` as a parameter.

---

## Database Schema

Supabase project `uohmzjdcrwwnzsoevbpf`. Schema lives in `supabase-schema.sql` (idempotent — safe to re-run). All tables have RLS enabled with `anon_all FOR ALL USING (true) WITH CHECK (true)` since the app sits behind admin auth.

### 13 tables

| Table | Key columns | Purpose |
|---|---|---|
| `customers` | id, email, name, portal_enabled, password_hash, total_orders, total_spent, last_order_at | Customer records |
| `documents` | id, type (invoice/quotation), document_number, customer_id, customer_email, line_items JSONB, total, total_override, status | Invoices + quotations |
| `orders` | id, order_number, customer_id, quotation_id, invoice_id, status, total, history JSONB | Trackable fulfillment order for custom and off-the-shelf lanes |
| `inventory_products` | id, part_number, name, category, brand, cost, unit_weight_grams, reorder_level, archived | Product catalogue |
| `stock_movements` | id, product_id, type (IN/OUT/ADJUST), qty, unit_cost, reference | Stock movement log |
| `purchase_orders` | id, supplier, status, items JSONB, total | Supplier POs |
| `customer_activities` | id, customer_id, type, title, description, metadata JSONB | Per-customer timeline |
| `audit_log` | id, action, category, label, detail, actor, created_at | Admin audit trail |
| `admin_users` | id, username, display_name, email, password_hash, must_change_password | Admin auth |
| `print_jobs` | id, status, priority, position, customer_id, document_id, weight_grams, estimated_hours, progress | Print Job Manager records in the Print step |
| `site_content` | id (singleton), data JSONB | All CMS content + printPricing config |
| `storefront_products` | id (integer), name, category, price, image_url, model_url | Public storefront catalogue |
| `notifications` | id, type, date, read, data JSONB | Admin notifications |
| `email_log` | id, to_emails, subject, template, document_id, customer_id, status, sent_at | Email send history |

### Key relationships (informal — FKs dropped intentionally)

- `documents.customer_id` → `customers.id`
- `orders.quotation_id` → `documents.id` (was FK, dropped to avoid race)
- `orders.invoice_id` → `documents.id` (was FK, dropped to avoid race)
- `stock_movements.product_id` → `inventory_products.id`
- `customer_activities.customer_id` → `customers.id`

The orders FKs were dropped because `addInvoice`'s Supabase upsert is fire-and-forget. When the order's upsert reached Supabase before the invoice's, the FK constraint failed and the order was silently dropped. Now the constraint isn't enforced; the relationship is tracked in code.

---

## Pricing Engine — The Formula

The single equation that drives every quote, invoice, and stock deduction:

```
Material      = weight (g) × inventory cost €/g
Electricity   = print hours × power (kW) × electricity €/kWh
Labour        = labour hours × labour €/hr
Depreciation  = print hours × depreciation €/hr
─────────────────────────────────────────────────
COGS          = sum
Price to sell = COGS × (1 + markup %)
```

### Configurable in Admin → Pricing

| Variable | Default | Notes |
|---|---|---|
| `electricityRate` | €0.32/kWh | EAC retail rate |
| `labourRate` | €7/hr | Setup, post-processing, packaging |
| `depreciationRate` | €0.30/hr | Printer wear-and-tear |
| `defaultPowerDraw` | 0.45 kW | Avg printer consumption |
| `defaultLabourHours` | 1 h | Pre-filled per line item |
| `profitMarkup` | 30% | The main lever (markup, not margin) |
| `lowStockPercent` | 20% | Fallback when no per-product reorderLevel |

Stored in `site_content.data.printPricing` (JSONB singleton).

### Reference job (matches the source spreadsheet exactly)

```
500g of filament at €23.99/kg, 33h print + 1h labour
─────────────────────────────────────────────────
Material:     500 × 0.02399 = €11.9950
Electricity:  33 × 0.45 × 0.32 = €4.7520
Labour:       1 × 7 = €7.0000
Depreciation: 33 × 0.30 = €9.9000
─────────────────────────────────────────────────
COGS:         €33.6470
× 1.30 markup
─────────────────────────────────────────────────
Price:        €43.7411 ✓
```

### Where the formula lives

- **Inputs** in `LineItemsEditor` per row (weight, print h, labour h, material picker)
- **Calculation** in `LineItemsEditor.calcUnitPrice()` runs on every input change
- **Rates** read from `useContentStore.content.printPricing`
- **Material rate** derived from `inventory.cost / inventory.unitWeightGrams`
- **Override**: admin can manually edit Unit Price OR set a quotation-level Total Override that scales line items proportionally

---

## Quote → Order → Invoice Lifecycle

This is the **Custom / Made-to-Order** route:

```
1. Request arrives from custom part form or contact intake
                ↓
2. Admin creates quotation
                ↓
3. Save & Send modal → email customer with /quote/:id link + PDF
                ↓
4. Customer opens public link → sees quote → 3 actions:
   ├── ACCEPT → triggers convertToInvoice()
   │              ├── Creates Invoice (copy line items + totals)
   │              ├── Marks Quotation as 'paid'
   │              ├── Creates Order (linked to both)
   │              ├── Auto-deducts material stock
   │              ├── Sends 'quote_accepted' admin notification
   │              ├── Updates customer.totalOrders / totalSpent (when invoice → paid)
   │              └── Customer sees confirmation + Download Invoice button
   ├── REQUEST CHANGES → admin notification (textarea content)
   └── REQUEST ACCOUNT → admin notification (name+email+message)

5. Admin manages Order in /admin/orders/:id:
   ├── Status: pending → in_production → ready → shipped → delivered → closed
   ├── Tracking link: copy / open / send by email
   ├── Add notes (appended to history)
   └── Preview/Download linked Quote + Invoice

6. Print work is managed in /admin/orders/print

7. Customer follows progress at /track/:id

8. Admin marks Invoice 'paid':
   ├── Customer profile updated (totalOrders++, totalSpent+=, lastOrderAt)
   ├── 'order' activity entry added
   └── 'invoice_paid_cleanup' admin notification → admin can hard-delete
       the public quote URL (it returns 'Quote not found' afterwards)
```

The **Off-the-Shelf / Pre-Made** route skips Request and Quotation:

```
1. Storefront checkout creates an order notification
2. Admin clicks Create Invoice & Order
3. System creates an invoice and a trackable order row
4. Admin manages Print + Payment, then Delivery, then Archive
```

---

## Inventory & Stock Auto-Deduct

### The flow

1. Customer accepts a quote → `convertToInvoice()` runs
2. For every line item with `materialPartNumber` + `weightGrams`:
   - Look up the inventory product by part number
   - Call `useInventoryStore.consumeMaterial(partNumber, weightGrams × quantity, ref=quoteNumber)`
3. `consumeMaterial`:
   - Records an OUT movement with `qty = grams`, `unitCost = €/g`, `reference = quote#`
   - Computes the threshold:
     - `reorderLevel > 0` → that's the threshold
     - else → `totalIN × (lowStockPercent / 100)` (fallback)
   - **Crossing detection**: only fires if `qtyBefore > threshold AND qtyAfter ≤ threshold`
   - On crossing:
     - Raises `low_stock` admin notification
     - Sends `lowStockAlertEmail` to all admin emails (+ `team@axiomcreate.com` fallback)

### Unit conventions

- **Filaments** (PLA/PETG/ABS/TPU/Resin/Nylon): tracked in **grams** (matches `consumeMaterial`'s deduction unit). UI shows kg in the form, multiplies by 1000 internally.
- **Everything else**: tracked in **pieces**.

### Low-stock alert email

Themed dark/amber template (`lowStockAlertEmail` in `emailTemplates.ts`):

```
[LOW STOCK] CREA-ABS-1OUO — Creality ABS BLACK
─────────────────────────────────────
Part #            Item                 On hand
CREA-ABS-1OUO    Creality ABS BLACK    180 g
                 ABS                   threshold 200 g
─────────────────────────────────────
[Open Inventory] CTA → /admin/inventory/products
```

---

## Print Job Manager

`InventoryQueue.tsx` + `printJobsStore.ts`. One printer, manual + auto-prioritisation. This surface now lives under **Fulfillment → Print** at `/admin/orders/print`; `/admin/inventory/queue` remains as a legacy direct route.

### Sections

```
┌─ ACTIVE JOB ────────────────────────────────────┐
│ ABS print for QT-2026-0009                      │
│ ████████░░░░ 65% · 22h elapsed / 33h total      │
│ [✓ Complete] [⚠ Failed] [⏸ Pause]               │
└─────────────────────────────────────────────────┘

┌─ QUEUE (3 jobs) ─────────────────────────────────┐
│ #1  PETG vase     400g · 8h    🔥 RUSH          │
│ #2  ABS bracket   100g · 2h    ⬆ HIGH           │
│ #3  PLA prototype 50g · 1h     ━ NORMAL         │
└─────────────────────────────────────────────────┘

┌─ COMPLETED TODAY ───────────────────────────────┐
│ ✓ Custom medical bracket (PMC) — 2h ago         │
└─────────────────────────────────────────────────┘

┌─ QUICK WINS (small jobs to slot in) ────────────┐
│ Small bracket (50g, 1h) — slot before #1?       │
└─────────────────────────────────────────────────┘
```

### Status flow

```
queued → printing → completed
            ↓
           failed | paused
```

### Priority weighting

Jobs sorted by `priority` (rush=4, high=3, normal=2, low=1) then by `position`. Admin can drag-reorder within priority.

---

## Email System (Resend)

### Architecture

```
Browser (admin or public) → POST /api/send-email → Resend API → recipient inbox
```

### `api/send-email.ts` (Vercel serverless function)

- Reads `RESEND_API_KEY` and `EMAIL_FROM` from Vercel env vars
- Accepts `{ to, cc, bcc, subject, html, text, attachments }` JSON
- Forwards to Resend SDK
- Returns `{ id, success }` or `{ error }`
- CORS open (same-origin in practice)
- No auth — sits behind admin login (trust model)

### `src/lib/emailClient.ts`

- `sendEmail(opts)` — POSTs to `/api/send-email` with payload logging
- `elementToPdfBase64(element, filename)` — uses `html2canvas` + `jsPDF` to generate PDF as base64 for attachment

### `src/lib/emailTemplates.ts` ⭐

Dark-themed, amber-accented HTML templates that match the site:

| Template | Purpose | CTA |
|---|---|---|
| `quotationEmail(doc, customer?, viewUrl?, portalUrl?)` | Customer quote with public link. If `portalUrl` provided, adds 'Sign in to track' callout (only when customer has portal access). | Review & Accept Online |
| `invoiceEmail(doc, customer?)` | Payment-step invoice summary | — |
| `portalCredentialsEmail({customerName, email, tempPassword, portalUrl})` | Order/account-step welcome with login | Sign in to portal |
| `orderTrackingEmail({orderNumber, statusLabel, total, vatRate, trackingUrl, noteFromAdmin?})` | Order-step status update / confirmation follow-up | Track Your Order |
| `lowStockAlertEmail({items[], inventoryUrl})` | Internal alert when stock crosses threshold | Open Inventory |
| `customEmail({subject, bodyHtml})` | Free-form admin-composed | — |

### Where emails fire from

| Trigger | Template | Recipients |
|---|---|---|
| Admin clicks "Save & Send" on quote | `quotationEmail` | Customer email |
| Admin clicks "Send by Email" on document preview | `quotationEmail` or `invoiceEmail` | Customer email |
| Admin clicks "Email credentials" on customer | `portalCredentialsEmail` | Customer email |
| Admin clicks "Send by email" on order profile | `orderTrackingEmail` | Customer email |
| Stock crosses threshold (auto, server-side via consumeMaterial) | `lowStockAlertEmail` | All admin user emails + team@axiomcreate.com |

Every send is logged to `email_log` with status (sent/failed) + sender admin username.

In the admin email templates screen, templates also show a fulfillment badge:
- quote-ready emails → **Quotation**
- order-confirmed and tracking emails → **Order**
- invoice emails → **Payment**
- ready/shipped emails → **Delivery**

### Domain setup (production)

- `axiomcreate.com` verified in Resend (SPF + DKIM DNS records on GoDaddy)
- `EMAIL_FROM` env var: `Axiom <team@axiomcreate.com>`

---

## Notifications

`useNotificationsStore` — 4 notification types stored in the `notifications` table:

```typescript
type Notification =
  | OrderNotification           // Storefront order placed
  | PartRequestNotification     // B2B custom part request
  | ContactNotification         // Generic contact form
  | AdminAlertNotification      // Generic admin alert (kind discriminates)
```

### Admin Alert kinds

```typescript
kind:
  | 'quote_accepted'           // Customer accepted via public link
  | 'quote_changes_requested'  // Customer wants edits
  | 'account_requested'        // Customer wants portal access (or password reset)
  | 'invoice_paid_cleanup'     // Invoice marked paid → archive public quote URL?
  | 'other'                    // Used for low_stock and misc system events
```

Each carries a `context` object with optional refs:
```typescript
context?: {
  quoteId, quoteNumber,
  invoiceId, invoiceNumber,
  orderId, orderNumber,
  customerEmail, customerName, customerId,
}
```

The bell icon in the admin header shows `getUnreadCount()`. Clicking opens `/admin/notifications` with type filter pills.

---

## Realtime Sync (Supabase Realtime)

Three stores subscribe via WebSocket so admin tabs reflect changes within ~1 second:

```typescript
// Pattern in each store
if (isSupabaseConfigured) {
  supabase
    .channel('orders-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
      void fetchFromSupabase()
    })
    .subscribe()
}
```

Tables added to the realtime publication:
```sql
alter publication supabase_realtime add table orders, documents, notifications
```

### What this fixes

Customer accepts a quote on `/quote/:id` (no admin auth) → writes to Supabase via anon key → all open admin tabs see:
- Order appears in `/admin/orders` overview
- Notification badge increments
- Quote status flips `draft → paid` in the quotations list

All without a refresh.

---

## Authentication

### Admin auth (`adminAuthStore`)

- Bcrypt password hashing in the browser
- Bootstrap: `owner` / `15583712` seeded on first load
- Roles: any admin can do anything (no granular roles in v1)
- Session: sessionStorage `axiom_admin_session`
- Failed login attempts: not tracked (could add rate limiting later)
- Password reset: admin generates new password from Team page → forces change on next login

### Customer Portal auth (`portalAuthStore`)

- Bcrypt-compares against `customers.password_hash` (queried directly from Supabase)
- Customer must have `portal_enabled = true`
- Session: localStorage `axiom_portal_session`
- Password generation: admin clicks "Generate Password" in CustomerFormModal → bcrypt hash persisted to Supabase BEFORE email goes out (avoids race where the email password didn't match the saved hash)
- "Forgot password" flow: customer submits request via FindYourOrder section → admin notification → admin manually generates + emails new password

### No auth required

- `/quote/:id` — public quote viewing + acceptance
- `/track/:id` — public order tracking
- `/find-order` (section on home page) — looks up orders by email + order #

The trust model relies on the secret-by-obscurity of random 16-char IDs + email verification on lookup.

---

## Security Model

### Threat surface

- **`/api/send-email`** — anyone can POST to it. Only protected by domain restriction in Resend.
- **Supabase anon key** — exposed in client bundle (standard for Supabase). RLS open on all tables since admin sits behind a separate auth layer.
- **Quote/track URLs** — secret-by-obscurity (16-char random IDs)

### Mitigations in place

- HTML escape for all dynamic content in email templates (`escape()` helper)
- Bcrypt for all password hashing (10 rounds)
- VAT and customer details not exposed via public URLs unless they own the order (email verification on `/find-order`)
- Cancelled or hard-deleted quotes return "Quote not found"
- Admin route hidden from public footer (still accessible via direct URL)

### Known gaps (v1 acceptable)

- No CSRF protection on `/api/send-email`
- No rate limiting anywhere (could spam emails)
- Anon key + open RLS means anyone with the key could read/write any table
- No 2FA for admin login

---

## File Structure

```
qudi-plus4/
├─ api/
│  └─ send-email.ts                    Vercel serverless function (Resend proxy)
├─ public/
│  ├─ favicon.svg
│  └─ ...
├─ src/
│  ├─ App.tsx                          Routes + SitePage composition
│  ├─ main.tsx                         Vite entry
│  ├─ index.css                        Tailwind + custom utility classes
│  ├─ admin/
│  │  ├─ AdminLayout.tsx               Sidebar + header
│  │  ├─ AdminDashboard.tsx
│  │  ├─ AdminCustomers.tsx
│  │  ├─ AdminCustomerProfile.tsx
│  │  ├─ AdminQuotations.tsx
│  │  ├─ AdminInvoices.tsx
│  │  ├─ AdminPricing.tsx              ⭐ Pricing engine
│  │  ├─ AdminProducts.tsx             Storefront product editor
│  │  ├─ AdminTeam.tsx
│  │  ├─ AdminEmails.tsx
│  │  ├─ AdminAnalytics.tsx
│  │  ├─ AdminActivityLog.tsx
│  │  ├─ AdminNotifications.tsx
│  │  ├─ AdminHero.tsx, AdminAbout.tsx, AdminContact.tsx, AdminServices.tsx  CMS pages
│  │  ├─ inventory/
│  │  │  ├─ InventoryLayout.tsx        Tab navigation
│  │  │  ├─ InventoryDashboard.tsx
│  │  │  ├─ InventoryProducts.tsx
│  │  │  ├─ InventoryProductFormModal.tsx
│  │  │  ├─ InventoryMovements.tsx
│  │  │  ├─ InventoryOrders.tsx        Purchase Orders
│  │  │  ├─ InventoryQueue.tsx         Print Job Manager (used by Fulfillment → Print)
│  │  │  ├─ InventoryScan.tsx
│  │  │  ├─ InventoryReports.tsx
│  │  │  ├─ InventoryLabelModal.tsx
│  │  │  └─ NewMovementModal.tsx
│  │  ├─ orders/
│  │  │  ├─ OrdersLayout.tsx           Fulfillment tabs + flow map
│  │  │  ├─ AdminOrdersOverview.tsx
│  │  │  └─ AdminOrderProfile.tsx
│  │  └─ components/
│  │     ├─ FulfillmentFlow.tsx        Shared flow map + stage badges
│  │     ├─ LineItemsEditor.tsx        ⭐ Quote line items with formula
│  │     ├─ DocumentPreview.tsx        Invoice/Quote PDF render + send
│  │     ├─ SendEmailModal.tsx         Compose & send email
│  │     ├─ CustomerFormModal.tsx      Customer create/edit + portal credentials
│  │     ├─ CustomerSelector.tsx       Autocomplete dropdown
│  │     ├─ DeleteConfirmModal.tsx     Type-delete confirmation + bypass mode
│  │     ├─ QuoteCart.tsx              Floating quote cart sidebar
│  │     ├─ QuoteCustomerPickerModal.tsx
│  │     └─ PrintJobCalculatorModal.tsx
│  ├─ portal/
│  │  ├─ PortalLayout.tsx
│  │  ├─ PortalLogin.tsx
│  │  ├─ PortalDashboard.tsx
│  │  ├─ PortalDocuments.tsx           with Download / Preview buttons per row
│  │  ├─ PortalOrders.tsx              with mini status pipeline
│  │  ├─ PortalProfile.tsx
│  │  └─ PortalStore.tsx
│  ├─ public/
│  │  ├─ PublicQuoteView.tsx           ⭐ /quote/:id — accept online
│  │  └─ PublicOrderTracking.tsx       ⭐ /track/:id — status pipeline
│  ├─ components/                      Marketing site
│  │  ├─ Hero.tsx, Services.tsx, Products.tsx, Pricing.tsx, HowItWorks.tsx,
│  │  │  Machines.tsx, Portfolio.tsx, About.tsx, Contact.tsx, Footer.tsx,
│  │  │  Navbar.tsx
│  │  ├─ FindYourOrder.tsx             ⭐ Find order + reset password
│  │  ├─ CustomPartRequest.tsx         ⭐ Wizard with Business / Shopper toggle
│  │  ├─ Cart.tsx, Checkout.tsx        Storefront cart/checkout
│  │  └─ ModelViewer.tsx               <model-viewer> wrapper for STL preview
│  ├─ stores/                          Zustand stores (see State Management)
│  ├─ lib/
│  │  ├─ supabase.ts                   Supabase client init
│  │  ├─ emailClient.ts                sendEmail + elementToPdfBase64
│  │  ├─ emailTemplates.ts             ⭐ Dark/amber HTML templates
│  │  └─ fulfillmentFlow.ts            Canonical fulfillment lanes/stages + resolvers
│  ├─ hooks/
│  │  ├─ useScrollReveal.ts            IntersectionObserver + MutationObserver
│  │  ├─ useTranslation.ts             EN/GR i18n
│  │  └─ useVisitorTracking.ts         Anonymous analytics
│  └─ data/
│     ├─ products.ts                   Default storefront products (seed)
│     └─ translations.ts               EN/GR copy
├─ supabase-schema.sql                 13 tables + RLS policies
├─ vercel.json                         SPA rewrite rule
├─ package.json                        React 19, Vite 8, Zustand, Resend, etc.
├─ vite.config.ts
├─ tailwind.config.js
├─ tsconfig.json
└─ .env                                VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
```

Total: ~20,000 LOC across 100+ files.

---

## Environment Variables

### Client (`.env` — committed names, not values)

| Var | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL: `https://uohmzjdcrwwnzsoevbpf.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (safe to expose; gated by RLS) |

### Server (Vercel env vars)

| Var | Purpose |
|---|---|
| `RESEND_API_KEY` | Resend API key (`re_...`) for sending emails |
| `EMAIL_FROM` | Sender address with display name: `Axiom <team@axiomcreate.com>` |

Set in Vercel → Project Settings → Environment Variables → Production + Preview + Development. Redeploy required after changes.

---

## Deployment

### Continuous deployment

- Push to `main` branch on GitHub → auto-deploys to Vercel
- Build command: `npm run build` (= `tsc -b && vite build`)
- Output: `dist/` (static SPA)
- API functions: `api/*.ts` → Node serverless

### Domains

- Primary: `www.axiomcreate.com` (CNAME → Vercel)
- Vercel default: `aprinting-cayk.vercel.app`
- Apex `axiomcreate.com` currently still on GoDaddy site builder (separate)

### Build size

```
dist/assets/index-XXXXXX.js  ~1.4 MB raw / ~390 KB gzipped
+ multiple lazy-loaded chunks for admin pages
```

---

## Operational Workflows

### Workflow A: Customer requests a custom print

1. Customer fills B2B form on home page (`CustomPartRequest`) → notification arrives at admin
2. Admin reviews → clicks "Create Quotation" from notification → quote draft pre-filled
3. Admin adjusts line items, clicks **Save & Send to Customer**
4. Customer receives email with `[Review & Accept Online]` button
5. Customer clicks → reviews on `/quote/:id` → clicks **Accept Quotation**
6. System auto-creates Order + Invoice + deducts stock + notifies admin
7. Customer sees confirmation with **Download Invoice PDF**
8. Admin sees new ORD-... in `/admin/orders/`
9. Admin manages production from `/admin/orders/print`
10. Admin updates status: `pending → in_production → ready → shipped → delivered`
11. After each status change, admin clicks **📧 Send by email** on Order Profile to notify customer
12. Customer follows progress at `/track/:id`
13. Once delivered, admin marks invoice **paid** → customer profile auto-updates + cleanup notification fires

### Workflow B: Customer buys an off-the-shelf product

1. Customer checks out from storefront products
2. Admin receives an **Off-the-Shelf / Order** notification
3. Admin clicks **Create Invoice & Order**
4. System creates the invoice and a trackable order row
5. Admin manages Print and Payment from `/admin/orders/print` and `/admin/orders/invoices`
6. Admin moves the order through Delivery, then Closed/Archive

### Workflow C: Customer forgot password

1. Customer goes to home page → scrolls to **Find Your Order** section → clicks **Reset Password** tab
2. Enters email + optional message → submit
3. Admin sees notification: *"Password reset requested by ..."*
4. Admin opens that customer's profile → clicks **Generate Password** → clicks **📧 Email credentials**
5. Customer receives email with new password + portal link
6. Customer logs into portal, changes password from Profile

### Workflow D: Inventory low stock

1. Customer accepts a quote that uses 500g of Creality ABS BLACK (currently 680g in stock, threshold 200g)
2. `consumeMaterial()` records OUT 500g → on-hand drops to 180g (crossed threshold)
3. Admin notification fires: *"[LOW STOCK] CREA-ABS-1OUO — Creality ABS BLACK"*
4. Email sent to all admin users + `team@axiomcreate.com` with item details + threshold + Open Inventory button
5. Admin opens Inventory → finds the product → clicks **Edit** → enters `1` in **Add to stock** field (= 1 kg = 1000g IN movement)
6. New on-hand: 180g + 1000g = 1180g (above threshold again)

### Workflow E: Track an existing order without a portal account

1. Customer received initial acceptance email → has order number `ORD-2026-0003`
2. Goes to home page → scrolls to **Find Your Order** → enters email + order number
3. System verifies email matches → redirects to `/track/ord-...`
4. Customer sees status pipeline + can download invoice

---

## Pending / Future Work

| Status | Item |
|---|---|
| ✅ Done | Supabase-only refactor (all admin stores) |
| ✅ Done | Fulfillment process model across admin (Custom + Off-the-Shelf lanes) |
| ✅ Done | Print Job Calculator + admin Pricing engine |
| ✅ Done | Print Job Manager under Fulfillment → Print with priority + manual control |
| ✅ Done | Resend integration (outbound) |
| ✅ Done | Public quote acceptance flow |
| ✅ Done | Order entity with timeline |
| ✅ Done | Public order tracking page |
| ✅ Done | Stock auto-deduct on quote acceptance |
| ✅ Done | Low-stock email alerts |
| ✅ Done | Customer profile auto-update on invoice paid |
| ✅ Done | Find Your Order section (lookup + password reset request) |
| ✅ Done | Realtime sync via Supabase websockets |
| ⏳ Pending | Inbound email parsing (Resend Inbound) — auto-create notifications from emails to `team@axiomcreate.com` |
| ⏳ Pending | Live shipment tracking via AfterShip (waiting for API key) |
| ⏳ Pending | Self-service password reset (currently admin-mediated) |
| ⏳ Pending | Granular admin roles (currently all admins are equal) |
| ⏳ Pending | Rate limiting on `/api/send-email` |
| ⏳ Pending | Apex domain `axiomcreate.com` → Vercel (currently GoDaddy site builder) |
| ⏳ Pending | Refactor public Pricing.tsx now that admin Pricing is the engine |
| ⏳ Pending | 2FA for admin login |

---

## Quick Reference Card

### Owner credentials
```
Username: owner
Password: 15583712
```

### Test customer with portal access
```
Email: andreasm@netmail.com.cy
(password generated dynamically via admin form)
```

### Useful URLs
```
Production:      https://www.axiomcreate.com
Vercel default:  https://aprinting-cayk.vercel.app
Admin:           https://www.axiomcreate.com/admin
Portal:          https://www.axiomcreate.com/portal
```

### Database (Supabase)
```
Project ID:  uohmzjdcrwwnzsoevbpf
Region:      Central EU (Frankfurt)
Console:     https://supabase.com/dashboard/project/uohmzjdcrwwnzsoevbpf
```

### Repositories
```
GitHub:  https://github.com/Andreasm21/aprinting
Branch:  main
```

### Email
```
Provider:    Resend
Sender:      team@axiomcreate.com
Domain:      axiomcreate.com (verified)
Default to:  team@axiomcreate.com (low-stock alerts fallback)
```

---

*Generated 2026-04-26 — reflects the codebase as of commit `5f77267` (Inventory edit modal — Add to stock field with current on-hand display).*
