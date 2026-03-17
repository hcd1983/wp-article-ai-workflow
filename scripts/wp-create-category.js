#!/usr/bin/env node

/**
 * wp-create-category.js
 * 在 WordPress 新增 Category。若 slug 已存在則回傳現有 Category。
 *
 * 用法：
 *   yarn wp:create-category --name <名稱> [options]
 *
 * 選項：
 *   --name         必填，Category 顯示名稱
 *   --slug         選填，自訂 slug（預設由 WP 依名稱自動產生）
 *   --parent       選填，父層 Category ID（整數）
 *   --description  選填，Category 說明文字
 */

import { createCategory, getCategories } from '../lib/wp-client.js';

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

async function main() {
  const args = parseArgs();
  const name = args.name;
  const slug = args.slug || undefined;
  const parent = args.parent ? parseInt(args.parent, 10) : undefined;
  const description = args.description || undefined;

  if (!name) {
    console.error('[wp-create-category] 錯誤：缺少 --name 參數');
    process.exitCode = 1;
    return;
  }

  try {
    const category = await createCategory(name, slug, { parent, description });
    console.log(JSON.stringify(category, null, 2));
  } catch (err) {
    const status = err?.response?.status;
    const errData = err?.response?.data;

    // 422 term_exists：回傳現有 Category
    if (status === 422 && errData?.code === 'term_exists') {
      const termId = errData?.additional_data?.term_id ?? errData?.data?.term_id;
      if (termId) {
        console.warn(`[wp-create-category] slug 已存在（term_id=${termId}），查詢現有資料`);
        try {
          const existing = slug
            ? await getCategories({ slug })
            : await getCategories({ search: name });
          if (existing.length > 0) {
            console.log(JSON.stringify(existing[0], null, 2));
            return;
          }
        } catch {
          // fallback 失敗，輸出原始 term_id
          console.log(JSON.stringify({ id: termId, name, slug }, null, 2));
          return;
        }
      }
    }

    console.error('[wp-create-category] 建立失敗');
    if (err.response) {
      console.error('  status:', err.response.status);
      console.error('  data:', JSON.stringify(err.response.data, null, 2));
    } else {
      console.error(' ', err.message);
    }
    process.exitCode = 1;
  }
}

main();
