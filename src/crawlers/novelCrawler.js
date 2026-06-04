/**
 * 小说爬虫 - 八一中文网（81zw2.com）
 *
 * ⚠️ 使用声明：
 * 本爬虫仅供个人学习研究使用，请勿用于商业用途或公开传播。
 * 爬取内容受版权保护，使用者需遵守相关法律法规并承担相应责任。
 *
 * 站点特性：
 * - 需要标准 User-Agent
 * - 章节页必须带 Referer（书籍详情页）
 * - 编码：UTF-8
 */

const axios = require('axios');
const cheerio = require('cheerio');

class NovelCrawler {
  constructor(baseUrl = 'https://www.81zw2.com') {
    this.baseUrl = baseUrl;
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Connection': 'keep-alive'
    };
  }

  /**
   * 获取页面 HTML
   * @param {string} url - 完整 URL 或相对路径
   * @param {string} referer - 可选的 Referer
   */
  async fetchPage(url, referer = null) {
    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
    const headers = { ...this.headers };
    if (referer) headers['Referer'] = referer;

    try {
      const response = await axios.get(fullUrl, {
        headers,
        timeout: 15000,
        responseType: 'text'
      });
      return response.data;
    } catch (error) {
      throw new Error(`获取页面失败 ${fullUrl}: ${error.message}`);
    }
  }

  /**
   * 从首页抓取热门小说列表
   */
  async crawlHomePage() {
    const html = await this.fetchPage('/');
    const $ = cheerio.load(html);
    const novels = [];

    // 提取小说链接（格式：/book/{id}/）
    $('a[href*="/book/"]').each((i, el) => {
      const href = $(el).attr('href');
      const title = $(el).text().trim();
      const match = href.match(/\/book\/(\d+)\//);

      if (match && title) {
        const bookId = match[1];
        novels.push({
          sourceId: bookId,
          title,
          detailUrl: `/book/${bookId}/`,
          siteUrl: this.baseUrl
        });
      }
    });

    // 去重（按 sourceId）
    const unique = [];
    const seen = new Set();
    for (const n of novels) {
      if (!seen.has(n.sourceId)) {
        seen.add(n.sourceId);
        unique.push(n);
      }
    }

    return unique;
  }

  /**
   * 抓取小说详情页（书名/作者/封面/简介/章节列表）
   * @param {string} bookId - 书籍 ID
   */
  async crawlDetail(bookId) {
    const detailUrl = `/book/${bookId}/`;
    const html = await this.fetchPage(detailUrl);
    const $ = cheerio.load(html);

    // 基本信息
    const title = $('h1').first().text().trim();
    const author = $('p:contains("作者")').text().replace(/作者[：:]/g, '').trim() || '未知作者';

    // 封面（可能在 img 标签中）
    let cover = '';
    const coverImg = $('img[src*="cover"], img[src*="bookcover"], .bookimg img').first();
    if (coverImg.length) {
      cover = coverImg.attr('src');
      if (cover && !cover.startsWith('http')) {
        cover = this.baseUrl + cover;
      }
    }

    // 简介
    const intro = $('#intro').text().trim() || $('div:contains("简介")').text().trim() || '';

    // 状态（连载/完结）
    let status = '连载中';
    const statusText = $('p:contains("状态"), span:contains("状态")').text();
    if (statusText.includes('完结') || statusText.includes('完本')) {
      status = '已完结';
    }

    // 分类/标签
    const category = $('p:contains("分类"), a[href*="class"]').first().text().replace(/分类[：:]/g, '').trim() || '其他';

    // 章节列表（格式：/book/{bookId}/{chapterId}.html）
    const chapters = [];
    $('a[href*=".html"]').each((i, el) => {
      const href = $(el).attr('href');
      const chapterTitle = $(el).text().trim();
      const match = href.match(/\/book\/\d+\/(\d+)\.html/);

      if (match && chapterTitle) {
        chapters.push({
          chapterNumber: chapters.length + 1,
          sourceId: match[1],
          title: chapterTitle,
          url: href
        });
      }
    });

    return {
      novel: {
        sourceId: bookId,
        title,
        author,
        cover,
        description: intro,
        status,
        category,
        detailUrl,
        siteUrl: this.baseUrl,
        wordCount: 0,  // 八一中文网首页不显示字数，可后续补充
        updateDate: new Date().toISOString().split('T')[0]
      },
      chapters
    };
  }

  /**
   * 抓取章节正文
   * @param {string} bookId - 书籍 ID
   * @param {string} chapterId - 章节 ID
   */
  async crawlChapter(bookId, chapterId) {
    const chapterUrl = `/book/${bookId}/${chapterId}.html`;
    const referer = `${this.baseUrl}/book/${bookId}/`;  // 必须带 Referer
    const html = await this.fetchPage(chapterUrl, referer);
    const $ = cheerio.load(html);

    // 章节标题
    const title = $('h1').first().text().trim();

    // 正文内容（<div id="content">）
    const contentDiv = $('#content');
    if (!contentDiv.length) {
      throw new Error(`未找到章节内容: ${chapterUrl}`);
    }

    // 提取纯文本，保留换行
    let content = contentDiv.html() || '';
    content = content
      .replace(/<br\s*\/?>/gi, '\n')           // <br> 转换为换行
      .replace(/<script[^>]*>.*?<\/script>/gi, '') // 移除 script
      .replace(/<[^>]+>/g, '')                 // 移除所有标签
      .replace(/&nbsp;/g, ' ')                 // 实体转义
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .trim();

    return {
      sourceId: chapterId,
      title,
      content
    };
  }

  /**
   * 搜索小说（八一中文网的搜索功能，需要根据实际站点调整）
   * 注意：此方法为占位，需要根据实际搜索页结构实现
   */
  async searchNovels(keyword) {
    // 八一中文网搜索页 URL 格式需要实际测试确定
    // 暂时返回空，后续补充
    console.warn('searchNovels 方法暂未实现，需要根据站点实际搜索功能调整');
    return [];
  }
}

module.exports = NovelCrawler;
