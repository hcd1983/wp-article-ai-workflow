/**
 * Pexels Photos Search API（v1）
 * @see https://www.pexels.com/api/documentation/
 */

const SEARCH_URL = 'https://api.pexels.com/v1/search';
const MIN_WIDTH = 1200;
const PER_PAGE = 10;

/**
 * @param {string} apiKey
 * @param {string} query
 * @param {Set<number|string>} usedPhotoIds - 同次執行已使用過的 photo id（會讀取並由呼叫端寫入）
 * @returns {Promise<{ downloadUrl: string, meta: object } | null>}
 *   meta: { photoId, photographer, photographerUrl, sourceUrl }
 */
export async function pickPexelsPhoto(apiKey, query, usedPhotoIds) {
  if (!apiKey || !String(query).trim()) {
    return null;
  }

  const url = new URL(SEARCH_URL);
  url.searchParams.set('query', String(query).trim());
  url.searchParams.set('orientation', 'landscape');
  url.searchParams.set('per_page', String(PER_PAGE));

  const res = await fetch(url.toString(), {
    headers: { Authorization: apiKey },
  });

  const remainingRaw = res.headers.get('x-ratelimit-remaining');
  const remaining = remainingRaw != null ? parseInt(remainingRaw, 10) : NaN;

  if (!Number.isNaN(remaining) && remaining < 10 && remaining >= 0) {
    console.warn('[pexels] API 額度偏低，X-Ratelimit-Remaining:', remaining);
  }

  if (res.status === 429) {
    console.error('[pexels] API rate limit（429），略過此張');
    return null;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[pexels] API 錯誤', res.status, text.slice(0, 200));
    return null;
  }

  let data;
  try {
    data = await res.json();
  } catch {
    console.error('[pexels] 無法解析 API JSON');
    return null;
  }

  const photos = Array.isArray(data.photos) ? data.photos : [];
  for (const photo of photos) {
    const id = photo.id;
    const w = photo.width ?? 0;
    if (w < MIN_WIDTH) continue;
    if (usedPhotoIds.has(id)) continue;

    const downloadUrl =
      photo.src?.large2x || photo.src?.large || photo.src?.original || photo.src?.medium;
    if (!downloadUrl) continue;

    usedPhotoIds.add(id);

    return {
      downloadUrl,
      meta: {
        photoId: id,
        photographer: photo.photographer || '',
        photographerUrl: photo.photographer_url || '',
        sourceUrl: photo.url || 'https://www.pexels.com',
      },
    };
  }

  const reasons = [];
  if (photos.length === 0) {
    reasons.push('API 無回傳任何相片');
  } else {
    reasons.push(`共 ${photos.length} 張皆不符合條件（橫向、寬度 ≥ ${MIN_WIDTH}px、未重複）`);
  }
  if (!Number.isNaN(remaining) && remaining === 0) {
    reasons.push('API 額度已耗盡（X-Ratelimit-Remaining: 0）');
  }
  console.error('[pexels]', reasons.join('；'));
  return null;
}
