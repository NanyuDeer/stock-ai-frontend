"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { BarChart3, Loader2, AlertCircle, HelpCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

type PeriodType = "daily" | "weekly" | "monthly"

interface KlineItem {
  时间: string
  开盘价: number
  收盘价: number
  最高价: number
  最低价: number
  成交量: number
  成交额: number
  振幅: number
  涨跌幅: number
  涨跌额: number
  换手率: number
}

interface ChartDataPoint {
  date: string
  open: number
  close: number
  high: number
  low: number
  volume: number
  amount: number
  amplitude: number
  changePercent: number
  changeAmount: number
  turnoverRate: number
}

interface ForecastItem {
  date: string
  low: number
  mid: number
  high: number
  trend: "up" | "down" | "flat"
}

interface KlineResponse {
  code: number
  data: {
    股票代码: string
    K线周期: string
    复权类型: string
    数量: number
    K线: KlineItem[]
  }
}

const PERIOD_CONFIG: Record<PeriodType, { klt: number; fqt: number; defaultLimit: number; label: string }> = {
  daily: { klt: 101, fqt: 1, defaultLimit: 120, label: "日K" },
  weekly: { klt: 102, fqt: 1, defaultLimit: 120, label: "周K" },
  monthly: { klt: 103, fqt: 1, defaultLimit: 120, label: "月K" },
}

function mapApiToChart(item: KlineItem): ChartDataPoint {
  return {
    date: item.时间,
    open: item.开盘价,
    close: item.收盘价,
    high: item.最高价,
    low: item.最低价,
    volume: item.成交量,
    amount: item.成交额,
    amplitude: item.振幅,
    changePercent: item.涨跌幅,
    changeAmount: item.涨跌额,
    turnoverRate: item.换手率,
  }
}

function generateMAData(data: ChartDataPoint[], period: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < period - 1) return null
    const slice = data.slice(i - period + 1, i + 1)
    const avg = slice.reduce((s, d) => s + d.close, 0) / period
    return Math.round(avg * 100) / 100
  })
}

function isTradingHours(): boolean {
  const now = new Date()
  const day = now.getDay()
  if (day === 0 || day === 6) return false
  const h = now.getHours()
  const m = now.getMinutes()
  const t = h * 60 + m
  return (t >= 570 && t <= 690) || (t >= 780 && t <= 900)
}

function formatDateYYYYMMDD(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}${m}${d}`
}

function parseDateFromStr(str: string): Date {
  if (str.includes("-")) {
    const parts = str.split("-")
    return new Date(+parts[0], +parts[1] - 1, +parts[2])
  }
  if (str.includes("/")) {
    const parts = str.split("/")
    return new Date(+parts[0], +parts[1] - 1, +parts[2])
  }
  return new Date(str)
}

const PRED_TOOLTIP_TEXT = `Kronos技术面预测说明：
当前输入窗口：最近 256 天历史K线；
预测范围：未来 5 个交易日。
基于清华大学 Kronos 金融 K 线基础大模型（https://arxiv.org/abs/2508.02739）进行A股价格区间预测。`

type PredState = "idle" | "loading" | "success" | "error"

