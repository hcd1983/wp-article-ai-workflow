# 實作計劃  
## IT Monk 自動發文機制

本文件對應 [PRD](prd.md)，將需求拆解為可執行的階段與任務，供開發與 AI agent 實作時依序進行。

---

## 1. 實作目標與產出

| 產出 | 說明 |
|------|------|
| **Skill 文件** | 供 AI agent 執行的流程說明與腳本呼叫指引（如 `SKILL.md`） |
| **讀取 Tag 腳本** | 從 WordPress 取得現有 Tag、Category，供歸類使用 |
| **發布文章腳本** | 上傳縮圖、建立文章、設定分類與 Tag、發布 |
| **縮圖處理** | 產圖 prompt → 產圖（Gemini）→ Sharp 優化尺寸 |
| **搜尋與產文** | 搜尋文獻、產出文章、歸類與縮圖 prompt（可由 Agent 或腳本實作） |

---

## 2. 技術棧與依賴

| 類別 | 選型建議 | 備註 |
|------|----------|------|
| 執行環境 | Node.js 18+ | 建議 LTS |
| 套件管理 | **yarn** | 需有 `package.json` |
| 縮圖處理 | **sharp** | 步驟 6 必備 |
| 產圖 | **Gemini API**（@google/generative-ai 或 REST） | 步驟 5 產圖 |
| WordPress | **axios** / **node-fetch** + WordPress REST API | 發文、上傳媒體、讀取 tag |
| 環境變數 | **dotenv** | 讀取 `.env` |
| 搜尋文獻 | 待定（如 Google Custom Search、Serper、或 Agent 內建搜尋） | 步驟 2 |

---

## 3. 建議目錄結構

```
it-monk-auto-post/
├── .env                    # 不提交，依 .env.example 建立
├── .env.example
├── package.json
├── article-drafts/         # 生成的文章草稿（HTML）
├── docs/
│   ├── prd.md
│   └── implementation-plan.md
├── SKILL.md                 # 本專案 Skill，供 AI agent 執行
├── scripts/                 # 可被 Agent 或 CLI 呼叫的腳本
│   ├── wp-get-tags.js       # 讀取 WordPress Tag / Category
│   ├── wp-publish-post.js   # 發布文章（含上傳縮圖、設分類與 Tag）
│   └── thumbnail-optimize.js # Sharp 優化縮圖（可選獨立腳本）
├── lib/                     # 共用的邏輯與 API 封裝
│   ├── wp-client.js         # WordPress REST API 封裝
│   ├── gemini-image.js      # Gemini 產圖
│   └── config.js            # 讀取 .env 與常數
└── README.md
```

- 若步驟 2、3、5 以腳本實作，可再增加 `scripts/search-literature.js`、`scripts/generate-article.js`、`scripts/generate-thumbnail-prompt.js` 等。

---

## 4. 實作階段與任務

### Phase 1：專案與環境初始化

| 序 | 任務 | 產出 | 依賴 |
|----|------|------|------|
| 1.1 | 初始化 Node 專案（`package.json`）、安裝 dotenv | `package.json`、可讀取 `.env` | — |
| 1.2 | 建立 `.env.example`（SITE, USER_NAME, GEMINI_API_KEY）與說明 | `.env.example`、README 或註解 | — |
| 1.3 | 實作 `lib/config.js`：從 `.env` 讀取變數並對外提供，不寫死密鑰 | `lib/config.js` | 1.1 |

**Phase 1 完成標準**：執行時可安全讀取 `.env`，且無密鑰寫死於程式碼。

---

### Phase 2：WordPress 讀取 Tag 腳本

| 序 | 任務 | 產出 | 依賴 |
|----|------|------|------|
| 2.1 | 實作 `lib/wp-client.js`：WordPress REST API 基礎封裝（base URL、認證） | `lib/wp-client.js` | 1.3 |
| 2.2 | 實作取得 Tags 與 Categories 的 API 呼叫（GET /wp/v2/tags、/wp/v2/categories） | 同上或擴充 | 2.1 |
| 2.3 | 實作 `scripts/wp-get-tags.js`：可執行並輸出現有 Tag、Category 列表（如 JSON 或 stdout） | `scripts/wp-get-tags.js` | 2.2 |

**Phase 2 完成標準**：執行 `wp-get-tags.js` 可取得站點現有 Tag 與 Category，供步驟 4 歸類使用。

---

### Phase 3：縮圖產出與 Sharp 優化

