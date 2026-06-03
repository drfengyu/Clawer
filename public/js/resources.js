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

// 复制磁力链到剪贴板
function copyMagnet(text) {
  navigator.clipboard.writeText(text).then(() => {
    alert('✅ 磁力链已复制到剪贴板');
  }).catch(() => {
    prompt('请手动复制:', text);
  });
}
