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
 * 在區塊陣列中，在指定 index 之後插入 figure 元素（不 mutate 原 blocks 陣列）。
 * 內部依 insertAfterBlockIndex **降序**插入，避免多張插圖時索引位移錯位。
 *
 * @param {string[]} blocks
 * @param {{
 *   insertAfterBlockIndex: number,
 *   altText: string,
 *   imagePath: string,
 *   showAttribution?: boolean,
 *   pexelsMeta?: { photographer: string, photographerUrl: string, sourceUrl: string }
 * }[]} illustrations
 * @returns {string[]}
 */
export function insertFigures(blocks, illustrations) {
  if (!illustrations.length) {
    return [...blocks];
  }

  const withOrder = illustrations.map((item, order) => ({ ...item, _order: order }));
  withOrder.sort((a, b) => {
    if (b.insertAfterBlockIndex !== a.insertAfterBlockIndex) {
      return b.insertAfterBlockIndex - a.insertAfterBlockIndex;
    }
    return b._order - a._order;
  });

  const result = [...blocks];
  for (const item of withOrder) {
    const idx = item.insertAfterBlockIndex + 1;
    if (idx < 0 || idx > result.length) {
      result.push(buildFigureHtml(item));
      continue;
    }
    result.splice(idx, 0, buildFigureHtml(item));
  }

  return result;
}

/**
 * @param {{ altText: string, imagePath: string, showAttribution?: boolean, pexelsMeta?: object }} item
 */
export function buildFigureHtml(item) {
  const { altText, imagePath } = item;
  const filename = path.basename(imagePath);
  const captionInner = buildFigcaptionInner(item);
  return `<figure><img src="${escapeHtmlAttr(filename)}" alt="${escapeHtmlAttr(altText)}"/><figcaption>${captionInner}</figcaption></figure>\n`;
}

/**
 * @param {{ altText: string, showAttribution?: boolean, pexelsMeta?: { photographer: string, photographerUrl: string, sourceUrl: string } }} item
 */
export function buildFigcaptionInner(item) {
  const alt = escapeHtml(item.altText || '');
  if (!item.showAttribution || !item.pexelsMeta) {
    return alt;
  }
  const { photographer, photographerUrl, sourceUrl } = item.pexelsMeta;
  const name = escapeHtml(photographer || '');
  const pUrl = escapeHtmlAttr(photographerUrl || '');
  const sUrl = escapeHtmlAttr(sourceUrl || '');
  const credit = `Photo by <a href="${pUrl}" rel="noopener noreferrer">${name}</a> on <a href="${sUrl}" rel="noopener noreferrer">Pexels</a>`;
  return `${alt}<br/><small>${credit}</small>`;
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
