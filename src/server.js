require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const Database = require('./database/db');
const Downloader = require('./utils/downloader');

const app = express();
const PORT = process.env.PORT || 3000;

// 异步初始化
async function startServer() {
  // 初始化数据库
  const db = new Database(process.env.DB_PATH || './database.db');
  await db.ready;

  const downloader = new Downloader(process.env.DOWNLOAD_PATH || './downloads');

  // 将数据库和下载器挂载到 app.locals
  app.locals.db = db;
  app.locals.downloader = downloader;

  // 中间件
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, '../public')));
  app.use('/downloads', express.static(path.join(__dirname, '../downloads')));

  // 设置模板引擎
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '../views'));

  // 路由
  const pageRoutes = require('./routes/pages');
  const apiRoutes = require('./routes/api');

  app.use('/', pageRoutes);
  app.use('/api', apiRoutes);

  // 404 处理
  app.use((req, res) => {
    res.status(404).render('error', { error: '页面不存在' });
  });

  // 错误处理
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', { error: '服务器错误' });
  });

  // 启动服务器
  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║   🚀 媒体资源爬虫管理系统                            ║
║                                                       ║
║   服务器运行在: http://localhost:${PORT}              ║
║   环境: ${process.env.NODE_ENV || 'development'}                             ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
    `);
  });

  // 优雅退出
  process.on('SIGINT', () => {
    console.log('\n正在关闭服务器...');
    db.close();
    process.exit(0);
  });
}

startServer().catch(err => {
  console.error('启动服务器失败:', err);
  process.exit(1);
});
