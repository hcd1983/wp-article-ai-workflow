# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

IT Monk 自動發文系統：由 AI Agent 依 `SKILL.md` 的規格，執行「文章方向 → 搜尋文獻 → 產文 → 分類縮圖 → 發布」完整流程，目標站點為 WordPress。

核心 Skill 規格見 [`SKILL.md`](SKILL.md)，包含完整的 7 步驟 Agent 執行流程與 interview 模式。

---

## 環境設定

```bash
# 安裝依賴
yarn

# 複製環境變數並填入真實值（勿提交）
cp .env.example .env

# 確認設定可讀取
yarn test:config
```

必填環境變數：`SITE`、`USER_NAME`、`WP_APP_PASSWORD`、`GEMINI_API_KEY`

插圖相關選填：`ILLUSTRATION_ENABLED_DEFAULT`（預設 true）、`ILLUSTRATION_MAX_PER_ARTICLE`（預設 3）、`ILLUSTRATION_DEFAULT_STYLE`（預設 `clean diagram, minimal`）、`ILLUSTRATION_STRICT_MODE`（預設 false；為 true 時任一幅插圖失敗即中斷整篇）

Pexels 圖庫選填：`PEXELS_API_KEY`（使用 `source: pexels` 或 `--image-source pexels` 時需要）、`PEXELS_ATTRIBUTION_DEFAULT`（預設 true，於 figcaption 顯示攝影師／來源連結）

---

## 可用指令

| 指令 | 說明 |
|------|------|
| `yarn test:config` | 驗證 `.env` 設定是否可讀取 |
| `yarn wp:get-tags` | 讀取 WordPress 所有 Tag 與 Category（含 id） |
| `yarn wp:publish-post` | 發布或更新 WordPress 文章（見下方參數） |
| `yarn ai:generate-thumbnail` | 依 `--image-source` 呼叫 Gemini 或 Pexels + Sharp 壓縮縮圖 |
| `yarn ai:add-illustrations` | 依插圖計畫 JSON（可混合 Gemini / Pexels）產圖並插入 HTML；可加 `--strict` |
| `yarn series:add-illustrations` | 依系列計畫插圖；Gemini 時可選參考圖鎖角色；**Pexels 來源不使用**角色參考圖 |
| `yarn series:publish` | 發布或更新連載章節（支援 update-slug，並自動處理文內圖片上傳與 Tag） |

### wp:publish-post 常用參數

**新文章（必帶 `--slug`）：**
```bash
yarn wp:publish-post \
  --title "<標題>" \
  --content-file ./article-drafts/<slug>.html \
  --status publish \
  --slug "<slug>" \
  --thumbnail ./article-drafts/<slug>.jpg \
  --categories "1,2" \
  --tags "3,4,5"
```

**更新既有文章（依 slug 查找）：**
```bash
yarn wp:publish-post \
  --update-slug "<既有 slug>" \
  --content-file ./article-drafts/<slug>.html \
  --thumbnail ./article-drafts/<slug>.jpg
```

### ai:generate-thumbnail 參數

```bash
# 預設 Gemini
yarn ai:generate-thumbnail --prompt "<英文描述>" --out ./article-drafts/<slug>.jpg
# （可選）帶參考圖，維持角色/畫風一致（可逗號分隔多張，僅 Gemini）
yarn ai:generate-thumbnail --prompt "<英文描述>" --reference "./path/to/ref.jpg" --out ./article-drafts/<slug>.jpg
# Pexels 圖庫（需 PEXELS_API_KEY）
yarn ai:generate-thumbnail --image-source pexels --pexels-query "<搜尋關鍵字>" --out ./article-drafts/<slug>.jpg
```

> **產圖準則**：若有對應的系列設定檔（例如 `_<slug>-series-config.md` 中的 `art_style.cover_style` / `art_style.illustration_style`），除非使用者明確要求 override，所有封面與插圖的 prompt 應優先依該 Art Bible 組成（再補充場景語意），不要自行加入與其衝突的寫實風格或其他畫風關鍵字。

### ai:add-illustrations 參數

```bash
yarn ai:add-illustrations --article ./article-drafts/<slug>.html --plan <計畫.json>
# 舊版「一錯即停」行為
yarn ai:add-illustrations --article ./article-drafts/<slug>.html --plan <計畫.json> --strict
```

### series:add-illustrations 常用參數

```bash
# 產圖並插入章節 HTML
yarn series:add-illustrations --series <slug> --chapter <N> --plan <計畫.json>

# （可選）用參考圖維持角色一致（可逗號分隔多張）
yarn series:add-illustrations --series <slug> --chapter <N> --plan <計畫.json> --reference "./path/to/ref.jpg"

# （可選）使用系列 config 的角色參考圖（characters[].reference_image）；預設不套用
yarn series:add-illustrations --series <slug> --chapter <N> --plan <計畫.json> --use-character-reference
```

