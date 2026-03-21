# IT Monk Auto Post — Skill 索引

本專案的 AI Agent 技能規格分拆於 `skills/` 目錄，依情境選擇對應的 Skill 執行。

## 可用 Skills

| Skill | 檔案 | 適用情境 |
|-------|------|----------|
| 單篇自動發文 | [`skills/auto-post.md`](skills/auto-post.md) | 從主題到發布的完整單篇文章流程（搜尋文獻 → 產文 → 縮圖 → 發布） |
| Interview 模式 | [`skills/interview.md`](skills/interview.md) | 透過專訪式對談挖掘素材，整理成大綱與標題建議 |
| 長篇連載內容模式 | [`skills/series-writer.md`](skills/series-writer.md) | 小說 / 技術教學 / 深度報導的多單元連載流程（世界觀・課程架構・報導角度 → 大綱 → 逐章撰寫・插圖・發布） |

## 快速判斷

- 想寫**單篇文章**，直接跑完整流程 → [`auto-post`](skills/auto-post.md)
- 有想法但**素材還不夠清晰**，需要先訪談挖掘 → [`interview`](skills/interview.md)（結束後銜接 `auto-post`）
- 想寫**多單元連載**（小說 / 技術教學 / 深度報導）→ [`series-writer`](skills/series-writer.md)（支援 `source_mode=interview` 與走向調整）

## 環境前置（所有 Skills 共用）

```bash
yarn          # 安裝依賴
cp .env.example .env  # 填入 SITE、USER_NAME、WP_APP_PASSWORD、GEMINI_API_KEY（使用 Pexels 時另填 PEXELS_API_KEY）
yarn test:config      # 確認設定可讀取
```
