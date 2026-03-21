# Skill: 單篇自動發文到 WordPress

## 1. Skill 簡介

- **目的**：讓 AI Agent 能從「使用者提供文章方向」開始，自動完成搜尋文獻、產文、決定分類/Tag、產出縮圖與發布到 WordPress。
- **適用情境**：需要定期在 `SITE` 站點上發布技術或部落格文章，並希望盡量自動化。

## 2. 前置條件

在使用本 Skill 前，請確保：

- 已安裝 Node.js 18+ 與 yarn。
- 跟隨 README 完成：
  - `yarn`
  - 複製 `.env.example` 為 `.env` 並填入：
    - `SITE`
    - `USER_NAME`
    - `GEMINI_API_KEY`
    - （選）`PEXELS_API_KEY` — 若插圖或縮圖要使用 Pexels 圖庫
- 可執行：
  - `yarn test:config`

## 3. 可用腳本與指令

- **讀取站點分類/Tag**
  - 指令：`yarn wp:get-tags`
  - 輸出：`{ tags: [...], categories: [...] }` 的 JSON（印在 stdout）

- **產生縮圖（Gemini 或 Pexels → Sharp）**
  - 建議檔名規則：**使用文章 slug 作為檔名**，並放在 `article-drafts/` 底下，例如：`article-drafts/claude-sonnet-4-6.jpg`。
  - 預設 Gemini：`yarn ai:generate-thumbnail --prompt "<縮圖描述>" --out ./article-drafts/<文章-slug>.jpg`
  - （可選）參考圖（僅 Gemini）：`yarn ai:generate-thumbnail --prompt "<縮圖描述>" --reference "./path/to/ref.jpg" --out ./article-drafts/<文章-slug>.jpg`（多張以逗號分隔）
  - Pexels：`yarn ai:generate-thumbnail --image-source pexels --pexels-query "<搜尋關鍵字>" --out ./article-drafts/<文章-slug>.jpg`（需 `PEXELS_API_KEY`）
  - 行為：依來源產圖後，透過 Sharp 壓成縮圖，存成檔案。

- **文章插圖（可選）**
  - 前置：`.env` 可設 `ILLUSTRATION_ENABLED_DEFAULT`、`ILLUSTRATION_MAX_PER_ARTICLE`、`ILLUSTRATION_DEFAULT_STYLE`、`ILLUSTRATION_STRICT_MODE`、`PEXELS_API_KEY`、`PEXELS_ATTRIBUTION_DEFAULT`；規則檔見 `docs/illustration-rules.md`（不插圖類型／標籤、本篇不插圖標記）。
  - 指令：`yarn ai:add-illustrations --article ./article-drafts/<slug>.html --plan <計畫 JSON 路徑或 ->`；需舊版「一錯即停」可加 `--strict`。
  - 計畫格式（JSON）：可含 `defaultSource`（`gemini`|`pexels`）；每張可設 `source`、`prompt`（Gemini）、`pexelsQuery`（Pexels）、`attribution`（單張覆寫署名）。`insertAfterBlockIndex` 為 0 表示在第一個頂層區塊之後插入。詳見 `CLAUDE.md` 與 `docs/implementation-plan-pexels.md`。
  - 行為：依計畫產圖（成功張數為 `<slug>-1.jpg`… 連號），並在對應位置插入 `<figure>` 寫回 HTML；單張失敗預設略過並繼續。文章開頭若有 `<!-- illustration: off -->` 則略過。

- **發布文章**
  - 指令（以下皆從**專案根目錄**執行）：
    - **新文章**（推薦用 `--content-file` 傳入 HTML，避免指令列過長）：
      - `yarn wp:publish-post --title "<標題>" --content-file ./article-drafts/<slug>.html --status publish --slug "<slug>" --thumbnail ./article-drafts/<slug>.jpg --categories "1,2" --tags "3,4,5,..."`
    - 若內容極短，可改為 `--content "<HTML 字串>"`，不帶 `--content-file`。
    - **更新既有文章**（依 slug 更新內文與／或縮圖）：
      - `yarn wp:publish-post --update-slug "<既有文章 slug>" --content-file ./article-drafts/<slug>.html --thumbnail ./article-drafts/<slug>.jpg`
  - 行為：上傳縮圖 → 建立／更新文章 → 套用分類與 Tag → 設定 featured image。**新文章必須帶入 `--slug`**，WordPress 文章網址依此 slug 產生，不依標題。

## 4. Agent 執行流程（對應 PRD 七步）

1. **取得文章方向（使用者輸入）**
   - 詢問使用者：「這次文章的主題/方向是什麼？」

