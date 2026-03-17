# Sub-skill: curriculum-idea

**所屬類型：** `tutorial`（技術教學）
**觸發時機：** `series:init --type tutorial` 完成後
- `source_mode = "ai"`：直接展開
- `source_mode = "interview"`：`skills/interview.md` 訪談結束，整理課程種子後觸發

---

## 輸入

從 `_<slug>-series-config.md` 讀取：

| 欄位 | 用途 |
|------|------|
| `theme` | 課程主題（例：「用 TypeScript 建構後端 API」） |
| `genre` | 技術領域（例：「後端開發 / Node.js」） |
| `style` | 教學語調（例：「實作導向、口語化」） |

若上述欄位不足，Agent 應主動詢問：
- **目標學員**：等級（入門 / 中階 / 進階）、職業背景（例：前端工程師、學生）。
- **學習痛點**：學員目前卡在哪裡？這個課程解決什麼問題？

---

## Agent 執行步驟

1. **學習痛點定義**
   - 學員在沒有這門課之前，面臨什麼困難或誤解？
   - 市面上現有教材哪裡不足？（過時、太學術、缺乏實作⋯⋯）

2. **學習目標（3–5 條）**
   - 用「學完後能⋯⋯」格式撰寫，要具體可驗證。
   - 例：「能獨立設計並部署一個具備 JWT 認證的 REST API」。

3. **目標學員側寫**
   - 程度假設（知道什麼、不知道什麼）。
   - 動機（為什麼要學這個、學完後要做什麼）。

4. **前置知識清單（初稿）**
   - 列出學員需要先具備的技能或知識。
   - 標記「必備」或「建議」。

5. **學習轉化（Transformation）**
   - 用一句話描述學員「學前 → 學後」的轉變。
   - 例：「從能寫簡單 CRUD，到能獨立架設生產級 API 服務」。

6. **高階模組結構（初稿）**
   - 提出 3–5 個模組，每個模組一句話說明涵蓋範圍。
   - 這是 `curriculum-structure` 子技能的前置輸入。

---

## 輸出格式

完成後寫入 `_<slug>-series-config.md` 的以下欄位：

```json
{
  "world": "課程定位與背景：為什麼這門課存在、面向誰、解決什麼問題",
  "metadata": {
    "learning_objectives": [
      "學完後能獨立設計具備 JWT 認證的 REST API",
      "理解 TypeScript 型別系統在後端的實際應用"
    ],
    "target_audience": {
      "level": "中階",
      "profile": "有 1–2 年前端經驗、想轉往全端的工程師",
      "motivation": "想要能獨立完成後端開發，不依賴後端同事"
    },
    "prerequisites": [
      { "skill": "基本 JavaScript（ES6+）", "required": true },
      { "skill": "HTTP 基本概念", "required": true },
      { "skill": "React 或其他框架使用經驗", "required": false }
    ],
    "course_transformation": "從能寫簡單 CRUD，到能獨立架設生產級 API 服務",
    "pain_point": "現有教材要嘛太學術、要嘛只教基礎 CRUD，缺乏從零到部署的完整路徑",
    "module_draft": [
      "模組一：環境建置與專案架構",
      "模組二：型別設計與資料模型",
      "模組三：認證與授權",
      "模組四：錯誤處理與測試",
      "模組五：部署與監控"
    ]
  }
}
```

---

## 潤稿檢查點

輸出後詢問：
> 「curriculum-idea 完成，要出動 editing assistant 潤稿嗎？」

- 是 → 潤稿 `world`、`learning_objectives`、`course_transformation`、`pain_point` 的文字，覆寫後列出修改摘要。
- 否 → 直接進入下一子技能。

---

## 下一步

確認後自動觸發 `prerequisite-mapper`。
