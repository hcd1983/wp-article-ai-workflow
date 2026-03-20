import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import 'dotenv/config';

const SRC_DIR = path.resolve(process.cwd(), 'article-drafts');
const DEFAULT_DST = '/Users/hcd1983/article-review/wp-article-ai-workflow';
const DST_DIR = path.resolve(process.env.REVIEW_DRAFTS_DIR || DEFAULT_DST);

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function listFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith('.'));
}

async function main() {
  await ensureDir(DST_DIR);

  const files = await listFiles(SRC_DIR);
  if (files.length === 0) {
    console.log(`[sync-review-drafts] no files to sync from ${SRC_DIR}`);
    return;
  }

  for (const file of files) {
    const src = path.join(SRC_DIR, file);
    const dst = path.join(DST_DIR, file);
    await fs.copyFile(src, dst);
    console.log(`[sync-review-drafts] synced ${file}`);
  }

  console.log(`[sync-review-drafts] done -> ${DST_DIR}`);
}

main().catch((error) => {
  console.error('[sync-review-drafts] failed');
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
