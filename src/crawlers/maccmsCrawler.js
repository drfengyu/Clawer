const BaseCrawler = require('./baseCrawler');
const cheerio = require('cheerio');

class MaccmsCrawler extends BaseCrawler {
  constructor(baseUrl) {
    super();
    this.baseUrl = baseUrl;
    this.origin = new URL(baseUrl).origin;
  }

  /**
   * 爬取首页当天更新的动漫卡片
   * @returns {Promise<{animes: Array, categories: Array, todayCount: number, totalCount: number}>}
   */
  async crawlHomepage(filterToday = true) {
    const html = await this.fetchPage(this.baseUrl);
    const $ = this.parseHTML(html);
    const cards = this._parseCards($);
    const categories = this._parseCategories($, html);
    const today = new Date();
    const todayStr = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    let filtered = cards;
    if (filterToday) {
      filtered = cards.filter(c => c.updateDate && c.updateDate.includes(todayStr));
      // 如果当天更新不足，回退到全部（可能所有卡片都是当天更新的）
      if (filtered.length === 0) filtered = cards;
    }

    return {
      animes: filtered.map(c => ({
        sourceId: c.id,
        title: c.title,
        cover: c.cover,
        score: c.score,
        status: c.status,
        updateDate: c.updateDate,
        detailUrl: c.detailUrl,
        categoryName: c.categoryName || ''
      })),
      categories,
      todayCount: filtered.length,
      totalCount: cards.length
    };
  }

