import { Navbar } from "@/components/navbar"
import { HeroSection } from "@/components/hero-section"
import { RequestConsole } from "@/components/request-console"
import { DataProductsGrid } from "@/components/data-products-grid"
import { RecentTransactions } from "@/components/recent-transactions"
import { Footer } from "@/components/footer"

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <Navbar />
      <HeroSection />
      <RequestConsole />
      <DataProductsGrid />
      <RecentTransactions />
      <Footer />
    </main>
  )
}
