"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { TrendingUp, TrendingDown, Minus, Loader2, RefreshCw } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const INDEX_SYMBOLS = "000001,399001,399006,000688"

const INDEX_NAME_MAP: Record<string, string> = {
  "000001": "上证指数",
  "399001": "深证成指",
  "399006": "创业板指",
  "000688": "科创50",
}

interface ApiIndexItem {
  指数代码: string
  指数简称: string
  最新价: number
  涨跌幅: number
  涨跌额: number
  更新时间: string
}

interface DisplayIndex {
  code: string
  name: string
  price: string
  changePercent: string
  trend: "up" | "down" | "flat"
}

type LoadingState = "loading" | "success" | "error"

function isTradingHours(): boolean {
  const now = new Date()
  const day = now.getDay()
  if (day === 0 || day === 6) return false
  const h = now.getHours()
  const m = now.getMinutes()
  const t = h * 60 + m
  return (t >= 570 && t <= 690) || (t >= 780 && t <= 900)
}

function formatPrice(val: number): string {
  return val.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatPercent(val: number): string {
  const sign = val > 0 ? "+" : ""
  return `${sign}${val.toFixed(2)}%`
}

export function IndexCards() {
  const [loadingState, setLoadingState] = useState<LoadingState>("loading")
  const [indices, setIndices] = useState<DisplayIndex[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setRefreshing(true)
      setLoadingState("loading")
    }
    try {
      const res = await fetch(`/api/cn/index/quotes?symbols=${INDEX_SYMBOLS}`)
      if (!res.ok) throw new Error("fetch failed")
      const json = await res.json()
      if (json.code !== 200 || !json.data) throw new Error("invalid response")
      const items: ApiIndexItem[] = json.data.行情 || []
      const display: DisplayIndex[] = items.map((item) => {
        const pct = item.涨跌幅 ?? 0
        const trend: "up" | "down" | "flat" = pct > 0 ? "up" : pct < 0 ? "down" : "flat"
        return {
          code: item.指数代码,
          name: INDEX_NAME_MAP[item.指数代码] || item.指数简称,
          price: formatPrice(item.最新价),
          changePercent: formatPercent(pct),
          trend,
        }
      })
      setIndices(display)
      setLoadingState("success")
    } catch {
      if (showLoading) setLoadingState("error")
    } finally {
      if (showLoading) setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData(true)
  }, [fetchData])

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (isTradingHours()) {
      intervalRef.current = setInterval(() => {
        fetchData(false)
      }, 60000)
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [fetchData])

  if (loadingState === "loading" && indices.length === 0) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-3">
              <div className="flex items-center justify-center h-12">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (loadingState === "error" && indices.length === 0) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="col-span-full overflow-hidden">
          <CardContent className="p-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">指数数据加载失败</span>
            <Button variant="ghost" size="sm" onClick={() => fetchData(true)}>
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              重试
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {indices.map((index) => (
          <Card key={index.code} className="overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="font-medium text-foreground text-sm">{index.name}</p>
                {index.trend === "up" ? (
                  <TrendingUp className="w-3.5 h-3.5 text-stock-up" />
                ) : index.trend === "down" ? (
                  <TrendingDown className="w-3.5 h-3.5 text-stock-down" />
                ) : (
                  <Minus className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </div>
              <div className="flex items-baseline justify-between">
                <span
                  className={`text-base font-bold ${
                    index.trend === "up"
                      ? "text-stock-up"
                      : index.trend === "down"
                      ? "text-stock-down"
                      : "text-foreground"
                  }`}
                >
                  {index.price}
                </span>
                <span
                  className={`text-xs font-medium ${
                    index.trend === "up"
                      ? "text-stock-up"
                      : index.trend === "down"
                      ? "text-stock-down"
                      : "text-muted-foreground"
                  }`}
                >
                  {index.changePercent}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
        市场数据为实时行情，可能存在延迟，仅供学习参考，不构成任何投资建议。
      </p>
    </div>
  )
}
