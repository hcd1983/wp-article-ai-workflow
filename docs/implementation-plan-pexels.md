# 實作計劃：Pexels 圖片支援（Gemini / Pexels / 混合）

> 狀態：**已實作**（見 `CHANGELOG.md`）
> 最後更新：2026-03-21

---

## 1. 目標與範圍

在既有「Gemini 產圖 → Sharp 壓縮」流程外，新增 **Pexels 搜尋並下載** 作為圖片來源；同一篇文章可 **逐張** 選擇 Gemini 或 Pexels（混合＝兩種來源並存）。

架構採用 **Registry / Strategy Pattern**，每種圖片來源實作統一介面，方便未來擴充新來源（如 Unsplash）而不需修改核心流程。

**納入範圍（全都要）：**

| 指令 / 腳本 | 說明 |
|-------------|------|
| `yarn ai:generate-thumbnail` | `scripts/generate-thumbnail.js` → `lib/generate-thumbnail.js` |
| `yarn ai:add-illustrations` | `scripts/add-illustrations.js` |
| `yarn series:add-illustrations` | `scripts/series-add-illustrations.js` |

**不在此文件強制規定、實作時可一併評估：** WordPress 發布腳本（`wp:publish-post` / `series:publish`）僅處理本機檔案上傳，預期 **不需改動**；若 Pexels 下載路徑與現有 jpg 一致即可。

---

## 2. 已定案產品規則

| 項目 | 決策 |
|------|------|
| 混合模式 | 依插圖計畫 **逐張** 指定 `gemini` 或 `pexels`，同一篇可混用。 |
| Pexels 搜尋詞 | 計畫 JSON **另加** `pexelsQuery`，不沿用 Gemini 的長 `prompt`。 |
| 攝影師／來源標示 | 做成 **環境或設定項**，**預設開啟**；Pexels 現行 ToS 不強制標示，但建議開啟以示尊重。可透過環境變數或單張 `attribution: false` 關閉。 |
| 缺少 `PEXELS_API_KEY` | **stderr 印出錯誤**，該張 **不產圖**，**略過** 後繼續下一張或結束；**不中斷** 整篇流程。 |
| Pexels 選圖 | v1 即帶 **`orientation: landscape`** + **最小寬度 1200px** 篩選，確保文章插圖品質。 |
| 嚴格模式 | 新增 `--strict` flag / `ILLUSTRATION_STRICT_MODE` 環境變數；開啟時任一張失敗即中斷（保留舊行為）。 |

---

## 3. 環境變數與設定

**新增（`.env` / `.env.example`）：**

