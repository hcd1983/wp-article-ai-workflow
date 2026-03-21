# Skill: 長篇連載內容模式

## 1. 定位與適用情境

AI Agent 以一個核心想法為起點，協助完成「世界觀 / 課程架構 / 報導角度 → 單元大綱 → 逐章撰寫 → 插圖 → 發布」的完整工作流，並跨單元維持內容一致性。

支援三種子類型：

| 類型 | `--type` | 適用情境 |
|------|----------|----------|
| 小說 | `novel` | 科幻、奇幻、現代小說等故事性連載 |
| 技術教學 | `tutorial` | 課程、教程、系列技術文章 |
| 深度報導 | `investigative` | 調查報導、深度系列文章 |

---

## 2. 啟動方式

使用者提供（Agent 可逐一詢問）：

| 欄位 | 說明 |
|------|------|
| `type` | 子類型（novel / tutorial / investigative） |
| `theme` | 核心主題 |
| `genre` | 題材 / 領域 |
| `style` | 文風 / 語調 |
| `length` | 預計單元數 |
| `source_mode` | `ai` 或 `interview` |

---

## 3. 前置：初始化系列

```bash
yarn series:init \
  --slug <系列-slug> \
  --title "<系列標題>" \
  --type <novel|tutorial|investigative> \
  --genre "<題材>" \
  --theme "<主題>" \
  --style "<文風>" \
  --source-mode <ai|interview> \
  --cover-style "<封面風格（英文）>" \
  --illustration-style "<插圖風格（英文）>" \
  --color-palette "<色調（英文）>" \
  --mood "<氛圍（英文）>"
```

執行後建立：
- `article-drafts/<slug>-series/` 資料夾
- `article-drafts/<slug>-series/_<slug>-series-config.md` 設定檔
- WordPress Category（slug：`<slug>-series`）

若不建 WP Category，加 `--skip-wp-category`。

---

## 4. Art Bible（美術風格設定）

存於 `_<slug>-series-config.md` 的 `art_style` 欄位，統一規範整個系列的視覺語言：

| 欄位 | 說明 | 範例 |
|------|------|------|
| `cover_style` | 章節封面風格 | `"dark dystopian, cinematic noir, high contrast"` |
| `illustration_style` | 內文插圖風格 | `"clean line art, monochrome, cyberpunk"` |
| `color_palette` | 色調描述 | `"deep blue, black, neon accents"` |
| `mood` | 氛圍描述 | `"tense, atmospheric"` |

初始化後可直接編輯設定檔調整。**除非使用者明確要求 override，否則所有與系列相關的產圖（封面、插圖、宣傳圖）都必須嚴格遵守此 Art Bible：**

- 封面產圖時：prompt 應優先由 `cover_style` + `color_palette` + `mood` 組成（僅在必要時補充構圖語意），避免加入與這些規範衝突的額外風格字眼。
- 內文插圖產圖時：預設使用 `illustration_style`（除非單張插圖或 plan 明確提供 `style`）。
- 若 `metadata` 中另有封面或插圖的補充規則（例如 `series_cover_image`、`narration_rules` 搭配的視覺指示），Agent 應一併納入考量，不自行改變畫風方向。

---

## 5. 子技能觸發流程

### 小說（novel）

| 子技能 | 觸發時機 | 輸出 | 規格 |
|--------|----------|------|------|
| `novel-idea` | 初始化後 | `world` / `characters` / `metadata.novel_premise` 初稿 | [novel-idea.md](sub-skills/novel-idea.md) |
| `world-builder` | `novel-idea` 後 | `world` 完整描述 | — |
| `character-builder` | `world-builder` 後 | `characters[]` | — |
| `story-structure` | `character-builder` 後 | `outline`（三幕架構） | — |
| `chapter-outline` | `story-structure` 後 | `outline[]` 完整章節列表 | — |
| `chapter-writer` | 每章發布前 | `chapter-<NN>.html` | — |
| `novel-rewrite` | `chapter-writer` 後（可選） | 覆蓋章節 HTML | — |

### 技術教學（tutorial）

| 子技能 | 觸發時機 | 輸出 | 規格 |
|--------|----------|------|------|
| `curriculum-idea` | 初始化後 | `world` / `metadata.learning_objectives` / `metadata.module_draft` 初稿 | [curriculum-idea.md](sub-skills/curriculum-idea.md) |
| `prerequisite-mapper` | `curriculum-idea` 後 | `metadata.prerequisites` 完整清單 | — |
| `concept-builder` | `prerequisite-mapper` 後 | 核心概念定義 | — |
| `curriculum-structure` | `concept-builder` 後 | 課程架構（模組 / 章） | — |
| `lesson-outline` | `curriculum-structure` 後 | 各課大綱 | — |
| `lesson-writer` | 每課發布前 | `chapter-<NN>.html` | — |
| `lesson-rewrite` | `lesson-writer` 後（可選） | 覆蓋課程 HTML | — |

