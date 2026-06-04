# Media Crawler - 媒体资源爬虫管理系统

一个基于 Node.js 的爬虫系统，支持智能识别网站类型，抓取并管理音视频图片资源。内置 **B站风格动漫画廊** 与 **在线播放器**，可爬取动漫站每日更新、分集播放与下载。

## 🌟 功能特性

### 通用爬虫
- 🎵 爬取免费音频资源
- 🎬 爬取免费视频资源（HTML5 / 磁力链）
- 🖼️ 爬取图片资源
- 🛡️ 自动绕过"自动通过型"人机验证墙（如 comicat 的 visitor-test）
- 🧲 BT 磁力链提取与复制

### 动漫站点（maccms 类型）
- 🔍 **站点类型自动检测**（comicat / maccms / 通用站）
- 📅 **每日更新爬取** — 只抓取首页"每日更新"分区
- 🕒 **每日更新时间轴** `/timeline` — 按天回顾历史每日更新（标题 + 该集简介），点击跳详情页
- 🎴 **B站风格画廊** — 封面网格 + 评分 + 更新状态
- 🗂️ **全量分区采集** — 一键抓取四大分区全部分页入库（`npm run sync:categories`）
- 📖 **分区浏览** — 读本地库，后端 SQL 分页（每页 60）+ 库内搜索，毫秒级翻页
- 🎬 **分集 + 多线路** — 详情页选集，当天更新集自动高亮
- 📋 **元数据展示** — 名称/主演/类型/地区/语言/首播
- ⬇️ **m3u8 下载** — ffmpeg 合并为 mp4
- ⏰ **每日自动更新** — 内置调度器：每天 8 点爬每日更新，凌晨 4 点增量同步分区

### 在线播放器（对标 B站 观感）
- 📺 **DPlayer + hls.js** — 播放 m3u8/mp4，缓冲/起播/重试已调优
- ⏩ **倍速播放** — 0.5x–2x
- 🖥️ **网页全屏** + 快捷键（← → 快进退 / ↑ ↓ 音量 / 空格 / F）
- 🎬 **自动连播下一集** + **预载下一集**（切集秒开）
- 💾 **记忆播放进度** — 刷新/返回续播
- 🔀 **多线路切换** — 同集号不同线路就地切换，保留进度
- 🛡️ **m3u8 服务端代理** — 带 Referer 绕过防盗链/跨域，支持拖动；直连失败自动兜底

### 订阅与推送
- 📡 **RSS 订阅** `/rss`（每日更新）、`/rss/category/:name`（分区）— 标准 RSS 2.0，任意阅读器/服务可订阅
- 🔔 **每日主动推送** — 爬完后把"今日新增"推到 **Bark / Server酱 / 邮件(SMTP)**，按 `.env` 开关，未配置静默跳过
- 详见 [docs/RSS_PUSH.md](./docs/RSS_PUSH.md)

### 小说功能（NEW）
- 📚 **小说书库** `/novels` — 网格展示小说封面、书名、作者，支持搜索与分页
- 📖 **小说详情** — 书籍信息（作者/分类/状态/简介）+ 完整章节目录
- 📄 **在线阅读器** — 宋体排版、大行距、上下章导航、键盘快捷键（← →）
- 🕷️ **小说爬虫** — 支持八一中文网（81zw2.com），按需抓取章节正文
- ⚠️ **仅供学习** — 请勿用于商业用途或公开传播，详见 [docs/NOVEL_PLAN.md](./docs/NOVEL_PLAN.md)

### 后台管理
- 🗄️ **数据库后台** `/admin` — 只读浏览各表（分页/搜索/排序/自动刷新）
- 🔧 **API 在线调试** `/admin/api` — 常用接口快捷填充，方法/URL/Headers/Body 一键发送，响应格式化展示

## 🚀 快速开始

### 新环境快速部署

从 Git 克隆到新笔记本后，只需 3 步即可启动（数据库和下载目录会自动创建）：

```bash
# 1. 克隆代码
git clone https://github.com/drfengyu/Clawer.git
cd Clawer

# 2. 安装依赖（会自动安装 8 个依赖包）
npm install

# 3. 启动（首次启动会自动创建空数据库 + downloads/ 目录）
npm start
```

访问 `http://localhost:3000` 即可使用（首页自动跳转到画廊）。

