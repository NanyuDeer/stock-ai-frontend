"use client"

import { useState, useEffect } from "react"
import { X, ExternalLink, Loader2 } from "lucide-react"

export interface BaseNewsItem {
  id: string
  title: string
  source: string
  time: string
  summary: string
  url: string
  aiSummary?: string
  content?: string
}

interface NewsDetail {
  标题: string
  摘要: string
  正文: string
  时间: string
  链接: string
}

export function NewsDetailModal({ item, onClose }: { item: BaseNewsItem; onClose: () => void }) {
  const [detail, setDetail] = useState<NewsDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    const fetchDetail = async () => {
      setLoading(true)
      setError(false)
      try {
        const res = await fetch(`/api/news/${item.id}`)
        if (!res.ok) throw new Error("fetch failed")
        const json = await res.json()
        if (json.code !== 200 || !json.data) throw new Error("invalid response")
        if (!cancelled) {
          setDetail(json.data)
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setError(true)
          setLoading(false)
        }
      }
    }
    fetchDetail()
    return () => { cancelled = true }
  }, [item.id])

  const displayTitle = detail?.标题 || item.title
  const displaySummary = detail?.摘要 || item.summary
  const displayTime = detail?.时间 || item.time
  const displayUrl = detail?.链接 || item.url
  const displayContent = detail?.正文 || item.content || ""

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-background rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h3 className="text-base font-semibold text-foreground">新闻详情</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-secondary transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <h2 className="text-lg font-bold text-blue-600 leading-relaxed">{displayTitle}</h2>

          {displaySummary && (
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-4 border border-blue-100 dark:border-blue-900/40">
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2">内容摘要</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{displaySummary}</p>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">加载正文...</span>
            </div>
          )}

          {error && !loading && (
            <div className="text-sm text-muted-foreground py-4 text-center">
              正文加载失败，请点击下方"查看原文"阅读完整内容
            </div>
          )}

          {!loading && !error && displayContent && (
            <div>
              <p className="text-sm font-semibold text-foreground mb-2">正文内容</p>
              <div
                className="text-sm text-muted-foreground leading-7 prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: displayContent }}
              />
            </div>
          )}
        </div>

        <div className="shrink-0 px-6 py-4 border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            发布时间：{displayTime.replace(" ", " ").slice(0, 16)}
          </span>
          <a
            href={displayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            查看原文
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  )
}
