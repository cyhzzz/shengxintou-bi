import React from 'react';
import { Funnel } from '@ant-design/charts';
import type { FunnelConfig } from '@ant-design/charts/lib/funnel';
import styles from './FunnelChart.module.scss';

export interface FunnelStage {
  name: string;
  count: number;
  rate?: number;
  conversionRate?: number;
}

export interface FunnelChartProps {
  data: FunnelStage[];
  height?: number;
}

const formatNumber = (v: number) => Number(v || 0).toLocaleString();

const FunnelChart: React.FC<FunnelChartProps> = ({ data, height = 420 }) => {
  if (!data || data.length === 0) {
    return (
      <div
        className={styles.funnelChart}
        style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <span style={{ color: 'var(--color-text-tertiary)' }}>暂无数据</span>
      </div>
    );
  }

  const config: FunnelConfig = {
    data: data.map((d) => ({ stage: d.name, value: d.count })),
    xField: 'stage',
    yField: 'value',
    legend: false,
    animate: { enter: { type: 'fadeIn', duration: 400 } },
    label: {
      position: 'inside',
      text: (datum: { stage: string; value: number }) =>
        `${datum.stage}
${formatNumber(datum.value)}`,
      style: {
        fill: '#fff',
        fontSize: 13,
        fontWeight: 600,
      },
    },
    conversionTag: {
      size: 36,
      spacing: 8,
      style: {
        background: 'var(--color-brand-bg, rgba(24,144,255,0.08))',
        borderRadius: 4,
        fontSize: 12,
      },
      formatter: (datum: { $$percentage$$?: number }) =>
        typeof datum.$$percentage$$ === 'number'
          ? `${(datum.$$percentage$$ * 100).toFixed(1)}%`
          : '',
    },
    style: {
      width: '100%',
      height,
    },
  };

  return (
    <div className={styles.funnelChart}>
      <Funnel {...config} />
    </div>
  );
};

export default FunnelChart;
