# 產品需求規格書（PRD）
## IT Monk 自動發文機制

---

## 1. 專案概述

| 項目 | 說明 |
|------|------|
| 專案名稱 | IT Monk 自動發文機制 |
| 目標 | 建立一套自動化流程，將 AI 產生的圖文內容發布至 WordPress 網站 |
| **主要產出** | **本專案的 Skill**，供 **AI Agent** 讀取並執行完整發文流程 |
| 執行方式 | 由 AI agent 依 Skill 指示依序呼叫腳本與工具，完成從「文章方向」到「發布」的流程 |

---

## 2. 目標與價值

- **自動化發文**：減少手動撰寫、找圖、排版與發布的時間。
- **內容品質**：透過 AI 搜尋相關文獻、生成文章與縮圖，維持主題一致與可讀性。
- **Agent 可執行**：以 Skill 形式撰寫，AI agent 可依步驟呼叫對應腳本與 API，無需人工逐步操作。
- **長篇連載**：支援多單元連載創作（小說、技術教學、深度報導），跨章節維持世界觀、角色、風格一致性。
- **可擴充**：架構與腳本分離，便於後續擴充主題、平台或流程。

---

## 3. 功能模式

### 3.1 單篇自動發文（Auto Post）

由使用者提供文章方向起，至文章發布至 WordPress 止，共 **7 步**：

| 步驟 | 說明 | 產出／備註 |
|------|------|------------|
| 1 | **使用者提供文章方向** | 輸入主題／方向，作為後續依據 |
| 2 | **搜尋相關文獻** | 依方向搜尋可引用之文獻，產出摘要或要點 |
| 3 | **產出文章** | 依文獻與方向產出完整文章（繁體中文）。HTML 僅輸出內容片段，禁止輸出 `<!DOCTYPE>`、`<html>`、`<head>`、`<body>` 及任何 `<script>` 標籤。 |
| 3.5 | **文章插圖（可選）** | Agent 決定插圖位置與風格，呼叫 `ai:add-illustrations` |
| 4 | **歸類分類與 Tag** | 自動判斷並建議適合的 Category 與 Tag（至少 5 個 Tag） |
| 5 | **產出縮圖 prompt** | 根據文章內容產生用於生成縮圖的英文描述 |
| 6 | **生成與優化縮圖** | 呼叫 Gemini 產圖，以 Sharp 處理尺寸與格式 |
| 7 | **發布到 WordPress** | 上傳縮圖、建立文章、設定 Category / Tag、設 featured image |

詳細規格見 [`skills/auto-post.md`](../skills/auto-post.md)。

### 3.2 Interview 模式

透過專訪式對談挖掘使用者故事與觀點，產出大綱、標題建議、方向與風格建議，供後續 auto-post 或 series-writer 使用。

詳細規格見 [`skills/interview.md`](../skills/interview.md)。

### 3.3 長篇連載內容模式（Series Writer）

支援三種子類型，從一個核心想法展開完整連載創作流程：

| 子類型 | `--type` | 適用情境 |
|--------|----------|----------|
| 小說 | `novel` | 故事性連載（科幻、奇幻、現代等） |
| 技術教學 | `tutorial` | 課程、教程、系列技術文章 |
| 深度報導 | `investigative` | 調查報導、深度系列 |

**核心功能：**
- **Art Bible**：`art_style` 欄位統一規範封面與插圖的視覺風格
- **子技能鏈**：依類型展開對應子技能（主題構思 → 背景建構 → 結構規劃 → 逐章撰寫）
- **潤稿檢查點**：每個子技能完成後詢問是否出動 `agents/editing-assistant.md`
- **走向調整**：任何階段可提出走向修改，支援 interview 或 direct 模式討論
- **插圖流程**：`series:add-illustrations` 依 Art Bible 風格產圖並插入章節 HTML；可視需要搭配參考圖鎖定角色一致性（例如 `--reference` 或 `--use-character-reference`）

詳細規格見 [`skills/series-writer.md`](../skills/series-writer.md)。

---

## 4. 架構與腳本規劃

### 4.1 主要產出：Skill

- **本專案核心產出為 Skill 文件**（`SKILL.md` 索引 → `skills/` 目錄），供 AI agent 讀取。
- Skill 內容需包含：何時呼叫哪個腳本、輸入輸出、依賴工具與環境變數。

### 4.2 需安裝／依賴的工具

