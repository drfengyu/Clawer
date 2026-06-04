// 邮件（SMTP）推送适配器。SMTP_HOST/USER/PASS/MAIL_TO 未配齐则静默跳过。
const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || 'true') === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}

function buildHtml(title, items, baseUrl) {
  const base = (baseUrl || '').replace(/\/$/, '');
  const rows = (items || []).map((it) => {
    const link = `${base}/anime/${it.id}`;
    const cover = it.cover
      ? `<img src="${it.cover}" referrerpolicy="no-referrer" style="width:80px;border-radius:4px;vertical-align:middle"/>`
      : '';
    const tail = it.status ? `<span style="color:#888">（${it.status}）</span>` : '';
    return `<tr>
      <td style="padding:6px 8px">${cover}</td>
      <td style="padding:6px 8px"><a href="${link}" style="color:#fb7299;text-decoration:none">${it.title}</a> ${tail}</td>
    </tr>`;
  }).join('');
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif">
    <h2 style="color:#fb7299">${title}</h2>
    <table style="border-collapse:collapse;width:100%">${rows}</table>
    <p style="color:#aaa;font-size:12px;margin-top:16px">本邮件由动漫爬虫系统自动发送。</p>
  </div>`;
}

async function send({ title, items, baseUrl }) {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS, MAIL_TO } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !MAIL_TO) {
    return { channel: 'email', skipped: true };
  }
  try {
    await getTransporter().sendMail({
      from: process.env.MAIL_FROM || SMTP_USER,
      to: MAIL_TO,
      subject: title,
      html: buildHtml(title, items, baseUrl),
    });
    return { channel: 'email', ok: true };
  } catch (e) {
    return { channel: 'email', ok: false, error: e.message };
  }
}

module.exports = { send };
