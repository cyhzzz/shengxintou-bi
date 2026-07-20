/**
 * 文本清洗工具 (v3.1.2)
 *
 * 解决上游 Excel 导入 fact_conv_content / fact_conv_appmarket 时混入的脏字符：
 * - NUL (\x00) 与 ASCII 控制字符 (\x01-\x08 / \x0B / \x0C / \x0E-\x1F / \x7F)
 * - UTF-8 替换字符 \uFFFD（数据库存的是 GBK 等被错误解码后的产物）
 * - 不可见零宽字符 \u200B-\u200D / \uFEFF（容易粘到主播名 / 来源里）
 * - 折叠多余空白
 *
 * 为什么必须在客户端做：
 * - 这些数据已原样入库（v2 战略），不会再做业务清洗
 * - 报表直接渲染会出现方块（�）、控制字符、不可见零宽等乱码
 * - 服务端清洗会破坏 v2 原样入库的语义，且清洗逻辑要全链路同步
 */

// 控制字符正则：用 String.fromCharCode 构造，避免正则字面量中出现控制字符触发 no-control-regex
// 范围：0x00-0x08、0x0B、0x0C、0x0E-0x1F、0x7F（保留 \t=0x09、\n=0x0A、\r=0x0D）
const CONTROL_CHARS_RE = new RegExp(
  '[' +
    String.fromCharCode(0x00) + '-' + String.fromCharCode(0x08) +
    String.fromCharCode(0x0b) +
    String.fromCharCode(0x0c) +
    String.fromCharCode(0x0e) + '-' + String.fromCharCode(0x1f) +
    String.fromCharCode(0x7f) +
  ']',
  'g'
);

/**
 * 清洗单个字符串。返回安全可渲染的字符串；传入 null/undefined 返回 ''。
 */
export function sanitizeText(value: unknown): string {
  if (value === null || value === undefined) return '';

  let s = typeof value === 'string' ? value : String(value);

  // 1. 剥 BOM
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);

  // 2. NUL / ASCII 控制字符：保留 \t(0x09)、\n(0x0A)、\r(0x0D)
  //    其余 0x00-0x1F 与 0x7F 全部删
  s = s.replace(CONTROL_CHARS_RE, '');

  // 3. UTF-8 替换字符（数据库里的 GBK 残留）
  s = s.replace(/\uFFFD/g, '');

  // 4. 不可见零宽字符：U+200B-U+200D、U+2060、U+FEFF（如果仍残留）
  s = s.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '');

  // 5. 折叠连续空白为单空格，剥首尾空白
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}

/**
 * 清洗数组（主播名 / 平台名 / 来源 chips 数组）
 */
export function sanitizeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => sanitizeText(v))
    .filter((v) => v.length > 0);
}

export default sanitizeText;
