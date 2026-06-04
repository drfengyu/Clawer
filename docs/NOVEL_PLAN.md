# 小说功能开发计划

## 📋 项目概述

为媒体资源爬虫管理系统新增**小说爬取与阅读**功能，支持从小说镜像站点（如八一中文网）抓取小说元数据、章节列表和正文，提供在线阅读体验。

---

## ⚖️ 版权声明

**⚠️ 重要提示**

本功能仅供**个人学习研究**使用，请遵守以下原则：

1. **禁止商业用途** — 不得将爬取内容用于商业化或盈利
2. **禁止公开传播** — 不得公开分享、转载或二次分发爬取内容
3. **尊重版权** — 爬取内容受《著作权法》保护，使用者需承担相应法律责任
4. **建议支持正版** — 推荐通过正规渠道阅读和购买正版小说

本项目开发者不对使用者的行为负责，使用本功能即表示您已理解并同意上述声明。

---

## 🎯 功能目标

### 核心功能（v4.0.0）
- ✅ **小说爬虫引擎** — 支持八一中文网（81zw2.com）
- ✅ **小说书库** — 列表展示、分页、搜索
- ✅ **小说详情** — 书名、作者、封面、简介、章节列表
- ✅ **在线阅读器** — 章节正文展示、上下章导航、键盘快捷键
- ✅ **按需抓取** — 章节正文按需实时爬取（避免批量抓取压力）
- ✅ **数据持久化** — SQLite 存储小说元数据和章节内容

### 未来扩展（v4.1.0+）
- ⏳ **多站点支持** — 支持配置多个镜像站点
- ⏳ **阅读进度记忆** — 记录用户最后阅读位置
- ⏳ **书架/收藏** — 用户追更书单
- ⏳ **更新监控** — 定时检查追更小说是否有新章节
- ⏳ **推送通知** — 新章节推送到 Bark/Server酱/邮件
- ⏳ **TXT/EPUB 导出** — 批量导出已爬章节为电子书格式
- ⏳ **搜索功能** — 集成站点搜索 API
- ⏳ **阅读设置** — 字体、字号、背景色自定义

---

## 🏗️ 技术方案

### 1. 爬虫引擎（src/crawlers/novelCrawler.js）

**目标站点：** 八一中文网（https://www.81zw2.com）

**反爬策略应对：**
- 标准 User-Agent
- 章节页必须带 Referer（书籍详情页）
- 无 JS 验证，直接 HTTP 请求

**核心方法：**
```javascript
- crawlHomePage()       // 抓取首页小说列表
- crawlDetail(bookId)   // 抓取书籍详情 + 章节列表
- crawlChapter(bookId, chapterId)  // 抓取章节正文
```

**URL 结构：**
```
首页：        https://www.81zw2.com/
书籍详情：     https://www.81zw2.com/book/{bookId}/
章节内容：     https://www.81zw2.com/book/{bookId}/{chapterId}.html
```

**数据提取：**
- 书名：`<h1>` 标签
- 作者：包含"作者"文本的段落
- 简介：`<div id="intro">`
- 章节列表：`href="/book/{bookId}/{chapterId}.html"`
- 正文：`<div id="content">`，用 `<br>` 分段

---

### 2. 数据库设计（src/database/db.js）

#### novels 表
```sql
CREATE TABLE novels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL,           -- 源站书籍 ID
  site_url TEXT NOT NULL,             -- 源站 URL
  title TEXT NOT NULL,                -- 书名
  author TEXT DEFAULT '未知作者',     -- 作者
  cover TEXT,                         -- 封面 URL
  description TEXT,                   -- 简介
  category TEXT DEFAULT '其他',       -- 分类（玄幻/都市/科幻等）
  status TEXT DEFAULT '连载中',       -- 状态（连载中/已完结）
  word_count INTEGER DEFAULT 0,       -- 字数
  update_date TEXT,                   -- 最后更新日期
  detail_url TEXT,                    -- 详情页 URL
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_id, site_url)
);
```

#### novel_chapters 表
```sql
CREATE TABLE novel_chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  novel_id INTEGER NOT NULL,          -- 关联 novels.id
  source_id TEXT NOT NULL,            -- 源站章节 ID
  chapter_number INTEGER NOT NULL,    -- 章节序号
  title TEXT NOT NULL,                -- 章节标题
  content TEXT,                       -- 正文（按需抓取）
  word_count INTEGER DEFAULT 0,       -- 字数
  is_vip BOOLEAN DEFAULT 0,           -- 是否 VIP 章节
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
  UNIQUE(novel_id, source_id)
);
```

---

