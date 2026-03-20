import path from 'path';

/**
 * 將 HTML 片段切成「頂層區塊」陣列（comment, ul, ol, h1-h4, p, pre, hr）。
 * @param {string} html
 * @returns {string[]}
 */
export function splitIntoBlocks(html) {
  const blocks = [];
  let remaining = html.trim();
  const patterns = [
    /^(<!--[\s\S]*?-->)/i,
    /^<(ul)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/i,
    /^<(ol)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/i,
    /^<(h[1-4])(?:\s[^>]*)?>([\s\S]*?)<\/\1>/i,
    /^<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/i,
    /^<pre(?:\s[^>]*)?>([\s\S]*?)<\/pre>/i,
    /^<hr\s*\/?>/i,
  ];

  while (remaining.length > 0) {
    const trimmed = remaining.trimStart();
    if (trimmed.length < remaining.length) {
      blocks.push(remaining.slice(0, remaining.length - trimmed.length));
      remaining = trimmed;
      continue;
    }
    let matched = false;
    for (const re of patterns) {
      const m = remaining.match(re);
      if (m) {
        blocks.push(m[0]);
        remaining = remaining.slice(m[0].length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      const next = remaining.match(/<(?:ul|ol|h[1-4]|p|pre|hr|<!--)/i);
      if (next && next.index > 0) {
        blocks.push(remaining.slice(0, next.index));
        remaining = remaining.slice(next.index);
      } else {
        blocks.push(remaining);
        break;
      }
    }
  }
  return blocks;
}

/**
 * 在區塊陣列中，在指定 index 之後插入 figure 元素（不 mutate 原陣列）。
 * illustrations 須按 insertAfterBlockIndex 升序排列。
 * @param {string[]} blocks
 * @param {{ insertAfterBlockIndex: number, altText: string, imagePath: string }[]} illustrations
 * @returns {string[]}
 */
export function insertFigures(blocks, illustrations) {
  const result = [];
  let figIdx = 0;
  for (let i = 0; i < blocks.length; i += 1) {
    result.push(blocks[i]);
    while (figIdx < illustrations.length && illustrations[figIdx].insertAfterBlockIndex === i) {
      const { altText, imagePath } = illustrations[figIdx];
      const filename = path.basename(imagePath);
      result.push(
        `<figure><img src="${escapeHtmlAttr(filename)}" alt="${escapeHtmlAttr(altText)}"/><figcaption>${escapeHtml(altText)}</figcaption></figure>\n`
      );
      figIdx += 1;
    }
  }
  while (figIdx < illustrations.length) {
    const { altText, imagePath } = illustrations[figIdx];
    const filename = path.basename(imagePath);
    result.push(
      `<figure><img src="${escapeHtmlAttr(filename)}" alt="${escapeHtmlAttr(altText)}"/><figcaption>${escapeHtml(altText)}</figcaption></figure>\n`
    );
    figIdx += 1;
  }
  return result;
}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function escapeHtmlAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
