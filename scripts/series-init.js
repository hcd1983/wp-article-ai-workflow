#!/usr/bin/env node

/**
 * series-init.js
 * 初始化長篇連載系列：建資料夾、設定檔，並在 WordPress 建立對應 Category。
 *
 * 用法：
 *   yarn series:init --slug <slug> --title <標題> [options]
 *
 * 選項：
 *   --slug                必填，系列 slug（小寫英文 + 連字號）
 *   --title               必填，系列標題
 *   --type                選填，small 類型：novel | tutorial | investigative（預設 novel）
 *   --genre               選填，題材 / 領域
 *   --theme               選填，主題
 *   --style               選填，文風 / 語調
 *   --source-mode         選填，ai（預設）或 interview
 *   --cover-style         選填，封面美術風格（英文）
 *   --illustration-style  選填，插圖美術風格（英文）
 *   --color-palette       選填，色調描述（英文）
 *   --mood                選填，氛圍描述（英文）
 *   --wp-parent-id        選填，WP 父 Category ID（數字字串）
 *   --wp-parent-title     選填，若父分類不存在，建立用的名稱（需搭配 --wp-parent-slug）
 *   --wp-parent-slug      選填，WP 父 Category slug（小寫英文 + 連字號）
 *   --wp-parent-description 選填，父分類描述（建立時使用）
 *   --skip-wp-category    選填 flag，跳過在 WP 建立 Category
 */

import fs from 'fs';
import { createCategory, getCategories } from '../lib/wp-client.js';
import {
  getDraftDir,
  getConfigPath,
  createInitialConfig,
  writeSeriesConfig,
} from '../lib/series-config.js';

const VALID_TYPES = ['novel', 'tutorial', 'investigative'];

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = args[i + 1];
    const value = next && !next.startsWith('--') ? next : true;
    parsed[key] = value;
  }
  return parsed;
}

function validateSlug(slug) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(
      `slug 格式不正確：「${slug}」\n需為小寫英文 + 數字，單字間以連字號分隔（例如 ai-rebel）`
    );
  }
}

function parseWpParentId(maybeId) {
  if (!maybeId) return null;
  const n = Number(maybeId);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`--wp-parent-id 需為正整數（收到：${maybeId}）`);
  }
  return n;
}

async function resolveWpCategory(slug, title, { parentId, description } = {}) {
  try {
    const category = await createCategory(title, slug, { parent: parentId, description });
    console.log(`[series-init] 已建立 WP Category：${category.name} (id=${category.id})`);
    return category;
  } catch (err) {
    const status = err?.response?.status;
    const errData = err?.response?.data;

    if (status === 422 && errData?.code === 'term_exists') {
      const termId = errData?.additional_data?.term_id ?? errData?.data?.term_id;
      if (termId) {
        console.log(`[series-init] Category 已存在（term_id=${termId}），直接使用`);
        return { id: termId, slug, name: title };
      }
    }

    try {
      const existing = await getCategories({ slug });
      if (existing.length > 0) {
        console.log(`[series-init] 已找到現有 Category（id=${existing[0].id}），略過建立`);
        return existing[0];
      }
    } catch {
      // 忽略 fallback 查詢失敗
    }

    throw err;
  }
}

async function main() {
  const args = parseArgs();

  const slug = args.slug;
  const title = args.title;
  const type = args.type || 'novel';

  if (!slug) {
    console.error('[series-init] 錯誤：缺少 --slug 參數');
    process.exitCode = 1;
    return;
  }
  if (!title) {
    console.error('[series-init] 錯誤：缺少 --title 參數');
    process.exitCode = 1;
    return;
  }
  if (!VALID_TYPES.includes(type)) {
    console.error(`[series-init] 錯誤：--type 需為 ${VALID_TYPES.join(' | ')}`);
    process.exitCode = 1;
    return;
  }

  try {
    validateSlug(slug);

    // 確認草稿資料夾尚未存在
    const draftDir = getDraftDir(slug);
    if (fs.existsSync(draftDir)) {
      throw new Error(`資料夾已存在：${draftDir}\n若要重新初始化，請先手動刪除該資料夾`);
    }

    // 建立 article-drafts/<slug>-series/ 目錄
    fs.mkdirSync(draftDir, { recursive: true });
    console.log(`[series-init] 已建立資料夾：${draftDir}`);

    // 在 WP 建立 Category
    let wpCategoryId = null;
    let wpCategorySlug = null;

    if (!args['skip-wp-category']) {
      let parentCategoryId = parseWpParentId(args['wp-parent-id']);

      // 若提供 wp-parent-slug，嘗試 resolve/建立父分類
      if (!parentCategoryId && args['wp-parent-slug']) {
        validateSlug(args['wp-parent-slug']);
        if (!args['wp-parent-title']) {
          throw new Error('使用 --wp-parent-slug 時，需同時提供 --wp-parent-title');
        }
        const parent = await resolveWpCategory(args['wp-parent-slug'], args['wp-parent-title'], {
          description: args['wp-parent-description'] || '',
        });
        parentCategoryId = parent.id;
      }

      const wpSlug = `${slug}-series`;
      const category = await resolveWpCategory(wpSlug, title, { parentId: parentCategoryId });
      wpCategoryId = category.id;
      wpCategorySlug = wpSlug;
    } else {
      console.log('[series-init] 已跳過 WP Category 建立');
    }

    // 建立初始 config
    const config = createInitialConfig({
      slug,
      title,
      type,
      genre: args.genre || '',
      theme: args.theme || '',
      style: args.style || '',
      sourceMode: args['source-mode'] || 'ai',
      wpCategoryId,
      wpCategorySlug,
      coverStyle: args['cover-style'] || '',
      illustrationStyle: args['illustration-style'] || '',
      colorPalette: args['color-palette'] || '',
      mood: args.mood || '',
    });

    writeSeriesConfig(slug, config);

    const configPath = getConfigPath(slug);
    console.log(`\n[series-init] 初始化完成！`);
    console.log(`  類型        : ${type}`);
    console.log(`  系列 slug   : ${slug}`);
    console.log(`  標題        : ${title}`);
    console.log(`  設定檔路徑  : ${configPath}`);
    if (wpCategoryId) {
      console.log(`  WP Category : id=${wpCategoryId}, slug=${wpCategorySlug}`);
    }
  } catch (error) {
    console.error('[series-init] 初始化失敗：', error.message);
    if (error.response) {
      console.error('  status:', error.response.status);
      console.error('  data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exitCode = 1;
  }
}

main();
