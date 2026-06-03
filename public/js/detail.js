// 线路切换
document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('#lineTabs .line-tab');
  const panels = document.querySelectorAll('.line-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const line = tab.dataset.line;
      panels.forEach(p => { p.style.display = p.dataset.line === line ? '' : 'none'; });
    });
  });

  // 自动滚动到当天更新的集数
  const latestEl = document.querySelector('.ep-link.latest');
  if (latestEl) {
    // 如果 latest 所在的 panel 被隐藏，切换到对应 tab
    const panel = latestEl.closest('.line-panel');
    if (panel && panel.style.display === 'none') {
      const lineName = panel.dataset.line;
      const tab = document.querySelector('.line-tab[data-line="' + lineName + '"]');
      if (tab) tab.click();
    }
    setTimeout(() => {
      latestEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
  }
});

// 简介展开/收起
function toggleDesc() {
  const desc = document.getElementById('desc');
  const toggle = document.getElementById('descToggle');
  if (!desc || !toggle) return;
  const expanded = desc.classList.toggle('expanded');
  toggle.textContent = expanded ? '收起 ▲' : '展开全部 ▼';
}
