# Changelog

## [Unreleased]

### Added

- Pexels 圖庫來源：`PEXELS_API_KEY`、`PEXELS_ATTRIBUTION_DEFAULT`（預設顯示 figcaption 署名）。
- 插圖計畫 JSON：`defaultSource`、`source`（`gemini` | `pexels`）、`pexelsQuery`、`attribution`（單張覆寫署名）。
- `ILLUSTRATION_STRICT_MODE` 與 `yarn ai:add-illustrations --strict` / `yarn series:add-illustrations --strict`：任一幅失敗即中斷（等同舊行為）。
- `yarn ai:generate-thumbnail --image-source gemini|pexels` 與 `--pexels-query`。
- `lib/image-source-registry.js`、`lib/strategies/*`、`lib/pexels-client.js`、`lib/fetch-image-buffer.js`。

### Changed

- **Breaking：** `ai:add-illustrations` / `series:add-illustrations` 預設在單張產圖失敗時**略過該張並繼續**（不再整支中斷）。需舊行為請設 `ILLUSTRATION_STRICT_MODE=true` 或加 `--strict`。
- `lib/generate-thumbnail.js` 的 `generateThumbnail()` 改為回傳 `{ buffer, meta }`（`meta` 僅 Pexels 可能有署名欄位）。
- `insertFigures` 改為依 `insertAfterBlockIndex` **降序** splice 插入，並支援 Pexels 攝影師署名 HTML。

### Fixed

- 防止 figcaption 署名連結的 `javascript:` 協議注入（新增 `isSafeUrl` 白名單檢查，僅允許 http/https）。
- 統一插圖序號為計畫順序（`i+1`），dry-run 與實際執行一致。
- Pexels 無結果時的錯誤訊息改為同時顯示篩選失敗原因與 rate limit 狀態，避免誤導。
- `series-add-illustrations` 補上 `maxPerArticle` 插圖上限檢查（與 `add-illustrations` 一致）。
- `insertFigures` 對超出範圍的 `insertAfterBlockIndex` 加入 warn 訊息，不再靜默 fallback。

### Refactored

- 抽出 `resolveImageSource` / `resolveShowAttribution` 至 `lib/illustration-plan-utils.js`，兩支插圖腳本共用。
- 統一三支腳本的 `parseArgs` 為 `lib/parse-cli-args.js`（`parseCliArgs`），消除微妙行為差異。
- 移除 `scripts/generate-thumbnail.js` 中冗餘的 `prompt` 選項鍵。
