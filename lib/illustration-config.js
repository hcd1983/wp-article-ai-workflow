/**
 * 文章插圖：載入 .env 設定與規則檔（docs/illustration-rules.md）。
 * 規則檔內可含 YAML 區塊定義 exclude_types、exclude_tags。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_RULES_PATH = path.resolve(__dirname, '../docs/illustration-rules.md');

/**
 * 從 docs/illustration-rules.md 擷取 YAML 區塊並簡易解析 exclude_types、exclude_tags。
 * 不依賴 yaml 套件，僅解析 ```yaml ... ``` 內 key 為 exclude_types / exclude_tags 的陣列。
 *
 * @param {string} [rulesPath] - 規則檔路徑，預設為 docs/illustration-rules.md
 * @returns {{ excludeTypes: string[], excludeTags: string[] }}
 */
export function loadIllustrationRules(rulesPath = DEFAULT_RULES_PATH) {
  try {
    const content = fs.readFileSync(rulesPath, 'utf8');
    const yamlMatch = content.match(/```yaml\s*([\s\S]*?)```/);
    if (!yamlMatch) return { excludeTypes: [], excludeTags: [] };

    const yaml = yamlMatch[1];
    const lines = yaml.split('\n');
    let currentKey = null;
    const excludeTypes = [];
    const excludeTags = [];

    for (const line of lines) {
      if (/^exclude_types:\s*$/.test(line)) {
        currentKey = 'excludeTypes';
        continue;
      }
      if (/^exclude_tags:\s*$/.test(line)) {
        currentKey = 'excludeTags';
        continue;
      }
      const listItem = line.match(/^\s*-\s*(.+)$/);
      if (listItem && currentKey) {
        const val = listItem[1].trim().replace(/^['"]|['"]$/g, '');
        if (currentKey === 'excludeTypes') excludeTypes.push(val);
        else excludeTags.push(val);
      }
    }

    return { excludeTypes, excludeTags };
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('[illustration-config] 規則檔解析警告:', err.message);
    }
    return { excludeTypes: [], excludeTags: [] };
  }
}

/**
 * 取得插圖設定（合併 .env 與規則檔）。
 *
 * @param {string} [rulesPath] - 規則檔路徑
 * @returns {{
 *   enabled: boolean,
 *   maxPerArticle: number,
 *   defaultStyle: string,
 *   excludeTypes: string[],
 *   excludeTags: string[],
 *   strictMode: boolean,
 *   pexelsAttributionDefault: boolean
 * }}
 */
export function getIllustrationConfig(rulesPath = DEFAULT_RULES_PATH) {
  const rules = loadIllustrationRules(rulesPath);
  return {
    enabled: config.ILLUSTRATION_ENABLED_DEFAULT,
    maxPerArticle: config.ILLUSTRATION_MAX_PER_ARTICLE,
    defaultStyle: config.ILLUSTRATION_DEFAULT_STYLE,
    excludeTypes: rules.excludeTypes,
    excludeTags: rules.excludeTags,
    strictMode: config.ILLUSTRATION_STRICT_MODE,
    pexelsAttributionDefault: config.PEXELS_ATTRIBUTION_DEFAULT,
  };
}
