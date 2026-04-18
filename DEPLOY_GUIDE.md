# 免费部署指南（国内可用）

本指南提供两种免费部署方案，支持 Kronos 预测功能。

---

## 方案一：Zeabur（推荐）

Zeabur 是国内团队开发的部署平台，国内访问友好，支持 Docker 部署。

### 优点
- 国内访问速度快
- 支持前端 + 后端部署
- 免费额度足够临时使用
- 支持 Docker

### 步骤

#### 1. 准备 GitHub 仓库

将两个项目分别推送到 GitHub：

**Kronos 后端：**
```bash
cd C:\Users\13923\Kronos
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/你的用户名/kronos-backend.git
git push -u origin main
```

**前端项目：**
```bash
cd "C:\Users\13923\Desktop\AI金融预测网站复刻"
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/你的用户名/stock-ai-frontend.git
git push -u origin main
```

#### 2. 注册 Zeabur

1. 访问 [zeabur.com](https://zeabur.com)
2. 使用 GitHub 账号登录

#### 3. 部署 Kronos 后端

1. 在 Zeabur 创建新项目
2. 添加服务 → 选择 "Git Service"
3. 选择 `kronos-backend` 仓库
4. Zeabur 会自动检测 Dockerfile 并构建
5. 等待构建完成（首次可能需要 5-10 分钟）
6. 记录分配的域名，如 `https://kronos-xxx.zeabur.app`

#### 4. 部署前端

1. 在同一项目中添加新服务
2. 选择 `stock-ai-frontend` 仓库
3. 添加环境变量：
   - `NEXT_PUBLIC_DEEPSEEK_API_KEY` = 你的 DeepSeek API Key
4. 修改 `next.config.mjs` 中的 Kronos 代理地址：

```js
{
  source: '/kronos/:path*',
  destination: 'https://你的kronos服务域名.zeabur.app/:path*',
}
```

5. 重新部署前端

#### 5. 配置域名（可选）

Zeabur 提供免费域名，也可以绑定自定义域名。

---

## 方案二：Railway + Vercel

### Railway 部署 Kronos 后端

1. 访问 [railway.app](https://railway.app)
2. 使用 GitHub 登录
3. 新建项目 → Deploy from GitHub repo
4. 选择 `kronos-backend` 仓库
5. Railway 会自动检测 Dockerfile
6. 等待构建完成
7. 在 Settings → Networking 中生成域名

**注意**：Railway 免费版每月 $5 额度，需要绑定信用卡。

### Vercel 部署前端

1. 访问 [vercel.com](https://vercel.com)
2. 导入 `stock-ai-frontend` 仓库
3. 配置环境变量 `NEXT_PUBLIC_DEEPSEEK_API_KEY`
4. 修改 `next.config.mjs` 中的 Kronos 地址为 Railway 域名
5. 部署

**注意**：Vercel 在国内访问可能较慢。

---

## 方案三：Hugging Face Spaces（完全免费）

Hugging Face Spaces 提供免费的 Docker 容器，适合部署 Kronos 后端。

### 步骤

1. 访问 [huggingface.co](https://huggingface.co)
2. 创建账号
3. 新建 Space → 选择 Docker
4. 上传 Kronos 项目文件
5. 等待构建完成
6. 获得 `https://你的用户名-kronos.hf.space` 域名

### 前端部署

使用 Vercel 或 Zeabur 部署前端，修改 Kronos 代理地址为 HF Space 域名。

---

## 推荐配置

| 方案 | 前端 | 后端 | 国内访问 | 免费额度 |
|------|------|------|----------|----------|
| **Zeabur** | ✅ | ✅ | 快 | 每月 $5 |
| **Railway + Vercel** | Vercel | Railway | 较慢 | 每月 $5 |
| **HF Spaces + Vercel** | Vercel | HF | 较慢 | 无限制 |

---

## 部署前检查清单

- [ ] GitHub 仓库已创建
- [ ] `.env.local` 已添加到 `.gitignore`（不要提交 API Key）
- [ ] `next.config.mjs` 中的 Kronos 代理地址已修改
- [ ] DeepSeek API Key 已准备好

---

## 常见问题

### Q: Kronos 服务启动慢？
A: 首次启动需要下载模型文件（约 1GB），可能需要 5-10 分钟。

### Q: 内存不足？
A: Kronos 需要至少 2GB 内存，Zeabur/Railway 免费版可能不够，可以考虑升级或使用 HF Spaces。

### Q: 国内访问 Vercel 慢？
A: 建议使用 Zeabur 部署前端，国内访问更快。
