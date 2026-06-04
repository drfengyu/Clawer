const express = require('express');
const router = express.Router();
const { SiteDetector, SiteType } = require('../crawlers/siteDetector');
const { getCrawler, getCrawlerByType } = require('../crawlers/crawlerRegistry');
const BaseCrawler = require('../crawlers/baseCrawler');

// ─── 站点检测 ──────────────────────────────────────────

router.get('/site/detect', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ success: false, error: '缺少 url 参数' });
    const detector = new SiteDetector();
    const result = await detector.detect(url);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── 爬取首页 ──────────────────────────────────────────

router.post('/anime/crawl', async (req, res) => {
  try {
    const { siteUrl, filterToday = true, crawlDetails = true } = req.body;
    if (!siteUrl) return res.status(400).json({ success: false, error: '缺少 siteUrl 参数' });

    // 检测站点类型并从注册表取爬虫
    const { crawler, type } = await getCrawler(siteUrl);

    if (crawler) {
      // 1) 爬首页卡片
      const { animes, categories, todayCount } = await crawler.crawlHomepage(filterToday);

      // 2) 保存分类
      const db = req.app.locals.db;
      for (const cat of categories) {
        db.getOrCreateCategory(cat.name);
      }

      // 3) 逐卡片 upsert
      const animeIds = [];
      for (const a of animes) {
        const id = db.upsertAnime({ ...a, siteUrl, siteType: type });
        animeIds.push(id);
        // 关联分类
        if (a.categoryName) {
          const catId = db.getOrCreateCategory(a.categoryName);
          db.linkAnimeCategory(id, catId);
        }
      }

      // 4) 异步爬详情页（分集）- 爬全部
      if (crawlDetails && animes.length > 0) {
        crawlDetailsAsync(db, animes, siteUrl, type);
      }

      res.json({ success: true, data: { total: animes.length, todayCount, animeIds, categories } });
    } else if (type === SiteType.COMICAT) {
      // comicat 类型回退到旧逻辑
      const crawler = new BaseCrawler();
      const html = await crawler.fetchPage(siteUrl);
      const magnets = crawler._extractMagnets ? crawler._extractMagnets(html) : [];
      res.json({
        success: true,
        data: { type: 'comicat', magnetCount: magnets.length, message: '请使用通用爬虫入口 POST /api/crawl' }
      });
    } else {
      res.json({
        success: true,
        data: { type: 'generic', message: '请使用通用爬虫入口 POST /api/crawl' }
      });
    }
  } catch (error) {
    console.error('爬取失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 异步爬取详情（分集信息）
async function crawlDetailsAsync(db, animes, siteUrl, siteType) {
  const crawler = getCrawlerByType(siteType, siteUrl);
  for (const a of animes) {
    try {
      const { anime, episodes } = await crawler.crawlDetail(a.detailUrl);
      const existing = db.getAnimeBySourceId(anime.sourceId, siteUrl);

      // 保留首页卡片上的字段（更准确）
      if (existing) {
        // 封面：跨CDN不覆盖
        if (existing.cover && anime.cover) {
          try {
            const existingHost = new URL(existing.cover).host;
            const newHost = new URL(anime.cover).host;
            if (existingHost !== newHost) anime.cover = existing.cover;
          } catch (e) { /* keep new cover */ }
        }
        // 状态：保留首页的（如"更新至05集"），详情页显示的是总数（如"更新至100集"）
        if (existing.status && anime.status) {
          const existNum = parseInt((existing.status.match(/(\d+)/) || [])[1]);
          const newNum = parseInt((anime.status.match(/(\d+)/) || [])[1]);
          // 取数字更小的（更新到第几集 vs 总共多少集）
          if (existNum && newNum && existNum < newNum) anime.status = existing.status;
          else if (!newNum) anime.status = existing.status;
        }
        // 更新日期：保留首页的
        if (existing.update_date) anime.updateDate = existing.update_date;
        // 标题：如果首页标题更短/更干净，保留
        if (existing.title && anime.title && existing.title.length < anime.title.length) {
          anime.title = existing.title;
        }
      }

      const animeId = db.upsertAnime({ ...anime, siteUrl, siteType });

      // 保存分类
      for (const cn of (anime.categoryNames || [])) {
        const catId = db.getOrCreateCategory(cn);
        db.linkAnimeCategory(animeId, catId);
      }

      // 保存分集
      db.deleteAnimeEpisodes(animeId);
      for (const ep of episodes) {
        db.upsertEpisode(animeId, ep);
      }
    } catch (e) {
      console.error(`详情爬取失败 ${a.title}:`, e.message);
    }
  }
}

// ─── 查询 ────────────────────────────────────────────────

router.get('/anime/daily', async (req, res) => {
  try {
    const today = new Date();
    const dateStr = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const animes = req.app.locals.db.getAnimesByUpdateDate(dateStr);

    // 为每个 anime 附加分类和分集数
    const enriched = animes.map(a => {
      const cats = req.app.locals.db.getCategoriesByAnime(a.id);
      const episodes = req.app.locals.db.getEpisodesByAnime(a.id);
      return { ...a, categories: cats, episodeCount: episodes.length };
    });

    res.json({ success: true, data: enriched });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 手动触发推送（联调用）：把今日更新（或最近入库）推到已配置渠道
router.post('/push/test', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const today = new Date();
    const mmdd = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    let items = db.getAnimesByUpdateDate(mmdd);
    if (!items || items.length === 0) {
      items = db.getAllAnimes({ sort: 'created_at', order: 'DESC', limit: 5 });
    }
    items = items.slice(0, Number(req.body && req.body.limit) || 5);
    const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const results = await require('../push').pushDailyUpdate(items, { baseUrl });
    res.json({ success: true, count: items.length, results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/anime/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ success: false, error: '缺少 q 参数' });
    const animes = req.app.locals.db.searchAnimes(q);
    res.json({ success: true, data: animes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/anime/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const anime = req.app.locals.db.getAnimeById(id);
    if (!anime) return res.status(404).json({ success: false, error: '动漫未找到' });
    const categories = req.app.locals.db.getCategoriesByAnime(id);
    const episodes = req.app.locals.db.getEpisodesByAnime(id);

    // 按线路分组
    const lines = {};
    for (const ep of episodes) {
      const key = ep.line_name || '默认线路';
      if (!lines[key]) lines[key] = [];
      lines[key].push(ep);
    }

    res.json({ success: true, data: { ...anime, categories, episodes, lines } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── 播放地址 ──────────────────────────────────────────

// 构造经本服务代理的 m3u8 地址（仅对 m3u8 生效），referer 取播放页 origin
function buildProxyUrl(videoUrl, playUrl) {
  if (!videoUrl || !/\.m3u8(\?|$)/i.test(videoUrl)) return '';
  let ref = '';
  try { ref = new URL(playUrl).origin; } catch (e) { /* playUrl 缺失/非法则不带 referer */ }
  let s = '/api/proxy/m3u8?url=' + encodeURIComponent(videoUrl);
  if (ref) s += '&ref=' + encodeURIComponent(ref);
  return s;
}

router.get('/anime/episode/:epId/play', async (req, res) => {
  try {
    const { epId } = req.params;
    const episode = req.app.locals.db.getEpisodeById(epId);
    if (!episode) return res.status(404).json({ success: false, error: '分集未找到' });

    // 有缓存直接返回
    if (episode.video_url) {
      return res.json({ success: true, data: {
        videoUrl: episode.video_url,
        proxyUrl: buildProxyUrl(episode.video_url, episode.play_url),
        playPageUrl: episode.play_url || '',
        videoUrlNext: episode.video_url_next || '',
        cached: true
      } });
    }

    // 实时解析
    if (!episode.play_url) return res.status(400).json({ success: false, error: '无播放页地址' });

    const anime = req.app.locals.db.getAnimeById(episode.anime_id);
    if (!anime) return res.status(404).json({ success: false, error: '动漫未找到' });

    const crawler = getCrawlerByType(anime.site_type, anime.site_url);
    const { videoUrl, videoUrlNext } = await crawler.crawlPlayUrl(episode.play_url);

    // 缓存到数据库
    req.app.locals.db.updateEpisodeVideoUrl(epId, videoUrl, videoUrlNext);

    res.json({ success: true, data: {
      videoUrl,
      proxyUrl: buildProxyUrl(videoUrl, episode.play_url),
      playPageUrl: episode.play_url || '',
      videoUrlNext: videoUrlNext || '',
      cached: false
    } });
  } catch (error) {
    console.error('获取播放地址失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/anime/episode/:epId/refresh', async (req, res) => {
  try {
    const { epId } = req.params;
    const episode = req.app.locals.db.getEpisodeById(epId);
    if (!episode || !episode.play_url) {
      return res.status(400).json({ success: false, error: '无播放页地址' });
    }
    const anime = req.app.locals.db.getAnimeById(episode.anime_id);
    const crawler = getCrawlerByType(anime.site_type, anime.site_url);
    const { videoUrl, videoUrlNext } = await crawler.crawlPlayUrl(episode.play_url);
    req.app.locals.db.updateEpisodeVideoUrl(epId, videoUrl, videoUrlNext);
    res.json({ success: true, data: { videoUrl, videoUrlNext: videoUrlNext || '' } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── 下载 ────────────────────────────────────────────────

router.post('/anime/episode/:epId/download', async (req, res) => {
  try {
    const { epId } = req.params;
    const episode = req.app.locals.db.getEpisodeById(epId);
    if (!episode) return res.status(404).json({ success: false, error: '分集未找到' });

    // 先确保有 video url
    let videoUrl = episode.video_url;
    if (!videoUrl) {
      const anime = req.app.locals.db.getAnimeById(episode.anime_id);
      const crawler = getCrawlerByType(anime.site_type, anime.site_url);
      const result = await crawler.crawlPlayUrl(episode.play_url);
      videoUrl = result.videoUrl;
      req.app.locals.db.updateEpisodeVideoUrl(epId, result.videoUrl, result.videoUrlNext || '');
    }

    // 提交异步下载
    req.app.locals.db.updateEpisodeDownloadStatus(epId, 'downloading');
    submitDownloadJob(req.app.locals, epId, videoUrl);

    res.json({ success: true, data: { message: '下载任务已提交', episodeId: parseInt(epId) } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

async function submitDownloadJob(locals, epId, videoUrl) {
  const { db, downloader } = locals;
  try {
    const result = await downloader.downloadM3u8(videoUrl, 'video', `ep_${epId}`);
    if (result.success) {
      db.updateEpisodeDownloadStatus(epId, 'completed', result.filepath);
    } else {
      db.updateEpisodeDownloadStatus(epId, 'failed');
    }
  } catch (e) {
    db.updateEpisodeDownloadStatus(epId, 'failed');
  }
}

// ─── 分类 ────────────────────────────────────────────────

router.get('/categories', async (req, res) => {
  try {
    const cats = req.app.locals.db.getAllCategories();
    res.json({ success: true, data: cats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
// 共享给 server.js 调度器，避免重复实现详情爬取逻辑
module.exports._crawlDetailsForScheduler = crawlDetailsAsync;
