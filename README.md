# Media Crawler - 媒体资源爬虫管理系统

一个基于 Node.js 的爬虫系统，用于抓取和管理免费的音频、视频、图片资源。

## 🌟 功能特性

- 🎵 爬取免费音频资源
- 🎬 爬取免费视频资源
- 🖼️ 爬取图片资源
- 💾 资源本地下载和管理
- 🌐 Web 管理界面
- 📊 资源数据库管理
- 📜 爬取历史记录
- 📈 统计信息展示
- 🔍 资源搜索功能
- 📡 完整的 RESTful API

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

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

服务器将在 `http://localhost:3000` 启动

## 📖 使用指南

### Web 界面

1. **首页**: http://localhost:3000
   - 添加爬取任务
   - 查看功能介绍

2. **资源列表**: http://localhost:3000/resources
   - 查看所有资源
   - 下载资源
   - 删除资源

3. **API 演示**: http://localhost:3000/api-demo.html
   - 在线测试所有API
   - 查看实时统计

### API 使用

详细的 API 文档请查看 [API.md](./API.md)

#### 快速示例

```bash
# 添加爬取任务
curl -X POST http://localhost:3000/api/crawl \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","type":"image"}'

# 获取所有资源
curl http://localhost:3000/api/resources

# 搜索资源
curl "http://localhost:3000/api/search?q=example"

# 获取统计信息
curl http://localhost:3000/api/stats

# 获取爬取历史
curl http://localhost:3000/api/history
```

#### API 测试脚本

```bash
# JavaScript
node test-api.js

# Python
python test-api.py

# Bash
bash test-api.sh
```

## 📡 API 接口

### 资源管理
- `GET /api/resources` - 获取所有资源
- `GET /api/resources/:id` - 根据ID获取资源
- `GET /api/resources/type/:type` - 根据类型获取资源
- `GET /api/resources/status/:status` - 根据状态获取资源
- `POST /api/crawl` - 添加爬取任务
- `DELETE /api/resources/:id` - 删除资源

### 搜索与过滤
- `GET /api/search?q=keyword` - 搜索资源

### 历史与统计
- `GET /api/history` - 获取爬取历史
- `GET /api/stats` - 获取统计信息

### 下载
- `GET /api/download/:id` - 获取下载信息

完整的 API 文档请查看 [API.md](./API.md)

## 🛠️ 技术栈

- **后端**: Node.js + Express
- **爬虫**: Axios + Cheerio
- **数据库**: SQLite (sql.js)
- **前端**: HTML + CSS + JavaScript + EJS

## 📁 项目结构

```
pachong/
├── src/
│   ├── server.js              # 服务器入口
│   ├── crawlers/
│   │   └── baseCrawler.js     # 爬虫核心逻辑
│   ├── routes/
│   │   ├── pages.js           # 页面路由
│   │   └── api.js             # API 路由
│   ├── database/
│   │   └── db.js              # 数据库操作
│   └── utils/
│       └── downloader.js      # 下载工具
├── views/                     # EJS 模板
│   ├── index.ejs              # 首页
│   ├── resources.ejs          # 资源列表
│   └── error.ejs              # 错误页
├── public/                    # 静态资源
│   ├── css/style.css          # 样式
│   ├── js/
│   │   ├── main.js            # 首页脚本
│   │   └── resources.js       # 资源页脚本
│   └── api-demo.html          # API 演示页面
├── downloads/                 # 下载目录
│   ├── image/
│   ├── video/
│   └── audio/
├── test-api.js                # API 测试脚本 (JS)
├── test-api.py                # API 测试脚本 (Python)
├── test-api.sh                # API 测试脚本 (Bash)
├── package.json
├── .env                       # 环境配置
├── README.md                  # 项目说明
├── API.md                     # API 文档
├── USAGE.md                   # 使用教程
└── TEST.md                    # 测试指南
```

## ⚠️ 重要提示

本项目**仅用于爬取公开的免费资源**，请务必遵守：

- ✅ 目标网站的 robots.txt 规则
- ✅ 相关法律法规
- ✅ 版权和使用条款
- ✅ 合理控制爬取频率

**禁止用于：**
- ❌ 爬取有版权保护的商业内容
- ❌ 绕过技术保护措施
- ❌ 侵犯他人合法权益
- ❌ 任何非法用途

## 📚 文档

- [API 文档](./API.md) - 完整的 API 接口说明
- [使用指南](./USAGE.md) - 详细的使用教程
- [测试指南](./TEST.md) - 测试和调试说明
- [项目总结](./SUMMARY.md) - 功能总结和注意事项

## 🔧 开发

### 安装开发依赖

```bash
npm install
```

### 运行测试

```bash
# 测试爬虫功能
node test-crawler.js

# 测试 API
node test-api.js
```

### 调试

```bash
# 启动开发模式
npm run dev

# 查看日志
tail -f server.log
```

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

### 爬取失败

1. 检查 URL 是否正确
2. 确认目标网页包含对应类型的媒体资源
3. 某些网站可能有反爬虫机制
4. 查看控制台错误日志

## 📈 统计功能

系统会自动记录：
- 总爬取次数
- 成功/失败次数
- 总下载次数
- 总下载大小
- 完整的爬取历史

访问 `/api/stats` 查看统计信息。

## 🔍 搜索功能

支持根据 URL 和标题搜索资源：

```bash
curl "http://localhost:3000/api/search?q=关键词"
```

## 📜 历史记录

每次爬取都会自动记录：
- 爬取的 URL
- 资源类型
- 成功/失败状态
- 找到的资源数量
- 错误信息（如果失败）

访问 `/api/history` 查看历史记录。

## 💡 使用建议

1. **学习目的**: 用于学习爬虫技术和 Web 开发
2. **合法资源**: 只爬取允许的公开内容
3. **尊重版权**: 不要用于商业用途
4. **控制频率**: 避免给目标网站造成压力

## 📄 许可证

MIT License

---

**免责声明**: 本项目仅供学习和研究使用。使用者需自行承担使用本工具的一切法律责任。
