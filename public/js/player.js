let dp = null;
let hlsInstance = null;
let currentEpisodeId = null;   // 当前播放页对应的分集（用于进度/导航，不随线路切换改变）
let playerOpts = {};           // { nextEpId, siblingLines }
let playData = null;           // { videoUrl, proxyUrl, videoUrlNext, playPageUrl }
let usingProxy = false;        // 当前是否走代理
let proxyTried = false;        // 本集是否已自动兜底过代理（避免来回切）

// hls.js 调优：更大的前向缓冲 + 起播预取 + 更强重试，减少卡顿与等待
const HLS_CONFIG = {
  maxBufferLength: 30,            // 目标前向缓冲秒数
  maxMaxBufferLength: 60,         // 上限
  backBufferLength: 30,          // 回看缓冲（控内存）
  maxBufferSize: 60 * 1000 * 1000,
  startFragPrefetch: true,       // 起播即预取，秒开
  lowLatencyMode: false,         // 点播无需低延迟
  fragLoadingMaxRetry: 6,
  manifestLoadingMaxRetry: 4,
  levelLoadingMaxRetry: 4,
  abrEwmaDefaultEstimate: 1000000
};

// 自定义 hls 装载器：DPlayer 通过 customType 调用，便于传入调优配置并管理实例生命周期
function hlsLoader(video, player) {
  if (hlsInstance) { try { hlsInstance.destroy(); } catch (e) { /* ignore */ } }
  const hls = new Hls(HLS_CONFIG);
  hlsInstance = hls;
  hls.loadSource(video.src);
  hls.attachMedia(video);
  hls.on(Hls.Events.ERROR, (evt, data) => {
    if (!data.fatal) return;
    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
      // 先尝试就地恢复，恢复不了再走代理兜底
      if (!switchToProxy()) hls.startLoad();
    } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
      hls.recoverMediaError();
    } else {
      switchToProxy();
    }
  });
}

function videoTypeFor(url) {
  if (/\.m3u8(\?|$)/i.test(url)) return 'customHls';
  if (/\.flv(\?|$)/i.test(url)) return 'flv';
  if (/\.mp4(\?|$)/i.test(url)) return 'normal';
  return 'auto';
}

// 直连异常时自动切到服务端代理（带 Referer，可绕过防盗链/限速），每集仅一次
function switchToProxy() {
  if (usingProxy || proxyTried || !playData || !playData.proxyUrl) return false;
  proxyTried = true;
  usingProxy = true;
  const t = dp ? dp.video.currentTime : 0;
  dp.notice('直连异常，切换代理线路…', 2500);
  dp.switchVideo({ url: playData.proxyUrl, type: 'customHls' });
  dp.play();
  seekAfterLoad(t);
  return true;
}

// 视频元数据就绪后跳到指定时间（用于线路/代理切换保留进度）
function seekAfterLoad(t) {
  if (!t || t <= 0) return;
  dp.video.addEventListener('loadedmetadata', () => dp.seek(t), { once: true });
}

async function initPlayer(episodeId, opts = {}) {
  const container = document.getElementById('dplayer');
  if (!container) return;
  currentEpisodeId = episodeId;
  playerOpts = opts || {};

  container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:400px;color:#888"><p>正在获取播放地址...</p></div>';

  try {
    const resp = await fetch('/api/anime/episode/' + episodeId + '/play');
    const json = await resp.json();
    if (!json.success) {
      container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:400px;color:#e74c3c"><p>获取播放地址失败: ' + (json.error || '未知错误') + '</p></div>';
      return;
    }

    playData = json.data;
    usingProxy = false;
    proxyTried = false;
    console.log('视频地址:', playData.videoUrl, playData.cached ? '(缓存)' : '(实时解析)');

    buildPlayer(playData.videoUrl);
    renderLineSwitcher();
    preloadNext();
  } catch (e) {
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:400px;color:#e74c3c"><p>播放器初始化失败: ' + e.message + '</p></div>';
  }
}

