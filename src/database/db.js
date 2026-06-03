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

  // 关闭数据库
  close() {
    this.save();
    this.db.close();
    console.log('数据库连接已关闭');
  }
}

module.exports = Db;
