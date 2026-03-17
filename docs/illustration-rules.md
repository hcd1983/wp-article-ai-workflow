# 文章插圖規則說明

本檔案為人類可讀的插圖規則與範例。程式會解析下方 YAML 區塊與「不插圖類型／標籤」清單，決定是否對某篇文章執行自動插圖。

```yaml
# 以下類型（分類 slug）不自動插圖
exclude_types:
  - release-note
  - legal
  - policy
# 以下標籤 slug 若為文章主要標籤可不插圖（可選）
exclude_tags:
  - announcement
  - 法律
```

---

## 不插圖類型（exclude_types）

以下**文章類型**或**分類 slug**不自動插圖（可依站點習慣修改）：

- release-note
- legal
- policy

（若無則留空，或刪除上述項目。）

---

## 不插圖標籤（exclude_tags）

以下**標籤 slug**若為文章主要標籤，可不插圖（可選）：

- announcement
- 法律

---

## 本篇不插圖（單篇文章關閉）

若**單篇文章**不要插圖，請在 HTML 檔案**最開頭**加入註解：

```html
<!-- illustration: off -->
<h1>文章標題</h1>
...
```

存檔後，執行插圖腳本會略過該篇文章。

---

## 插圖數量上限

每篇文章的插圖數量上限由 `.env` 的 `ILLUSTRATION_MAX_PER_ARTICLE` 控制（預設 3）。  
若需依類型設定不同上限，可於後續擴充規則檔或腳本邏輯。
