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
import Contact from '@/components/Contact'
import CustomPartRequest from '@/components/CustomPartRequest'
import Footer from '@/components/Footer'
import Cart from '@/components/Cart'
import Checkout from '@/components/Checkout'

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

function SitePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Services />
        <Products />
        <Pricing />
        <HowItWorks />
        <Machines />
        <Portfolio />
        <CustomPartRequest />
        <About />
        <Contact />
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
        <Route path="/admin/products" element={<AdminLoader><AdminProducts /></AdminLoader>} />
        <Route path="/admin/hero" element={<AdminLoader><AdminHero /></AdminLoader>} />
        <Route path="/admin/services" element={<AdminLoader><AdminServices /></AdminLoader>} />
        <Route path="/admin/pricing" element={<AdminLoader><AdminPricing /></AdminLoader>} />
        <Route path="/admin/about" element={<AdminLoader><AdminAbout /></AdminLoader>} />
        <Route path="/admin/contact" element={<AdminLoader><AdminContact /></AdminLoader>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
