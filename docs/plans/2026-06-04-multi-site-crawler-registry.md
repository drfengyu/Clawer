# 多站点地基重构：爬虫注册表 + site_type 落库 + 播放路由去硬编码

## Context（背景与目标）

当前爬虫架构已分层（`BaseCrawler` 通用能力 / `MaccmsCrawler` 站点解析 / `SiteDetector` 识别），归一化数据结构（anime + episodes）也已是事实契约。但"多站点"还没打通，存在 3 处硬编码阻碍扩展：

1. 站点分派是散落的 `if (type === MACCMS) … else if (COMICAT) …`，且 `server.js` 调度器里把默认站点 + maccms 又写死一遍，并内联了一份与 `animeRoutes.js` 重复的 `crawlDetailsAsync`（`server.js:112` 已预留 `_crawlDetailsForScheduler` 钩子却回退到内联副本）。
2. `animes` 表只有 `site_url`，没记录"这条数据由哪个爬虫产出"。
3. 播放/刷新/下载路由把 `new MaccmsCrawler(anime.site_url)` 写死（`animeRoutes.js:209/230/251`）——换站点就解析不出播放地址。

目标：用**注册表 + 工厂**收敛分派，把 `site_type` 落库，并让播放相关路由按 `site_type` 取爬虫。改动小、向后兼容，之后加同类站点 = 写个类 + 登记 + 加检测签名，无需再改路由。**本次不做** maccms 选择器的配置化抽取，也不动资源种类/数据模型（留作后续）。

## 现状关键事实

- `SiteType`（`siteDetector.js`）：`MACCMS='maccms'`、`COMICAT='comicat'`、`GENERIC='generic'`、`UNKNOWN='unknown'`。
- 爬虫契约方法：`crawlHomepage` / `crawlCategory` / `crawlDetail(detailUrl)` / `crawlPlayUrl(playUrl)`。
- 归一化结构：anime `{sourceId,title,cover,score,status,description,detailUrl,categoryNames,meta,updateDate}`；episodes `[{lineName,epNumber,label,playUrl}]`。
- `upsertAnime(data)`（`db.js:384`）：INSERT/UPDATE 显式列；所有调用点：`animeRoutes.js`（首页卡片、详情）、`pages.js`（分类、详情按需爬取）、`server.js`（调度器内联）。
- sql.js 支持 `ALTER TABLE ADD COLUMN` 与 `PRAGMA table_info`（后台 API 已用）。
- 后台 `animes` 表在白名单内，新增列会自动显示，无需改后台。

## 实现方案

### 1. 新增爬虫注册表/工厂 — `src/crawlers/crawlerRegistry.js`（新文件）

```js
const { SiteDetector, SiteType } = require('./siteDetector');
const MaccmsCrawler = require('./maccmsCrawler');

// SiteType -> 实现了 anime 契约的爬虫类。新增同类站点只需在此登记。
const REGISTRY = { [SiteType.MACCMS]: MaccmsCrawler };

// 联网探测站点类型并构造爬虫；不支持的类型 crawler 为 null。
async function getCrawler(siteUrl, detector) {
  const det = detector || new SiteDetector();
  const { type } = await det.detect(siteUrl);
  const Cls = REGISTRY[type];
  return { crawler: Cls ? new Cls(siteUrl) : null, type };
}

// 按已知 site_type 直接构造（不联网）。空/未知回退 maccms，保证旧数据兼容。
function getCrawlerByType(siteType, siteUrl) {
  const Cls = REGISTRY[siteType] || REGISTRY[SiteType.MACCMS];
  return new Cls(siteUrl);
}

function isSupportedType(type) { return !!REGISTRY[type]; }

module.exports = { getCrawler, getCrawlerByType, isSupportedType, REGISTRY };
```

### 2. `animes` 表加 `site_type` 列 + 迁移 — `src/database/db.js`

- `_getAnimeTableDDL()` 的建表语句加 `site_type TEXT DEFAULT ''`（新库直接带列）。
- 在 `initTables()` 建表后新增 `this._migrate()`：用 `PRAGMA table_info(animes)` 检查是否已有 `site_type`，没有则 `ALTER TABLE animes ADD COLUMN site_type TEXT DEFAULT ''`，并回填 `UPDATE animes SET site_type='maccms' WHERE site_type IS NULL OR site_type=''`（现有 12 行均来自天天动漫 = maccms）。
- `upsertAnime(data)`：
  - INSERT 列表加 `site_type`，值 `data.siteType || ''`。
  - UPDATE 用 `site_type = COALESCE(NULLIF(?, ''), site_type)`——传空则保留原值，避免某调用点漏传把列清空（防 footgun）。

