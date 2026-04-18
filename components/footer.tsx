"use client"

import { useState, useEffect } from "react"
import { TrendingUp } from "lucide-react"
import Link from "next/link"

export function Footer() {
  const [currentYear, setCurrentYear] = useState<number | null>(null)

  useEffect(() => {
    setCurrentYear(new Date().getFullYear())
  }, [])

  return (
    <footer className="bg-foreground text-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Brand & Copyright */}
        <div className="py-6 flex flex-col items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm">股票AI智能分析</span>
          </Link>

          <p className="text-xs text-background/50 text-center leading-relaxed max-w-2xl">
            风险提示：股票投资有风险，入市需谨慎。本平台提供的所有分析和预测仅供参考，不构成投资建议。
            投资者应根据自身情况，独立判断并承担投资风险。历史业绩不代表未来表现。
          </p>

          <p className="text-[11px] text-background/40">
            © {currentYear ?? "2025"} 股票AI智能分析. 保留所有权利.
          </p>
        </div>
      </div>
    </footer>
  )
}
