/**
 * 报告生成页面 — v3.1.31 纯数据周报（本周 + 全年 + 环比 + 两堆叠图 + 互联网占比）
 *
 * 改造点（相对 v3.1.30）：
 * - 数据结构按业务维度重梳：6 指标 × 3 套时间区间（本周/全年累计/上周环比）
 * - 去掉 tab 切换，两个堆叠图直接平铺（开户数 + 有效户数，按渠道堆叠日走势）
 * - 加互联网渠道占公司开户占比（互联网引流 / 全渠道类别）
 * - 6 指标：消耗金额 / 品牌曝光 / 线索数 / 开户数 / 新增有效户数 / 新增客户资产
 */
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Button, Select, message, Spin, Segmented } from 'antd';
import {
  FilePdfOutlined,
  FileImageOutlined,
  SettingOutlined,
  EyeOutlined,
} from '@ant-design/icons';
// v3.2.5：按需 import（echarts/core），图表/组件/渲染器由 EChartsComponent 模块副作用注册
// 这里只触发副作用 + 拿到 echarts core API（init / EChartsOption type）
import * as echarts from 'echarts/core';
import type { EChartsType } from 'echarts/core';
import type { EChartsOption } from 'echarts';
import '@/components/Chart/ECharts'; // 触发 echarts.use 副作用（幂等）
import { FadeInSection } from '@/components';
import { http } from '@/services/http'; // feat-local-auth：用 http 客户端自动带 Authorization
import {
  CHANNEL_CATEGORY_MAP,
  sortChannelsByCategory,
  buildChannelColorMap,
  CATEGORY_REP_COLORS,
} from '@/utils/channelColors';
import { saveBlobFile, buildMobileSaveMessage, captureElement } from '@/utils/saveBlob';
import styles from './index.module.scss';

// 类型定义
interface PeriodOption {
  value: string;
  label: string;
  report_year: number;
  report_week: number;
  date_range: string;
  sequence: number;
  disabled?: boolean;
  disabled_reason?: string;
}

interface MetricSet {
  cost: number;          // 消耗金额
  impressions: number;   // 品牌曝光
  leads_wx: number;      // 企微数（内容平台）
  leads_app: number;     // APP激活数（应用市场）
  opens_app: number;     // 应用市场开户数（互联网引流里属于应用市场大类）
  opens_other: number;  // 其他渠道开户数（互联网引流里非应用市场部分）
  opens: number;         // 合计新开户数（互联网引流合计 = opens_app + opens_other）
  valid: number;         // 新增有效户数
  assets: number;        // 新增客户资产
}

interface WeeklyData {
  period: {
    start_date: string;
    end_date: string;
    prev_start: string;
    prev_end: string;
    report_year: number;
    report_week: number;
    report_name: string;
    report_sequence: number;
  };
  current_week: MetricSet;
  year_to_date: MetricSet;
  prev_week: MetricSet;
  week_over_week: { [K in keyof MetricSet]: number | null };
  daily_opens_stacked: Array<Record<string, number | string>>;
  weekly_opens_stacked: Array<Record<string, number | string>>;
  channels: string[];
  internet_ratio: {
    opens_ratio: number;
    valid_ratio: number;
    year_opens_ratio: number;
    year_valid_ratio: number;
  };
  kpi: {
    time_progress: number;
    opens: { target: number; actual: number; rate: number };
    valid: { target: number; actual: number; rate: number };
    assets: { target: number; actual: number; rate: number };
  };
}

// ============ v4.2.x 周报详细版（按渠道分类下钻） ============
type ReportMode = 'overview' | 'detail';

interface AppMarketPlan {
  plan_id: string | null;
  plan_name: string | null;
  versions: string[];
  sub_versions: string[];
  bids: string[];
  spend: number;
  impressions: number;
  clicks: number;
  open_count: number;
  open_cost: number | null;
  activated: number;
  assets: number;
}

interface AppMarketPlatform {
  platform: string;
  spend: number;
  open_count: number;
  open_cost: number | null;
  activated: number;
  assets: number;
  top_plans: AppMarketPlan[];
}

interface ContentPlan {
  plan_id: string | null;
  plan_name: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  open_count: number;
}

interface ContentFactory {
  factory: string;
  spend: number;
  open_count: number;
  plans: ContentPlan[];
}

interface ContentPlatform {
  platform: string;
  lead_count: number;
  open_count: number;
  factories: ContentFactory[];
}

interface LiveAnchor {
  anchor_name: string;
  live_type: string | null;
  leads: number;
  new_leads: number;
  mouth: number;
  opened: number;
  new_opened: number;
  valid: number;
  new_valid: number;
  assets: number;
  new_assets: number;
}

interface LocalLifeItem {
  platform: string;
  open_count: number;
}

type WeeklyOpenRow = Record<string, number | string>;

interface DetailScope {
  app_market: AppMarketPlatform[];
  content_platform: ContentPlatform[];
  live: LiveAnchor[];
  local_life: LocalLifeItem[];
  app_market_weekly: WeeklyOpenRow[];
  content_weekly: WeeklyOpenRow[];
  live_weekly: WeeklyOpenRow[];
  local_life_weekly: WeeklyOpenRow[];
}

interface WeeklyDetailData {
  period: {
    start_date: string;
    end_date: string;
    report_year: number;
    report_week: number;
    report_name: string;
    report_sequence: number;
  };
  current_week: DetailScope;
  year_to_date: DetailScope;
}

// 核心指标定义（v3.3.10：开户数拆 3 行 — 应用市场 / 其他渠道 / 合计）
// rowType: normal=普通指标；sub=开户数分项行（淡背景+不加粗）；total=合计行（加粗+顶部分隔线）
type RowType = 'normal' | 'sub' | 'total';
const METRICS: Array<{ key: keyof MetricSet; label: string; fmt: (n: number) => string; rowType: RowType }> = [
  { key: 'cost', label: '消耗金额', fmt: fmtMoney, rowType: 'normal' },
  { key: 'impressions', label: '品牌曝光', fmt: fmtLarge, rowType: 'normal' },
  { key: 'leads_wx', label: '企微数', fmt: fmtNum, rowType: 'normal' },
  { key: 'leads_app', label: 'APP激活数', fmt: fmtNum, rowType: 'normal' },
  { key: 'opens_app', label: '应用市场开户数', fmt: fmtNum, rowType: 'sub' },
  { key: 'opens_other', label: '其他渠道开户数', fmt: fmtNum, rowType: 'sub' },
  { key: 'opens', label: '合计新开户数', fmt: fmtNum, rowType: 'total' },
  { key: 'valid', label: '新增有效户数', fmt: fmtNum, rowType: 'normal' },
  { key: 'assets', label: '新增客户资产', fmt: fmtMoney, rowType: 'normal' },
];

// 格式化数字（千分位）
function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return '0';
  return Number(n).toLocaleString('zh-CN');
}

// 格式化大数字（万为单位）
function fmtLarge(n: number | null | undefined): string {
  if (!n) return '0';
  if (n >= 10000) return (n / 10000).toFixed(2) + '万';
  return fmtNum(n);
}

