export interface Stock {
  id: string
  name: string
  code: string
  price: string
  change: string
  changePercent: string
  volume: string
  trend: "up" | "down" | "flat"
  currentEps: string
  forecastEps: string
  growthRate: string
  consensus: "强烈买入" | "买入" | "持有" | "观望" | "卖出"
}

const mockStocksDB: Stock[] = [
  {
    id: "stock-001",
    name: "贵州茅台",
    code: "600519",
    price: "1,856.00",
    change: "+42.50",
    changePercent: "+2.35%",
    volume: "1.2万手",
    trend: "up",
    currentEps: "58.32",
    forecastEps: "68.50",
    growthRate: "+17.45%",
    consensus: "买入",
  },
  {
    id: "stock-002",
    name: "宁德时代",
    code: "300750",
    price: "198.56",
    change: "+6.02",
    changePercent: "+3.12%",
    volume: "5.8万手",
    trend: "up",
    currentEps: "12.85",
    forecastEps: "16.20",
    growthRate: "+26.07%",
    consensus: "强烈买入",
  },
  {
    id: "stock-003",
    name: "比亚迪",
    code: "002594",
    price: "256.78",
    change: "-3.20",
    changePercent: "-1.23%",
    volume: "3.2万手",
    trend: "down",
    currentEps: "8.56",
    forecastEps: "11.30",
    growthRate: "+32.01%",
    consensus: "买入",
  },
  {
    id: "stock-004",
    name: "招商银行",
    code: "600036",
    price: "32.45",
    change: "+0.50",
    changePercent: "+1.56%",
    volume: "4.1万手",
    trend: "up",
    currentEps: "5.28",
    forecastEps: "5.85",
    growthRate: "+10.80%",
    consensus: "持有",
  },
  {
    id: "stock-005",
    name: "中国平安",
    code: "601318",
    price: "45.67",
    change: "+0.40",
    changePercent: "+0.89%",
    volume: "8.5万手",
    trend: "up",
    currentEps: "6.12",
    forecastEps: "5.80",
    growthRate: "-5.23%",
    consensus: "持有",
  },
  {
    id: "stock-006",
    name: "腾讯控股",
    code: "00700",
    price: "378.40",
    change: "-1.72",
    changePercent: "-0.45%",
    volume: "2.3万手",
    trend: "down",
    currentEps: "15.20",
    forecastEps: "16.80",
    growthRate: "+10.53%",
    consensus: "买入",
  },
  {
    id: "stock-007",
    name: "五粮液",
    code: "000858",
    price: "168.90",
    change: "+2.80",
    changePercent: "+1.68%",
    volume: "1.8万手",
    trend: "up",
    currentEps: "7.65",
    forecastEps: "8.40",
    growthRate: "+9.80%",
    consensus: "买入",
  },
  {
    id: "stock-008",
    name: "隆基绿能",
    code: "601012",
    price: "28.35",
    change: "-0.65",
    changePercent: "-2.24%",
    volume: "6.7万手",
    trend: "down",
    currentEps: "1.85",
    forecastEps: "1.52",
    growthRate: "-17.84%",
    consensus: "观望",
  },
]

const watchlistCodes: Set<string> = new Set(["600519", "300750", "00700", "600036"])

const hotStockCodes: string[] = ["600519", "300750", "002594", "601318", "600036", "00700", "000858", "601012"]

const forecastStockCodes: string[] = ["600519", "300750", "002594", "600036", "601318", "601012"]

export function getAllStocks(): Stock[] {
  return [...mockStocksDB]
}

export function getHotStocks(): Stock[] {
  return mockStocksDB.filter((stock) => hotStockCodes.includes(stock.code))
}

export function getWatchlistStocks(): Stock[] {
  return mockStocksDB.filter((stock) => watchlistCodes.has(stock.code))
}

export function getForecastStocks(): Stock[] {
  return mockStocksDB.filter((stock) => forecastStockCodes.includes(stock.code))
}

export function getStockByCode(code: string): Stock | undefined {
  return mockStocksDB.find((stock) => stock.code === code)
}

export function isInWatchlist(code: string): boolean {
  return watchlistCodes.has(code)
}

export function addToWatchlist(code: string): void {
  watchlistCodes.add(code)
}

export function removeFromWatchlist(code: string): void {
  watchlistCodes.delete(code)
}
