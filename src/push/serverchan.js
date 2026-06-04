// Server酱（Server酱·Turbo）推送适配器（微信）。未配置 SERVERCHAN_KEY 则静默跳过。
const axios = require('axios');

async function send({ title, items, baseUrl }) {
  const key = process.env.SERVERCHAN_KEY;
  if (!key) return { channel: 'serverchan', skipped: true };

  const base = (baseUrl || '').replace(/\/$/, '');
  const lines = (items || []).map((it) => {
    const link = `${base}/anime/${it.id}`;
    const tail = it.status ? `（${it.status}）` : '';
    return `- [${it.title}${tail}](${link})`;
  });
  const desp = lines.length ? lines.join('\n') : '今日暂无新增。';

  // SendKey 形如 SCTxxxx → sctapi.ftqq.com；兼容老版 sc.ftqq.com
  const endpoint = key.startsWith('SCT')
    ? `https://sctapi.ftqq.com/${key}.send`
    : `https://sc.ftqq.com/${key}.send`;
  try {
    const res = await axios.post(endpoint, new URLSearchParams({ title, desp }).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000,
    });
    const ok = res.data && (res.data.code === 0 || res.data.errno === 0);
    return { channel: 'serverchan', ok: !!ok };
  } catch (e) {
    return { channel: 'serverchan', ok: false, error: e.message };
  }
}

module.exports = { send };