### 3. `animeRoutes.js` 改用注册表 + 落库 site_type

- 顶部 `const { getCrawler, getCrawlerByType, isSupportedType } = require('../crawlers/crawlerRegistry');`
- `POST /anime/crawl`：把 `if (type === MACCMS){ new MaccmsCrawler }` 换成
  `const { crawler, type } = await getCrawler(siteUrl);`，`if (crawler) { …anime 流程… }`，
  upsert 时传 `siteType: type`；`else if (type==='comicat')` / `else` 保留现有兜底文案。
- `crawlDetailsAsync(db, animes, siteUrl, siteType)`：加 `siteType` 入参，内部 `getCrawlerByType(siteType, siteUrl)` 取代 `new MaccmsCrawler`，upsert 传 `siteType`。
- 播放/刷新/下载三处 `new MaccmsCrawler(anime.site_url)` → `getCrawlerByType(anime.site_type, anime.site_url)`。
- 导出共享给调度器：`module.exports = router; module.exports._crawlDetailsForScheduler = crawlDetailsAsync;`（匹配 `server.js` 已有钩子名）。

### 4. `server.js` 调度器去重 + 用注册表

- 顶部引入 `getCrawler`。
- `startDailyCrawlScheduler` 内：把 `new MaccmsCrawler` 首页爬取换成 `const { crawler, type } = await getCrawler(DEFAULT_SITE); if (!crawler) return;`，upsert 传 `siteType: type`。
- 删除内联的 `crawlDetails` 副本，改调 `require('./routes/animeRoutes')._crawlDetailsForScheduler(db, animes, DEFAULT_SITE, type)`，复用 animeRoutes 里更完善的封面跨 CDN / 状态合并逻辑。

### 5. `pages.js` 落库 site_type（最小改动）

- `/anime/:id` 详情按需爬取：`new MaccmsCrawler(anime.site_url||DEFAULT_SITE)` → `getCrawlerByType(anime.site_type, anime.site_url||DEFAULT_SITE)`，upsert 传 `siteType: anime.site_type || 'maccms'`。
- `/category/:name` 分类浏览：保留现有 `MaccmsCrawler`（分类菜单是默认站 maccms 专属 UI），仅在 upsert 新动漫时补 `siteType: 'maccms'`，保证落库一致。

## 涉及文件

- 新增 `src/crawlers/crawlerRegistry.js`
- 改 `src/database/db.js`（DDL + `_migrate()` + `upsertAnime`）
- 改 `src/routes/animeRoutes.js`（分派、`crawlDetailsAsync`、播放三路由、导出钩子）
- 改 `src/server.js`（调度器用注册表 + 去重）
- 改 `src/routes/pages.js`（详情/分类 upsert 传 siteType）

## 向后兼容与安全

- 纯增列 + 工厂回退（空 site_type → maccms），现有数据与流程不变。
- 注册表目前仅 maccms，行为与现状一致；新增站点不改路由。
- 无新增写入面，无注入风险。

## 验证（端到端）

1. 重启 `npm start`，看启动日志无报错（迁移在 `initTables` 内执行）。
2. 迁移落库：
   - `curl -s 'http://localhost:3000/api/admin/table/animes?pageSize=3'` 应能看到新列 `site_type`，现有行值为 `maccms`。
   - 或后台页 `http://localhost:3000/admin` 的「动漫」表确认 `site_type` 列存在。
3. 播放链路未回归：访问 `http://localhost:3000/play/1`，`curl -s http://localhost:3000/api/anime/episode/1/play` 能返回 videoUrl（走 `getCrawlerByType('maccms',…)`）。
4. 爬取链路未回归：`curl -s -X POST http://localhost:3000/api/anime/crawl -H 'Content-Type: application/json' -d '{"siteUrl":"https://m.tiantiandongman.com/","crawlDetails":false}'` 返回 `success:true`，且新入库动漫 `site_type='maccms'`。
5. 不支持站点兜底：对一个非 maccms URL 调 `/api/anime/crawl`，应走 comicat/generic 兜底文案而非报错。
6. 回归检查：画廊/详情/详情返回/播放返回均正常（沿用既有页面）。
