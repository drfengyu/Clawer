const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { spawn } = require('child_process');

class Downloader {
  constructor(downloadPath) {
    this.downloadPath = downloadPath;
    this.ensureDownloadDir();
  }

  ensureDownloadDir() {
    if (!fs.existsSync(this.downloadPath)) {
      fs.mkdirSync(this.downloadPath, { recursive: true });
    }

    // 创建子目录
    ['audio', 'video', 'image'].forEach(type => {
      const dir = path.join(this.downloadPath, type);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async downloadFile(url, type, filename) {
    // 磁力链无需 HTTP 下载，直接存储 URI
    if (url.startsWith('magnet:')) {
      return {
        success: true,
        filepath: url,
        filename: filename || url.slice(0, 80),
        size: 0
      };
    }

    try {
      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      // 确定文件扩展名
      const ext = this.getExtension(url, response.headers['content-type']);
      const safeFilename = this.sanitizeFilename(filename || `file_${Date.now()}`);
      const fullFilename = `${safeFilename}${ext}`;
      const filepath = path.join(this.downloadPath, type, fullFilename);

      // 下载文件
      await pipeline(response.data, fs.createWriteStream(filepath));

      const stats = fs.statSync(filepath);

      return {
        success: true,
        filepath: path.relative(process.cwd(), filepath),
        filename: fullFilename,
        size: stats.size
      };
    } catch (error) {
      console.error('下载失败:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async downloadM3u8(url, type, filename) {
    const safeFilename = this.sanitizeFilename(filename || `m3u8_${Date.now()}`);
    const outFile = path.join(this.downloadPath, type, `${safeFilename}.mp4`);

    return new Promise((resolve) => {
      // 用 ffmpeg 下载 m3u8 并封装为 mp4
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        '-i', url,
        '-c', 'copy',
        '-bsf:a', 'aac_adtstoasc',
        '-movflags', '+faststart',
        outFile
      ], { stdio: ['ignore', 'pipe', 'pipe'] });

      let stderr = '';
      ffmpeg.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

      ffmpeg.on('close', (code) => {
        if (code === 0 && fs.existsSync(outFile)) {
          const stats = fs.statSync(outFile);
          resolve({
            success: true,
            filepath: path.relative(process.cwd(), outFile),
            filename: `${safeFilename}.mp4`,
            size: stats.size
          });
        } else {
          console.error('ffmpeg 退出码:', code);
          resolve({ success: false, error: 'ffmpeg 转换失败' });
        }
      });

      ffmpeg.on('error', (err) => {
        resolve({ success: false, error: 'ffmpeg 不可用: ' + err.message });
      });
    });
  }

  getExtension(url, contentType) {
    // 先尝试从 URL 获取扩展名
    const urlExt = path.extname(url.split('?')[0]);
    if (urlExt) return urlExt;

    // 根据 content-type 判断
    const typeMap = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'audio/mpeg': '.mp3',
      'audio/wav': '.wav',
      'audio/ogg': '.ogg',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'video/ogg': '.ogv'
    };

    return typeMap[contentType] || '.bin';
  }

  sanitizeFilename(filename) {
    return filename
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .substring(0, 200);
  }
}

module.exports = Downloader;
