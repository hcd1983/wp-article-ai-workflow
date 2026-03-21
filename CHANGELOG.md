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
