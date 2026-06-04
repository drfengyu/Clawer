const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

class Db {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
    this.ready = this.init();
  }

  async init() {
    try {
      const SQL = await initSqlJs();

      // 尝试从文件加载数据库
      if (fs.existsSync(this.dbPath)) {
        const buffer = fs.readFileSync(this.dbPath);
        this.db = new SQL.Database(buffer);
        console.log('✅ 数据库加载成功');
      } else {
        this.db = new SQL.Database();
        console.log('✅ 创建新数据库');
      }

      this.initTables();
      this.save();
      return true;
    } catch (err) {
      console.error('数据库初始化失败:', err);
      throw err;
    }
  }

  initTables() {
    const createResourcesTable = `
      CREATE TABLE IF NOT EXISTS resources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        title TEXT,
        type TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        file_path TEXT,
        file_size INTEGER,
        thumbnail TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createHistoryTable = `
      CREATE TABLE IF NOT EXISTS crawl_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        success INTEGER DEFAULT 0,
        error_message TEXT,
        resource_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createStatsTable = `
      CREATE TABLE IF NOT EXISTS crawl_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        total_crawls INTEGER DEFAULT 0,
        success_crawls INTEGER DEFAULT 0,
        failed_crawls INTEGER DEFAULT 0,
        total_downloads INTEGER DEFAULT 0,
        total_size INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    try {
      this.db.run(createResourcesTable);
      this.db.run(createHistoryTable);
      this.db.run(createStatsTable);

      // 动漫相关表
      this.db.run(this._getAnimeTableDDL());
      this.db.run(this._getCategoryTableDDL());
      this.db.run(this._getCategoryLinkTableDDL());
      this.db.run(this._getEpisodeTableDDL());

      // 旧库结构迁移
      this._migrate();

      // 初始化统计数据
      const checkStats = this.db.exec('SELECT COUNT(*) as count FROM crawl_stats');
      if (checkStats.length === 0 || checkStats[0].values[0][0] === 0) {
        this.db.run('INSERT INTO crawl_stats (total_crawls) VALUES (0)');
      }

      console.log('✅ 数据表初始化完成');
    } catch (err) {
      console.error('创建表失败:', err);
      throw err;
    }
  }

  // 旧库结构迁移：补缺失列（CREATE TABLE IF NOT EXISTS 对已存在的表不生效）
  _migrate() {
    // animes.site_type：记录数据由哪个爬虫产出
    const cols = this.db.exec('PRAGMA table_info(animes)');
    const hasSiteType = cols.length > 0 && cols[0].values.some(row => row[1] === 'site_type');
    if (!hasSiteType) {
      this.db.run(`ALTER TABLE animes ADD COLUMN site_type TEXT DEFAULT ''`);
      // 现有数据均来自 maccms 站点，回填
      this.db.run(`UPDATE animes SET site_type='maccms' WHERE site_type IS NULL OR site_type=''`);
      console.log('✅ 迁移：animes 表新增 site_type 列并回填 maccms');
    }
  }

  // 保存数据库到文件
  save() {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  // 添加资源
  addResource(url, type) {
    const sql = 'INSERT INTO resources (url, type, status) VALUES (?, ?, ?)';
    this.db.run(sql, [url, type, 'pending']);

    // 获取最后插入的ID
    const result = this.db.exec('SELECT last_insert_rowid() as id');
    const id = result[0].values[0][0];

    this.save();
    return { id };
  }

  // 获取所有资源
  getAllResources() {
    const sql = 'SELECT * FROM resources ORDER BY created_at DESC';
    const result = this.db.exec(sql);

    if (result.length === 0) return [];

    const columns = result[0].columns;
    const values = result[0].values;

    return values.map(row => {
      const obj = {};
      columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj;
    });
  }

  // 根据ID获取资源
  getResourceById(id) {
    const sql = 'SELECT * FROM resources WHERE id = ?';
    const result = this.db.exec(sql, [id]);

    if (result.length === 0) return null;

    const columns = result[0].columns;
    const values = result[0].values[0];

    if (!values) return null;

    const obj = {};
    columns.forEach((col, i) => {
      obj[col] = values[i];
    });
    return obj;
  }

  // 更新资源状态
  updateResourceStatus(id, status, data = {}) {
    const fields = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const values = [status];

    if (data.title) {
      fields.push('title = ?');
      values.push(data.title);
    }
    if (data.file_path) {
      fields.push('file_path = ?');
      values.push(data.file_path);
    }
    if (data.file_size) {
      fields.push('file_size = ?');
      values.push(data.file_size);
    }
    if (data.thumbnail) {
      fields.push('thumbnail = ?');
      values.push(data.thumbnail);
    }

    values.push(id);

    const sql = `UPDATE resources SET ${fields.join(', ')} WHERE id = ?`;
    this.db.run(sql, values);
    this.save();

    return { changes: 1 };
  }

  // 删除资源
  deleteResource(id) {
    const sql = 'DELETE FROM resources WHERE id = ?';
    this.db.run(sql, [id]);
    this.save();

    return { changes: 1 };
  }

  // 添加爬取历史记录
  addCrawlHistory(url, type, status, success, errorMessage = null, resourceCount = 0) {
    const sql = `INSERT INTO crawl_history (url, type, status, success, error_message, resource_count)
                 VALUES (?, ?, ?, ?, ?, ?)`;
    this.db.run(sql, [url, type, status, success ? 1 : 0, errorMessage, resourceCount]);
    this.save();
  }

  // 获取爬取历史
  getCrawlHistory(limit = 50, offset = 0) {
    const sql = 'SELECT * FROM crawl_history ORDER BY created_at DESC LIMIT ? OFFSET ?';
    const result = this.db.exec(sql, [limit, offset]);

    if (result.length === 0) return [];

    const columns = result[0].columns;
    const values = result[0].values;

    return values.map(row => {
      const obj = {};
      columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj;
    });
  }

  // 获取统计信息
  getStats() {
    const sql = 'SELECT * FROM crawl_stats LIMIT 1';
    const result = this.db.exec(sql);

    if (result.length === 0) return null;

    const columns = result[0].columns;
    const values = result[0].values[0];

    if (!values) return null;

    const obj = {};
    columns.forEach((col, i) => {
      obj[col] = values[i];
    });
    return obj;
  }

  // 更新统计信息
  updateStats(success) {
    const sql = `UPDATE crawl_stats SET
                 total_crawls = total_crawls + 1,
                 success_crawls = success_crawls + ?,
                 failed_crawls = failed_crawls + ?,
                 updated_at = CURRENT_TIMESTAMP
                 WHERE id = 1`;
    this.db.run(sql, [success ? 1 : 0, success ? 0 : 1]);
    this.save();
  }

  // 更新下载统计
  updateDownloadStats(fileSize) {
    const sql = `UPDATE crawl_stats SET
                 total_downloads = total_downloads + 1,
                 total_size = total_size + ?,
                 updated_at = CURRENT_TIMESTAMP
                 WHERE id = 1`;
    this.db.run(sql, [fileSize]);
    this.save();
  }

  // 根据类型获取资源
  getResourcesByType(type) {
    const sql = 'SELECT * FROM resources WHERE type = ? ORDER BY created_at DESC';
    const result = this.db.exec(sql, [type]);

    if (result.length === 0) return [];

    const columns = result[0].columns;
    const values = result[0].values;

    return values.map(row => {
      const obj = {};
      columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj;
    });
  }

  // 根据状态获取资源
  getResourcesByStatus(status) {
    const sql = 'SELECT * FROM resources WHERE status = ? ORDER BY created_at DESC';
    const result = this.db.exec(sql, [status]);

    if (result.length === 0) return [];

    const columns = result[0].columns;
    const values = result[0].values;

    return values.map(row => {
      const obj = {};
      columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj;
    });
  }

  // 搜索资源
  searchResources(keyword) {
    const sql = `SELECT * FROM resources
                 WHERE url LIKE ? OR title LIKE ?
                 ORDER BY created_at DESC`;
    const searchTerm = `%${keyword}%`;
    const result = this.db.exec(sql, [searchTerm, searchTerm]);

    if (result.length === 0) return [];

    const columns = result[0].columns;
    const values = result[0].values;

    return values.map(row => {
      const obj = {};
      columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj;
    });
  }

  // ─── Anime DDL ──────────────────────────────────────────

  _getAnimeTableDDL() {
    return `CREATE TABLE IF NOT EXISTS animes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id TEXT NOT NULL,
      site_url TEXT NOT NULL,
      site_type TEXT DEFAULT '',
      title TEXT NOT NULL,
      cover TEXT,
      score REAL DEFAULT 0,
      status TEXT,
      description TEXT,
      meta TEXT DEFAULT '',
      update_date TEXT,
      detail_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(source_id, site_url)
    )`;
  }

  _getCategoryTableDDL() {
    return `CREATE TABLE IF NOT EXISTS anime_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )`;
  }

  _getCategoryLinkTableDDL() {
    return `CREATE TABLE IF NOT EXISTS anime_category_links (
      anime_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      PRIMARY KEY (anime_id, category_id),
      FOREIGN KEY (anime_id) REFERENCES animes(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES anime_categories(id) ON DELETE CASCADE
    )`;
  }

  _getEpisodeTableDDL() {
    return `CREATE TABLE IF NOT EXISTS anime_episodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anime_id INTEGER NOT NULL,
      line_name TEXT NOT NULL,
      ep_number INTEGER NOT NULL,
      label TEXT,
      play_url TEXT,
      video_url TEXT,
      video_url_next TEXT,
      download_path TEXT,
      download_status TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (anime_id) REFERENCES animes(id) ON DELETE CASCADE
    )`;
  }

  // ─── Anime CRUD ─────────────────────────────────────────

  upsertAnime(data) {
    const existing = this.db.exec(
      'SELECT id FROM animes WHERE source_id = ? AND site_url = ?',
      [data.sourceId, data.siteUrl]
    );
    if (existing.length > 0 && existing[0].values.length > 0) {
      const id = existing[0].values[0][0];
      // site_type 传空则保留原值，避免某调用点漏传把列清空
      this.db.run(
        `UPDATE animes SET title=?, cover=?, score=?, status=?, description=?, meta=?, update_date=?, detail_url=?, site_type=COALESCE(NULLIF(?, ''), site_type), updated_at=CURRENT_TIMESTAMP WHERE id=?`,
        [data.title, data.cover, data.score, data.status, data.description || '', data.meta || '', data.updateDate || '', data.detailUrl || '', data.siteType || '', id]
      );
      return id;
    }
    this.db.run(
      `INSERT INTO animes (source_id, site_url, site_type, title, cover, score, status, description, meta, update_date, detail_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.sourceId, data.siteUrl, data.siteType || '', data.title, data.cover, data.score, data.status, data.description || '', data.meta || '', data.updateDate || '', data.detailUrl || '']
    );
    const res = this.db.exec('SELECT last_insert_rowid() as id');
    this.save();
    return res[0].values[0][0];
  }

  getAnimeById(id) {
    const res = this.db.exec('SELECT * FROM animes WHERE id = ?', [id]);
    if (res.length === 0 || res[0].values.length === 0) return null;
    return this._rowToObj(res[0].columns, res[0].values[0]);
  }

  getAnimeBySourceId(sourceId, siteUrl) {
    const res = this.db.exec('SELECT * FROM animes WHERE source_id = ? AND site_url = ?', [sourceId, siteUrl]);
    if (res.length === 0 || res[0].values.length === 0) return null;
    return this._rowToObj(res[0].columns, res[0].values[0]);
  }

  // 构造分区/搜索的 FROM + WHERE（getAllAnimes 与 countAnimes 共用，保证条件一致）
  _animesFromWhere(category, keyword) {
    let sql = ' FROM animes a';
    const params = [];
    const conds = [];
    if (category) {
      sql += ' JOIN anime_category_links acl ON a.id = acl.anime_id JOIN anime_categories ac ON acl.category_id = ac.id';
      conds.push('ac.name = ?');
      params.push(category);
    }
    if (keyword) {
      conds.push('(a.title LIKE ? OR a.description LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
    return { sql, params };
  }

  getAllAnimes(opts = {}) {
    const { category, keyword, sort = 'update_date', order = 'DESC', limit = 50, offset = 0 } = opts;
    const { sql: fw, params } = this._animesFromWhere(category, keyword);
    const validSort = ['update_date', 'score', 'title', 'created_at'].includes(sort) ? sort : 'update_date';
    // 次级排序按 created_at，让无日期的同步片也有稳定顺序
    const sql = `SELECT DISTINCT a.*${fw} ORDER BY a.${validSort} ${order === 'ASC' ? 'ASC' : 'DESC'}, a.created_at DESC LIMIT ? OFFSET ?`;
    const res = this.db.exec(sql, [...params, limit, offset]);
    if (res.length === 0 || res[0].values.length === 0) return [];
    return res[0].values.map(row => this._rowToObj(res[0].columns, row));
  }

  // 分区/搜索结果总数（分页算总页数用），WHERE 与 getAllAnimes 对齐
  countAnimes(opts = {}) {
    const { category, keyword } = opts;
    const { sql: fw, params } = this._animesFromWhere(category, keyword);
    const res = this.db.exec(`SELECT COUNT(DISTINCT a.id)${fw}`, params);
    if (res.length === 0 || res[0].values.length === 0) return 0;
    return res[0].values[0][0];
  }

  getAnimesByUpdateDate(dateStr) {
    const res = this.db.exec(
      'SELECT DISTINCT a.* FROM animes a WHERE a.update_date LIKE ? ORDER BY a.score DESC LIMIT 100',
      [`%${dateStr}%`]
    );
    if (res.length === 0 || res[0].values.length === 0) return [];
    return res[0].values.map(row => this._rowToObj(res[0].columns, row));
  }

  // 最近一次更新日期（仅取有分集的每日更新动漫，格式 YYYY-MM-DD）
  getLatestUpdateDate() {
    const res = this.db.exec(
      `SELECT a.update_date FROM animes a
       WHERE a.update_date LIKE '____-__-__' ESCAPE '\\'
       AND LENGTH(a.update_date) = 10
       AND EXISTS (SELECT 1 FROM anime_episodes e WHERE e.anime_id = a.id)
       ORDER BY a.update_date DESC LIMIT 1`
    );
    if (res.length === 0 || res[0].values.length === 0) return null;
    return res[0].values[0][0];
  }

  // 时间轴：按天聚合的更新日期（YYYY-MM-DD）列表，含当天更新数量，分页用
  getUpdateDates(limit = 14, offset = 0) {
    const res = this.db.exec(
      `SELECT update_date, COUNT(*) AS cnt FROM animes
       WHERE update_date LIKE '____-__-__' ESCAPE '\\'
       AND LENGTH(update_date) = 10
       GROUP BY update_date ORDER BY update_date DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    if (res.length === 0 || res[0].values.length === 0) return [];
    return res[0].values.map(v => ({ date: v[0], count: v[1] }));
  }

  // 时间轴分页：有效更新日期（去重）的总天数
  countUpdateDates() {
    const res = this.db.exec(
      `SELECT COUNT(DISTINCT update_date) FROM animes
       WHERE update_date LIKE '____-__-__' ESCAPE '\\'
       AND LENGTH(update_date) = 10`
    );
    if (res.length === 0 || res[0].values.length === 0) return 0;
    return res[0].values[0][0];
  }

  searchAnimes(keyword) {
    const res = this.db.exec(
      'SELECT * FROM animes WHERE title LIKE ? OR description LIKE ? ORDER BY update_date DESC LIMIT 50',
      [`%${keyword}%`, `%${keyword}%`]
    );
    if (res.length === 0 || res[0].values.length === 0) return [];
    return res[0].values.map(row => this._rowToObj(res[0].columns, row));
  }

  // ─── Category CRUD ──────────────────────────────────────

  getOrCreateCategory(name) {
    // 拒绝明显污染的类别名（长度 > 6 的一般是整段 HTML 文本）
    if (!name || name.length > 6) return null;
    const existing = this.db.exec('SELECT id FROM anime_categories WHERE name = ?', [name]);
    if (existing.length > 0 && existing[0].values.length > 0) return existing[0].values[0][0];
    this.db.run('INSERT INTO anime_categories (name) VALUES (?)', [name]);
    const res = this.db.exec('SELECT last_insert_rowid() as id');
    this.save();
    return res[0].values[0][0];
  }

  linkAnimeCategory(animeId, categoryId) {
    if (!categoryId) return;
    try {
      this.db.run('INSERT OR IGNORE INTO anime_category_links (anime_id, category_id) VALUES (?, ?)', [animeId, categoryId]);
    } catch (e) { /* ignore duplicate */ }
  }

  getCategoriesByAnime(animeId) {
    const res = this.db.exec(
      'SELECT ac.* FROM anime_categories ac JOIN anime_category_links acl ON ac.id = acl.category_id WHERE acl.anime_id = ?',
      [animeId]
    );
    if (res.length === 0 || res[0].values.length === 0) return [];
    return res[0].values.map(row => this._rowToObj(res[0].columns, row));
  }

  getAllCategories() {
    const res = this.db.exec('SELECT ac.*, COUNT(acl.anime_id) as anime_count FROM anime_categories ac LEFT JOIN anime_category_links acl ON ac.id = acl.category_id GROUP BY ac.id ORDER BY anime_count DESC');
    if (res.length === 0 || res[0].values.length === 0) return [];
    return res[0].values.map(row => this._rowToObj(res[0].columns, row));
  }

  // ─── Episode CRUD ───────────────────────────────────────

  upsertEpisode(animeId, data) {
    const existing = this.db.exec(
      'SELECT id FROM anime_episodes WHERE anime_id = ? AND ep_number = ? AND line_name = ?',
      [animeId, data.epNumber, data.lineName]
    );
    if (existing.length > 0 && existing[0].values.length > 0) {
      const id = existing[0].values[0][0];
      this.db.run(
        'UPDATE anime_episodes SET label=?, play_url=?, video_url=?, video_url_next=? WHERE id=?',
        [data.label || '', data.playUrl || '', data.videoUrl || '', data.videoUrlNext || '', id]
      );
      return id;
    }
    this.db.run(
      'INSERT INTO anime_episodes (anime_id, line_name, ep_number, label, play_url, video_url, video_url_next) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [animeId, data.lineName, data.epNumber, data.label || '', data.playUrl || '', data.videoUrl || '', data.videoUrlNext || '']
    );
    const res = this.db.exec('SELECT last_insert_rowid() as id');
    this.save();
    return res[0].values[0][0];
  }

  getEpisodesByAnime(animeId) {
    const res = this.db.exec(
      'SELECT * FROM anime_episodes WHERE anime_id = ? ORDER BY line_name, ep_number',
      [animeId]
    );
    if (res.length === 0 || res[0].values.length === 0) return [];
    return res[0].values.map(row => this._rowToObj(res[0].columns, row));
  }

  getEpisodeById(epId) {
    const res = this.db.exec('SELECT * FROM anime_episodes WHERE id = ?', [epId]);
    if (res.length === 0 || res[0].values.length === 0) return null;
    return this._rowToObj(res[0].columns, res[0].values[0]);
  }

  updateEpisodeVideoUrl(epId, videoUrl, videoUrlNext = '') {
    this.db.run(
      'UPDATE anime_episodes SET video_url = ?, video_url_next = ? WHERE id = ?',
      [videoUrl, videoUrlNext, epId]
    );
    this.save();
  }

  updateEpisodeDownloadStatus(epId, status, path = '') {
    this.db.run(
      'UPDATE anime_episodes SET download_status = ?, download_path = ? WHERE id = ?',
      [status, path, epId]
    );
    this.save();
  }

  deleteAnimeEpisodes(animeId) {
    this.db.run('DELETE FROM anime_episodes WHERE anime_id = ?', [animeId]);
    this.save();
  }

  // ─── Helper ─────────────────────────────────────────────

  _rowToObj(columns, values) {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = values[i]; });
    return obj;
  }

  // ─── Close ──────────────────────────────────────────────
  close() {
    this.save();
    this.db.close();
    console.log('数据库连接已关闭');
  }
}

module.exports = Db;
