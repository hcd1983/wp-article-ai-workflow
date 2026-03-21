import { config } from '../config.js';
import { pickPexelsPhoto } from '../pexels-client.js';
import { fetchImageBuffer } from '../fetch-image-buffer.js';

export const pexelsStrategy = {
  name: 'pexels',

  /**
   * @param {object} options
   * @param {string} [options.pexelsQuery]
   * @param {Set<number|string>} [options.usedPhotoIds]
   * @returns {{ valid: boolean, reason?: string }}
   */
  validate(options) {
    if (!config.PEXELS_API_KEY) {
      return { valid: false, reason: 'PEXELS_API_KEY 未設定' };
    }
    const q = options.pexelsQuery;
    if (typeof q !== 'string' || !q.trim()) {
      return { valid: false, reason: 'Pexels 需要非空 pexelsQuery' };
    }
    return { valid: true };
  },

  /**
   * @param {object} options
   * @param {string} [options.pexelsQuery]
   * @param {Set<number|string>} [options.usedPhotoIds]
   * @returns {Promise<{ buffer: Buffer, meta: object }>}
   */
  async generate(options) {
    const usedPhotoIds = options.usedPhotoIds instanceof Set ? options.usedPhotoIds : new Set();
    const picked = await pickPexelsPhoto(
      config.PEXELS_API_KEY,
      options.pexelsQuery,
      usedPhotoIds
    );
    if (!picked) {
      throw new Error('Pexels 未取得可用相片');
    }
    const raw = await fetchImageBuffer(picked.downloadUrl);
    return {
      buffer: raw,
      meta: {
        photographer: picked.meta.photographer,
        photographerUrl: picked.meta.photographerUrl,
        sourceUrl: picked.meta.sourceUrl,
        photoId: picked.meta.photoId,
      },
    };
  },
};
