const WATCHLIST_KEY = "stock_watchlist"

export interface WatchlistItem {
  code: string
  name: string
  price: string
  changePercent: string
  trend: "up" | "down" | "flat"
}

export function getWatchlistCodes(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function addToWatchlist(code: string): void {
  if (typeof window === "undefined") return
  try {
    const codes = getWatchlistCodes()
    if (!codes.includes(code)) {
      codes.push(code)
      localStorage.setItem(WATCHLIST_KEY, JSON.stringify(codes))
      window.dispatchEvent(new CustomEvent("watchlist-changed"))
    }
  } catch {}
}

export function removeFromWatchlist(code: string): void {
  if (typeof window === "undefined") return
  try {
    const codes = getWatchlistCodes().filter((c) => c !== code)
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(codes))
    window.dispatchEvent(new CustomEvent("watchlist-changed"))
  } catch {}
}

export function isInWatchlist(code: string): boolean {
  return getWatchlistCodes().includes(code)
}
