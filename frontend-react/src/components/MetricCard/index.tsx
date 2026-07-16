/**
 * 统一指标卡片组件
 * 从 Dashboard 指标卡片抽象而来，供各报表头部数据卡片复用。
 */
import React from 'react';
import { Card, Tooltip } from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
} from '@ant-design/icons';
import type { WowChangeColor, WowChangeTrend } from '@/types/api.schemas';
import styles from './MetricCard.module.scss';

export interface WowChangeValue {
  value?: number;
  trend?: WowChangeTrend;
  color?: WowChangeColor;
}

export interface MetricCardProps {
  title: React.ReactNode;
  value?: number;
  wowChange?: WowChangeValue;
  prefix?: string;
  suffix?: string;
  formatter?: 'number' | 'currency' | 'percent';
  inverseTrend?: boolean;
  variant?: 'default' | 'asset';
  icon?: React.ReactNode;
  tooltip?: string;
  showWowChange?: boolean;
  valueColor?: string;
  description?: React.ReactNode;
  className?: string;
}

export interface MetricSectionProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  gridClassName?: string;
  minCardWidth?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  wowChange,
  prefix,
  suffix,
  formatter = 'number',
  inverseTrend = false,
  variant = 'default',
  icon,
  tooltip,
  showWowChange = true,
  valueColor,
  description,
  className,
}) => {
  const formatValue = (val?: number): string => {
    if (val === undefined || val === null) return '-';

    switch (formatter) {
      case 'currency':
        if (val >= 10000) {
          return `${(val / 10000).toFixed(2)}万`;
        }
        return val.toLocaleString('zh-CN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      case 'percent':
        return `${val.toFixed(2)}%`;
      default:
        return val.toLocaleString('zh-CN');
    }
  };

  const getTrendIcon = (trend?: WowChangeTrend) => {
    switch (trend) {
      case 'up':
        return <ArrowUpOutlined />;
      case 'down':
        return <ArrowDownOutlined />;
      default:
        return <MinusOutlined />;
    }
  };

  // 中国股市惯例上升=红下降=绿：color 只是方向标记，不区分业务趋势。inverseTrend 已废弃但保留接口避免外部 break。
  const getTrendColor = (color?: WowChangeColor) =>
    color === 'green' ? 'var(--color-success)' : 'var(--color-error)';

  const renderFooter = () => {
    if (description) {
      return <div className={styles.metricDescription}>{description}</div>;
    }

    if (!showWowChange) {
      return null;
    }

    if (!wowChange || wowChange.value === undefined) {
      return <div className={styles.wowChangePlaceholder}>—</div>;
    }

    return (
      <Tooltip title="环比变化">
        <div
          className={styles.wowChange}
          style={{ color: getTrendColor(wowChange.color) }}
        >
          {getTrendIcon(wowChange.trend)}
          <span className={styles.wowValue}>
            {Math.abs(wowChange.value).toFixed(2)}%
          </span>
        </div>
      </Tooltip>
    );
  };

  const titleContent = tooltip ? (
    <Tooltip title={tooltip}>
      <span>{title}</span>
    </Tooltip>
  ) : (
    title
  );

  const cardClassName = [
    styles.metricCard,
    styles[`metricCard--${variant}`],
    className,
  ].filter(Boolean).join(' ');

  return (
    <Card className={cardClassName} hoverable>
      <div className={styles.metricContent}>
        <div className={styles.metricTitle}>
          {icon && <span className={styles.metricIcon}>{icon}</span>}
          {titleContent}
        </div>
        <div className={styles.metricValue}>
          {prefix && <span className={styles.metricPrefix}>{prefix}</span>}
          <span className={styles.metricNumber} style={valueColor ? { color: valueColor } : undefined}>
            {formatValue(value)}
          </span>
          {suffix && <span className={styles.metricSuffix}>{suffix}</span>}
        </div>
        {renderFooter()}
      </div>
    </Card>
  );
};

export const MetricSection: React.FC<MetricSectionProps> = ({
  title,
  description,
  children,
  className,
  gridClassName,
  minCardWidth = '180px',
}) => {
  const sectionClassName = [styles.metricSection, className].filter(Boolean).join(' ');
  const gridClassNames = [styles.metricGrid, gridClassName].filter(Boolean).join(' ');

  return (
    <Card className={sectionClassName} size="small">
      {(title || description) && (
        <div className={styles.sectionHeader}>
          {title && <div className={styles.sectionTitle}>{title}</div>}
          {description && <div className={styles.sectionDesc}>{description}</div>}
        </div>
      )}
      <div
        className={gridClassNames}
        style={{ '--metric-card-min-width': minCardWidth } as React.CSSProperties}
      >
        {children}
      </div>
    </Card>
  );
};

export default MetricCard;
