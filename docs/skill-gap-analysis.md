# SKILL.md 缺口分析

對照 `SKILL.md`、`scripts/wp-publish-post.js`、`lib/wp-client.js` 與 `docs/article-illustration-plan.md`，以下為目前**未處理好或未記載**的項目。

---

## 1. 發布腳本已支援、但 SKILL 未寫的行為

### 1.1 `--content-file`（用檔案傳入內容）

- **現況**：`wp-publish-post.js` 支援 `--content-file <路徑>`，從檔案讀取 HTML，避免把整篇 HTML 塞進指令列。
- **SKILL 現狀**：只寫「可從 `article-drafts/<slug>.html` 讀取後傳入 `--content`」，未提到可用 `--content-file`。
- **建議**：在 §3 發布文章、§4 步驟 7 中明確寫出：
  - 推薦使用：`--content-file ./article-drafts/<slug>.html`
  - 若用 `--content` 則為內嵌 HTML 字串（適合極短內容）。

### 1.2 `--update-slug`（依 slug 更新既有文章）

- **現況**：腳本支援 `--update-slug <slug>`，可依既有文章 slug 更新內容與縮圖（呼叫 `updatePost`），不建立新文章。
- **SKILL 現狀**：完全未提及「更新文章」情境。
- **建議**：在 §3 與步驟 7 補充：
  - 若為**更新既有文章**：使用 `--update-slug <slug>`，並可搭配 `--content-file`、`--thumbnail` 更新內文與縮圖。
  - 若為**新文章**：使用現有 `--title`、`--slug`、`--content`/`--content-file` 等。

---

## 2. 發布指令範例與路徑

### 2.1 縮圖路徑

- **SKILL 現狀**：步驟 7 範例為 `--thumbnail ../article-drafts/<slug>.jpg`。
- **問題**：若從專案根目錄執行 `yarn wp:publish-post`，應使用 `./article-drafts/<slug>.jpg`，否則路徑可能找不到檔案。
- **建議**：統一改為 `--thumbnail ./article-drafts/<slug>.jpg`，並註明「從專案根目錄執行」。

### 2.2 步驟 7 的完整推薦寫法

- 建議範例改為以 `--content-file` 為主，例如：
  - `yarn wp:publish-post --title "<標題>" --content-file ./article-drafts/<slug>.html --status publish --slug "<slug>" --thumbnail ./article-drafts/<slug>.jpg --categories "<ids>" --tags "<ids>"`

---

## 3. 建立新 Tag 的執行方式

- **SKILL 現狀**：步驟 4 寫「可視情況建立新的 Tag（透過 WordPress REST API `POST /wp/v2/tags`）」。
- **問題**：未說明本專案是否有現成腳本可呼叫；若沒有，Agent 需自行發 HTTP 或依賴其他工具，容易不一致。
- **建議**：
  - 若**已有**建立 Tag 的腳本：在 §3 列出指令與參數，並在步驟 4 註明「呼叫 xxx 建立新 Tag」。
  - 若**尚未有**：在 SKILL 註明「目前需由 Agent 自行呼叫 WordPress REST API 建立 Tag」，或列為後續實作項目。

---

## 4. 文章插圖功能未納入 Skill

- **現況**：`docs/article-illustration-plan.md` 已規劃「文章插圖」功能（自動／手動插圖、風格一致、規則檔等），但尚未實作。
- **SKILL 現狀**：完全未提及插圖；Agent 不會知道有這條產品規劃，也無法在「產文 → 縮圖 → 發布」流程中預留插圖步驟。
- **建議**：
  - **短期**：在 SKILL 加一節「未來擴充：文章插圖」，簡短引用 `docs/article-illustration-plan.md`，說明插圖功能規劃中、完成後將插入在「產文與縮圖」之間的步驟。
  - **實作完成後**：在流程中正式加入插圖步驟（讀取規則、判斷位置、生成插圖、寫回 HTML 等），並在 §3 列出相關腳本或指令。

---

## 5. 其他小項

### 5.1 步驟 4 的 HTML 實體

- 第 72 行使用 `<strong>可以視情況建立新的 Tag</strong>`，在 Markdown 中會正確渲染；若 SKILL 被當成 HTML 片段使用，需確認轉換無誤（目前無問題，僅提醒）。

### 5.2 E2E 驗證與實際指令一致性

- §6 E2E 驗證建議「依 Agent 執行流程逐步執行」，但流程中的發布範例若仍用 `--content "<HTML 內容>"` 且路徑為 `../article-drafts/`，會與實際推薦用法（`--content-file` + `./article-drafts/`）不一致，建議 E2E 步驟與 §4 範例一併更新。

---

## 總結：建議優先修正

| 優先 | 項目 | 動作 |
|------|------|------|
| 高 | 發布指令 | 補上 `--content-file`、修正縮圖路徑為 `./article-drafts/<slug>.jpg` |
| 高 | 更新文章 | 補上 `--update-slug` 情境與範例 |
| 中 | 建立新 Tag | 註明目前做法（有無腳本、或由 Agent 打 API） |
| 中 | 文章插圖 | 新增「未來擴充」節並引用計劃書，實作後再補流程 |
| 低 | E2E 與範例 | 與上述發布指令、路徑保持一致 |
