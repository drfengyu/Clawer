// RSS 订阅源路由（只读）：把每日更新 / 分区动漫输出为标准 RSS 2.0
const express = require('express');
const router = express.Router();
const { buildRssXml } = require('../feed/rss');

// 站点对外基址：优先 .env PUBLIC_BASE_URL，否则按请求推断
function baseUrlOf(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

function sendRss(res, xml) {
  res.type('application/rss+xml; charset=utf-8').send(xml);
}

// GET /rss —— 每日更新订阅源（无当日数据时回退到最近入库的动漫）
router.get('/rss', (req, res) => {
  try {
    const db = req.app.locals.db;
    const baseUrl = baseUrlOf(req);
    const today = new Date();
    const mmdd = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    let items = db.getAnimesByUpdateDate(mmdd);
    if (!items || items.length === 0) {
      items = db.getAllAnimes({ sort: 'created_at', order: 'DESC', limit: 50 });
    }
    const xml = buildRssXml(items, {
      baseUrl,
      title: '动漫每日更新',
      description: '每日更新动漫订阅源',
      selfUrl: `${baseUrl}/rss`,
    });
    sendRss(res, xml);
  } catch (err) {
    res.status(500).type('text/plain').send('RSS 生成失败: ' + err.message);
  }
});

// GET /rss/category/:name —— 分区订阅源
router.get('/rss/category/:name', (req, res) => {
  try {
    const db = req.app.locals.db;
    const baseUrl = baseUrlOf(req);
    const name = req.params.name;
    const items = db.getAllAnimes({ category: name, sort: 'update_date', order: 'DESC', limit: 50 });
    const xml = buildRssXml(items, {
      baseUrl,
      title: `动漫更新 · ${name}`,
      description: `${name} 分区动漫订阅源`,
      selfUrl: `${baseUrl}/rss/category/${encodeURIComponent(name)}`,
    });
    sendRss(res, xml);
  } catch (err) {
    res.status(500).type('text/plain').send('RSS 生成失败: ' + err.message);
  }
});

module.exports = router;
