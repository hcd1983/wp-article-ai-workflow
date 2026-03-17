import sharp from 'sharp';

/**
 * 將輸入圖片壓成適合作為 WordPress 縮圖的大小。
 *
 * @param {Buffer|string} input - 圖片來源，可為 Buffer 或檔案路徑
 * @param {Object} options
 * @param {number} [options.width=1200]
 * @param {number} [options.height=630]
 * @param {string} [options.format='jpeg']
 * @returns {Promise<Buffer>} - 優化後圖片的 Buffer
 */
export async function optimizeThumbnail(input, options = {}) {
  const {
    width = 1200,
    height = 630,
    format = 'jpeg',
  } = options;

  let pipeline = sharp(input).resize(width, height, {
    fit: 'cover',
  });

  if (format === 'png') {
    pipeline = pipeline.png();
  } else {
    pipeline = pipeline.jpeg({ quality: 85 });
  }

  return pipeline.toBuffer();
}

