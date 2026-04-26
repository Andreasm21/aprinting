import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from '@/components/Navbar'
import Hero from '@/components/Hero'
import Services from '@/components/Services'
import Products from '@/components/Products'
import Pricing from '@/components/Pricing'
import HowItWorks from '@/components/HowItWorks'
import Machines from '@/components/Machines'
import Portfolio from '@/components/Portfolio'
import About from '@/components/About'
import CustomPartRequest from '@/components/CustomPartRequest'
import Footer from '@/components/Footer'
import Cart from '@/components/Cart'
import Checkout from '@/components/Checkout'
import { useVisitorTracking } from '@/hooks/useVisitorTracking'

const AdminLayout = lazy(() => import('@/admin/AdminLayout'))
const AdminDashboard = lazy(() => import('@/admin/AdminDashboard'))
const AdminProducts = lazy(() => import('@/admin/AdminProducts'))
const AdminHero = lazy(() => import('@/admin/AdminHero'))
const AdminServices = lazy(() => import('@/admin/AdminServices'))
const AdminPricing = lazy(() => import('@/admin/AdminPricing'))
const AdminAbout = lazy(() => import('@/admin/AdminAbout'))
const AdminContact = lazy(() => import('@/admin/AdminContact'))
const AdminNotifications = lazy(() => import('@/admin/AdminNotifications'))
const AdminCustomers = lazy(() => import('@/admin/AdminCustomers'))
const AdminInvoices = lazy(() => import('@/admin/AdminInvoices'))
const AdminQuotations = lazy(() => import('@/admin/AdminQuotations'))
const AdminEmails = lazy(() => import('@/admin/AdminEmails'))
const AdminAnalytics = lazy(() => import('@/admin/AdminAnalytics'))
const AdminCustomerProfile = lazy(() => import('@/admin/AdminCustomerProfile'))
const AdminTeam = lazy(() => import('@/admin/AdminTeam'))
const AdminActivityLog = lazy(() => import('@/admin/AdminActivityLog'))

// Inventory management
const InventoryDashboard = lazy(() => import('@/admin/inventory/InventoryDashboard'))
const InventoryProducts = lazy(() => import('@/admin/inventory/InventoryProducts'))
const InventoryMovements = lazy(() => import('@/admin/inventory/InventoryMovements'))
const InventoryScan = lazy(() => import('@/admin/inventory/InventoryScan'))
const InventoryReports = lazy(() => import('@/admin/inventory/InventoryReports'))
const InventoryOrders = lazy(() => import('@/admin/inventory/InventoryOrders'))
const InventoryQueue = lazy(() => import('@/admin/inventory/InventoryQueue'))
const AdminOrdersOverview = lazy(() => import('@/admin/orders/AdminOrdersOverview'))
const AdminOrderProfile = lazy(() => import('@/admin/orders/AdminOrderProfile'))

// Portal (customer-facing)
const PortalLayout = lazy(() => import('@/portal/PortalLayout'))
const PortalDashboard = lazy(() => import('@/portal/PortalDashboard'))
const PortalDocuments = lazy(() => import('@/portal/PortalDocuments'))
const PortalOrders = lazy(() => import('@/portal/PortalOrders'))
const PortalProfile = lazy(() => import('@/portal/PortalProfile'))
const PortalStore = lazy(() => import('@/portal/PortalStore'))

function AdminLoader({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="font-mono text-accent-amber animate-pulse">Loading admin...</div>
      </div>
    }>
      <AdminLayout>{children}</AdminLayout>
    </Suspense>
  )
}

function SiteTracker() {
  useVisitorTracking('/')
  return null
}

