const express = require('express');
const router = express.Router();
const MaccmsCrawler = require('../crawlers/maccmsCrawler');
const { getCrawlerByType } = require('../crawlers/crawlerRegistry');

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

    // 入库：已存在的动漫保留其原有数据（每日更新信息、简介、分集等），
    // 仅为新动漫插入基础记录以便点进详情页
    const enriched = [];
    for (const a of animes) {
      let dbAnime = req.app.locals.db.getAnimeBySourceId(a.sourceId, DEFAULT_SITE);
      if (!dbAnime) {
        // 新动漫：插入基础信息，update_date 留空（非每日更新）
        const id = req.app.locals.db.upsertAnime({
          ...a, siteUrl: DEFAULT_SITE, siteType: 'maccms', updateDate: ''
        });
        dbAnime = { id };
      }
      enriched.push({ ...a, id: dbAnime.id });
    }

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
    // 今天没有更新时，回退到最近一次更新日期的动漫（而非全部）
    if (animes.length === 0) {
      const latestDate = req.app.locals.db.getLatestUpdateDate();
      if (latestDate) {
        animes = req.app.locals.db.getAnimesByUpdateDate(latestDate);
      }
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
    let anime = req.app.locals.db.getAnimeById(req.params.id);
    if (!anime) return res.status(404).render('error', { error: '动漫未找到' });

    let episodes = req.app.locals.db.getEpisodesByAnime(anime.id);

    // 按需爬取详情：缺少分集或简介时补全（分类浏览来源 / 早期数据缺失）
    if ((episodes.length === 0 || !anime.description || !anime.meta) && anime.detail_url) {
      try {
        const crawler = getCrawlerByType(anime.site_type, anime.site_url || DEFAULT_SITE);
        const { anime: detail, episodes: eps } = await crawler.crawlDetail(anime.detail_url);
        // 保留首页已有的封面/状态/更新日期
        if (anime.cover) detail.cover = anime.cover;
        if (anime.status) detail.status = anime.status;
        detail.updateDate = anime.update_date || '';
        req.app.locals.db.upsertAnime({ ...detail, siteUrl: anime.site_url || DEFAULT_SITE, siteType: anime.site_type || 'maccms' });
        for (const cn of (detail.categoryNames || [])) {
          const cid = req.app.locals.db.getOrCreateCategory(cn);
          req.app.locals.db.linkAnimeCategory(anime.id, cid);
        }
        for (const ep of eps) req.app.locals.db.upsertEpisode(anime.id, ep);
        // 重新读取
        anime = req.app.locals.db.getAnimeById(req.params.id);
        episodes = req.app.locals.db.getEpisodesByAnime(anime.id);
      } catch (e) { /* 爬取失败则展示现有数据 */ }
    }

    const categories = req.app.locals.db.getCategoriesByAnime(anime.id);

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

    // 查找前后集：限定在当前线路内，按集号排序（避免跨线路串集）
    const allEps = req.app.locals.db.getEpisodesByAnime(episode.anime_id);
    const sameLine = allEps
      .filter(e => (e.line_name || '默认线路') === (episode.line_name || '默认线路'))
      .sort((a, b) => a.ep_number - b.ep_number);
    const curIdx = sameLine.findIndex(e => e.id === parseInt(req.params.epId));
    const prevEp = curIdx > 0 ? sameLine[curIdx - 1] : null;
    const nextEp = curIdx >= 0 && curIdx < sameLine.length - 1 ? sameLine[curIdx + 1] : null;

    // 同一集号、不同线路的分集，供播放页"线路切换"
    const siblingLines = allEps
      .filter(e => e.ep_number === episode.ep_number)
      .map(e => ({ lineName: e.line_name || '默认线路', epId: e.id }));

    res.render('player', {
      title: `${anime.title} - 第${String(episode.ep_number).padStart(2, '0')}集`,
      anime,
      episode,
      prevEp,
      nextEp,
      nextEpId: nextEp ? nextEp.id : null,
      siblingLines
    });
  } catch (error) {
    res.status(500).render('error', { error: error.message });
  }
});

// 数据库后台（只读浏览）
router.get('/admin', (req, res) => {
  res.render('admin', { title: '数据库后台' });
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
