/**
 * 插圖計畫 JSON 的共用解析工具。
 * add-illustrations 與 series-add-illustrations 共用。
 */

/**
 * 依 fallback 鏈解析單張圖片來源：item.source → plan.defaultSource → 'gemini'。
 * @param {object} plan
 * @param {object} item
 * @returns {'gemini'|'pexels'}
 */
export function resolveImageSource(plan, item) {
  const raw = item.source ?? plan.defaultSource ?? 'gemini';
  const n = String(raw).toLowerCase();
  if (n === 'pexels') return 'pexels';
  return 'gemini';
}

/**
 * 判斷該張是否顯示 Pexels 署名。
 * @param {'gemini'|'pexels'} source
 * @param {object} item - 計畫中的單張項目（可含 attribution 布林覆寫）
 * @param {boolean} pexelsAttributionDefault - 環境預設值
 * @returns {boolean}
 */
export function resolveShowAttribution(source, item, pexelsAttributionDefault) {
  if (source !== 'pexels') return false;
  if (typeof item.attribution === 'boolean') {
    return item.attribution;
  }
  return pexelsAttributionDefault;
}