2. **搜尋相關文獻（由 Agent 完成）**
   - 使用 Agent 自己的搜尋能力（或外部工具），針對該方向蒐集 3–5 篇參考資料。
   - 產出一段「文獻摘要/重點列表」，內含：
     - 主題關鍵點
     - 常見問題或痛點
     - 可以引用的事實或數據（如有）

3. **產出文章（由 Agent 完成）**
   - **訂定文章 slug**（必做）：每篇文章需在產出時訂定一個 **slug**，作為 WordPress 文章網址用；**不得用標題自動產生**。規則：
     - 格式：**英文、小寫、單字間以連字號 `-` 連接**，簡短可讀（例如 `ai-replace-programmers`、`openclaw-experience`）。
     - 與草稿檔名一致：文章存成 `article-drafts/<slug>.html`，縮圖為 `article-drafts/<slug>.jpg`，發布時 `--slug "<slug>"` 與檔名主檔名相同。
   - 一律使用「繁體中文」撰寫標題與內文。
   - 以 HTML 或 Markdown（推薦 HTML 方便直接發文）組織最終文章，至少包含：
     - `<h1>` 標題（繁體中文）
     - 多個段落、清單或小節（繁體中文）
   - 可以使用文獻摘要與自身知識產生內容。
   - **HTML 輸出格式嚴格規範**（非常重要）：
     - 只輸出「文章內容片段」，不得包含整份文件結構。
     - **禁止出現**：`<!DOCTYPE ...>`、`<html>`、`</html>`、`<head>`、`</head>`、`<body>`、`</body>`、`<title>`、`</title>`。
     - **禁止出現任何 `<script>` 標籤或 inline JS**。
     - 允許的標籤範圍以內容為主，例如：`<h1>`～`<h4>`、`<p>`、`<ul>` / `<ol>` / `<li>`、`<strong>`、`<em>`、`<code>`、`<pre>` 等語意化標籤。
     - 若需要加粗或斜體，請使用 `<strong>` / `<em>`，不要插入樣式或 `<style>`。
   - **生成的文章請存於 `article-drafts/` 目錄**（例如 `article-drafts/<slug>.html`），勿放在 `docs/`。
   - 若本篇**不要插圖**，請在 HTML 最開頭加註解：`<!-- illustration: off -->`。

3.5. **文章插圖（可選，依設定與規則）**
   - 若未關閉插圖（見 `docs/illustration-rules.md` 與 `.env`），且使用者未要求本篇不插圖：
     - **出圖來源**：若使用者**未**指定「全權交你決定」，且**未**說明要用 Gemini／Pexels／混合，Agent **必須先問**：「插圖要用 AI 生成（Gemini）、搜尋攝影圖（Pexels），還是混合？」若使用者已明確指定或委託全權決定，則依指示或自行逐張選擇並註明理由。
     - 向使用者**提議**插圖時，以**自然語言描述段落位置**（引用小節標題或段落開頭），**不要**用 `insertAfterBlockIndex` 當主溝通；使用者確認後，Agent 再換算為 JSON 的 `insertAfterBlockIndex`（頂層區塊順序：h1、h2、p、ul、ol、hr、pre）。
     - 依文章語意與段落，決定插圖位置與數量（不超過 `ILLUSTRATION_MAX_PER_ARTICLE`），以及每張的來源（`gemini` 或 `pexels`）。Gemini 張需 `prompt`（英文）；Pexels 張需 `pexelsQuery`（簡短關鍵字）。可設 `defaultSource` 或逐張 `source`。若專案有 Art Bible，Gemini 張應優先沿用 `illustration_style`，不要自行換畫風。
     - 產出**最終**插圖計畫 JSON（使用者確認後）：見 `CLAUDE.md` 範例（含 `defaultSource`、`source`、`pexelsQuery`、`attribution` 等）。
     - 呼叫：`yarn ai:add-illustrations --article ./article-drafts/<slug>.html --plan <計畫檔路徑>`（或 `--plan -`）。
     - 完成後文章內會多出 `<figure>` 與對應圖片檔；發布時需一併上傳這些圖片。使用者回饋調整來源或位置時，應輸出**更新後的完整提議**再執行（迭代細節見 `docs/implementation-plan-pexels.md` §13）。

