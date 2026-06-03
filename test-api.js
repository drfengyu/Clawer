/**
 * API 测试脚本 - JavaScript 版本
 * 用于测试媒体资源爬虫管理系统的所有API接口
 */

const BASE_URL = 'http://localhost:3000/api';

// 辅助函数
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const printHeader = (text) => {
  console.log('\n' + '='.repeat(60));
  console.log(`   ${text}`);
  console.log('='.repeat(60) + '\n');
};

const printStep = (step, total, text) => {
  console.log(`[${step}/${total}] ${text}`);
  console.log('-'.repeat(60));
};

const printJson = (data) => {
  console.log(JSON.stringify(data, null, 2));
  console.log();
};

// API测试函数
async function testAPI() {
  printHeader('媒体资源爬虫系统 - API 测试');

  try {
    // 1. 测试统计信息
    printStep(1, 10, '测试获取统计信息');
    let response = await fetch(`${BASE_URL}/stats`);
    let data = await response.json();
    printJson(data);

    // 2. 测试添加爬取任务
    printStep(2, 10, '测试添加爬取任务');
    response = await fetch(`${BASE_URL}/crawl`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: 'http://example.com',
        type: 'image'
      })
    });
    data = await response.json();
    printJson(data);
    const taskId = data.data.id;
    console.log(`✓ 任务ID: ${taskId}\n`);
    await sleep(3000); // 等待任务处理

    // 3. 测试获取所有资源
    printStep(3, 10, '测试获取所有资源');
    response = await fetch(`${BASE_URL}/resources`);
    data = await response.json();
    printJson(data);

    // 4. 测试根据ID获取资源
    printStep(4, 10, `测试根据ID获取资源 (ID: ${taskId})`);
    response = await fetch(`${BASE_URL}/resources/${taskId}`);
    data = await response.json();
    printJson(data);

    // 5. 测试根据类型获取资源
    printStep(5, 10, '测试根据类型获取资源 (type: image)');
    response = await fetch(`${BASE_URL}/resources/type/image`);
    data = await response.json();
    printJson(data);

    // 6. 测试根据状态获取资源
    printStep(6, 10, '测试根据状态获取资源 (status: failed)');
    response = await fetch(`${BASE_URL}/resources/status/failed`);
    data = await response.json();
    printJson(data);

    // 7. 测试搜索功能
    printStep(7, 10, '测试搜索功能 (关键词: example)');
    response = await fetch(`${BASE_URL}/search?q=example`);
    data = await response.json();
    printJson(data);

    // 8. 测试获取爬取历史
    printStep(8, 10, '测试获取爬取历史');
    response = await fetch(`${BASE_URL}/history?limit=5`);
    data = await response.json();
    printJson(data);

    // 9. 测试获取下载信息
    printStep(9, 10, `测试获取下载信息 (ID: ${taskId})`);
    response = await fetch(`${BASE_URL}/download/${taskId}`);
    data = await response.json();
    printJson(data);

    // 10. 测试更新后的统计信息
    printStep(10, 10, '测试更新后的统计信息');
    response = await fetch(`${BASE_URL}/stats`);
    data = await response.json();
    printJson(data);

    printHeader('✓ 所有测试完成！');

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
  }
}

// 运行测试
testAPI();
