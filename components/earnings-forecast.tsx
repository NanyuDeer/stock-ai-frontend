"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { LineChart, RefreshCw, Loader2, AlertCircle, ChevronDown } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface ForecastItem {
  股票代码: string
  股票简称: string
  更新时间: string
  "净利润同比(%)": number
  摘要: string
}

interface ParsedItem {
  rank: number
  code: string
  name: string
  netProfit: number | null
  netProfitYoy: number | null
  orgCount: number | null
  eps: number | null
  epsYoy: number | null
}

type SortOption = "forecast_netprofit_yoy" | "symbol"
type OrderOption = "desc" | "asc"
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

function parseSummary(summary: string): {
  orgCount: number | null
  eps: number | null
  epsYoy: number | null
  netProfit: number | null
  netProfitYoy: number | null
} {
  const result = {
    orgCount: null as number | null,
    eps: null as number | null,
    epsYoy: null as number | null,
    netProfit: null as number | null,
    netProfitYoy: null as number | null,
  }

  const orgMatch = summary.match(/共有\s*(\d+)\s*家机构/)
  if (orgMatch) result.orgCount = parseInt(orgMatch[1], 10)

  const epsMatch = summary.match(/每股收益\s*([-\d.]+)\s*元/)
  if (epsMatch) result.eps = parseFloat(epsMatch[1])

  const epsYoyMatch = summary.match(/每股收益[^，]*?增长\s*([-\d.]+)%/)
  if (epsYoyMatch) result.epsYoy = parseFloat(epsYoyMatch[1])

  const profitMatch = summary.match(/净利润\s*([-\d.]+)\s*亿元/)
  if (profitMatch) result.netProfit = parseFloat(profitMatch[1])

  const profitYoyMatch = summary.match(/净利润[^，]*?增长\s*([-\d.]+)%/)
  if (profitYoyMatch) result.netProfitYoy = parseFloat(profitYoyMatch[1])

  return result
}