// 堆叠图 axis tooltip：过滤 0 值系列（数据里的 0 只是堆叠占位，悬浮展示无意义），全为 0 时不出悬浮
function compactStackTooltip(params: any): string {
  const list = (Array.isArray(params) ? params : [params]).filter((p: any) => p.value != null && Number(p.value) !== 0);
  if (!list.length) return '';
  const head = list[0].axisValueLabel || list[0].name;
  const rows = list.map((p: any) => `${p.marker} ${p.seriesName}&nbsp;&nbsp;<b>${fmtNum(p.value)}</b>`);
  return [head, ...rows].join('<br/>');
}

// 格式化金额
function fmtMoney(n: number | null | undefined): string {
  if (!n) return '¥0';
  return '¥' + Number(n).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}

// 格式化日期
function fmtDate(s: string): string {
  if (!s) return '';
  const d = new Date(s);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

// 格式化环比（带正负号）
function fmtWow(n: number | null | undefined): { text: string; positive: boolean | null } {
  if (n === null || n === undefined) return { text: '—', positive: null };
  const sign = n >= 0 ? '+' : '';
  return { text: `${sign}${n.toFixed(2)}%`, positive: n >= 0 };
}

// v3.1.35 微型 KPI 环形图（SVG，尺寸 ~44x32，与原 layerTag 灰字占用空间相近）
function KpiRing({ label, rate }: { label: string; rate: number }) {
  // rate 为百分比，>100 时截断到 100 用于画环
  const pct = Math.min(100, Math.max(0, rate || 0));
  const r = 10;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);
  const color = rate >= 100 ? '#27ae60' : rate >= 75 ? '#0052d9' : rate >= 50 ? '#d97706' : '#c0392b';
  return (
    <div className={styles.kpiRing}>
      <svg width="28" height="28" viewBox="0 0 28 28">
        <circle cx="14" cy="14" r={r} fill="none" stroke="#e8e8e8" strokeWidth="3" />
        <circle
          cx="14"
          cy="14"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 14 14)"
        />
      </svg>
      <div className={styles.kpiRingText}>
        <div className={styles.kpiRingLabel}>{label}</div>
        <div className={styles.kpiRingRate} style={{ color }}>
          {rate.toFixed(0)}%
        </div>
      </div>
    </div>
  );
}

// ============ 周报详细版海报（按渠道分类下钻，本周 + 全年累计） ============
// ============================ 周报详细版 · 可视化原语 ============================
// 过滤零数据：只为「本周/全年真实有流量」的对象渲染，避免空数据/零值占位
const _appHasPlanVal = (p: AppMarketPlan) => p.open_count > 0 || p.spend > 0;
const _appHasPlat = (p: AppMarketPlatform) => p.open_count > 0 || p.spend > 0;
const _ctHasPlat = (p: ContentPlatform) =>
  p.lead_count > 0 ||
  p.factories.some((f) => f.open_count > 0 || f.plans.some((pl) => pl.spend > 0));
const _hasAnchor = (a: LiveAnchor) => a.leads > 0;

// KPI 小卡片条
function PosterKpi({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div className={styles.kpiStrip}>
      {items.map((it) => (
        <div className={styles.kpiChip} key={it.label}>
          <div className={styles.kpiValue}>{it.value}</div>
          <div className={styles.kpiLabel}>{it.label}</div>
        </div>
      ))}
    </div>
  );
}

interface StackSeriesItem {
  name: string;
  data: number[];
  color?: string;
}

// 详细版堆叠柱状图（x=分类，多系列垂直堆叠，样式参照概览版堆叠图：axis shadow + stack + 紧凑网格）
function StackBars({
  categories,
  series,
  height = 170,
  rotate,
}: {
  categories: string[];
  series: StackSeriesItem[];
  height?: number;
  rotate?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const instRef = useRef<echarts.EChartsType | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (instRef.current) {
      instRef.current.dispose();
      instRef.current = null;
    }
    const chart = echarts.init(el);
    instRef.current = chart;
    chart.setOption({
      // 静态海报禁用入场动画：导出截图按当下画布内容抓取，动画起始帧柱子高度为 0 会被拍成空白
      animation: false,
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: compactStackTooltip },
      legend: { show: false },
      grid: { top: 14, left: 40, right: 18, bottom: 26, containLabel: true },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: { fontSize: 9, rotate: rotate ?? (categories.length > 7 ? 24 : 0) },
      },
      yAxis: { type: 'value', axisLabel: { fontSize: 9 } },
      series: series.map((s) => ({
        name: s.name,
        type: 'bar',
        stack: 'total',
        barMaxWidth: 28,
        emphasis: { focus: 'series' },
        data: s.data,
        itemStyle: { color: s.color },
      })),
    } as EChartsOption);

    const onR = () => chart.resize();
    window.addEventListener('resize', onR);
    return () => {
      window.removeEventListener('resize', onR);
      chart.dispose();
      instRef.current = null;
    };
  }, [categories, series, rotate]);

  return <div ref={ref} style={{ width: '100%', height }} />;
}

// 堆叠图系列基色（RGB 三元组）：应用市场=蓝 / 内容平台=红 / 直播=靛蓝 / 本地生活=绿，与云图板块基色一致
const BLUE_BASE: [number, number, number] = [25, 118, 210];
const RED_BASE: [number, number, number] = [192, 57, 43];
const INDIGO_BASE: [number, number, number] = [63, 81, 181];
const GREEN_BASE: [number, number, number] = [46, 125, 50];

// 从基色生成 n 个由亮到暗的系列色（浅=小数值在前，深=大数值在后）
function palette(base: [number, number, number], n: number): string[] {
  const arr: string[] = [];
  for (let i = 0; i < n; i++) {
    const k = 1 - (0.62 * i) / Math.max(1, n - 1);
    const [r, g, b] = base.map((x) => Math.round(x * k));
    arr.push(`rgb(${r},${g},${b})`);
  }
  return arr;
}

// 把「分类 → 细分段{name,value}」聚合为堆叠图输入：
// 全量系列如实展示（不合并「其他」，各渠道系列数均有限），仅按总值降序排列，深色=贡献高
function buildStacked(
  categories: string[],
  segFor: (cat: string) => Array<{ name: string; value: number }>
): { categories: string[]; series: StackSeriesItem[] } {
  const segTotal: Record<string, number> = {};
  const segByCat: Record<string, Record<string, number>> = {};
  for (const c of categories) {
    segByCat[c] = segByCat[c] || {};
    for (const s of segFor(c)) {
      segByCat[c][s.name] = (segByCat[c][s.name] || 0) + s.value;
      segTotal[s.name] = (segTotal[s.name] || 0) + s.value;
    }
  }
  const keep = Object.entries(segTotal).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([n]) => n);
  const series: StackSeriesItem[] = keep.map((name) => ({
    name,
    data: categories.map((c) => segByCat[c]?.[name] || 0),
  }));
  return { categories, series };
}

// 分周开户序列（周次×细分）转堆叠图输入：
// x=周次，系列=当前横坐标对象（平台/主播），值=开户数；复用 buildStacked 的 TopN + 其他聚合
function weeklyStacked(
  rows: WeeklyOpenRow[],
  colorBase: [number, number, number]
): { categories: string[]; series: StackSeriesItem[] } {
  const categories = rows.map((r) => String(r.week));
  const { series } = buildStacked(categories, (wk) => {
    const row = rows.find((r) => String(r.week) === wk)!;
    return Object.entries(row)
      .filter(([k]) => k !== 'week')
      .map(([name, value]) => ({ name, value: Number(value || 0) }));
  });
  const colored = series.map((s, i) => ({ ...s, color: palette(colorBase, series.length)[i] }));
  return { categories, series: colored };
}