| 序 | 任務 | 產出 | 依賴 |
|----|------|------|------|
| 3.1 | 安裝 sharp，實作 `lib/thumbnail-optimize.js` 或 `scripts/thumbnail-optimize.js`：輸入圖片路徑或 buffer，輸出指定尺寸／格式（如 1200×630 或站點所需） | Sharp 處理模組／腳本 | 1.1 |
| 3.2 | 實作 Gemini 產圖：`lib/gemini-image.js`，依 prompt 呼叫 Gemini API 產圖，回傳圖片 buffer 或暫存路徑 | `lib/gemini-image.js` | 1.3 |
| 3.3 | 串接「產圖 → Sharp 優化」：產圖後直接傳入 Sharp 流程，輸出最終縮圖（可為檔案或 buffer） | 流程可被發布腳本或 Agent 呼叫 | 3.1, 3.2 |

**Phase 3 完成標準**：給定縮圖 prompt，可產出經 Sharp 優化後的縮圖，供步驟 7 上傳。

---

### Phase 4：WordPress 發布文章腳本

| 序 | 任務 | 產出 | 依賴 |
|----|------|------|------|
| 4.1 | 在 `lib/wp-client.js` 實作：上傳媒體（POST /wp/v2/media）、建立文章（POST /wp/v2/posts）、支援 featured_media、categories、tags | `lib/wp-client.js` 擴充 | 2.1 |
| 4.2 | 實作 `scripts/wp-publish-post.js`：接受參數（標題、內容、縮圖路徑或 buffer、分類 ID、Tag ID、狀態 draft/publish），依序上傳縮圖 → 建立文章並關聯縮圖與分類／Tag | `scripts/wp-publish-post.js` | 4.1, 3.3 |
| 4.3 | 錯誤處理與日誌：上傳或發文失敗時回傳明確錯誤，便於 Agent 或除錯 | 同上 | — |

**Phase 4 完成標準**：執行 `wp-publish-post.js` 可將含縮圖、分類、Tag 的文章發布至 WordPress。

---

### Phase 5：搜尋文獻與產文（可選由 Agent 代勞）

| 序 | 任務 | 產出 | 依賴 |
|----|------|------|------|
| 5.1 | 選型：搜尋文獻方式（Google Custom Search / Serper / 其他 API 或 Agent 內建搜尋） | 決定方案並在 README 或 Skill 註明 | — |
| 5.2 | 若以腳本實作：`scripts/search-literature.js`，輸入「文章方向」，輸出文獻摘要或要點（如 JSON） | `scripts/search-literature.js` | 5.1, 1.3 |
| 5.3 | 產文與歸類、縮圖 prompt：可由 Agent 依 Skill 以內建能力完成，或實作腳本（如呼叫 Gemini 產文、產 prompt） | Skill 內註明由 Agent 或哪個腳本負責 | PRD 步驟 3、4、5 |

**Phase 5 完成標準**：步驟 2～5 有明確執行方式（Agent 或腳本），並在 Skill 中寫清。

---

### Phase 6：Skill 撰寫與整合

| 序 | 任務 | 產出 | 依賴 |
|----|------|------|------|
| 6.1 | 撰寫 `SKILL.md`：說明本專案目的、何時使用此 Skill、前置條件（.env、Node、依賴安裝） | `SKILL.md` 初版 | — |
| 6.2 | 在 Skill 中寫明 7 步流程，每步對應「由 Agent 做」或「呼叫哪個腳本／指令」、輸入輸出格式 | `SKILL.md` 流程與腳本對照 | Phase 2～5 |
| 6.3 | 在 Skill 中註明：讀取 Tag 腳本、發布文章腳本、Sharp 優化與 Gemini 產圖的呼叫方式與參數 | `SKILL.md` 完整可執行 | 2.3, 4.2, 3.3 |
| 6.4 | 端對端驗證：依 Skill 由 Agent 或手動依序執行 7 步，成功發布一篇測試文 | 驗收通過 | 6.3 |

**Phase 6 完成標準**：AI agent 僅依 Skill 即可完成「文章方向 → 發布」全流程，且文章含縮圖、分類、Tag。

---

## 5. 依賴關係簡圖

```
Phase 1（環境）
    ↓
Phase 2（讀取 Tag） ←→ Phase 3（縮圖 + Sharp）
    ↓                       ↓
Phase 4（發布文章） ←───────┘
    ↑
Phase 5（搜尋與產文，可並行）
    ↓
Phase 6（Skill 撰寫與 E2E 驗證）
```

---

## 6. 檢查清單（實作完成時勾選）

- [ ] Phase 1：`.env.example`、`config.js` 就緒，無密鑰寫死
- [ ] Phase 2：`wp-get-tags.js` 可取得 Tag、Category
- [ ] Phase 3：Gemini 產圖 + Sharp 優化流程可產出最終縮圖
- [ ] Phase 4：`wp-publish-post.js` 可上傳縮圖並發布文章（含分類、Tag）
- [ ] Phase 5：步驟 2～5 的執行方式已定並在 Skill 註明
- [ ] Phase 6：`SKILL.md` 完整，且 E2E 測試發布成功

---

*對應規格：docs/prd.md | 文件版本：1.0*
