/**
 * 指标卡片组件
 * 展示核心指标数值及环比变化
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
  inverseTrend?: boolean; // 成本类指标，下降为正向
  variant?: 'default' | 'asset';
  icon?: React.ReactNode;
  tooltip?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
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

  const getTrendColor = (color?: WowChangeColor) => {
    // 对于成本类指标（inverseTrend=true），颜色逻辑反转
    // 成本下降是好事，应该显示绿色
    const isPositive = color === 'green';
    if (inverseTrend) {
      return isPositive ? '#f5222d' : '#52c41a';
    }
    return isPositive ? '#52c41a' : '#f5222d';
  };

  const renderWowChange = () => {
    if (!wowChange || wowChange.value === undefined) {
      // 显示占位符，保持卡片高度一致
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

  return (
    <Card
      className={`${styles.metricCard} ${styles[`metricCard--${variant}`]}`}
      hoverable
    >
      <div className={styles.metricContent}>
        <div className={styles.metricTitle}>
          {icon && <span className={styles.metricIcon}>{icon}</span>}
          {titleContent}
        </div>
        <div className={styles.metricValue}>
          {prefix && <span className={styles.metricPrefix}>{prefix}</span>}
          <span className={styles.metricNumber}>{formatValue(value)}</span>
          {suffix && <span className={styles.metricSuffix}>{suffix}</span>}
        </div>
        {renderWowChange()}
      </div>
    </Card>
  );
};

export default MetricCard;