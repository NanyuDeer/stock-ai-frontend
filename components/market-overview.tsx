"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { TrendingUp, TrendingDown, Loader2, AlertCircle, BarChart3, Plus, Check, Star } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { addToWatchlist, isInWatchlist } from "@/lib/watchlist"

interface RankItem {
  当前排名: number
  股票代码: string
}

interface CoreQuoteItem {
  股票代码: string
  股票简称: string
  最新价: number
  涨跌幅: number
  更新时间: string
}

interface DisplayStock {
  rank: number
  code: string
  name: string
  price: string
  change: string
  changePercent: string
  trend: "up" | "down" | "flat"
  inWatchlist: boolean
}

type LoadingState = "loading" | "success" | "error" | "empty"

function formatPrice(val: number): string {
  return val.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatChangePercent(val: number): string {
  const sign = val > 0 ? "+" : ""
  return `${sign}${val.toFixed(2)}%`
}

function formatChange(price: number, changePercent: number): string {
  if (price === 0) return "0.00"
  const change = price * changePercent / (100 + changePercent)
  const sign = change > 0 ? "+" : ""
  return `${sign}${change.toFixed(2)}`
}

async function fetchHotStocks(): Promise<RankItem[]> {
  const res = await fetch("/api/cn/market/stockrank?count=20")
  if (!res.ok) throw new Error("stockrank fetch failed")
  const json = await res.json()
  if (json.code !== 200 || !json.data) throw new Error("stockrank invalid response")
  return json.data.人气榜 || []
}

async function fetchBatchCoreQuotes(symbols: string[]): Promise<CoreQuoteItem[]> {
  if (symbols.length === 0) return []
  const res = await fetch(`/api/cn/stock/quotes/core?symbols=${symbols.join(",")}`)
  if (!res.ok) throw new Error("core quotes fetch failed")
  const json = await res.json()
  if (json.code !== 200 || !json.data) throw new Error("core quotes invalid response")
  return json.data.行情 || []
}

export function MarketOverview() {
  const router = useRouter()
  const [isMounted, setIsMounted] = useState(false)
  const [currentTime, setCurrentTime] = useState<string>("--:--:--")
  const [loadingState, setLoadingState] = useState<LoadingState>("loading")
  const [stocks, setStocks] = useState<DisplayStock[]>([])
  const [updateTime, setUpdateTime] = useState<string>("")

  useEffect(() => {
    setIsMounted(true)
    setCurrentTime(new Date().toLocaleTimeString("zh-CN"))
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString("zh-CN"))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const loadData = useCallback(async () => {
    setLoadingState("loading")
    try {
      const rankList = await fetchHotStocks()
      if (rankList.length === 0) {
        setStocks([])
        setLoadingState("empty")
        return
      }
      const symbols = rankList.map((item) => item.股票代码)
      const quotes = await fetchBatchCoreQuotes(symbols)
      const quoteMap = new Map<string, CoreQuoteItem>()
      for (const q of quotes) {
        quoteMap.set(q.股票代码, q)
      }
      const merged: DisplayStock[] = []
      for (const rankItem of rankList) {
        const q = quoteMap.get(rankItem.股票代码)
        if (!q) continue
        const changePercent = q.涨跌幅 ?? 0
        const trend: "up" | "down" | "flat" = changePercent > 0 ? "up" : changePercent < 0 ? "down" : "flat"
        merged.push({
          rank: rankItem.当前排名,
          code: q.股票代码,
          name: q.股票简称,
          price: formatPrice(q.最新价),
          change: formatChange(q.最新价, changePercent),
          changePercent: formatChangePercent(changePercent),
          trend,
          inWatchlist: isInWatchlist(q.股票代码),
        })
      }
      setStocks(merged)
      setUpdateTime(quotes[0]?.更新时间 || "")
      setLoadingState(merged.length === 0 ? "empty" : "success")
    } catch {
      setStocks([])
      setLoadingState("error")
    }
  }, [])

  useEffect(() => {
    loadData()

    const handleWatchlistChange = () => {
      setStocks((prev) =>
        prev.map((s) => ({
          ...s,
          inWatchlist: isInWatchlist(s.code),
        }))
      )
    }
    window.addEventListener("watchlist-changed", handleWatchlistChange)
    return () => {
      window.removeEventListener("watchlist-changed", handleWatchlistChange)
    }
  }, [loadData])

  const handleStockClick = (code: string) => {
    router.push(`/stock/${code}`)
  }

  const handleAddToWatchlist = (code: string, e: React.MouseEvent) => {
    e.stopPropagation()
    addToWatchlist(code)
    setStocks((prev) =>
      prev.map((s) =>
        s.code === code ? { ...s, inWatchlist: true } : s
      )
    )
  }

  const handleRetry = () => {
    loadData()
  }

  const renderContent = () => {
    if (loadingState === "loading") {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>加载行情数据...</span>
          </div>
        </div>
      )
    }

    if (loadingState === "error") {
      return (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <AlertCircle className="w-10 h-10 text-stock-down" />
          <p className="text-muted-foreground">暂无热门数据</p>
          <Button variant="outline" size="sm" onClick={handleRetry}>
            重新加载
          </Button>
        </div>
      )
    }

    if (loadingState === "empty" || stocks.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <BarChart3 className="w-10 h-10 text-muted-foreground" />
          <p className="text-muted-foreground">暂无热门数据</p>
        </div>
      )
    }

    return (
      <div className="max-h-[400px] overflow-y-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="border-b border-border text-left">
              <th className="pb-3 pr-4 font-medium text-muted-foreground text-sm w-8">#</th>
              <th className="pb-3 pr-4 font-medium text-muted-foreground text-sm">股票名称</th>
              <th className="pb-3 pr-4 font-medium text-muted-foreground text-sm">代码</th>
              <th className="pb-3 pr-4 font-medium text-muted-foreground text-sm text-right">最新价</th>
              <th className="pb-3 pr-4 font-medium text-muted-foreground text-sm text-right">涨跌额</th>
              <th className="pb-3 pr-4 font-medium text-muted-foreground text-sm text-right">涨跌幅</th>
              <th className="pb-3 font-medium text-muted-foreground text-sm text-right hidden md:table-cell">操作</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((stock) => (
              <tr
                key={stock.code}
                className="border-b border-border/50 last:border-0 hover:bg-secondary/30 transition-colors cursor-pointer"
                onClick={() => handleStockClick(stock.code)}
              >
                <td className="py-3 pr-4 text-sm text-muted-foreground">{stock.rank}</td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    {stock.trend === "up" ? (
                      <TrendingUp className="w-4 h-4 text-stock-up" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-stock-down" />
                    )}
                    <span className="font-medium text-foreground">{stock.name}</span>
                  </div>
                </td>
                <td className="py-3 pr-4 text-sm text-muted-foreground">{stock.code}</td>
                <td className={`py-3 pr-4 text-right font-medium ${stock.trend === "up" ? "text-stock-up" : "text-stock-down"}`}>
                  {stock.price}
                </td>
                <td className={`py-3 pr-4 text-right text-sm ${stock.trend === "up" ? "text-stock-up" : "text-stock-down"}`}>
                  {stock.change}
                </td>
                <td className={`py-3 pr-4 text-right text-sm font-medium ${stock.trend === "up" ? "text-stock-up" : "text-stock-down"}`}>
                  {stock.changePercent}
                </td>
                <td className="py-3 text-right hidden md:table-cell">
                  {stock.inWatchlist ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Check className="w-3 h-3" />
                      已加自选
                    </span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={(e) => handleAddToWatchlist(stock.code, e)}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      自选
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <Card className="h-full" id="market">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            热门股票
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {updateTime ? `数据时间: ${updateTime.slice(11, 16)}` : `更新时间: ${currentTime}`}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {renderContent()}
      </CardContent>
    </Card>
  )
}
