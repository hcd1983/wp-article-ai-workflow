#!/usr/bin/env node

/**
 * 一次性工具：上傳 Tailscale 文章的本機插圖到 WordPress，並更新 HTML 內的 img src。
 *
 * 使用方式（專案根目錄）：
 *   node ./scripts/upload-inline-images-once.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { uploadMedia } from '../lib/wp-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const ARTICLE_PATH = path.resolve(rootDir, './article-drafts/tailscale-ai-mesh-network.html');
const IMAGES = [
  'tailscale-ai-mesh-network-1.jpg',
  'tailscale-ai-mesh-network-2.jpg',
];

async function main() {
  if (!fs.existsSync(ARTICLE_PATH)) {
    console.error('[upload-inline-images-once] 找不到文章檔案:', ARTICLE_PATH);
    process.exitCode = 1;
    return;
  }

  const articleDir = path.dirname(ARTICLE_PATH);
  const mapping = {};

  for (const name of IMAGES) {
    const imgPath = path.resolve(articleDir, name);
    if (!fs.existsSync(imgPath)) {
      console.warn('[upload-inline-images-once] 找不到圖片檔，略過：', imgPath);
      continue;
    }
    try {
      const buffer = fs.readFileSync(imgPath);
      const media = await uploadMedia(buffer, name, 'image/jpeg');
      const url = media?.source_url || media?.guid?.rendered;
      if (url) {
        mapping[name] = url;
        console.log('[upload-inline-images-once] 已上傳', name, '→', url);
      } else {
        console.warn('[upload-inline-images-once] 上傳成功但未取得 URL：', name);
      }
    } catch (err) {
      console.error('[upload-inline-images-once] 上傳失敗：', name, err.message);
      process.exitCode = 1;
      return;
    }
  }

  if (Object.keys(mapping).length === 0) {
    console.log('[upload-inline-images-once] 無任何圖片被上傳或取得 URL，結束');
    return;
  }

  let html = fs.readFileSync(ARTICLE_PATH, 'utf8');
  for (const [name, url] of Object.entries(mapping)) {
    const re = new RegExp(`src=["']${name}["']`, 'g');
    html = html.replace(re, `src="${url}"`);
  }
  fs.writeFileSync(ARTICLE_PATH, html);
  console.log('[upload-inline-images-once] 已更新 HTML 中的 img src。');
}

main();

