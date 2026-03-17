import { generateImage } from './gemini-image.js';
import { optimizeThumbnail } from './thumbnail-optimize.js';
import fs from 'fs';
import path from 'path';

/**
 * 依 prompt 產生圖片，並壓成縮圖尺寸。
 *
 * @param {string} prompt - 縮圖描述（英文建議）
 * @param {Object} options - 選項
 * @param {string} [options.style] - 風格描述，會併入 prompt 前綴（用於文章插圖風格一致）
 * @param {string[]} [options.referenceImagePaths] - 參考圖檔路徑（用於角色一致性）
 * @param {number} [options.width] - 傳給 optimizeThumbnail
 * @param {number} [options.height]
 * @param {string} [options.format]
 * @returns {Promise<Buffer>} - 最終縮圖 Buffer
 */
export async function generateThumbnail(prompt, options = {}) {
  const { style, referenceImagePaths, ...optimizeOptions } = options;
  const fullPrompt = style ? `${style}, ${prompt}` : prompt;

  const refPaths = Array.isArray(referenceImagePaths) ? referenceImagePaths : [];
  const referenceImages = refPaths
    .filter(Boolean)
    .map((p) => {
      if (!fs.existsSync(p)) {
        throw new Error(`reference image 不存在：${p}`);
      }
      const ext = path.extname(p).toLowerCase();
      const mimeType =
        ext === '.png'
          ? 'image/png'
          : ext === '.webp'
            ? 'image/webp'
            : ext === '.jpg' || ext === '.jpeg'
              ? 'image/jpeg'
              : 'application/octet-stream';
      if (mimeType === 'application/octet-stream') {
        throw new Error(`不支援的 reference image 格式：${p}`);
      }
      return { buffer: fs.readFileSync(p), mimeType };
    });

  const rawImage = await generateImage(fullPrompt, { referenceImages });
  const thumbnail = await optimizeThumbnail(rawImage, optimizeOptions);
  return thumbnail;
}