| 工具或套件 | 用途 |
|------------|------|
| **Sharp** | 縮圖尺寸優化、裁切、格式轉換 |
| **Gemini API** | 產圖（縮圖、插圖） |
| **axios** | 呼叫 WordPress REST API |
| **dotenv** | 讀取 `.env` 設定 |

### 4.3 腳本職責

| 腳本 | 職責 |
|------|------|
| `wp-get-tags.js` | 讀取現有 Tag / Category |
| `wp-create-category.js` | 建立新 Category（支援 parent、description） |
| `wp-publish-post.js` | 發布 / 更新單篇文章 |
| `generate-thumbnail.js` | 產圖 + Sharp 縮圖 CLI |
| `add-illustrations.js` | 單篇文章插圖 CLI |
| `series-init.js` | 初始化連載系列 |
| `series-publish.js` | 發布連載單元 |
| `series-add-illustrations.js` | 連載章節插圖 CLI |

### 4.4 架構關係簡述

```
使用者輸入（主題 / 連載想法）
       ↓
  [Skill 引導 Agent]
       ↓
 ┌─ 單篇模式 ──────────────────────────────────┐
 │  搜尋文獻 → 產文 → 插圖 → 縮圖 → 發布        │
 └─────────────────────────────────────────────┘
 ┌─ 連載模式 ──────────────────────────────────┐
 │  series:init → 子技能鏈（依類型）             │
 │    → 逐章撰寫（chapter/lesson/episode-writer）│
 │    → series:add-illustrations（可選）         │
 │    → series:publish                          │
 └─────────────────────────────────────────────┘
       ↓
  WordPress（文章 + 分類 + Tag + 縮圖）
```

---

## 5. 技術需求

| 項目 | 說明 |
|------|------|
| 目標平台 | WordPress（站點由 `.env` 之 `SITE` 指定） |
| 縮圖產出 | Gemini API 產圖 → Sharp 優化尺寸 / 格式 |
| 發文與讀取 | WordPress REST API（Basic Auth） |
| 文章 slug | 不由標題自動產生；需明確訂定英文小寫連字號格式 |
| 認證 | WordPress 應用程式密碼，存放於 `.env` |
| 連載設定 | `article-drafts/<slug>-series/_<slug>-series-config.md`（JSON 格式） |

---

## 6. 環境與設定（.env）

| 變數名稱 | 必填 | 用途 |
|----------|------|------|
| `SITE` | 是 | WordPress 網站網址 |
| `USER_NAME` | 是 | WordPress 使用者名稱 |
| `WP_APP_PASSWORD` | 是 | WordPress 應用程式密碼 |
| `GEMINI_API_KEY` | 是 | Gemini API 金鑰（產圖） |
| `ILLUSTRATION_ENABLED_DEFAULT` | 否 | 預設開啟插圖（`true`） |
| `ILLUSTRATION_MAX_PER_ARTICLE` | 否 | 每篇最多插圖數（`3`） |
| `ILLUSTRATION_DEFAULT_STYLE` | 否 | 插圖預設風格（英文） |

---

## 7. 產出與驗收要項

- [ ] **Skill** 撰寫完成，AI agent 可依其執行單篇發文與連載創作流程。
- [ ] **wp:get-tags**：可取得現有 Tag / Category，供歸類使用。
- [ ] **wp:create-category**：可建立新 Category（含 parent / description 支援）。
- [ ] **wp:publish-post**：可發布 / 更新文章，支援 slug、縮圖、分類、Tag。
- [ ] **ai:generate-thumbnail** + **ai:add-illustrations**：可產圖並插入文章 HTML。
- [ ] **series:init**：可建立連載資料夾、設定檔、WP Category。
- [ ] **series:publish**：可發布章節並更新設定檔。
- [ ] **series:add-illustrations**：可依 Art Bible 風格產圖並插入章節 HTML；可選用參考圖以維持角色一致性。
- [ ] 無帳號、金鑰寫死於程式碼；皆由 `.env` 讀取。

---

## 8. 後續可擴充

- 多站點：支援多組 `SITE`／帳號。
- 排程發布：整合 cron，連載章節定時自動發布。
- 更多子類型：podcast 逐字稿、漫畫腳本、學術論文系列等。
- 多語言：撰文與翻譯流程整合。

---

*文件版本：2.0 | 新增長篇連載內容模式（series-writer）、插圖工作流程與 Art Bible*
