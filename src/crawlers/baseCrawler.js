const axios = require('axios');
const cheerio = require('cheerio');

class BaseCrawler {
  constructor() {
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
    };
    // 按域名持久化 cookie，便于一次通过验证后复用
    this.cookieStore = new Map();
  }

  async fetchPage(url) {
    try {
      let response = await this.request('get', url);
      let html = response.data;

      // 检测到人机验证墙时，自动通过后重新获取真实页面
      if (this.isAntiBotWall(html)) {
        const passed = await this.solveVisitorTest(url, html);
        if (passed) {
          response = await this.request('get', url);
          html = response.data;
        }
        if (this.isAntiBotWall(html)) {
          throw new Error('目标站点存在人机验证，自动通过失败');
        }
      }

      return html;
    } catch (error) {
      if (error.message.startsWith('目标站点')) throw error;
      throw new Error(`获取页面失败: ${error.message}`);
    }
  }

  // 统一请求入口：自动附带/保存该域名下的 cookie
  async request(method, url, data = null, extraHeaders = {}) {
    const host = new URL(url).host;
    const headers = { ...this.headers, ...extraHeaders };
    const cookie = this.getCookieHeader(host);
    if (cookie) headers['Cookie'] = cookie;

    const response = await axios({
      method,
      url,
      data,
      headers,
      timeout: 30000,
      maxRedirects: method === 'post' ? 0 : 5,
      validateStatus: () => true
    });

    this.storeCookies(host, response.headers['set-cookie']);
    return response;
  }

  // 识别常见的"自动通过"型人机验证墙（如 comicat 的 visitor-test）
  isAntiBotWall(html) {
    if (typeof html !== 'string') return false;
    return html.includes('visitor-test-form') ||
      (html.includes('captcha.js') && html.includes("I'm not a robot"));
  }

  // 通过 visitor-test 验证：提交验证表单以换取 cookie
  async solveVisitorTest(url, html) {
    try {
      const $ = this.parseHTML(html);
      const form = $('#visitor-test-form');
      const action = form.attr('action') || '/addon.php?r=document/view&page=visitor-test';
      const actionUrl = this.resolveUrl(url, action);

      const params = new URLSearchParams();
      form.find('input').each((i, el) => {
        const name = $(el).attr('name');
        if (name) params.append(name, $(el).attr('value') || '');
      });
      if (!params.has('visitor_test')) params.append('visitor_test', 'human');

      const origin = new URL(url).origin;
      await this.request('post', actionUrl, params.toString(), {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': url,
        'Origin': origin
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  // 读取某域名已保存的 cookie，拼成请求头
  getCookieHeader(host) {
    const jar = this.cookieStore.get(host);
    if (!jar || jar.size === 0) return '';
    return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  // 合并 Set-Cookie 到对应域名的 cookie 罐
  storeCookies(host, setCookie) {
    if (!setCookie || setCookie.length === 0) return;
    let jar = this.cookieStore.get(host);
    if (!jar) { jar = new Map(); this.cookieStore.set(host, jar); }
    for (const raw of setCookie) {
      const [pair] = raw.split(';');
      const idx = pair.indexOf('=');
      if (idx === -1) continue;
      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      if (/expires=Thu, 01-Jan-1970/i.test(raw) || value === 'deleted') {
        jar.delete(name);
      } else {
        jar.set(name, value);
      }
    }
  }

  parseHTML(html) {
    return cheerio.load(html);
  }

  // 提取图片链接
  async extractImages(url) {
    try {
      const html = await this.fetchPage(url);
      const $ = this.parseHTML(html);
      const images = [];

      $('img').each((i, elem) => {
        const src = $(elem).attr('src') || $(elem).attr('data-src');
        if (src) {
          const fullUrl = this.resolveUrl(url, src);
          images.push({
            url: fullUrl,
            alt: $(elem).attr('alt') || '',
            title: $(elem).attr('title') || ''
          });
        }
      });

      return images;
    } catch (error) {
      throw new Error(`提取图片失败: ${error.message}`);
    }
  }

  // 提取视频链接（HTML5 <video> + BT 磁力链/种子）
  async extractVideos(url) {
    try {
      const html = await this.fetchPage(url);
      const $ = this.parseHTML(html);
      const videos = [];

      // 提取 <video> 标签
      $('video').each((i, elem) => {
        const src = $(elem).attr('src');
        if (src) {
          videos.push({ url: this.resolveUrl(url, src), type: 'video' });
        }
        $(elem).find('source').each((j, source) => {
          const sourceSrc = $(source).attr('src');
          if (sourceSrc) {
            videos.push({ url: this.resolveUrl(url, sourceSrc), type: 'video' });
          }
        });
      });

      // 从原始 HTML（含注释）提取 magnet / torrent 链接
      for (const m of this._extractMagnets(html)) {
        videos.push({ url: m, type: 'video' });
      }
      for (const t of this._extractTorrents(url, html)) {
        videos.push({ url: t, type: 'video' });
      }

      // 当前页面无直接资源，尝试进入详情页（如 comicat 的 show-<hash>.html）
      if (videos.length === 0) {
        const detailUrl = await this._findFirstDetail(url, html);
        if (detailUrl) {
          const detailHtml = await this.fetchPage(detailUrl);
          for (const m of this._extractMagnets(detailHtml)) {
            videos.push({ url: m, type: 'video' });
          }
          for (const t of this._extractTorrents(detailUrl, detailHtml)) {
            videos.push({ url: t, type: 'video' });
          }
        }
      }

      return videos;
    } catch (error) {
      throw new Error(`提取视频失败: ${error.message}`);
    }
  }

  _extractMagnets(html) {
    const matches = html.match(/magnet:\?xt=urn:btih:[^"'\s<>]+/gi) || [];
    return [...new Set(matches)];
  }

  _extractTorrents(baseUrl, html) {
    const matches = html.match(/href=["']([^"']*\.torrent[^"']*)["']/gi) || [];
    const links = [...new Set(matches.map(m => m.replace(/^href=["']|["']$/gi, '')))];
    return links.map(l => this.resolveUrl(baseUrl, l));
  }

  // comicat 风格的详情页链接：show-<40 字符十六进制>.html
  async _findFirstDetail(url, html) {
    const $ = this.parseHTML(html);
    const seen = new Set();
    for (const el of $('a').toArray()) {
      const href = ($(el).attr('href') || '').trim();
      if (/^show-[a-f0-9]{20,}\.html$/i.test(href)) {
        const abs = this.resolveUrl(url, href);
        if (!seen.has(abs)) { seen.add(abs); return abs; }
      }
    }
    return null;
  }

  // 提取音频链接 (基础实现)
  async extractAudios(url) {
    try {
      const html = await this.fetchPage(url);
      const $ = this.parseHTML(html);
      const audios = [];

      // 提取 <audio> 标签
      $('audio').each((i, elem) => {
        const src = $(elem).attr('src');
        if (src) {
          audios.push({
            url: this.resolveUrl(url, src),
            type: 'audio'
          });
        }

        // 提取 <source> 标签
        $(elem).find('source').each((j, source) => {
          const sourceSrc = $(source).attr('src');
          if (sourceSrc) {
            audios.push({
              url: this.resolveUrl(url, sourceSrc),
              type: 'audio'
            });
          }
        });
      });

      return audios;
    } catch (error) {
      throw new Error(`提取音频失败: ${error.message}`);
    }
  }

  // 解析相对URL为绝对URL
  resolveUrl(baseUrl, relativeUrl) {
    try {
      return new URL(relativeUrl, baseUrl).href;
    } catch (error) {
      return relativeUrl;
    }
  }

  // 获取页面标题
  async getPageTitle(url) {
    try {
      const html = await this.fetchPage(url);
      const $ = this.parseHTML(html);
      return $('title').text().trim() || 'Untitled';
    } catch (error) {
      return 'Untitled';
    }
  }
}

module.exports = BaseCrawler;
