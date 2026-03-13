/**
 * 漏斗图组件
 * 用于转化漏斗展示
 */
import React from 'react';
import { Progress, Typography } from 'antd';
import styles from './FunnelChart.module.scss';

const { Text } = Typography;

interface FunnelStage {
  name: string;
  count: number;
  rate?: number;
  conversionRate?: number;
}

interface FunnelChartProps {
  data: FunnelStage[];
  height?: number;
  showConversionRate?: boolean;
}

const FunnelChart: React.FC<FunnelChartProps> = ({
  data,
  height = 400,
  showConversionRate = true,
}) => {
  const maxValue = Math.max(...data.map((d) => d.count));

  return (
    <div className={styles.funnelChart} style={{ height }}>
      {data.map((stage, index) => {
        const width = (stage.count / maxValue) * 100;
        const colorIndex = index % COLORS.length;

        return (
          <div key={stage.name} className={styles.funnelStage}>
            <div className={styles.stageLabel}>
              <Text strong>{stage.name}</Text>
              <Text type="secondary">{stage.count.toLocaleString()}</Text>
            </div>
            <Progress
              percent={width}
              strokeColor={COLORS[colorIndex]}
              trailColor="#f0f0f0"
              showInfo={false}
              strokeWidth={20}
            />
            {showConversionRate && stage.conversionRate !== undefined && (
              <Text type="secondary" className={styles.conversionRate}>
                转化率: {stage.conversionRate.toFixed(2)}%
              </Text>
            )}
          </div>
        );
      })}
    </div>
  );
};

// 默认颜色
const COLORS = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1'];

export default FunnelChart;