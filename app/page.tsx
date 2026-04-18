import { Header } from "@/components/header"
import { NewsCarousel } from "@/components/news-carousel"
import { IndexCards } from "@/components/index-cards"
import { MarketOverview } from "@/components/market-overview"
import { EarningsForecast } from "@/components/earnings-forecast"
import { Watchlist } from "@/components/watchlist"
import { Footer } from "@/components/footer"

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* News Carousel */}
          <NewsCarousel />

          {/* Index Cards */}
          <IndexCards />

          {/* Main Content - Market Overview & Earnings Forecast (wide screen) / Market Overview, then Earnings, then Watchlist (narrow) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Market Overview (Hot Stocks) */}
            <div className="lg:col-span-2">
              <MarketOverview />
            </div>

            {/* Right Column - Earnings Forecast on wide screen */}
            <div className="hidden lg:block">
              <EarningsForecast />
            </div>
          </div>

          {/* Earnings Forecast - Show on narrow screen only */}
          <div className="lg:hidden">
            <EarningsForecast />
          </div>

          {/* Watchlist - Full Width Below */}
          <Watchlist />
        </div>
      </main>
      <Footer />
    </div>
  )
}
