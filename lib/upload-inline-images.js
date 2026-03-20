import fs from 'fs';
import path from 'path';
import { uploadMedia } from './wp-client.js';

/**
 * 掃描 HTML 內容中的 <img src="...">，將相對路徑圖片上傳到 WordPress，
 * 並以回傳的 URL 取代原本 src，回傳更新後的 content。
 *
 * @param {string} content - HTML 內容
 * @param {string} contentPath - HTML 檔案實際路徑（用來解析相對路徑）
 * @returns {Promise<string>}
 */
export async function uploadInlineImages(content, contentPath) {
  if (!contentPath || !content) return content;

  const dirOfContent = path.dirname(contentPath);
  const imgSrcRegex = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
  /** @type {Record<string, string>} */
  const srcToUrl = {};
  const pendingUploads = [];

  content.replace(imgSrcRegex, (match, src) => {
    const trimmed = String(src).trim();
    if (/^https?:\/\//i.test(trimmed) || /^\/\//.test(trimmed) || trimmed.startsWith('/')) {
      return match;
    }
    if (srcToUrl[trimmed]) return match;
    const absPath = path.resolve(dirOfContent, trimmed);
    if (!absPath.startsWith(dirOfContent)) {
      console.warn('[upload-inline-images] 偵測到路徑遍歷，略過：', trimmed);
      return match;
    }
    if (!fs.existsSync(absPath)) {
      console.warn('[upload-inline-images] 找不到文內圖片檔案，略過：', absPath);
      return match;
    }
    const ext = path.extname(absPath).toLowerCase();
    let mimeType = 'image/jpeg';
    if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.webp') mimeType = 'image/webp';
    else if (ext === '.gif') mimeType = 'image/gif';

    pendingUploads.push({ src: trimmed, absPath, mimeType });
    return match;
  });

  for (const item of pendingUploads) {
    const buffer = fs.readFileSync(item.absPath);
    const filename = path.basename(item.absPath);
    const media = await uploadMedia(buffer, filename, item.mimeType);
    const mediaUrl = media?.source_url || media?.guid?.rendered;
    if (mediaUrl) {
      srcToUrl[item.src] = mediaUrl;
      console.log('[upload-inline-images] 已上傳文內圖片', item.src, '→', mediaUrl);
    }
  }

  if (Object.keys(srcToUrl).length === 0) {
    return content;
  }

  const updated = content.replace(imgSrcRegex, (match, src) => {
    const trimmed = String(src).trim();
    const newUrl = srcToUrl[trimmed];
    if (!newUrl) return match;
    return match.replace(src, newUrl);
  });

  return updated;
}

