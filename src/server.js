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
  const animeRoutes = require('./routes/animeRoutes');
  const adminRoutes = require('./routes/adminRoutes');
  const proxyRoutes = require('./routes/proxyRoutes');

  app.use('/', pageRoutes);
  app.use('/api', apiRoutes);
  app.use('/api', animeRoutes);
  app.use('/api', adminRoutes);
  app.use('/api', proxyRoutes);

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

    // 启动每日自动更新调度器
    startDailyCrawlScheduler(db);
    // 启动每日分区增量同步调度器（凌晨 4 点，与每日更新错开）
    startCategorySyncScheduler(db);
  });

  // 优雅退出
  process.on('SIGINT', () => {
    console.log('\n正在关闭服务器...');
    db.close();
    process.exit(0);
  });
}

// 每日自动爬取调度器
function startDailyCrawlScheduler(db) {
  const DEFAULT_SITE = 'https://m.tiantiandongman.com/';
  let lastCrawlDate = '';

  async function tryDailyCrawl() {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const hour = today.getHours();

    // 每天 8-9 点之间触发一次，每天只爬一次
    if (hour === 8 && lastCrawlDate !== dateStr) {
      lastCrawlDate = dateStr;
      console.log(`[每日更新] 开始自动爬取 ${dateStr}...`);
      try {
        const { getCrawler } = require('./crawlers/crawlerRegistry');
        const { crawler, type } = await getCrawler(DEFAULT_SITE);
        if (!crawler) return;

        const { animes, categories } = await crawler.crawlHomepage(true);

        for (const cat of categories) db.getOrCreateCategory(cat.name);
        for (const a of animes) {
          const id = db.upsertAnime({ ...a, siteUrl: DEFAULT_SITE, siteType: type });
          if (a.categoryName) {
            const catId = db.getOrCreateCategory(a.categoryName);
            db.linkAnimeCategory(id, catId);
          }
        }

        // 异步爬详情：复用 animeRoutes 的实现（封面跨CDN保留、状态合并等）
        require('./routes/animeRoutes')._crawlDetailsForScheduler(db, animes, DEFAULT_SITE, type);

        console.log(`[每日更新] 完成！${animes.length} 部今日更新`);
      } catch (e) {
        console.error('[每日更新] 爬取失败:', e.message);
      }
    }
  }

  // 每 30 分钟检查一次
  tryDailyCrawl();
  setInterval(tryDailyCrawl, 30 * 60 * 1000);
}

// 每日分区增量同步调度器：服务进程内复用同一 db 实例，无双写问题
function startCategorySyncScheduler(db) {
  const { syncCategories } = require('./sync/categorySync');
  let lastSyncDate = '';
  let running = false;

  async function trySync() {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    // 每天凌晨 4 点触发一次（与 8 点每日更新错开），每天只跑一次
    if (now.getHours() !== 4 || lastSyncDate === dateStr || running) return;
    lastSyncDate = dateStr;
    running = true;
    console.log(`[分区同步] 开始每日增量同步 ${dateStr}...`);
    try {
      const { totalNew, total } = await syncCategories(db, {
        // 增量：连续 3 页无新增即提前结束该分区（新片集中在前面）
        stopAfterDryPages: 3,
        log: (msg) => console.log('[分区同步] ' + msg)
      });
      console.log(`[分区同步] 完成！新增 ${totalNew} 部，当前总数 ${total} 部`);
    } catch (e) {
      console.error('[分区同步] 失败:', e.message);
    } finally {
      running = false;
    }
  }

  // 每 30 分钟检查一次
  setInterval(trySync, 30 * 60 * 1000);
}

startServer().catch(err => {
  console.error('启动服务器失败:', err);
  process.exit(1);
});
