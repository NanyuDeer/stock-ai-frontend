"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { TrendingUp, TrendingDown, Loader2, AlertCircle, Star, Trash2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getWatchlistCodes, removeFromWatchlist, type WatchlistItem } from "@/lib/watchlist"

interface CoreQuoteItem {
  股票代码: string
  股票简称: string
  最新价: number
  涨跌幅: number
  更新时间: string
}

type LoadingState = "loading" | "success" | "error" | "empty"

async function fetchBatchCoreQuotes(symbols: string[]): Promise<CoreQuoteItem[]> {
  if (symbols.length === 0) return []
  const res = await fetch(`/api/cn/stock/quotes/core?symbols=${symbols.join(",")}`)
  if (!res.ok) throw new Error("core quotes fetch failed")
  const json = await res.json()
  if (json.code !== 200 || !json.data) throw new Error("core quotes invalid response")
  return json.data.行情 || []
}

function formatPrice(val: number): string {
  return val.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatChangePercent(val: number): string {
  const sign = val > 0 ? "+" : ""
  return `${sign}${val.toFixed(2)}%`
}

export function Watchlist() {
  const router = useRouter()
  const [isMounted, setIsMounted] = useState(false)
  const [loadingState, setLoadingState] = useState<LoadingState>("loading")
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])

  const loadData = useCallback(async () => {
    const codes = getWatchlistCodes()
    if (codes.length === 0) {
      setWatchlist([])
      setLoadingState("empty")
      return
    }

    setLoadingState("loading")
    try {
      const quotes = await fetchBatchCoreQuotes(codes)
      const items: WatchlistItem[] = quotes.map((q) => {
        const changePercent = q.涨跌幅 ?? 0
        const trend: "up" | "down" | "flat" = changePercent > 0 ? "up" : changePercent < 0 ? "down" : "flat"
        return {
          code: q.股票代码,
          name: q.股票简称,
          price: formatPrice(q.最新价),
          changePercent: formatChangePercent(changePercent),
          trend,
        }
      })
      setWatchlist(items)
      setLoadingState("success")
    } catch {
      setWatchlist([])
      setLoadingState("error")
    }
  }, [])

  useEffect(() => {
    setIsMounted(true)
    loadData()

    const handleWatchlistChange = () => {
      loadData()
    }
    window.addEventListener("watchlist-changed", handleWatchlistChange)
    return () => {
      window.removeEventListener("watchlist-changed", handleWatchlistChange)
    }
  }, [loadData])

  const removeStock = (code: string) => {
    removeFromWatchlist(code)
    setWatchlist((prev) => prev.filter((stock) => stock.code !== code))
  }

  const handleStockClick = (code: string) => {
    router.push(`/stock/${code}`)
  }

  const renderContent = () => {
    if (!isMounted || loadingState === "loading") {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">加载自选股...</span>
          </div>
        </div>
      )
    }

    if (loadingState === "error") {
      return (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <AlertCircle className="w-8 h-8 text-stock-down" />
          <p className="text-sm text-muted-foreground">加载失败</p>
          <Button variant="outline" size="sm" onClick={loadData}>
            重试
          </Button>
        </div>
      )
    }

    if (loadingState === "empty" || watchlist.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <Star className="w-8 h-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">暂无自选股</p>
          <p className="text-xs text-muted-foreground">可在热门股票中添加自选</p>
        </div>
      )
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {watchlist.map((stock) => (
          <div
            key={stock.code}
            className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors group cursor-pointer"
            onClick={() => handleStockClick(stock.code)}
          >
            <div className="flex items-center gap-2 min-w-0">
              {stock.trend === "up" ? (
                <TrendingUp className="w-4 h-4 text-stock-up shrink-0" />
              ) : (
                <TrendingDown className="w-4 h-4 text-stock-down shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-medium text-foreground text-sm truncate">{stock.name}</p>
                <p className="text-xs text-muted-foreground">{stock.code}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className={`font-medium text-sm ${stock.trend === "up" ? "text-stock-up" : "text-stock-down"}`}>
                  {stock.price}
                </p>
                <p className={`text-xs ${stock.trend === "up" ? "text-stock-up" : "text-stock-down"}`}>
                  {stock.changePercent}
                </p>
              </div>
              <button
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full hover:bg-primary hover:text-white"
                onClick={(e) => {
                  e.stopPropagation()
                  removeStock(stock.code)
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <Card id="watchlist">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Star className="w-5 h-5 text-primary" />
            我的自选
          </CardTitle>
          {watchlist.length > 0 && (
            <span className="text-xs text-muted-foreground">{watchlist.length} 只</span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {renderContent()}
      </CardContent>
    </Card>
  )
}
