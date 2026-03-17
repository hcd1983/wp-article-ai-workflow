# Agents

本資料夾存放專案內使用的 **Agent 定義**（角色、目標、規則與輸出格式），供 AI 或工作流引用。

## 可用 Agent

| Agent | 檔案 | 說明 |
|-------|------|------|
| **Editing Assistant** | [editing-assistant.md](editing-assistant.md) | 專業編輯助理：潤稿、提升可讀性與語句流暢度，不改變作者原意與論點。輸出為「潤飾後全文」與「主要修改摘要」。 |

## 使用方式

### 手動呼叫

在 AI 對話中將 [editing-assistant.md](editing-assistant.md) 的內容作為 system prompt，再貼上要處理的內文。

### 自動呼叫（連載模式）

在 [`skills/series-writer.md`](../skills/series-writer.md) 的每個子技能完成後，Agent 會詢問是否出動 Editing Assistant 潤稿：

> 「要出動 editing assistant 潤稿嗎？」

- 回「是」→ Agent 扮演 Editing Assistant 角色，潤稿後覆寫原內容並列出修改摘要。
- 回「否」→ 直接進入下一步。

觸發時機涵蓋所有產出人可讀文字的子技能，包括：
`novel-idea` / `world-builder` / `character-builder` / `story-structure` /
`chapter-outline` / `chapter-writer` / `curriculum-idea` / `lesson-writer` /
`story-angle` / `episode-writer` 等。
