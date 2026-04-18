"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Brain, Newspaper, AlertTriangle, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Loader2, AlertCircle, Sparkles } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { NewsDetailModal, type BaseNewsItem } from "@/components/news-detail-modal"

interface ApiStockNewsItem {
  ID: number
  链接: string
  标题: string
  时间: string
  内容: string
}

interface NewsData {
  source: string
  stockName: string
  updateTime: string
  lastTime: number
  totalCount: number
  newsCount: number
  items: ApiStockNewsItem[]
}

interface DisplayNewsItem {
  id: string
  title: string
  summary: string
  time: string
  timeShort: string
  url: string
  source: string
}

interface AIAnalysisResult {
  sentiment: string
  conclusion: string
  logic: string
  risk: string
}

interface CachedAnalysis {
  result: AIAnalysisResult
  timestamp: string
}

type LoadingState = "loading" | "success" | "error"
const PAGE_SIZE = 3

function truncateText(text: string, maxLen: number): string {
  if (!text) return ""
  return text.length > maxLen ? text.slice(0, maxLen) + "..." : text
}

function formatTimeShort(time: string): string {
  if (!time) return ""
  const parts = time.split(" ")
  if (parts.length < 2) return time
  const mmdd = parts[0].slice(5)
  const hhmm = parts[1].slice(0, 5)
  return `${mmdd} ${hhmm}`
}

async function fetchStockNews(symbol: string, limit: number = 20): Promise<NewsData> {
  const res = await fetch(`/api/cn/stocks/${symbol}/news?limit=${limit}`)
  if (!res.ok) throw new Error("fetch failed")
  const json = await res.json()
  if (json.code !== 200 || !json.data) throw new Error("invalid response")
  const d = json.data
  return {
    source: d.来源 || "财联社",
    stockName: d.股票简称 || symbol,
    updateTime: d.更新时间 || "",
    lastTime: d.lastTime || 0,
    totalCount: d.总数量 || 0,
    newsCount: d.新闻数量 || 0,
    items: d.个股新闻 || [],
  }
}

function mapToDisplay(item: ApiStockNewsItem): DisplayNewsItem {
  return {
    id: String(item.ID),
    title: item.标题,
    summary: truncateText(item.内容, 120),
    time: item.时间,
    timeShort: formatTimeShort(item.时间),
    url: item.链接,
    source: "财联社",
  }
}

async function fetchNewsForAI(symbol: string): Promise<string> {
  const data = await fetchStockNews(symbol, 5)
  const lines = data.items.map((item, i) => {
    const content = truncateText(item.内容, 200)
    return `${i + 1}. [${item.时间}] ${item.标题}：${content}`
  })
  return `近期关于该股票的新闻：\n${lines.join("\n")}`
}

