/**
 * 备份进度组件
 */
import React from 'react';
import { Progress, Space } from 'antd';

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
    <div style={{ marginBottom: 24 }}>
      <Progress
        percent={progress}
        status={getProgressStatus()}
        strokeColor={{
          '0%': '#108ee9',
          '100%': '#87d068',
        }}
      />
      <Space style={{ marginTop: 12 }}>
        <span>状态: <strong>{getStatusText()}</strong></span>
        <span>进度: <strong>{progress}%</strong></span>
        {message && <span style={{ color: 'var(--color-text-secondary)' }}>{message}</span>}
      </Space>
    </div>
  );
};

export default BackupProgress;