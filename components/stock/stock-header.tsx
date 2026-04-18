"use client"

import { useState, useEffect } from "react"
import { TrendingUp, TrendingDown, ArrowLeft, Loader2, AlertCircle } from "lucide-react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface StockInfo {
  股票代码: string
  股票简称: string
  市场代码: string
  总股本: number
  流通股: number
  所属行业: string
  总市值: number
  流通市值: number
  上市时间: number
  地域板块: string
}

interface QuoteActivity {
  股票代码: string
  股票简称: string
  最新价: number
  均价: number
  涨跌幅: number
  涨跌额: number
  成交量: number
  成交额: number
  换手率: number
  量比: number
  最高价: number
  最低价: number
  今开价: number
  昨收价: number
  涨停价: number
  跌停价: number
  外盘: number
  内盘: number
  更新时间: string
}

interface MergedData {
  code: string
  name: string
  market: string
  price: string
  change: string
  changePercent: string
  trend: "up" | "down" | "flat"
  volume: string
  amount: string
  turnoverRate: string
  quantityRatio: string
  marketCap: string
  floatMarketCap: string
  high: string
  low: string
  open: string
  prevClose: string
  limitUp: string
  limitDown: string
  outerVol: string
  innerVol: string
  amplitude: string
  totalShares: string
  floatShares: string
  industry: string
  region: string
  listingDate: string
  updateTime: string
}

type LoadingState = "loading" | "success" | "error"

function formatMarketCap(val: number): string {
  if (val >= 1e12) return (val / 1e12).toFixed(2) + "万亿"
  if (val >= 1e8) return (val / 1e8).toFixed(2) + "亿"
  if (val >= 1e4) return (val / 1e4).toFixed(2) + "万"
  return val.toFixed(2)
}

function formatShares(val: number): string {
  if (val >= 1e8) return (val / 1e8).toFixed(2) + "亿股"
  if (val >= 1e4) return (val / 1e4).toFixed(2) + "万股"
  return val.toLocaleString("zh-CN") + "股"
}

function formatVolume(val: number): string {
  const shares = val
  if (shares >= 1e8) return (shares / 1e8).toFixed(2) + "亿股"
  if (shares >= 1e4) return (shares / 1e4).toFixed(2) + "万股"
  return shares.toLocaleString("zh-CN") + "股"
}

function formatAmount(val: number): string {
  if (val >= 1e12) return (val / 1e12).toFixed(2) + "万亿"
  if (val >= 1e8) return (val / 1e8).toFixed(2) + "亿"
  if (val >= 1e4) return (val / 1e4).toFixed(2) + "万"
  return val.toLocaleString("zh-CN")
}

function formatListingDate(val: number): string {
  const s = String(val)
  if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  return s
}

