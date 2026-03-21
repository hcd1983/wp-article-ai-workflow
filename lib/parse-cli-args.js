/**
 * 簡易 CLI 參數解析（--key value 形式）。
 * 所有腳本共用，確保行為一致。
 *
 * 規則：
 * - `--key value`：value 不以 `--` 開頭時作為值，否則 key 為 true。
 * - `--key -`：`-` 視為合法值（用於 stdin 語意如 `--plan -`）。
 * - `--flag`（後面無值或下一個也是 `--`）：值為 true。
 *
 * @param {string[]} [argv] - 預設 process.argv.slice(2)
 * @returns {Record<string, string | true>}
 */
export function parseCliArgs(argv) {
  const args = argv ?? process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = args[i + 1];
    const hasValue = next !== undefined && !next.startsWith('--');
    parsed[key] = hasValue ? next : true;
    if (hasValue) i += 1;
  }
  return parsed;
}
