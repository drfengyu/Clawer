/**
 * 分区目录同步核心：遍历源站各分区分页，目录级 upsert + 分区归类。
 * 接收外部传入的 db 实例 —— 服务进程内调用时必须复用同一个实例，
 * 避免 sql.js 整库镜像被双进程互相覆盖。
 *
 * 分集/播放地址不在此抓取（详情页按需补全，见 routes/pages.js）。
 */
const MaccmsCrawler = require('../crawlers/maccmsCrawler');

const SITE = 'https://m.tiantiandongman.com';
// 与既有数据一致：site_url 带尾斜杠，才能正确去重而非新建重复
const SITE_KEY = 'https://m.tiantiandongman.com/';
const CATS = { '日漫': 1, '国漫': 2, '美漫': 3, '动漫剧场': 20 };

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function normalize(card) {
  return {
    sourceId: card.sourceId != null ? card.sourceId : card.id,
    title: card.title,
    cover: card.cover,
    score: card.score,
    status: card.status,
    detailUrl: card.detailUrl
  };
}

async function fetchCatPage(crawler, url) {
  const html = await crawler.fetchPage(url);
  const $ = crawler.parseHTML(html);
  const cards = crawler._parseCards($).map(normalize);
  const m = html.match(/共\s*\d+\s*\/\s*(\d+)\s*页/);
  return { cards, totalPages: m ? parseInt(m[1]) : 1 };
}

// 只对新片 INSERT，已存在的仅补分区关联（保护每日更新日期/已爬简介不被清空）
function processCards(db, cards, catId) {
  let added = 0, linked = 0;
  for (const c of cards) {
    if (!c.sourceId) continue;
    const row = db.getAnimeBySourceId(c.sourceId, SITE_KEY);
    let animeId;
    if (!row) {
      animeId = db.upsertAnime({ ...c, siteUrl: SITE_KEY, siteType: 'maccms', updateDate: '' });
      added++;
    } else {
      animeId = row.id;
    }
    db.linkAnimeCategory(animeId, catId);
    linked++;
  }
  return { added, linked };
}

/**
 * @param {object} db          已 ready 的数据库实例
 * @param {object} [opts]
 * @param {number} [opts.maxPages=Infinity]   每分区最多抓多少页
 * @param {number} [opts.stopAfterDryPages=0] 连续 N 页 0 新增即提前结束该分区（增量用，0=不提前停）
 * @param {number} [opts.delayMs=250]         翻页间隔
 * @param {function} [opts.log]               进度回调 (msg)
 * @returns {Promise<{perCat:object, totalNew:number, total:number}>}
 */
async function syncCategories(db, opts = {}) {
  const { maxPages = Infinity, stopAfterDryPages = 0, delayMs = 250, log = () => {} } = opts;

  // 抑制逐条 save()（upsert/分类/关联每次都会整库写盘），改为每页 flush 一次
  const realSave = db.save.bind(db);
  db.save = () => {};

  const crawler = new MaccmsCrawler(SITE);
  const perCat = {};
  let totalNew = 0;

  try {
    for (const [name, id] of Object.entries(CATS)) {
      const catId = db.getOrCreateCategory(name);
      let pages = 1, added = 0, linked = 0, dry = 0;

      try {
        const first = await fetchCatPage(crawler, `${SITE}/h/${id}/`);
        pages = Math.min(first.totalPages, maxPages);
        const r = processCards(db, first.cards, catId);
        added += r.added; linked += r.linked;
        realSave();
        log(`[${name}] 共 ${first.totalPages} 页${pages < first.totalPages ? `（限 ${pages} 页）` : ''}，第 1 页 ✓（新增 ${r.added}）`);
      } catch (e) {
        log(`[${name}] 第 1 页失败：${e.message}`);
        perCat[name] = { pages: 0, added: 0, linked: 0 };
        continue;
      }

      for (let p = 2; p <= pages; p++) {
        await sleep(delayMs);
        try {
          const { cards } = await fetchCatPage(crawler, `${SITE}/h/${id}-${p}/`);
          const r = processCards(db, cards, catId);
          added += r.added; linked += r.linked;
          realSave();
          if (p % 10 === 0 || p === pages) log(`[${name}] 第 ${p}/${pages} 页 ✓（新增累计 ${added}）`);
          // 增量模式：连续多页无新增则提前结束（新片都集中在前面）
          if (stopAfterDryPages > 0) {
            dry = r.added === 0 ? dry + 1 : 0;
            if (dry >= stopAfterDryPages) { log(`[${name}] 连续 ${dry} 页无新增，提前结束`); break; }
          }
        } catch (e) {
          log(`[${name}] 第 ${p} 页失败：${e.message}`);
        }
      }

      perCat[name] = { pages, added, linked };
      totalNew += added;
      log(`[${name}] 完成：新增 ${added} 部，归类 ${linked} 部`);
    }
  } finally {
    // 恢复正常 save 行为并最终落盘
    db.save = realSave;
    db.save();
  }

  const total = db.db.exec('SELECT COUNT(*) FROM animes')[0].values[0][0];
  return { perCat, totalNew, total };
}

module.exports = { syncCategories, SITE, SITE_KEY, CATS };