async function fetchAIAnalysis(symbol: string, newsText: string): Promise<AIAnalysisResult> {
  const apiKey = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY
  if (!apiKey) {
    throw new Error("API Key 未配置，请在 .env.local 中设置 NEXT_PUBLIC_DEEPSEEK_API_KEY")
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60000)

  try {
    const res = await fetch("/deepseek/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "你是一个专业的A股股票分析师。请根据我提供的近期新闻，对该股票的资讯面进行深度分析。你必须严格按照我要求的JSON格式输出，不要输出任何多余的废话或Markdown标记。",
          },
          {
            role: "user",
            content: `股票代码：${symbol}。近期新闻：${newsText}。请分析其资讯面，并严格按照以下JSON格式返回：{"sentiment":"利好/利空/中性","conclusion":"一段话总结结论（不超过150个汉字）","logic":"核心逻辑分析（分点，用换行符分隔）","risk":"潜在风险提示（总字数不超过120个汉字，分点时用换行符分隔）"}`,
          },
        ],
        temperature: 0.3,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      throw new Error(`DeepSeek API 请求失败 (${res.status}): ${errText}`)
    }

    const json = await res.json()
    const content = json.choices?.[0]?.message?.content
    if (!content) throw new Error("DeepSeek API 返回内容为空")

    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
    const parsed = JSON.parse(cleaned)

    if (!parsed.sentiment || !parsed.conclusion) {
      throw new Error("DeepSeek API 返回格式不正确")
    }

    return {
      sentiment: parsed.sentiment,
      conclusion: parsed.conclusion,
      logic: parsed.logic || "",
      risk: parsed.risk || "",
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("AI 分析请求超时，请稍后重试")
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

function getCacheKey(symbol: string): string {
  return `analysis_${symbol}`
}

function loadCachedAnalysis(symbol: string): CachedAnalysis | null {
  try {
    const raw = localStorage.getItem(getCacheKey(symbol))
    if (!raw) return null
    return JSON.parse(raw) as CachedAnalysis
  } catch {
    return null
  }
}

function saveCachedAnalysis(symbol: string, result: AIAnalysisResult): void {
  try {
    const cache: CachedAnalysis = {
      result,
      timestamp: new Date().toLocaleString("zh-CN"),
    }
    localStorage.setItem(getCacheKey(symbol), JSON.stringify(cache))
  } catch {}
}

function AISummaryCard({ symbol }: { symbol: string }) {
  const [analysisData, setAnalysisData] = useState<AIAnalysisResult | null>(null)
  const [cachedTime, setCachedTime] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [mounted, setMounted] = useState(false)
  const autoTriggeredRef = useRef(false)

  const handleGenerate = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const newsText = await fetchNewsForAI(symbol)
      const result = await fetchAIAnalysis(symbol, newsText)
      setAnalysisData(result)
      saveCachedAnalysis(symbol, result)
      setCachedTime(new Date().toLocaleString("zh-CN"))
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 分析失败")
    } finally {
      setIsLoading(false)
    }
  }, [symbol])

  useEffect(() => {
    const cached = loadCachedAnalysis(symbol)
    if (cached) {
      setAnalysisData(cached.result)
      setCachedTime(cached.timestamp)
    }
    setMounted(true)
  }, [symbol])

  useEffect(() => {
    if (mounted && !autoTriggeredRef.current && !analysisData && !isLoading) {
      autoTriggeredRef.current = true
      handleGenerate()
    }
  }, [mounted, analysisData, isLoading, handleGenerate])

  const sentimentConfig: Record<string, { label: string; color: string; badgeClass: string }> = {
    "利好": { label: "利好", color: "text-stock-up", badgeClass: "border-stock-up/30 text-stock-up" },
    "利空": { label: "利空", color: "text-stock-down", badgeClass: "border-stock-down/30 text-stock-down" },
    "中性": { label: "中性", color: "text-muted-foreground", badgeClass: "border-border text-muted-foreground" },
  }

  const sentiment = analysisData?.sentiment || "中性"
  const config = sentimentConfig[sentiment] || sentimentConfig["中性"]

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start gap-3 mb-3">
          <Brain className="w-5 h-5 mt-0.5 shrink-0 text-primary" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-medium text-sm text-foreground">AI 智能分析</span>
              {analysisData && (
                <Badge variant="outline" className={`text-xs ${config.badgeClass}`}>
                  {config.label}
                </Badge>
              )}
              <div className="ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerate}
                  disabled={isLoading}
                  className="gap-1.5 h-8"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {isLoading ? "AI 分析中..." : analysisData ? "重新生成" : "生成 AI 分析"}
                </Button>
              </div>
            </div>

            {cachedTime && (
              <div className="text-xs text-muted-foreground mb-2">
                上次分析时间：{cachedTime}
              </div>
            )}

            {analysisData && (
              <p className="text-sm text-muted-foreground leading-relaxed">{analysisData.conclusion}</p>
            )}

            {analysisData && analysisData.logic && (
              <>
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors mt-2"
                >
                  {expanded ? (
                    <><ChevronUp className="w-3 h-3" />收起详情</>
                  ) : (
                    <><ChevronDown className="w-3 h-3" />展开详情</>
                  )}
                </button>

                {expanded && (
                  <div className="mt-3 space-y-3">
                    {analysisData.logic && (
                      <div>
                        <p className="text-xs font-semibold text-foreground mb-1">核心逻辑</p>
                        <ul className="space-y-1">
                          {analysisData.logic.split("\n").filter(Boolean).map((line, i) => (
                            <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                              <span className="text-primary shrink-0">{i + 1}</span>
                              <span>{line.replace(/^\d+[.、)\]]\s*/, "")}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {analysisData.risk && (
                      <div className="pt-3 border-t border-border">
                        <div className="flex items-center gap-1 mb-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-yellow-500" />
                          <p className="text-xs font-semibold text-foreground">风险提示</p>
                        </div>
                        {(() => {
                          const lines = analysisData.risk.split("\n").filter(Boolean)
                          const hasNumbering = lines.some(line => /^\d+[.、)\]]\s*/.test(line))
                          if (hasNumbering || lines.length > 1) {
                            return (
                              <ul className="space-y-1">
                                {lines.map((line, i) => (
                                  <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                                    <span className="text-yellow-600 shrink-0">{i + 1}</span>
                                    <span>{line.replace(/^\d+[.、)\]]\s*/, "")}</span>
                                  </li>
                                ))}
                              </ul>
                            )
                          } else {
                            return <p className="text-xs text-muted-foreground">{lines[0]?.replace(/^\d+[.、)\]]\s*/, "")}</p>
                          }
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {analysisData && (
          <p className="text-xs text-muted-foreground mt-3">基于近 5 条资讯生成</p>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>AI 分析中，请稍候...</span>
          </div>
        )}

        {error && (
          <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/40">
            <p className="text-xs text-red-600 dark:text-red-400">AI 分析失败：{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function NewsCard({ item, onClick }: { item: DisplayNewsItem; onClick: (item: DisplayNewsItem) => void }) {
  return (
    <button
      onClick={() => onClick(item)}
      className="block w-full text-left p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors group cursor-pointer"
    >
      <h4 className="font-medium text-sm text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-2">
        {item.title}
      </h4>
      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{item.summary}</p>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{item.source}</span>
        <span>{item.timeShort}</span>
      </div>
    </button>
  )
}

interface NewsAnalysisProps {
  symbol: string
}

export function NewsAnalysis({ symbol }: NewsAnalysisProps) {
  const [loadingState, setLoadingState] = useState<LoadingState>("loading")
  const [newsList, setNewsList] = useState<DisplayNewsItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [updateTime, setUpdateTime] = useState("")
  const [lastTime, setLastTime] = useState(0)
  const [pollError, setPollError] = useState(false)
  const [selectedNews, setSelectedNews] = useState<BaseNewsItem | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  const loadData = useCallback(async (isInitial: boolean = false) => {
    try {
      const data = await fetchStockNews(symbol, 20)
      const displayItems = data.items.map(mapToDisplay)
      setNewsList(displayItems)
      setTotalCount(data.totalCount)
      setUpdateTime(data.updateTime)
      setLastTime(data.lastTime)
      setPollError(false)
      if (isInitial) setLoadingState("success")
    } catch {
      setPollError(true)
      if (isInitial) {
        setLoadingState("error")
      }
    }
  }, [symbol])

  useEffect(() => {
    loadData(true)
    const interval = setInterval(() => {
      loadData(false)
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [loadData])

  const handleSelectNews = (item: DisplayNewsItem) => {
    const baseItem: BaseNewsItem = {
      id: item.id,
      title: item.title,
      source: item.source,
      time: item.time,
      summary: item.summary,
      url: item.url,
    }
    setSelectedNews(baseItem)
  }

  const totalPages = Math.ceil(newsList.length / PAGE_SIZE)
  const paginatedNews = newsList.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  if (loadingState === "loading") {
    return (
      <section id="news" className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-primary" />
          资讯面
        </h2>
        <AISummaryCard symbol={symbol} />
        <Card>
          <CardContent className="py-12 flex items-center justify-center">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>加载新闻数据...</span>
            </div>
          </CardContent>
        </Card>
      </section>
    )
  }

  if (loadingState === "error") {
    return (
      <section id="news" className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-primary" />
          资讯面
        </h2>
        <AISummaryCard symbol={symbol} />
        <Card>
          <CardContent className="py-12 flex flex-col items-center justify-center gap-3">
            <AlertCircle className="w-8 h-8 text-stock-down" />
            <p className="text-muted-foreground">暂无新闻数据</p>
            <Button variant="outline" size="sm" onClick={() => loadData(true)}>
              重新加载
            </Button>
          </CardContent>
        </Card>
      </section>
    )
  }

  return (
    <section id="news" className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Newspaper className="w-5 h-5 text-primary" />
        资讯面
      </h2>

      <AISummaryCard symbol={symbol} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>相关新闻</span>
            <span className="text-xs font-normal text-muted-foreground">共 {totalCount} 条</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {paginatedNews.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">暂无新闻数据</div>
          ) : (
            paginatedNews.map((item) => (
              <NewsCard key={item.id} item={item} onClick={handleSelectNews} />
            ))
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-3 border-t border-border/50">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs text-muted-foreground">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {updateTime && (
            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">更新时间：{updateTime}</span>
              {pollError && (
                <span className="text-xs text-yellow-500">新闻加载失败，将自动重试</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedNews && (
        <NewsDetailModal item={selectedNews} onClose={() => setSelectedNews(null)} />
      )}
    </section>
  )
}
