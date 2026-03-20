#!/usr/bin/env node

/**
 * series-add-illustrations.js
 * 依插圖計畫為連載單元 HTML 生成插圖並插入 <figure>。
 * 預設插圖風格從系列 art_style.illustration_style 讀取，保持跨章節視覺一致性。
 *
 * 用法：
 *   yarn series:add-illustrations --series <slug> --chapter <num> --plan <path 或 -> [--use-character-reference]
 *
 * 計畫格式（JSON）：
 *   {
 *     "style": "可選，覆寫整篇風格",
 *     "illustrations": [
 *       { "insertAfterBlockIndex": 0, "prompt": "英文描述", "altText": "圖說" }
 *     ]
 *   }
 *
 * 優先順序：
 *   單張 style > plan.style > config.art_style.illustration_style
 */

import fs from 'fs';
import path from 'path';
import { generateThumbnail } from '../lib/generate-thumbnail.js';
import {
  readSeriesConfig,
  getChapterHtmlPath,
  getChapterIllustrationPath,
} from '../lib/series-config.js';
import { splitIntoBlocks, insertFigures } from '../lib/html-utils.js';

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
  const seriesSlug = args.series;
  const chapterNum = args.chapter ? parseInt(args.chapter, 10) : NaN;
  const planPath = args.plan;
  const dryRun = args['dry-run'] === true;
  const referenceArg = args.reference || args.ref || '';
  const useCharacterReference = args['use-character-reference'] === true;

  if (!seriesSlug || isNaN(chapterNum) || !planPath) {
    console.error(
      '用法: yarn series:add-illustrations --series <slug> --chapter <num> --plan <path 或 ->'
    );
    process.exitCode = 1;
    return;
  }

  try {
    // 讀取系列 config
    const config = readSeriesConfig(seriesSlug);
    const baseStyle = config.art_style?.illustration_style || '';
    const seriesDir = path.dirname(getChapterHtmlPath(seriesSlug, chapterNum));
    const cliReferencePaths = String(referenceArg)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((p) => path.resolve(p));
    const referenceImagePaths = [...cliReferencePaths];

    // 讀取章節 HTML
    const htmlPath = getChapterHtmlPath(seriesSlug, chapterNum);
    if (!fs.existsSync(htmlPath)) {
      throw new Error(`章節 HTML 不存在：${htmlPath}`);
    }
    const html = fs.readFileSync(htmlPath, 'utf8');

    // 讀取插圖計畫
    let planJson;
    if (planPath === '-') {
      planJson = fs.readFileSync(0, 'utf8');
    } else {
      if (!fs.existsSync(planPath)) {
        throw new Error(`找不到計畫檔：${planPath}`);
      }
      planJson = fs.readFileSync(planPath, 'utf8');
    }

    let plan;
    try {
      plan = JSON.parse(planJson);
    } catch (e) {
      throw new Error(`計畫 JSON 解析失敗：${e.message}`);
    }

    // 可在 plan 中用 useCharacterReference=true 控制是否套用角色參考圖（預設不套用）
    const planUseCharacterReference = plan?.useCharacterReference === true;
    const resolvedUseCharacterReference = useCharacterReference || planUseCharacterReference;
    if (resolvedUseCharacterReference && Array.isArray(config.characters)) {
      const characterReferencePaths = config.characters
        .map((c) => c?.reference_image)
        .filter(Boolean)
        .map((p) => path.resolve(seriesDir, p));
      referenceImagePaths.unshift(...characterReferencePaths);
    }

    const illustrations = plan.illustrations;
    if (!Array.isArray(illustrations) || illustrations.length === 0) {
      console.log('[series-add-illustrations] 無插圖項目，略過');
      return;
    }

    // 依 insertAfterBlockIndex 升序排列
    const sorted = [...illustrations].sort(
      (a, b) => (a.insertAfterBlockIndex ?? 0) - (b.insertAfterBlockIndex ?? 0)
    );

    const blocks = splitIntoBlocks(html);
    const resolvedIllustrations = [];

    for (let i = 0; i < sorted.length; i += 1) {
      const item = sorted[i];
      // 優先順序：單張 style > plan.style > config.art_style.illustration_style
      const style = item.style ?? plan.style ?? baseStyle;
      const prompt = item.prompt || 'illustration';
      const altText = item.altText || '';
      const outPath = getChapterIllustrationPath(seriesSlug, chapterNum, i + 1);

      resolvedIllustrations.push({ ...item, imagePath: outPath });

      if (dryRun) {
        console.log(
          `[series-add-illustrations] [dry-run] 會產圖：${path.basename(outPath)} — ${prompt.slice(0, 60)}`
        );
        continue;
      }

      try {
        const buffer = await generateThumbnail(prompt, { style, referenceImagePaths });
        fs.writeFileSync(outPath, buffer);
        console.log(`[series-add-illustrations] 已寫入：${path.basename(outPath)}`);
      } catch (err) {
        throw new Error(`產圖失敗（${path.basename(outPath)}）：${err.message}`);
      }
    }

    if (dryRun) {
      console.log('[series-add-illustrations] dry-run 結束，未寫入 HTML');
      return;
    }

    const newBlocks = insertFigures(blocks, resolvedIllustrations);
    fs.writeFileSync(htmlPath, newBlocks.join('\n'), 'utf8');
    console.log(`[series-add-illustrations] 已更新：${htmlPath}`);
  } catch (error) {
    console.error('[series-add-illustrations] 失敗：', error.message);
    process.exitCode = 1;
  }
}

main();
