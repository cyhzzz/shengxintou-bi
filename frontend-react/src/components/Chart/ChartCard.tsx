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
  title: string | React.ReactNode;
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
  /** 使用自定义标题样式（如 Dashboard 的 groupHeader 风格） */
  useCustomTitle?: boolean;
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
  useCustomTitle = false,
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

  // 自定义标题渲染
  const renderTitle = () => {
    if (useCustomTitle && typeof title === 'string') {
      return (
        <div className={styles.customTitle}>
          <span className={styles.customTitleText}>{title}</span>
        </div>
      );
    }
    return title;
  };

  return (
    <Card
      className={`${styles.chartCard} ${useCustomTitle ? styles.withCustomTitle : ''} ${className || ''}`}
      title={renderTitle()}
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