/**
 * 环比变化指示器组件
 * 显示指标环比变化的方向和数值
 */
import React from 'react';
import { Tag, Tooltip } from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import type { WowChangeColor, WowChangeTrend } from '@/types/api.schemas';

export interface WowChangeIndicatorProps {
  value?: number;
  trend?: WowChangeTrend;
  color?: WowChangeColor;
  showTooltip?: boolean;
  inverseTrend?: boolean; // 成本类指标，颜色逻辑反转
}

const WowChangeIndicator: React.FC<WowChangeIndicatorProps> = ({
  value,
  trend,
  color,
  showTooltip = true,
  inverseTrend = false,
}) => {
  if (value === undefined) return null;

  const isUp = trend === 'up';
  const isGreen = color === 'green';

  // 对于成本类指标（inverseTrend=true），颜色逻辑反转
  const displayColor = inverseTrend
    ? isGreen ? 'error' : 'success'
    : isGreen ? 'success' : 'error';

  const Icon = isUp ? ArrowUpOutlined : ArrowDownOutlined;

  const content = (
    <Tag color={displayColor} icon={<Icon />}>
      {Math.abs(value).toFixed(2)}%
    </Tag>
  );

  if (showTooltip) {
    return (
      <Tooltip title="环比变化">
        {content}
      </Tooltip>
    );
  }

  return content;
};

export default WowChangeIndicator;