// 全年分周开户堆叠图（x=周次，系列=平台/主播，值=开户数），仅在全量数据存在时渲染
function WeeklyChart({
  rows,
  colorBase,
  height,
}: {
  rows: WeeklyOpenRow[];
  colorBase: [number, number, number];
  height?: number;
}) {
  // useMemo 稳定堆叠图输入：导出等无关状态引起的父级重渲染不得重建 ECharts 实例，
  // 否则 dispose + 重初始化会把已绘好的画布清空，导出图片中图表丢失（同 HeroCloudMap 的 memo 模式）
  const stacked = useMemo(
    () => (rows.length ? weeklyStacked(rows, colorBase) : null),
    [rows, colorBase]
  );
  if (!stacked || !stacked.series.length) return null;
  return <StackBars categories={stacked.categories} series={stacked.series} rotate={24} height={height} />;
}

// 把分周开户序列按「系列名」聚合为全年合计（与分周堆叠图严格同源同口径）。
// 背景：主播复合来源均分存在 round 舍入，全年一次聚合 ≠ 逐周聚合求和，
// 云图/KPI 若用全年明细口径会与分周堆叠图对不齐，故统一从分周序列聚合。
function aggregateWeekly(rows: WeeklyOpenRow[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const r of rows || []) {
    for (const [k, v] of Object.entries(r)) {
      if (k === 'week') continue;
      const n = Number(v || 0);
      if (n > 0) m[k] = (m[k] || 0) + n;
    }
  }
  return m;
}

// ============================ 周报详细版 · 开户来源云图（echarts treemap） ============================
// 板块=渠道（应用市场/内容平台/直播），个股=版位/厂商/主播；色块面积与颜色均由开户数驱动。
function _trunc(n: string, m: number) {
  return n && n.length > m ? `${n.slice(0, m)}…` : n;
}

// 各渠道板块基色（RGB 三元组）：应用市场=蓝系 / 内容平台=红系 / 直播=靛蓝系 / 本地生活=绿系
const SECTOR_RGB: Record<string, [number, number, number]> = {
  '应用市场': [25, 118, 210],
  '内容平台': [192, 57, 43],
  '直播': [63, 81, 181],
  '本地生活': [46, 125, 50],
};

// 按占比把板块基色调深浅：ratio 0→基色原亮，1→加深约 55%
function _shade(rgb: [number, number, number], ratio: number): string {
  const k = 1 - 0.55 * Math.max(0, Math.min(1, ratio));
  const [r, g, b] = rgb.map((x) => Math.round(x * k));
  return `rgb(${r},${g},${b})`;
}

// 给板块下叶子递归补 value + 上色，返回带价值信息的树
function _tintLeaf(sec: { rgb: [number, number, number] }, nodes: any[], max: number): any[] {
  return nodes.map((n) => {
    if (n.children && n.children.length) {
      const kids = _tintLeaf(sec, n.children, max);
      const v = kids.reduce((s, k) => s + (k.value || 0), 0);
      return { name: n.name, value: v, children: kids, itemStyle: { color: _shade(sec.rgb, 0.22) } };
    }
    const v = n.value || 0;
    return { name: n.name, value: v, itemStyle: { color: _shade(sec.rgb, max ? v / max : 0) } };
  });
}

function buildCloudTree(scope: DetailScope, liveWeeklyAgg?: Record<string, number>): any[] {
  // 四个板块恒定输出（children 可为空），配合 buildCloudOption 的固定四象限布局，
  // 保证「本周 / 全年」两张云图同一板块永远在同一位置，可直接对照（空板块画占位块）
  // 板块内 children 按开户数降序，大块靠前，视觉顺序稳定

  // 内容平台（小红书/腾讯/抖音/云极/快手，yj 已归并入云极）：渠道 -> 平台 -> 厂商（非直播口径，直播独立板块）
  const contentChildren = scope.content_platform
    .map((pf) => {
      const facs = pf.factories.filter((f) => f.open_count > 0).map((f) => ({ name: f.factory, value: f.open_count }));
      if (!facs.length) return null;
      return { name: pf.platform, value: facs.reduce((s, x) => s + x.value, 0), children: facs };
    })
    .filter(Boolean) as any[];
  contentChildren.sort((a, b) => b.value - a.value);

  // 应用市场：渠道 -> 平台 -> 版位（计划往版位聚合，不展示计划名称）
  const appPlats = scope.app_market.filter(_appHasPlat);
  const appChildren = appPlats
    .map((pf) => {
      const placementMap: Record<string, number> = {};
      for (const p of pf.top_plans) {
        if (!_appHasPlanVal(p)) continue;
        const placements = p.versions && p.versions.some((v) => v && v !== '未分类')
          ? p.versions
          : ['未分类'];
        for (const v of placements) placementMap[v] = (placementMap[v] || 0) + p.open_count;
      }
      const leaves = Object.entries(placementMap).filter(([, v]) => v > 0).map(([name, v]) => ({ name, value: v }));
      if (!leaves.length) return null;
      return { name: pf.platform, value: leaves.reduce((s, x) => s + x.value, 0), children: leaves };
    })
    .filter(Boolean) as any[];
  appChildren.sort((a, b) => b.value - a.value);

  // 直播：渠道 -> 主播。口径与下方分周堆叠图严格一致：仅取非存量新开户数（new_opened）。
  // 全年云图传入 liveWeeklyAgg（由分周序列聚合而来，逐周求和），保证云图合计 = 堆叠图合计
  // （复合来源均分的 round 舍入使「全年一次聚合」与「逐周求和」存在系统性差异，不可混用）。
  const liveChildren = liveWeeklyAgg
    ? Object.entries(liveWeeklyAgg)
        .filter(([, v]) => v > 0)
        .map(([name, value]) => ({ name, value }))
    : scope.live
        .filter((a) => a.new_opened > 0)
        .map((a) => ({ name: a.anchor_name || '—', value: a.new_opened }));
  liveChildren.sort((a, b) => b.value - a.value);

  // 本地生活（高德）：独立板块
  const localLifeChildren = (scope.local_life || [])
    .filter((x) => x.open_count > 0)
    .map((x) => ({ name: x.platform, value: x.open_count }));
  localLifeChildren.sort((a, b) => b.value - a.value);

  const sectors = [
    { name: '内容平台', rgb: SECTOR_RGB['内容平台'], children: contentChildren },
    { name: '应用市场', rgb: SECTOR_RGB['应用市场'], children: appChildren },
    { name: '直播', rgb: SECTOR_RGB['直播'], children: liveChildren },
    { name: '本地生活', rgb: SECTOR_RGB['本地生活'], children: localLifeChildren },
  ];

  // 上色：叶子统一取同板块内最大 value 归一化深浅，深=贡献高；板块基色区分渠道
  return sectors.map((sec) => {
    const leafVals: number[] = [];
    const collect = (nodes: any[]) => nodes.forEach((n) => {
      if (n.children && n.children.length) collect(n.children);
      else if (n.value) leafVals.push(n.value);
    });
    collect(sec.children);
    const max = Math.max(1, ...leafVals);
    const value = sec.children.reduce((s: number, c: any) => s + (c.value || 0), 0);
    return { name: sec.name, value, children: _tintLeaf(sec, sec.children, max), itemStyle: { color: _shade(sec.rgb, 0.14) } };
  });
}

