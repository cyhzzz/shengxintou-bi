/**
 * 图表卡片组件
 * 提供统一的图表容器，包含标题、工具栏和加载状态
 */
import React from 'react';
import { Card, Spin, Empty, Space, Button, Tooltip } from 'antd';
import {
  ReloadOutlined,
  DownloadOutlined,
  FullscreenOutlined,
} from '@ant-design/icons';
import styles from './ChartCard.module.scss';

interface ChartCardProps {
  title: string;
  children?: React.ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyText?: string;
  onRefresh?: () => void;
  onDownload?: () => void;
  onFullscreen?: () => void;
  extra?: React.ReactNode;
  height?: number | string;
  className?: string;
}

const ChartCard: React.FC<ChartCardProps> = ({
  title,
  children,
  loading = false,
  empty = false,
  emptyText = '暂无数据',
  onRefresh,
  onDownload,
  onFullscreen,
  extra,
  height = 300,
  className,
}) => {
  // 工具栏操作
  const toolbar = (
    <Space size={4}>
      {onRefresh && (
        <Tooltip title="刷新">
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            onClick={onRefresh}
          />
        </Tooltip>
      )}
      {onDownload && (
        <Tooltip title="下载">
          <Button
            type="text"
            size="small"
            icon={<DownloadOutlined />}
            onClick={onDownload}
          />
        </Tooltip>
      )}
      {onFullscreen && (
        <Tooltip title="全屏">
          <Button
            type="text"
            size="small"
            icon={<FullscreenOutlined />}
            onClick={onFullscreen}
          />
        </Tooltip>
      )}
      {extra}
    </Space>
  );

  return (
    <Card
      className={`${styles.chartCard} ${className || ''}`}
      title={title}
      extra={toolbar}
    >
      <div className={styles.chartContainer} style={{ height }}>
        {loading ? (
          <div className={styles.loading}>
            <Spin />
          </div>
        ) : empty ? (
          <div className={styles.empty}>
            <Empty description={emptyText} />
          </div>
        ) : (
          children
        )}
      </div>
    </Card>
  );
};

export default ChartCard;