  /**
   * 爬取动漫详情页：封面、简介、分类、播放线路和分集
   * @returns {Promise<{anime: Object, episodes: Array}>}
   */
  async crawlDetail(detailUrl) {
    const html = await this.fetchPage(detailUrl);
    const $ = this.parseHTML(html);

    const title = $('title').text().replace(/ - .*/, '').trim();
    const cover = $('.list-poster img, .detail-poster img, .vod-poster img').first().attr('data-original')
      || $('.list-poster img, .detail-poster img, .vod-poster img').first().attr('src')
      || '';
    const score = parseFloat($('.pingfen span, .score').first().text().trim()) || 0;
    let status = $('.zhuangtai span').first().text().trim()
      || $('.vod-status').first().text().trim() || '';
    if (/^第\d+集$/.test(status)) status = '更新至' + status;

    // 简介 — 从原始 HTML 中提取，因为部分站点简介是裸文本节点（不在任何标签内）
    let desc = '';
    const descIdx = html.search(/剧情简介[：:]/);
    if (descIdx >= 0) {
      // 找到 剧情简介 之后最近的一个标签结束位置（可能是 </h4>, </strong>, : 等）
      const afterLabel = html.slice(descIdx);
      const tagEnd = afterLabel.match(/<\/h4>|<\/strong>\s*<\/h4>/);
      if (tagEnd) {
        const startPos = descIdx + (tagEnd.index || 0) + tagEnd[0].length;
        const rest = html.slice(startPos);
        // 下一个结构性标签之前就是纯简介文本
        const endMatch = rest.match(/<nav|<script|<h4|<div\b|<\/div/);
        const endPos = endMatch ? endMatch.index : rest.length;
        desc = rest.slice(0, endPos)
          .replace(/<[^>]+>/g, '')       // 去掉残留标签
          .replace(/&nbsp;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
    }
    // 回退：cheerio 遍历
    if (!desc) {
      const jianjieH4 = $('h4').filter((i, el) => /简介|介绍/.test($(el).text()));
      if (jianjieH4.length > 0) {
        let next = jianjieH4.first().next();
        while (next.length > 0 && !desc) {
          desc = next.text().trim();
          next = next.next();
        }
      }
    }
    // 最后回退
    if (!desc) {
      desc = $('.jianjie').text().trim()
        || $('.vod_content').first().text().trim()
        || '';
    }

    // 从 .video_info 提取结构化元数据
    const meta = {};
    $('.video_info strong').each((i, el) => {
      const rawLabel = $(el).text().replace(/[：:]/g, '').trim();
      let value = '';
      let node = el.nextSibling;
      while (node) {
        if (node.type === 'text') value += node.data;
        else if (node.name === 'br') break;
        else break;
        node = node.nextSibling;
      }
      value = value.trim();
      if (rawLabel === '名称') meta.name = value.replace(/^【|】$/g, '');
      else if (rawLabel === '主演') meta.cast = value;
      else if (rawLabel === '类型') meta.genre = value;
      else if (rawLabel === '国家/地区' || rawLabel === '地区') meta.area = value;
      else if (rawLabel === '语言') meta.language = value;
      else if (rawLabel === '首播') meta.premiere = value;
      else if (rawLabel === '评分') meta.score = value;
    });
    const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
    const categoryNames = [];
    // "类型：日漫" 模式 — 只取中文字符
    const infoText = $('.content, .info, .article').first().text() || '';
    const typeMatch = infoText.match(/类型[：:]\s*([一-龥]+)/);
    if (typeMatch) categoryNames.push(typeMatch[1]);
    // 面包屑
    $('.breadcrumb a, .location a').each((i, el) => {
      const name = $(el).text().trim();
      if (name && name !== '首页' && name !== '当前位置' && name.length < 8) categoryNames.push(name);
    });

    // 获取原始 ID
    const sourceId = this._extractId(detailUrl);

    // 解析播放线路和分集
    const lines = this._parseEpisodeLines($, html, sourceId);

    // 展平为 episodes 数组
    const episodes = [];
    for (const line of lines) {
      for (const ep of line.episodes) {
        episodes.push({
          lineName: line.name,
          epNumber: ep.ep,
          label: ep.label,
          playUrl: this.resolveUrl(detailUrl, ep.url)
        });
      }
    }

    return {
      anime: {
        sourceId,
        title,
        cover: this.resolveUrl(detailUrl, cover),
        score,
        status,
        description: desc.slice(0, 2000),
        detailUrl,
        categoryNames,
        meta: metaStr,
        updateDate: this._extractDateFromDetail($)
      },
      episodes
    };
  }

  /**
   * 从播放页提取 m3u8/mp4 视频地址
   * @returns {Promise<{videoUrl: string, videoUrlNext: string}>}
   */
  async crawlPlayUrl(playUrl) {
    const html = await this.fetchPage(playUrl);
    const config = this._extractPlayerConfig(html);
    if (!config || !config.url) {
      throw new Error('未找到播放地址（player_aaaa 配置缺失）');
    }
    return {
      videoUrl: config.url,
      videoUrlNext: config.url_next || ''
    };
  }

  // ─── 内部方法 ──────────────────────────────────────────

  _parseCards($) {
    const cards = [];
    // 只取第一个 .m-movies 容器（每日更新区），忽略下方分类分区
    $('.m-movies').first().find('.u-movie').each((i, el) => {
      const $el = $(el);
      const aTag = $el.find('a').first();
      const detailHref = aTag.attr('href') || '';
      const title = aTag.attr('title') || $el.find('h2').text().trim();
      const img = $el.find('img').first();
      const cover = img.attr('data-original') || img.attr('src') || '';
      const score = parseFloat($el.find('.pingfen').text().trim()) || 0;
      let status = $el.find('.zhuangtai span').text().trim()
        || $el.find('.zhuangtai').text().trim();
      // 规范化："第5集" → "更新至第5集"
      if (/^第\d+集$/.test(status)) status = '更新至' + status;
      const updateDate = $el.find('.meta .tags').text().trim()
        || $el.find('.meta').text().trim();

      cards.push({
        id: this._extractId(detailHref),
        title,
        cover: this.resolveUrl(this.baseUrl, cover),
        score,
        status,
        updateDate,
        detailUrl: this.resolveUrl(this.baseUrl, detailHref),
        categoryName: ''
      });
    });
    // 尝试按来源分区归类
    this._assignCategories($, cards);
    return cards;
  }

  _assignCategories($, cards) {
    // 检查是否有分类页入口
    const catMap = new Map();
    $('.menu-item-object-category a, .nav-category a, .category-list a').each((i, el) => {
      const href = $(el).attr('href') || '';
      const name = $(el).text().trim();
      const catId = href.match(/\/h\/(\d+)/);
      if (catId && name) catMap.set(href, name);
    });

    // 如果页面有分区标题（如 h4.ctitle），尝试把下面的卡片归入该分区
    // 对每个卡片，检查它前面的 h4 标题
    if (catMap.size === 0) {
      let currentCategory = '';
      $('.u-movie').each((i, el) => {
        // 检查是否有前方分区标题
        let prev = el.prev;
        while (prev && prev.name !== 'h4') {
          prev = prev.prev;
        }
        if (prev && prev.name === 'h4') {
          const t = $(prev).text().trim();
          if (t && t.length < 20) currentCategory = t;
        }
        if (currentCategory && cards[i]) cards[i].categoryName = currentCategory;
      });
    }
  }

  _parseCategories($, html) {
    const cats = [];
    const seen = new Set();
    $('.menu-item-object-category a, .nav-category a, .category-list a').each((i, el) => {
      const href = $(el).attr('href') || '';
      const name = $(el).text().trim();
      if (name && !seen.has(name)) {
        seen.add(name);
        cats.push({ name, url: this.resolveUrl(this.baseUrl, href) });
      }
    });
    // 也从 /h/ 链接中解析
    const catLinks = html.match(/href="(\/h\/\d+\/)[^"]*"[^>]*>([^<]+)</gi) || [];
    for (const m of catLinks) {
      const hm = m.match(/href="(\/h\/\d+\/)"/);
      const nm = m.match(/>([^<]+)</);
      if (hm && nm) {
        const name = nm[1].trim();
        if (!seen.has(name)) {
          seen.add(name);
          cats.push({ name, url: this.resolveUrl(this.baseUrl, hm[1]) });
        }
      }
    }
    return cats;
  }

  _parseEpisodeLines($, html, sourceId) {
    const lines = [];

    // 查找 "线路" 区块：h4.ctitle + div.video_list_li
    // 或者 .playbox 内的结构
    const lineHeaders = [];
    $('h4.ctitle, .play-from h4, .title-line').each((i, el) => {
      lineHeaders.push($(el).text().trim());
    });

    // 收集所有包含 /v/<id>-<line>-<ep>/ 的链接
    const episodeLinks = [];
    $('a[href*="/v/"]').each((i, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();
      if (!href.match(/\/v\/\d+-\d+-\d+/)) return;
      const parts = href.match(/\/v\/(\d+)-(\d+)-(\d+)/);
      if (!parts) return;
      episodeLinks.push({
        href,
        text,
        sourceId: parts[1],
        lineNum: parseInt(parts[2]),
        epNum: parseInt(parts[3])
      });
    });

    // 按 lineNum 分组
    const groups = new Map();
    for (const ep of episodeLinks) {
      const key = ep.lineNum;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(ep);
    }

    // 为每个线路生成名称
    let idx = 0;
    for (const [lineNum, eps] of groups) {
      const name = lineHeaders[idx] || `线路${'一二三四五六七八九十'[lineNum - 1] || lineNum}`;
      idx++;
      // 按集数排序
      eps.sort((a, b) => a.epNum - b.epNum);
      lines.push({
        name,
        episodes: eps.map(e => ({
          ep: e.epNum,
          label: `第${String(e.epNum).padStart(2, '0')}集`,
          url: e.href
        }))
      });
    }

    return lines;
  }

  _extractPlayerConfig(html) {
    // 提取 var player_aaaa = {...}; 或 var player_aaaa = {...}</script>
    const match = html.match(/player_aaaa\s*=\s*(\{[\s\S]*?\})[;]?/);
    if (!match) return null;
    try {
      return JSON.parse(match[1]);
    } catch (e) {
      try {
        const fixed = match[1].replace(/'/g, '"');
        return JSON.parse(fixed);
      } catch (e2) {
        return null;
      }
    }
  }

  _extractId(href) {
    const m = href.match(/\/p\/(\d+)/);
    return m ? m[1] : '';
  }

  _extractDateFromDetail($) {
    const text = $('.vod-meta, .detail-meta, .info-meta').text()
      || $('body').text();
    const m = text.match(/(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
  }
}

module.exports = MaccmsCrawler;