| 變數 | 必填 | 說明 |
|------|------|------|
| `PEXELS_API_KEY` | 使用 Pexels 來源時 | [Pexels API](https://www.pexels.com/api/) 金鑰；未設定時若某張指定 `pexels` 則該張略過並報錯。 |
| `PEXELS_ATTRIBUTION_DEFAULT` | 選填 | 預設 `true`：是否在 `<figure>` 中附加攝影師／Pexels 來源說明（見 §5）。 |
| `ILLUSTRATION_STRICT_MODE` | 選填 | 預設 `false`；設為 `true` 時任一張產圖失敗即中斷整篇流程（等同舊版 Gemini 行為）。 |

**`lib/config.js`：**

- 匯出 `PEXELS_API_KEY`、`PEXELS_ATTRIBUTION_DEFAULT`、`ILLUSTRATION_STRICT_MODE`。
- Pexels **不作為** `validateWpConfig` 的必填項（與 Gemini 類似，依實際使用的來源再檢查）。

---

## 4. 插圖計畫 JSON（schema 擴充）

在現有欄位（`style`、`illustrations[]` 的 `insertAfterBlockIndex`、`prompt`、`altText` 等）基礎上擴充：

**計畫層級（可選）：**

- `defaultSource`：`"gemini"` | `"pexels"`（可選；未設則預設 `gemini` 以維持舊檔相容）。

**每一筆 `illustrations[]`：**

| 欄位 | 類型 | 說明 |
|------|------|------|
| `source` | 選填字串 | `"gemini"` \| `"pexels"`；未設則用計畫的 `defaultSource`，再退回 `gemini`。 |
| `prompt` | 字串 | **Gemini** 用；`source === "pexels"` 時可省略或僅作備註（實作時明確文件化）。 |
| `pexelsQuery` | 字串 | **Pexels** 用；`source === "pexels"` 時必填（驗證失敗可該張略過並 log）。 |
| `attribution` | 選填布林 | 覆寫該張的署名行為；未設則依 `PEXELS_ATTRIBUTION_DEFAULT`。 |

**向後相容：** 既有計畫檔無 `source` → 行為與現在一律走 Gemini。

---

## 5. HTML 與署名（figcaption）

目前 `lib/html-utils.js` 的 `insertFigures` 會產生：

```html
<figure><img src="..." alt="..."/><figcaption>...</figcaption></figure>
```

**擴充方向：**

- 當署名啟用（`PEXELS_ATTRIBUTION_DEFAULT === true` 且未被單張 `attribution: false` 覆寫）且該張來源為 Pexels 時，在 `figcaption`（或額外一行）附加簡短說明，例如攝影師名稱 + 連結至 Pexels 照片頁（API 回傳的 `photographer`、`photographer_url`、`url` 等欄位依官方文件對應）。
- Gemini 產生的圖 **不** 附加 Pexels 字樣。
- Pexels 現行 ToS 不強制標示，因此署名為建議性質，使用者可透過設定或單張覆寫關閉。

---

## 6. 架構：Registry / Strategy Pattern

### 6.1 統一介面

```typescript
// lib/image-source-registry.js

/**
 * @typedef {Object} ImageSourceResult
 * @property {Buffer} buffer - 圖片 Buffer（待 optimizeThumbnail 處理）
 * @property {Object} [meta] - 來源 metadata（如 Pexels 署名資訊）
 * @property {string} [meta.photographer]
 * @property {string} [meta.photographerUrl]
 * @property {string} [meta.sourceUrl]
 * @property {string} [meta.photoId] - 用於去重
 */

/**
 * @typedef {Object} ImageSourceStrategy
 * @property {string} name - 來源名稱（如 'gemini', 'pexels'）
 * @property {function} generate - async (options) => ImageSourceResult
 * @property {function} validate - (options) => { valid: boolean, reason?: string }
 */
```

### 6.2 新模組

| 模組 | 職責 |
|------|------|
| `lib/image-source-registry.js` | 管理所有 image source strategy 的註冊與查找；提供 `getStrategy(sourceName)` 與 `generateImage(options)` 統一入口。 |
| `lib/strategies/gemini-strategy.js` | 封裝現有 Gemini 產圖邏輯為 strategy 介面。 |
| `lib/strategies/pexels-strategy.js` | 封裝 Pexels 搜尋 + 下載為 strategy 介面。 |
| `lib/pexels-client.js` | 呼叫 Pexels **Photos Search** API；帶入 `orientation: landscape` + `per_page: 10`；篩選寬度 ≥ 1200px 後取第一張；回傳圖片 URL + 署名 metadata + photo id。同一次執行中記錄已使用的 photo id，避免重複選圖。 |
| `lib/fetch-image-buffer.js` | 自 URL 下載為 `Buffer`（供後續 `optimizeThumbnail` 統一走 Sharp）。支援 timeout 與基本 retry（1 次重試）。 |

### 6.3 流程（統一）

1. 依 `source` 從 registry 取得對應 strategy。
2. 呼叫 `strategy.validate(options)` 檢查必要參數（如 Pexels 需 key + query）。
3. 呼叫 `strategy.generate(options)` 取得 `{ buffer, meta }`。
4. 統一走 `optimizeThumbnail` 輸出 jpg。
5. 將 `meta`（署名資訊）沿傳至 `insertFigures`。

### 6.4 Pexels 選圖規則（v1）

- **`orientation: landscape`**：文章插圖以橫向為主。
- **最小寬度 1200px**：從 API 回傳結果中篩選 `width >= 1200` 的照片。
- **取第一筆**符合條件的結果。
- **URL 去重**：同一次執行（同一篇文章）中，若 photo id 已被使用過，自動跳到下一筆結果，避免同篇文章出現重複照片。

### 6.5 Rate Limit 意識

Pexels 免費方案限制 **200 req/hr**。`pexels-client.js` 應讀取回應 header `X-Ratelimit-Remaining`，當剩餘額度 < 10 時 log warning，額度為 0 時 log error 並令該張略過。

---

## 7. 各腳本調整要點

### 7.1 `yarn ai:generate-thumbnail`

**現況：** `scripts/generate-thumbnail.js` 僅 `--prompt`、`--out`、`--reference`。

**計劃：**

- 新增 **`--image-source gemini|pexels`**（預設 `gemini`）。
- 當 `--image-source pexels` 時必填 **`--pexels-query "<關鍵字>"`**。
- `source=pexels` 且無 key：印錯誤，`exitCode = 1`，**不寫出檔案**（單張 CLI 無「下一張」，與插圖略過語意一致為「該次失敗」）。

### 7.2 `yarn ai:add-illustrations`

**現況：** `scripts/add-illustrations.js` 迴圈內呼叫 `generateThumbnail`；失敗時 **整支腳本 exit**。

**計劃：**

- 透過 registry 依每筆 `source` 取得對應 strategy 產圖。
- 任一來源失敗時（含無 key、API 錯、下載失敗）：
  - **非 strict 模式（預設）**：**log error**，**不寫入該張檔案**，且 **不將該筆加入** `insertFigures` 的列表（避免 broken img），繼續處理下一張。
  - **strict 模式**（`--strict` 或 `ILLUSTRATION_STRICT_MODE=true`）：立即中斷並 exit。

**Block index 處理（重要）：**

`insertFigures` 採用 **倒序插入**（從最大 index 往前插），因此跳過某張不會影響其他張的 `insertAfterBlockIndex` 對應。實作要點：

1. 迴圈產圖後，僅將「成功產圖」的項目收集為 `successItems`（保留原始 `insertAfterBlockIndex`）。
2. 將 `successItems` 傳入 `insertFigures`，由 `insertFigures` 內部按 `insertAfterBlockIndex` **降序排列** 後逐一插入。
3. 因為倒序插入，每次插入的位置不受前面已插入 figure 的影響，即使中間有跳過的張數，其餘張的 block index 仍然正確。

### 7.3 `yarn series:add-illustrations`

**現況：** `scripts/series-add-illustrations.js` 與 `add-illustrations` 類似，但使用 `getChapterIllustrationPath`、系列 `style` / `referenceImagePaths`。

**計劃：**

- 與 §7.2 相同 registry 分派與略過 / strict 邏輯。
- **Pexels 來源：** 通常 **不使用** 系列角色參考圖（`referenceImagePaths`）；實作上規定 `source === "pexels"` 時不傳 reference，避免語意混淆（文件註明）。

---

## 8. `lib/generate-thumbnail.js` 重構方向

- 改為透過 `image-source-registry` 取得 strategy，不再直接呼叫 Gemini。
- 對外 API 維持 `generateThumbnail(options)` 不變，內部分派至 registry。
- 系列與單篇腳本共用此入口，避免重複。
- 新增來源時只需：新增 `lib/strategies/<name>-strategy.js` + 在 registry 中註冊，無需修改腳本。

---

## 9. 錯誤處理矩陣（摘要）

| 情境 | 非 strict 模式（預設） | strict 模式 |
|------|------------------------|-------------|
| `source=pexels` 且無 `PEXELS_API_KEY` | 插圖腳本：**略過該張**，繼續；縮圖 CLI：**失敗結束** | **中斷** |
| `source=pexels` 但缺 `pexelsQuery` | **略過** 並 log | **中斷** |
| Pexels API 無結果 | 略過該張並 log | **中斷** |
| Pexels API rate limit 耗盡 | 略過該張並 log error | **中斷** |
| Pexels 圖片下載失敗 | 略過該張並 log（retry 1 次後仍失敗） | **中斷** |
| Gemini 失敗 | **略過該張**，繼續（**行為變更**：舊版為中斷） | **中斷**（等同舊版行為） |

> **注意：** Gemini 從「中斷」改為「略過」是 **breaking change**。需要保留舊行為的使用者可設定 `ILLUSTRATION_STRICT_MODE=true` 或 CLI 帶 `--strict`。此變更需寫入 CHANGELOG。

---

## 10. 文件與測試

**文件：**

- 更新 `CLAUDE.md`、`README.md`（或 `SKILL.md`）中的環境變數表與插圖計畫 JSON 範例。
- 本檔完成審閱後可改標題狀態為「已核准」或移入 `docs/` 長期維護。

**測試：**

| 類型 | 項目 |
|------|------|
| 單元 | `pexels-client`：mock HTTP，驗證 orientation / 寬度篩選 / photo id 去重 / rate limit warning |
| 單元 | `image-source-registry`：strategy 註冊、查找、fallback 邏輯 |
| 單元 | `insertFigures`：帶入 Pexels 署名時 HTML 片段正確跳脫；倒序插入行為驗證 |
| 單元 | `fetch-image-buffer`：mock HTTP，驗證 timeout / retry |
| 整合 | mock Pexels API，跑完整 `add-illustrations` 流程（含混合來源），驗證輸出 HTML 的 figure 數量與署名 |
| 整合 | 全部 pexels 都失敗時，輸出 HTML 應與原始 HTML 相同（零 figure 插入） |
| 整合 | strict 模式下，第一張失敗即中斷，不產出後續圖片 |
| 手動 | `--image-source pexels` 縮圖一張；插圖計畫內 gemini + pexels 各一張；無 key 時確認略過一張、其餘仍插入 |

---

## 11. 實作順序建議

1. **環境與基礎**：`lib/config.js` + `.env.example`（新增 Pexels 相關變數）。
2. **資料結構**：`insertFigures` 擴充署名資料結構（`meta` 欄位），定義 `ImageSourceResult` 型別。
3. **Registry 骨架**：`lib/image-source-registry.js` + 統一介面定義。
4. **Gemini strategy**：將現有 Gemini 邏輯封裝為 `lib/strategies/gemini-strategy.js`，確保不破壞現有功能。
5. **Pexels 模組**：`lib/pexels-client.js`（含選圖 / 去重 / rate limit）+ `lib/fetch-image-buffer.js` + `lib/strategies/pexels-strategy.js`。
6. **重構 `lib/generate-thumbnail.js`**：改為透過 registry 分派。
7. **腳本調整**：`scripts/add-illustrations.js` → `series-add-illustrations.js` → `scripts/generate-thumbnail.js`（加入 `--image-source`、`--strict`）。
8. **Skill 文件更新**：`skills/auto-post.md`、`skills/series-writer.md`、`SKILL.md`（見 §13.3）。
9. **測試與文件**。

---

## 12. 已確認事項

- [x] 插圖腳本：**Gemini 失敗** 改為「略過該張、繼續」（與 Pexels 一致），透過 `--strict` / `ILLUSTRATION_STRICT_MODE` 保留舊版中斷行為。
- [x] Pexels 搜尋「選圖」規則：v1 即帶 **`orientation: landscape`** + **最小寬度 1200px** 篩選。
- [x] 架構採用 **Registry / Strategy Pattern**，方便未來擴充新來源。
- [x] CLI 參數使用 **`--image-source`** 取代 `--source`，避免語意模糊。
- [x] `lib/fetch-image-buffer.js` 為 **必要模組**（非可選），統一下載邏輯。
- [x] Agent 在使用者未指定出圖來源時 **必須主動詢問**（Gemini / Pexels / 混合）。
- [x] Agent 提議插圖位置時使用 **自然語言描述段落**（非 block index），確認後再由 Agent 轉換為 JSON。

---

## 13. Skill / Agent 行為變更

### 13.1 出圖來源判定

在 `auto-post` 步驟 3.5（文章插圖）與 `series-writer` 步驟 9（章節插圖）中，Agent 需依使用者的指示判定出圖來源。以下列出常見情境與對應行為：

**情境 A：使用者未提及出圖來源**

Agent **必須** 先詢問：

> 「這次的插圖要用 AI 生成（Gemini）還是搜尋攝影照片（Pexels），或是混合使用？」

**情境 B：使用者委託 Agent 全權決定**

例如：「圖片你自己幫我規劃一下」

- Agent **不需詢問**，自行依文章調性與內容判斷每張的最佳來源。
- 提議時仍須逐張標注選擇的來源與理由，讓使用者可以覆核。

**情境 C：使用者明確指定單一來源**

例如：「這裡都配素材圖庫，不要算圖」、「全部用 Gemini」

- Agent 直接設定整篇 `defaultSource`，不再逐張詢問來源。

**情境 D：使用者指定混合**

例如：「混合使用」

- Agent 在提議時逐張標注建議來源與理由。

**同樣適用於縮圖**：步驟 5–6（產出縮圖 prompt）若使用者未指定來源且未委託 Agent 全權決定，也需詢問。

### 13.2 插圖配置建議格式（自然語言描述）

Agent 向使用者提議插圖計畫時，**不使用** `insertAfterBlockIndex` 等技術數字，而是以 **自然語言描述段落位置**，讓使用者容易理解與決策。

**Agent 提議格式範例：**

> **插圖配置建議（共 3 張）：**
>
> 1. **接在「為什麼 AI 無法完全取代工程師」段落之後**
>    - 來源：Gemini
>    - Prompt：`"split screen showing AI code generation on left and human architect drawing system design on whiteboard on right, clean minimal style"`
>    - 圖說：AI 與工程師的互補關係
>
> 2. **接在「開發團隊的實際導入經驗」段落之後**
>    - 來源：Pexels
>    - 關鍵字：`"software development team collaboration"`
>    - 圖說：團隊協作開發的實景
>
> 3. **接在「未來展望與建議」段落之後**
>    - 來源：Gemini
>    - Prompt：`"futuristic workspace with holographic code displays, a developer meditating, soft blue and purple palette"`
>    - 圖說：人機協作的未來想像

**位置描述規則：**

- 引用 **該段落的標題文字或前幾個字**（如 `接在「開發團隊的實際導入經驗」段落之後`），讓使用者一看就知道是哪裡。
- 若段落沒有明確標題，可引用段落開頭內容（如 `接在「根據 2024 年 Stack Overflow 調查…」這段之後`）。
- 每張圖依來源不同，提供對應的 `prompt`（Gemini 用）或 `pexelsQuery`（Pexels 用）。
- 使用者只需要關心「插在哪、畫什麼、用什麼來源」，不需要理解 block index。

### 13.3 使用者回饋與迭代

使用者看到 Agent 提議後，可能以自然語言回饋調整。Agent 必須能正確解讀並執行。常見情境：

**情境 E：部分調整來源**

例如：「1, 2 幫我用算圖，其他圖庫」

- Agent 將第 1、2 張改為 `gemini`，其餘改為 `pexels`。
- 來源切換時，Agent 需 **同步調整該張的欄位**：
  - 改為 `gemini` → 補上 `prompt`（若原本只有 `pexelsQuery`，需依圖說語意產出英文 prompt）。
  - 改為 `pexels` → 補上 `pexelsQuery`（若原本只有 `prompt`，需精簡為搜尋關鍵字）。
- 調整後重新輸出完整提議，讓使用者確認。

**情境 F：要求多版本比較**

例如：「1, 2, 3 算圖，圖庫都給我一版」

- Agent 針對指定的張數，**同時提供 Gemini 版與 Pexels 版**的建議，格式如下：

> 1. **接在「為什麼 AI 無法完全取代工程師」段落之後**
>    - **方案 A（Gemini）**：Prompt：`"split screen showing AI code generation..."` / 圖說：AI 與工程師的互補關係
>    - **方案 B（Pexels）**：關鍵字：`"AI programmer collaboration"` / 圖說：AI 與工程師的互補關係

- 使用者逐張選定方案後，Agent 彙整為最終計畫。

**情境 G：調整位置或內容**

例如：「第 2 張移到結論前面」、「第 3 張的 prompt 改成…」

- Agent 依指示調整後重新輸出完整提議。

**通用規則：**

- 每次調整後，Agent 都輸出 **更新後的完整提議**（非 diff），方便使用者整體確認。
- 使用者最終確認後，Agent **自行** 將自然語言位置對應到 HTML 頂層區塊的 `insertAfterBlockIndex`，產出最終的插圖計畫 JSON 並執行。
- 迭代過程中 Agent 不應主動執行產圖，需等使用者明確確認（如「OK」、「就這樣」、「確認」）。

### 13.4 Skill 文件更新清單

以下 skill 文件需配合修改：

| 文件 | 修改要點 |
|------|----------|
| `skills/auto-post.md` §3.5 | 加入出圖來源判定（情境 A–D）；插圖計畫提議改為自然語言格式；補充使用者回饋迭代流程（情境 E–G）；補充 `source` / `pexelsQuery` 欄位說明 |
| `skills/auto-post.md` §5–6 | 縮圖也需判定出圖來源；補充 `--image-source` 參數 |
| `skills/series-writer.md` §9 | 同 auto-post §3.5 的來源判定、自然語言提議、迭代流程 |
| `skills/series-writer.md` §10 | 封面產圖補充 `--image-source` 參數 |
| `SKILL.md` | 環境前置補充 `PEXELS_API_KEY`（選填） |

---

審閱後若無異議，可在 Issue 或 PR 描述中連結本檔並開始開發。
