const express = require('express');
const router = express.Router();

// 允许浏览的表（白名单 —— 表名/列名无法参数化，必须用白名单防注入）
const TABLES = [
  'animes',
  'anime_episodes',
  'anime_categories',
  'anime_category_links',
  'resources',
  'crawl_history',
  'crawl_stats'
];

// 取原始 sql.js 实例
function rawDb(req) {
  return req.app.locals.db.db;
}

// 取某表的列名（PRAGMA 不支持参数化表名，name 已经过白名单校验）
function getColumns(db, table) {
  const res = db.exec(`PRAGMA table_info(${table})`);
  if (res.length === 0) return [];
  // PRAGMA table_info 列：cid, name, type, notnull, dflt_value, pk
  const nameIdx = res[0].columns.indexOf('name');
  return res[0].values.map(row => row[nameIdx]);
}

// sql.js exec 结果 → 对象数组
function toObjects(res) {
  if (!res || res.length === 0) return [];
  const { columns, values } = res[0];
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

// 表清单 + 每表行数
router.get('/admin/tables', (req, res) => {
  try {
    const db = rawDb(req);
    const data = TABLES.map(name => {
      let count = 0;
      try {
        const r = db.exec(`SELECT COUNT(*) AS c FROM ${name}`);
        if (r.length > 0) count = r[0].values[0][0];
      } catch (e) { /* 表不存在则计 0 */ }
      return { name, count };
    });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 单表数据：分页 + 搜索 + 排序
router.get('/admin/table/:name', (req, res) => {
  try {
    const name = req.params.name;
    if (!TABLES.includes(name)) {
      return res.status(400).json({ success: false, error: '无效的表名' });
    }

    const db = rawDb(req);
    const columns = getColumns(db, name);
    if (columns.length === 0) {
      return res.json({ success: true, data: { columns: [], rows: [], total: 0, page: 1, pageSize: 50 } });
    }

    // 分页参数
    let page = parseInt(req.query.page, 10);
    let pageSize = parseInt(req.query.pageSize, 10);
    if (!Number.isInteger(page) || page < 1) page = 1;
    if (!Number.isInteger(pageSize) || pageSize < 1) pageSize = 50;
    if (pageSize > 200) pageSize = 200;

    // 搜索：跨所有列做参数化 LIKE
    const search = (req.query.search || '').trim();
    let where = '';
    const whereParams = [];
    if (search) {
      const term = `%${search}%`;
      const clauses = columns.map(col => `CAST(${col} AS TEXT) LIKE ?`);
      where = ' WHERE ' + clauses.join(' OR ');
      columns.forEach(() => whereParams.push(term));
    }

    // 排序：仅当排序列在真实列名中时启用，否则按 rowid 倒序（新数据在前）
    const sort = req.query.sort;
    const order = (req.query.order || '').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    let orderBy;
    if (sort && columns.includes(sort)) {
      orderBy = ` ORDER BY ${sort} ${order}`;
    } else {
      orderBy = ' ORDER BY rowid DESC';
    }

    // 总行数（含搜索条件）
    const countRes = db.exec(`SELECT COUNT(*) AS c FROM ${name}${where}`, whereParams);
    const total = countRes.length > 0 ? countRes[0].values[0][0] : 0;

    // 数据页
    const offset = (page - 1) * pageSize;
    const dataRes = db.exec(
      `SELECT * FROM ${name}${where}${orderBy} LIMIT ? OFFSET ?`,
      [...whereParams, pageSize, offset]
    );
    const rows = toObjects(dataRes);

    res.json({ success: true, data: { columns, rows, total, page, pageSize } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