function SitePage() {
  return (
    <>
      <SiteTracker />
      <Navbar />
      <main>
        <Hero />
        <Services />
        <Products />
        <Pricing />
        <HowItWorks />
        <Machines />
        <Portfolio />
        <About />
        {/* CustomPartRequest now contains a top-level Business / Shopper toggle —
            shopper mode renders the contact form, so the standalone <Contact /> is gone. */}
        <CustomPartRequest />
      </main>
      <Footer />
      <Cart />
      <Checkout />
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SitePage />} />
        <Route path="/admin" element={<AdminLoader><AdminDashboard /></AdminLoader>} />
        <Route path="/admin/notifications" element={<AdminLoader><AdminNotifications /></AdminLoader>} />
        <Route path="/admin/customers" element={<AdminLoader><AdminCustomers /></AdminLoader>} />
        <Route path="/admin/customers/:id" element={<AdminLoader><AdminCustomerProfile /></AdminLoader>} />
        <Route path="/admin/team" element={<AdminLoader><AdminTeam /></AdminLoader>} />
        <Route path="/admin/activity" element={<AdminLoader><AdminActivityLog /></AdminLoader>} />

        {/* Inventory */}
        <Route path="/admin/inventory" element={<AdminLoader><InventoryDashboard /></AdminLoader>} />
        <Route path="/admin/inventory/products" element={<AdminLoader><InventoryProducts /></AdminLoader>} />
        <Route path="/admin/inventory/movements" element={<AdminLoader><InventoryMovements /></AdminLoader>} />
        <Route path="/admin/inventory/scan" element={<AdminLoader><InventoryScan /></AdminLoader>} />
        <Route path="/admin/inventory/reports" element={<AdminLoader><InventoryReports /></AdminLoader>} />
        <Route path="/admin/inventory/orders" element={<AdminLoader><InventoryOrders /></AdminLoader>} />
        <Route path="/admin/inventory/queue" element={<AdminLoader><InventoryQueue /></AdminLoader>} />
        {/* Orders — overview + the existing Quotations / Invoices as subsections */}
        <Route path="/admin/orders" element={<AdminLoader><AdminOrdersOverview /></AdminLoader>} />
        <Route path="/admin/orders/quotations" element={<AdminLoader><AdminQuotations /></AdminLoader>} />
        <Route path="/admin/orders/invoices" element={<AdminLoader><AdminInvoices /></AdminLoader>} />
        <Route path="/admin/orders/:id" element={<AdminLoader><AdminOrderProfile /></AdminLoader>} />
        {/* Legacy routes — redirect users who bookmarked the old paths */}
        <Route path="/admin/invoices" element={<AdminLoader><AdminInvoices /></AdminLoader>} />
        <Route path="/admin/quotations" element={<AdminLoader><AdminQuotations /></AdminLoader>} />
        <Route path="/admin/emails" element={<AdminLoader><AdminEmails /></AdminLoader>} />
        <Route path="/admin/analytics" element={<AdminLoader><AdminAnalytics /></AdminLoader>} />
        <Route path="/admin/products" element={<AdminLoader><AdminProducts /></AdminLoader>} />
        <Route path="/admin/hero" element={<AdminLoader><AdminHero /></AdminLoader>} />
        <Route path="/admin/services" element={<AdminLoader><AdminServices /></AdminLoader>} />
        <Route path="/admin/pricing" element={<AdminLoader><AdminPricing /></AdminLoader>} />
        <Route path="/admin/about" element={<AdminLoader><AdminAbout /></AdminLoader>} />
        <Route path="/admin/contact" element={<AdminLoader><AdminContact /></AdminLoader>} />

        {/* Customer Portal */}
        <Route path="/portal" element={<Suspense fallback={null}><PortalLayout><PortalDashboard /></PortalLayout></Suspense>} />
        <Route path="/portal/store" element={<Suspense fallback={null}><PortalLayout><PortalStore /></PortalLayout></Suspense>} />
        <Route path="/portal/documents" element={<Suspense fallback={null}><PortalLayout><PortalDocuments /></PortalLayout></Suspense>} />
        <Route path="/portal/orders" element={<Suspense fallback={null}><PortalLayout><PortalOrders /></PortalLayout></Suspense>} />
        <Route path="/portal/profile" element={<Suspense fallback={null}><PortalLayout><PortalProfile /></PortalLayout></Suspense>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