### 深度報導（investigative）

| 子技能 | 觸發時機 | 輸出 | 規格 |
|--------|----------|------|------|
| `story-angle` | 初始化後 | `world` / `metadata.core_question` / `metadata.narrative_threads` 初稿 | [story-angle.md](sub-skills/story-angle.md) |
| `context-builder` | `story-angle` 後 | `world` 完整背景 | — |
| `source-mapper` | `context-builder` 後 | `metadata.key_stakeholders` 完整清單 | — |
| `investigation-structure` | `source-mapper` 後 | 系列架構（各集主題） | — |
| `episode-outline` | `investigation-structure` 後 | 各集大綱 | — |
| `episode-writer` | 每集發布前 | `chapter-<NN>.html` | — |
| `episode-rewrite` | `episode-writer` 後（可選） | 覆蓋集數 HTML | — |

### 潤稿檢查點

**每個子技能產出文字內容後**，Agent 詢問：
> 「要出動 editing assistant 潤稿嗎？」

- 回「是」→ Agent 扮演 `agents/editing-assistant.md` 角色，潤稿後覆寫原內容，並列出修改摘要。
- 回「否」→ 直接進入下一步。

---

## 6. 走向調整（Direction Pivot）

在任何創作階段，使用者可提出：「我想調整 `<系列名稱>` 的走向」。

**Agent 處理流程：**

1. **確認調整範圍**：詢問是要調整整體方向（主題 / 結構 / 文風）還是單一單元。
2. **選擇調整模式**：
   - `interview` 模式：啟動訪談（參見 `skills/interview.md`），挖掘使用者對新走向的想法，整理後輸入 Agent。
   - `direct` 模式：使用者直接描述調整大方向，Agent 提出具體修改建議並與使用者討論確認。
3. **確認影響範圍**：Agent 列出受影響的欄位（`theme`、`outline`、已完成章節等），讓使用者決定是否連帶修改。
4. **更新設定檔**：確認後寫入 `_<slug>-series-config.md`（`updated_at` 自動更新）。
5. **待發布單元**：若有尚未撰寫的單元（`outline[].status !== 'published'`），Agent 建議是否依新走向重新產出大綱。

---

## 7. source_mode 切換規則

**`source_mode = "ai"`**
- Agent 直接展開所有子技能，每步以條列式摘要呈現結果供確認或修改。

**`source_mode = "interview"`**
- 在第一個子技能（`novel-idea` / `curriculum-idea` / `story-angle`）執行前，先沿用 `skills/interview.md` 的訪談流程挖掘素材。
- 訪談結束後，將「故事種子 / 課程種子 / 報導種子」整理成結構化輸入，交由 Agent 繼續展開。

---

## 8. 內容撰寫 HTML 規範

章節 / 課程 / 集數 HTML 遵循 `skills/auto-post.md` Section 3 的 HTML 輸出格式（不含 DOCTYPE、html、head、body），並額外：

1. **章節標題**：使用 `<h1>` 作為主標題，可在前加 `<p class="chapter-label">第 N 章</p>`。
2. **不插入前情摘要 HTML 區塊**，前情摘要僅存 config 供 Agent 閱讀。
3. **儲存路徑**：`article-drafts/<slug>-series/chapter-<NN>.html`（`NN` 以 `padStart(2, '0')` 補零）。

---

## 9. 插圖工作流程

每章完稿後（可選）：

**Step 1：建立插圖計畫（由 Agent 產出 JSON）**

- **出圖來源**：與單篇 `auto-post` 步驟 3.5 相同——使用者未指定且未全權委託時，Agent 應先問 Gemini／Pexels／混合；提議時以**自然語言描述段落位置**，確認後再填入 `insertAfterBlockIndex`。
- **Pexels**：`source: "pexels"` 且每張需 `pexelsQuery`；**不使用**系列角色參考圖（`--reference` / `--use-character-reference` 僅對 Gemini 張有效）。
- **JSON 範例**（可混合來源）：
```json
{
  "defaultSource": "gemini",
  "illustrations": [
    { "insertAfterBlockIndex": 1, "prompt": "英文圖像描述", "altText": "圖說" },
    { "insertAfterBlockIndex": 4, "source": "pexels", "pexelsQuery": "cyberpunk city night", "altText": "圖說" }
  ]
}
```
`insertAfterBlockIndex` 為 0 起算的 HTML 頂層區塊索引。`style` 省略時使用 `art_style.illustration_style`（Gemini 張）。

**插圖數量與分散建議：**

- 預設每章 3 張左右（長篇可視情況調整 3–5 張，但不超過 `ILLUSTRATION_MAX_PER_ARTICLE` 或專案約定上限）。
- 先粗略將全文切成等長的 3～5 個區段，再在各區段內挑 1 個代表性情節作為插圖位置，**避免全部集中在開頭**。
- 避免在相鄰的頂層區塊連續插兩張圖（中間至少間隔 1 個以上文字區塊），讓閱讀節奏不要被圖片打斷。

