# 更新日志

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
