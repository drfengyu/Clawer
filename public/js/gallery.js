// 画廊分类筛选
document.addEventListener('DOMContentLoaded', () => {
  const tags = document.querySelectorAll('#categoryBar .cat-tag');
  const grid = document.getElementById('animeGrid');
  const cards = grid.querySelectorAll('.anime-card');

  tags.forEach(tag => {
    tag.addEventListener('click', () => {
      tags.forEach(t => t.classList.remove('active'));
      tag.classList.add('active');
      const cat = tag.dataset.cat;

      let visible = 0;
      cards.forEach(card => {
        if (!cat) {
          card.style.display = '';
          visible++;
        } else {
          const cardCats = (card.dataset.cats || '').split(',');
          if (cardCats.includes(cat)) {
            card.style.display = '';
            visible++;
          } else {
            card.style.display = 'none';
          }
        }
      });

      // 空状态提示
      let empty = grid.querySelector('.filter-empty');
      if (visible === 0) {
        if (!empty) {
          empty = document.createElement('div');
          empty.className = 'empty-state filter-empty';
          empty.innerHTML = '<p style="font-size:48px">🔍</p><p>该分类下暂无资源</p>';
          grid.appendChild(empty);
        }
      } else if (empty) {
        empty.remove();
      }
    });
  });
});
