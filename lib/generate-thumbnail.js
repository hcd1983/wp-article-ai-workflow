import { generateRawImage } from './image-source-registry.js';
import { optimizeThumbnail } from './thumbnail-optimize.js';

/**
 * 依來源（Gemini / Pexels）產生圖片，並壓成縮圖尺寸。
 *
 * @param {string} prompt - Gemini 用圖片描述；Pexels 時可為備註，實際搜尋用 pexelsQuery
 * @param {Object} options - 選項
 * @param {string} [options.imageSource='gemini'] - 'gemini' | 'pexels'
 * @param {string} [options.pexelsQuery] - Pexels 搜尋關鍵字
 * @param {string} [options.style] - 風格（Gemini 併入 prompt）
 * @param {string[]} [options.referenceImagePaths] - 參考圖（僅 Gemini）
 * @param {Set<number|string>} [options.usedPhotoIds] - Pexels 同篇去重用
 * @param {number} [options.width] - 傳給 optimizeThumbnail
 * @param {number} [options.height]
 * @param {string} [options.format]
 * @returns {Promise<{ buffer: Buffer, meta?: { photographer?: string, photographerUrl?: string, sourceUrl?: string, photoId?: number|string } }>}
 */
export async function generateThumbnail(prompt, options = {}) {
  const {
    imageSource = 'gemini',
    style,
    pexelsQuery,
    referenceImagePaths,
    usedPhotoIds,
    width,
    height,
    format,
  } = options;

  const strategyOpts = {
    prompt,
    style,
    pexelsQuery,
    referenceImagePaths,
    usedPhotoIds,
  };

  const { buffer: raw, meta } = await generateRawImage(imageSource, strategyOpts);
  const thumbnail = await optimizeThumbnail(raw, { width, height, format });
  return { buffer: thumbnail, meta };
}
