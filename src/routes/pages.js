const express = require('express');
const router = express.Router();
const MaccmsCrawler = require('../crawlers/maccmsCrawler');

// 四大分区配置
const CATEGORY_MAP = {
  '日漫': '/h/1/',
  '国漫': '/h/2/',
  '美漫': '/h/3/',
  '动漫剧场': '/h/20/'
};
const DEFAULT_SITE = 'https://m.tiantiandongman.com/';

// 首页 → 重定向到画廊
router.get('/', (req, res) => {
  res.redirect('/gallery');
});

// 分类浏览页
router.get('/category/:name', async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const path = CATEGORY_MAP[name];
    if (!path) return res.status(404).render('error', { error: '无效的分类' });

    const crawler = new MaccmsCrawler(DEFAULT_SITE);
    const { animes } = await crawler.crawlCategory(DEFAULT_SITE.replace(/\/$/, '') + path);

    // 同步入库（便于点进详情页）
    for (const a of animes) {
      req.app.locals.db.upsertAnime({ ...a, siteUrl: DEFAULT_SITE });
    }

    // 取回带 id 的记录
    const enriched = animes.map(a => {
      const dbAnime = req.app.locals.db.getAnimeBySourceId(a.sourceId, DEFAULT_SITE);
      return { ...a, id: dbAnime ? dbAnime.id : null };
    }).filter(a => a.id);

    res.render('category', {
      title: name + ' - 动漫分区',
      categoryName: name,
      animes: enriched,
      categories: Object.keys(CATEGORY_MAP)
    });
  } catch (error) {
    res.status(500).render('error', { error: error.message });
  }
});

// B站风格画廊首页
router.get('/gallery', async (req, res) => {
  try {
    const dateStr = `${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
    let animes = req.app.locals.db.getAnimesByUpdateDate(dateStr);
    // 今天没有更新时回退到全部（首次使用或站点未更新）
    if (animes.length === 0) {
      animes = req.app.locals.db.getAllAnimes({ sort: 'updated_at', limit: 50 });
    }
    // 只保留有效分类（白名单）
    const VALID_CATS = ['日漫', '国漫', '美漫', '动漫剧场'];
    let categories = req.app.locals.db.getAllCategories();
    categories = categories.filter(c => VALID_CATS.includes(c.name));

    // 为每个 anime 附加分类（同样过滤）
    const enriched = animes.map(a => ({
      ...a,
      categories: req.app.locals.db.getCategoriesByAnime(a.id).filter(c => VALID_CATS.includes(c.name))
    }));

    res.render('gallery', {
      title: '动漫资源画廊',
      animes: enriched,
      categories,
      menuCategories: Object.keys(CATEGORY_MAP),
      today: dateStr
    });
  } catch (error) {
    res.status(500).render('error', { error: error.message });
  }
});

// 动漫详情页
router.get('/anime/:id', async (req, res) => {
  try {
    const anime = req.app.locals.db.getAnimeById(req.params.id);
    if (!anime) return res.status(404).render('error', { error: '动漫未找到' });

    const categories = req.app.locals.db.getCategoriesByAnime(anime.id);
    const episodes = req.app.locals.db.getEpisodesByAnime(anime.id);

    // 按线路分组
    const lines = {};
    for (const ep of episodes) {
      const key = ep.line_name || '默认线路';
      if (!lines[key]) lines[key] = [];
      lines[key].push(ep);
    }

    // 从状态中解析当天更新的集数（如 "更新至05集" → 5）
    let latestEp = 0;
    const m = (anime.status || '').match(/(\d+)\s*集/);
    if (m) latestEp = parseInt(m[1]);

    // 解析元数据 JSON
    let meta = {};
    try { meta = JSON.parse(anime.meta || '{}'); } catch (e) { }

    res.render('detail', {
      title: anime.title,
      anime: { ...anime, categories },
      meta,
      lines,
      episodes,
      latestEp
    });
  } catch (error) {
    res.status(500).render('error', { error: error.message });
  }
});

// 播放页
router.get('/play/:epId', async (req, res) => {
  try {
    const episode = req.app.locals.db.getEpisodeById(req.params.epId);
    if (!episode) return res.status(404).render('error', { error: '分集未找到' });

    const anime = req.app.locals.db.getAnimeById(episode.anime_id);
    if (!anime) return res.status(404).render('error', { error: '动漫未找到' });

    // 查找前后集
    const allEps = req.app.locals.db.getEpisodesByAnime(episode.anime_id);
    const sorted = allEps.sort((a, b) => a.ep_number - b.ep_number);
    const curIdx = sorted.findIndex(e => e.id === parseInt(req.params.epId));
    const prevEp = curIdx > 0 ? sorted[curIdx - 1] : null;
    const nextEp = curIdx < sorted.length - 1 ? sorted[curIdx + 1] : null;

    res.render('player', {
      title: `${anime.title} - 第${String(episode.ep_number).padStart(2, '0')}集`,
      anime,
      episode,
      prevEp,
      nextEp
    });
  } catch (error) {
    res.status(500).render('error', { error: error.message });
  }
});

// 旧的资源列表
router.get('/resources', async (req, res) => {
  try {
    const all = await req.app.locals.db.getAllResources();
    const resources = all.filter(r => r.status === 'completed').slice(0, 1);
    res.render('resources', { title: '资源列表', resources });
  } catch (error) {
    res.status(500).render('error', { error: error.message });
  }
});

module.exports = router;
