#!/usr/bin/env node

/**
 * 依「插圖計畫」JSON 為文章 HTML 生成插圖並插入 <figure>。
 * 使用方式：
 *   yarn ai:add-illustrations --article ./article-drafts/slug.html --plan ./plan.json
 *   cat plan.json | yarn ai:add-illustrations --article ./article-drafts/slug.html --plan -
 *
 * 計畫格式：
 *   { "style": "可選，整篇主風格", "illustrations": [ { "insertAfterBlockIndex": 0, "prompt": "英文描述", "altText": "圖說" } ] }
 *
 * 文章開頭若有 <!-- illustration: off --> 則略過不處理。
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateThumbnail } from '../lib/generate-thumbnail.js';
import { getIllustrationConfig } from '../lib/illustration-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ILLUSTRATION_OFF_REGEX = /^\s*<!--[^>]*illustration\s*:\s*off/i;

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const value = args[i + 1] && args[i + 1] !== '-' && !args[i + 1].startsWith('--') ? args[i + 1] : true;
    parsed[key] = value;
  }
  return parsed;
}

/**
 * 將 HTML 片段切成「頂層區塊」陣列（comment, ul, ol, h1-h4, p, pre, hr）。
 * @param {string} html
 * @returns {string[]}
 */
function splitIntoBlocks(html) {
  const blocks = [];
  let remaining = html.trim();
  // 依序匹配：註解、ul、ol、h1-h4、p、pre、hr（hr 自閉合）
  const patterns = [
    [/^(<!--[\s\S]*?-->)/i, 1],
    [/^<(ul)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/i, 0],
    [/^<(ol)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/i, 0],
    [/^<(h[1-4])(?:\s[^>]*)?>([\s\S]*?)<\/\1>/i, 0],
    [/^<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/i, 0],
    [/^<pre(?:\s[^>]*)?>([\s\S]*?)<\/pre>/i, 0],
    [/^<hr\s*\/?>/i, 0],
  ];

  while (remaining.length > 0) {
    const trimmed = remaining.trimStart();
    if (trimmed.length < remaining.length) {
      blocks.push(remaining.slice(0, remaining.length - trimmed.length));
      remaining = trimmed;
      continue;
    }
    let matched = false;
    for (const [re, fullMatchIndex] of patterns) {
      const m = remaining.match(re);
      if (m) {
        blocks.push(m[0]);
        remaining = remaining.slice(m[0].length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      // 無法辨識的內容：吃到下一個已知開頭或結尾
      const next = remaining.match(/<(?:ul|ol|h[1-4]|p|pre|hr|<!--)/i);
      if (next) {
        const idx = next.index;
        if (idx > 0) blocks.push(remaining.slice(0, idx));
        remaining = remaining.slice(idx);
      } else {
        blocks.push(remaining);
        break;
      }
    }
  }
  return blocks;
}

/**
 * 在區塊陣列中，在指定 index 之後插入多個 figure；illustrations 已按 insertAfterBlockIndex 排序 ascending。
 * @param {string[]} blocks
 * @param {{ insertAfterBlockIndex: number, altText: string, imagePath: string }[]} illustrations
 * @returns {string[]}
 */
function insertFigures(blocks, illustrations) {
  const result = [];
  let figIdx = 0;
  for (let i = 0; i < blocks.length; i += 1) {
    result.push(blocks[i]);
    while (figIdx < illustrations.length && illustrations[figIdx].insertAfterBlockIndex === i) {
      const { altText, imagePath } = illustrations[figIdx];
      const filename = path.basename(imagePath);
      result.push(`<figure><img src="${filename}" alt="${escapeHtmlAttr(altText)}"/><figcaption>${escapeHtml(altText)}</figcaption></figure>\n`);
      figIdx += 1;
    }
  }
  while (figIdx < illustrations.length) {
    const { altText, imagePath } = illustrations[figIdx];
    const filename = path.basename(imagePath);
    result.push(`<figure><img src="${filename}" alt="${escapeHtmlAttr(altText)}"/><figcaption>${escapeHtml(altText)}</figcaption></figure>\n`);
    figIdx += 1;
  }
  return result;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeHtmlAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

async function main() {
  const args = parseArgs();
  const articlePath = args.article;
  const planPath = args.plan;
  const dryRun = args['dry-run'] === true;

  if (!articlePath || !planPath) {
    console.error('用法: yarn ai:add-illustrations --article ./article-drafts/<slug>.html --plan <path 或 ->');
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

  // 依 insertAfterBlockIndex 升序，以便依序插入
  toProcess.sort((a, b) => (a.insertAfterBlockIndex ?? 0) - (b.insertAfterBlockIndex ?? 0));

  const blocks = splitIntoBlocks(html);
  const imagePaths = [];

  for (let i = 0; i < toProcess.length; i += 1) {
    const item = toProcess[i];
    const prompt = item.prompt || 'illustration';
    const altText = item.altText || '';
    const style = item.style ?? plan.style ?? ilc.defaultStyle;
    const outName = `${slug}-${i + 1}.jpg`;
    const outPath = path.join(draftDir, outName);
    imagePaths.push({ ...item, imagePath: outPath });
    if (dryRun) {
      console.log('[add-illustrations] [dry-run] 會產圖:', outName, prompt.slice(0, 50) + '...');
      continue;
    }
    try {
      const buffer = await generateThumbnail(prompt, { style });
      fs.writeFileSync(outPath, buffer);
      console.log('[add-illustrations] 已寫入', outName);
    } catch (err) {
      console.error('[add-illustrations] 產圖失敗:', outName, err.message);
      process.exitCode = 1;
      return;
    }
  }

  if (dryRun) {
    console.log('[add-illustrations] dry-run 結束，未寫入文章');
    return;
  }

  const newBlocks = insertFigures(blocks, imagePaths);
  const newHtml = newBlocks.join('\n');
  fs.writeFileSync(articleAbs, newHtml);
  console.log('[add-illustrations] 已更新文章', articlePath);
}

main();