### 3. API 路由（src/routes/novelRoutes.js）

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/novel/crawl-home` | 爬取首页小说列表 |
| POST | `/api/novel/crawl-detail` | 爬取小说详情 + 章节列表 |
| GET | `/api/novel/list` | 获取小说列表（分页/搜索） |
| GET | `/api/novel/:id` | 获取小说详情 |
| GET | `/api/novel/:id/chapters` | 获取章节列表 |
| GET | `/api/novel/chapter/:chapterId` | 获取章节内容（按需爬取） |
| DELETE | `/api/novel/:id` | 删除小说 |

---

### 4. 前端页面

#### 小说书库（/novels）
- 网格布局展示小说封面 + 书名 + 作者
- 搜索框（支持书名/作者搜索）
- 分页器（每页 60 本）
- "爬取首页"按钮

#### 小说详情（/novel/:id）
- 左侧：封面
- 右侧：书名、作者、分类、状态、字数、更新日期、简介
- 章节列表（网格布局，点击跳转阅读器）
- "爬取章节列表"按钮（首次访问时）

#### 阅读器（/novel/:novelId/read/:chapterId）
- 顶栏：返回目录、小说名
- 正文区：章节标题 + 正文（宋体，大行距）
- 底栏：上一章、目录、下一章
- 键盘导航：← 上一章、→ 下一章
- 按需加载：如果数据库没有正文，自动调用 API 爬取

---

## 📊 开发进度

### ✅ v4.0.0 - 小说功能基础版（2026-06-04）

- [x] 小说爬虫引擎（novelCrawler.js）
- [x] 数据库扩展（novels/chapters 表 + CRUD 方法）
- [x] API 路由（7 个接口）
- [x] 前端页面（书库/详情/阅读器）
- [x] 集成到主导航（画廊/时间轴添加"📚 小说"入口）
- [x] 文档（本计划文档）

### ⏳ v4.1.0 - 追更与推送（计划中）

- [ ] 阅读进度记忆（localStorage 或数据库）
- [ ] 书架/收藏功能（用户追更列表）
- [ ] 定时检查更新（每日调度器）
- [ ] 新章节推送（Bark/Server酱/邮件）
- [ ] RSS 订阅源（`/rss/novel/:novelId`）

### ⏳ v4.2.0 - 增强体验（计划中）

- [ ] TXT/EPUB 导出
- [ ] 阅读设置（字体/字号/背景色/夜间模式）
- [ ] 小说搜索（集成站点搜索 API）
- [ ] 多站点支持（配置式添加站点）
- [ ] 批量下载（整本小说一键下载）

---

## 🚀 使用流程

### 用户操作流程

1. **访问书库** — 浏览器打开 `http://localhost:3000/novels`
2. **爬取首页** — 点击"爬取首页"按钮，抓取小说列表
3. **查看详情** — 点击小说卡片，进入详情页
4. **爬取章节** — 点击"爬取章节列表"，获取完整目录
5. **开始阅读** — 点击章节名，进入阅读器
6. **自动加载** — 如果章节正文未爬取，自动实时抓取

### 开发者接口调用

```bash
# 爬取首页
curl -X POST http://localhost:3000/api/novel/crawl-home

# 爬取小说详情
curl -X POST http://localhost:3000/api/novel/crawl-detail \
  -H "Content-Type: application/json" \
  -d '{"bookId": "29250"}'

# 获取小说列表
curl http://localhost:3000/api/novel/list?page=1&pageSize=20&keyword=轮回

# 获取章节内容
curl http://localhost:3000/api/novel/chapter/123
```

---

## ⚠️ 注意事项

### 爬取限制
- **频率控制** — 避免短时间大量请求，建议每次请求间隔 250ms
- **按需抓取** — 章节正文仅在用户阅读时抓取，不批量下载
- **Referer 必须** — 章节页必须带 Referer，否则返回 403

### 数据库
- **sql.js 内存镜像** — 每次 `save()` 会整库写盘，频繁保存会影响性能
- **定期备份** — 建议定期备份 `database.db` 文件

### 版权合规
- **仅限个人使用** — 不得公开部署、商业化或传播
- **支持正版** — 建议通过正规渠道支持作者

---

## 🔧 故障排查

### 常见问题

**Q: 爬取首页返回空？**
- 检查网络连接
- 确认站点 URL 是否可达（`curl https://www.81zw2.com`）
- 查看控制台错误日志

**Q: 章节正文抓取失败（403）？**
- 确认 Referer 是否正确设置
- 检查 User-Agent 是否标准

**Q: 数据库保存后丢失？**
- 检查文件系统权限
- 确认 `database.db` 路径正确

**Q: 封面图片不显示？**
- 源站防盗链，需要服务端代理（类似动漫 m3u8 代理）
- 或者下载封面到本地

---

## 📚 相关文档

- [README.md](../README.md) — 项目总览
- [CHANGELOG.md](../CHANGELOG.md) — 版本更新日志
- [API.md](./API.md) — API 接口文档
- [CONFIG.md](./CONFIG.md) — 配置说明

---

## 📝 开发日志

### 2026-06-04
- 完成 v4.0.0 小说功能基础版
- 爬虫引擎调研并实现（八一中文网）
- 数据库扩展（novels/chapters 表）
- API 路由（7 个接口）
- 前端页面（书库/详情/阅读器）
- 集成到主导航

---

**更新日期：** 2026-06-04  
**版本：** v4.0.0  
**维护者：** ShallowDream
