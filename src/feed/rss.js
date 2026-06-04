// RSS 2.0 feed 生成（纯函数，无第三方依赖）
// 消费 animes 行（snake_case 字段：id/title/cover/score/status/description/update_date/created_at）

// XML 文本转义（用于元素文本与属性）
function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// 把 update_date / created_at 尽量解析为 Date；失败回退 now
function toDate(item) {
  const raw = item.created_at || item.update_date || '';
  // sql.js DATETIME 形如 "2026-06-04 08:12:30"，转 ISO 便于跨平台解析
  const iso = typeof raw === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)
    ? raw.replace(' ', 'T')
    : raw;
  const d = iso ? new Date(iso) : new Date();
  return isNaN(d.getTime()) ? new Date() : d;
}

function toRfc822(date) {
  return date.toUTCString();
}

// 单条 item 的 <description>（CDATA 包裹 HTML）
function itemDescription(item, link) {
  const parts = [];
  if (item.cover) parts.push(`<p><img src="${esc(item.cover)}" alt="${esc(item.title)}" referrerpolicy="no-referrer" style="max-width:240px"/></p>`);
  const metaLine = [];
  if (item.status) metaLine.push(esc(item.status));
  if (item.score) metaLine.push(`评分 ${esc(item.score)}`);
  if (item.update_date) metaLine.push(`更新 ${esc(item.update_date)}`);
  if (metaLine.length) parts.push(`<p>${metaLine.join(' · ')}</p>`);
  if (item.description) parts.push(`<p>${esc(item.description)}</p>`);
  parts.push(`<p><a href="${esc(link)}">前往观看</a></p>`);
  return `<![CDATA[${parts.join('')}]]>`;
}

/**
 * 生成 RSS 2.0 XML 字符串。
 * @param {Array<Object>} items  animes 行数组
 * @param {Object} opts
 * @param {string} opts.baseUrl  站点对外基址（如 http://localhost:3000）
 * @param {string} [opts.title]  频道标题
 * @param {string} [opts.description] 频道描述
 * @param {string} [opts.selfUrl] 本 feed 的绝对地址（atom:link self）
 */
function buildRssXml(items, opts = {}) {
  const baseUrl = (opts.baseUrl || 'http://localhost:3000').replace(/\/$/, '');
  const title = opts.title || '动漫每日更新';
  const description = opts.description || '每日更新动漫订阅源';
  const selfUrl = opts.selfUrl || `${baseUrl}/rss`;
  const now = toRfc822(new Date());

  const itemsXml = (items || []).map((item) => {
    const link = `${baseUrl}/anime/${item.id}`;
    const titleText = item.status ? `${item.title}（${item.status}）` : item.title;
    const guid = `anime-${item.id}-${item.update_date || ''}`;
    return [
      '    <item>',
      `      <title>${esc(titleText)}</title>`,
      `      <link>${esc(link)}</link>`,
      `      <guid isPermaLink="false">${esc(guid)}</guid>`,
      `      <pubDate>${toRfc822(toDate(item))}</pubDate>`,
      `      <description>${itemDescription(item, link)}</description>`,
      '    </item>',
    ].join('\n');
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(title)}</title>
    <link>${esc(baseUrl)}</link>
    <description>${esc(description)}</description>
    <language>zh-cn</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${esc(selfUrl)}" rel="self" type="application/rss+xml"/>
${itemsXml}
  </channel>
</rss>`;
}

module.exports = { buildRssXml };
