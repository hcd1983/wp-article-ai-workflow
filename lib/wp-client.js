import axios from 'axios';
import { config, validateWpConfig } from './config.js';

/**
 * WordPress REST API client
 * - 使用 SITE 當 baseURL
 * - Lazy init：第一次呼叫 API 時才建立 axios instance 並驗證設定
 */

let _wp = null;

function getWpClient() {
  if (!_wp) {
    validateWpConfig();
    _wp = axios.create({
      baseURL: `${config.SITE.replace(/\/$/, '')}/wp-json`,
      timeout: 60000,
      auth: {
        username: config.USER_NAME,
        password: config.WP_APP_PASSWORD,
      },
    });
  }
  return _wp;
}

/** @deprecated 直接使用各 function 即可；僅保留供極端情境存取 */
const wp = new Proxy({}, {
  get(_, prop) {
    return getWpClient()[prop];
  },
});

async function getTags(params = {}) {
  const response = await getWpClient().get('/wp/v2/tags', { params });
  return response.data;
}

async function getCategories(params = {}) {
  const response = await getWpClient().get('/wp/v2/categories', { params });
  return response.data;
}

async function getPosts(params = {}) {
  const response = await getWpClient().get('/wp/v2/posts', { params });
  return response.data;
}

async function uploadMedia(fileBuffer, filename, mimeType) {
  const url = '/wp/v2/media';
  const safeFilename = String(filename).replace(/[^\w.\-]/g, '_');
  const headers = {
    'Content-Disposition': `attachment; filename="${safeFilename}"`,
    'Content-Type': mimeType,
  };

  const response = await getWpClient().post(url, fileBuffer, { headers });
  return response.data;
}

async function createPost({ title, content, status = 'draft', categories = [], tags = [], featuredMediaId, slug }) {
  const url = '/wp/v2/posts';
  const payload = {
    title,
    content,
    status,
    categories,
    tags,
  };

  if (featuredMediaId) {
    payload.featured_media = featuredMediaId;
  }

  if (slug) {
    payload.slug = slug;
  }

  const response = await getWpClient().post(url, payload);
  return response.data;
}

async function updatePost(postId, { title, content, status, categories, tags, featuredMediaId, slug }) {
  const id = Number(postId);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error(`無效的 postId：${postId}`);
  }
  const url = `/wp/v2/posts/${id}`;
  const payload = {};

  if (title !== undefined) payload.title = title;
  if (content !== undefined) payload.content = content;
  if (status !== undefined) payload.status = status;
  if (categories !== undefined) payload.categories = categories;
  if (tags !== undefined) payload.tags = tags;
  if (featuredMediaId !== undefined) payload.featured_media = featuredMediaId;
  if (slug !== undefined) payload.slug = slug;

  const response = await getWpClient().patch(url, payload);
  return response.data;
}

async function createCategory(name, slug, { parent, description } = {}) {
  const payload = { name, slug };
  if (parent) payload.parent = parent;
  if (description) payload.description = description;
  const response = await getWpClient().post('/wp/v2/categories', payload);
  return response.data;
}

export { wp, getTags, getCategories, getPosts, uploadMedia, createPost, updatePost, createCategory };


