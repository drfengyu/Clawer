/**
 * 小说 API 路由
 *
 * 提供小说爬取、搜索、详情、章节等接口
 */

const express = require('express');
const router = express.Router();
const NovelCrawler = require('../crawlers/novelCrawler');

// 创建爬虫实例
const crawler = new NovelCrawler();

/**
 * POST /api/novel/crawl-home
 * 爬取首页小说列表（只抓元数据，不抓章节内容）
 */
router.post('/crawl-home', async (req, res) => {
  try {
    const novels = await crawler.crawlHomePage();
    const db = req.app.locals.db;

    let added = 0;
    for (const novel of novels) {
      const novelId = db.upsertNovel({
        ...novel,
        author: novel.author || '未知作者',
        cover: novel.cover || '',
        description: novel.description || '',
        category: novel.category || '其他',
        status: novel.status || '连载中',
        wordCount: novel.wordCount || 0,
        updateDate: new Date().toISOString().split('T')[0]
      });
      if (novelId) added++;
    }

    res.json({
      success: true,
      message: `成功抓取 ${novels.length} 本小说，新增/更新 ${added} 本`,
      novels
    });
  } catch (error) {
    console.error('爬取首页失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/novel/crawl-detail
 * 爬取小说详情（包含书名、作者、封面、简介、章节列表）
 * Body: { bookId: string }
 */
router.post('/crawl-detail', async (req, res) => {
  const { bookId } = req.body;
  if (!bookId) {
    return res.status(400).json({ success: false, message: '缺少 bookId 参数' });
  }

  try {
    const data = await crawler.crawlDetail(bookId);
    const db = req.app.locals.db;

    // 入库小说信息
    const novelId = db.upsertNovel(data.novel);

    // 入库章节列表（不含正文，正文按需抓取）
    let chapterCount = 0;
    for (const ch of data.chapters) {
      db.upsertChapter({
        novelId,
        sourceId: ch.sourceId,
        chapterNumber: ch.chapterNumber,
        title: ch.title,
        content: '',  // 暂不抓正文
        wordCount: 0,
        isVip: false
      });
      chapterCount++;
    }

    res.json({
      success: true,
      message: `成功抓取小说《${data.novel.title}》，章节数: ${chapterCount}`,
      novelId,
      novel: data.novel,
      chapterCount
    });
  } catch (error) {
    console.error('爬取详情失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/novel/list
 * 获取小说列表（分页、搜索、分类筛选）
 * Query: page, pageSize, keyword, category
 */
router.get('/list', (req, res) => {
  const db = req.app.locals.db;
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 60;
  const keyword = req.query.keyword || '';
  const category = req.query.category || '';

  const offset = (page - 1) * pageSize;
  const novels = db.getAllNovels({ limit: pageSize, offset, keyword, category });
  const total = db.countNovels({ keyword, category });

  res.json({
    success: true,
    novels,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    }
  });
});

/**
 * GET /api/novel/:id
 * 获取小说详情
 */
router.get('/:id', (req, res) => {
  const db = req.app.locals.db;
  const novel = db.getNovelById(req.params.id);

  if (!novel) {
    return res.status(404).json({ success: false, message: '小说不存在' });
  }

  res.json({ success: true, novel });
});

/**
 * GET /api/novel/:id/chapters
 * 获取小说的章节列表
 */
router.get('/:id/chapters', (req, res) => {
  const db = req.app.locals.db;
  const chapters = db.getChaptersByNovelId(req.params.id);

  res.json({ success: true, chapters });
});

/**
 * GET /api/novel/chapter/:chapterId
 * 获取章节内容（如果数据库没有正文，则实时爬取）
 */
router.get('/chapter/:chapterId', async (req, res) => {
  const db = req.app.locals.db;
  const chapter = db.getChapterById(req.params.chapterId);

  if (!chapter) {
    return res.status(404).json({ success: false, message: '章节不存在' });
  }

  // 如果数据库中已有正文，直接返回
  if (chapter.content && chapter.content.trim()) {
    return res.json({ success: true, chapter });
  }

  // 否则实时爬取
  try {
    const novel = db.getNovelById(chapter.novel_id);
    if (!novel) {
      return res.status(404).json({ success: false, message: '小说不存在' });
    }

    const crawledChapter = await crawler.crawlChapter(novel.source_id, chapter.source_id);

    // 更新数据库
    db.upsertChapter({
      novelId: chapter.novel_id,
      sourceId: chapter.source_id,
      chapterNumber: chapter.chapter_number,
      title: crawledChapter.title,
      content: crawledChapter.content,
      wordCount: crawledChapter.content.length,
      isVip: false
    });

    // 返回最新数据
    const updated = db.getChapterById(req.params.chapterId);
    res.json({ success: true, chapter: updated });
  } catch (error) {
    console.error('爬取章节失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * DELETE /api/novel/:id
 * 删除小说（包括所有章节）
 */
router.delete('/:id', (req, res) => {
  const db = req.app.locals.db;
  const novel = db.getNovelById(req.params.id);

  if (!novel) {
    return res.status(404).json({ success: false, message: '小说不存在' });
  }

  db.deleteNovelChapters(req.params.id);
  db.deleteNovel(req.params.id);

  res.json({ success: true, message: '删除成功' });
});

module.exports = router;