function buildPlayer(url) {
  const container = document.getElementById('dplayer');
  if (dp) { try { dp.destroy(); } catch (e) { /* ignore */ } }

  dp = new DPlayer({
    container: container,
    autoplay: true,
    theme: '#e7a519',
    lang: 'zh-cn',
    screenshot: true,
    hotkey: true,
    preload: 'auto',
    playbackSpeed: [0.5, 0.75, 1, 1.25, 1.5, 2],
    video: {
      url: url,
      type: videoTypeFor(url),
      pic: '',
      customType: { customHls: hlsLoader }
    },
    danmaku: false,
    contextmenu: [
      { text: '动漫资源系统', link: '/gallery' },
      {
        text: '切换代理线路',
        click: () => {
          if (!playData || !playData.proxyUrl) { dp.notice('该地址不支持代理', 2500); return; }
          const t = dp.video.currentTime;
          usingProxy = true; proxyTried = true;
          dp.switchVideo({ url: playData.proxyUrl, type: 'customHls' });
          dp.play();
          seekAfterLoad(t);
          dp.notice('已切换到代理线路', 2000);
        }
      },
      {
        text: '刷新播放地址',
        click: async () => {
          try {
            const r = await fetch('/api/anime/episode/' + currentEpisodeId + '/refresh', { method: 'POST' });
            const d = await r.json();
            if (d.success) {
              dp.switchVideo({ url: d.data.videoUrl, type: videoTypeFor(d.data.videoUrl) });
              dp.notice('播放地址已刷新', 2000);
            }
          } catch (e) {
            dp.notice('刷新失败: ' + e.message, 3000);
          }
        }
      }
    ]
  });

  setupExperience();
  dp.notice('快捷键：← → 快进退 · ↑ ↓ 音量 · 空格 暂停 · F 全屏', 4000);
}

// 体验增强：记忆进度、自动连播下一集
function setupExperience() {
  const PKEY = 'anime_progress:' + currentEpisodeId;

  // 续播（距片尾 <10s 不续）
  dp.video.addEventListener('loadedmetadata', () => {
    const saved = parseFloat(localStorage.getItem(PKEY) || '0');
    if (saved > 5 && dp.video.duration && saved < dp.video.duration - 10) {
      dp.seek(saved);
    }
  }, { once: true });

  // 节流保存进度
  let lastSave = 0;
  dp.on('timeupdate', () => {
    const now = dp.video.currentTime || 0;
    if (Math.abs(now - lastSave) >= 5) {
      lastSave = now;
      localStorage.setItem(PKEY, String(now));
    }
  });

  // 播完清除进度并自动连播
  dp.on('ended', () => {
    localStorage.removeItem(PKEY);
    gotoNext();
  });

  // 直连失败兜底
  dp.on('error', () => { switchToProxy(); });
}

function gotoNext() {
  if (playerOpts.nextEpId) {
    window.location.href = '/play/' + playerOpts.nextEpId;
  } else {
    dp.notice('已经是最后一集', 3000);
  }
}

// 预载下一集：暖服务端缓存（写入 video_url），切集即秒回
function preloadNext() {
  if (playerOpts.nextEpId) {
    fetch('/api/anime/episode/' + playerOpts.nextEpId + '/play').catch(() => {});
  }
}

// 线路切换：同集号不同线路在此就地换流，保留当前进度
function renderLineSwitcher() {
  const lines = (playerOpts.siblingLines || []);
  if (lines.length < 2) return;

  const old = document.querySelector('.line-switch');
  if (old) old.remove();

  const bar = document.createElement('div');
  bar.className = 'line-switch';
  const label = document.createElement('span');
  label.className = 'ls-label';
  label.textContent = '线路：';
  bar.appendChild(label);

  lines.forEach(l => {
    const btn = document.createElement('a');
    btn.className = 'ls-btn' + (l.epId === currentEpisodeId ? ' active' : '');
    btn.textContent = l.lineName;
    btn.addEventListener('click', () => switchLine(l.epId, btn));
    bar.appendChild(btn);
  });

  const container = document.getElementById('dplayer');
  container.parentNode.insertBefore(bar, container.nextSibling);
}

async function switchLine(epId, btn) {
  if (epId === currentEpisodeId || btn.classList.contains('active')) return;
  const t = dp ? dp.video.currentTime : 0;
  dp.notice('切换线路中…', 1500);
  try {
    const r = await fetch('/api/anime/episode/' + epId + '/play');
    const j = await r.json();
    if (!j.success) { dp.notice('线路切换失败: ' + (j.error || ''), 2500); return; }

    playData = j.data;
    usingProxy = false;
    proxyTried = false;
    document.querySelectorAll('.ls-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    dp.switchVideo({ url: j.data.videoUrl, type: videoTypeFor(j.data.videoUrl) });
    dp.play();
    seekAfterLoad(t);
  } catch (e) {
    dp.notice('线路切换失败: ' + e.message, 2500);
  }
}
