/**
 * 备份进度组件（v3.1.6 design token 化：去除 inline style）
 */
import React from 'react';
import { Progress, Space } from 'antd';
import styles from './BackupProgress.module.scss';

interface BackupProgressProps {
  status: string;
  progress: number;
  message: string;
}

const BackupProgress: React.FC<BackupProgressProps> = ({
  status,
  progress,
  message,
}) => {
  const getStatusText = () => {
    switch (status) {
      case 'pending':
        return '等待中';
      case 'uploading':
        return '上传中';
      case 'downloading':
        return '下载中';
      case 'completed':
        return '已完成';
      case 'failed':
        return '失败';
      default:
        return status;
    }
  };

  const getProgressStatus = (): 'success' | 'exception' | 'active' => {
    if (status === 'completed') return 'success';
    if (status === 'failed') return 'exception';
    return 'active';
  };

  return (
    <div className={styles.backupProgress}>
      <Progress
        percent={progress}
        status={getProgressStatus()}
        strokeColor={{
          '0%': 'var(--color-brand)',
          '100%': 'var(--color-success)',
        }}
      />
      <Space size="middle" wrap className={styles.statusLine}>
        <span className={styles.statusLabel}>
          状态: <strong className={styles.statusValue}>{getStatusText()}</strong>
        </span>
        <span className={styles.statusLabel}>
          进度: <strong className={styles.statusValue}>{progress}%</strong>
        </span>
        {message && <span className={styles.statusMessage}>{message}</span>}
      </Space>
    </div>
  );
};

export default BackupProgress;