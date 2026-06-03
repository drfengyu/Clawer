const express = require('express');
const router = express.Router();
const BaseCrawler = require('../crawlers/baseCrawler');

const crawler = new BaseCrawler();

// ==================== 资源管理 API ====================

// 获取所有资源
router.get('/resources', async (req, res) => {
  try {
    const resources = await req.app.locals.db.getAllResources();
    res.json({ success: true, data: resources });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 根据ID获取资源
router.get('/resources/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resource = await req.app.locals.db.getResourceById(id);

    if (!resource) {
      return res.status(404).json({ success: false, error: '资源不存在' });
    }

    res.json({ success: true, data: resource });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 根据类型获取资源
router.get('/resources/type/:type', async (req, res) => {
  try {
    const { type } = req.params;

    if (!['image', 'video', 'audio'].includes(type)) {
      return res.status(400).json({ success: false, error: '无效的资源类型' });
    }

    const resources = await req.app.locals.db.getResourcesByType(type);
    res.json({ success: true, data: resources });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 根据状态获取资源
router.get('/resources/status/:status', async (req, res) => {
  try {
    const { status } = req.params;

    if (!['pending', 'processing', 'completed', 'failed'].includes(status)) {
      return res.status(400).json({ success: false, error: '无效的状态' });
    }

    const resources = await req.app.locals.db.getResourcesByStatus(status);
    res.json({ success: true, data: resources });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 搜索资源
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({ success: false, error: '缺少搜索关键词' });
    }

    const resources = await req.app.locals.db.searchResources(q);
    res.json({ success: true, data: resources });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 添加爬取任务
router.post('/crawl', async (req, res) => {
  try {
    const { url, type } = req.body;

    if (!url || !type) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }

    if (!['image', 'video', 'audio'].includes(type)) {
      return res.status(400).json({ success: false, error: '无效的资源类型' });
    }

    // 保存到数据库
    const result = await req.app.locals.db.addResource(url, type);

    // 异步处理爬取任务
    processTask(result.id, url, type, req.app.locals.db, req.app.locals.downloader);

    res.json({ success: true, data: { id: result.id, message: '任务已添加到队列' } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除资源
router.delete('/resources/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await req.app.locals.db.deleteResource(id);
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 历史记录 API ====================

// 获取爬取历史
router.get('/history', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const history = await req.app.locals.db.getCrawlHistory(parseInt(limit), parseInt(offset));
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 统计 API ====================

// 获取统计信息
router.get('/stats', async (req, res) => {
  try {
    const stats = await req.app.locals.db.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 下载 API ====================

// 下载资源
router.get('/download/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resource = await req.app.locals.db.getResourceById(id);

    if (!resource) {
      return res.status(404).json({ success: false, error: '资源不存在' });
    }

    if (!resource.file_path) {
      return res.status(400).json({ success: false, error: '资源文件不存在' });
    }

    // 更新下载统计
    req.app.locals.db.updateDownloadStats(resource.file_size || 0);

    // 返回文件下载路径
    res.json({
      success: true,
      data: {
        id: resource.id,
        title: resource.title,
        file_path: resource.file_path,
        file_size: resource.file_size,
        download_url: `/${resource.file_path}`
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 辅助函数 ====================

// 异步处理爬取任务
async function processTask(id, url, type, db, downloader) {
  let success = false;
  let errorMessage = null;
  let resourceCount = 0;

  try {
    // 更新状态为处理中
    await db.updateResourceStatus(id, 'processing');

    let mediaItems = [];

    // 根据类型爬取
    switch (type) {
      case 'image':
        mediaItems = await crawler.extractImages(url);
        break;
      case 'video':
        mediaItems = await crawler.extractVideos(url);
        break;
      case 'audio':
        mediaItems = await crawler.extractAudios(url);
        break;
      default:
        throw new Error('不支持的资源类型');
    }

    resourceCount = mediaItems.length;

    if (mediaItems.length === 0) {
      await db.updateResourceStatus(id, 'failed', { title: '未找到资源' });
      errorMessage = '未找到资源';
      db.addCrawlHistory(url, type, 'failed', false, errorMessage, 0);
      db.updateStats(false);
      return;
    }

    // 下载第一个资源
    const firstItem = mediaItems[0];
    const title = firstItem.alt || firstItem.title || await crawler.getPageTitle(url);

    const downloadResult = await downloader.downloadFile(firstItem.url, type, title);

    if (downloadResult.success) {
      await db.updateResourceStatus(id, 'completed', {
        title: title,
        file_path: downloadResult.filepath,
        file_size: downloadResult.size
      });
      success = true;
      db.updateDownloadStats(downloadResult.size);
    } else {
      await db.updateResourceStatus(id, 'failed', { title: downloadResult.error });
      errorMessage = downloadResult.error;
    }

  } catch (error) {
    console.error('处理任务失败:', error);
    await db.updateResourceStatus(id, 'failed', { title: error.message });
    errorMessage = error.message;
  } finally {
    // 记录爬取历史
    db.addCrawlHistory(url, type, success ? 'completed' : 'failed', success, errorMessage, resourceCount);
    db.updateStats(success);
  }
}

module.exports = router;
