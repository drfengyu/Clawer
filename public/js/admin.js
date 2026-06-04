// 数据库后台 —— 只读通用表浏览器

// 表名 → 中文标签
const TABLE_LABELS = {
  animes: '动漫',
  anime_episodes: '分集',
  anime_categories: '分类',
  anime_category_links: '分类关联',
  resources: '资源',
  crawl_history: '爬取历史',
  crawl_stats: '统计'
};

const state = {
  table: null,
  page: 1,
  pageSize: 50,
  search: '',
  sort: null,
  order: 'DESC'
};

let autoTimer = null;
let searchDebounce = null;

// ─── DOM ─────────────────────────────────────────────
const $ = id => document.getElementById(id);
const tabsEl = $('tabs');
const stateEl = $('state');
const tableEl = $('dataTable');
const theadEl = $('thead');
const tbodyEl = $('tbody');
const pagerEl = $('pager');
const pageInfoEl = $('pageInfo');
const tableMetaEl = $('tableMeta');

// ─── 初始化 ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);

async function init() {
  $('refreshBtn').addEventListener('click', () => loadTable());
  $('autoRefresh').addEventListener('change', e => toggleAuto(e.target.checked));
  $('prevBtn').addEventListener('click', () => { if (state.page > 1) { state.page--; loadTable(); } });
  $('nextBtn').addEventListener('click', () => { state.page++; loadTable(); });
  $('searchInput').addEventListener('input', e => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      state.search = e.target.value.trim();
      state.page = 1;
      loadTable();
    }, 300);
  });

  await loadTabs();
}

// 加载表清单 → 渲染标签
async function loadTabs() {
  try {
    const json = await fetchJson('/api/admin/tables');
    tabsEl.innerHTML = '';
    json.data.forEach((t, i) => {
      const tab = document.createElement('div');
      tab.className = 'tab' + (i === 0 ? ' active' : '');
      tab.dataset.table = t.name;
      tab.innerHTML = `${TABLE_LABELS[t.name] || t.name}<span class="count">${t.count}</span>`;
      tab.addEventListener('click', () => selectTable(t.name));
      tabsEl.appendChild(tab);
    });
    if (json.data.length > 0) {
      state.table = json.data[0].name;
      loadTable();
    } else {
      showState('没有可浏览的表');
    }
  } catch (e) {
    showState('加载表清单失败: ' + e.message, true);
  }
}

function selectTable(name) {
  if (state.table === name) return;
  state.table = name;
  state.page = 1;
  state.search = '';
  state.sort = null;
  state.order = 'DESC';
  $('searchInput').value = '';
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.table === name);
  });
  loadTable();
}

// 加载当前表数据
async function loadTable() {
  if (!state.table) return;
  const params = new URLSearchParams({
    page: state.page,
    pageSize: state.pageSize
  });
  if (state.search) params.set('search', state.search);
  if (state.sort) { params.set('sort', state.sort); params.set('order', state.order); }

  try {
    const json = await fetchJson(`/api/admin/table/${encodeURIComponent(state.table)}?${params}`);
    render(json.data);
  } catch (e) {
    showState('加载数据失败: ' + e.message, true);
  }
}

// ─── 渲染 ────────────────────────────────────────────
function render(data) {
  const { columns, rows, total, page, pageSize } = data;

  if (columns.length === 0) {
    showState('该表无字段');
    return;
  }

  // 表头（可点击排序）
  theadEl.innerHTML = '';
  const trh = document.createElement('tr');
  columns.forEach(col => {
    const th = document.createElement('th');
    let arrow = '';
    if (state.sort === col) arrow = `<span class="arrow">${state.order === 'ASC' ? '▲' : '▼'}</span>`;
    th.innerHTML = col + arrow;
    th.addEventListener('click', () => sortBy(col));
    trh.appendChild(th);
  });
  theadEl.appendChild(trh);

  // 表体
  tbodyEl.innerHTML = '';
  if (rows.length === 0) {
    showState(state.search ? '没有匹配的记录' : '该表暂无数据');
    // 仍渲染表头便于查看结构
    tableEl.style.display = '';
    stateEl.style.display = 'block';
    pagerEl.style.display = 'none';
    tableMetaEl.textContent = `共 0 行`;
    return;
  }

  rows.forEach(row => {
    const tr = document.createElement('tr');
    columns.forEach(col => {
      const td = document.createElement('td');
      const val = row[col];
      if (val === null || val === undefined) {
        td.className = 'null';
        td.textContent = 'NULL';
      } else {
        const span = document.createElement('span');
        span.className = 'cell';
        const text = String(val);
        span.textContent = text;
        span.title = text;
        span.addEventListener('click', () => span.classList.toggle('expanded'));
        td.appendChild(span);
      }
      tr.appendChild(td);
    });
    tbodyEl.appendChild(tr);
  });

  // 显示表格、分页
  stateEl.style.display = 'none';
  tableEl.style.display = '';
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  pagerEl.style.display = 'flex';
  pageInfoEl.textContent = `第 ${page} / ${totalPages} 页`;
  $('prevBtn').disabled = page <= 1;
  $('nextBtn').disabled = page >= totalPages;
  tableMetaEl.textContent = `共 ${total} 行 · 每页 ${pageSize}`;
}

function sortBy(col) {
  if (state.sort === col) {
    state.order = state.order === 'ASC' ? 'DESC' : 'ASC';
  } else {
    state.sort = col;
    state.order = 'ASC';
  }
  state.page = 1;
  loadTable();
}

function showState(msg, isError) {
  stateEl.textContent = msg;
  stateEl.className = 'state' + (isError ? ' error' : '');
  stateEl.style.display = 'block';
  tableEl.style.display = 'none';
  pagerEl.style.display = 'none';
}

// ─── 自动刷新 ────────────────────────────────────────
function toggleAuto(on) {
  if (on) {
    autoTimer = setInterval(refreshKeepState, 5000);
  } else {
    clearInterval(autoTimer);
    autoTimer = null;
  }
}

// 自动刷新：保持当前表/页/搜索/排序，仅重拉数据与角标
async function refreshKeepState() {
  loadTable();
  // 顺带更新标签角标
  try {
    const json = await fetchJson('/api/admin/tables');
    json.data.forEach(t => {
      const tab = tabsEl.querySelector(`.tab[data-table="${t.name}"] .count`);
      if (tab) tab.textContent = t.count;
    });
  } catch (e) { /* 忽略角标刷新错误 */ }
}

// ─── 工具 ────────────────────────────────────────────
async function fetchJson(url) {
  const resp = await fetch(url);
  const json = await resp.json();
  if (!json.success) throw new Error(json.error || '请求失败');
  return json;
}
