# API 文档

## 基础信息

- **Base URL**: `http://localhost:3000/api`
- **响应格式**: JSON
- **字符编码**: UTF-8

## 通用响应格式

### 成功响应
```json
{
  "success": true,
  "data": {}
}
```

### 错误响应
```json
{
  "success": false,
  "error": "错误信息"
}
```

---

## 资源管理接口

### 1. 获取所有资源

获取所有已爬取的资源列表。

**请求**
```
GET /api/resources
```

**响应示例**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "url": "https://example.com/page",
      "title": "示例资源",
      "type": "image",
      "status": "completed",
      "file_path": "downloads/image/example.jpg",
      "file_size": 102400,
      "thumbnail": null,
      "created_at": "2024-01-01 12:00:00",
      "updated_at": "2024-01-01 12:00:10"
    }
  ]
}
```

**字段说明**
- `id`: 资源ID
- `url`: 原始URL
- `title`: 资源标题
- `type`: 资源类型 (`image`, `video`, `audio`)
- `status`: 状态 (`pending`, `processing`, `completed`, `failed`)
- `file_path`: 文件路径
- `file_size`: 文件大小（字节）
- `created_at`: 创建时间
- `updated_at`: 更新时间

---

### 2. 根据ID获取资源

获取指定ID的资源详情。

**请求**
```
GET /api/resources/:id
```

**路径参数**
- `id`: 资源ID

**响应示例**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "url": "https://example.com/page",
    "title": "示例资源",
    "type": "image",
    "status": "completed",
    "file_path": "downloads/image/example.jpg",
    "file_size": 102400,
    "created_at": "2024-01-01 12:00:00",
    "updated_at": "2024-01-01 12:00:10"
  }
}
```

---

### 3. 根据类型获取资源

获取指定类型的所有资源。

**请求**
```
GET /api/resources/type/:type
```

**路径参数**
- `type`: 资源类型 (`image`, `video`, `audio`)

**响应示例**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "type": "image",
      "title": "图片资源",
      ...
    }
  ]
}
```

---

### 4. 根据状态获取资源

获取指定状态的所有资源。

**请求**
```
GET /api/resources/status/:status
```

**路径参数**
- `status`: 状态 (`pending`, `processing`, `completed`, `failed`)

**响应示例**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "status": "completed",
      ...
    }
  ]
}
```

---

### 5. 搜索资源

根据关键词搜索资源（搜索URL和标题）。

**请求**
```
GET /api/search?q=keyword
```

**查询参数**
- `q`: 搜索关键词（必填）

**示例**
```bash
GET /api/search?q=example
```

**响应示例**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "url": "https://example.com/page",
      "title": "包含example的资源",
      ...
    }
  ]
}
```

---

### 6. 添加爬取任务

创建新的爬取任务。

**请求**
```
POST /api/crawl
Content-Type: application/json
```

**请求体**
```json
{
  "url": "https://example.com/page",
  "type": "image"
}
```

**参数说明**
- `url`: 要爬取的页面URL（必填）
- `type`: 资源类型（必填）：`image`, `video`, `audio`

**响应示例**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "message": "任务已添加到队列"
  }
}
```

**cURL 示例**
```bash
curl -X POST http://localhost:3000/api/crawl \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","type":"image"}'
```

---

### 7. 删除资源

删除指定的资源记录。

**请求**
```
DELETE /api/resources/:id
```

**路径参数**
- `id`: 资源ID

**响应示例**
```json
{
  "success": true,
  "message": "删除成功"
}
```

**cURL 示例**
```bash
curl -X DELETE http://localhost:3000/api/resources/1
```

---

## 历史记录接口

### 8. 获取爬取历史

获取爬虫执行历史记录。

**请求**
```
GET /api/history?limit=50&offset=0
```

**查询参数**
- `limit`: 返回数量（默认50）
- `offset`: 偏移量（默认0）

**响应示例**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "url": "https://example.com",
      "type": "image",
      "status": "completed",
      "success": 1,
      "error_message": null,
      "resource_count": 5,
      "created_at": "2024-01-01 12:00:00"
    }
  ]
}
```

**字段说明**
- `success`: 是否成功（1=成功，0=失败）
- `resource_count`: 找到的资源数量
- `error_message`: 错误信息（如果失败）

---

## 统计接口

### 9. 获取统计信息

获取系统总体统计数据。

**请求**
```
GET /api/stats
```

**响应示例**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "total_crawls": 100,
    "success_crawls": 85,
    "failed_crawls": 15,
    "total_downloads": 85,
    "total_size": 10485760,
    "updated_at": "2024-01-01 12:00:00"
  }
}
```

**字段说明**
- `total_crawls`: 总爬取次数
- `success_crawls`: 成功次数
- `failed_crawls`: 失败次数
- `total_downloads`: 总下载次数
- `total_size`: 总下载大小（字节）

---

## 下载接口

### 10. 获取下载信息

获取资源的下载信息。

**请求**
```
GET /api/download/:id
```

**路径参数**
- `id`: 资源ID

**响应示例**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "示例资源",
    "file_path": "downloads/image/example.jpg",
    "file_size": 102400,
    "download_url": "/downloads/image/example.jpg"
  }
}
```

**使用方法**
```bash
# 1. 获取下载信息
curl http://localhost:3000/api/download/1

# 2. 使用 download_url 下载文件
curl http://localhost:3000/downloads/image/example.jpg -o example.jpg
```

---

## 动漫站点接口（maccms）

### 11. 站点类型检测
```
GET /api/site/detect?url=<站点地址>
```

### 12. 爬取每日更新
```
POST /api/anime/crawl
Content-Type: application/json

