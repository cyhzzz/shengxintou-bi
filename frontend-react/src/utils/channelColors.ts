/**
 * 渠道同色系调色板
 *
 * 用途：堆叠柱状图按"渠道大类"分组着色，同类渠道使用同色系的不同深浅，
 *       视觉上呈现「同一大类聚合、组内由深到浅」的效果，避免多平台时颜色杂乱。
 *
 * 三大色系：
 *   - 内容平台（红）：抖音 / 小红书 / 腾讯 / 快手 / 财联社 / 云极 / yj / 其他
 *   - 应用市场（蓝）：华为 / 荣耀 / 小米 / oppo / vivo / 苹果 / 鸿蒙
 *   - 本地生活（绿）：高德
 *
 * 同色系内按渠道在列表中的次序取深浅（i=0 → 最深，i=N → 最浅）；
 * 配合 sortChannelsByCategory 把同大类渠道排到一起，配合后端按 -count 排序，
 * 组内自然形成"开户数大的渠道颜色最深"的视觉层次。
 *
 * 使用方式：
 *   import {
 *     CHANNEL_CATEGORY_MAP,
 *     sortChannelsByCategory,
 *     buildChannelColorMap,
 *     CATEGORY_REP_COLORS,
 *   } from '@/utils/channelColors';
 *
 *   const channels = sortChannelsByCategory(rawChannels, CHANNEL_CATEGORY_MAP);
 *   const colorMap = buildChannelColorMap(channels);
 *   series: channels.map(ch => ({ itemStyle: { color: colorMap[ch] || '#999' } }))
 */

/** 渠道 → 大类映射（与后端 CHANNEL_CATEGORY_MAP 一致） */
export const CHANNEL_CATEGORY_MAP: Record<string, string> = {
  小红书: '内容平台', 腾讯: '内容平台', 抖音: '内容平台',
  快手: '内容平台', 财联社: '内容平台', yj: '内容平台',
  云极: '内容平台', 其他: '内容平台',
  华为: '应用市场', 荣耀: '应用市场', 小米: '应用市场',
  oppo: '应用市场', vivo: '应用市场', 苹果: '应用市场', 鸿蒙: '应用市场',
  高德: '本地生活',
};

/** 内容平台红色系（由深到浅，共 8 阶） */
const CONTENT_REDS = [
  '#8b0000', '#a52a2a', '#c0392b', '#d63031',
  '#e74c3c', '#e57373', '#ef9a9a', '#ffcdd2',
];

/** 应用市场蓝色系（由深到浅，共 8 阶） */
const APPMARKET_BLUES = [
  '#0d47a1', '#1565c0', '#1976d2', '#1e88e5',
  '#2196f3', '#42a5f5', '#64b5f6', '#90caf9',
];

/** 本地生活绿色（单一渠道，无需深浅梯度） */
const LOCAL_GREEN = '#27ae60';

/** 大类视觉堆叠顺序（应用市场(蓝) → 内容平台(红) → 本地生活(绿)） */
const CHANNEL_CATEGORY_ORDER: Record<string, number> = {
  应用市场: 0,
  内容平台: 1,
  本地生活: 2,
};

/** 3 大类的图例代表色（用于自定义大类图例的代表色块） */
export const CATEGORY_REP_COLORS: Record<string, string> = {
  内容平台: '#c0392b',
  应用市场: '#1976d2',
  本地生活: '#27ae60',
};

/**
 * 按大类分组的渠道排序（防御性排序 — 即使后端 channels 未排序也能保证分组）。
 *
 * - 第一优先级：大类顺序（应用市场 → 内容平台 → 本地生活）
 * - 第二优先级：组内稳定保留入参原顺序
 *
 * 入参若来自后端（已按 (cat_idx, -count) 排序），组内顺序即为大数→小数；
 * 结合 buildChannelColorMap 的 i=0→最深色，视觉上呈现
 * 「同一大类挨在一起、组内深→浅向上堆叠」。
 */
export function sortChannelsByCategory(
  channels: string[],
  categoryMap: Record<string, string> = CHANNEL_CATEGORY_MAP,
): string[] {
  const rank = (c: string): number => CHANNEL_CATEGORY_ORDER[categoryMap[c]] ?? 99;
  return [...channels].sort((a, b) => rank(a) - rank(b));
}

/**
 * 渠道 → 颜色映射
 *
 * 按渠道所属大类分色系，同色系内按 channels 中的次序由深到浅分配。
 * 超出 8 阶的同类渠道截断到最浅色（避免数组越界）。
 *
 * 未在 CHANNEL_CATEGORY_MAP 中的渠道不会被分配颜色（返回的对象不含该 key），
 * 调用方应使用 `colorMap[ch] || '#999'` 兜底。
 */
export function buildChannelColorMap(
  channels: string[],
  categoryMap: Record<string, string> = CHANNEL_CATEGORY_MAP,
): Record<string, string> {
  const map: Record<string, string> = {};
  const contentChs = channels.filter((c) => categoryMap[c] === '内容平台');
  const appChs = channels.filter((c) => categoryMap[c] === '应用市场');
  const localChs = channels.filter((c) => categoryMap[c] === '本地生活');

  contentChs.forEach((ch, i) => {
    map[ch] = CONTENT_REDS[Math.min(i, CONTENT_REDS.length - 1)];
  });
  appChs.forEach((ch, i) => {
    map[ch] = APPMARKET_BLUES[Math.min(i, APPMARKET_BLUES.length - 1)];
  });
  localChs.forEach((ch) => {
    map[ch] = LOCAL_GREEN;
  });
  return map;
}
