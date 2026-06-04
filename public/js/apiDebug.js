// API 在线调试控制台

// 接口目录（分组）。path 含 :占位符 的需用户替换为实际值；body 为示例请求体。
const CATALOG = [
  { group: '动漫', items: [
    { method: 'GET',  path: '/api/site/detect?url=https://m.tiantiandongman.com/', desc: '站点类型检测' },
    { method: 'POST', path: '/api/anime/crawl', desc: '爬取每日更新', body: { siteUrl: 'https://m.tiantiandongman.com/', filterToday: true, crawlDetails: true } },
    { method: 'GET',  path: '/api/anime/daily', desc: '每日更新列表' },
    { method: 'GET',  path: '/api/anime/1', desc: '动漫详情（含分集）' },
    { method: 'GET',  path: '/api/anime/search?q=物语', desc: '搜索动漫' },
    { method: 'GET',  path: '/api/categories', desc: '分类列表' }
  ]},
  { group: '播放', items: [
    { method: 'GET',  path: '/api/anime/episode/1/play', desc: '解析播放地址（含 proxyUrl）' },
    { method: 'POST', path: '/api/anime/episode/1/refresh', desc: '刷新播放地址' },
    { method: 'POST', path: '/api/anime/episode/1/download', desc: '下载分集（m3u8→mp4）' }
  ]},
  { group: '代理', items: [
    { method: 'GET',  path: '/api/proxy/m3u8?url=&ref=', desc: 'm3u8 代理（填编码后的 url/ref）' },
    { method: 'GET',  path: '/api/proxy/seg?url=&ref=', desc: '分片代理（支持 Range）' }
  ]},
  { group: '通用资源', items: [
    { method: 'GET',    path: '/api/resources', desc: '所有资源' },
    { method: 'GET',    path: '/api/search?q=', desc: '搜索资源' },
    { method: 'GET',    path: '/api/stats', desc: '统计信息' },
    { method: 'GET',    path: '/api/history?limit=20&offset=0', desc: '爬取历史' },
    { method: 'POST',   path: '/api/crawl', desc: '添加爬取任务', body: { url: 'https://example.com', type: 'image' } },
    { method: 'DELETE', path: '/api/resources/1', desc: '删除资源' }
  ]}
];

const MAX_RENDER = 20000; // 响应超长时截断（如代理返回的 m3u8 文本）

const $ = id => document.getElementById(id);
let lastRaw = '';      // 最近一次响应原始文本
let showRaw = false;   // 当前是否显示原始文本

document.addEventListener('DOMContentLoaded', () => {
  renderCatalog();
  $('sendBtn').addEventListener('click', send);
  $('url').addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
  $('toggleRaw').addEventListener('click', () => { showRaw = !showRaw; paintBody(); });
});

function renderCatalog() {
  const el = $('catalog');
  el.innerHTML = '';
  CATALOG.forEach(g => {
    const t = document.createElement('div');
    t.className = 'group-title';
    t.textContent = g.group;
    el.appendChild(t);
    g.items.forEach(it => {
      const d = document.createElement('div');
      d.className = 'api-item';
      d.innerHTML = `<div><span class="m ${it.method}">${it.method}</span><span class="p">${escapeHtml(it.path)}</span></div><div class="d">${escapeHtml(it.desc)}</div>`;
      d.addEventListener('click', () => fill(it));
      el.appendChild(d);
    });
  });
}

function fill(it) {
  $('method').value = it.method;
  $('url').value = it.path;
  $('body').value = it.body ? JSON.stringify(it.body, null, 2) : '';
}

async function send() {
  const method = $('method').value;
  const url = $('url').value.trim();
  if (!url) { alert('请填写请求 URL'); return; }

  // 解析自定义 headers
  let headers = {};
  const headerText = $('headers').value.trim();
  if (headerText) {
    try { headers = JSON.parse(headerText); }
    catch (e) { return showError('请求头不是合法 JSON：' + e.message); }
  }

  // 组装 body（仅 POST/PUT）
  const opts = { method, headers };
  if (method === 'POST' || method === 'PUT') {
    const bodyText = $('body').value.trim();
    if (bodyText) {
      try { JSON.parse(bodyText); }
      catch (e) { return showError('请求体不是合法 JSON：' + e.message); }
      if (!Object.keys(headers).some(k => k.toLowerCase() === 'content-type')) {
        headers['Content-Type'] = 'application/json';
      }
      opts.body = bodyText;
    }
  }

  $('sendBtn').disabled = true;
  setBadges('', '发送中…', 'err');
  lastRaw = ''; $('toggleRaw').style.display = 'none';

  const t0 = performance.now();
  try {
    const resp = await fetch(url, opts);
    const ms = Math.round(performance.now() - t0);
    const text = await resp.text();
    lastRaw = text;

    const cls = resp.status >= 500 ? 's5' : resp.status >= 400 ? 's4' : 's2';
    setBadges(`${resp.status} ${resp.statusText}`, `${ms} ms`, cls);

    // JSON 优先美化；失败则原样
    showRaw = false;
    const ct = resp.headers.get('content-type') || '';
    if (ct.includes('json') || looksJson(text)) {
      try { lastRaw = JSON.stringify(JSON.parse(text), null, 2); } catch (e) { /* 保留原文 */ }
    } else {
      $('toggleRaw').style.display = ''; // 非 JSON（如 m3u8），允许切换查看
    }
    paintBody();
  } catch (e) {
    setBadges('', '请求失败', 'err');
    showError('网络错误或被拦截：' + e.message);
  } finally {
    $('sendBtn').disabled = false;
  }
}

function paintBody() {
  const pre = $('respBody');
  let text = lastRaw || '';
  let truncated = false;
  if (text.length > MAX_RENDER) { text = text.slice(0, MAX_RENDER); truncated = true; }
  pre.textContent = text;
  if (truncated) {
    const note = document.createElement('div');
    note.className = 'truncated';
    note.textContent = `\n…（响应过长，已截断，共 ${lastRaw.length} 字符）`;
    pre.appendChild(note);
  }
}

function setBadges(status, time, cls) {
  $('statusBadge').className = status ? 'badge ' + cls : '';
  $('statusBadge').textContent = status;
  $('timeBadge').className = time ? 'badge time' : '';
  $('timeBadge').textContent = time;
}

function showError(msg) {
  $('sendBtn').disabled = false;
  const pre = $('respBody');
  pre.innerHTML = '';
  const span = document.createElement('span');
  span.style.color = '#ff8b8b';
  span.textContent = msg;
  pre.appendChild(span);
}

function looksJson(s) {
  const t = s.trim();
  return t.startsWith('{') || t.startsWith('[');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
