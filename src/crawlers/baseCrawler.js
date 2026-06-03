const axios = require('axios');
const cheerio = require('cheerio');

class BaseCrawler {
  constructor() {
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };
  }

  async fetchPage(url) {
    try {
      const response = await axios.get(url, {
        headers: this.headers,
        timeout: 30000
      });
      return response.data;
    } catch (error) {
      throw new Error(`获取页面失败: ${error.message}`);
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

  // 提取视频链接 (基础实现)
  async extractVideos(url) {
    try {
      const html = await this.fetchPage(url);
      const $ = this.parseHTML(html);
      const videos = [];

      // 提取 <video> 标签
      $('video').each((i, elem) => {
        const src = $(elem).attr('src');
        if (src) {
          videos.push({
            url: this.resolveUrl(url, src),
            type: 'video'
          });
        }

        // 提取 <source> 标签
        $(elem).find('source').each((j, source) => {
          const sourceSrc = $(source).attr('src');
          if (sourceSrc) {
            videos.push({
              url: this.resolveUrl(url, sourceSrc),
              type: 'video'
            });
          }
        });
      });

      return videos;
    } catch (error) {
      throw new Error(`提取视频失败: ${error.message}`);
    }
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
