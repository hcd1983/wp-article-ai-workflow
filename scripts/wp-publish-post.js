#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createPost, updatePost, getPosts, uploadMedia } from '../lib/wp-client.js';
import { uploadInlineImages } from '../lib/upload-inline-images.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
    parsed[key] = value;
  }

  return parsed;
}

async function main() {
  const args = parseArgs();

  const title = args.title || '無標題文章';
  const contentFile = args['content-file'];
  const rootDir = path.resolve(__dirname, '..');
  const contentPath = contentFile
    ? (path.isAbsolute(contentFile) ? contentFile : path.resolve(rootDir, contentFile))
    : null;
  let content = contentPath
    ? fs.readFileSync(contentPath, 'utf8')
    : (args.content || '');
  const status = args.status || 'draft';
  const slug = args.slug || undefined;
  const updateSlug = args['update-slug'];
  const thumbnailPath = args.thumbnail
    ? (path.isAbsolute(args.thumbnail) ? args.thumbnail : path.resolve(rootDir, args.thumbnail))
    : null;

  const categoryIds = args.categories ? args.categories.split(',').map((id) => Number(id)) : [];
  const tagIds = args.tags ? args.tags.split(',').map((id) => Number(id)) : [];

  let featuredMediaId;

  try {
    if (updateSlug) {
      const posts = await getPosts({ slug: updateSlug });
      if (!posts.length) {
        throw new Error(`找不到 slug 為「${updateSlug}」的文章`);
      }
      const postId = posts[0].id;
      let updatedContent = content;
      if (contentPath && content) {
        updatedContent = await uploadInlineImages(content, contentPath);
      }
      const updatePayload = updatedContent ? { content: updatedContent } : {};

      if (thumbnailPath && fs.existsSync(thumbnailPath)) {
        const buffer = fs.readFileSync(thumbnailPath);
        const filename = path.basename(thumbnailPath);
        const media = await uploadMedia(buffer, filename, 'image/jpeg');
        updatePayload.featuredMediaId = media.id;
      }

      const post = await updatePost(postId, updatePayload);
      console.log(JSON.stringify(post, null, 2));
      return;
    }

    if (contentPath && content) {
      content = await uploadInlineImages(content, contentPath);
    }

    if (thumbnailPath) {
      const buffer = fs.readFileSync(thumbnailPath);
      const filename = path.basename(thumbnailPath);
      const mimeType = 'image/jpeg';

      const media = await uploadMedia(buffer, filename, mimeType);
      featuredMediaId = media.id;
    }

    const post = await createPost({
      title,
      content,
      status,
      categories: categoryIds,
      tags: tagIds,
      featuredMediaId,
      slug,
    });

    console.log(JSON.stringify(post, null, 2));
  } catch (error) {
    console.error('[wp-publish-post] 發布失敗');
    if (error.response) {
      console.error('status:', error.response.status);
      console.error('data:', error.response.data);
    } else {
      console.error(error.message);
    }
    process.exitCode = 1;
  }
}

main();

