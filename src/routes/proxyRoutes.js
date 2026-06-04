const express = require('express');
const axios = require('axios');
const router = express.Router();

// 与 baseCrawler 一致的 UA，避免源站按 UA 拦截（baseCrawler.js:7）
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// 构造转发请求头：统一带 UA + Referer，可叠加额外头（如 Range）
function buildHeaders(ref, extra = {}) {
  const h = { 'User-Agent': UA, ...extra };
  if (ref) {
    h['Referer'] = ref;
    try { h['Origin'] = new URL(ref).origin; } catch (e) { /* ref 非完整 URL 时忽略 Origin */ }
  }
  return h;
}

// 把代理自身地址拼出来：/api/proxy/<kind>?url=<enc>&ref=<enc>
function selfUrl(kind, absUrl, ref) {
  let s = '/api/proxy/' + kind + '?url=' + encodeURIComponent(absUrl);
  if (ref) s += '&ref=' + encodeURIComponent(ref);
  return s;
}

// ─── m3u8 代理：改写其中的分片/嵌套 m3u8 地址，使其回流经本服务 ───
router.get('/proxy/m3u8', async (req, res) => {
  const { url, ref } = req.query;
  if (!url) return res.status(400).send('缺少 url 参数');

  try {
    const resp = await axios({
      method: 'get',
      url,
      headers: buildHeaders(ref),
      timeout: 30000,
      responseType: 'text',
      maxRedirects: 5,
      validateStatus: () => true
    });

    if (resp.status >= 400) {
      return res.status(resp.status).send('源站返回 ' + resp.status);
    }

    // 以最终响应地址为基准解析相对路径（处理重定向后的真实 base）
    const baseUrl = (resp.request && resp.request.res && resp.request.res.responseUrl) || url;

    const rewritten = String(resp.data).split('\n').map(line => {
      const trimmed = line.trim();
      // 注释/标签行：仅 URI 属性（如 EXT-X-KEY 的 URI、EXT-X-MEDIA）需要改写
      if (trimmed.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (m, u) => {
          try {
            const abs = new URL(u, baseUrl).href;
            return 'URI="' + selfUrl('seg', abs, ref) + '"';
          } catch (e) { return m; }
        });
      }
      if (trimmed === '') return line;
      // 资源行：可能是嵌套 m3u8（多码率主播放列表）或分片
      try {
        const abs = new URL(trimmed, baseUrl).href;
        const isPlaylist = /\.m3u8(\?|$)/i.test(abs);
        return selfUrl(isPlaylist ? 'm3u8' : 'seg', abs, ref);
      } catch (e) {
        return line;
      }
    }).join('\n');

    res.set('Content-Type', 'application/vnd.apple.mpegurl');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'no-store');
    res.send(rewritten);
  } catch (e) {
    res.status(502).send('m3u8 代理失败: ' + e.message);
  }
});

// ─── 分片代理：流式转发 .ts/key 等，支持 Range（拖动进度）───
router.get('/proxy/seg', async (req, res) => {
  const { url, ref } = req.query;
  if (!url) return res.status(400).send('缺少 url 参数');

  try {
    const extra = {};
    if (req.headers['range']) extra['Range'] = req.headers['range'];

    const resp = await axios({
      method: 'get',
      url,
      headers: buildHeaders(ref, extra),
      timeout: 30000,
      responseType: 'stream',
      maxRedirects: 5,
      validateStatus: () => true
    });

    res.status(resp.status);
    res.set('Access-Control-Allow-Origin', '*');
    // 透传与播放相关的响应头
    for (const k of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control']) {
      if (resp.headers[k]) res.set(k, resp.headers[k]);
    }

    resp.data.on('error', () => { if (!res.headersSent) res.status(502); res.end(); });
    resp.data.pipe(res);
  } catch (e) {
    res.status(502).send('分片代理失败: ' + e.message);
  }
});

module.exports = router;
