/**
 * 連載系列設定的共用讀寫函式庫。
 *
 * 目錄結構：
 *   article-drafts/<seriesSlug>-series/
 *     _<seriesSlug>-series-config.md   ← 系列設定（JSON 內容）
 *     chapter-01.html
 *     chapter-01.jpg                   ← 章節封面
 *     chapter-01-1.jpg                 ← 章節插圖
 *     chapter-02.html
 *     ...
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DRAFTS_ROOT = path.resolve(PROJECT_ROOT, 'article-drafts');

/**
 * 回傳系列草稿資料夾路徑（不保證存在）。
 * 資料夾名稱固定為 `<seriesSlug>-series`。
 * @param {string} seriesSlug
 * @returns {string}
 */
export function getDraftDir(seriesSlug) {
  return path.resolve(DRAFTS_ROOT, `${seriesSlug}-series`);
}

/**
 * 回傳系列設定檔路徑（`_<seriesSlug>-series-config.md`）。
 * @param {string} seriesSlug
 * @returns {string}
 */
export function getConfigPath(seriesSlug) {
  return path.resolve(getDraftDir(seriesSlug), `_${seriesSlug}-series-config.md`);
}

/**
 * 讀取設定檔，回傳 parsed 物件。
 * @param {string} seriesSlug
 * @returns {object}
 */
export function readSeriesConfig(seriesSlug) {
  const configPath = getConfigPath(seriesSlug);
  if (!fs.existsSync(configPath)) {
    throw new Error(`找不到系列設定檔：${configPath}`);
  }
  const raw = fs.readFileSync(configPath, 'utf8');
  return JSON.parse(raw);
}

/**
 * 完整寫入設定檔（immutable pattern，不 mutate 傳入物件）。
 * @param {string} seriesSlug
 * @param {object} config
 */
export function writeSeriesConfig(seriesSlug, config) {
  const configPath = getConfigPath(seriesSlug);
  const updated = {
    ...config,
    updated_at: new Date().toISOString(),
  };
  fs.writeFileSync(configPath, JSON.stringify(updated, null, 2), 'utf8');
}

/**
 * 建立初始 config 物件（不寫入檔案）。
 * @param {{
 *   slug: string,
 *   title: string,
 *   genre?: string,
 *   theme?: string,
 *   style?: string,
 *   sourceMode?: string,
 *   wpCategoryId?: number,
 *   wpCategorySlug?: string,
 *   coverStyle?: string,
 *   illustrationStyle?: string,
 *   colorPalette?: string,
 *   mood?: string,
 * }} params
 * @returns {object}
 */
export function createInitialConfig(params) {
  const now = new Date().toISOString();
  return {
    version: '1',
    slug: params.slug,
    title: params.title,
    type: params.type || 'novel',
    genre: params.genre || '',
    theme: params.theme || '',
    style: params.style || '',
    source_mode: params.sourceMode || 'ai',
    wp_category_id: params.wpCategoryId || null,
    wp_category_slug: params.wpCategorySlug || null,
    created_at: now,
    updated_at: now,
    art_style: {
      cover_style: params.coverStyle || '',
      illustration_style: params.illustrationStyle || '',
      color_palette: params.colorPalette || '',
      mood: params.mood || '',
    },
    world: '',
    characters: [],
    outline: [],
    chapters_published: [],
    metadata: {},
  };
}

/**
 * 回傳章節 HTML 路徑。
 * @param {string} seriesSlug
 * @param {number} chapterNum
 * @returns {string}
 */
export function getChapterHtmlPath(seriesSlug, chapterNum) {
  const padded = String(chapterNum).padStart(2, '0');
  return path.resolve(getDraftDir(seriesSlug), `chapter-${padded}.html`);
}

/**
 * 回傳章節封面路徑。
 * @param {string} seriesSlug
 * @param {number} chapterNum
 * @returns {string}
 */
export function getChapterJpgPath(seriesSlug, chapterNum) {
  const padded = String(chapterNum).padStart(2, '0');
  return path.resolve(getDraftDir(seriesSlug), `chapter-${padded}.jpg`);
}

/**
 * 回傳章節插圖路徑（illustrationIndex 從 1 開始）。
 * @param {string} seriesSlug
 * @param {number} chapterNum
 * @param {number} illustrationIndex
 * @returns {string}
 */
export function getChapterIllustrationPath(seriesSlug, chapterNum, illustrationIndex) {
  const padded = String(chapterNum).padStart(2, '0');
  return path.resolve(getDraftDir(seriesSlug), `chapter-${padded}-${illustrationIndex}.jpg`);
}

/**
 * 更新 outline 中某章節的 status，回傳新 config（不 mutate）。
 * @param {object} config
 * @param {number} chapterNum
 * @param {string} status  'pending' | 'draft' | 'written' | 'published'
 * @returns {object}
 */
export function updateChapterStatus(config, chapterNum, status) {
  const outline = config.outline.map((entry) =>
    entry.chapter === chapterNum ? { ...entry, status } : { ...entry }
  );
  return { ...config, outline };
}

/**
 * 在 chapters_published 新增一筆發布紀錄，回傳新 config（不 mutate）。
 * @param {object} config
 * @param {{ chapter: number, slug: string, wp_post_id: number, published_at: string, summary: string }} entry
 * @returns {object}
 */
export function addPublishedChapter(config, entry) {
  return {
    ...config,
    chapters_published: [...config.chapters_published, { ...entry }],
  };
}