function RangeSlider({
  totalLength,
  rangeStart,
  rangeEnd,
  onChange,
}: {
  totalLength: number
  rangeStart: number
  rangeEnd: number
  onChange: (start: number, end: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<"left" | "right" | "bar" | null>(null)
  const dragStartXRef = useRef(0)
  const dragStartLeftRef = useRef(0)
  const dragStartRightRef = useRef(0)

  function getPos(e: React.MouseEvent): number {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return 0
    return Math.max(0, Math.min(rect.width, e.clientX - rect.left))
  }

  function handleMouseDown(e: React.MouseEvent, type: "left" | "right" | "bar") {
    e.preventDefault()
    setDragging(type)
    dragStartXRef.current = e.clientX
    dragStartLeftRef.current = rangeStart
    dragStartRightRef.current = rangeEnd
  }

  useEffect(() => {
    if (!dragging) return
    function onMove(e: MouseEvent) {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect || totalLength <= 0) return
      const dx = e.clientX - dragStartXRef.current
      const ratio = dx / rect.width
      const shift = Math.round(ratio * totalLength)

      if (dragging === "left") {
        let newStart = dragStartLeftRef.current + shift
        newStart = Math.max(0, Math.min(rangeEnd - 10, newStart))
        onChange(newStart, rangeEnd)
      } else if (dragging === "right") {
        let newEnd = dragStartRightRef.current + shift
        newEnd = Math.max(rangeStart + 10, Math.min(totalLength - 1, newEnd))
        onChange(rangeStart, newEnd)
      } else if (dragging === "bar") {
        let newStart = dragStartLeftRef.current + shift
        let newEnd = dragStartRightRef.current + shift
        const count = rangeEnd - rangeStart
        if (newStart < 0) {
          newEnd -= newStart
          newStart = 0
        }
        if (newEnd > totalLength - 1) {
          newStart -= (newEnd - (totalLength - 1))
          newEnd = totalLength - 1
        }
        newStart = Math.max(0, newStart)
        newEnd = Math.min(totalLength - 1, newEnd)
        onChange(newStart, newEnd)
      }
    }
    function onUp() {
      setDragging(null)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
  }, [dragging, totalLength, rangeStart, rangeEnd, onChange])

  const leftPct = totalLength > 0 ? (rangeStart / (totalLength - 1)) * 100 : 0
  const rightPct = totalLength > 0 ? (rangeEnd / (totalLength - 1)) * 100 : 100
  const barWidthPct = rightPct - leftPct

  return (
    <div className="w-full px-4 py-2">
      <div
        ref={containerRef}
        className="relative w-full h-6 select-none"
        onMouseDown={(e) => handleMouseDown(e, "bar")}
      >
        <div className="absolute top-1/2 -translate-y-1/2 w-full h-[3px] bg-blue-200 rounded-full" />

        <div
          className="absolute top-1/2 -translate-y-1/2 h-[6px] bg-blue-500 rounded-full cursor-grab active:cursor-grabbing"
          style={{ left: `${leftPct}%`, width: `${barWidthPct}%` }}
          onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, "bar") }}
        />

        <div
          className="absolute top-1/2 -translate-y-1/2 w-[14px] h-[14px] bg-white border-2 border-blue-500 rounded-full cursor-ew-resize z-10 shadow-sm hover:scale-110 transition-transform"
          style={{ left: `${leftPct}%`, marginLeft: "-7px" }}
          onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, "left") }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-[14px] h-[14px] bg-white border-2 border-blue-500 rounded-full cursor-ew-resize z-10 shadow-sm hover:scale-110 transition-transform"
          style={{ left: `${rightPct}%`, marginLeft: "-7px" }}
          onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, "right") }}
        />
      </div>
    </div>
  )
}

interface KlineChartProps {
  symbol: string
}

