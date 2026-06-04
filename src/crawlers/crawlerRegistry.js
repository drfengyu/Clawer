// 爬虫注册表/工厂：SiteType -> 实现了 anime 契约的爬虫类
// 新增同类站点只需：写爬虫类 + 在 REGISTRY 登记 + siteDetector 加检测签名
const { SiteDetector, SiteType } = require('./siteDetector');
const MaccmsCrawler = require('./maccmsCrawler');

const REGISTRY = {
  [SiteType.MACCMS]: MaccmsCrawler
};

/**
 * 联网探测站点类型并构造爬虫；不支持的类型 crawler 为 null
 * @param {string} siteUrl
 * @param {SiteDetector} [detector] 可复用的检测器（带缓存）
 * @returns {Promise<{crawler: object|null, type: string}>}
 */
async function getCrawler(siteUrl, detector) {
  const det = detector || new SiteDetector();
  const { type } = await det.detect(siteUrl);
  const Cls = REGISTRY[type];
  return { crawler: Cls ? new Cls(siteUrl) : null, type };
}

/**
 * 按已知 site_type 直接构造（不联网）。空/未知类型回退 maccms，保证旧数据兼容
 * @param {string} siteType
 * @param {string} siteUrl
 */
function getCrawlerByType(siteType, siteUrl) {
  const Cls = REGISTRY[siteType] || REGISTRY[SiteType.MACCMS];
  return new Cls(siteUrl);
}

function isSupportedType(type) {
  return !!REGISTRY[type];
}

module.exports = { getCrawler, getCrawlerByType, isSupportedType, REGISTRY };
