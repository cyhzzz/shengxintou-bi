import React, { useMemo } from "react";
import { Card, Spin, Space } from "antd";
import styles from "./CalendarHeatmap.module.scss";

interface CalendarHeatmapProps {
  data: { date: string; value: number }[];
  loading?: boolean;
  title?: string;
  description?: string;
  days?: number;
}

const WEEK_LABELS = ['\u4e00', '\u4e09', '\u4e94', '\u65e5'];
const MONTH_LABELS = ['1\u6708','2\u6708','3\u6708','4\u6708','5\u6708','6\u6708','7\u6708','8\u6708','9\u6708','10\u6708','11\u6708','12\u6708'];
const CalendarHeatmap: React.FC<CalendarHeatmapProps> = ({ data, loading, title = "\u70ed\u529b\u56fe\uff1a\u8fc7\u53bb\u4e00\u5e74\u4e92\u8054\u7f51\u5f15\u6d41\u5f00\u6237\u6570", description = "\u6bcf\u65e5\u4e92\u8054\u7f51\u5f15\u6d41\u5f00\u6237\u6570\u5bc6\u5ea6", days = 365 }) => {
  const map = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of data || []) m.set(r.date, r.value || 0);
    return m;
  }, [data]);

  const stats = useMemo(() => {
    const values = Array.from(map.values());
    if (values.length === 0) return { max: 0, sum: 0, activeDays: 0 };
    return { max: Math.max(...values, 0), sum: values.reduce((s, v) => s + v, 0), activeDays: values.filter((v) => v > 0).length };
  }, [map]);

  const layout = useMemo(() => {
    const arr: { date: string; value: number; level: number; isFuture: boolean }[] = [];
    const today = new Date();
    const endD = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const start = new Date(endD); start.setDate(endD.getDate() - (days - 1));
    // align to Monday
    const startDow = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - startDow);
    const totalDays = Math.floor((endD.getTime() - start.getTime()) / 86400000) + 1;
    const totalWeeks = Math.ceil(totalDays / 7);
    for (let i = 0; i < totalWeeks * 7; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
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
      arr.push({ date: dateStr, value: v, level, isFuture });
    }
    const monthLabels: { weekIdx: number; label: string }[] = [];
    let lastMonth = -1;
    for (let w = 0; w < totalWeeks; w++) {
      const c = arr[w * 7];
      if (c) {
        const m = parseInt(c.date.slice(5, 7), 10) - 1;
        if (m !== lastMonth) {
          monthLabels.push({ weekIdx: w, label: MONTH_LABELS[m] });
          lastMonth = m;
        }
      }
    }
    return { arr, totalWeeks, monthLabels };
  }, [days, map, stats.max]);

  return (
    <Card size="small" title={title} extra={<span style={{ color: "var(--color-text-tertiary)", fontSize: 12 }}>{description}</span>}>
      <Spin spinning={loading}>
        <div className={styles.wrap}>
          <div className={styles.statsRow}>
            <Space size={20} wrap>
              <span className={styles.stat}><b>{stats.sum.toLocaleString()}</b> \u5e74\u5ea6\u603b\u5f00\u6237</span>
              <span className={styles.stat}><b>{stats.activeDays}</b> \u4e2a\u6709\u6570\u636e\u65e5</span>
              <span className={styles.stat}><b>{stats.max.toLocaleString()}</b> \u5355\u65e5\u6700\u9ad8</span>
            </Space>
          </div>
          <div className={styles.legendRow}>
            <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>\u5c11</span>
            {[0, 1, 2, 3, 4].map((lv) => <span key={lv} className={`${styles.cell} ${styles[`l${lv}`]} ${styles.legendDot}`} />)}
            <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>\u591a</span>
          </div>
          <div className={styles.body}>
            <div className={styles.monthRow} style={{ gridTemplateColumns: `40px repeat(${layout.totalWeeks}, 1fr)` }}>
              <span />
              {layout.monthLabels.map((m, i) => <span key={i} className={styles.monthLabel} style={{ gridColumnStart: m.weekIdx + 2 }}>{m.label}</span>)}
            </div>
            <div className={styles.grid} style={{ gridTemplateColumns: `40px repeat(${layout.totalWeeks}, 1fr)` }}>
              <div className={styles.weekLabels}>
                {WEEK_LABELS.map((w, i) => <span key={i} className={styles.weekLabel}>{w}</span>)}
              </div>
              {layout.arr.map((cell, i) => (
                <span key={i} title={cell.isFuture ? "" : `${cell.date} \u4e92\u8054\u7f51\u5f15\u6d41\u5f00\u6237 ${cell.value.toLocaleString()}`} className={`${styles.cell} ${styles[`l${cell.level}`]} ${cell.isFuture ? styles.future : ""}`} />
              ))}
            </div>
          </div>
        </div>
      </Spin>
    </Card>
  );
};

export default CalendarHeatmap;