function formatPrice(val: number): string {
  return val.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function fetchStockInfo(symbol: string): Promise<StockInfo | null> {
  const res = await fetch(`/api/cn/stock/infos?symbols=${symbol}`)
  if (!res.ok) return null
  const json = await res.json()
  if (json.code !== 200 || !json.data?.股票信息?.length) return null
  return json.data.股票信息[0]
}

async function fetchQuoteActivity(symbol: string): Promise<QuoteActivity | null> {
  const res = await fetch(`/api/cn/stock/quotes/activity?symbols=${symbol}`)
  if (!res.ok) return null
  const json = await res.json()
  if (json.code !== 200 || !json.data?.行情?.length) return null
  return json.data.行情[0]
}

function mergeData(info: StockInfo | null, quote: QuoteActivity | null): MergedData | null {
  if (!info && !quote) return null
  const changePercent = quote?.涨跌幅 ?? 0
  const trend: "up" | "down" | "flat" = changePercent > 0 ? "up" : changePercent < 0 ? "down" : "flat"
  const prevClose = quote?.昨收价 ?? 0
  const high = quote?.最高价 ?? 0
  const low = quote?.最低价 ?? 0
  const amplitude = prevClose > 0 ? ((high - low) / prevClose * 100) : 0
  return {
    code: info?.股票代码 || quote?.股票代码 || "",
    name: info?.股票简称 || quote?.股票简称 || "",
    market: info?.市场代码 || "",
    price: quote ? formatPrice(quote.最新价) : "--",
    change: quote ? (quote.涨跌额 >= 0 ? "+" : "") + quote.涨跌额.toFixed(2) : "--",
    changePercent: quote ? (quote.涨跌幅 >= 0 ? "+" : "") + quote.涨跌幅.toFixed(2) + "%" : "--",
    trend,
    volume: quote ? formatVolume(quote.成交量) : "--",
    amount: quote ? formatAmount(quote.成交额) : "--",
    turnoverRate: quote ? quote.换手率.toFixed(2) + "%" : "--",
    quantityRatio: quote ? quote.量比.toFixed(2) : "--",
    marketCap: info ? formatMarketCap(info.总市值) : "--",
    floatMarketCap: info ? formatMarketCap(info.流通市值) : "--",
    high: quote ? formatPrice(quote.最高价) : "--",
    low: quote ? formatPrice(quote.最低价) : "--",
    open: quote ? formatPrice(quote.今开价) : "--",
    prevClose: quote ? formatPrice(quote.昨收价) : "--",
    limitUp: quote ? formatPrice(quote.涨停价) : "--",
    limitDown: quote ? formatPrice(quote.跌停价) : "--",
    outerVol: quote ? formatVolume(quote.外盘) : "--",
    innerVol: quote ? formatVolume(quote.内盘) : "--",
    amplitude: amplitude.toFixed(2) + "%",
    totalShares: info ? formatShares(info.总股本) : "--",
    floatShares: info ? formatShares(info.流通股) : "--",
    industry: info?.所属行业 || "--",
    region: info?.地域板块 || "--",
    listingDate: info ? formatListingDate(info.上市时间) : "--",
    updateTime: quote?.更新时间 || "",
  }
}

export function StockHeader({ code }: { code: string }) {
  const [loadingState, setLoadingState] = useState<LoadingState>("loading")
  const [data, setData] = useState<MergedData | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoadingState("loading")
      try {
        const [info, quote] = await Promise.all([
          fetchStockInfo(code),
          fetchQuoteActivity(code),
        ])
        if (cancelled) return
        const merged = mergeData(info, quote)
        if (!merged) {
          setLoadingState("error")
          return
        }
        setData(merged)
        setLoadingState("success")
      } catch {
        if (!cancelled) setLoadingState("error")
      }
    }
    load()
    return () => { cancelled = true }
  }, [code])

  if (loadingState === "loading") {
    return (
      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>加载基础数据...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loadingState === "error" || !data) {
    return (
      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold text-foreground">{code}</h1>
          </div>
          <div className="flex flex-col items-center justify-center py-6 gap-3">
            <AlertCircle className="w-8 h-8 text-stock-down" />
            <p className="text-muted-foreground">基础数据加载失败</p>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              重新加载
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const isPositive = data.trend === "up"

  return (
    <Card className="mb-6">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link
                href="/"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-xl font-bold text-foreground">{data.name}</h1>
              <span className="text-sm text-muted-foreground">{data.code}</span>
              <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-secondary">{data.market}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {data.industry !== "--" && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400`}>
                  {data.industry}
                </span>
              )}
              {data.region !== "--" && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-secondary text-muted-foreground">
                  {data.region}
                </span>
              )}
              {data.listingDate !== "--" && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-secondary text-muted-foreground">
                  上市日期：{data.listingDate}
                </span>
              )}
            </div>
          </div>
          {data.updateTime && (
            <span className="text-xs text-muted-foreground shrink-0">
              更新: {data.updateTime.slice(11, 16)}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">最新价</p>
            <p className={`text-lg font-bold ${isPositive ? "text-stock-up" : "text-stock-down"}`}>
              {data.price}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">涨跌额</p>
            <p className={`text-sm font-medium flex items-center gap-1 ${isPositive ? "text-stock-up" : "text-stock-down"}`}>
              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {data.change}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">涨跌幅</p>
            <p className={`text-sm font-medium ${isPositive ? "text-stock-up" : "text-stock-down"}`}>
              {data.changePercent}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">成交量</p>
            <p className="text-sm font-medium text-foreground">{data.volume}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">总市值</p>
            <p className="text-sm font-medium text-foreground">{data.marketCap}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">流通市值</p>
            <p className="text-sm font-medium text-foreground">{data.floatMarketCap}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">换手率</p>
            <p className="text-sm font-medium text-foreground">{data.turnoverRate}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">量比</p>
            <p className="text-sm font-medium text-foreground">{data.quantityRatio}</p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border/50 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">今开：</span>
            <span className="text-foreground">{data.open}</span>
          </div>
          <div>
            <span className="text-muted-foreground">昨收：</span>
            <span className="text-foreground">{data.prevClose}</span>
          </div>
          <div>
            <span className="text-muted-foreground">最高：</span>
            <span className="text-stock-up">{data.high}</span>
          </div>
          <div>
            <span className="text-muted-foreground">最低：</span>
            <span className="text-stock-down">{data.low}</span>
          </div>
          <div>
            <span className="text-muted-foreground">涨停价：</span>
            <span className="text-stock-up">{data.limitUp}</span>
          </div>
          <div>
            <span className="text-muted-foreground">跌停价：</span>
            <span className="text-stock-down">{data.limitDown}</span>
          </div>
          <div>
            <span className="text-muted-foreground">振幅：</span>
            <span className="text-foreground">{data.amplitude}</span>
          </div>
          <div>
            <span className="text-muted-foreground">成交额：</span>
            <span className="text-foreground">{data.amount}</span>
          </div>
          <div>
            <span className="text-muted-foreground">外盘：</span>
            <span className="text-stock-up">{data.outerVol}</span>
          </div>
          <div>
            <span className="text-muted-foreground">内盘：</span>
            <span className="text-stock-down">{data.innerVol}</span>
          </div>
          <div>
            <span className="text-muted-foreground">总股本：</span>
            <span className="text-foreground">{data.totalShares}</span>
          </div>
          <div>
            <span className="text-muted-foreground">流通股本：</span>
            <span className="text-foreground">{data.floatShares}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
