const axios = require('axios');
const cheerio = require('cheerio');

// 测试脚本 - 爬取合法的免费资源

async function testCrawler() {
  console.log('🧪 开始测试爬虫功能...\n');

  // 测试1: 爬取 Archive.org 的公共领域动画
  try {
    console.log('📺 测试1: Archive.org 公共领域动画');
    const url = 'https://archive.org/details/more_animation';
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);

    // 查找图片
    let imageCount = 0;
    $('img').each((i, elem) => {
      const src = $(elem).attr('src');
      if (src && i < 5) {
        console.log(`  图片 ${i + 1}: ${src}`);
        imageCount++;
      }
    });
    console.log(`  ✅ 找到 ${imageCount}+ 张图片\n`);

  } catch (error) {
    console.log(`  ❌ 测试失败: ${error.message}\n`);
  }

  // 测试2: 爬取简单的测试网站
  try {
    console.log('🌐 测试2: Example.com 测试网站');
    const url = 'http://example.com';
    const response = await axios.get(url, { timeout: 10000 });

    const $ = cheerio.load(response.data);
    const title = $('title').text();
    const h1 = $('h1').text();
    console.log(`  标题: ${title}`);
    console.log(`  H1: ${h1}`);
    console.log(`  ✅ 页面爬取成功\n`);

  } catch (error) {
    console.log(`  ❌ 测试失败: ${error.message}\n`);
  }

  // 测试3: 测试一个包含图片的简单页面
  try {
    console.log('🖼️  测试3: 简单HTML页面图片提取');
    const html = `
      <html>
        <body>
          <img src="https://via.placeholder.com/150" alt="测试图片1">
          <img src="https://via.placeholder.com/200" alt="测试图片2">
          <video>
            <source src="test.mp4" type="video/mp4">
          </video>
        </body>
      </html>
    `;

    const $ = cheerio.load(html);

    const images = [];
    $('img').each((i, elem) => {
      images.push($(elem).attr('src'));
    });

    const videos = [];
    $('video source').each((i, elem) => {
      videos.push($(elem).attr('src'));
    });

    console.log(`  图片: ${images.join(', ')}`);
    console.log(`  视频: ${videos.join(', ')}`);
    console.log(`  ✅ HTML 解析成功\n`);

  } catch (error) {
    console.log(`  ❌ 测试失败: ${error.message}\n`);
  }

  console.log('🎉 测试完成！');
}

testCrawler();
