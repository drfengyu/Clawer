# 使用说明

## 🚀 快速开始

### 1. 启动服务器

```bash
npm start
```

服务器将在 `http://localhost:3000` 启动

### 2. 访问系统

打开浏览器访问：
- 首页：http://localhost:3000
- 资源列表：http://localhost:3000/resources

## 📖 使用教程

### 添加爬取任务

1. 在首页输入要爬取的网页 URL
2. 选择资源类型（图片/视频/音频）
3. 点击"开始爬取"按钮
4. 系统会自动跳转到资源列表页面

### 查看和下载资源

1. 进入"资源列表"页面
2. 查看已爬取的资源状态：
   - **pending**: 等待处理
   - **processing**: 正在处理
   - **completed**: 完成
   - **failed**: 失败
3. 对于完成的资源，点击"下载"按钮即可下载到本地
4. 不需要的资源可以点击"删除"按钮删除

### 本地文件存储

下载的文件会自动保存在 `downloads` 目录下，按类型分类：
- `downloads/image/` - 图片文件
- `downloads/video/` - 视频文件
- `downloads/audio/` - 音频文件

## 🎯 示例网站（测试用）

可以尝试爬取以下免费资源网站：

### 图片
- Unsplash: https://unsplash.com/photos/[任意图片ID]
- Pexels: https://www.pexels.com/photo/[任意图片ID]
- Pixabay: https://pixabay.com/

### 音频
- FreeSound: https://freesound.org/
- ccMixter: http://ccmixter.org/
- Jamendo: https://www.jamendo.com/

### 视频
- Archive.org: https://archive.org/details/movies
- Pexels Videos: https://www.pexels.com/videos/

## ⚙️ 配置

编辑 `.env` 文件可以修改配置：

```env
PORT=3000                    # 服务器端口
DOWNLOAD_PATH=./downloads    # 下载目录
DB_PATH=./database.db        # 数据库文件路径
```

## 🛠️ 开发模式

使用 nodemon 自动重启服务器：

```bash
npm run dev
```

## ⚠️ 注意事项

1. **合法使用**：仅爬取公开的免费资源
2. **遵守 robots.txt**：尊重网站的爬虫协议
3. **控制频率**：避免频繁请求给目标网站造成压力
4. **版权意识**：下载的资源仅供个人学习使用

## 🔧 故障排查

### 端口被占用
如果 3000 端口被占用，修改 `.env` 文件中的 PORT 值

### 爬取失败
1. 检查 URL 是否正确
2. 某些网站可能有反爬虫机制
3. 确保目标网页包含对应类型的媒体资源

### 下载失败
1. 检查网络连接
2. 某些资源可能需要特殊的访问权限
3. 查看控制台错误日志

## 📝 API 接口

### 获取所有资源
```
GET /api/resources
```

### 添加爬取任务
```
POST /api/crawl
Content-Type: application/json

{
  "url": "https://example.com",
  "type": "image"
}
```

### 删除资源
```
DELETE /api/resources/:id
```

## 🌟 功能扩展

未来可以添加的功能：
- [ ] 批量爬取
- [ ] 定时任务
- [ ] 更多网站适配器
- [ ] 资源预览
- [ ] 搜索和过滤
- [ ] 用户认证
- [ ] 爬取历史统计

## 📄 许可证

MIT License - 仅用于学习和研究目的
