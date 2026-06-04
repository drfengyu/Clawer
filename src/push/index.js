// 推送编排：把"今日新增动漫"分发到各渠道（Bark / Server酱 / 邮件）。
// 各渠道未配置则自行静默跳过；任一渠道失败不影响其它。
const bark = require('./bark');
const serverchan = require('./serverchan');
const email = require('./email');

const CHANNELS = [bark, serverchan, email];

/**
 * 推送每日更新摘要。
 * @param {Array<Object>} items  新增动漫行（含 id/title/cover/status）
 * @param {Object} opts
 * @param {string} opts.baseUrl  站点对外基址
 * @returns {Promise<Array>} 各渠道结果
 */
async function pushDailyUpdate(items, opts = {}) {
  const list = items || [];
  if (list.length === 0) {
    console.log('[推送] 今日无新增，跳过');
    return [];
  }

  const baseUrl = opts.baseUrl || process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
  const title = `今日新增 ${list.length} 部动漫更新`;
  const summary = list.slice(0, 8).map((it) => it.title).join('、') + (list.length > 8 ? ' 等' : '');
  const payload = { title, summary, items: list, baseUrl };

  const results = await Promise.allSettled(CHANNELS.map((c) => c.send(payload)));
  const flat = results.map((r) => (r.status === 'fulfilled' ? r.value : { ok: false, error: String(r.reason) }));
  for (const r of flat) {
    if (r.skipped) continue;
    console.log(`[推送] ${r.channel}: ${r.ok ? '成功' : '失败 ' + (r.error || '')}`);
  }
  return flat;
}

module.exports = { pushDailyUpdate };