插圖計畫 JSON 格式：
```json
{
  "defaultSource": "gemini",
  "style": "主風格描述（選填，Gemini 用）",
  "illustrations": [
    {
      "insertAfterBlockIndex": 0,
      "source": "gemini",
      "prompt": "英文圖像描述",
      "altText": "圖說"
    },
    {
      "insertAfterBlockIndex": 2,
      "source": "pexels",
      "pexelsQuery": "software team collaboration",
      "altText": "圖說",
      "attribution": false
    }
  ]
}
```

- `insertAfterBlockIndex` 從 0 開始，以 HTML 頂層元素（h1/h2/p/ul/ol/hr/pre）順序計算。
- `source` 省略時依 `defaultSource`，再預設 `gemini`。Pexels 須提供 `pexelsQuery`。
- 預設單張失敗會略過該張並繼續；`ILLUSTRATION_STRICT_MODE=true` 或 `--strict` 可改為整篇中斷。

---

## 架構說明

### 模組職責

- **`lib/config.js`** — 讀取 `.env`，export `config` 物件，所有腳本透過此檔取得設定。
- **`lib/wp-client.js`** — 封裝 WordPress REST API（Basic Auth），提供 `getTags`、`getCategories`、`getPosts`、`uploadMedia`、`createPost`、`updatePost`。
- **`lib/gemini-image.js`** — 呼叫 Gemini API 產生圖片 Buffer。
- **`lib/image-source-registry.js`** — Registry／Strategy：`gemini`、`pexels`，統一 `generateRawImage`。
- **`lib/strategies/gemini-strategy.js`** / **`lib/strategies/pexels-strategy.js`** — 各來源實作。
- **`lib/pexels-client.js`** — Pexels Photos Search（橫向、寬度篩選、同篇 photo id 去重、rate limit 提示）。
- **`lib/fetch-image-buffer.js`** — 自 URL 下載圖片 Buffer（timeout + 1 次重試）。
- **`lib/generate-thumbnail.js`** — 經 registry 產圖 + `thumbnail-optimize`；回傳 `{ buffer, meta? }`。
- **`lib/thumbnail-optimize.js`** — 以 Sharp 壓縮並調整圖片尺寸。
- **`lib/illustration-config.js`** — 載入 `.env` 插圖設定 + 解析 `docs/illustration-rules.md` 的 YAML 排除規則。

### 腳本職責

- **`scripts/wp-get-tags.js`** — 印出站點所有 tags + categories JSON。
- **`scripts/wp-publish-post.js`** — 發布/更新文章，自動上傳文內相對路徑圖片到 WordPress 媒體庫。
- **`scripts/generate-thumbnail.js`** — CLI 入口，解析 `--prompt` / `--out` 參數後呼叫 `lib/generate-thumbnail.js`。
- **`scripts/add-illustrations.js`** — CLI 入口，讀入插圖計畫 JSON，依序產圖並插入 HTML `<figure>`。
- **`scripts/upload-inline-images-once.js`** — 一次性輔助工具，將文內圖片統一上傳到 WordPress。

### 文章命名規範

- **Slug**：英文小寫 + 連字號（e.g. `ai-replace-programmers`），與草稿檔名主檔名一致。
- 草稿 HTML：`article-drafts/<slug>.html`
- 縮圖：`article-drafts/<slug>.jpg`
- 插圖：`article-drafts/<slug>-1.jpg`、`<slug>-2.jpg`…

### HTML 文章格式限制

- **只輸出內容片段**，禁止 `<!DOCTYPE>`、`<html>`、`<head>`、`<body>`、`<script>`、`<style>`。
- 若單篇不要插圖，HTML 最開頭加 `<!-- illustration: off -->`。

### 插圖排除規則

見 `docs/illustration-rules.md`，支援 `exclude_types`（分類 slug）與 `exclude_tags`（標籤 slug）。

---

## 重要文件

- [`SKILL.md`](SKILL.md) — AI Agent 完整執行流程規格（7 步驟 + interview 模式）
- [`docs/prd.md`](docs/prd.md) — 產品需求規格
- [`docs/illustration-rules.md`](docs/illustration-rules.md) — 插圖排除規則設定
- [`docs/article-ideas.md`](docs/article-ideas.md) — 文章發想清單
- [`agents/editing-assistant.md`](agents/editing-assistant.md) — 文章編輯 Agent 規格
