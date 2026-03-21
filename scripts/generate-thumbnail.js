#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateThumbnail } from '../lib/generate-thumbnail.js';

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
  const prompt = args.prompt || 'Blog thumbnail';
  const referenceArg = args.reference || args.ref || '';
  const imageSourceRaw = args['image-source'] || args.imageSource || 'gemini';
  const imageSource = String(imageSourceRaw).toLowerCase() === 'pexels' ? 'pexels' : 'gemini';
  const pexelsQuery = args['pexels-query'] || args.pexelsQuery || '';

  const projectRoot = path.resolve(__dirname, '..');
  const referenceImagePaths = String(referenceArg)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((p) => (path.isAbsolute(p) ? p : path.resolve(projectRoot, p)));
  const outPath = args.out
    ? path.resolve(projectRoot, args.out)
    : path.resolve(projectRoot, 'article-drafts/thumbnail.jpg');

  if (imageSource === 'pexels' && !String(pexelsQuery).trim()) {
    console.error('[generate-thumbnail] --image-source pexels 時必須提供 --pexels-query');
    process.exitCode = 1;
    return;
  }

  try {
    const { buffer } = await generateThumbnail(prompt, {
      imageSource,
      pexelsQuery: imageSource === 'pexels' ? pexelsQuery : undefined,
      referenceImagePaths: imageSource === 'gemini' ? referenceImagePaths : [],
      usedPhotoIds: new Set(),
    });
    fs.writeFileSync(outPath, buffer);
    console.log('[generate-thumbnail] saved to', outPath);
  } catch (error) {
    console.error('[generate-thumbnail] 產生縮圖失敗');
    console.error(error.message);
    process.exitCode = 1;
  }
}

main();
