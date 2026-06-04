/**
 * 批量同步源站各分区目录到本地数据库（仅目录级：标题/封面/评分/状态/详情链接 + 分区归类）。
 * 分集与播放地址不在此抓取——详情页打开时按需补全（见 routes/pages.js）。
 *
 * 用法：
 *   node scripts/syncCategories.js            # 抓全部分区全部页
 *   node scripts/syncCategories.js 5          # 每个分区最多抓 5 页（调试/限量）
 *
 * 注意：sql.js 为整库内存镜像，运行期间必须独占数据库——请先停掉正在运行的服务，
 *       跑完再重启，避免两个进程互相覆盖。
 */
const path = require('path');
const Db = require('../src/database/db');
const MaccmsCrawler = require('../src/crawlers/maccmsCrawler');

const SITE = 'https://m.tiantiandongman.com';
// 与既有数据一致：site_url 带尾斜杠，才能正确去重而非新建重复
const SITE_KEY = 'https://m.tiantiandongman.com/';
const CATS = { '日漫': 1, '国漫': 2, '美漫': 3, '动漫剧场': 20 };

const maxPages = parseInt(process.argv[2] || '0') || Infinity; // 0/缺省 = 全部
const DELAY_MS = 250; // 翻页间隔，对源站友好

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// 把 _parseCards 的输出归一化为 upsert 所需结构
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

async function main() {
  const db = new Db(path.join(__dirname, '..', 'database.db'));
  await db.ready;

  // 关键优化：upsert/分类/关联每次都会 save() 整库；这里抑制逐条保存，改为每页 flush 一次
  const realSave = db.save.bind(db);
  db.save = () => {};

  const crawler = new MaccmsCrawler(SITE);
  const summary = {};
  let grandNew = 0, grandSeen = 0;

  for (const [name, id] of Object.entries(CATS)) {
    const catId = db.getOrCreateCategory(name);
    let pages = 1, added = 0, linked = 0;

    // 第 1 页：同时取总页数
    try {
      const first = await fetchCatPage(crawler, `${SITE}/h/${id}/`);
      pages = Math.min(first.totalPages, maxPages);
      processCards(db, first.cards, catId, () => added++, () => linked++);
      realSave();
      console.log(`[${name}] 共 ${first.totalPages} 页${pages < first.totalPages ? `（限抓 ${pages} 页）` : ''}，第 1 页 ✓`);
    } catch (e) {
      console.error(`[${name}] 第 1 页失败：${e.message}`);
      continue;
    }

    for (let p = 2; p <= pages; p++) {
      await sleep(DELAY_MS);
      try {
        const { cards } = await fetchCatPage(crawler, `${SITE}/h/${id}-${p}/`);
        processCards(db, cards, catId, () => added++, () => linked++);
        realSave();
        if (p % 10 === 0 || p === pages) console.log(`[${name}] 第 ${p}/${pages} 页 ✓（新增累计 ${added}）`);
      } catch (e) {
        console.error(`[${name}] 第 ${p} 页失败：${e.message}`);
      }
    }

    summary[name] = { pages, added, linked };
    grandNew += added; grandSeen += linked;
    console.log(`[${name}] 完成：新增 ${added} 部，归类 ${linked} 部\n`);
  }

  realSave();

  console.log('========== 同步汇总 ==========');
  for (const [name, s] of Object.entries(summary)) {
    console.log(`${name}: ${s.pages} 页，新增 ${s.added}，归类 ${s.linked}`);
  }
  const total = db.db.exec('SELECT COUNT(*) FROM animes')[0].values[0][0];
  console.log(`本次新增 ${grandNew} 部；当前库内动漫总数：${total} 部`);
}

// 只对新片 INSERT，已存在的仅补分区关联（保护每日更新日期/已爬简介不被清空）
function processCards(db, cards, catId, onAdd, onLink) {
  for (const c of cards) {
    if (!c.sourceId) continue;
    let row = db.getAnimeBySourceId(c.sourceId, SITE_KEY);
    let animeId;
    if (!row) {
      animeId = db.upsertAnime({ ...c, siteUrl: SITE_KEY, siteType: 'maccms', updateDate: '' });
      onAdd();
    } else {
      animeId = row.id;
    }
    db.linkAnimeCategory(animeId, catId);
    onLink();
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
