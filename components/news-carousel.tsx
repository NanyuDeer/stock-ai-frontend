"use client"

import { useState, useEffect, useCallback } from "react"
import { ChevronLeft, ChevronRight, AlertCircle, Loader2, Newspaper } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { NewsDetailModal, type BaseNewsItem } from "@/components/news-detail-modal"

interface ApiNewsItem {
  ID: number
  时间: string
  标题: string
  摘要: string
  作者: string
  标签: string[]
  链接: string
}

interface DisplayNewsItem {
  id: string
  title: string
  summary: string
  source: string
  author: string
  time: string
  timeShort: string
  url: string
}

type LoadingState = "loading" | "success" | "error" | "empty"

interface NewsCarouselCardProps {
  title: string
  items: DisplayNewsItem[]
  isLarge?: boolean
  loadingState: LoadingState
  onRetry: () => void
  onSelectNews: (item: BaseNewsItem) => void
}

function mapApiItem(item: ApiNewsItem): DisplayNewsItem {
  const timePart = item.时间.includes(" ") ? item.时间.split(" ")[1] : item.时间
  const hhmm = timePart ? timePart.substring(0, 5) : item.时间
  return {
    id: String(item.ID),
    title: item.标题,
    summary: item.摘要,
    source: item.作者,
    author: item.作者,
    time: item.时间,
    timeShort: hhmm,
    url: item.链接,
  }
}

function NewsCarouselCard({ title, items, isLarge = false, loadingState, onRetry, onSelectNews }: NewsCarouselCardProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? items.length - 1 : prev - 1))
  }, [items.length])

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev === items.length - 1 ? 0 : prev + 1))
  }, [items.length])

  useEffect(() => {
    if (loadingState !== "success" || items.length === 0) return
    const interval = setInterval(goToNext, 6000)
    return () => clearInterval(interval)
  }, [goToNext, loadingState, items.length])

  if (loadingState === "loading") {
    return (
      <Card className="h-full">
        <CardContent className={`p-6 flex items-center justify-center ${isLarge ? "min-h-[180px]" : "min-h-[160px]"}`}>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>加载中...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loadingState === "error") {
    return (
      <Card className="h-full">
        <CardContent className={`p-6 flex flex-col items-center justify-center gap-2 ${isLarge ? "min-h-[180px]" : "min-h-[160px]"}`}>
          <AlertCircle className="w-8 h-8 text-stock-down" />
          <p className="text-muted-foreground text-sm">暂无新闻或网络异常</p>
          <Button variant="outline" size="sm" onClick={onRetry}>
            重试
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (loadingState === "empty" || items.length === 0) {
    return (
      <Card className="h-full">
        <CardContent className={`p-6 flex flex-col items-center justify-center gap-2 ${isLarge ? "min-h-[180px]" : "min-h-[160px]"}`}>
          <Newspaper className="w-8 h-8 text-muted-foreground" />
          <p className="text-muted-foreground text-sm">暂无新闻或网络异常</p>
        </CardContent>
      </Card>
    )
  }

  const currentNews = items[currentIndex]

  const handleSelect = () => {
    const baseItem: BaseNewsItem = {
      id: currentNews.id,
      title: currentNews.title,
      source: currentNews.source,
      time: currentNews.time,
      summary: currentNews.summary,
      url: currentNews.url,
      aiSummary: "",
      content: "",
    }
    onSelectNews(baseItem)
  }

  return (
    <Card className="h-full min-h-[220px]">
      <CardContent className="p-5 relative h-full flex flex-col">
        <h3 className="text-primary font-semibold mb-3 shrink-0">{title}</h3>

        <div
          className="flex-1 min-h-0 flex flex-col cursor-pointer hover:opacity-80 transition-opacity"
          onClick={handleSelect}
        >
          <div className="text-primary hover:underline font-medium block mb-2 truncate shrink-0">
            {currentNews.title}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2 flex-1 min-h-[40px]">
            {currentNews.summary}
          </p>
          <p className="text-xs text-muted-foreground mt-3 shrink-0">
            {currentNews.source && <span>{currentNews.source} </span>}
            {currentNews.timeShort}
          </p>
        </div>

        <>
          <button
            className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 text-primary hover:text-primary/80 flex items-center justify-center rounded-full bg-white/60 hover:bg-white/80 transition-colors"
            onClick={goToPrevious}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-primary hover:text-primary/80 flex items-center justify-center rounded-full bg-white/60 hover:bg-white/80 transition-colors"
            onClick={goToNext}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>

        <div className="flex items-center justify-center gap-1.5 mt-4">
          {items.map((_, index) => (
            <button
              key={index}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentIndex ? "bg-primary" : "bg-border"
              }`}
              onClick={() => setCurrentIndex(index)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

async function fetchNews(endpoint: string): Promise<DisplayNewsItem[]> {
  try {
    const res = await fetch(endpoint)
    if (!res.ok) return []
    const json = await res.json()
    if (json.code !== 200 || !json.data) return []
    const newsArray: ApiNewsItem[] = json.data.头条新闻 || []
    return newsArray.map(mapApiItem)
  } catch {
    return []
  }
}

export function NewsCarousel() {
  const [isMounted, setIsMounted] = useState(false)
  const [loadingState, setLoadingState] = useState<LoadingState>("loading")
  const [selectedNews, setSelectedNews] = useState<BaseNewsItem | null>(null)
  const [newsData, setNewsData] = useState<{
    headlines: DisplayNewsItem[]
    domestic: DisplayNewsItem[]
    overseas: DisplayNewsItem[]
  }>({ headlines: [], domestic: [], overseas: [] })

  const loadNews = useCallback(async () => {
    setLoadingState("loading")
    try {
      const [headlines, domestic, overseas] = await Promise.all([
        fetchNews("/api/news/headlines"),
        fetchNews("/api/news/cn"),
        fetchNews("/api/news/gb"),
      ])
      const allEmpty = headlines.length === 0 && domestic.length === 0 && overseas.length === 0
      setNewsData({ headlines, domestic, overseas })
      setLoadingState(allEmpty ? "error" : "success")
    } catch {
      setLoadingState("error")
    }
  }, [])

  useEffect(() => {
    setIsMounted(true)
    loadNews()
  }, [loadNews])

  const handleRetry = () => {
    loadNews()
  }

  const effectiveLoadingState = !isMounted ? "loading" : loadingState

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">市场资讯</h2>

      <NewsCarouselCard
        title="头条新闻"
        items={newsData.headlines}
        isLarge={true}
        loadingState={effectiveLoadingState}
        onRetry={handleRetry}
        onSelectNews={setSelectedNews}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <NewsCarouselCard
          title="国内资讯"
          items={newsData.domestic}
          loadingState={effectiveLoadingState}
          onRetry={handleRetry}
          onSelectNews={setSelectedNews}
        />
        <NewsCarouselCard
          title="外围资讯"
          items={newsData.overseas}
          loadingState={effectiveLoadingState}
          onRetry={handleRetry}
          onSelectNews={setSelectedNews}
        />
      </div>

      {selectedNews && (
        <NewsDetailModal item={selectedNews} onClose={() => setSelectedNews(null)} />
      )}
    </section>
  )
}
