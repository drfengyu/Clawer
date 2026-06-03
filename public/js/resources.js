// 删除资源
async function deleteResource(id) {
  if (!confirm('确定要删除这个资源吗？')) {
    return;
  }

  try {
    const response = await fetch(`/api/resources/${id}`, {
      method: 'DELETE'
    });

    const result = await response.json();

    if (result.success) {
      alert('✅ 删除成功');
      location.reload();
    } else {
      alert('❌ 删除失败: ' + result.error);
    }
  } catch (error) {
    alert('❌ 网络错误: ' + error.message);
  }
}

// 自动刷新处理中的任务
function autoRefresh() {
  const processingCards = document.querySelectorAll('.resource-card[data-status="processing"], .resource-card[data-status="pending"]');

  if (processingCards.length > 0) {
    // 每5秒刷新一次
    setTimeout(() => {
      location.reload();
    }, 5000);
  }
}

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', () => {
  autoRefresh();
});
