#!/usr/bin/env node

/**
 * series-add-illustrations.js
 * 依插圖計畫為連載單元 HTML 生成插圖並插入 <figure>。
 * 預設插圖風格從系列 art_style.illustration_style 讀取，保持跨章節視覺一致性。
 *
 * 用法：
 *   yarn series:add-illustrations --series <slug> --chapter <num> --plan <path 或 -> [--use-character-reference] [--strict]
 *
 * 計畫格式（JSON）：
 *   {
 *     "defaultSource": "gemini" | "pexels"（可選）,
 *     "style": "可選，覆寫整篇風格",
 *     "illustrations": [
 *       {
 *         "insertAfterBlockIndex": 0,
 *         "source": "gemini" | "pexels"（可選）,
 *         "prompt": "英文描述（Gemini）",
 *         "pexelsQuery": "關鍵字（Pexels）",
 *         "altText": "圖說",
 *         "attribution": false（可選）
 *       }
 *     ]
 *   }
 *
 * 優先順序：
 *   單張 style > plan.style > config.art_style.illustration_style
 *
 * Pexels 來源不使用系列角色參考圖（referenceImagePaths）。
 */

import fs from 'fs';
import path from 'path';
import { generateThumbnail } from '../lib/generate-thumbnail.js';
import { getIllustrationConfig } from '../lib/illustration-config.js';
import {
  readSeriesConfig,
  getChapterHtmlPath,
  getChapterIllustrationPath,
} from '../lib/series-config.js';
import { splitIntoBlocks, insertFigures } from '../lib/html-utils.js';
import { resolveImageSource, resolveShowAttribution } from '../lib/illustration-plan-utils.js';
import { parseCliArgs } from '../lib/parse-cli-args.js';

async function main() {
  const args = parseCliArgs();
  const seriesSlug = args.series;
  const chapterNum = args.chapter ? parseInt(args.chapter, 10) : NaN;
  const planPath = args.plan;
  const dryRun = args['dry-run'] === true;
  const strictCli = args.strict === true;
  const referenceArg = args.reference || args.ref || '';
  const useCharacterReference = args['use-character-reference'] === true;

  if (!seriesSlug || isNaN(chapterNum) || !planPath) {
    console.error(
      '用法: yarn series:add-illustrations --series <slug> --chapter <num> --plan <path 或 -> [--strict]'
    );
    process.exitCode = 1;
    return;
  }

  const ilc = getIllustrationConfig();
  const strict = strictCli || ilc.strictMode;

  try {
    const config = readSeriesConfig(seriesSlug);
    const baseStyle = config.art_style?.illustration_style || '';
    const seriesDir = path.dirname(getChapterHtmlPath(seriesSlug, chapterNum));
    const cliReferencePaths = String(referenceArg)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((p) => path.resolve(p));
    let referenceImagePaths = [...cliReferencePaths];

    const htmlPath = getChapterHtmlPath(seriesSlug, chapterNum);
    if (!fs.existsSync(htmlPath)) {
      throw new Error(`章節 HTML 不存在：${htmlPath}`);
    }
    const html = fs.readFileSync(htmlPath, 'utf8');

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

    const maxCount = ilc.maxPerArticle;
    if (illustrations.length > maxCount) {
      console.warn(`[series-add-illustrations] 計畫共 ${illustrations.length} 張，上限 ${maxCount}，僅處理前 ${maxCount} 張`);
    }
    const toProcess = illustrations.slice(0, maxCount);

    const sorted = [...toProcess].sort(
      (a, b) => (a.insertAfterBlockIndex ?? 0) - (b.insertAfterBlockIndex ?? 0)
    );

    const blocks = splitIntoBlocks(html);
    const usedPhotoIds = new Set();
    const successItems = [];

    for (let i = 0; i < sorted.length; i += 1) {
      const item = sorted[i];
      const source = resolveImageSource(plan, item);
      const style = item.style ?? plan.style ?? baseStyle;
      const prompt = item.prompt || 'illustration';
      const altText = item.altText || '';
      const seq = i + 1;
      const outPath = getChapterIllustrationPath(seriesSlug, chapterNum, seq);
      const showAttribution = resolveShowAttribution(source, item, ilc.pexelsAttributionDefault);

      if (dryRun) {
        console.log(
          `[series-add-illustrations] [dry-run] 會產圖：${path.basename(outPath)} (${source}) — ${(prompt || item.pexelsQuery || '').slice(0, 60)}`
        );
        continue;
      }

      const genOptions = {
        imageSource: source,
        prompt,
        pexelsQuery: item.pexelsQuery,
        style: source === 'gemini' ? style : undefined,
        referenceImagePaths: source === 'gemini' ? referenceImagePaths : [],
        usedPhotoIds,
      };

      try {
        const { buffer, meta } = await generateThumbnail(prompt, genOptions);
        fs.writeFileSync(outPath, buffer);
        console.log(`[series-add-illustrations] 已寫入：${path.basename(outPath)} (${source})`);
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
        console.error(`[series-add-illustrations] 產圖失敗（${path.basename(outPath)}）：`, err.message);
        if (strict) {
          throw err;
        }
      }
    }

    if (dryRun) {
      console.log('[series-add-illustrations] dry-run 結束，未寫入 HTML');
      return;
    }

    const newBlocks = insertFigures(blocks, successItems);
    fs.writeFileSync(htmlPath, newBlocks.join('\n'), 'utf8');
    console.log(`[series-add-illustrations] 已更新：${htmlPath}`);
  } catch (error) {
    console.error('[series-add-illustrations] 失敗：', error.message);
    process.exitCode = 1;
  }
}

main();