**注意事项：**
- ✅ 数据库文件会自动创建，但**数据是空的**（需重新爬取或手动迁移旧 `database.db`）
- ✅ `.env` 配置可选（不填也能跑；推送/RSS 功能需要时再填，复制 `.env.example` 改名即可）
- ✅ 下载目录 `downloads/` 会自动创建
- ⚠️ 播放/下载功能需系统安装 [ffmpeg](https://ffmpeg.org/)（用于 m3u8 → mp4）

**新环境资源分区同步时机：**
- **每日更新** — 服务启动后，**每天早上 8 点**自动爬取源站首页"每日更新"（约 20-30 部），存入本地库
- **四大分区全量** — 需**手动执行** `npm run sync:categories` 一键抓取全部分区全部分页（日漫/国漫/美漫/动漫剧场），首次约需 5-15 分钟（取决于源站速度和总页数）
- **分区增量同步** — 服务启动后，**每天凌晨 4 点**自动增量同步各分区（从第 1 页往后爬，只入库新片，连续 3 页无新增即提前结束该分区）

> 快速填充库：新环境启动后立即运行 `npm run sync:categories` 全量同步，然后等每天 8 点自动更新即可。

---

### 安装依赖

```bash
npm install
```

> 在线播放与下载功能需系统安装 [ffmpeg](https://ffmpeg.org/)（用于 m3u8 → mp4）。

### 配置环境

```bash
# 复制环境变量配置
cp .env.example .env

# 编辑 .env 文件（可选）
PORT=3000
DOWNLOAD_PATH=./downloads
DB_PATH=./database.db

# RSS / 推送（可选，完整配置说明见 docs/CONFIG.md）
PUBLIC_BASE_URL=http://localhost:3000   # RSS/邮件链接基址
PUSH_ENABLED=false                       # 每日爬完后主动推送总开关
BARK_KEY=                                # Bark(iOS)；填 key 即启用
SERVERCHAN_KEY=                          # Server酱(微信)；填 SendKey 即启用
SMTP_HOST=                               # 邮件：HOST/USER/PASS/MAIL_TO 填齐即启用
```

### 启动服务器

```bash
# 生产环境
npm start

# 开发环境（自动重启）
npm run dev
```

服务器将在 `http://localhost:3000` 启动，首页自动跳转到动漫画廊 `/gallery`。

### 全量同步分区资源（可选）

一次性把源站四大分区（日漫/国漫/美漫/动漫剧场）的全部目录抓入本地库：

```bash
npm run sync:categories        # 抓全部分区全部页
node scripts/syncCategories.js 5   # 每分区最多抓 5 页（限量/调试）
```

> ⚠️ 该脚本为独立进程，运行期间需**独占数据库**（sql.js 整库内存镜像）——请先停掉正在运行的服务，跑完再 `npm start`。
> 服务进程内的「每日增量同步」（凌晨 4 点）复用同一实例，**无需停服务**。仅同步目录卡片，分集/播放地址仍在打开详情时按需抓取。

## 📖 使用指南

### 动漫画廊（推荐）

1. **画廊首页**: http://localhost:3000/gallery
   - 顶部输入动漫站 URL（如 `https://m.tiantiandongman.com/`）点击"爬取资源"
   - 卡片网格展示每日更新动漫（封面 + 评分 + 更新状态）
   - 按分类（日漫/国漫/美漫/动漫剧场）进入分区浏览

2. **分区浏览**: http://localhost:3000/category/:name
   - 读本地库，分页展示（每页 60）+ 分区内搜索（`?q=关键词`）
   - 支持 `?page=` 翻页、`?sort=` 排序；数据来自全量同步，毫秒级响应

3. **详情页**: http://localhost:3000/anime/:id
   - 封面、评分、简介、元数据（主演/类型/地区/语言/首播）
   - 多线路切换 + 分集列表，当天更新集高亮标记 NEW
   - 分集/播放地址按需抓取（首次打开时补全）

4. **播放页**: http://localhost:3000/play/:episodeId
   - DPlayer 播放器：倍速、网页全屏、自动连播、记忆进度、多线路切换
   - 上一集 / 下一集导航（限定当前线路）
   - 直连卡顿时可右键"切换代理线路"，下载本集（m3u8 → mp4）

### 通用爬虫

1. **资源列表**: http://localhost:3000/resources
   - 查看爬取的图片/视频/磁力链资源

### 后台管理

1. **数据库后台**: http://localhost:3000/admin
   - 只读浏览各数据表，支持分页 / 跨列搜索 / 排序 / 自动刷新
2. **API 在线调试**: http://localhost:3000/admin/api（或从后台顶栏「🔧 API 调试」进入）
   - 左侧选常用接口自动填充，右侧设置方法/URL/Headers/Body 后一键发送，查看格式化响应

### API 使用

详细的 API 文档请查看 [docs/API.md](./docs/API.md)

#### 动漫 API

```bash
# 检测站点类型
curl "http://localhost:3000/api/site/detect?url=https://m.tiantiandongman.com/"

# 爬取每日更新（含分集详情）
curl -X POST http://localhost:3000/api/anime/crawl \
  -H "Content-Type: application/json" \
  -d '{"siteUrl":"https://m.tiantiandongman.com/","filterToday":true,"crawlDetails":true}'

# 获取每日更新列表
curl http://localhost:3000/api/anime/daily

# 获取动漫详情（含分集）
curl http://localhost:3000/api/anime/1

# 解析分集播放地址（m3u8）
curl http://localhost:3000/api/anime/episode/1/play
```

#### 通用爬虫 API

```bash
# 添加爬取任务
curl -X POST http://localhost:3000/api/crawl \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","type":"image"}'

# 获取所有资源
curl http://localhost:3000/api/resources
```

## 📡 API 接口

### 动漫站点
- `GET /api/site/detect?url=` - 站点类型检测
- `POST /api/anime/crawl` - 爬取每日更新动漫
- `GET /api/anime/daily` - 获取每日更新列表
- `GET /api/anime/:id` - 获取动漫详情（含分集）
- `GET /api/anime/search?q=` - 搜索动漫
- `GET /api/anime/episode/:epId/play` - 解析分集播放地址（返回 `videoUrl`/`proxyUrl`/`videoUrlNext`）
- `POST /api/anime/episode/:epId/refresh` - 强制刷新播放地址
- `POST /api/anime/episode/:epId/download` - 下载分集（m3u8→mp4）
- `GET /api/categories` - 获取分类列表

### RSS 订阅与推送
- `GET /rss` - 每日更新 RSS 2.0 订阅源
- `GET /rss/category/:name` - 分区订阅源（如 `/rss/category/日漫`）
- `POST /api/push/test` - 手动触发推送（联调用，返回各渠道结果）

### 视频代理（绕过防盗链/跨域）
- `GET /api/proxy/m3u8?url=&ref=` - 拉取并改写 m3u8（分片/嵌套列表回流经本服务）
- `GET /api/proxy/seg?url=&ref=` - 流式转发分片，支持 Range（拖动进度）

### 资源管理（通用）
- `GET /api/resources` - 获取所有资源
- `GET /api/resources/:id` - 根据ID获取资源
- `GET /api/resources/type/:type` - 根据类型获取资源
- `POST /api/crawl` - 添加爬取任务
- `DELETE /api/resources/:id` - 删除资源

### 搜索与统计
- `GET /api/search?q=keyword` - 搜索资源
- `GET /api/history` - 获取爬取历史
- `GET /api/stats` - 获取统计信息

完整的 API 文档请查看 [docs/API.md](./docs/API.md)

## 🛠️ 技术栈

- **后端**: Node.js + Express
- **爬虫**: Axios + Cheerio
- **数据库**: SQLite (sql.js)
- **前端**: HTML + CSS + JavaScript + EJS
- **播放器**: DPlayer + hls.js（CDN 引入）
- **下载**: ffmpeg（m3u8 → mp4）

## 📁 项目结构

```
Clawer/
├── src/
│   ├── server.js              # 服务器入口 + 每日更新/分区增量同步调度器
│   ├── crawlers/
│   │   ├── baseCrawler.js     # 通用爬虫（反爬绕过、磁力链）
│   │   ├── siteDetector.js    # 站点类型检测
│   │   ├── crawlerRegistry.js # 多站点爬虫注册表
│   │   └── maccmsCrawler.js   # maccms 动漫站爬虫
│   ├── routes/
│   │   ├── pages.js           # 页面路由（画廊/分区/详情/播放）
│   │   ├── api.js             # 通用 API 路由
│   │   ├── animeRoutes.js     # 动漫 API 路由
│   │   ├── proxyRoutes.js     # m3u8 / 分片视频代理
│   │   ├── feedRoutes.js      # RSS 订阅源路由（/rss）
│   │   └── adminRoutes.js     # 只读数据库后台
│   ├── feed/
│   │   └── rss.js             # RSS 2.0 feed 生成（纯函数）
│   ├── push/                  # 主动推送适配器（按 .env 开关）
│   │   ├── index.js           # 推送编排（allSettled 并发分发）
│   │   ├── bark.js            # Bark (iOS)
│   │   ├── serverchan.js      # Server酱 (微信)
│   │   └── email.js           # 邮件 (SMTP, nodemailer)
│   ├── sync/
│   │   └── categorySync.js    # 分区目录同步核心（供脚本与调度器复用）
│   ├── database/
│   │   └── db.js              # 数据库操作（resources + animes 系列表）
│   └── utils/
│       └── downloader.js      # 下载工具（HTTP + m3u8）
├── scripts/
│   └── syncCategories.js      # 全量分区同步 CLI（npm run sync:categories）
├── views/                     # EJS 模板
│   ├── gallery.ejs            # B站风格画廊
│   ├── timeline.ejs           # 每日更新时间轴
│   ├── category.ejs           # 分区浏览（分页 + 搜索）
│   ├── detail.ejs             # 动漫详情页
│   ├── player.ejs             # 在线播放页
│   ├── admin.ejs              # 数据库后台
│   ├── apiDebug.ejs           # API 在线调试控制台
│   ├── resources.ejs          # 通用资源列表
│   └── error.ejs              # 错误页
├── public/                    # 静态资源
│   ├── css/style.css
│   └── js/
│       ├── gallery.js         # 画廊筛选
│       ├── detail.js          # 选集切换
│       ├── player.js          # DPlayer + hls 调优 + 代理兜底
│       ├── admin.js           # 数据库后台表浏览器
│       ├── apiDebug.js        # API 调试控制台
│       └── resources.js
├── downloads/                 # 下载目录（image/video/audio）
├── docs/                      # 项目文档（API/使用/测试/总结等）
│   ├── API.md                 # 完整 API 文档
│   ├── CONFIG.md              # .env 配置详细说明（RSS/推送/邮箱）
│   ├── RSS_PUSH.md           # RSS 订阅与每日推送功能说明
│   ├── API_QUICK_REFERENCE.md # API 快速参考
│   ├── USAGE.md               # 使用教程
│   ├── TEST.md                # 测试指南
│   ├── SUMMARY.md             # 项目总结
│   └── PROJECT_COMPLETE.md    # 项目完成报告
├── package.json
├── README.md
└── CHANGELOG.md
```

## 🗄️ 数据库结构

动漫数据独立于通用 `resources` 表：

- `animes` — 动漫主表（标题/封面/评分/状态/简介/元数据）
- `anime_categories` — 分类
- `anime_category_links` — 动漫-分类关联
- `anime_episodes` — 分集（线路/集数/播放页/视频地址）

## ⚠️ 重要提示

本项目**仅用于学习和研究**，请务必遵守：

- ✅ 目标网站的 robots.txt 规则
- ✅ 相关法律法规
- ✅ 版权和使用条款
- ✅ 合理控制爬取频率

**禁止用于：**
- ❌ 爬取有版权保护的商业内容
- ❌ 绕过技术保护措施用于非法目的
- ❌ 侵犯他人合法权益
- ❌ 任何非法用途

## 🐛 故障排查

### 端口被占用

```bash
# Windows
netstat -ano | findstr :3000
taskkill /F /PID <PID>

# Linux/Mac
lsof -i :3000
kill -9 <PID>
```

### 在线播放/下载失败

1. 确认系统已安装 ffmpeg（`ffmpeg -version`）
2. m3u8 地址有时效性，可在播放器右键"刷新播放地址"
3. 部分 CDN 有跨域/防盗链限制 — 播放器右键"切换代理线路"走服务端代理（直连失败也会自动兜底）
4. 流畅度上限取决于源站 CDN 带宽；代理只能绕过限制，无法突破源站本身的速度

### 分区同步与服务常驻

- `npm run sync:categories`（手动全量）需先停服务，独占数据库运行
- 「每日增量同步」依赖服务**持续运行**才会在凌晨 4 点触发；若服务非常驻，建议用系统计划任务定时跑同步脚本（运行前停服务）

### 爬取失败

1. 检查 URL 是否正确
2. 确认目标站点为支持的类型（maccms / comicat）
3. 某些网站有反爬虫机制
4. 查看控制台错误日志

## 📄 许可证

MIT License

---

**免责声明**: 本项目仅供学习和研究使用。使用者需自行承担使用本工具的一切法律责任。
