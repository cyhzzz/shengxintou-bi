/**
 * 漏斗图组件（v3.1.2：@ant-design/plots Funnel + CSS 横条降级）
 *
 * - 主实现：@ant-design/plots 的 Funnel（@ant-design/charts v2 透传）
 * - 降级：React ErrorBoundary 兜底 + CSS 横条漏斗（保留 v3.1.1 旧版视觉）
 * - 数据格式：data: FunnelStage[] 内部转 [{ stage, value }] 喂给 chart
 *
 * 为何这样设计：
 * - antd-charts v2.6.7 + antv g2 v5 修复了旧版的 conversionTag.style 抛错
 * - 但即便偶发报错（数据缺字段 / props 类型不兼容），用户感知到的是 CSS 横条，不会白屏
 */
import React, { Component, ReactNode } from 'react';
import { Card, Empty, Tag, Tooltip } from 'antd';
import { ArrowDownOutlined } from '@ant-design/icons';
import FunnelChartAntd from '@ant-design/plots/es/components/funnel';
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
  palette?: string[];
  showOverall?: boolean;
  /**
   * 是否使用对数刻度（log10）映射各级宽度。
   * 当各级数据偏差较大（如曝光 1,000,000 vs 有效户 100），
   * 线性映射下底层阶段宽度趋近于 0、看不清。开启后视觉宽度更平衡。
   * tooltip / label 仍显示原始人数。
   */
  useLogScale?: boolean;
}

const formatNumber = (v: number) => Number(v || 0).toLocaleString();

const DEFAULT_PALETTE = ['#1677ff', '#4096ff', '#69b1ff', '#91caff', '#bae0ff'];

