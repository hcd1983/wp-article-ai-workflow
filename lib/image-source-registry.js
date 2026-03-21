import { geminiStrategy } from './strategies/gemini-strategy.js';
import { pexelsStrategy } from './strategies/pexels-strategy.js';

/** @type {Map<string, { name: string, validate: Function, generate: Function }>} */
const strategies = new Map([
  [geminiStrategy.name, geminiStrategy],
  [pexelsStrategy.name, pexelsStrategy],
]);

/**
 * @param {string} name - 'gemini' | 'pexels'
 */
export function getStrategy(name) {
  const key = String(name || 'gemini').toLowerCase();
  const s = strategies.get(key);
  if (!s) {
    throw new Error(`不支援的圖片來源：${name}（可用：gemini, pexels）`);
  }
  return s;
}

/**
 * @param {string} sourceName
 * @param {object} options - 各 strategy 所需欄位
 * @returns {Promise<{ buffer: Buffer, meta?: object }>}
 */
export async function generateRawImage(sourceName, options) {
  const strategy = getStrategy(sourceName);
  const validation = strategy.validate(options);
  if (!validation.valid) {
    const err = new Error(validation.reason || '圖片來源驗證失敗');
    err.code = 'IMAGE_SOURCE_VALIDATION';
    throw err;
  }
  return strategy.generate(options);
}
