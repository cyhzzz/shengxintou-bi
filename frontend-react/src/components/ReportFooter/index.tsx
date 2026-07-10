import React from 'react';
import styles from './ReportFooter.module.scss';

export interface ReportFooterSource {
  label: string;
  value: React.ReactNode;
}

export interface ReportFooterProps {
  /** 结构化的数据源 / 口径标签，例如 [{ label: '数据源', value: 'agg_daily_channel_open' }] */
  sources?: ReportFooterSource[];
  /** 自由备注文本（支持 ReactNode，便于插入链接 / 多行说明） */
  notes?: React.ReactNode;
  className?: string;
}

/**
 * 报表页底部弱化区。
 * 用来集中展示"数据源 / 口径 / 备注"这类说明性文字，
 * 避免散落在筛选卡 / Tab 内容 / 卡片描述里。
 *
 * 视觉上：底部一行 / 多行小字，颜色 --color-text-tertiary，字号 --text-sm，
 * 背景透明，无边框 —— 只起到"脚注"作用，不抢主区域视觉权重。
 */
export const ReportFooter: React.FC<ReportFooterProps> = ({
  sources,
  notes,
  className,
}) => {
  if (!sources?.length && !notes) return null;

  const cls = [styles.footer, className].filter(Boolean).join(' ');

  return (
    <div className={cls} role="contentinfo" aria-label="报表数据源与口径说明">
      {sources?.map((s, idx) => (
        <div key={idx} className={styles.row}>
          <span className={styles.label}>{s.label}</span>
          <span className={styles.value}>{s.value}</span>
        </div>
      ))}
      {notes && <div className={styles.notes}>{notes}</div>}
    </div>
  );
};

export default ReportFooter;