// 固定四象限分区（位置常量，不随数值变化）：左上=内容平台 / 右上=应用市场 / 左下=直播 / 右下=本地生活。
// 容器高 280px：上排 148px、下排 116px、行间 8px、四周 4px；左右各占 48.8% 宽、中缝 1.2%。
// 「本周 / 全年」两张云图使用同一份分区，保证同一板块永远在同一位置可对照。
const CLOUD_SECTOR_RECTS: Record<string, { left: string; top: number; width: string; height: number }> = {
  '内容平台': { left: '0.6%', top: 4, width: '48.8%', height: 148 },
  '应用市场': { left: '50.6%', top: 4, width: '48.8%', height: 148 },
  '直播': { left: '0.6%', top: 160, width: '48.8%', height: 116 },
  '本地生活': { left: '50.6%', top: 160, width: '48.8%', height: 116 },
};

function buildCloudOption(sectors: any[]): EChartsOption {
  const total = sectors.reduce((s, sec) => s + (sec.value || 0), 0);
  return {
    tooltip: {
      formatter: (p: any) => {
        const d = p.data || {};
        if (d.placeholder) return `${d.name}：暂无开户`;
        return `${d.name || ''}<br/><b>开户 ${fmtNum(d.value)}</b>${total ? ` · 占 ${_safePct(d.value, total)}` : ''}`;
      },
    },
    series: sectors.map((sec) => {
      const rect = CLOUD_SECTOR_RECTS[sec.name] || CLOUD_SECTOR_RECTS['内容平台'];
      const empty = !sec.children || !sec.children.length;
      // 空板块画纯白占位块（不显示任何文字），仅保持四象限位置感与两图可对照
      const root = empty
        ? {
            name: sec.name,
            value: 1,
            placeholder: true,
            itemStyle: { color: '#ffffff', borderColor: '#ffffff', borderWidth: 1 },
            label: { show: false },
          }
        : { name: sec.name, value: sec.value, children: sec.children, itemStyle: sec.itemStyle };
      return {
        type: 'treemap',
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        // 板块内顺序固定为 data 顺序（已按开户数降序），不随 treemap 默认排序重排
        sort: false,
        ...rect,
        // 每个板块一个独立 treemap（单根节点带 children，根节点 upperLabel 即板块名）
        data: [root],
        label: {
          show: true,
          formatter: (p: any) => (p.data && p.data.placeholder ? p.name : _trunc(p.name, 6)),
          fontSize: 9,
          color: '#fff',
        },
        upperLabel: {
          show: true,
          height: 16,
          fontSize: 9,
          fontWeight: 600,
          color: '#1a1a1a',
          padding: [2, 4],
          formatter: (p: any) => (p.name ? `${p.name} ${fmtNum(p.value)}` : ''),
        },
        itemStyle: { borderColor: '#fff', borderWidth: 1, gapWidth: 1 },
        // 颜色由 buildCloudTree 按「板块基色 + 个股占比深浅」显式赋值，不再用全局 colorMappingBy 染色
        levels: [
          // 板块根层级：只保留 upperLabel 作板块头，禁用自身 label（否则顶部多渲染一行数值）
          { itemStyle: { borderColor: '#fff', borderWidth: 2, gapWidth: 2 }, upperLabel: { height: 18 }, label: { show: false } },
          { itemStyle: { borderColor: '#fff', borderWidth: 1, gapWidth: 1 } },
          { itemStyle: { borderColor: '#fff', borderWidth: 1, gapWidth: 1 } },
        ],
        animationDurationUpdate: 300,
        animationEasing: 'cubicOut',
      };
    }),
  };
}

// 只要任一板块有实际开户数据即认为云图可渲染（四板块恒输出，需按 children 判断）
function cloudHasData(scope: DetailScope) {
  return buildCloudTree(scope).some((sec: any) => sec.children && sec.children.length);
}

function _safePct(num: number, den: number) {
  if (!den) return '0%';
  return `${Math.round((num / den) * 100)}%`;
}

// 开户来源云图（echarts treemap）；yearly=true 时直播板块改用分周序列聚合，与堆叠图对齐
function HeroCloudMap({ scope, title, yearly }: { scope: DetailScope; title: string; yearly?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.EChartsType | null>(null);

  const tree = useMemo(
    () => buildCloudTree(scope, yearly ? aggregateWeekly(scope.live_weekly || []) : undefined),
    [scope, yearly]
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!chartRef.current) chartRef.current = echarts.init(el);
    chartRef.current.setOption(buildCloudOption(tree), true);
  }, [tree]);

  useEffect(() => {
    const onR = () => chartRef.current?.resize();
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, []);

  useEffect(() => () => {
    chartRef.current?.dispose();
    chartRef.current = null;
  }, []);

  // tree 恒含四板块（children 可为空），只有全部板块都无数据时才整块隐藏
  if (!tree.some((s: any) => s.children && s.children.length)) return null;
  return (
    <div className={styles.cloudBlock}>
      <div className={styles.dSubTitle}>{title}</div>
      <div ref={ref} className={styles.cloudMap} />
    </div>
  );
}

// ============================ 应用市场：平台消耗排行 ============================
// yearly=true 时渲染「全年分周开户堆叠图」（分周序列为全年口径，仅在全年累计块渲染一次）
function AppMktSection({ scope, yearly }: { scope: DetailScope; yearly?: boolean }) {
  const platforms = scope.app_market.filter(_appHasPlat);
  if (platforms.length === 0) return null;

  const totalSpend = platforms.reduce((s, p) => s + p.spend, 0);
  const totalOpen = platforms.reduce((s, p) => s + p.open_count, 0);
  const totalActivated = platforms.reduce((s, p) => s + (p.activated || 0), 0);
  const totalAssets = platforms.reduce((s, p) => s + (p.assets || 0), 0);

  return (
    <div className={styles.vBlock}>
      <PosterKpi
        items={[
          { label: '消耗', value: fmtMoney(totalSpend) },
          { label: '开户', value: fmtNum(totalOpen) },
          { label: '获客成本', value: totalOpen ? fmtMoney(totalSpend / totalOpen) : '—' },
          { label: '下载激活', value: fmtNum(totalActivated) },
          { label: '激活→开户', value: totalActivated ? `${((totalOpen / totalActivated) * 100).toFixed(1)}%` : '—' },
          { label: '资产', value: `¥${fmtLarge(totalAssets)}` },
        ]}
      />
      {yearly && (
        <div className={styles.vCol}>
          <div className={styles.vColTitle}>全年开户数 · 按平台分周堆叠</div>
          <WeeklyChart rows={scope.app_market_weekly || []} colorBase={BLUE_BASE} />
        </div>
      )}
    </div>
  );
}

// ============================ 内容平台：线索/开户 KPI + 分周开户堆叠 ============================
function ContentSection({ scope, yearly }: { scope: DetailScope; yearly?: boolean }) {
  const platforms = scope.content_platform.filter(_ctHasPlat);
  if (platforms.length === 0) return null;
  const totalLead = platforms.reduce((s, p) => s + p.lead_count, 0);
  const totalOpen = platforms.reduce((s, p) => s + p.open_count, 0);
  const convRate = totalLead ? (totalOpen / totalLead) * 100 : 0;

  return (
    <div className={styles.vBlock}>
      <PosterKpi
        items={[
          // 线索为 0 的平台不占小卡片（如部分周次无线索的云极），仅保留在合计口径中
          ...platforms.filter((p) => p.lead_count > 0).map((p) => ({ label: `${p.platform}线索`, value: fmtNum(p.lead_count) })),
          { label: '线索合计', value: fmtNum(totalLead) },
          { label: '开户合计', value: fmtNum(totalOpen) },
          { label: '开户转化率', value: `${convRate.toFixed(1)}%` },
        ]}
      />
      {yearly && (
        <div className={styles.vCol}>
          <div className={styles.vColTitle}>全年开户数 · 按平台分周堆叠</div>
          <WeeklyChart rows={scope.content_weekly || []} colorBase={RED_BASE} />
        </div>
      )}
    </div>
  );
}

