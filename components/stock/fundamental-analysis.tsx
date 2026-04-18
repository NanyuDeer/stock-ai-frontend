"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { FileText, RefreshCw, Loader2, AlertTriangle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface ForecastRow {
  预测指标: string
  [key: string]: string
}

interface ApiData {
  股票代码?: string
  来源?: string
  更新时间?: string
  摘要?: string
  业绩预测详表_详细指标预测?: ForecastRow[]
}

interface ApiResponse {
  code: number
  message?: string
  data?: ApiData
}

interface ParsedData {
  summary: string
  updateTime: string
  profitItems: { year: number; value: number }[]
  revenueItems: { year: number; value: number }[]
  profitGrowthItems: { year: number; value: number | null }[]
  revGrowthItems: { year: number; value: number | null }[]
  roeItems: { year: number; value: number | null }[]
  peItems: { year: number; value: number | null }[]
}

type LoadingState = "idle" | "loading" | "success" | "error"

function isTradingHours(): boolean {
  const now = new Date()
  const day = now.getDay()
  if (day === 0 || day === 6) return false
  const h = now.getHours()
  const m = now.getMinutes()
  const t = h * 60 + m
  return (t >= 570 && t <= 690) || (t >= 780 && t <= 900)
}

function formatLocalTime(): string {
  const now = new Date()
  const y = now.getFullYear()
  const mo = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  const hh = String(now.getHours()).padStart(2, "0")
  const mm = String(now.getMinutes()).padStart(2, "0")
  return `${y}-${mo}-${d} ${hh}:${mm}`
}

function parseNumberValue(raw: string | undefined | null): number | null {
  if (!raw) return null
  const cleaned = raw.replace(/[,%亿元]/g, "").trim()
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

function parseBillionValue(raw: string | undefined | null): number | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (trimmed.includes("亿")) {
    const cleaned = trimmed.replace("亿", "").trim()
    const num = parseFloat(cleaned)
    return isNaN(num) ? null : num
  }
  if (trimmed.includes("万")) {
    const cleaned = trimmed.replace("万", "").trim()
    const num = parseFloat(cleaned)
    return isNaN(num) ? null : num / 10000
  }
  const num = parseFloat(trimmed)
  return isNaN(num) ? null : num
}

function extractYearFromKey(key: string): number | null {
  const m = key.match(/(\d{4})/)
  return m ? parseInt(m[1]) : null
}

function parseApiData(api: ApiData): ParsedData | null {
  const table = api.业绩预测详表_详细指标预测
  if (!table || table.length === 0) return null

  const findRow = (keyword: string) => table.find((r) => r.预测指标.includes(keyword))
  const profitRow = findRow("净利润(元)")
  const revenueRow = findRow("营业收入(元)")
  const profitGrowthRow = findRow("净利润增长率")
  const revGrowthRow = findRow("营业收入增长率")
  const roeRow = findRow("净资产收益率")
  const peRow = findRow("市盈率")

  if (!profitRow) return null

  const yearKeys = Object.keys(profitRow).filter((k) => k !== "预测指标")
  const yearsSet = new Set<number>()
  yearKeys.forEach((k) => {
    const yr = extractYearFromKey(k)
    if (yr) yearsSet.add(yr)
  })
  const years = Array.from(yearsSet).sort((a, b) => a - b)

  const getValuesForRow = (row: ForecastRow | undefined, parser: (v: string | null | undefined) => number | null) => {
    return years.map((yr) => {
      const actualKey = Object.keys(row || {}).find((k) => k.includes(String(yr)) && k.includes("实际值"))
      const forecastKey = Object.keys(row || {}).find((k) => k.includes(String(yr)) && k.includes("平均"))
      const key = actualKey || forecastKey
      if (!key || !row) return { year: yr, value: null as number | null }
      return { year: yr, value: parser(row[key]) }
    })
  }

  const profitItems = getValuesForRow(profitRow, parseBillionValue).map((d) => ({
    year: d.year,
    value: d.value ?? 0,
  }))
  const revenueItems = getValuesForRow(revenueRow, parseBillionValue).map((d) => ({
    year: d.year,
    value: d.value ?? 0,
  }))
  const profitGrowthItems = getValuesForRow(profitGrowthRow, parseNumberValue)
  const revGrowthItems = getValuesForRow(revGrowthRow, parseNumberValue)
  const roeItems = getValuesForRow(roeRow, parseNumberValue)
  const peItems = getValuesForRow(peRow, parseNumberValue)

  return {
    summary: api.摘要 || "",
    updateTime: api.更新时间 || "",
    profitItems,
    revenueItems,
    profitGrowthItems,
    revGrowthItems,
    roeItems,
    peItems,
  }
}

