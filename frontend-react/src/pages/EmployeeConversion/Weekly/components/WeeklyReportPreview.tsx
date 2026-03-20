/**
 * 周报预览组件
 */
import React from 'react';
import { Empty, Spin } from 'antd';
import styles from './WeeklyReportPreview.module.scss';

interface WeeklyReportPreviewProps {
  content: string;
  loading: boolean;
}

const WeeklyReportPreview: React.FC<WeeklyReportPreviewProps> = ({ content, loading }) => {
  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <Spin size="large" />
        <p className={styles.loadingText}>正在生成周报...</p>
      </div>
    );
  }

  if (!content) {
    return (
      <Empty
        className={styles.emptyContainer}
        description={
          <span style={{ color: '#999', fontSize: 14 }}>
            点击"生成周报"按钮开始生成周报
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