import axios from 'axios';
import { config } from './config.js';

/**
 * WordPress REST API client
 * - 使用 SITE 當 baseURL
 * - 先支援最基本的 GET（後續 Phase 2.2/4.x 再擴充）
 */

if (!config.SITE) {
  // 不直接 throw，讓呼叫端可以決定如何處理，但在 log 中提示
  console.warn('[wp-client] SITE 未設定，請確認 .env');
}

const axiosConfig = {
  baseURL: config.SITE ? `${config.SITE.replace(/\/$/, '')}/wp-json` : '',
  // 有些主機上傳媒體較慢，將預設 timeout 調高到 60 秒
  timeout: 60000,
};

// 若有設定 WordPress 使用者與應用程式密碼，使用 Basic Auth
if (config.USER_NAME && config.WP_APP_PASSWORD) {
  axiosConfig.auth = {
    username: config.USER_NAME,
    password: config.WP_APP_PASSWORD,
  };
} else {
  console.warn('[wp-client] 未設定 USER_NAME 或 WP_APP_PASSWORD，呼叫 WordPress API 可能會 401/403');
}

const wp = axios.create(axiosConfig);

async function getTags(params = {}) {
  const response = await wp.get('/wp/v2/tags', { params });
  return response.data;
}

async function getCategories(params = {}) {
  const response = await wp.get('/wp/v2/categories', { params });
  return response.data;
}

async function getPosts(params = {}) {
  const response = await wp.get('/wp/v2/posts', { params });
  return response.data;
}

async function uploadMedia(fileBuffer, filename, mimeType) {
  const url = '/wp/v2/media';
  const headers = {
    'Content-Disposition': `attachment; filename=\"${filename}\"`,
    'Content-Type': mimeType,
  };

  const response = await wp.post(url, fileBuffer, {
    headers,
  });

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

  const response = await wp.post(url, payload);
  return response.data;
}

async function updatePost(postId, { title, content, status, categories, tags, featuredMediaId, slug }) {
  const url = `/wp/v2/posts/${postId}`;
  const payload = {};

  if (title !== undefined) payload.title = title;
  if (content !== undefined) payload.content = content;
  if (status !== undefined) payload.status = status;
  if (categories !== undefined) payload.categories = categories;
  if (tags !== undefined) payload.tags = tags;
  if (featuredMediaId !== undefined) payload.featured_media = featuredMediaId;
  if (slug !== undefined) payload.slug = slug;

  const response = await wp.patch(url, payload);
  return response.data;
}

async function createCategory(name, slug, { parent, description } = {}) {
  const payload = { name, slug };
  if (parent) payload.parent = parent;
  if (description) payload.description = description;
  const response = await wp.post('/wp/v2/categories', payload);
  return response.data; // { id, name, slug, link, parent, description }
}

export { wp, getTags, getCategories, getPosts, uploadMedia, createPost, updatePost, createCategory };