4. **歸類分類與 Tag**
   - 呼叫：`yarn wp:get-tags` 取得目前站點的 `tags` 與 `categories`。
   - 依文章內容比對或推論：
     - **分類從寬**：同一文章可歸多類，只要與文章主題或內容沾到邊的分類都可以勾選，不必限縮在「最適合的少數幾個」。例如談工程師職涯、團隊、心法，可同時勾選「學習心得」、與技術或產業相關的上層分類等；沾到邊就勾，方便讀者從不同入口找到文章。可依站點習慣設定上限（例如不超過 5–6 類）避免過度濫用即可。
     - **至少挑選 5 個、最多約 8 個 Tag**，優先使用現有 Tag。
   - 若現有 Tag 不足以描述主題（例如新技術 / 新專案名稱），**可以視情況建立新的 Tag**。目前本專案尚無建立 Tag 的獨立腳本，需由 Agent 自行呼叫 WordPress REST API（`POST /wp-json/wp/v2/tags`）建立，命名需：
     - 使用清楚的繁體中文或常用英文詞彙。
     - 避免與現有 Tag 嚴重重複或只差一兩個字。
   - 將名稱/slug 對應回 `id`，之後以 `categories`/`tags` id 陣列傳給 `wp:publish-post`，確認實際帶入的 Tag 數量 **不少於 5 個**。

5. **產出縮圖的 prompt 或圖庫關鍵字**
   - 由 Agent 依文章主題與調性決定縮圖來源（與步驟 3.5 相同規則：未指定且未全權委託時應先問 Gemini／Pexels）。
   - Gemini：撰寫英文簡短描述，例如 `"minimalistic illustration of a monk coding at night, blue and purple tones"`。
   - Pexels：撰寫簡短英文搜尋關鍵字。

6. **生成與優化縮圖**
   - 以文章 slug 命名縮圖檔案，並與文章放在同一個資料夾（`article-drafts/`），例如：
     - 文章：`article-drafts/claude-sonnet-4-6.html`
     - 縮圖：`article-drafts/claude-sonnet-4-6.jpg`
   - 呼叫：
     - Gemini：`yarn ai:generate-thumbnail --prompt "<步驟 5 的描述>" --out ./article-drafts/<文章-slug>.jpg`
     - Pexels：`yarn ai:generate-thumbnail --image-source pexels --pexels-query "<關鍵字>" --out ./article-drafts/<文章-slug>.jpg`
   - 產出的縮圖檔案作為 WordPress 文章的縮圖使用。

7. **發布到 WordPress**
   - 從**專案根目錄**執行。推薦使用 `--content-file ./article-drafts/<slug>.html` 傳入內容，縮圖為 `--thumbnail ./article-drafts/<slug>.jpg`。
   - **新文章**：呼叫時**必須帶入步驟 3 訂定的 `--slug`**（與草稿檔名主檔名一致），例如：
     - `yarn wp:publish-post --title "<文章標題>" --content-file ./article-drafts/<slug>.html --status publish --slug "<slug>" --thumbnail ./article-drafts/<slug>.jpg --categories "<categoryIds>" --tags "<tagIds>"`
   - **更新既有文章**：若為更新已存在之文章（例如只改內文或縮圖），使用 `--update-slug "<既有 slug>"`，並搭配 `--content-file`、`--thumbnail` 即可，無需 `--title`／`--slug`／`--categories`／`--tags`。
   - 成功後，記錄回傳的文章 URL 或 ID，回報給使用者。

## 5. 角色分工總結

- **由 Agent 直接負責的部分**
  - 搜尋文獻與整理摘要（步驟 2）。
  - 撰寫文章內容（步驟 3）。
  - 文章插圖計畫（步驟 3.5：位置、每張來源、Gemini prompt 或 Pexels 關鍵字、altText）。
  - 決定分類與 Tag（邏輯 + 映射至 id，步驟 4）。
  - 產生縮圖用的英文 prompt（步驟 5）。

- **由專案腳本/模組處理的部分**
  - `yarn wp:get-tags`：讀取現有 Tag / Category。
  - `yarn ai:add-illustrations`：依計畫產圖並插入 `<figure>`。
  - `yarn ai:generate-thumbnail`：依來源產圖 + Sharp 縮圖。
  - `yarn wp:publish-post`：上傳媒體與建立文章。

## 6. E2E 驗證建議流程

1. 準備好 `.env` 並確認有權限發布文章到目標 WordPress。
2. 由 Agent 問使用者主題，依「Agent 執行流程」逐步執行。
3. 在每一步將：
   - 中間產物（文獻摘要、草稿文章、分類/Tag 決策、縮圖 prompt）以文字形式保留在對話中。
4. 最終確認：
   - WordPress 後台可看到新文章。
   - 文章有正確分類與 Tag。
   - 縮圖已上傳且設定為 featured image。
   - 發布時使用 `--content-file ./article-drafts/<slug>.html` 與 `--thumbnail ./article-drafts/<slug>.jpg`（從專案根目錄執行）。
