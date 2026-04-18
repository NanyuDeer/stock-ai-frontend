"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Activity, HelpCircle, ExternalLink, AlertTriangle, RefreshCw, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface ForecastItem {
  date: string
  low: number
  mid: number
  high: number
  trend: "up" | "down" | "flat"
}

interface KronosPredictionResult {
  method: string
  confidence: string
  summary: string
  forecasts: ForecastItem[]
}

interface KlineApiItem {
  时间: string
  开盘价: number
  最高价: number
  最低价: number
  收盘价: number
  成交量: number
  成交额: number
}

interface CachedPrediction {
  result: KronosPredictionResult
  timestamp: string
}

type LoadingState = "idle" | "loading" | "success" | "error"

const TOOLTIP_TEXT = `Kronos技术面预测说明：
当前输入窗口：最近 256 天历史K线；
预测范围：未来 5 个交易日。
基于清华大学 Kronos 金融 K 线基础大模型（https://arxiv.org/abs/2508.02739）进行A股价格区间预测。`

function getCacheKey(symbol: string): string {
  return `kronos_pred_${symbol}`
}

function getCachedPrediction(symbol: string): CachedPrediction | null {
  try {
    const raw = localStorage.getItem(getCacheKey(symbol))
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function setCachedPrediction(symbol: string, data: CachedPrediction) {
  try {
    localStorage.setItem(getCacheKey(symbol), JSON.stringify(data))
  } catch {}
}

function formatLocalTime(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  const h = String(now.getHours()).padStart(2, "0")
  const min = String(now.getMinutes()).padStart(2, "0")
  const s = String(now.getSeconds()).padStart(2, "0")
  return `${y}-${m}-${d} ${h}:${min}:${s}`
}

async function fetchKlineData(symbol: string): Promise<KlineApiItem[]> {
  const url = `/api/cn/stock/quotes/kline?symbol=${symbol}&klt=101&fqt=1&limit=300`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`K线接口 HTTP ${res.status}`)
  const json = await res.json()
  if (json.code !== 200 || !json.data) throw new Error("K线接口返回异常")
  const items: KlineApiItem[] = json.data.K线 || []
  if (items.length === 0) throw new Error("K线数据为空")
  items.sort((a, b) => a.时间.localeCompare(b.时间))
  return items.slice(-256)
}

async function fetchKronosPrediction(symbol: string, klineData: KlineApiItem[]): Promise<KronosPredictionResult> {
  const payload = {
    symbol,
    data: klineData.map((item) => ({
      date: item.时间,
      open: item.开盘价,
      high: item.最高价,
      low: item.最低价,
      close: item.收盘价,
      volume: item.成交量,
    })),
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  try {
    const res = await fetch("/kronos/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!res.ok) {
      throw new Error(`Kronos 服务 HTTP ${res.status}`)
    }

    const json = await res.json()

    if (json.error) {
      throw new Error(json.error + (json.detail ? `：${json.detail}` : ""))
    }

    if (!json.forecasts || !Array.isArray(json.forecasts)) {
      throw new Error("返回数据格式异常：缺少 forecasts 字段")
    }

    return json as KronosPredictionResult
  } finally {
    clearTimeout(timeoutId)
  }
}

function ForecastTable({ forecasts }: { forecasts: ForecastItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2 px-3 text-left font-medium text-muted-foreground">日期</th>
            <th className="py-2 px-3 text-right font-medium text-muted-foreground">最低价</th>
            <th className="py-2 px-3 text-right font-medium text-muted-foreground">中间价</th>
            <th className="py-2 px-3 text-right font-medium text-muted-foreground">最高价</th>
            <th className="py-2 px-3 text-center font-medium text-muted-foreground">趋势</th>
          </tr>
        </thead>
        <tbody>
          {forecasts.map((f, i) => (
            <tr key={i} className="border-b last:border-b-0 hover:bg-secondary/30 transition-colors">
              <td className="py-2 px-3 text-foreground">{f.date}</td>
              <td className="py-2 px-3 text-right text-foreground">{f.low.toFixed(2)}</td>
              <td className="py-2 px-3 text-right font-medium text-foreground">{f.mid.toFixed(2)}</td>
              <td className="py-2 px-3 text-right text-foreground">{f.high.toFixed(2)}</td>
              <td className="py-2 px-3 text-center">
                <Badge
                  variant="outline"
                  className={
                    f.trend === "up"
                      ? "border-red-300 text-red-600 bg-red-50"
                      : f.trend === "down"
                      ? "border-green-300 text-green-600 bg-green-50"
                      : "border-gray-300 text-gray-600 bg-gray-50"
                  }
                >
                  {f.trend === "up" ? "↑ 上涨" : f.trend === "down" ? "↓ 下跌" : "→ 横盘"}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ForecastChart({ forecasts, lastClose }: { forecasts: ForecastItem[]; lastClose: number }) {
  const width = 320
  const height = 180
  const padding = { top: 20, right: 20, bottom: 30, left: 50 }

  const allValues = [lastClose, ...forecasts.flatMap((f) => [f.low, f.mid, f.high])]
  const minVal = Math.min(...allValues)
  const maxVal = Math.max(...allValues)
  const range = maxVal - minVal || 1
  const padRange = range * 0.15
  const adjMin = minVal - padRange
  const adjMax = maxVal + padRange
  const adjRange = adjMax - adjMin

  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom
  const barW = chartW / (forecasts.length + 1)
  const toX = (i: number) => padding.left + barW * (i + 0.5)
  const toY = (v: number) => padding.top + ((adjMax - v) / adjRange) * chartH

  const yTicks = 5
  const step = adjRange / (yTicks - 1)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxWidth: width }}>
      {Array.from({ length: yTicks }).map((_, i) => {
        const val = adjMin + step * i
        const y = toY(val)
        return (
          <g key={i}>
            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#e5e7eb" strokeWidth="0.5" />
            <text x={padding.left - 6} y={y + 4} fontSize="9" fill="#9ca3af" textAnchor="end">
              {val.toFixed(2)}
            </text>
          </g>
        )
      })}

      <line x1={toX(-0.3)} y1={toY(lastClose)} x2={toX(forecasts.length - 0.5)} y2={toY(lastClose)} stroke="#6b7280" strokeWidth="0.8" strokeDasharray="4,3" />
      <text x={toX(-0.3) - 4} y={toY(lastClose) - 4} fontSize="8" fill="#6b7280" textAnchor="end">
        昨收
      </text>

      {forecasts.map((f, i) => {
        const x = toX(i)
        const yLow = toY(f.low)
        const yHigh = toY(f.high)
        const yMid = toY(f.mid)
        const bandH = yLow - yHigh
        const bandColor = f.trend === "up" ? "#ef4444" : f.trend === "down" ? "#22c55e" : "#9ca3af"
        const bandOpacity = 0.18
        const lineColor = f.trend === "up" ? "#ef4444" : f.trend === "down" ? "#22c55e" : "#9ca3af"

        return (
          <g key={i}>
            <rect x={x - barW * 0.35} y={yHigh} width={barW * 0.7} height={Math.max(bandH, 2)} fill={bandColor} opacity={bandOpacity} rx="2" />
            <line x1={x - barW * 0.25} y1={yMid} x2={x + barW * 0.25} y2={yMid} stroke={lineColor} strokeWidth="1.5" strokeDasharray="3,2" />
            <circle cx={x} cy={yMid} r="2.5" fill={lineColor} />

            <text x={x} y={height - 8} fontSize="9" fill="#9ca3af" textAnchor="middle">
              {f.date.slice(5)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

interface KronosPredictionProps {
  symbol: string
}

export function KronosPrediction({ symbol }: KronosPredictionProps) {
  const [loadingState, setLoadingState] = useState<LoadingState>("idle")
  const [result, setResult] = useState<KronosPredictionResult | null>(null)
  const [lastClose, setLastClose] = useState<number | null>(null)
  const [errorMsg, setErrorMsg] = useState<string>("")
  const [updateTime, setUpdateTime] = useState<string>("")
  const [showTooltip, setShowTooltip] = useState(false)

  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const doPredict = useCallback(async () => {
    if (!mountedRef.current) return
    setLoadingState("loading")
    setErrorMsg("")

    try {
      const klineData = await fetchKlineData(symbol)
      if (!mountedRef.current) return

      const lastItem = klineData[klineData.length - 1]
      setLastClose(lastItem.收盘价)

      const predResult = await fetchKronosPrediction(symbol, klineData)
      if (!mountedRef.current) return

      const now = formatLocalTime()
      setResult(predResult)
      setUpdateTime(now)
      setLoadingState("success")

      setCachedPrediction(symbol, { result: predResult, timestamp: now })
    } catch (err: unknown) {
      if (!mountedRef.current) return
      setLoadingState("error")

      if (err instanceof DOMException && err.name === "AbortError") {
        setErrorMsg("Kronos 预测请求超时（30秒），请检查本地服务是否正常运行")
      } else if (err instanceof TypeError && err.message.includes("fetch")) {
        setErrorMsg("Kronos 本地预测服务未启动，请先运行 python kronos_server.py")
      } else if (err instanceof Error) {
        if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
          setErrorMsg("Kronos 本地预测服务未启动，请先运行 python kronos_server.py")
        } else {
          setErrorMsg(`预测失败：${err.message}`)
        }
      } else {
        setErrorMsg("预测失败：未知错误")
      }
    }
  }, [symbol])

  useEffect(() => {
    const cached = getCachedPrediction(symbol)
    if (cached) {
      setResult(cached.result)
      setUpdateTime(cached.timestamp)
      setLoadingState("success")
    } else {
      doPredict()
    }
  }, [symbol, doPredict])

  const isLoading = loadingState === "loading"

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Kronos 技术面预测</CardTitle>
            <div className="relative inline-block">
              <button
                className="w-5 h-5 rounded-full border border-muted-foreground/40 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/60 transition-colors"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                onFocus={() => setShowTooltip(true)}
                onBlur={() => setShowTooltip(false)}
                type="button"
                aria-label="Kronos预测说明"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
              {showTooltip && (
                <div className="absolute left-6 top-0 z-50 w-80 rounded-lg border bg-popover p-3 text-xs text-popover-foreground shadow-lg whitespace-pre-line">
                  {TOOLTIP_TEXT}
                </div>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={doPredict}
            disabled={isLoading}
            className="h-7 text-xs gap-1.5"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            刷新 Kronos 技术面预测
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {loadingState === "error" && (
          <div className="flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {isLoading && !result && (
          <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            正在调用 Kronos 模型进行预测...
          </div>
        )}

        {result && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground mb-1">预测方法</div>
                <div className="text-sm font-medium text-foreground">{result.method}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground mb-1">置信度</div>
                <div className="text-sm font-medium text-foreground">{result.confidence}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground mb-1">最后更新</div>
                <div className="text-sm font-medium text-foreground">{updateTime}</div>
              </div>
            </div>

            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground mb-1">趋势总结</div>
              <div className="text-sm text-foreground">{result.summary}</div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted-foreground mb-2">未来5个交易日预测区间</div>
                <ForecastTable forecasts={result.forecasts} />
              </div>
              <div className="flex items-center justify-center">
                <div>
                  <div className="text-xs text-muted-foreground mb-2 text-center">预测区间图</div>
                  {lastClose !== null && <ForecastChart forecasts={result.forecasts} lastClose={lastClose} />}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <ExternalLink className="w-3 h-3" />
              <a
                href="https://github.com/shiyu-coder/Kronos"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground transition-colors"
              >
                预训练模型与代码：https://github.com/shiyu-coder/Kronos
              </a>
            </div>

            <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>本预测仅作技术演示，不构成任何投资建议。</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
