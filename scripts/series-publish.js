#!/usr/bin/env node

/**
 * series-publish.js
 * 發布長篇連載單一單元（章節 / 課程 / 集）到 WordPress，
 * 自動注入系列 Category，並更新設定檔。
 *
 * 用法：
 *   yarn series:publish --series <slug> --chapter <num> --title <標題> [options]
 *
 * 選項：
 *   --series          必填，系列 slug
 *   --chapter         必填，單元號（整數）
 *   --title           必填，本單元標題
 *   --status          選填，draft（預設）或 publish
 *   --tags            選填，Tag IDs（逗號分隔）
 *   --summary         選填，本單元摘要（存入 config.json，供 Agent 下一單元參考）
 *   --skip-thumbnail  選填 flag，跳過封面上傳
 *   --update-slug     選填，若指定則以此 slug 尋找既有文章並以 update 模式更新內容（不再新建）
 */

import fs from 'fs';
import path from 'path';
import { uploadMedia, createPost, updatePost, getPosts } from '../lib/wp-client.js';
import { uploadInlineImages } from '../lib/upload-inline-images.js';
import {
  readSeriesConfig,
  writeSeriesConfig,
  getChapterHtmlPath,
  getChapterJpgPath,
  updateChapterStatus,
  addPublishedChapter,
} from '../lib/series-config.js';

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
  const title = args.title;
  const status = args.status || 'draft';
  const tagIds = args.tags ? args.tags.split(',').map((id) => Number(id)) : [];
  const summary = args.summary || '';
  const skipThumbnail = args['skip-thumbnail'] === true;
  const updateSlug = args['update-slug'];

  if (!seriesSlug) {
    console.error('[series-publish] 錯誤：缺少 --series 參數');
    process.exitCode = 1;
    return;
  }
  if (isNaN(chapterNum) || chapterNum < 1) {
    console.error('[series-publish] 錯誤：--chapter 需為正整數');
    process.exitCode = 1;
    return;
  }
  if (!title) {
    console.error('[series-publish] 錯誤：缺少 --title 參數');
    process.exitCode = 1;
    return;
  }

  try {
    const config = readSeriesConfig(seriesSlug);
    const wpCategoryId = config.wp_category_id;

    // 章節 slug：<series>-ch<NN>
    const padded = String(chapterNum).padStart(2, '0');
    const chapterSlug = `${seriesSlug}-ch${padded}`;

    // 讀取章節 HTML
    const htmlPath = getChapterHtmlPath(seriesSlug, chapterNum);
    if (!fs.existsSync(htmlPath)) {
      throw new Error(`章節 HTML 不存在：${htmlPath}`);
    }
    let content = fs.readFileSync(htmlPath, 'utf8');

    // 上傳文內圖片並改寫 src（相對路徑 → WordPress 媒體 URL）
    content = await uploadInlineImages(content, htmlPath);

    // 上傳封面（不存在則警告繼續）
    let featuredMediaId;
    if (!skipThumbnail) {
      const jpgPath = getChapterJpgPath(seriesSlug, chapterNum);
      if (fs.existsSync(jpgPath)) {
        const buffer = fs.readFileSync(jpgPath);
        const filename = path.basename(jpgPath);
        const media = await uploadMedia(buffer, filename, 'image/jpeg');
        featuredMediaId = media.id;
        console.log(`[series-publish] 封面已上傳：id=${featuredMediaId}`);
      } else {
        console.warn(`[series-publish] 封面不存在，略過：${jpgPath}`);
      }
    }

    const categories = wpCategoryId ? [wpCategoryId] : [];
    let post;

    if (updateSlug) {
      // 更新既有文章（依 slug 查找）
      const existing = await getPosts({ slug: updateSlug, status: 'any' });
      if (!existing.length) {
        throw new Error(`找不到 slug 為「${updateSlug}」的文章，無法更新`);
      }
      const postId = existing[0].id;
      const updatePayload = {
        title,
        content,
        status,
        categories,
        tags: tagIds,
      };
      if (featuredMediaId) {
        updatePayload.featuredMediaId = featuredMediaId;
      }
      post = await updatePost(postId, updatePayload);
      console.log(`[series-publish] 已更新既有文章：id=${postId}, slug=${updateSlug}`);
    } else {
      // 發布到 WP（新建）
      post = await createPost({
        title,
        content,
        status,
        categories,
        tags: tagIds,
        featuredMediaId,
        slug: chapterSlug,
      });
      console.log(`[series-publish] 已發布：id=${post.id}, url=${post.link}`);
    }

    const wpPostId = post.id;
    const postLink = post.link;

    // 更新 config.json
    const publishedEntry = {
      chapter: chapterNum,
      slug: chapterSlug,
      wp_post_id: wpPostId,
      published_at: new Date().toISOString(),
      summary,
    };

    const configWithChapter = addPublishedChapter(config, publishedEntry);
    const configWithStatus = updateChapterStatus(configWithChapter, chapterNum, 'published');
    writeSeriesConfig(seriesSlug, configWithStatus);
    console.log(`[series-publish] config 已更新`);

    console.log(`\n文章 URL：${postLink}`);
  } catch (error) {
    console.error('[series-publish] 發布失敗：', error.message);
    if (error.response) {
      console.error('  status:', error.response.status);
      console.error('  data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exitCode = 1;
  }
}

main();
