"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Search, Menu, X, TrendingUp, User, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const navLinks = [
  { name: "首页", href: "/", icon: TrendingUp },
]

export function Header() {
  const router = useRouter()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const query = searchQuery.trim()
    if (!query) return

    setIsSearching(true)
    setSearchError(null)
    setShowDropdown(true)

    try {
      const res = await fetch(`/api/cn/stocks?keyword=${encodeURIComponent(query)}`)
      if (!res.ok) throw new Error("搜索请求失败")
      const json = await res.json()
      if (json.code !== 200 || !json.data) throw new Error("搜索无结果")

      const results = json.data.股票列表 || []
      if (results.length === 0) {
        setSearchError("未找到匹配的股票")
      } else {
        const first = results[0]
        router.push(`/stock/${first.股票代码}`)
        setSearchQuery("")
        setShowDropdown(false)
      }
    } catch {
      setSearchError("未找到匹配的股票，请检查股票代码或名称")
    } finally {
      setIsSearching(false)
    }
  }, [searchQuery, router])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setSearchError(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch(e)
    }
  }

  return (
    <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-base text-foreground hidden sm:block">
              股票AI智能分析
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors"
              >
                <link.icon className="w-4 h-4" />
                {link.name}
              </Link>
            ))}
          </nav>

          <div className="hidden lg:flex items-center flex-1 max-w-sm mx-6" ref={searchRef}>
            <form onSubmit={handleSearch} className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                type="text"
                placeholder="输入股票代码或名称后按回车..."
                value={searchQuery}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => searchQuery && setShowDropdown(true)}
                className="pl-9 h-9 bg-secondary/50 text-sm"
                disabled={isSearching}
              />
              {showDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-50">
                  {isSearching ? (
                    <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>搜索中...</span>
                    </div>
                  ) : searchError ? (
                    <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                      <AlertCircle className="w-4 h-4 text-yellow-500" />
                      <span>{searchError}</span>
                    </div>
                  ) : null}
                </div>
              )}
            </form>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="hidden sm:flex text-sm">
              <User className="w-4 h-4 mr-1.5" />
              登录
            </Button>
            <Button size="sm" className="hidden sm:flex text-sm">
              注册
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-9 w-9"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-border">
            <div className="flex flex-col gap-3">
              <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="输入股票代码或名称后按回车..."
                  value={searchQuery}
                  onChange={handleInputChange}
                  className="pl-9"
                  disabled={isSearching}
                />
              </form>
              <nav className="flex flex-col gap-1 pt-2">
                {navLinks.map((link) => (
                  <Link
                    key={link.name}
                    href={link.href}
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-muted-foreground hover:bg-secondary transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <link.icon className="w-4 h-4" />
                    {link.name}
                  </Link>
                ))}
              </nav>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" className="flex-1">
                  登录
                </Button>
                <Button size="sm" className="flex-1">
                  注册
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
