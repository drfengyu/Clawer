// 主页面表单提交逻辑
document.getElementById('crawlForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const url = document.getElementById('url').value;
  const type = document.getElementById('type').value;
  const messageEl = document.getElementById('message');

  // 显示加载状态
  showMessage('正在添加任务...', 'success');

  try {
    const response = await fetch('/api/crawl', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url, type })
    });

    const result = await response.json();

    if (result.success) {
      showMessage('✅ 任务已添加！正在处理中，请到资源列表查看', 'success');

      // 清空表单
      document.getElementById('crawlForm').reset();

      // 3秒后跳转到资源列表
      setTimeout(() => {
        window.location.href = '/resources';
      }, 2000);
    } else {
      showMessage('❌ 错误: ' + result.error, 'error');
    }
  } catch (error) {
    showMessage('❌ 网络错误: ' + error.message, 'error');
  }
});

function showMessage(text, type) {
  const messageEl = document.getElementById('message');
  messageEl.textContent = text;
  messageEl.className = `message ${type} show`;

  // 5秒后自动隐藏错误消息
  if (type === 'error') {
    setTimeout(() => {
      messageEl.classList.remove('show');
    }, 5000);
  }
}
