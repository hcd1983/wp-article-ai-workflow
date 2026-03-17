/**
 * 從 .env 讀取設定，不寫死任何密鑰。
 * 使用前請複製 .env.example 為 .env 並填入實際值。
 */
import dotenv from 'dotenv';

dotenv.config();

const config = {
  /** WordPress 網站網址，例：https://it-monk.com */
  SITE: process.env.SITE ?? '',
  /** WordPress 使用者名稱（搭配應用程式密碼） */
  USER_NAME: process.env.USER_NAME ?? '',
  /** WordPress 應用程式密碼（Application Password） */
  WP_APP_PASSWORD: process.env.WP_APP_PASSWORD ?? '',
  /** Gemini API 金鑰 */
  GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? '',
  /** 文章插圖：預設是否啟用自動插圖（true/false） */
  ILLUSTRATION_ENABLED_DEFAULT: process.env.ILLUSTRATION_ENABLED_DEFAULT !== 'false',
  /** 文章插圖：每篇最大插圖數，未設則預設 3 */
  ILLUSTRATION_MAX_PER_ARTICLE: Math.max(1, parseInt(process.env.ILLUSTRATION_MAX_PER_ARTICLE || '3', 10)),
  /** 文章插圖：預設圖像風格（會併入產圖 prompt） */
  ILLUSTRATION_DEFAULT_STYLE: process.env.ILLUSTRATION_DEFAULT_STYLE || 'clean diagram, minimal',
};

export { config };
