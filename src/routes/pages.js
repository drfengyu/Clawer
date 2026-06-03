const express = require('express');
const router = express.Router();

// 首页
router.get('/', (req, res) => {
  res.render('index', { title: '媒体资源爬虫管理系统' });
});

// 资源列表页面
router.get('/resources', async (req, res) => {
  try {
    const resources = await req.app.locals.db.getAllResources();
    res.render('resources', { title: '资源列表', resources });
  } catch (error) {
    res.status(500).render('error', { error: error.message });
  }
});

module.exports = router;
