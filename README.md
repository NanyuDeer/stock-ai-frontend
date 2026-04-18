# AI 金融预测网站

基于 Next.js 16 + React 19 + TypeScript + Tailwind CSS 构建的 A 股金融预测网站前端项目。

## 技术栈

- **框架**: Next.js 16 (Turbopack) + React 19
- **语言**: TypeScript 5.7
- **样式**: Tailwind CSS 4.2 + shadcn/ui + Radix UI
- **图表**: 自定义 SVG K 线图 + SVG 业绩预测图表
- **AI 模型**: Kronos（K 线预测）+ DeepSeek（新闻分析）
- **API 代理**: Next.js rewrites → `https://extapi.aistocklink.cn`

## 快速开始

```bash
npm install
npm run dev
# 打开 http://localhost:3000
```

## 环境变量配置

在项目根目录创建 `.env.local` 文件（已包含在 `.gitignore` 中）：

```
NEXT_PUBLIC_DEEPSEEK_API_KEY=你的DeepSeek-API-Key
```

- 此 Key 用于股票详情页"AI 智能分析"功能，前端直接调用 DeepSeek API
- 如未配置，AI 分析按钮点击后会提示"API Key 未配置"
- 获取 Key：[https://platform.deepseek.com](https://platform.deepseek.com)

## 功能模块

### 首页

| 模块 | 数据来源 | 说明 |
|------|----------|------|
| 市场概览 | `/api/cn/index/quotes` | 四大指数（上证、深证、创业板、科创50）实时行情卡片，交易时段自动刷新 |
| 市场资讯 | `/api/news/headlines` + `/api/news/cn` + `/api/news/gb` | 财联社头条/国内/环球新闻轮播卡片，支持左右切换，点击查看详情弹窗 |
| 热门股票 | `/api/cn/market/stockrank` + `/api/cn/stock/quotes/core` | 东方财富人气榜 Top20，显示排名、名称、代码、最新价、涨跌额、涨跌幅，支持添加自选 |
| 业绩预测排行 | `/api/cn/stocks/profit-forecast` | A股股票按预测净利润排名，支持排序筛选，交易时段自动刷新 |
| 我的自选 | localStorage + `/api/cn/stock/quotes/core` | 用户自选股列表，实时行情数据，支持删除操作 |

### 股票详情页 (`/stock/:code`)

| 模块 | 数据来源 | 说明 |
|------|----------|------|
| 基础数据 | `/api/cn/stock/infos` + `/api/cn/stock/quotes/activity` | 静态信息 + 实时盘口，上市日期以标签形式展示 |
| AI 智能分析 | DeepSeek API (`deepseek-chat`) | 自动触发分析（首次进入无缓存时），前端获取5条新闻 → 拼接 Prompt → 调用 DeepSeek → 渲染结果，支持 localStorage 缓存 |
| 相关新闻 | `/api/cn/stocks/:symbol/news` | 财联社个股新闻，每页3条，支持翻页，5分钟自动轮询 |
| 技术面 | `/api/cn/stock/kline` + Kronos 预测 | K 线图 + MA 线 + 十字光标 + Kronos AI 预测区间带 |
| 基本面 | `/api/cn/stock/:symbol/profit-forecast` | 机构业绩预测数据，含净利润/营业收入柱状图 + 增长率折线图 |

### 导航栏搜索功能

- 输入股票代码或名称后按回车搜索
- 自动跳转到对应股票详情页
- 未找到时显示提示信息

### 新闻详情弹窗

- 首页市场资讯和股票详情页共用 `NewsDetailModal` 组件
- 点击新闻后通过 `/api/news/:id` 实时拉取正文 HTML
- "查看原文"链接新标签页打开财联社原文
- 无摘要时自动隐藏摘要区域

## 技术面 — K 线图 + Kronos 预测

K 线图使用纯 SVG 绘制，支持以下交互：

- **周期切换**：日线 / 周线 / 月线
- **十字光标**：鼠标移动显示价格/日期辅助线及数据浮层
- **MA 均线**：MA5 / MA10 / MA20 / MA60 叠加显示
- **Kronos AI 预测区间带**：调用后端 Kronos 服务，在 K 线图上绘制未来 N 个交易日的预测价格区间（半透明色带），区间上下界 + 收盘价预测中值三条线
- **预测趋势指标**：在图表右上角显示预测趋势方向（上涨/下跌/震荡）及置信度

Kronos 后端服务（`kronos_server.py`）使用 FastAPI 部署，前端通过 Next.js rewrites 代理 `/api/kronos/*` 请求。

## 基本面 — 业绩预测图表

基本面模块从 API 获取机构业绩预测数据，包含以下图表：

### 左侧：净利润 & 营业收入柱状图 + 净利润增长率折线图

- **营业收入柱状图**（浅蓝色 `#bfdbfe`）与**净利润柱状图**（蓝色 `#60a5fa`）重叠显示
- **净利润增长率折线图**（橙色 `#f97316`）叠加在右纵轴
- 双 Y 轴：左轴金额（亿元），右轴增长率（%）
- **鼠标悬停交互**：鼠标移入某年份区域时，整列背景高亮为浅灰色，Tooltip 跟随鼠标移动显示净利润、营业收入、净利润增长率

### 右侧：增长率折线图

- 三条折线：营业收入增长率（绿）、净资产收益率（红）、市盈率（灰）
- **鼠标悬停交互**：与左侧图表一致，整列高亮 + Tooltip 跟随

### 其他功能

- **顶部摘要**：显示机构预测摘要信息
- **自动刷新**：交易时段每60秒自动刷新数据，非交易时段停止
- **手动刷新**：提供刷新按钮
- **风险提示**：底部显示风险提示文案

## 自选股功能

- **添加自选**：在热门股票列表点击"自选"按钮添加
- **删除自选**：在我的自选卡片悬停显示删除按钮，点击删除
- **数据存储**：使用 localStorage 存储，刷新页面不丢失
- **实时行情**：调用 API 获取自选股实时价格和涨跌幅

## AI 智能分析自动触发

- 首次进入股票详情页时，如果 localStorage 中没有该股票的分析缓存，自动触发一次 AI 分析
- 如有缓存，直接显示缓存结果
- 用户可随时点击"重新生成"按钮更新分析

## API 代理配置

在 `next.config.mjs` 中配置了 rewrites，将所有 `/api` 请求代理到 `https://extapi.aistocklink.cn`：

```js
async rewrites() {
  return [
    { source: '/api/kronos/:path*', destination: 'http://localhost:8000/:path*' },
    { source: '/api/:path*', destination: 'https://extapi.aistocklink.cn/api/:path*' },
    { source: '/deepseek/:path*', destination: 'https://api.deepseek.com/:path*' },
  ]
}
```

## 项目结构

```
├── app/
│   ├── globals.css           # 全局样式（Tailwind + CSS 变量）
│   ├── layout.tsx            # 根布局
│   ├── page.tsx              # 首页
│   └── stock/[code]/page.tsx # 股票详情页
├── components/
│   ├── earnings-forecast.tsx # 首页业绩预测排行
│   ├── footer.tsx            # 页脚
│   ├── header.tsx            # 导航栏（含搜索功能）
│   ├── index-cards.tsx       # 市场指数卡片
│   ├── market-overview.tsx   # 首页热门股票（含加自选功能）
│   ├── news-carousel.tsx     # 首页市场资讯轮播
│   ├── news-detail-modal.tsx # 新闻详情弹窗（共享）
│   ├── theme-provider.tsx    # 主题提供者
│   ├── watchlist.tsx         # 我的自选（真实数据）
│   ├── stock/
│   │   ├── stock-header.tsx         # 股票基础数据
│   │   ├── news-analysis.tsx        # 资讯面（AI分析+新闻列表）
│   │   ├── technical-analysis.tsx   # 技术面（K线图+Kronos预测）
│   │   ├── fundamental-analysis.tsx # 基本面（业绩预测图表）
│   │   └── kronos-prediction.tsx    # Kronos预测组件
│   └── ui/                   # shadcn/ui 组件库
├── lib/
│   ├── stock-data.ts         # 股票 Mock 数据（备用）
│   ├── watchlist.ts          # 自选股管理工具
│   └── utils.ts              # 工具函数
├── public/                   # 静态资源（图标等）
├── .env.local                # 环境变量（不入Git）
├── next.config.mjs           # Next.js 配置（含API代理）
└── .gitignore                # 已包含 .env*.local
```

## AI 智能分析工作流程

1. 用户进入股票详情页，尝试从 `localStorage` 读取缓存（key: `analysis_${symbol}`）
2. 如有缓存，直接展示并标注"上次分析时间"
3. 如无缓存，自动触发 AI 分析
4. 前端请求 `/api/cn/stocks/${symbol}/news?limit=5` 获取5条新闻
5. 拼接 Prompt，调用 `https://api.deepseek.com/v1/chat/completions`
6. 解析返回的 JSON（sentiment/conclusion/logic/risk）
7. 结果存入 `localStorage` 并渲染卡片

## 免费部署方案

### 推荐方案：Vercel（最简单）

1. 将代码推送到 GitHub
2. 登录 [Vercel](https://vercel.com)，导入 GitHub 仓库
3. 配置环境变量 `NEXT_PUBLIC_DEEPSEEK_API_KEY`
4. 点击部署，几分钟后即可获得免费域名

**注意**：Vercel 免费版有以下限制：
- 每月 100GB 带宽
- 每次请求最大 10 秒超时
- Serverless 函数有冷启动

### 其他免费方案

| 平台 | 优点 | 缺点 |
|------|------|------|
| **Vercel** | 最简单，Next.js 官方推荐 | 免费版有限制 |
| **Netlify** | 同样简单，支持 Next.js | 部分功能需付费 |
| **Railway** | 支持后端服务，可部署 Kronos | 免费额度有限 |
| **Cloudflare Pages** | 全球 CDN，速度快 | 配置稍复杂 |

## 注意事项

- 本项目为纯前端，所有 API 请求通过 Next.js rewrites 代理或直接调用第三方 API
- DeepSeek API Key 存储在 `.env.local` 中，不会提交到 Git
- 新闻列表每5分钟自动轮询刷新，失败时保持上次数据并显示轻提示
- K 线图使用 SVG 绘制，支持日线/周线/月线切换和十字光标交互
- Kronos 预测需要后端 `kronos_server.py` 运行在 `localhost:8000`
- 自选股数据存储在浏览器 localStorage 中，清除浏览器数据会丢失