**Step 2：產圖並插入 HTML**
```bash
yarn series:add-illustrations \
  --series <slug> \
  --chapter <N> \
  --plan <計畫檔路徑 或 ->

# 舊版「一錯即停」
yarn series:add-illustrations --series <slug> --chapter <N> --plan <計畫.json> --strict
```

（可選）若要維持角色一致性，可帶參考圖（可逗號分隔多張）：
```bash
yarn series:add-illustrations --series <slug> --chapter <N> --plan <計畫.json> --reference "./path/to/ref.jpg"
```

（可選）也可將參考圖寫入系列設定檔 `_<slug>-series-config.md` 的 `characters[].reference_image`（例如主角角色填 `"xiao-tu-reference.jpg"`），並在需要時加上 `--use-character-reference`（預設不會自動套用）：
```bash
yarn series:add-illustrations --series <slug> --chapter <N> --plan <計畫.json> --use-character-reference
```

圖片命名：`chapter-<NN>-1.jpg`、`chapter-<NN>-2.jpg`…，與 HTML 放同一目錄。

---

## 10. 發布單元 SOP

**Step 1：（可選）產生封面**
```bash
yarn ai:generate-thumbnail \
  --prompt "<封面描述（英文）>" \
  --out ./article-drafts/<slug>-series/chapter-<NN>.jpg
```
> 建議以 `art_style.cover_style` 作為 prompt 前綴。

（可選）封面也可帶參考圖，維持角色/畫風一致（可逗號分隔多張，僅 Gemini）：
```bash
yarn ai:generate-thumbnail --prompt "<封面描述（英文）>" --reference "./path/to/ref.jpg" --out ./article-drafts/<slug>-series/chapter-<NN>.jpg
```

Pexels 封面：
```bash
yarn ai:generate-thumbnail --image-source pexels --pexels-query "<關鍵字>" --out ./article-drafts/<slug>-series/chapter-<NN>.jpg
```

- **若使用者已直接提供封面圖或指定要採用的圖片檔，優先使用該素材。** 只做必要的檔名對齊、格式轉換與同步，不要自行重生新封面，除非使用者明確要求。

**Step 2：發布**
```bash
yarn series:publish \
  --series <slug> \
  --chapter <N> \
  --title "<繁體中文標題>" \
  --status publish \
  --tags "<tagId1,tagId2,...>" \
  --summary "<本單元摘要，供 Agent 下一單元參考>"
```

> 建議：在每章寫作完成時，就先由 Agent 產出一段 3–6 句的中文摘要，填入 `--summary` 並同步寫回 `_<slug>-series-config.md` 的 `chapters_published[].summary`，作為之後章節的「前情提要」依據。

如同單篇模式的 `wp:publish-post`，連載也支援「更新既有文章」：帶上 `--update-slug "<既有 slug>"`，則會以該 slug 尋找 WP 文章並使用 update 模式（不再新建），同時仍會：

- 依章節 HTML 重新上傳文內 `<img>` 圖片並改寫 `src`
- 覆寫標題、內容、分類、Tag 等欄位（依 CLI 參數而定）

> 實務上建議：在「反覆潤稿／重做插圖」階段，一律使用 `--update-slug` 更新同一篇 WP 文章，避免產生多個 slug 接近的重複草稿。重跑 `series:publish` 時，視為預期行為：封面與文內圖片會重新上傳、`src` 被改寫成新媒體 URL。

發布後：
- `_<slug>-series-config.md` 的 `chapters_published` 新增一筆。
- `outline[N-1].status` 更新為 `"published"`。

---

## 11. 目錄結構

```
article-drafts/
  <slug>-series/
    _<slug>-series-config.md   ← 系列設定（JSON）
    chapter-01.html
    chapter-01.jpg             ← 封面
    chapter-01-1.jpg           ← 插圖
    chapter-02.html
    chapter-02.jpg
    ...
```

---

## 12. E2E 驗證

```bash
# 初始化
yarn series:init --slug test-series --title "測試系列" --type novel --skip-wp-category

# 建立測試章節
echo '<h1>第一章</h1><p>測試內容。</p>' > article-drafts/test-series-series/chapter-01.html

# 發布草稿
yarn series:publish \
  --series test-series \
  --chapter 1 \
  --title "第一章：測試" \
  --status draft \
  --skip-thumbnail
```

驗證：
- `article-drafts/test-series-series/_test-series-series-config.md` 存在且內容正確。
- WP 後台有草稿文章（若未 `--skip-wp-category`，歸屬正確 Category）。
- `chapters_published` 有新增一筆，`outline[0].status === "published"`。