function KlineChart({ symbol }: KlineChartProps) {
  const [period, setPeriod] = useState<PeriodType>("daily")
  const [klineData, setKlineData] = useState<ChartDataPoint[]>([])
  const [loadingState, setLoadingState] = useState<"loading" | "success" | "error">("loading")
  const [errorMsg, setErrorMsg] = useState<string>("")
  const [lastUpdateTime, setLastUpdateTime] = useState<string>("")
  const [pollError, setPollError] = useState(false)

  const [sliderRange, setSliderRange] = useState<[number, number]>([0, 119])

  const [predState, setPredState] = useState<PredState>("idle")
  const [forecastData, setForecastData] = useState<ForecastItem[]>([])
  const [predError, setPredError] = useState("")

  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 450 })
  const [mounted, setMounted] = useState(false)
  const [crosshair, setCrosshair] = useState<{ x: number; dataIndex: number } | null>(null)
  const [showTooltip, setShowTooltip] = useState(false)

  const dataRef = useRef<ChartDataPoint[]>([])
  const periodRef = useRef<PeriodType>(period)
  const symbolRef = useRef(symbol)
  const predFetchedSymbol = useRef<string>("")

  useEffect(() => {
    dataRef.current = klineData
  }, [klineData])

  useEffect(() => {
    periodRef.current = period
  }, [period])

  useEffect(() => {
    symbolRef.current = symbol
  }, [symbol])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    function updateSize() {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth || 800,
          height: 420,
        })
      }
    }
    updateSize()
    window.addEventListener("resize", updateSize)
    return () => window.removeEventListener("resize", updateSize)
  }, [mounted])

  const fetchData = useCallback(async (
    klt: number,
    fqt: number,
    limit?: number,
    startDate?: string,
    endDate?: string
  ) => {
    try {
      let url = `/api/cn/stock/quotes/kline?symbol=${symbolRef.current}&klt=${klt}&fqt=${fqt}`
      if (startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`
      } else if (limit) {
        url += `&limit=${limit}`
      }

      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const json: KlineResponse = await res.json()
      if (json.code !== 200 || !json.data) throw new Error("接口返回异常")

      const items = json.data.K线 || []
      if (items.length === 0) {
        return []
      }

      const chartData = items.map(mapApiToChart)
      return chartData
    } catch (err) {
      throw err
    }
  }, [])

  const loadInitialData = useCallback(async (isInitial: boolean = false) => {
    const cfg = PERIOD_CONFIG[periodRef.current]
    try {
      if (isInitial) setLoadingState("loading")
      setPollError(false)

      const chartData = await fetchData(cfg.klt, cfg.fqt, cfg.defaultLimit)
      if (chartData && chartData.length > 0) {
        setKlineData(chartData)
        const lastItem = chartData[chartData.length - 1]
        setLastUpdateTime(lastItem.date)
        const defaultVisibleCount = 60
        const defaultStart = Math.max(0, chartData.length - defaultVisibleCount)
        setSliderRange([defaultStart, chartData.length - 1])
      }
      if (isInitial) setLoadingState("success")
    } catch {
      setPollError(true)
      if (isInitial) {
        setLoadingState("error")
        setErrorMsg("K线数据加载失败")
      }
    }
  }, [fetchData])

  const fetchPrediction = useCallback(async () => {
    if (predState === "loading") return
    try {
      setPredState("loading")
      setPredError("")

      const rawKlineRes = await fetch(`/api/cn/stock/quotes/kline?symbol=${symbolRef.current}&klt=101&fqt=1&limit=300`)
      if (!rawKlineRes.ok) throw new Error(`K线接口 HTTP ${rawKlineRes.status}`)
      const rawJson = await rawKlineRes.json()
      if (rawJson.code !== 200 || !rawJson.data) throw new Error("K线接口返回异常")

      const items: KlineItem[] = rawJson.data.K线 || []
      if (items.length === 0) throw new Error("K线数据为空")
      items.sort((a, b) => a.时间.localeCompare(b.时间))
      const sliced = items.slice(-256)

      const payload = {
        symbol: symbolRef.current,
        data: sliced.map((item) => ({
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
        const predRes = await fetch("/kronos/predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        })

        if (!predRes.ok) throw new Error(`Kronos 服务 HTTP ${predRes.status}`)

        const predJson = await predRes.json()

        if (predJson.error) {
          throw new Error(predJson.error + (predJson.detail ? `：${predJson.detail}` : ""))
        }

        if (!predJson.forecasts || !Array.isArray(predJson.forecasts)) {
          throw new Error("返回数据格式异常")
        }

        setForecastData(predJson.forecasts)
        setPredState("success")
      } finally {
        clearTimeout(timeoutId)
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setPredError("预测请求超时（30秒）")
      } else if (err instanceof TypeError && err.message.includes("fetch")) {
        setPredError("本地预测服务未启动")
      } else if (err instanceof Error) {
        if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
          setPredError("本地预测服务未启动")
        } else {
          setPredError(err.message)
        }
      } else {
        setPredError("未知错误")
      }
      setPredState("error")
    }
  }, [predState])

  useEffect(() => {
    loadInitialData(true)
  }, [symbol, period])

  useEffect(() => {
    if (klineData.length > 0 && predState === "idle" && symbol !== predFetchedSymbol.current) {
      predFetchedSymbol.current = symbol
      fetchPrediction()
    }
  }, [klineData, predState, symbol, fetchPrediction])

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isTradingHours()) return
      const cfg = PERIOD_CONFIG[periodRef.current]
      fetchData(cfg.klt, cfg.fqt, cfg.defaultLimit).then((chartData) => {
        if (chartData && chartData.length > 0) {
          setKlineData(chartData)
          const lastItem = chartData[chartData.length - 1]
          setLastUpdateTime(lastItem.date)
          const defaultVisibleCount = 60
          const defaultStart = Math.max(0, chartData.length - defaultVisibleCount)
          setSliderRange([defaultStart, chartData.length - 1])
          setPollError(false)
        }
      }).catch(() => {
        setPollError(true)
      })
    }, 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleSliderChange = useCallback((start: number, end: number) => {
    setSliderRange([start, end])
  }, [])

  const ma5 = { name: "MA5", data: generateMAData(klineData, 5), color: "#f97316" }
  const ma10 = { name: "MA10", data: generateMAData(klineData, 10), color: "#3b82f6" }
  const ma20 = { name: "MA20", data: generateMAData(klineData, 20), color: "#a855f7" }
  const ma60 = { name: "MA60", data: generateMAData(klineData, Math.min(60, Math.max(5, Math.floor(klineData.length * 0.6)))), color: "#22c55e" }
  const maLines = [ma5, ma10, ma20, ma60]

  const [rangeStart, rangeEnd] = sliderRange
  const visibleData = klineData.slice(Math.floor(rangeStart), Math.floor(rangeEnd) + 1)

  const PRED_DAYS = 5
  const hasPrediction = predState === "success" && forecastData.length === PRED_DAYS
  const allDataLen = visibleData.length + (hasPrediction ? PRED_DAYS : 0)

  if (!mounted || loadingState === "loading") {
    return (
      <div ref={containerRef} className="w-full" style={{ height: 450 }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-muted-foreground">加载K线数据...</span>
          <div className="flex items-center gap-2">
            {(["daily", "weekly", "monthly"] as PeriodType[]).map((p) => (
              <button key={p} className={`px-3 h-7 rounded text-xs font-medium transition-colors ${p === period ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
                {PERIOD_CONFIG[p].label}
              </button>
            ))}
          </div>
        </div>
        <div className="w-full bg-secondary/30 rounded flex items-center justify-center" style={{ height: 360 }}>
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (loadingState === "error" && klineData.length === 0) {
    return (
      <div ref={containerRef} className="w-full" style={{ height: 450 }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-muted-foreground">K线数据</span>
          <div className="flex items-center gap-2">
            {(["daily", "weekly", "monthly"] as PeriodType[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 h-7 rounded text-xs font-medium transition-colors ${p === period ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}
              >
                {PERIOD_CONFIG[p].label}
              </button>
            ))}
          </div>
        </div>
        <div className="w-full bg-secondary/30 rounded flex flex-col items-center justify-center gap-3" style={{ height: 360 }}>
          <AlertCircle className="w-8 h-8 text-stock-down" />
          <p className="text-sm text-muted-foreground">{errorMsg || "K线数据加载失败"}</p>
          <button
            onClick={() => loadInitialData(true)}
            className="px-3 h-8 rounded text-xs font-medium border bg-background hover:bg-accent transition-colors"
          >
            重新加载
          </button>
        </div>
      </div>
    )
  }

  if (!visibleData || visibleData.length === 0) {
    return (
      <div ref={containerRef} className="w-full" style={{ height: 450 }}>
        <div className="w-full bg-secondary/30 rounded flex items-center justify-center" style={{ height: 360 }}>
          <span className="text-sm text-muted-foreground">暂无K线数据</span>
        </div>
      </div>
    )
  }

  const padding = { top: 25, right: 10, bottom: 35, left: 58 }
  const priceAreaHeight = dimensions.height - padding.top - padding.bottom - 70
  const volumeAreaHeight = 45
  const totalChartHeight = priceAreaHeight + volumeAreaHeight + 20

  const allPricesForRange = [...visibleData.flatMap((d) => [d.high, d.low])]
  if (hasPrediction) {
    forecastData.forEach((f) => { allPricesForRange.push(f.high, f.low) })
  }
  const minP = Math.min(...allPricesForRange)
  const maxP = Math.max(...allPricesForRange)
  const priceRange = maxP - minP || 1
  const pricePadding = priceRange * 0.06
  const adjMin = minP - pricePadding
  const adjMax = maxP + pricePadding
  const adjRange = adjMax - adjMin || 1

  const chartWidth = dimensions.width - padding.left - padding.right
  const candleW = Math.max(3, Math.min(8, chartWidth / allDataLen * 0.7))
  const candleGap = Math.max(1, (chartWidth - candleW * allDataLen) / (allDataLen + 1))

  const toY = (price: number) => padding.top + ((adjMax - price) / adjRange) * priceAreaHeight
  const toX = (i: number) => padding.left + candleGap + i * (candleW + candleGap)
  const toVolY = (vol: number) => {
    const maxVol = Math.max(...visibleData.map((d) => d.volume))
    return padding.top + priceAreaHeight + 20 + volumeAreaHeight - (vol / maxVol) * volumeAreaHeight
  }

  function niceNum(range: number): number[] {
    const roughStep = range / 4
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)))
    const residual = roughStep / magnitude
    let step: number
    if (residual <= 1.5) step = magnitude
    else if (residual <= 3) step = 2 * magnitude
    else if (residual <= 7) step = 5 * magnitude
    else step = 10 * magnitude
    const lo = Math.floor(adjMin / step) * step
    const hi = Math.ceil(adjMax / step) * step
    const steps = []
    for (let v = lo; v <= hi + 0.001; v += step) steps.push(Math.round(v * 100) / 100)
    return steps
  }

  const yTicks = niceNum(adjRange)
  const dateStep = Math.max(1, Math.ceil(allDataLen / 16))

  const visibleMA = maLines.map((ma) => ({
    ...ma,
    data: ma.data.slice(Math.floor(rangeStart), Math.floor(rangeEnd) + 1),
  }))

  function handleCrosshairMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const scaleX = dimensions.width / rect.width
    const relX = mx * scaleX
    const idx = Math.round((relX - padding.left - candleGap / 2) / (candleW + candleGap))
    if (idx >= 0 && idx < allDataLen) {
      setCrosshair({ x: relX, dataIndex: idx })
    } else {
      setCrosshair(null)
    }
  }

  function handleCrosshairLeave() {
    setCrosshair(null)
  }

  const chData = crosshair !== null && crosshair.dataIndex < visibleData.length ? visibleData[crosshair.dataIndex] : null
  const chX = crosshair !== null ? toX(crosshair.dataIndex) + candleW / 2 : null
  const chY = chData ? toY(chData.close) : null

  const overallTrend = hasPrediction
    ? (forecastData.filter((f) => f.trend === "up").length >= 3 ? "bullish" :
       forecastData.filter((f) => f.trend === "down").length >= 3 ? "bearish" : "neutral")
    : null

  const bearishProb = hasPrediction
    ? Math.round((forecastData.filter((f) => f.trend === "down").length / PRED_DAYS) * 1000) / 10
    : 0

  const bullishProb = hasPrediction ? 100 - bearishProb : 0

  const trendLabel = overallTrend === "bearish" ? "看空" : overallTrend === "bullish" ? "看涨" : "震荡"
  const trendColor = overallTrend === "bearish" ? "#22c55e" : overallTrend === "bullish" ? "#ef4444" : "#9ca3af"
  const probValue = overallTrend === "bearish" ? bearishProb : overallTrend === "bullish" ? bullishProb : 50
  const probLabel = overallTrend === "bearish" ? "获利" : overallTrend === "bullish" ? "止损" : "观望"

  const lastClosePrice = visibleData.length > 0 ? visibleData[visibleData.length - 1].close : 0

  return (
    <div ref={containerRef} className="w-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {overallTrend !== null && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold" style={{ color: trendColor }}>{trendLabel}</span>
              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${probValue}%`,
                    backgroundColor: trendColor,
                  }}
                />
              </div>
              <span className="text-xs text-muted-foreground">{probValue.toFixed(1)}%</span>
              <span className="text-xs text-muted-foreground">{probLabel}|{lastUpdateTime || "--"}</span>
            </div>
          )}
          {!overallTrend && predState === "loading" && (
            <span className="text-xs text-muted-foreground">历史K线</span>
          )}
          {!overallTrend && predState !== "loading" && (
            <span className="text-xs text-muted-foreground">历史K线</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {(["daily", "weekly", "monthly"] as PeriodType[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 h-7 rounded text-xs font-medium transition-colors ${
                period === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {PERIOD_CONFIG[p].label}
            </button>
          ))}
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
              <div className="absolute right-0 top-7 z-50 w-72 rounded-lg border bg-popover p-3 text-xs text-popover-foreground shadow-lg whitespace-pre-line">
                {PRED_TOOLTIP_TEXT}
              </div>
            )}
          </div>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${dimensions.width} ${totalChartHeight}`}
        className="w-full cursor-crosshair"
        style={{ minHeight: totalChartHeight }}
        onMouseMove={handleCrosshairMove}
        onMouseLeave={handleCrosshairLeave}
      >
        {yTicks.map((price, i) => {
          const y = toY(price)
          return (
            <g key={i}>
              <line x1={padding.left} y1={y} x2={dimensions.width - padding.right} y2={y} stroke="#e5e7eb" strokeWidth="0.6" />
              <text x={padding.left - 6} y={y + 4} fontSize="10" fill="#9ca3af" textAnchor="end">
                {price.toFixed(2)}
              </text>
            </g>
          )
        })}

        {visibleMA.filter((ma) => ma.data.some((v) => v !== null)).map((ma) => (
          <polyline
            key={ma.name}
            points={ma.data.map((v, i) => (v !== null ? `${toX(i)},${toY(v)}` : "")).filter(Boolean).join(" ")}
            fill="none"
            stroke={ma.color}
            strokeWidth="1.1"
            opacity="0.85"
          />
        ))}

        {visibleData.map((d, i) => {
          const isUp = d.close >= d.open
          const color = isUp ? "#ef4444" : "#22c55e"
          const x = toX(i)
          const bodyTop = toY(Math.max(d.open, d.close))
          const bodyH = Math.abs(toY(d.open) - toY(d.close)) || 1
          const volH = Math.max(1, padding.top + priceAreaHeight + 20 + volumeAreaHeight - toVolY(d.volume))
          return (
            <g key={i}>
              <line x1={x + candleW / 2} y1={toY(d.high)} x2={x + candleW / 2} y2={toY(d.low)} stroke={color} strokeWidth="1" />
              <rect x={x} y={bodyTop} width={candleW} height={bodyH} fill={color} rx="0.5" />
              <rect x={x} y={toVolY(d.volume)} width={candleW} height={volH} fill={color} opacity="0.3" rx="0.5" />
            </g>
          )
        })}

        {hasPrediction && (() => {
          const baseIdx = visibleData.length
          const highPoints: string[] = []
          const lowPoints: string[] = []
          const midPoints: string[] = []

          forecastData.forEach((f, i) => {
            const idx = baseIdx + i
            const cx = toX(idx) + candleW / 2
            highPoints.push(`${cx},${toY(f.high)}`)
            lowPoints.push(`${cx},${toY(f.low)}`)
            midPoints.push(`${cx},${toY(f.mid)}`)
          })

          const firstTrend = forecastData[0].trend
          const bandColor = firstTrend === "up" ? "#ef4444" : firstTrend === "down" ? "#22c55e" : "#9ca3af"

          return (
            <g>
              {forecastData.map((f, i) => {
                const idx = baseIdx + i
                const x = toX(idx)
                const yHigh = toY(f.high)
                const yLow = toY(f.low)
                const yMid = toY(f.mid)
                const bandH = yLow - yHigh

                return (
                  <g key={`pred-${i}`}>
                    <rect
                      x={x}
                      y={yHigh}
                      width={candleW}
                      height={Math.max(bandH, 2)}
                      fill={bandColor}
                      opacity="0.12"
                      rx="1.5"
                    />
                    <circle cx={x + candleW / 2} cy={yMid} r="3.5" fill="#fff" stroke={bandColor} strokeWidth="1.8" />
                  </g>
                )
              })}

              <polyline
                points={highPoints.join(" ")}
                fill="none"
                stroke={bandColor}
                strokeWidth="1.2"
                strokeDasharray="4,3"
                opacity="0.65"
              />
              <polyline
                points={lowPoints.join(" ")}
                fill="none"
                stroke={bandColor}
                strokeWidth="1.2"
                strokeDasharray="4,3"
                opacity="0.65"
              />
              <polyline
                points={midPoints.join(" ")}
                fill="none"
                stroke={bandColor}
                strokeWidth="2"
                opacity="0.85"
              />
            </g>
          )
        })()}

        {predState === "loading" && (
          <g pointerEvents="none">
            <rect
              x={padding.left + chartWidth * 0.68}
              y={padding.top + priceAreaHeight * 0.15}
              width={chartWidth * 0.28}
              height={priceAreaHeight * 0.7}
              rx="8"
              fill="#f0f4ff"
              opacity="0.92"
            />
            <text
              x={padding.left + chartWidth * 0.82}
              y={padding.top + priceAreaHeight * 0.42}
              fontSize="13"
              fill="#4b5563"
              fontWeight="600"
              textAnchor="middle"
            >
              技术面预测加载中
            </text>
            <text
              x={padding.left + chartWidth * 0.82}
              y={padding.top + priceAreaHeight * 0.56}
              fontSize="11"
              fill="#9ca3af"
              textAnchor="middle"
            >
              预估任务排程中，1分钟后自动刷新...
            </text>
          </g>
        )}

        {predState === "error" && (
          <g pointerEvents="none">
            <rect
              x={padding.left + chartWidth * 0.68}
              y={padding.top + priceAreaHeight * 0.15}
              width={chartWidth * 0.28}
              height={priceAreaHeight * 0.7}
              rx="8"
              fill="#fffbeb"
              opacity="0.95"
              stroke="#fcd34d"
              strokeWidth="0.8"
            />
            <text
              x={padding.left + chartWidth * 0.82}
              y={padding.top + priceAreaHeight * 0.42}
              fontSize="13"
              fill="#b45309"
              fontWeight="600"
              textAnchor="middle"
            >
              预测服务异常
            </text>
            <text
              x={padding.left + chartWidth * 0.82}
              y={padding.top + priceAreaHeight * 0.56}
              fontSize="11"
              fill="#9ca3af"
              textAnchor="middle"
            >
              {predError}
            </text>
          </g>
        )}

        {Array.from({ length: allDataLen }).filter((_, i) => i % dateStep === 0).map((_, i) => {
          const idx = i * dateStep
          if (idx >= allDataLen) return null
          const x = toX(idx) + candleW / 2
          let dateStr: string
          if (idx < visibleData.length) {
            dateStr = visibleData[idx].date.slice(5).replace("-", "/")
          } else {
            const predIdx = idx - visibleData.length
            if (predIdx >= 0 && predIdx < forecastData.length) {
              dateStr = forecastData[predIdx].date.slice(5).replace("-", "/")
            } else {
              dateStr = ""
            }
          }
          if (!dateStr) return null
          return (
            <text key={idx} x={x} y={totalChartHeight - 6} fontSize="10" fill="#9ca3af" textAnchor="middle">
              {dateStr}
            </text>
          )
        })}

        <line x1={padding.left} y1={padding.top + priceAreaHeight + 15} x2={dimensions.width - padding.right} y2={padding.top + priceAreaHeight + 15} stroke="#e5e7eb" strokeWidth="0.6" />

        {crosshair !== null && chX !== null && chY !== null && chData && (
          <g pointerEvents="none">
            <line x1={chX} y1={padding.top} x2={chX} y2={padding.top + priceAreaHeight + 12} stroke="#9ca3af" strokeWidth="0.8" strokeDasharray="4,3" opacity="0.8" />
            <line x1={padding.left} y1={chY} x2={dimensions.width - padding.right} y2={chY} stroke="#9ca3af" strokeWidth="0.8" strokeDasharray="4,3" opacity="0.8" />
            <rect x={chX - 38} y={chY - 18} width="76" height="18" rx="3" fill="#374151" opacity="0.9" />
            <text x={chX} y={chY - 5} fontSize="10" fill="#fff" textAnchor="middle">{chData.close.toFixed(2)}</text>

            <rect x={chX - 36} y={totalChartHeight - 26} width="72" height="16" rx="3" fill="#374151" opacity="0.9" />
            <text x={chX} y={totalChartHeight - 14} fontSize="9" fill="#fff" textAnchor="middle">{chData.date.slice(5)}</text>

            <circle cx={chX} cy={chY} r="3" fill={chData.close >= chData.open ? "#ef4444" : "#22c55e"} stroke="#fff" strokeWidth="1" />
          </g>
        )}

        {(() => {
          let maxIdx = 0
          let minIdx = 0
          visibleData.forEach((d, i) => { if (d.high > visibleData[maxIdx].high) maxIdx = i })
          visibleData.forEach((d, i) => { if (d.low < visibleData[minIdx].low) minIdx = i })
          const maxD = visibleData[maxIdx]
          const minD = visibleData[minIdx]
          const maxX = toX(maxIdx) + candleW / 2
          const maxY = toY(maxD.high)
          const minX = toX(minIdx) + candleW / 2
          const minY = toY(minD.low)
          return (
            <g>
              <circle cx={maxX} cy={maxY} r="3.5" fill="#1f2937" />
              <rect x={maxX - 34} y={maxY - 20} width="68" height="16" rx="3" fill="#1f2937" opacity="0.9" />
              <text x={maxX} y={maxY - 8} fontSize="9" fill="#fff" textAnchor="middle">最高: {maxD.high.toFixed(2)}</text>

              <circle cx={minX} cy={minY} r="3.5" fill="#1f2937" />
              <rect x={minX - 34} y={minY + 4} width="68" height="16" rx="3" fill="#1f2937" opacity="0.9" />
              <text x={minX} y={minY + 16} fontSize="9" fill="#fff" textAnchor="middle">最低: {minD.low.toFixed(2)}</text>
            </g>
          )
        })()}

        <g transform={`translate(${padding.left}, 6)`}>
          {maLines.map((ma, i) => (
            <g key={ma.name} transform={`translate(${i * 70}, 0)`}>
              <line x1="0" y1="-4" x2="18" y2="-4" stroke={ma.color} strokeWidth="1.8" />
              <text x="22" y="0" fontSize="11" fill={ma.color}>{ma.name}</text>
            </g>
          ))}
        </g>
      </svg>

      {klineData.length > 0 && (
        <RangeSlider
          totalLength={klineData.length}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          onChange={handleSliderChange}
        />
      )}

      {crosshair !== null && chData && (
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>日期: {chData.date}</span>
          <span>开: {chData.open.toFixed(2)}</span>
          <span>高: {chData.high.toFixed(2)}</span>
          <span>低: {chData.low.toFixed(2)}</span>
          <span>收: {chData.close.toFixed(2)}</span>
          <span>量: {chData.volume.toLocaleString()}</span>
          <span>额: {(chData.amount / 1e8).toFixed(2)}亿</span>
          <span>振幅: {chData.amplitude.toFixed(2)}%</span>
          <span>涨跌: {chData.changePercent.toFixed(2)}%</span>
          <span>换手: {chData.turnoverRate.toFixed(2)}%</span>
        </div>
      )}
    </div>
  )
}

interface TechnicalAnalysisProps {
  symbol: string
}

export function TechnicalAnalysis({ symbol }: TechnicalAnalysisProps) {
  return (
    <section id="technical" className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-primary" />
        技术面
        <span className="text-xs font-normal text-muted-foreground ml-1">基于 Kronos 金融K线大模型</span>
      </h2>

      <Card>
        <CardContent className="p-5 space-y-4">
          <KlineChart symbol={symbol} />
        </CardContent>
      </Card>
    </section>
  )
}
