/**
 * 周报预览组件
 */
import React from 'react';
import { Empty, Spin } from 'antd';
import styles from './WeeklyReportPreview.module.scss';

interface WeeklyReportPreviewProps {
  content: string;
  loading: boolean;
  // v3.1.27: 两种空状态提示文案
  // - 'poster': 海报视图未生成数据，提示去点“生成周报”。进页面会自动生成一次默认海报（参考 ReportGeneration 进页面默认预览的模式）
  // - 'text':   文本模式未生成数据，原“点击生成周报”提示
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
      ? '本页进入后会自动生成一次默认海报；请点击上方【生成周报】。海报可切换平台 / 导出图片。'
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
