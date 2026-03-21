#!/usr/bin/env node

/**
 * 依「插圖計畫」JSON 為文章 HTML 生成插圖並插入 <figure>。
 * 使用方式：
 *   yarn ai:add-illustrations --article ./article-drafts/slug.html --plan ./plan.json
 *   yarn ai:add-illustrations --article ./path.html --plan ./plan.json --strict
 *   cat plan.json | yarn ai:add-illustrations --article ./article-drafts/slug.html --plan -
 *
 * 計畫格式：
 *   {
 *     "defaultSource": "gemini" | "pexels"（可選）,
 *     "illustrations": [
 *       {
 *         "insertAfterBlockIndex": 0,
 *         "source": "gemini" | "pexels"（可選）,
 *         "prompt": "英文描述（Gemini）",
 *         "pexelsQuery": "搜尋關鍵字（Pexels）",
 *         "altText": "圖說",
 *         "attribution": false（可選，覆寫署名）
 *       }
 *     ]
 *   }
 *
 * 文章開頭若有 <!-- illustration: off --> 則略過不處理。
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateThumbnail } from '../lib/generate-thumbnail.js';
import { getIllustrationConfig } from '../lib/illustration-config.js';
import { splitIntoBlocks, insertFigures } from '../lib/html-utils.js';
import { resolveImageSource, resolveShowAttribution } from '../lib/illustration-plan-utils.js';
import { parseCliArgs } from '../lib/parse-cli-args.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ILLUSTRATION_OFF_REGEX = /^\s*<!--[^>]*illustration\s*:\s*off/i;

async function main() {
  const args = parseCliArgs();
  const articlePath = args.article;
  const planPath = args.plan;
  const dryRun = args['dry-run'] === true;
  const strictCli = args.strict === true;

  if (!articlePath || !planPath) {
    console.error('用法: yarn ai:add-illustrations --article ./article-drafts/<slug>.html --plan <path 或 -> [--strict]');
    process.exitCode = 1;
    return;
  }

  const rootDir = path.resolve(__dirname, '..');
  const articleAbs = path.isAbsolute(articlePath) ? articlePath : path.resolve(rootDir, articlePath);
  if (!fs.existsSync(articleAbs)) {
    console.error('[add-illustrations] 找不到文章:', articleAbs);
    process.exitCode = 1;
    return;
  }

  let planJson;
  if (planPath === '-') {
    planJson = fs.readFileSync(0, 'utf8');
  } else {
    const planAbs = path.isAbsolute(planPath) ? planPath : path.resolve(rootDir, planPath);
    if (!fs.existsSync(planAbs)) {
      console.error('[add-illustrations] 找不到計畫檔:', planAbs);
      process.exitCode = 1;
      return;
    }
    planJson = fs.readFileSync(planAbs, 'utf8');
  }

  let plan;
  try {
    plan = JSON.parse(planJson);
  } catch (e) {
    console.error('[add-illustrations] 計畫 JSON 解析失敗:', e.message);
    process.exitCode = 1;
    return;
  }

  const illustrations = plan.illustrations;
  if (!Array.isArray(illustrations) || illustrations.length === 0) {
    console.log('[add-illustrations] 無插圖項目，略過');
    return;
  }

  const ilc = getIllustrationConfig();
  if (!ilc.enabled) {
    console.log('[add-illustrations] 插圖已於設定中關閉，略過');
    return;
  }

  const strict = strictCli || ilc.strictMode;

  const maxCount = ilc.maxPerArticle;
  if (illustrations.length > maxCount) {
    console.warn(`[add-illustrations] 計畫共 ${illustrations.length} 張，上限 ${maxCount}，僅處理前 ${maxCount} 張`);
  }
  const toProcess = illustrations.slice(0, maxCount);

  let html = fs.readFileSync(articleAbs, 'utf8');
  if (ILLUSTRATION_OFF_REGEX.test(html)) {
    console.log('[add-illustrations] 文章已標記 illustration: off，略過');
    return;
  }

  const slug = path.basename(articlePath, path.extname(articlePath));
  const draftDir = path.dirname(articleAbs);

  toProcess.sort((a, b) => (a.insertAfterBlockIndex ?? 0) - (b.insertAfterBlockIndex ?? 0));

  const blocks = splitIntoBlocks(html);
  const usedPhotoIds = new Set();
  const successItems = [];

  for (let i = 0; i < toProcess.length; i += 1) {
    const item = toProcess[i];
    const source = resolveImageSource(plan, item);
    const prompt = item.prompt || 'illustration';
    const altText = item.altText || '';
    const style = item.style ?? plan.style ?? ilc.defaultStyle;
    const seq = dryRun ? i + 1 : successItems.length + 1;
    const outName = `${slug}-${seq}.jpg`;
    const outPath = path.join(draftDir, outName);
    const showAttribution = resolveShowAttribution(source, item, ilc.pexelsAttributionDefault);

    if (dryRun) {
      console.log('[add-illustrations] [dry-run] 會產圖:', outName, source, (prompt || item.pexelsQuery || '').slice(0, 50));
      continue;
    }

    const genOptions = {
      imageSource: source,
      prompt,
      pexelsQuery: item.pexelsQuery,
      style: source === 'gemini' ? style : undefined,
      usedPhotoIds,
    };

    try {
      const { buffer, meta } = await generateThumbnail(prompt, genOptions);
      fs.writeFileSync(outPath, buffer);
      console.log('[add-illustrations] 已寫入', outName, `(${source})`);
      successItems.push({
        insertAfterBlockIndex: item.insertAfterBlockIndex ?? 0,
        altText,
        imagePath: outPath,
        showAttribution,
        pexelsMeta:
          source === 'pexels' && meta
            ? {
                photographer: meta.photographer,
                photographerUrl: meta.photographerUrl,
                sourceUrl: meta.sourceUrl,
              }
            : undefined,
      });
    } catch (err) {
      console.error('[add-illustrations] 產圖失敗:', outName, err.message);
      if (strict) {
        process.exitCode = 1;
        return;
      }
    }
  }

  if (dryRun) {
    console.log('[add-illustrations] dry-run 結束，未寫入文章');
    return;
  }

  const newBlocks = insertFigures(blocks, successItems);
  const newHtml = newBlocks.join('\n');
  fs.writeFileSync(articleAbs, newHtml);
  console.log('[add-illustrations] 已更新文章', articlePath);
}

main();
