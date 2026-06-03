let dp = null;

async function initPlayer(episodeId) {
  const container = document.getElementById('dplayer');
  if (!container) return;

  // 显示加载状态
  container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:400px;color:#888"><p>正在获取播放地址...</p></div>';

  try {
    const resp = await fetch('/api/anime/episode/' + episodeId + '/play');
    const json = await resp.json();
    if (!json.success) {
      container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:400px;color:#e74c3c"><p>获取播放地址失败: ' + (json.error || '未知错误') + '</p></div>';
      return;
    }

    const { videoUrl, cached } = json.data;
    console.log('视频地址:', videoUrl, cached ? '(缓存)' : '(实时解析)');

    // 判断视频类型
    let videoType = 'auto';
    if (videoUrl.endsWith('.m3u8')) {
      videoType = 'hls';
    } else if (videoUrl.endsWith('.mp4')) {
      videoType = 'normal';
    } else if (videoUrl.endsWith('.flv')) {
      videoType = 'flv';
    }

    // 销毁旧播放器
    if (dp) dp.destroy();

    dp = new DPlayer({
      container: container,
      autoplay: true,
      theme: '#e7a519',
      lang: 'zh-cn',
      screenshot: true,
      hotkey: true,
      preload: 'auto',
      video: {
        url: videoUrl,
        type: videoType,
        pic: ''
      },
      // 弹幕（关闭，无后端）
      danmaku: false,
      contextmenu: [
        {
          text: '动漫资源系统',
          link: '/gallery'
        },
        {
          text: '刷新播放地址',
          click: async () => {
            try {
              const r = await fetch('/api/anime/episode/' + episodeId + '/refresh', { method: 'POST' });
              const d = await r.json();
              if (d.success) {
                dp.switchVideo({ url: d.data.videoUrl, type: d.data.videoUrl.endsWith('.m3u8') ? 'hls' : 'auto' });
                dp.notice('播放地址已刷新', 2000);
              }
            } catch (e) {
              dp.notice('刷新失败: ' + e.message, 3000);
            }
          }
        }
      ]
    });

    dp.on('error', () => {
      console.warn('播放器错误，尝试重试...');
      dp.notice('视频加载中，正在重试...', 3000);
    });

  } catch (e) {
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:400px;color:#e74c3c"><p>播放器初始化失败: ' + e.message + '</p></div>';
  }
}