// ============================ 直播：主播 开户排行 ============================
function LiveSection({ scope, yearly }: { scope: DetailScope; yearly?: boolean }) {
  const anchors = scope.live.filter(_hasAnchor);
  if (anchors.length === 0) return null;
  // 开户合计与分周堆叠图同源：全年块用分周序列聚合（round 舍入下 ≠ 全年一次聚合），
  // 本周块用本周明细（与分周序列中本周那行口径一致）
  const totalOpened = yearly
    ? Object.values(aggregateWeekly(scope.live_weekly || [])).reduce((s, v) => s + v, 0)
    : anchors.reduce((s, a) => s + a.new_opened, 0);
  const totalValid = anchors.reduce((s, a) => s + a.new_valid, 0);
  const totalAssets = anchors.reduce((s, a) => s + a.new_assets, 0);

  return (
    <div className={styles.vBlock}>
      <PosterKpi
        items={[
          { label: '主播数', value: fmtNum(anchors.length) },
          { label: '开户合计', value: fmtNum(totalOpened) },
          { label: '有效户合计', value: fmtNum(totalValid) },
          { label: '新增资产', value: `¥${fmtLarge(totalAssets)}` },
        ]}
      />
      {yearly && (
        <div className={styles.vCol}>
          <div className={styles.vColTitle}>全年开户数 · 按主播分周堆叠</div>
          <WeeklyChart rows={scope.live_weekly || []} colorBase={INDIGO_BASE} height={210} />
        </div>
      )}
    </div>
  );
}

// ============================ 本地生活：平台开户 + 全年分周堆叠 ============================
function LocalLifeSection({ scope, yearly }: { scope: DetailScope; yearly?: boolean }) {
  const items = (scope.local_life || []).filter((i) => i.open_count > 0);
  if (items.length === 0) return null;
  const totalOpen = items.reduce((s, i) => s + i.open_count, 0);
  return (
    <div className={styles.vBlock}>
      <PosterKpi
        items={[
          ...items.map((i) => ({ label: `${i.platform}开户`, value: fmtNum(i.open_count) })),
          { label: '开户合计', value: fmtNum(totalOpen) },
        ]}
      />
      {yearly && (
        <div className={styles.vCol}>
          <div className={styles.vColTitle}>全年开户数 · 按平台分周堆叠</div>
          <WeeklyChart rows={scope.local_life_weekly || []} colorBase={GREEN_BASE} />
        </div>
      )}
    </div>
  );
}

/*
 * （旧版三张明细表已废弃，见 git 历史）
 * function DetailAppMarketTable/DetailContentTable/DetailLiveTable
 */

function DetailPoster({ data }: { data: WeeklyDetailData }) {
  const { period, current_week, year_to_date } = data;
  const hasApp = (s: DetailScope) => s.app_market.some(_appHasPlat);
  const hasContent = (s: DetailScope) => s.content_platform.some(_ctHasPlat);
  const hasLive = (s: DetailScope) => s.live.some(_hasAnchor);
  const hasLocalLife = (s: DetailScope) => s.local_life.some((i) => i.open_count > 0);

  return (
    <>
      {/* 刊头 */}
      <header className={styles.masthead}>
        <div className={styles.kicker}>WEEKLY REPORT · DETAIL · 互联网渠道</div>
        <h1 className={styles.headline}>互联网渠道周报 · 详细</h1>
        <div className={styles.dateline}>
          {fmtDate(period.start_date)} — {fmtDate(period.end_date)} · {period.report_name}
        </div>
      </header>

      {/* 0. 开户来源云图（板块=渠道，个股=版位/厂商/主播；面积+颜色=开户数；板块位置固定四象限，两图可直接对照） */}
      {(cloudHasData(current_week) || cloudHasData(year_to_date)) && (
        <section className={styles.layerCard}>
          <div className={styles.layerHeader}>
            <span className={styles.layerTitle}>开户来源云图</span>
            <span className={styles.layerTag}>板块位置固定 · 面积与颜色 = 开户数 · 深色=贡献高</span>
          </div>
          <HeroCloudMap scope={current_week} title="本周开户来源" />
          <HeroCloudMap scope={year_to_date} title="全年开户来源" yearly />
        </section>
      )}

      {/* 1. 应用市场：消耗/开户/获客成本 + 全年分周开户堆叠 */}
      {(hasApp(current_week) || hasApp(year_to_date)) && (
        <section className={styles.layerCard}>
          <div className={styles.layerHeader}>
            <span className={styles.layerTitle}>应用市场 · 平台获客</span>
            <span className={styles.layerTag}>开户·按资金账号创建完成时间</span>
          </div>
          <div className={styles.dSubTitle}>本周</div>
          <AppMktSection scope={current_week} />
          <div className={styles.dSubTitle}>全年累计</div>
          <AppMktSection scope={year_to_date} yearly />
        </section>
      )}

      {/* 2. 内容平台：线索/开户 KPI + 全年分周开户堆叠 */}
      {(hasContent(current_week) || hasContent(year_to_date)) && (
        <section className={styles.layerCard}>
          <div className={styles.layerHeader}>
            <span className={styles.layerTitle}>内容平台 · 线索与开户</span>
            <span className={styles.layerTag}>线索 · 企微数 / 开户 · 非直播口径</span>
          </div>
          <div className={styles.dSubTitle}>本周</div>
          <ContentSection scope={current_week} />
          <div className={styles.dSubTitle}>全年累计</div>
          <ContentSection scope={year_to_date} yearly />
        </section>
      )}

      {/* 3. 直播：主播开户/有效户/资产 KPI + 全年分周开户堆叠 */}
      {(hasLive(current_week) || hasLive(year_to_date)) && (
        <section className={styles.layerCard}>
          <div className={styles.layerHeader}>
            <span className={styles.layerTitle}>直播 · 主播获客</span>
            <span className={styles.layerTag}>复合来源按主播数均分 · 非存量新客</span>
          </div>
          <div className={styles.dSubTitle}>本周</div>
          <LiveSection scope={current_week} />
          <div className={styles.dSubTitle}>全年累计</div>
          <LiveSection scope={year_to_date} yearly />
        </section>
      )}

      {/* 4. 本地生活：平台开户 + 全年分周开户堆叠 */}
      {(hasLocalLife(current_week) || hasLocalLife(year_to_date)) && (
        <section className={styles.layerCard}>
          <div className={styles.layerHeader}>
            <span className={styles.layerTitle}>本地生活 · 平台开户</span>
            <span className={styles.layerTag}>高德 · 开户按开户成功时间</span>
          </div>
          <div className={styles.dSubTitle}>本周</div>
          <LocalLifeSection scope={current_week} />
          <div className={styles.dSubTitle}>全年累计</div>
          <LocalLifeSection scope={year_to_date} yearly />
        </section>
      )}
    </>
  );
}

