// 站点类型检测：URL host 特征 + HTML 签名两级检测
const BaseCrawler = require('./baseCrawler');

const SiteType = Object.freeze({
  COMICAT: 'comicat',
  MACCMS: 'maccms',
  GENERIC: 'generic',
  UNKNOWN: 'unknown'
});

class SiteDetector {
  constructor() {
    this.cache = new Map(); // host -> { type, confidence }
  }

  /**
   * @param {string} url
   * @param {string} [html] 已抓取的 HTML（可选）
   * @returns {Promise<{type: string, confidence: number, features: string[]}>}
   */
  async detect(url, html = null) {
    const host = new URL(url).host;
    if (this.cache.has(host)) return this.cache.get(host);

    // 第一级：URL host 特征
    const hostResult = this._detectByHost(url);
    if (hostResult.confidence >= 0.9) {
      this.cache.set(host, hostResult);
      return hostResult;
    }

    // 第二级：HTML 签名
    if (!html) {
      try {
        const crawler = new BaseCrawler();
        html = await crawler.fetchPage(url);
      } catch (e) {
        return { type: SiteType.UNKNOWN, confidence: 0, features: ['fetch-failed'] };
      }
    }
    const htmlResult = this._detectByHtml(url, html);
    // 合并两级的最高置信度结果
    const result = hostResult.confidence >= htmlResult.confidence ? hostResult : htmlResult;
    this.cache.set(host, result);
    return result;
  }

  _detectByHost(url) {
    const host = new URL(url).host;
    const features = [];

    if (/comicat/i.test(host)) {
      features.push('host:comicat-pattern');
      return { type: SiteType.COMICAT, confidence: 0.9, features };
    }
    if (/tiantian|dongman|yhdm|halihali|agefans|maccms/i.test(host)) {
      features.push('host:anime-pattern');
      return { type: SiteType.MACCMS, confidence: 0.7, features };
    }
    return { type: SiteType.UNKNOWN, confidence: 0, features: [] };
  }

  _detectByHtml(url, html) {
    const features = [];

    // maccms 签名
    if (/player_aaaa|MacPlayer|www\.maccms\.com/i.test(html)) {
      features.push('html:maccms-player-config');
      return { type: SiteType.MACCMS, confidence: 0.95, features };
    }
    // maccms 变体：m3u8/mp4 直链 + 动漫目录结构
    if (/\.m3u8|\.mp4/i.test(html) && /分类|连载|更新至|\.u-movie|list-poster/i.test(html)) {
      features.push('html:maccms-variant');
      return { type: SiteType.MACCMS, confidence: 0.7, features };
    }
    // comicat 签名
    if (/visitor-test-form|show-[a-f0-9]{20,}\.html/i.test(html)) {
      features.push('html:comicat-visitor');
      return { type: SiteType.COMICAT, confidence: 0.95, features };
    }
    // 通用 BT 站：有 magnet 链接
    if (/magnet:\?xt=urn:btih:/i.test(html)) {
      features.push('html:magnet-links');
      return { type: SiteType.COMICAT, confidence: 0.8, features };
    }
    // 兜底为通用站点
    features.push('html:no-signature');
    return { type: SiteType.GENERIC, confidence: 0.2, features };
  }
}

module.exports = { SiteDetector, SiteType };
