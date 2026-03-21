import fs from 'fs';
import path from 'path';
import { generateImage } from '../gemini-image.js';
import { config } from '../config.js';

export const geminiStrategy = {
  name: 'gemini',

  /**
   * @param {object} options
   * @param {string} [options.prompt]
   * @param {string} [options.style]
   * @param {string[]} [options.referenceImagePaths]
   * @returns {{ valid: boolean, reason?: string }}
   */
  validate(options) {
    if (!config.GEMINI_API_KEY) {
      return { valid: false, reason: 'GEMINI_API_KEY 未設定' };
    }
    const prompt = options.prompt || 'illustration';
    if (typeof prompt !== 'string' || !prompt.trim()) {
      return { valid: false, reason: 'Gemini 需要非空 prompt' };
    }
    return { valid: true };
  },

  /**
   * @param {object} options
   * @param {string} [options.prompt]
   * @param {string} [options.style]
   * @param {string[]} [options.referenceImagePaths]
   * @returns {Promise<{ buffer: Buffer, meta?: undefined }>}
   */
  async generate(options) {
    const prompt = options.prompt || 'illustration';
    const style = options.style;
    const fullPrompt = style ? `${style}, ${prompt}` : prompt;

    const refPaths = Array.isArray(options.referenceImagePaths) ? options.referenceImagePaths : [];
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
    return { buffer: rawImage };
  },
};
