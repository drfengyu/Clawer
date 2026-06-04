# API 快速参考

## 基础信息

**Base URL**: `http://localhost:3000/api`

## 快速开始

### 1. 添加爬取任务
```bash
curl -X POST http://localhost:3000/api/crawl \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","type":"image"}'
```

### 2. 查看所有资源
```bash
curl http://localhost:3000/api/resources
```

### 3. 搜索资源
```bash
curl "http://localhost:3000/api/search?q=关键词"
```

### 4. 查看统计
```bash
curl http://localhost:3000/api/stats
```

### 5. 查看历史
```bash
curl http://localhost:3000/api/history
```

## 所有接口

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/resources` | 获取所有资源 |
| GET | `/api/resources/:id` | 根据ID获取资源 |
| GET | `/api/resources/type/:type` | 根据类型获取 (image/video/audio) |
| GET | `/api/resources/status/:status` | 根据状态获取 (pending/processing/completed/failed) |
| GET | `/api/search?q=keyword` | 搜索资源 |
| POST | `/api/crawl` | 添加爬取任务 |
| DELETE | `/api/resources/:id` | 删除资源 |
| GET | `/api/history?limit=50&offset=0` | 获取爬取历史 |
| GET | `/api/stats` | 获取统计信息 |
| GET | `/api/download/:id` | 获取下载信息 |

### 动漫 / 播放 / 代理

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/site/detect?url=` | 站点类型检测 |
| POST | `/api/anime/crawl` | 爬取每日更新 |
| GET | `/api/anime/daily` | 每日更新列表 |
| GET | `/api/anime/:id` | 动漫详情（含分集） |
| GET | `/api/anime/search?q=` | 搜索动漫 |
| GET | `/api/anime/episode/:epId/play` | 解析播放地址（返回直连/代理地址） |
| POST | `/api/anime/episode/:epId/refresh` | 刷新播放地址 |
| POST | `/api/anime/episode/:epId/download` | 下载分集（m3u8→mp4） |
| GET | `/api/categories` | 分类列表 |
| GET | `/api/proxy/m3u8?url=&ref=` | 代理 m3u8（改写分片/嵌套列表） |
| GET | `/api/proxy/seg?url=&ref=` | 代理分片（支持 Range 拖动） |

## JavaScript 示例

```javascript
// 添加任务
const response = await fetch('http://localhost:3000/api/crawl', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: 'https://example.com', type: 'image' })
});
const data = await response.json();

// 获取资源
const resources = await fetch('http://localhost:3000/api/resources');
const list = await resources.json();

// 搜索
const search = await fetch('http://localhost:3000/api/search?q=example');
const results = await search.json();
```

## Python 示例

```python
import requests

# 添加任务
response = requests.post('http://localhost:3000/api/crawl', json={
    'url': 'https://example.com',
    'type': 'image'
})

# 获取资源
resources = requests.get('http://localhost:3000/api/resources')

# 搜索
results = requests.get('http://localhost:3000/api/search', params={'q': 'example'})
```

## 状态码

- `200` - 成功
- `400` - 请求参数错误
- `404` - 资源不存在
- `500` - 服务器错误

## 在线测试

访问 http://localhost:3000/api-demo.html 在浏览器中测试所有API

完整文档: [API.md](./API.md)
