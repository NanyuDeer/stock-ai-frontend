import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { StockHeader } from "@/components/stock/stock-header"
import { NewsAnalysis } from "@/components/stock/news-analysis"
import { TechnicalAnalysis } from "@/components/stock/technical-analysis"
import { FundamentalAnalysis } from "@/components/stock/fundamental-analysis"

export default async function StockDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
          <StockHeader code={code} />

          <NewsAnalysis symbol={code} />

          <TechnicalAnalysis symbol={code} />

          <FundamentalAnalysis symbol={code} />
        </div>
      </main>
      <Footer />
    </div>
  )
}