const ReportGeneration: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption | null>(null);
  const [periodOptions, setPeriodOptions] = useState<PeriodOption[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyData | null>(null);
  const [detailData, setDetailData] = useState<WeeklyDetailData | null>(null);
  const [mode, setMode] = useState<ReportMode>('overview');
  const [detailLoading, setDetailLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [periodsLoading, setPeriodsLoading] = useState(true);
  const [exporting, setExporting] = useState<'png' | 'pdf' | null>(null);

  const posterRef = useRef<HTMLDivElement>(null);
  const posterDetailRef = useRef<HTMLDivElement>(null);
  const opensChartRef = useRef<HTMLDivElement>(null);
  const yearlyChartRef = useRef<HTMLDivElement>(null);
  const opensChartInstanceRef = useRef<EChartsType | null>(null);
  const yearlyChartInstanceRef = useRef<EChartsType | null>(null);

  // 加载报告期选项
  const loadWeekOptions = useCallback(async () => {
    try {
      setPeriodsLoading(true);
      // feat-local-auth：用 http 客户端自动带 Authorization 头，避免 401
      const resp = await http.get<PeriodOption[]>('/reports/weekly/periods');
      if (resp.success && resp.data) {
        setPeriodOptions(resp.data);
        const first = resp.data.find((o) => !o.disabled);
        if (first) {
          setSelectedPeriod(first);
          handleLoadData(first);
        }
      } else {
        message.error(resp.message || '加载报告期失败');
      }
    } catch (error) {
      console.error('加载报告期失败:', error);
      message.error('加载报告期失败');
    } finally {
      setPeriodsLoading(false);
    }
  }, []);

  // 加载周报数据
  const handleLoadData = useCallback(async (period: PeriodOption) => {
    if (!period) return;
    try {
      setLoading(true);
      // feat-local-auth：用 http 客户端自动带 Authorization 头
      const resp = await http.post<WeeklyData>('/reports/weekly/data', {
        report_year: period.report_year,
        report_week: period.report_week,
      });
      if (resp.success && resp.data) {
        setWeeklyData(resp.data);
      } else {
        message.error(resp.error || '生成周报失败');
      }
    } catch (error) {
      console.error('生成周报失败:', error);
      message.error('生成周报失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWeekOptions();
  }, [loadWeekOptions]);

  // 记录 detailData 对应的报告期，避免切换 Tab 时重复请求
  const detailForRef = useRef<string | null>(null);

  // 加载周报详细版数据
  const loadDetailData = useCallback(async (period: PeriodOption) => {
    if (!period) return;
    try {
      setDetailLoading(true);
      const resp = await http.post<WeeklyDetailData>('/reports/weekly/detail', {
        report_year: period.report_year,
        report_week: period.report_week,
      });
      if (resp.success && resp.data) {
        setDetailData(resp.data);
        detailForRef.current = period.value;
      } else {
        message.error(resp.error || '生成周报详细版失败');
      }
    } catch (error) {
      console.error('生成周报详细版失败:', error);
      message.error('生成周报详细版失败');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // 切换详细版 Tab 时，若当前报告期的详细数据尚未加载则补拉
  useEffect(() => {
    if (mode === 'detail' && selectedPeriod && (!detailData || detailForRef.current !== selectedPeriod.value)) {
      loadDetailData(selectedPeriod);
    }
  }, [mode, selectedPeriod, detailData, loadDetailData]);

  // 渲染开户数 · 本周内按日堆叠柱状图
  useEffect(() => {
    if (!weeklyData || !opensChartRef.current) return;
    if (opensChartInstanceRef.current) {
      opensChartInstanceRef.current.dispose();
      opensChartInstanceRef.current = null;
    }
    const chart = echarts.init(opensChartRef.current);
    opensChartInstanceRef.current = chart;

    const dates = weeklyData.daily_opens_stacked.map((d) => fmtDate(String(d.date)));
    const channels = sortChannelsByCategory(weeklyData.channels, CHANNEL_CATEGORY_MAP);
    const colorMap = buildChannelColorMap(channels);

    const option: EChartsOption = {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: compactStackTooltip },
      legend: { show: false },
      grid: { top: 8, left: 36, right: 16, bottom: 24, containLabel: true },
      xAxis: { type: 'category', data: dates, axisLabel: { fontSize: 9, rotate: dates.length > 7 ? 30 : 0 } },
      yAxis: { type: 'value', axisLabel: { fontSize: 9 } },
      series: channels.map((ch) => ({
        name: ch,
        type: 'bar',
        stack: 'opens',
        barMaxWidth: 36,
        emphasis: { focus: 'series' },
        data: weeklyData.daily_opens_stacked.map((d) => Number(d[ch] || 0)),
        itemStyle: { color: colorMap[ch] || '#999' },
      })),
    };
    chart.setOption(option);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
      opensChartInstanceRef.current = null;
    };
  }, [weeklyData]);

  // 渲染开户数 · 年内按周次堆叠柱状图（参考厂商分析报表样式）
  useEffect(() => {
    if (!weeklyData || !yearlyChartRef.current) return;
    if (yearlyChartInstanceRef.current) {
      yearlyChartInstanceRef.current.dispose();
      yearlyChartInstanceRef.current = null;
    }
    const chart = echarts.init(yearlyChartRef.current);
    yearlyChartInstanceRef.current = chart;

    const weeks = weeklyData.weekly_opens_stacked.map((d) => String(d.week));
    const channels = sortChannelsByCategory(weeklyData.channels, CHANNEL_CATEGORY_MAP);
    const colorMap = buildChannelColorMap(channels);

    const option: EChartsOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', label: { backgroundColor: '#6a7985' } },
        formatter: compactStackTooltip,
      },
      legend: { show: false },
      grid: { left: '3%', right: '4%', bottom: '8%', top: '5%', containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: true,
        data: weeks,
        axisLabel: { fontSize: 9, rotate: weeks.length > 12 ? 30 : 0 },
      },
      yAxis: {
        type: 'value',
        name: '开户数',
        nameTextStyle: { fontSize: 11, color: '#8a8d99' },
        axisLabel: {
          fontSize: 9,
          formatter: (v: number) => (v >= 10000 ? `${(v / 10000).toFixed(1)}w` : v.toFixed(0)),
        },
      },
      series: channels.map((ch) => ({
        name: ch,
        type: 'bar',
        stack: '总量',
        barMaxWidth: 36,
        emphasis: { focus: 'series' },
        data: weeklyData.weekly_opens_stacked.map((d) => Number(d[ch] || 0)),
        itemStyle: { color: colorMap[ch] || '#999' },
      })),
    };
    chart.setOption(option);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
      yearlyChartInstanceRef.current = null;
    };
  }, [weeklyData]);

  // 处理报告期选择
  const handlePeriodChange = useCallback(
    (value: string) => {
      const option = periodOptions.find((opt) => opt.value === value);
      if (option) {
        setSelectedPeriod(option);
        handleLoadData(option);
      }
    },
    [periodOptions, handleLoadData]
  );

  // 动态加载 jspdf
  const loadJsPdf = async () => (await import('jspdf')).jsPDF;

  // 当前 Tab 对应海报容器与导出名称后缀
  const activePosterRef = mode === 'detail' ? posterDetailRef : posterRef;
  const exportSuffix = mode === 'detail' ? '详细版' : '';

  // 导出 PNG
  const handleExportPNG = async () => {
    if (!activePosterRef.current) {
      message.error('海报容器未找到');
      return;
    }
    setExporting('png');
    try {
      // v3.5.8：改用 modern-screenshot 替代 html2canvas
      //   html2canvas 在 Android WebView 下对 inline-flex / flex gap 支持不完善，
      //   导致周报表格列与文字重叠；modern-screenshot 基于 SVG foreignObject，
      //   使用浏览器原生渲染，对现代 CSS 完整支持。
      const canvas = await captureElement(activePosterRef.current!, {
        scale: 2,
        backgroundColor: '#ffffff',
      });
      if (canvas.width === 0) {
        throw new Error('画布尺寸异常，请检查浏览器窗口是否过窄');
      }
      const imageUrl = canvas.toDataURL('image/png');
      // v3.5.5：统一走 saveBlobFile，移动端写 Documents 目录避免 WebView 拦截 <a download>
      const fileName = `互联网渠道周报${exportSuffix}_${selectedPeriod?.report_year}W${selectedPeriod?.report_week}.png`;
      const savedUri = await saveBlobFile({ filename: fileName, data: imageUrl });
      message.success(savedUri ? buildMobileSaveMessage(fileName, savedUri) : 'PNG 导出成功');
    } catch (error) {
      console.error('导出 PNG 失败:', error);
      message.error(`导出 PNG 失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setExporting(null);
    }
  };

  // 导出 PDF
  const handleExportPDF = async () => {
    if (!activePosterRef.current) {
      message.error('海报容器未找到');
      return;
    }
    setExporting('pdf');
    try {
      const jsPDF = await loadJsPdf();
      // v3.5.8：改用 modern-screenshot 替代 html2canvas（同 handleExportPNG）
      const canvas = await captureElement(activePosterRef.current!, {
        scale: 2,
        backgroundColor: '#ffffff',
      });
      if (canvas.width === 0) {
        throw new Error('画布尺寸异常');
      }
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const pdfWidth = 210;
      const pdfHeight = (imgHeight / imgWidth) * pdfWidth;
      const pdf = new jsPDF({
        orientation: pdfHeight > pdfWidth ? 'portrait' : 'landscape',
        unit: 'mm',
        format: [pdfWidth, pdfHeight],
      });
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      // v3.5.5：移动端 pdf.save() 走 <a download> 会被 WebView 拦截，改用 datauristring + saveBlobFile
      const fileName = `互联网渠道周报${exportSuffix}_${selectedPeriod?.report_year}W${selectedPeriod?.report_week}.pdf`;
      const pdfDataUrl = pdf.output('datauristring');
      const savedUri = await saveBlobFile({ filename: fileName, data: pdfDataUrl });
      message.success(savedUri ? buildMobileSaveMessage(fileName, savedUri) : 'PDF 导出成功');
    } catch (error) {
      console.error('导出 PDF 失败:', error);
      message.error(`导出 PDF 失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className={styles.container}>
      {/* 左侧控制面板 */}
      <FadeInSection delay={0} duration={0.8}>
      <div className={styles.controlPanel}>
        <div className={styles.panelHeader}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>
              <SettingOutlined style={{ color: 'var(--color-brand)', marginRight: 8 }} />
              报告配置
            </span>
          </div>
        </div>

        <div className={styles.panelBody}>
          <div className={styles.controlGroup}>
            <label className={styles.controlLabel}>报告期</label>
            <Select
              className={styles.periodSelect}
              placeholder="请选择报告期"
              value={selectedPeriod?.value}
              onChange={handlePeriodChange}
              loading={periodsLoading}
              options={periodOptions.map((opt) => ({
                value: opt.value,
                label: opt.disabled ? `${opt.label} - ${opt.disabled_reason}` : opt.label,
                disabled: opt.disabled,
              }))}
            />
            {selectedPeriod && (
              <div className={styles.periodInfo}>
                <span className={styles.periodDate}>{selectedPeriod.date_range}</span>
                <span className={styles.periodSequence}>全年第{selectedPeriod.sequence}次周报</span>
              </div>
            )}
          </div>

          <div className={styles.controlGroup}>
            <label className={styles.controlLabel}>导出格式</label>
            <div className={styles.controlActions}>
              <Button
                icon={<FileImageOutlined />}
                onClick={handleExportPNG}
                loading={exporting === 'png'}
                disabled={!weeklyData}
                block
              >
                导出 PNG
              </Button>
              <Button
                icon={<FilePdfOutlined />}
                onClick={handleExportPDF}
                loading={exporting === 'pdf'}
                disabled={!weeklyData}
                block
              >
                导出 PDF
              </Button>
            </div>
          </div>
        </div>
      </div>
      </FadeInSection>

      {/* 右侧预览画布 */}
      <FadeInSection delay={0.4} duration={0.8}>
      <div className={styles.previewPanel}>
        <div className={styles.previewHeader}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>
              <EyeOutlined style={{ color: 'var(--color-brand)', marginRight: 8 }} />
              报告预览
            </span>
          </div>
          <Segmented
            options={[
              { label: '概览', value: 'overview' },
              { label: '详细', value: 'detail' },
            ]}
            value={mode}
            onChange={(v) => setMode(v as ReportMode)}
          />
        </div>

        <div className={styles.previewCanvas}>
          {loading ? (
            <div className={styles.previewPlaceholder}>
              <Spin size="large" />
              <span>正在生成周报...</span>
            </div>
          ) : mode === 'detail' ? (
            detailLoading && !detailData ? (
              <div className={styles.previewPlaceholder}>
                <Spin size="large" />
                <span>正在生成周报详细版...</span>
              </div>
            ) : detailData ? (
              <div className={styles.reportScroll}>
                <div ref={posterDetailRef} className={styles.reportPageDetail}>
                  <DetailPoster data={detailData} />
                </div>
                <footer className={styles.reportFooter}>
                  <div className={styles.footerLabel}>Notes · 数据说明</div>
                  <ul>
                    <li>开户来源云图：板块=渠道（内容平台→应用市场→直播→本地生活，顺序固定），个股=厂商/版位/主播/渠道；面积与颜色=开户数；本地生活=高德单独一类；直播板块仅统计非存量新开户（与主播分周堆叠图口径一致）</li>
                    <li>应用市场：云图/消耗/获客成本按 平台→广告计划 聚合，开户按【资金账号创建完成时间】过滤（是否创建完资金账号=1 AND 渠道类型=互联网引流 AND 是否新开户=1）；全年分周堆叠图 x=周次、系列=平台、值=开户数（agg_daily_channel_open 互联网引流口径）；两底表（开户成功 vs 资金账号创建完成）存在少量天然差异</li>
                    <li>内容平台（小红书/腾讯/抖音/云极/快手）：线索=企微数（fact_conv_content）且剔除直播线索（客户来源命中「(平台)引流-主播」或主播映射纯人名），开户消耗来自 agg_vendor_daily 且仅取非直播（业务模式 != '直播'），与直播板块不重不漏；分周堆叠图为渠道名口径（含直播场景开户，直播另列板块），故堆叠图合计略大于云图非直播口径；BI 侧临时口径：yj 统一归并为云极，小红书/抖音/腾讯白名单外厂商并入未归因</li>
                    <li>直播：主播聚类，复合来源按匹配主播数均分（与主播聚类明细口径一致），开户/有效户/资产均取非存量（新客方向）；全年分周堆叠图 x=周次、系列=主播（Top5+其他）、值=开户数</li>
                    <li>本周为报告期（上周五至本周四），全年累计为年初至周末；分周堆叠图仅在全年累计块渲染（全年口径，本周块只看 KPI）</li>
                  </ul>
                </footer>
              </div>
            ) : (
              <div className={styles.previewPlaceholder}>
                <FilePdfOutlined style={{ fontSize: 64, color: 'var(--color-text-tertiary)' }} />
                <span>选择报告期自动生成周报详细版</span>
              </div>
            )
          ) : weeklyData ? (
            <div className={styles.reportScroll}>
              <div ref={posterRef} className={styles.reportPage}>
                {/* 刊头 */}
                <header className={styles.masthead}>
                  <div className={styles.kicker}>WEEKLY REPORT · 互联网渠道</div>
                  <h1 className={styles.headline}>互联网渠道周报</h1>
                  <div className={styles.dateline}>
                    {fmtDate(weeklyData.period.start_date)} — {fmtDate(weeklyData.period.end_date)} ·{' '}
                    {weeklyData.period.report_name}
                  </div>
                </header>

                {/* 1. 核心指标：本周 + 全年累计（环比作为本周数字旁的小字角标，弱化视觉） */}
                <section className={styles.layerCard}>
                  <div className={styles.layerHeader}>
                    <span className={styles.layerTitle}>核心指标</span>
                    <div className={styles.kpiRow}>
                      <KpiRing label="开户数" rate={weeklyData.kpi.opens.rate} />
                      <KpiRing label="有效户" rate={weeklyData.kpi.valid.rate} />
                      <KpiRing label="资产" rate={weeklyData.kpi.assets.rate} />
                    </div>
                  </div>
                  <table className={styles.metricTable}>
                    <colgroup>
                      <col />
                      <col />
                      <col />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>指标</th>
                        <th>本周</th>
                        <th>全年累计</th>
                      </tr>
                    </thead>
                    <tbody>
                      {METRICS.map((m) => {
                        const cw = weeklyData.current_week[m.key];
                        const ytd = weeklyData.year_to_date[m.key];
                        const wow = weeklyData.week_over_week[m.key];
                        const wowFmt = fmtWow(wow);
                        return (
                          <tr key={m.key} data-row-type={m.rowType}>
                            <td className={styles.cellName}>{m.label}</td>
                            <td className={styles.cellNum}>
                              <span className={styles.cellWithWow}>
                                <span className={styles.cellMain}>{m.fmt(cw)}</span>
                                <span
                                  className={styles.wowSup}
                                  data-positive={wowFmt.positive === null ? 'na' : wowFmt.positive ? 'up' : 'down'}
                                >
                                  {wowFmt.text}
                                </span>
                              </span>
                            </td>
                            <td className={styles.cellNum}>{m.fmt(ytd)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </section>

                {/* 2. 互联网渠道占公司开户占比 */}
                <section className={styles.layerCard}>
                  <div className={styles.layerHeader}>
                    <span className={styles.layerTitle}>互联网渠道占公司开户占比</span>
                    <span className={styles.layerTag}>互联网引流 / 全渠道类别</span>
                  </div>
                  <table className={styles.ratioTable}>
                    <colgroup>
                      <col />
                      <col />
                      <col />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>指标</th>
                        <th>本周</th>
                        <th>全年累计</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className={styles.cellName}>开户占比</td>
                        <td className={styles.cellNum}>{weeklyData.internet_ratio.opens_ratio.toFixed(2)}%</td>
                        <td className={styles.cellNum}>{weeklyData.internet_ratio.year_opens_ratio.toFixed(2)}%</td>
                      </tr>
                      <tr>
                        <td className={styles.cellName}>有效户占比</td>
                        <td className={styles.cellNum}>{weeklyData.internet_ratio.valid_ratio.toFixed(2)}%</td>
                        <td className={styles.cellNum}>{weeklyData.internet_ratio.year_valid_ratio.toFixed(2)}%</td>
                      </tr>
                    </tbody>
                  </table>
                </section>

                {/* 3. 开户数 · 本周按日 */}
                <section className={styles.layerCard}>
                  <div className={styles.layerHeader}>
                    <span className={styles.layerTitle}>开户数 · 本周</span>
                    <div className={styles.catLegend}>
                      {['内容平台', '应用市场', '本地生活'].map((cat) => (
                        <span key={cat} className={styles.catLegendItem}>
                          <span
                            className={styles.catLegendDot}
                            style={{ background: CATEGORY_REP_COLORS[cat] }}
                          />
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div ref={opensChartRef} className={styles.chartBox} />
                </section>

                {/* 4. 开户数 · 全年按周次 */}
                <section className={styles.layerCard}>
                  <div className={styles.layerHeader}>
                    <span className={styles.layerTitle}>开户数 · 全年</span>
                    <div className={styles.catLegend}>
                      {['内容平台', '应用市场', '本地生活'].map((cat) => (
                        <span key={cat} className={styles.catLegendItem}>
                          <span
                            className={styles.catLegendDot}
                            style={{ background: CATEGORY_REP_COLORS[cat] }}
                          />
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div ref={yearlyChartRef} className={styles.chartBox} />
                </section>
              </div>

              {/* 数据说明（海报外） */}
              <footer className={styles.reportFooter}>
                <div className={styles.footerLabel}>Notes · 数据说明</div>
                <ul>
                  <li>消耗金额 / 品牌曝光 / APP激活数：来自 agg_vendor_daily（广告投放日聚合）</li>
                  <li>企微数：来自 fact_conv_content COUNT（内容平台线索明细，1 行=1 企微）</li>
                  <li>开户数（应用市场 / 其他渠道 / 合计）：来自 agg_daily_channel_open，仅统计渠道类别=互联网引流；按渠道名称拆分（应用市场大类：华为/荣耀/小米/oppo/vivo/苹果/鸿蒙，其余为其他渠道），与堆叠图口径一致</li>
                  <li>新增客户资产：内容平台 fact_conv_content（是否开户=1 AND 非存量）+ 应用市场 fact_conv_appmarket（是否新开户=1 AND 渠道类型=互联网引流）</li>
                  <li>全年累计：年初至周末；环比：与上一周对比</li>
                  <li>互联网渠道占公司开户占比：互联网引流 / 全渠道类别（互联网引流+合作机构+员工开户+自然流入），分本周与全年累计两个口径</li>
                  <li>年度 KPI 完成率：年初至今实际值 / (年度目标 × 时间进度)，时间进度 = 当前周末日 / 全年天数（{weeklyData?.kpi?.time_progress.toFixed(0)}%）；目标：开户数 2 万、有效户 1 万、资产 5 亿</li>
                  <li>两图均为开户数堆叠（按渠道分色，内容平台红色系/应用市场蓝色系/本地生活绿色系，同大类渠道挨在一起）：上图本周按日，下图全年按周次</li>
                </ul>
              </footer>
            </div>
          ) : (
            <div className={styles.previewPlaceholder}>
              <FilePdfOutlined style={{ fontSize: 64, color: 'var(--color-text-tertiary)' }} />
              <span>选择报告期自动生成周报</span>
            </div>
          )}
        </div>
      </div>
      </FadeInSection>
    </div>
  );
};

export default ReportGeneration;
