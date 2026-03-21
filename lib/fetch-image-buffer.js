/**
 * 自 URL 下載圖片為 Buffer（供 Pexels 等來源與 optimizeThumbnail 銜接）。
 * 支援 timeout 與失敗時 1 次重試。
 */

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * @param {string} imageUrl
 * @param {Object} [options]
 * @param {number} [options.timeoutMs]
 * @param {number} [options.retries] - 額外重試次數（預設 1，即最多 2 次請求）
 * @returns {Promise<Buffer>}
 */
export async function fetchImageBuffer(imageUrl, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const extraRetries = options.retries ?? 1;
  const attempts = 1 + Math.max(0, extraRetries);
  let lastErr;

  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fetchOnce(imageUrl, timeoutMs);
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        await sleep(500);
      }
    }
  }

  throw lastErr;
}

/**
 * @param {string} url
 * @param {number} timeoutMs
 * @returns {Promise<Buffer>}
 */
async function fetchOnce(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'image/*,*/*;q=0.8',
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} 下載圖片失敗：${url}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`下載圖片逾時（${timeoutMs}ms）：${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
