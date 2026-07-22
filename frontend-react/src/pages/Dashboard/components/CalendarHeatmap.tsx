import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Spin, Space } from "antd";
import styles from "./CalendarHeatmap.module.scss";

interface CalendarHeatmapProps {
  data: { date: string; value: number }[];
  loading?: boolean;
  days?: number;
}

const WEEK_LABELS = ["一", "二", "三", "四", "五", "六", "日"];
const MONTH_LABELS = [
  "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月",
];

// feat-desktop-heatmap: cell 自适应计算参数
// - 53 周 × 7 天 ≈ 1 列 = 1 周，cell 必须能放进容器内
// - 减去 40px 周几 label 列 + 左右内边距 + gap 余量
// - cell 必须 ≥ 4px（cell 渲染最小阈值）；过大限制到 24px（避免占用过大空白）
const CELL_GAP = 3;       // 与 .grid gap 一致
const LABEL_COL_WIDTH = 40;
const SAFE_PADDING = 16;  // 容器内左右 padding 预留
const MIN_CELL = 6;
const MAX_CELL = 22;
const DEFAULT_CELL = 14;  // 容器宽度尚未量出时的兜底值

function calcCellSize(containerWidth: number, totalWeeks: number): number {
  if (!containerWidth || totalWeeks <= 0) return DEFAULT_CELL;
  // 实际可用于 cell+gap 的横向空间 = 容器 - label 列 - padding
  const usable = containerWidth - LABEL_COL_WIDTH - SAFE_PADDING;
  // 总列宽 = totalWeeks × cellSize + (totalWeeks - 1) × gap
  // => cellSize = (usable - (totalWeeks - 1) × gap) / totalWeeks
  const raw = (usable - (totalWeeks - 1) * CELL_GAP) / totalWeeks;
  const clamped = Math.max(MIN_CELL, Math.min(MAX_CELL, raw));
  return Math.floor(clamped);
}

const CalendarHeatmap: React.FC<CalendarHeatmapProps> = ({ data, loading, days = 365 }) => {
  // feat-desktop-heatmap: 监听 .wrap 容器宽度，动态算 cell size
  const wrapRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const map = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of data || []) m.set(r.date, r.value || 0);
    return m;
  }, [data]);

  // v3.1.10: 年度统计起点对齐 2026-01-01
  // max / activeDays 取 365 天全量（用于 level 颜色分类）
  // sum 仅累加 2026-01-01 及之后的值（年度总开户）
  const YEAR_START = '2026-01-01';
  const stats = useMemo(() => {
    const entries = Array.from(map.entries());
    if (entries.length === 0) return { max: 0, sum: 0, activeDays: 0 };
    const allValues = entries.map(([, v]) => v);
    const yearValues = entries.filter(([date]) => date >= YEAR_START).map(([, v]) => v);
    return {
      max: Math.max(...allValues, 0),
      sum: yearValues.reduce((s, v) => s + v, 0),
      activeDays: allValues.filter((v) => v > 0).length,
    };
  }, [map]);

  const layout = useMemo(() => {
    const arr: {
      date: string; value: number; level: number; isFuture: boolean;
      weekIdx: number; dayIdx: number;
    }[] = [];
    const today = new Date();
    const endD = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const start = new Date(endD);
    start.setDate(endD.getDate() - (days - 1));
    const startDow = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - startDow);
    const totalDays = Math.floor((endD.getTime() - start.getTime()) / 86400000) + 1;
    const totalWeeks = Math.ceil(totalDays / 7);
    for (let i = 0; i < totalWeeks * 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      const isFuture = d.getTime() > endD.getTime();
      const v = isFuture ? 0 : (map.get(dateStr) || 0);
      let level = 0;
      if (v > 0) {
        const ratio = stats.max > 0 ? v / stats.max : 0;
        if (ratio > 0.75) level = 4;
        else if (ratio > 0.5) level = 3;
        else if (ratio > 0.25) level = 2;
        else level = 1;
      }
      arr.push({
        date: dateStr, value: v, level, isFuture,
        weekIdx: Math.floor(i / 7),
        dayIdx: i % 7,
      });
    }
    const monthLabels: { weekIdx: number; label: string }[] = [];
    let lastMonth = -1;
    for (let w = 0; w < totalWeeks; w++) {
      const c = arr[w * 7];
      if (!c) continue;
      const m = parseInt(c.date.slice(5, 7), 10) - 1;
      if (m !== lastMonth) {
        monthLabels.push({ weekIdx: w, label: MONTH_LABELS[m] });
        lastMonth = m;
      }
    }
    return { arr, totalWeeks, monthLabels };
  }, [days, map, stats.max]);

  return (
    <Spin spinning={loading}>
      <div
        className={styles.wrap}
        ref={wrapRef}
        style={{ '--cell-size': `${calcCellSize(containerWidth, layout.totalWeeks)}px` } as React.CSSProperties}
      >
        <div className={styles.statsRow}>
          <Space size={20} wrap>
            <span className={styles.stat}>
              <b>{stats.sum.toLocaleString()}</b> 年度总开户
            </span>
            <span className={styles.stat}>
              <b>{stats.activeDays}</b> 个有数据日
            </span>
            <span className={styles.stat}>
              <b>{stats.max.toLocaleString()}</b> 单日最高
            </span>
          </Space>
        </div>

        <div className={styles.body}>
          <div
            className={styles.monthRow}
            style={{ gridTemplateColumns: `40px repeat(${layout.totalWeeks}, var(--cell-size, 18px))` }}
          >
            <span />
            {layout.monthLabels.map((m, i) => (
              <span
                key={`${m.weekIdx}-${i}`}
                className={styles.monthLabel}
                style={{ gridColumnStart: m.weekIdx + 2 }}
              >
                {m.label}
              </span>
            ))}
          </div>

          <div
            className={styles.grid}
            style={{ gridTemplateColumns: `40px repeat(${layout.totalWeeks}, var(--cell-size, 18px))` }}
          >
            <div className={styles.weekLabelsCol}>
              {WEEK_LABELS.map((w, i) => (
                <span key={i} className={styles.weekLabel}>{w}</span>
              ))}
            </div>
            {layout.arr.map((cell, i) => (
              <span
                key={i}
                title={cell.isFuture ? "" : `${cell.date} 互联网引流开户 ${cell.value.toLocaleString()}`}
                className={`${styles.cell} ${styles[`l${cell.level}`]} ${cell.isFuture ? styles.future : ""}`}
                style={{
                  gridColumn: cell.weekIdx + 2,
                  gridRow: cell.dayIdx + 1,
                }}
              />
            ))}
          </div>
        </div>

        {/* 图例：固定 12×12 正方形 + 放右下角 + 不拉伸 */}
        <div className={styles.legendRow}>
          <span className={styles.legendText}>少</span>
          {[0, 1, 2, 3, 4].map((lv) => (
            <span key={lv} className={`${styles.cell} ${styles[`l${lv}`]} ${styles.legendDot}`} />
          ))}
          <span className={styles.legendText}>多</span>
        </div>
      </div>
    </Spin>
  );
};

export default CalendarHeatmap;