export function EarningsForecast() {
  const router = useRouter()
  const [loadingState, setLoadingState] = useState<LoadingState>("loading")
  const [parsedList, setParsedList] = useState<ParsedItem[]>([])
  const [sort, setSort] = useState<SortOption>("forecast_netprofit_yoy")
  const [order, setOrder] = useState<OrderOption>("desc")
  const [showSortMenu, setShowSortMenu] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoadingState("loading")
    try {
      const res = await fetch(
        `/api/cn/stocks/profit-forecast?page=1&pageSize=20&sort=${sort}&order=${order}`
      )
      if (!res.ok) throw new Error("fetch failed")
      const json = await res.json()
      if (json.code !== 200 || !json.data) throw new Error("invalid response")
      const items: ForecastItem[] = json.data.盈利预测列表 || []
      const parsed = items.map((item, idx) => {
        const p = parseSummary(item.摘要)
        return {
          rank: idx + 1,
          code: item.股票代码,
          name: item.股票简称,
          netProfit: p.netProfit,
          netProfitYoy: item["净利润同比(%)"] ?? p.netProfitYoy,
          orgCount: p.orgCount,
          eps: p.eps,
          epsYoy: p.epsYoy,
        }
      })
      setParsedList(parsed)
      setLoadingState("success")
    } catch {
      if (showLoading) setLoadingState("error")
    }
  }, [sort, order])

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

  const sortLabels: Record<SortOption, string> = {
    forecast_netprofit_yoy: "净利润同比",
    symbol: "股票代码",
  }

  const handleSortChange = (s: SortOption) => {
    if (s === sort) {
      setOrder((prev) => (prev === "desc" ? "asc" : "desc"))
    } else {
      setSort(s)
      setOrder(s === "forecast_netprofit_yoy" ? "desc" : "asc")
    }
    setShowSortMenu(false)
  }

  const handleRowClick = (code: string) => {
    router.push(`/stock/${code}`)
  }

  const fmt = (v: number | null, decimals = 2) => {
    if (v == null || isNaN(v)) return "--"
    return v.toFixed(decimals)
  }

  const renderDropdown = (
    label: string,
    open: boolean,
    setOpen: (v: boolean) => void,
    options: { key: string; label: string }[],
    current: string,
    onChange: (key: any) => void
  ) => (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-secondary/50"
      >
        {label}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-md shadow-lg z-20 py-1 min-w-[140px]">
            {options.map((opt) => (
              <button
                key={opt.key}
                onClick={() => onChange(opt.key)}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-secondary/50 transition-colors ${
                  current === opt.key ? "text-primary font-medium" : "text-muted-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <LineChart className="w-5 h-5 text-primary" />
            业绩预测排行
          </CardTitle>
          {renderDropdown(
            sortLabels[sort] + (order === "desc" ? "↓" : "↑"),
            showSortMenu,
            setShowSortMenu,
            [
              { key: "forecast_netprofit_yoy", label: "净利润同比降序" },
              { key: "symbol", label: "股票代码排序" },
            ],
            sort,
            handleSortChange
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loadingState === "loading" && parsedList.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>加载预测数据...</span>
            </div>
          </div>
        ) : loadingState === "error" && parsedList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <AlertCircle className="w-10 h-10 text-stock-down" />
            <p className="text-muted-foreground">预测数据加载失败</p>
            <Button variant="outline" size="sm" onClick={() => fetchData(true)}>
              重新加载
            </Button>
          </div>
        ) : parsedList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <LineChart className="w-10 h-10 text-muted-foreground" />
            <p className="text-muted-foreground">暂无预测数据</p>
          </div>
        ) : (
          <div className="max-h-[370px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-2 pr-1 font-medium w-6">#</th>
                  <th className="text-left py-2 pr-1 font-medium">股票</th>
                  <th className="text-right py-2 pr-1 font-medium">净利润(亿)</th>
                  <th className="text-right py-2 pr-1 font-medium">同比(%)</th>
                  <th className="text-right py-2 pr-1 font-medium hidden sm:table-cell">机构</th>
                  <th className="text-right py-2 font-medium hidden sm:table-cell">EPS</th>
                </tr>
              </thead>
              <tbody>
                {parsedList.map((item) => (
                  <tr
                    key={item.code}
                    className="border-b border-border/50 hover:bg-secondary/50 cursor-pointer transition-colors"
                    onClick={() => handleRowClick(item.code)}
                  >
                    <td className="py-2 pr-1 text-muted-foreground">{item.rank}</td>
                    <td className="py-2 pr-1">
                      <div className="font-medium text-foreground truncate max-w-[72px]">{item.name}</div>
                      <div className="text-muted-foreground truncate max-w-[72px]">{item.code}</div>
                    </td>
                    <td className="py-2 pr-1 text-right font-medium text-foreground">
                      {fmt(item.netProfit)}
                    </td>
                    <td
                      className={`py-2 pr-1 text-right font-medium ${
                        item.netProfitYoy != null && item.netProfitYoy > 0
                          ? "text-stock-up"
                          : item.netProfitYoy != null && item.netProfitYoy < 0
                          ? "text-stock-down"
                          : "text-muted-foreground"
                      }`}
                    >
                      {item.netProfitYoy != null
                        ? `${item.netProfitYoy > 0 ? "+" : ""}${fmt(item.netProfitYoy)}`
                        : "--"}
                    </td>
                    <td className="py-2 pr-1 text-right text-muted-foreground hidden sm:table-cell">
                      {item.orgCount != null ? `${item.orgCount}家` : "--"}
                    </td>
                    <td className="py-2 text-right text-muted-foreground hidden sm:table-cell">
                      {fmt(item.eps)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground/70 mt-3 leading-relaxed">
          盈利预测数据基于机构预测，可能存在偏差，仅供学习参考，不构成任何投资建议。
        </p>
      </CardContent>
    </Card>
  )
}
