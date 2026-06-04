// Bark 推送适配器（iOS）。未配置 BARK_KEY 则静默跳过。
const axios = require('axios');

async function send({ title, summary }) {
  const key = process.env.BARK_KEY;
  if (!key) return { channel: 'bark', skipped: true };

  const server = (process.env.BARK_SERVER || 'https://api.day.app').replace(/\/$/, '');
  const url = `${server}/${key}/${encodeURIComponent(title)}/${encodeURIComponent(summary || '')}`;
  try {
    const res = await axios.get(url, {
      params: { group: '每日动漫', isArchive: 1 },
      timeout: 10000,
    });
    const ok = res.data && (res.data.code === 200 || res.status === 200);
    return { channel: 'bark', ok: !!ok };
  } catch (e) {
    return { channel: 'bark', ok: false, error: e.message };
  }
}

module.exports = { send };
