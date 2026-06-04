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
- 🎴 **B站风格画廊** — 封面网格 + 评分 + 更新状态
- 📺 **在线播放** — DPlayer + hls.js 播放 m3u8/mp4 直链
- 🎬 **分集 + 多线路** — 详情页选集，当天更新集自动高亮
- 📋 **元数据展示** — 名称/主演/类型/地区/语言/首播
- ⬇️ **m3u8 下载** — ffmpeg 合并为 mp4
- ⏰ **每日自动更新** — 内置调度器，每天 8 点自动爬取

## 🚀 快速开始

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
```

### 启动服务器

```bash
# 生产环境
npm start

# 开发环境（自动重启）
npm run dev
```

服务器将在 `http://localhost:3000` 启动，首页自动跳转到动漫画廊 `/gallery`。

## 📖 使用指南

### 动漫画廊（推荐）

1. **画廊首页**: http://localhost:3000/gallery
   - 顶部输入动漫站 URL（如 `https://m.tiantiandongman.com/`）点击"爬取资源"
   - 卡片网格展示每日更新动漫（封面 + 评分 + 更新状态）
   - 按分类（日漫/国漫/美漫/动漫剧场）筛选

2. **详情页**: http://localhost:3000/anime/:id
   - 封面、评分、简介、元数据（主演/类型/地区/语言/首播）
   - 多线路切换 + 分集列表，当天更新集高亮标记 NEW

3. **播放页**: http://localhost:3000/play/:episodeId
   - DPlayer 播放器，支持 m3u8/mp4
   - 上一集 / 下一集导航
   - 下载本集（m3u8 → mp4）

### 通用爬虫

1. **资源列表**: http://localhost:3000/resources
   - 查看爬取的图片/视频/磁力链资源

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
- `GET /api/anime/episode/:epId/play` - 解析分集播放地址
- `POST /api/anime/episode/:epId/refresh` - 强制刷新播放地址
- `POST /api/anime/episode/:epId/download` - 下载分集（m3u8→mp4）
- `GET /api/categories` - 获取分类列表

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
│   ├── server.js              # 服务器入口 + 每日自动更新调度器
│   ├── crawlers/
│   │   ├── baseCrawler.js     # 通用爬虫（反爬绕过、磁力链）
│   │   ├── siteDetector.js    # 站点类型检测
│   │   └── maccmsCrawler.js   # maccms 动漫站爬虫
│   ├── routes/
│   │   ├── pages.js           # 页面路由（画廊/详情/播放）
│   │   ├── api.js             # 通用 API 路由
│   │   └── animeRoutes.js     # 动漫 API 路由
│   ├── database/
│   │   └── db.js              # 数据库操作（resources + animes 系列表）
│   └── utils/
│       └── downloader.js      # 下载工具（HTTP + m3u8）
├── views/                     # EJS 模板
│   ├── gallery.ejs            # B站风格画廊
│   ├── detail.ejs             # 动漫详情页
│   ├── player.ejs             # 在线播放页
│   ├── resources.ejs          # 通用资源列表
│   └── error.ejs              # 错误页
├── public/                    # 静态资源
│   ├── css/style.css
│   └── js/
│       ├── gallery.js         # 画廊筛选
│       ├── detail.js          # 选集切换
│       ├── player.js          # DPlayer 初始化
│       └── resources.js
├── downloads/                 # 下载目录（image/video/audio）
├── docs/                      # 项目文档（API/使用/测试/总结等）
│   ├── API.md                 # 完整 API 文档
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
3. 部分 CDN 可能有跨域限制

### 爬取失败

1. 检查 URL 是否正确
2. 确认目标站点为支持的类型（maccms / comicat）
3. 某些网站有反爬虫机制
4. 查看控制台错误日志

## 📄 许可证

MIT License

---

**免责声明**: 本项目仅供学习和研究使用。使用者需自行承担使用本工具的一切法律责任。
