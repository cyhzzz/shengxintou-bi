/**
 * ECharts 图表 axis 悬浮框公共工具
 *
 * 背景：堆叠图 / 多系列计数图的数据里大量 0 只是堆叠占位（当日该系列无数据），
 * 悬浮框逐行列出这些 0 值项没有信息量；全为 0 时悬浮框整体不出现。
 *
 * 适用判断（由各图表自行决定是否接入）：
 * - 适用：堆叠柱图、多系列计数柱图/折线图（0 是占位噪音）
 * - 不适用：比率/百分比图（0% 有业务含义）、单系列图（过滤后悬浮消失与图形不一致）
 */

// 堆叠图 axis tooltip：过滤 0 值系列（数据里的 0 只是堆叠占位，悬浮展示无意义），全为 0 时不出悬浮
export function compactStackTooltip(params: any): string {
  const list = (Array.isArray(params) ? params : [params]).filter((p: any) => p.value != null && Number(p.value) !== 0);
  if (!list.length) return '';
  const head = list[0].axisValueLabel || list[0].name;
  const rows = list.map((p: any) => `${p.marker} ${p.seriesName}&nbsp;&nbsp;<b>${Number(p.value).toLocaleString('zh-CN')}</b>`);
  return [head, ...rows].join('<br/>');
}