{ "siteUrl": "https://m.tiantiandongman.com/", "filterToday": true, "crawlDetails": true }
```

### 13. 每日更新列表 / 详情 / 搜索
```
GET /api/anime/daily            # 今日更新列表
GET /api/anime/:id              # 动漫详情（含分集，按线路分组）
GET /api/anime/search?q=keyword # 搜索动漫
GET /api/categories             # 分类列表
```

### 14. 解析分集播放地址

```
GET /api/anime/episode/:epId/play
```

**响应示例**
```json
{
  "success": true,
  "data": {
    "videoUrl": "https://cdn.example.com/video/index.m3u8",
    "proxyUrl": "/api/proxy/m3u8?url=...&ref=...",
    "playPageUrl": "https://m.tiantiandongman.com/v/50058-3-1/",
    "videoUrlNext": "https://cdn.example.com/next/index.m3u8",
    "cached": false
  }
}
```

**字段说明**
- `videoUrl`: 直连播放地址（m3u8/mp4/flv）
- `proxyUrl`: 经服务端代理的 m3u8 地址（仅 m3u8 时返回，用于直连失败兜底）
- `playPageUrl`: 播放页地址（作为代理 Referer 来源）
- `videoUrlNext`: 下一集地址（来源页解析所得）
- `cached`: 是否取自数据库缓存

### 15. 刷新播放地址 / 下载分集
```
POST /api/anime/episode/:epId/refresh   # 强制重新解析并缓存
POST /api/anime/episode/:epId/download  # 异步下载（m3u8 → mp4）
```

---

## 视频代理接口

服务端代理第三方 m3u8，统一附带 `Referer`/UA 以绕过防盗链/跨域，并支持 Range 拖动。

### 16. 代理 m3u8
```
GET /api/proxy/m3u8?url=<编码后的m3u8地址>&ref=<编码后的referer>
```
- 拉取 m3u8 文本，将其中的**分片地址与嵌套播放列表**改写为指向本服务（`/api/proxy/seg`、`/api/proxy/m3u8`）
- 以响应最终地址为基准解析相对路径，兼容 CDN 重定向
- 返回 `Content-Type: application/vnd.apple.mpegurl`

### 17. 代理分片
```
GET /api/proxy/seg?url=<编码后的分片地址>&ref=<编码后的referer>
```
- 流式转发 .ts/key 等分片，透传 `Content-Type`
- 支持 `Range` 请求（回传 `206 Partial Content` + `Content-Range`），可拖动进度

---

## 使用示例

### JavaScript (Fetch API)

```javascript
// 添加爬取任务
async function addCrawlTask(url, type) {
  const response = await fetch('http://localhost:3000/api/crawl', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ url, type })
  });
  return await response.json();
}

// 获取所有资源
async function getAllResources() {
  const response = await fetch('http://localhost:3000/api/resources');
  return await response.json();
}

// 搜索资源
async function searchResources(keyword) {
  const response = await fetch(`http://localhost:3000/api/search?q=${encodeURIComponent(keyword)}`);
  return await response.json();
}

// 获取统计信息
async function getStats() {
  const response = await fetch('http://localhost:3000/api/stats');
  return await response.json();
}

// 使用示例
addCrawlTask('https://example.com', 'image').then(result => {
  console.log('任务ID:', result.data.id);
});
```

### Python (Requests)

```python
import requests

BASE_URL = 'http://localhost:3000/api'

# 添加爬取任务
def add_crawl_task(url, resource_type):
    response = requests.post(f'{BASE_URL}/crawl', json={
        'url': url,
        'type': resource_type
    })
    return response.json()

# 获取所有资源
def get_all_resources():
    response = requests.get(f'{BASE_URL}/resources')
    return response.json()

# 搜索资源
def search_resources(keyword):
    response = requests.get(f'{BASE_URL}/search', params={'q': keyword})
    return response.json()

# 获取统计信息
def get_stats():
    response = requests.get(f'{BASE_URL}/stats')
    return response.json()

# 使用示例
result = add_crawl_task('https://example.com', 'image')
print(f"任务ID: {result['data']['id']}")
```

### cURL 命令行

```bash
# 添加爬取任务
curl -X POST http://localhost:3000/api/crawl \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","type":"image"}'

# 获取所有资源
curl http://localhost:3000/api/resources

# 根据类型获取资源
curl http://localhost:3000/api/resources/type/image

# 根据状态获取资源
curl http://localhost:3000/api/resources/status/completed

# 搜索资源
curl "http://localhost:3000/api/search?q=example"

# 获取爬取历史
curl "http://localhost:3000/api/history?limit=20&offset=0"

# 获取统计信息
curl http://localhost:3000/api/stats

# 获取下载信息
curl http://localhost:3000/api/download/1

# 删除资源
curl -X DELETE http://localhost:3000/api/resources/1
```

---

## 错误码说明

| HTTP状态码 | 说明 |
|-----------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

## 注意事项

1. **并发限制**: 系统会自动控制爬取任务的并发数量
2. **超时设置**: 单个请求默认超时30秒
3. **数据格式**: 所有日期时间均为本地时间格式
4. **文件大小**: file_size 字段单位为字节
5. **状态更新**: 资源状态会自动更新，建议轮询查询

---

## 更新日志

### v3.1.0 (2026-06-04)
- 新增动漫站点接口文档（检测/爬取/详情/播放/下载）
- 新增视频代理接口（`/api/proxy/m3u8`、`/api/proxy/seg`，支持 Referer/Range）
- `/play` 响应新增 `proxyUrl`/`playPageUrl`/`videoUrlNext`

### v1.0.0 (2024-01-01)
- 基础资源管理接口
- 爬取历史记录
- 统计信息功能
- 下载接口
- 搜索功能