interface ProfitChartProps {
  data: ParsedData
}

function ProfitChart({ data }: ProfitChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 380, h: 300 })
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (!containerRef.current) return
    function update() {
      setDims({ w: containerRef.current!.clientWidth || 380, h: 300 })
    }
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  const { profitItems, revenueItems, profitGrowthItems } = data

  if (profitItems.length === 0) {
    return (
      <div ref={containerRef} className="flex items-center justify-center" style={{ height: 300 }}>
        <span className="text-sm text-muted-foreground">暂无图表数据</span>
      </div>
    )
  }

  const years = profitItems.map((d) => d.year)
  const profits = profitItems.map((d) => d.value)
  const revenues = revenueItems.map((d) => d.value)
  const growthRates = profitGrowthItems.map((d) => d.value)

  const allBarVals = [...profits, ...revenues]
  const minVal = Math.min(...allBarVals.filter((v) => v >= 0))
  const maxVal = Math.max(...allBarVals)
  const valRange = maxVal - minVal || 1
  const valPad = valRange * 0.12
  const adjMinV = Math.max(0, minVal - valPad)
  const adjMaxV = maxVal + valPad
  const adjRangeV = adjMaxV - adjMinV || 1

  const validGrowth = growthRates.filter((v): v is number => v !== null)
  let minG = validGrowth.length > 0 ? Math.min(...validGrowth) : 0
  let maxG = validGrowth.length > 0 ? Math.max(...validGrowth) : 100
  if (minG > 0) minG = 0
  if (maxG < 0) maxG = 0
  const gRange = maxG - minG || 1
  const gPad = gRange * 0.12
  const adjMinG = minG - gPad
  const adjMaxG = maxG + gPad
  const adjRangeG = adjMaxG - adjMinG || 1

  const pad = { top: 24, right: 20, bottom: 36, left: 55 }
  const chartW = dims.w - pad.left - pad.right
  const chartH = dims.h - pad.top - pad.bottom
  const axisY = pad.top + chartH

  const barW = Math.max(16, Math.min(40, chartW / years.length * 0.5))
  const colW = chartW / years.length
  const barOffset = (colW - barW) / 2

  const toYVal = (v: number) => axisY - ((v - adjMinV) / adjRangeV) * chartH
  const toYGrowth = (v: number) => pad.top + ((adjMaxG - v) / adjRangeG) * chartH
  const toColCenter = (i: number) => pad.left + i * colW + colW / 2
  const toColLeft = (i: number) => pad.left + i * colW

  const yTicksP = 5
  const stepP = adjRangeV / (yTicksP - 1)
  const yTicksG = 5
  const stepG = adjRangeG / (yTicksG - 1)

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const mx = ((e.clientX - rect.left) / rect.width) * dims.w
    const my = ((e.clientY - rect.top) / rect.height) * dims.h

    let foundIdx: number | null = null
    for (let i = 0; i < years.length; i++) {
      const cx = toColLeft(i)
      if (mx >= cx && mx <= cx + colW) {
        foundIdx = i
        break
      }
    }

    setHoverIdx(foundIdx)
    if (foundIdx !== null) {
      setTooltipPos({ x: mx, y: my })
    }
  }

  function handleMouseLeave() {
    setHoverIdx(null)
  }

  return (
    <div ref={containerRef} className="relative">
      <svg viewBox={`0 0 ${dims.w} ${dims.h}`} className="w-full cursor-crosshair" style={{ minHeight: dims.h }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <line x1={pad.left} y1={axisY} x2={dims.w - pad.right} y2={axisY} stroke="#9ca3af" strokeWidth="1" />

        {Array.from({ length: yTicksP }).map((_, i) => {
          const v = adjMaxV - stepP * i
          const y = toYVal(v)
          return (
            <g key={`py-${i}`}>
              <line x1={pad.left} y1={y} x2={dims.w - pad.right} y2={y} stroke="#f3f4f6" strokeWidth="0.5" />
              <text x={pad.left - 8} y={y + 3} fontSize="9" fill="#9ca3af" textAnchor="end">{v.toFixed(0)}</text>
            </g>
          )
        })}

        {Array.from({ length: yTicksG }).map((_, i) => {
          const v = adjMaxG - stepG * i
          const y = toYGrowth(v)
          return (
            <g key={`gy-${i}`}>
              <text x={dims.w - pad.right + 4} y={y + 3} fontSize="9" fill="#9ca3af" textAnchor="start">{v.toFixed(1)}</text>
            </g>
          )
        })}

        <text x={pad.left - 8} y={14} fontSize="10" fill="#60a5fa" textAnchor="end">金额(亿)</text>
        <text x={dims.w - pad.right + 4} y={14} fontSize="10" fill="#9ca3af" textAnchor="end">增长率(%)</text>

        {hoverIdx !== null && (
          <rect
            x={toColLeft(hoverIdx)} y={pad.top}
            width={colW} height={chartH}
            fill="#f3f4f6" opacity="0.7"
          />
        )}

        {years.map((_, i) => {
          const cl = toColLeft(i)
          const rv = revenues[i]
          const pv = profits[i]
          const yRev = toYVal(Math.max(rv, 0))
          const yProf = toYVal(Math.max(pv, 0))
          const hRev = Math.max(2, axisY - yRev)
          const hProf = Math.max(2, axisY - yProf)
          return (
            <g key={`bars-${i}`}>
              <rect x={cl + barOffset} y={yRev} width={barW} height={hRev} fill="#bfdbfe" rx="1.5" opacity="0.85" />
              <rect x={cl + barOffset} y={yProf} width={barW} height={hProf} fill="#60a5fa" rx="1.5" opacity="0.85" />
            </g>
          )
        })}

        {(() => {
          const points: string[] = []
          growthRates.forEach((v, i) => {
            if (v !== null) points.push(`${toColCenter(i)},${toYGrowth(v)}`)
          })
          if (points.length < 2) return null
          return <polyline points={points.join(" ")} fill="none" stroke="#f97316" strokeWidth="1.8" />
        })()}

        {growthRates.map((v, i) => {
          if (v === null) return null
          const cx = toColCenter(i)
          const cy = toYGrowth(v)
          return <circle key={`gp-${i}`} cx={cx} cy={cy} r="3" fill="#fff" stroke="#f97316" strokeWidth="1.5" />
        })}

        {years.map((yr, i) => (
          <text key={i} x={toColCenter(i)} y={axisY + 18} fontSize="10" fill="#9ca3af" textAnchor="middle">{yr}</text>
        ))}
      </svg>

      {hoverIdx !== null && (
        <div
          className="absolute pointer-events-none z-10 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-xs space-y-1.5 min-w-[160px]"
          style={{
            left: tooltipPos.x + 12,
            top: tooltipPos.y - 10,
            transform: tooltipPos.x > dims.w * 0.65 ? "translateX(-100%)" : undefined,
          }}
        >
          <p className="font-semibold text-foreground text-sm mb-1">{years[hoverIdx]}</p>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block shrink-0"></span>
            <span className="text-muted-foreground">净利润：</span>
            <span className="font-medium text-foreground">{profits[hoverIdx].toFixed(2)}亿</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-200 inline-block shrink-0"></span>
            <span className="text-muted-foreground">营业收入：</span>
            <span className="font-medium text-foreground">{revenues[hoverIdx].toFixed(2)}亿</span>
          </div>
          {growthRates[hoverIdx] !== null && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block shrink-0"></span>
              <span className="text-muted-foreground">净利润增长率：</span>
              <span className="font-medium text-foreground">{growthRates[hoverIdx]!.toFixed(2)}%</span>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-center gap-4 mt-2">
        <span className="inline-flex items-center gap-1 text-xs"><span className="w-3 h-3 rounded-sm bg-blue-400/80 inline-block"></span>净利润</span>
        <span className="inline-flex items-center gap-1 text-xs"><span className="w-3 h-3 rounded-sm bg-sky-200/80 inline-block"></span>营业收入</span>
        <span className="inline-flex items-center gap-1 text-xs"><span className="w-3 h-[2px] bg-orange-400 inline-block"></span>净利润增长率</span>
      </div>
    </div>
  )
}

interface GrowthRateChartProps {
  data: ParsedData
}

function GrowthRateChart({ data }: GrowthRateChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 380, h: 300 })
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (!containerRef.current) return
    function update() {
      setDims({ w: containerRef.current!.clientWidth || 380, h: 300 })
    }
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  const { revGrowthItems, roeItems, peItems } = data
  const years = revGrowthItems.map((d) => d.year)

  if (years.length === 0) {
    return (
      <div ref={containerRef} className="flex items-center justify-center" style={{ height: 300 }}>
        <span className="text-sm text-muted-foreground">暂无图表数据</span>
      </div>
    )
  }

  const revGrowth = revGrowthItems.map((d) => d.value)
  const roe = roeItems.map((d) => d.value)
  const pe = peItems.map((d) => d.value)

  const allVals = [...revGrowth, ...roe, ...pe].filter((v): v is number => v !== null)
  let minV = allVals.length > 0 ? Math.min(...allVals) : 0
  let maxV = allVals.length > 0 ? Math.max(...allVals) : 100
  if (minV > 0) minV = 0
  if (maxV < 0) maxV = 0
  const range = maxV - minV || 1
  const padV = range * 0.15
  const adjMin = minV - padV
  const adjMax = maxV + padV
  const adjRange = adjMax - adjMin || 1

  const chartPad = { top: 24, right: 20, bottom: 36, left: 45 }
  const chartW = dims.w - chartPad.left - chartPad.right
  const chartH = dims.h - chartPad.top - chartPad.bottom
  const axisY = chartPad.top + chartH
  const colW = chartW / years.length
  const pointGap = colW

  const toY = (v: number) => chartPad.top + ((adjMax - v) / adjRange) * chartH
  const toX = (i: number) => chartPad.left + i * colW + colW / 2

  const yTickCount = 5
  const step = adjRange / (yTickCount - 1)

  const seriesConfig = [
    { key: "rev", data: revGrowth, color: "#22c55e", label: "营业收入增长率" },
    { key: "roe", data: roe, color: "#ef4444", label: "净资产收益率" },
    { key: "pe", data: pe, color: "#9ca3af", label: "市盈率" },
  ]

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const mx = ((e.clientX - rect.left) / rect.width) * dims.w
    const my = ((e.clientY - rect.top) / rect.height) * dims.h

    let foundIdx: number | null = null
    for (let i = 0; i < years.length; i++) {
      const cx = chartPad.left + i * colW
      if (mx >= cx && mx <= cx + colW) {
        foundIdx = i
        break
      }
    }

    setHoverIdx(foundIdx)
    if (foundIdx !== null) {
      setTooltipPos({ x: mx, y: my })
    }
  }

  function handleMouseLeave() {
    setHoverIdx(null)
  }

  return (
    <div ref={containerRef} className="relative">
      <svg viewBox={`0 0 ${dims.w} ${dims.h}`} className="w-full cursor-crosshair" style={{ minHeight: dims.h }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <line x1={chartPad.left} y1={axisY} x2={dims.w - chartPad.right} y2={axisY} stroke="#9ca3af" strokeWidth="1" />

        {Array.from({ length: yTickCount }).map((_, i) => {
          const v = adjMax - step * i
          const y = toY(v)
          return (
            <g key={`gy-${i}`}>
              <line x1={chartPad.left} y1={y} x2={dims.w - chartPad.right} y2={y} stroke="#f3f4f6" strokeWidth="0.5" />
              <text x={chartPad.left - 6} y={y + 3} fontSize="9" fill="#9ca3af" textAnchor="end">{v.toFixed(0)}</text>
            </g>
          )
        })}
        <text x={chartPad.left} y={14} fontSize="10" fill="#9ca3af" textAnchor="start">增长率(%)</text>

        {hoverIdx !== null && (() => {
          const hx = chartPad.left + hoverIdx * colW
          return (
            <rect
              x={hx} y={chartPad.top}
              width={colW} height={chartH}
              fill="#f3f4f6" opacity="0.7" rx="2"
            />
          )
        })()}

        {seriesConfig.map((series) => {
          const pts: string[] = []
          series.data.forEach((v, i) => { if (v !== null) pts.push(`${toX(i)},${toY(v)}`) })
          if (pts.length < 2) return null
          return <polyline key={series.key} points={pts.join(" ")} fill="none" stroke={series.color} strokeWidth="1.8" />
        })}

        {seriesConfig.map((series) =>
          series.data.map((v, i) => {
            if (v === null) return null
            return <circle key={`${series.key}-p-${i}`} cx={toX(i)} cy={toY(v)} r="2.8" fill="#fff" stroke={series.color} strokeWidth="1.5" />
          })
        )}

        {years.map((yr, i) => (
          <text key={i} x={toX(i)} y={axisY + 18} fontSize="10" fill="#9ca3af" textAnchor="middle">{yr}</text>
        ))}
      </svg>

      {hoverIdx !== null && (
        <div
          className="absolute pointer-events-none z-10 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-xs space-y-1.5 min-w-[180px]"
          style={{
            left: tooltipPos.x + 12,
            top: tooltipPos.y - 10,
            transform: tooltipPos.x > dims.w * 0.65 ? "translateX(-100%)" : undefined,
          }}
        >
          <p className="font-semibold text-foreground text-sm mb-1">{years[hoverIdx]}</p>
          {revGrowth[hoverIdx] !== null && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block shrink-0"></span>
              <span className="text-muted-foreground">营业收入增长率：</span>
              <span className="font-medium text-foreground">{revGrowth[hoverIdx]!.toFixed(2)}%</span>
            </div>
          )}
          {roe[hoverIdx] !== null && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block shrink-0"></span>
              <span className="text-muted-foreground">净资产收益率：</span>
              <span className="font-medium text-foreground">{roe[hoverIdx]!.toFixed(2)}</span>
            </div>
          )}
          {pe[hoverIdx] !== null && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-400 inline-block shrink-0"></span>
              <span className="text-muted-foreground">市盈率：</span>
              <span className="font-medium text-foreground">{pe[hoverIdx]!.toFixed(1)}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-center gap-4 mt-2 flex-wrap">
        {seriesConfig.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1 text-xs">
            <span className="w-3 h-[2px] inline-block" style={{ backgroundColor: s.color }}></span>
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}

interface FundamentalAnalysisProps {
  symbol: string
}

export function FundamentalAnalysis({ symbol }: FundamentalAnalysisProps) {
  const [loadingState, setLoadingState] = useState<LoadingState>("idle")
  const [parsedData, setParsedData] = useState<ParsedData | null>(null)
  const [errorMsg, setErrorMsg] = useState("")
  const [updateTime, setUpdateTime] = useState("")

  const mountedRef = useRef(true)
  const symbolRef = useRef(symbol)

  useEffect(() => { symbolRef.current = symbol }, [symbol])
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const fetchEarnings = useCallback(async () => {
    try {
      setLoadingState("loading")
      setErrorMsg("")
      const url = `/api/cn/stock/${symbolRef.current}/profit-forecast`
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)
      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(timeoutId)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: ApiResponse = await res.json()
      if (!mountedRef.current) return
      if (json.code !== 200 || !json.data) {
        setParsedData(null)
        setLoadingState("success")
        setUpdateTime(formatLocalTime())
        return
      }
      const parsed = parseApiData(json.data)
      setParsedData(parsed)
      setLoadingState("success")
      setUpdateTime(parsed?.updateTime || formatLocalTime())
    } catch (err: unknown) {
      if (!mountedRef.current) return
      setLoadingState("error")
      if (err instanceof Error) {
        if (err.name === "AbortError") {
          setErrorMsg("请求超时，请稍后重试")
        } else {
          setErrorMsg(err.message.includes("fetch") || err.message.includes("network") ? "接口请求失败，请检查网络连接" : err.message)
        }
      } else {
        setErrorMsg("未知错误")
      }
    }
  }, [])

  useEffect(() => { fetchEarnings() }, [fetchEarnings])

  useEffect(() => {
    const interval = setInterval(() => {
      if (isTradingHours()) fetchEarnings()
    }, 60000)
    return () => clearInterval(interval)
  }, [fetchEarnings])

  const isLoading = loadingState === "loading"
  const hasData = parsedData !== null && parsedData.summary !== ""

  return (
    <section id="fundamental" className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <FileText className="w-5 h-5 text-primary" />
        基本面
        <span className="text-xs font-normal text-muted-foreground ml-1">业绩预测</span>
      </h2>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="border-b-2 border-primary pb-1 px-1 text-sm font-medium text-primary">
              业绩预测
            </div>
            <button
              onClick={fetchEarnings}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 h-7 rounded-md border border-border bg-background hover:bg-accent text-xs transition-colors disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              刷新预测
            </button>
          </div>

          {hasData && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4 text-sm leading-relaxed text-foreground dark:border-blue-800 dark:bg-blue-900/15">
              {parsedData!.summary}
            </div>
          )}

          {!hasData && loadingState === "success" && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-muted-foreground">
              本年度暂无机构做出业绩预测。
            </div>
          )}

          {loadingState === "error" && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-2 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>数据加载失败：{errorMsg}</span>
            </div>
          )}

          {isLoading && !parsedData && (
            <div className="flex items-center justify-center py-12 gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              正在加载业绩预测数据...
            </div>
          )}

          {parsedData && parsedData.profitItems.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
              <ProfitChart data={parsedData} />
              <GrowthRateChart data={parsedData} />
            </div>
          )}

          {updateTime && (
            <div className="text-right">
              <span className="text-[11px] text-muted-foreground">最后更新：{updateTime}</span>
            </div>
          )}

          <div className="flex items-start gap-1.5 pt-2 border-t border-border/50">
            <AlertTriangle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <span className="text-xs text-muted-foreground leading-relaxed">
              业绩预测数据基于机构预测，可能存在偏差，仅供学习参考，不构成任何投资建议。
            </span>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
