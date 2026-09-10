/**
 * 智能诊断（v4.1.9）
 *
 * 数据源: GET /api/v1/reports/diagnosis（backend/utils/diagnosis 规则引擎，只读聚合）。
 * 页面结构: 月份筛选 → 总体健康概览（MetricSection/MetricCard）→ 底表快照对齐（Table）
 *   → 分链路诊断信号（应用市场 / 全局数据 / 内容平台，error/warn/info 分级卡片）。
 * 输出契约与 backend/utils/diagnosis/engine.py 对齐，类型见 dataService.ts DiagnosisResult；
 * 月份语义体检不适用 FilterBar（其绑定全局日期范围），遵循既有特殊报表例外自建月选择器。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, DatePicker, Empty, Space, Spin, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  BookOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  ExclamationCircleFilled,
  GlobalOutlined,
  InfoCircleFilled,
  MedicineBoxOutlined,
  MobileOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { FadeInSection } from '@/components';
import { MetricCard, MetricSection } from '@/components/MetricCard';
import { ReportFooter } from '@/components/ReportFooter';
import { dataServiceReports } from '@/services/dataService';
import type { DiagnosisItem, DiagnosisResult } from '@/services/dataService';
import styles from './index.module.scss';

type LevelKey = DiagnosisItem['level'];
type StatusKey = 'ok' | 'info' | 'warn' | 'error';

const LEVEL_META: Record<LevelKey, { label: string; color: string; icon: React.ReactNode }> = {
  error: { label: '严重', color: 'var(--color-error)', icon: <CloseCircleFilled /> },
  warn: { label: '预警', color: 'var(--color-warning)', icon: <ExclamationCircleFilled /> },
  info: { label: '提示', color: 'var(--color-info)', icon: <InfoCircleFilled /> },
};

const STATUS_META: Record<StatusKey, { label: string; color: string; icon: React.ReactNode }> = {
  ok: { label: '数据健康', color: 'var(--color-success)', icon: <CheckCircleFilled /> },
  info: { label: '一般提示', color: 'var(--color-info)', icon: <InfoCircleFilled /> },
  warn: { label: '存在预警', color: 'var(--color-warning)', icon: <ExclamationCircleFilled /> },
  error: { label: '存在严重信号', color: 'var(--color-error)', icon: <CloseCircleFilled /> },
};

const STATUS_TAG_COLOR: Record<StatusKey, string> = {
  ok: 'green',
  info: 'blue',
  warn: 'orange',
  error: 'red',
};

const CHAIN_META: Record<DiagnosisItem['chain'], { name: string; icon: React.ReactNode }> = {
  appmarket: { name: '应用市场', icon: <MobileOutlined /> },
  global: { name: '全局数据', icon: <GlobalOutlined /> },
  xhs: { name: '内容平台（小红书）', icon: <BookOutlined /> },
};

const CHAIN_ORDER: DiagnosisItem['chain'][] = ['appmarket', 'global', 'xhs'];

const snapshotColumns: ColumnsType<DiagnosisResult['snapshot_dates'][number]> = [
  { title: '底表', dataIndex: 'name', key: 'name' },
  {
    title: '最新数据日',
    dataIndex: 'latest',
    key: 'latest',
    render: (v: string | null) => v || '-',
  },
  {
    title: '距今天数',
    dataIndex: 'days_ago',
    key: 'days_ago',
    align: 'right',
    render: (v: number | null) => {
      if (v === null || v === undefined) return '-';
      const color = v > 7 ? 'var(--color-error)' : v > 3 ? 'var(--color-warning)' : undefined;
      return <span style={color ? { color, fontWeight: 600 } : undefined}>{v}</span>;
    },
  },
];

const DiagnosisPage: React.FC = () => {
  const [month, setMonth] = useState<Dayjs | null>(null);
  const [data, setData] = useState<DiagnosisResult | null>(null);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async (m: Dayjs | null) => {
    setLoading(true);
    try {
      const res = await dataServiceReports.getIntelligentDiagnosis(
        m ? { month: m.format('YYYY-MM') } : undefined,
      );
      if (res?.success) {
        const result = res.data as DiagnosisResult;
        setData(result);
        if (result?.month) {
          setMonth((prev) => prev ?? dayjs(result.month));
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(null);
  }, [loadData]);

  const items = data?.items || [];
  const overall = data?.summary?.overall;
  const overallMeta = overall ? STATUS_META[overall] : null;
  const isEmptyDatabase = !!data && !data.month;

  const chainCount = useCallback(
    (chain: DiagnosisItem['chain']) => data?.summary?.chains?.[chain] || null,
    [data],
  );

  const chainCards = useMemo(
    () =>
      CHAIN_ORDER.map((chain) => {
        const chainItems = items.filter((it) => it.chain === chain);
        const summary = chainCount(chain);
        const meta = CHAIN_META[chain];
        return (
          <Card
            key={chain}
            size="small"
            className={styles.chainCard}
            title={
              <span className={styles.chainTitle}>
                {meta.icon}
                <span>{meta.name}</span>
                {summary && (
                  <Tag color={STATUS_TAG_COLOR[summary.status]} style={{ marginRight: 0 }}>
                    {STATUS_META[summary.status]?.label || summary.status}
                  </Tag>
                )}
              </span>
            }
          >
            {chainItems.length === 0 ? (
              <span className={styles.chainEmpty}>
                <CheckCircleFilled style={{ color: 'var(--color-success)' }} />
                本月无异常信号
              </span>
            ) : (
              <div className={styles.itemList}>
                {chainItems.map((item) => {
                  const levelMeta = LEVEL_META[item.level];
                  return (
                    <div
                      key={item.id}
                      className={styles.itemBlock}
                      style={{ borderLeftColor: levelMeta.color }}
                    >
                      <div className={styles.itemHeader}>
                        <span className={styles.itemLevel} style={{ color: levelMeta.color }}>
                          {levelMeta.icon}
                          <span>{levelMeta.label}</span>
                        </span>
                        <span className={styles.itemTitle}>{item.title}</span>
                      </div>
                      <div className={styles.itemDetail}>{item.detail}</div>
                      {item.evidence && <div className={styles.itemEvidence}>{item.evidence}</div>}
                      {item.suggestion && (
                        <div className={styles.itemSuggestion}>建议：{item.suggestion}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        );
      }),
    [items, chainCount],
  );

  return (
    <div className={styles.page}>
      <Card size="small" className={styles.filterCard}>
        <Space size="middle" wrap>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>诊断月份:</span>
            <DatePicker
              picker="month"
              value={month}
              allowClear={false}
              placeholder="选择月份"
              onChange={(v) => setMonth(v)}
            />
          </div>
          <Button
            type="primary"
            icon={<SearchOutlined />}
            loading={loading}
            onClick={() => loadData(month)}
          >
            查询
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => loadData(month)}>
            刷新
          </Button>
        </Space>
      </Card>

      <Spin spinning={loading}>
        {!data || isEmptyDatabase ? (
          <Card size="small" className={styles.tableCard}>
            <Empty description="暂无诊断数据（库内尚无业务数据或所选月份无记录）" />
          </Card>
        ) : (
          <>
            <FadeInSection>
              <MetricSection
                title={`总体健康概览 · ${data.month}`}
                description={data.generated_at ? `诊断时间：${data.generated_at}` : undefined}
              >
                <MetricCard
                  title="总体状态"
                  icon={<MedicineBoxOutlined />}
                  value={items.length}
                  valueColor={overallMeta?.color}
                  description={
                    overallMeta ? (
                      <span style={{ color: overallMeta.color }}>
                        {overallMeta.icon} {overallMeta.label}
                      </span>
                    ) : (
                      '-'
                    )
                  }
                />
                {CHAIN_ORDER.map((chain) => {
                  const summary = chainCount(chain);
                  const statusMeta = summary ? STATUS_META[summary.status] : null;
                  return (
                    <MetricCard
                      key={chain}
                      title={CHAIN_META[chain].name}
                      icon={CHAIN_META[chain].icon}
                      value={summary ? summary.error + summary.warn + summary.info : 0}
                      valueColor={statusMeta?.color}
                      description={
                        summary
                          ? `严重 ${summary.error} · 预警 ${summary.warn} · 提示 ${summary.info}`
                          : '-'
                      }
                    />
                  );
                })}
              </MetricSection>
            </FadeInSection>

            <FadeInSection>
              <Card size="small" className={styles.tableCard} title="底表快照对齐">
                <Table
                  rowKey="key"
                  size="small"
                  columns={snapshotColumns}
                  dataSource={data.snapshot_dates || []}
                  pagination={false}
                />
              </Card>
            </FadeInSection>

            <FadeInSection>
              <div className={styles.chainSection}>{chainCards}</div>
            </FadeInSection>

            <ReportFooter
              sources={[
                { label: '数据接口', value: 'GET /api/v1/reports/diagnosis?month=YYYY-MM' },
                { label: '规则引擎', value: 'backend/utils/diagnosis（metrics 取数 → rules 评估 → engine 汇总）' },
                { label: '数据口径', value: '按月体检的只读聚合，不输出任何客户明细行；缺省 month 自动取库内最新月份' },
                { label: '快照对齐', value: '底表最新数据日用于识别上游回写缺失（如个别底表滞后导致的当月异常）' },
              ]}
            />
          </>
        )}
      </Spin>
    </div>
  );
};

export default DiagnosisPage;
