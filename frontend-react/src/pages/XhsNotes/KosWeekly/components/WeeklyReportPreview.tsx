/**
 * 周报预览组件（分支KOS转化周报）
 */
import React from 'react';
import { Empty, Spin } from 'antd';
import styles from './WeeklyReportPreview.module.scss';

interface WeeklyReportPreviewProps {
  content: string;
  loading: boolean;
  mode?: 'poster' | 'text';
}

const WeeklyReportPreview: React.FC<WeeklyReportPreviewProps> = ({ content, loading, mode = 'text' }) => {
  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <Spin size="large" />
        <p className={styles.loadingText}>正在生成周报...</p>
      </div>
    );
  }

  if (!content) {
    const tip = mode === 'poster'
      ? '本页进入后会自动生成一次默认海报；请点击上方【生成周报】。'
      : '点击“生成周报”按钮开始生成周报';
    return (
      <Empty
        className={styles.emptyContainer}
        description={
          <span style={{ color: '#999', fontSize: 14 }}>
            {tip}
          </span>
        }
      />
    );
  }

  return (
    <div className={styles.previewContainer}>
      <pre className={styles.reportContent}>{content}</pre>
    </div>
  );
};

export default WeeklyReportPreview;
