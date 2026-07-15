import React, { useMemo } from "react";
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

const CalendarHeatmap: React.FC<CalendarHeatmapProps> = ({ data, loading, days = 365 }) => {
  const map = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of data || []) m.set(r.date, r.value || 0);
    return m;
  }, [data]);

  const stats = useMemo(() => {
    const values = Array.from(map.values());
    if (values.length === 0) return { max: 0, sum: 0, activeDays: 0 };
    return {
      max: Math.max(...values, 0),
      sum: values.reduce((s, v) => s + v, 0),
      activeDays: values.filter((v) => v > 0).length,
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
      const dateStr = d.toISOString().slice(0, 10);
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
      <div className={styles.wrap}>
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
            style={{ gridTemplateColumns: `40px repeat(${layout.totalWeeks}, 12px)` }}
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
            style={{ gridTemplateColumns: `40px repeat(${layout.totalWeeks}, 12px)` }}
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
