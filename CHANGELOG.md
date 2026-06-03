# 更新日志

## [v3.0.0] - 2026-06-03

### ✨ 新增功能

#### 动漫站点支持（maccms 类型）
- ✅ 站点类型自动检测（comicat / maccms / 通用站）— `GET /api/site/detect`
- ✅ 每日更新爬取（只抓取首页"每日更新"分区）— `POST /api/anime/crawl`
- ✅ B站风格画廊界面（封面网格 + 评分 + 更新状态）— `/gallery`
- ✅ 动漫详情页（简介 + 元数据 + 多线路选集）— `/anime/:id`
- ✅ 在线播放（DPlayer + hls.js 播放 m3u8/mp4）— `/play/:epId`
- ✅ 分集播放地址实时解析与缓存 — `GET /api/anime/episode/:epId/play`
- ✅ 元数据展示（名称/主演/类型/地区/语言/首播）
- ✅ 当天更新集自动高亮 + NEW 标记 + 自动滚动定位
- ✅ m3u8 视频下载（ffmpeg → mp4）— `POST /api/anime/episode/:epId/download`
- ✅ 每日自动更新调度器（每天 8 点自动爬取）

#### 通用爬虫增强
- ✅ 自动绕过"自动通过型"人机验证墙（comicat visitor-test）
- ✅ 按域名持久化 Cookie
- ✅ BT 磁力链提取与复制

### 🔧 改进

#### 数据库
- ✅ 新增 animes / anime_categories / anime_category_links / anime_episodes 四张表
- ✅ animes 表新增 meta 字段存储结构化元数据

#### 爬虫
- ✅ 只爬取每日更新分区，避免混入分类区内容
- ✅ 状态规范化（"第5集" → "更新至第5集"）
- ✅ 简介从裸文本节点提取（兼容多种页面结构）
- ✅ 详情页保留首页的封面/状态/标题（更准确）

### 📝 文档更新
- ✅ 更新 README.md（动漫画廊与播放器使用说明）
- ✅ 新增 v3.0.0 更新日志

---

## [v2.0.0] - 2024-06-03

### ✨ 新增功能

#### 历史记录系统
- ✅ 自动记录每次爬取的历史
- ✅ 包含URL、类型、状态、资源数量等信息
- ✅ 支持分页查询历史记录
- ✅ API: `GET /api/history?limit=50&offset=0`

#### 统计系统
- ✅ 总爬取次数统计
- ✅ 成功/失败次数统计
- ✅ 总下载次数和大小统计
- ✅ 实时更新统计数据
- ✅ API: `GET /api/stats`

#### 增强的API功能
- ✅ 根据类型获取资源: `GET /api/resources/type/:type`
- ✅ 根据状态获取资源: `GET /api/resources/status/:status`
- ✅ 资源搜索功能: `GET /api/search?q=keyword`
- ✅ 根据ID获取资源: `GET /api/resources/:id`
- ✅ 下载信息接口: `GET /api/download/:id`

#### 文档和示例
- ✅ 完整的API文档 (API.md)
- ✅ API快速参考 (API_QUICK_REFERENCE.md)
- ✅ 在线API测试页面 (api-demo.html)
- ✅ 多语言测试脚本 (test-api.js, test-api.py, test-api.sh)

### 🔧 改进

#### 数据库
- ✅ 新增 crawl_history 表
- ✅ 新增 crawl_stats 表
- ✅ 自动保存历史记录
- ✅ 自动更新统计信息

#### API响应
- ✅ 统一的响应格式
- ✅ 更详细的错误信息
- ✅ 参数验证改进

#### 用户体验
- ✅ 更友好的错误提示
- ✅ 实时统计展示
- ✅ 历史记录查询

### 📝 文档更新
- ✅ 更新 README.md
- ✅ 新增完整的API文档
- ✅ 新增快速参考指南
- ✅ 新增测试脚本文档

---

## [v1.0.0] - 2024-06-03

### ✨ 初始版本

#### 核心功能
- ✅ 基础爬虫系统
- ✅ 图片/视频/音频爬取
- ✅ 文件下载管理
- ✅ SQLite数据库存储
- ✅ Web管理界面
- ✅ RESTful API

#### Web界面
- ✅ 首页添加任务
- ✅ 资源列表页面
- ✅ 下载和删除功能

#### API接口
- ✅ 获取所有资源
- ✅ 添加爬取任务
- ✅ 删除资源

#### 技术栈
- ✅ Node.js + Express
- ✅ Axios + Cheerio
- ✅ sql.js (SQLite)
- ✅ EJS模板引擎