/** CSS 横条降级实现（仅 ErrorBoundary 使用） */
const FallbackBars: React.FC<{ data: FunnelStage[]; palette?: string[]; height: number; useLogScale?: boolean }> = ({
  data,
  palette,
  height,
  useLogScale = false,
}) => {
  const colors = palette?.length ? palette : DEFAULT_PALETTE;
  const plotValues = data.map((d) => useLogScale ? Math.log10(d.count + 1) : d.count);
  const max = plotValues.reduce((m, v) => Math.max(m, v), 0);
  return (
    <div className={styles.fallback} style={{ minHeight: height }}>
      {data.map((stage, idx) => {
        const w = max > 0 ? (plotValues[idx] / max) * 100 : 0;
        const color = colors[idx % colors.length];
        return (
          <div key={idx} className={styles.fbRow}>
            <div
              className={styles.fbBar}
              style={{
                width: `max(${w}%, 12%)`,
                background: `linear-gradient(90deg, ${color} 0%, ${color}cc 100%)`,
              }}
            >
              <span className={styles.fbName}>{idx + 1}. {stage.name}</span>
              <span className={styles.fbCount}>{formatNumber(stage.count)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

interface BoundaryProps {
  children: ReactNode;
  data: FunnelStage[];
  palette?: string[];
  height: number;
  useLogScale?: boolean;
}

class ChartErrorBoundary extends Component<BoundaryProps, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    // 降级而非白屏；开发期排查用
    // eslint-disable-next-line no-console
    console.warn('[FunnelChart] @ant-design/plots Funnel 渲染失败，降级到 CSS 横条:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <FallbackBars data={this.props.data} palette={this.props.palette} height={this.props.height} useLogScale={this.props.useLogScale} />
      );
    }
    return this.props.children;
  }
}

const FunnelChart: React.FC<FunnelChartProps> = ({
  data,
  height = 360,
  palette,
  showOverall = true,
  useLogScale = false,
}) => {
  if (!data || data.length === 0) {
    return (
      <Card size="small" className={styles.emptyCard} style={{ minHeight: height }}>
        <Empty description="暂无漏斗数据" />
      </Card>
    );
  }

  const clean = data
    .filter((d) => d && typeof d.count === 'number' && Number.isFinite(d.count))
    .map((d) => ({ ...d, count: Math.max(0, d.count) }));

  if (!clean.length) {
    return (
      <Card size="small" className={styles.emptyCard} style={{ minHeight: height }}>
        <Empty description="暂无有效漏斗数据" />
      </Card>
    );
  }

  const firstCount = clean[0]?.count ?? 0;
  const lastCount = clean[clean.length - 1]?.count ?? 0;
  const overallRate = firstCount > 0 ? (lastCount / firstCount) * 100 : 0;
  const colors = palette && palette.length ? palette : DEFAULT_PALETTE;

  // 对数尺度：将人数映射到 log10(count+1)，tooltip / label 仍用原始人数
  const plotValues = clean.map((s) => useLogScale ? Math.log10(s.count + 1) : s.count);
  const chartData = clean.map((s, idx) => ({ stage: s.name, value: plotValues[idx] }));
  const chartHeight = Math.max(220, height - 64); // 阶段标签占 64px

  return (
    <div className={styles.funnelChart} style={{ minHeight: height }}>
      <div className={styles.chartWrap}>
        <ChartErrorBoundary data={clean} palette={colors} height={chartHeight} useLogScale={useLogScale}>
          <FunnelChartAntd
            data={chartData}
            xField="stage"
            yField="value"
            legend={false}
            height={chartHeight}
            style={{ fillOpacity: 0.92, stroke: '#fff', lineWidth: 2 }}
            scale={{ color: { range: colors.slice(0, clean.length) } }}
            animation={{
              appear: {
                animation: 'wave-in',
                duration: 700,
                delay: (d: any, index: number) => index * 120,
                easing: 'ease-out',
              },
              enter: {
                animation: 'fade-in',
                duration: 400,
              },
            }}
            label={{
              text: (d: { stage?: string; value?: number }, index?: number) => {
                const orig = clean[index ?? 0]?.count ?? 0;
                return `${d.stage ?? ''}\n${orig.toLocaleString()} 人`;
              },
              position: 'inside',
              transform: [{ type: 'overlapDodgeY' }],
              style: {
                fill: '#fff',
                fontSize: 13,
                fontWeight: 600,
              },
            }}
            tooltip={{
              title: (d: { stage?: string }) => d.stage,
              items: [
                (d: { stage?: string; value?: number }, index?: number) => ({
                  name: d.stage ?? '',
                  value: (clean[index ?? 0]?.count ?? 0).toLocaleString(),
                }),
              ],
            }}
          />
        </ChartErrorBoundary>
      </div>

      {/* 阶段明细 + 阶段转化率 */}
      <div className={styles.stageList}>
        {clean.map((stage, idx) => {
          const prev = idx > 0 ? clean[idx - 1] : null;
          const stepRate = prev && prev.count > 0 ? (stage.count / prev.count) * 100 : null;
          return (
            <span key={`${stage.name}-${idx}`} className={styles.stageTag}>
              <Tag color="blue">{idx + 1}. {stage.name}</Tag>
              {stepRate != null && (
                <Tooltip title={`${prev?.name} → ${stage.name}`}>
                  <Tag color={stepRate > 30 ? 'green' : stepRate > 5 ? 'gold' : 'default'}>
                    <ArrowDownOutlined /> 阶段 {stepRate.toFixed(2)}%
                  </Tag>
                </Tooltip>
              )}
            </span>
          );
        })}
      </div>

      {showOverall && firstCount > 0 && (
        <div className={styles.overall}>
          <span className={styles.overallLabel}>整体转化</span>
          <Tag color={overallRate > 20 ? 'green' : overallRate > 3 ? 'gold' : 'default'}>
            {clean[0].name} → {clean[clean.length - 1].name}：{overallRate.toFixed(2)}%
          </Tag>
        </div>
      )}
    </div>
  );
};

export default FunnelChart;